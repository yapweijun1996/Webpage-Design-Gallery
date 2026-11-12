"""Exercise SSOT generation, color contracts and regression rejection."""

import importlib.util
import json
import shutil
import tempfile
import unittest
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
SPEC = importlib.util.spec_from_file_location("check_ssot", ROOT / "scripts/check_ssot.py")
ssot = importlib.util.module_from_spec(SPEC)
SPEC.loader.exec_module(ssot)
builder = ssot.design_system


class DesignSystemTests(unittest.TestCase):
    def setUp(self):
        self.directory = tempfile.TemporaryDirectory(prefix="gallery-ssot-test-")
        self.root = Path(self.directory.name)
        shutil.copytree(ROOT / "design-system", self.root / "design-system")
        (self.root / "assets").mkdir()
        shutil.copy(ROOT / "assets/icons-sources.json", self.root / "assets/icons-sources.json")
        builder.build(self.root)

    def tearDown(self):
        self.directory.cleanup()

    def update_tokens(self, mutate):
        path = self.root / "design-system/tokens.json"
        data = json.loads(path.read_text())
        mutate(data)
        path.write_text(json.dumps(data))

    def test_generation_is_deterministic_and_compatible(self):
        first = builder.outputs(self.root)
        builder.build(self.root)
        builder.build(self.root, check=True)
        self.assertEqual(first, builder.outputs(self.root))
        self.assertIn("--ink: var(--color-text)", first["assets/tokens.css"])
        self.assertIn('id="arrow-right"', first["assets/icons.svg"])

    def test_stale_generated_artifact_is_rejected(self):
        with (self.root / "assets/tokens.css").open("a") as stream:
            stream.write("/* tampered */")
        errors, _, _ = ssot.check(self.root)
        self.assertTrue(any("Stale design-system artifacts" in error for error in errors))

    def test_new_hardcoded_color_is_rejected(self):
        (self.root / "assets/new-component.css").write_text(".card { color: #123456; }")
        errors, _, _ = ssot.check(self.root)
        self.assertTrue(any("#123456" in error for error in errors))

    def test_same_count_color_substitution_is_rejected(self):
        source = ".card { color: #123456; }"
        baseline = {"declarations": dict(ssot.violations("assets/test.css", source))}
        (self.root / "design-system/legacy-baseline.json").write_text(json.dumps(baseline))
        (self.root / "assets/test.css").write_text(source.replace("#123456", "#654321"))
        errors, _, _ = ssot.check(self.root)
        self.assertTrue(any("#654321" in error for error in errors))

    def test_removing_legacy_debt_is_allowed(self):
        (self.root / "assets/gallery.css").write_text(".card { color: var(--color-text); }")
        self.assertEqual(ssot.check(self.root)[0], [])

    def test_brand_primitive_must_live_in_registry(self):
        self.assertTrue(ssot.violations("demos/corporate/gjh/v1/style.css", ":root { --brand: #123456; }"))
        self.assertTrue(ssot.violations("demos/corporate/gjh/v1/style.css", ".button { color: #123456; }"))

    def test_variable_fallback_cannot_hide_literal(self):
        self.assertTrue(ssot.violations("assets/test.css", ".button { color: var(--color-text, #123456); }"))

    def test_named_and_modern_color_literals_are_rejected(self):
        for value in ("rebeccapurple", "RGB(1 2 3)", "oklch(60% .1 30)", "var(--color-text, coral)"):
            with self.subTest(value=value):
                self.assertTrue(ssot.violations("assets/test.css", f".button {{ color: {value}; }}"))
        self.assertFalse(ssot.violations("assets/test.css", ".button { color: var(--gold); }"))

    def test_custom_primitive_cannot_bypass_registry(self):
        self.assertTrue(ssot.violations("assets/test.css", ":root { --body-size: 18px; }"))
        self.assertFalse(ssot.violations("assets/pwa.css", ":root { --app-chrome-height: 76px; }"))

    def test_font_shorthand_cannot_hide_literal(self):
        self.assertTrue(ssot.violations("assets/test.css", ".button { font: 700 16px/1.5 Arial; }"))

    def test_migrated_legacy_debt_cannot_return(self):
        (self.root / "assets/gallery.css").write_text(".company-cover img { border-radius: 6px 6px 0 0; }")
        self.assertTrue(ssot.check(self.root)[0])

    def test_all_version_themes_are_isolated_and_complete(self):
        registry = json.loads((self.root / "design-system/themes.json").read_text())
        self.assertEqual(set(registry["themes"]), {"v1", "v5", "v6", "v7", "v8", "v9", "v10", "v11"})
        css = builder.render_themes(self.root)
        for version in registry["themes"]:
            self.assertIn(f'html[data-gjh-design="{version}"]', css)
        self.assertEqual(registry["themes"]["v1"]["tokens"]["accent"], "#d31b47")
        self.assertEqual(registry["themes"]["v7"]["tokens"]["paper"], "#252124")

    def test_stale_theme_artifact_is_rejected(self):
        (self.root / "assets/gjh-themes.css").write_text("/* stale */")
        self.assertTrue(any("Stale" in error for error in ssot.check(self.root)[0]))

    def test_duplicate_component_ownership_is_rejected(self):
        for name in ("first.css", "second.css"):
            (self.root / "assets" / name).write_text(".company-card { color: var(--color-text); }")
        errors, _, _ = ssot.check(self.root)
        self.assertTrue(any("ownership|.company-card" in error for error in errors))

    def test_comma_selector_cannot_hide_duplicate_ownership(self):
        (self.root / "assets/first.css").write_text(".other, .company-card { color: var(--color-text); }")
        (self.root / "assets/second.css").write_text(".company-card { color: var(--color-text); }")
        self.assertTrue(any("ownership|.company-card" in error for error in ssot.check(self.root)[0]))

    def test_demo_filename_cannot_impersonate_generated_tokens(self):
        demo = self.root / "demos/corporate/gjh/v1"
        demo.mkdir(parents=True)
        for name in ("tokens.css", "gjh-themes.css"):
            (demo / name).write_text(".button { color: #123456; }")
        errors, _, _ = ssot.check(self.root)
        self.assertTrue(any("v1/tokens.css" in error for error in errors))
        self.assertTrue(any("v1/gjh-themes.css" in error for error in errors))

    def test_missing_and_circular_references_are_rejected(self):
        self.update_tokens(lambda data: data["semantics"].update({"color-text": "var(--missing)"}))
        with self.assertRaisesRegex(ValueError, "Missing token"):
            builder.read_tokens(self.root)
        self.update_tokens(lambda data: data["semantics"].update({"color-text": "var(--color-text)"}))
        with self.assertRaisesRegex(ValueError, "Circular token"):
            builder.read_tokens(self.root)

    def test_low_contrast_semantic_pair_is_rejected(self):
        self.update_tokens(lambda data: data["semantics"].update({"color-text": "var(--palette-white)"}))
        with self.assertRaisesRegex(ValueError, "Token contrast"):
            builder.read_tokens(self.root)

    def test_unapproved_icon_is_rejected(self):
        path = self.root / "design-system/icons.json"
        data = json.loads(path.read_text())
        data["icons"][0]["id"] = "unapproved-icon"
        path.write_text(json.dumps(data))
        with self.assertRaisesRegex(ValueError, "Unknown or duplicate"):
            builder.render_icons(self.root)

    def test_registry_versions_must_match(self):
        self.update_tokens(lambda data: data.update({"version": "2.0.0"}))
        with self.assertRaisesRegex(ValueError, "versions differ"):
            builder.render_icons(self.root)

    def test_unregistered_gallery_breakpoint_is_rejected(self):
        (self.root / "assets/test.css").write_text("@media (max-width: 777px) { .card { display: block; } }")
        errors, _, _ = ssot.check(self.root)
        self.assertTrue(any("Unregistered Gallery breakpoint" in error for error in errors))


if __name__ == "__main__":
    unittest.main()
