"""Static contracts for Pomelo STEM V8: fresh outputs, i18n parity, version SSOT and SemVer."""
import importlib.util
import json
import re
import unittest
from collections import Counter
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
DEMO = ROOT / "demos/corporate/pomelo-stem/v8"
spec = importlib.util.spec_from_file_location("pomelo_v8", ROOT / "scripts/build_pomelo_v8.py")
pomelo = importlib.util.module_from_spec(spec)
spec.loader.exec_module(pomelo)


class PomeloV8Test(unittest.TestCase):
    def test_outputs_are_fresh_and_rules_pass(self):
        pomelo.build(check=True)

    def test_i18n_parity_and_placeholders(self):
        tables = {lang: json.loads((DEMO / f"i18n/{lang}.json").read_text("utf-8")) for lang in ("en", "zh", "ms")}
        for lang in ("zh", "ms"):
            self.assertEqual(set(tables["en"]), set(tables[lang]), lang)
            for key, value in tables["en"].items():
                self.assertEqual(set(re.findall(r"\{\w+\}", value)), set(re.findall(r"\{\w+\}", tables[lang][key])), (lang, key))

    def test_brand_strings_stay_english(self):
        keep = json.loads((DEMO / "i18n/keep-english.json").read_text("utf-8"))["keepEnglish"]
        self.assertIn("Pomelo STEM", keep)
        for lang in ("en", "zh", "ms"):
            table = json.loads((DEMO / f"i18n/{lang}.json").read_text("utf-8"))
            self.assertEqual(table["site.brand"], "Pomelo STEM")
            self.assertEqual(table["site.tagline"], "Growing Smarter Solutions.")

    def test_version_single_source(self):
        release = json.loads((DEMO / "release.json").read_text("utf-8"))
        info = json.loads((DEMO / "build-info.json").read_text("utf-8"))
        self.assertEqual(release, info)
        self.assertRegex(release["version"], r"^\d+\.\d+\.\d+$")
        sw = (DEMO / "sw.js").read_text("utf-8")
        self.assertIn(json.dumps(release["build"]), sw)
        for page in DEMO.glob("**/*.html"):
            if "src" in page.relative_to(DEMO).parts:
                continue
            self.assertIn(f'<meta name="pomelo-version" content="{release["version"]}">', page.read_text("utf-8"), page)

    def test_locale_pages_and_lang(self):
        expected = {"": "en", "zh/": "zh-Hans", "ms/": "ms"}
        for folder, lang in expected.items():
            for page in pomelo.PAGES:
                text = (DEMO / f"{folder}{page}.html").read_text("utf-8")
                self.assertIn(f'<html lang="{lang}"', text)
                self.assertEqual(text.count("<h1"), 1, (folder, page))
                self.assertEqual(text.count('rel="alternate" hreflang='), 3)

    def test_two_ctas_only(self):
        en = json.loads((DEMO / "i18n/en.json").read_text("utf-8"))
        labels = set()
        for page in pomelo.PAGES:
            text = (DEMO / f"{page}.html").read_text("utf-8")
            labels.update(re.sub(r"<[^>]+>", "", m).strip() for m in re.findall(r'class="button button--primary"[^>]*>(.*?)</a>', text))
        self.assertLessEqual(labels - {en["cta.primary"], en["contact.whatsapp"], en["redirect.link"]}, set())

    def test_service_worker_scope_and_cache(self):
        sw = (DEMO / "sw.js").read_text("utf-8")
        self.assertIn("const PREFIX = 'pomelo-v8-';", sw)
        self.assertIn("key.startsWith(PREFIX)", sw)
        manifest = json.loads((DEMO / "manifest.webmanifest").read_text("utf-8"))
        self.assertEqual(manifest["scope"], "./")
        self.assertEqual({icon["purpose"] for icon in manifest["icons"]}, {"any", "maskable"})

    def test_toast_region_is_named_without_duplicate_live_announcements(self):
        for name, source in pomelo.outputs().items():
            if not name.endswith(".html"):
                continue
            with self.subTest(page=name):
                regions = [attrs for _, attrs, _ in pomelo.PageStructure(source).elements if "data-toast-region" in attrs]
                self.assertEqual(len(regions), 1)
                self.assertEqual(regions[0].get("role"), "region")
                self.assertTrue(regions[0].get("aria-label"))
                self.assertNotIn("aria-live", regions[0])

    def test_rendered_pages_never_skip_heading_levels(self):
        pages = {name: source for name, source in pomelo.outputs().items()
                 if name.endswith(".html") and not name.startswith("design/")}
        self.assertEqual(len(pages), 18)
        tables = pomelo.dictionaries()
        for name, source in pages.items():
            with self.subTest(page=name):
                elements = pomelo.PageStructure(source).elements
                headings = [int(tag[1]) for tag, _, _ in elements if re.fullmatch(r"h[1-6]", tag)]
                for previous, current in zip([0] + headings, headings):
                    self.assertLessEqual(current, previous + 1, headings)
                if name.endswith("commerce.html"):
                    self.assertEqual(headings[:4], [1, 2, 3, 3])
                    locale = next((lang for lang, info in pomelo.LOCALES.items() if name.startswith(info["dir"] + "/")), "en")
                    self.assertIn(f'<h2 class="visually-hidden">{tables[locale]["shop.products"]}</h2>', source)

    def test_srcset_width_descriptors_match_real_images(self):
        checked = 0
        for name, source in pomelo.outputs().items():
            if not name.endswith(".html"):
                continue
            for _, attrs, _ in pomelo.PageStructure(source).elements:
                for candidate in attrs.get("srcset", "").split(","):
                    if not candidate.strip():
                        continue
                    path, descriptor = candidate.split()
                    with self.subTest(page=name, image=path):
                        self.assertRegex(descriptor, r"^\d+w$")
                        width, _ = pomelo.image_size((DEMO / name).parent / path)
                        self.assertEqual(int(descriptor[:-1]), width)
                        checked += 1
        self.assertGreater(checked, 0)

    def test_self_heal_checks_unsaved_input_at_reload_time(self):
        guard = pomelo.SW_GUARD
        self.assertIn("document.querySelector('[data-dirty=\"true\"]')", guard)
        self.assertIn("form input, form textarea, form select", guard)
        self.assertIn("field.value !== field.defaultValue", guard)
        self.assertIn("field.checked !== field.defaultChecked", guard)
        self.assertIn("option.defaultSelected", guard)
        self.assertRegex(guard, r"'controllerchange', function \(\) \{\s*if \(hasUnsavedInput\(\)\) return;\s*location.reload\(\);")
        self.assertIn("key = 'pomelo-v8-heal'", guard)
        self.assertIn("sessionStorage.getItem(key) === want", guard)
        self.assertIn("sessionStorage.setItem(key, want)", guard)

    def test_contact_and_commerce_mark_unsaved_input(self):
        contact = (DEMO / "assets/js/components/contact-form.js").read_text("utf-8")
        commerce = (DEMO / "assets/js/components/commerce-demo.js").read_text("utf-8")
        self.assertRegex(contact, r"form.addEventListener\('input', .*?\{\s*form.dataset.dirty = 'true';")
        self.assertRegex(commerce, r"studio.addEventListener\('input',[\s\S]*?studio.dataset.dirty = 'true';")
        self.assertIn("root.dataset.dirty = 'true';", commerce)

    def test_offline_images_keep_small_precache_and_runtime_fallback(self):
        outputs = pomelo.outputs()
        precache = pomelo.precache_list(outputs)
        images = [path for path in precache if path.endswith(".webp")]
        self.assertTrue(images)
        self.assertTrue(all(path.endswith("-768.webp") for path in images))
        for name, source in outputs.items():
            if not name.endswith(".html"):
                continue
            for _, attrs, _ in pomelo.PageStructure(source).elements:
                for candidate in attrs.get("srcset", "").split(","):
                    if not candidate.strip():
                        continue
                    image = ((DEMO / name).parent / candidate.split()[0]).resolve().relative_to(DEMO)
                    fallback = re.sub(r"-\d+\.webp$", "-768.webp", image.as_posix())
                    self.assertIn(fallback, precache, (name, image))
        sw = outputs["sw.js"]
        self.assertIn("if (isImage && response.ok)", sw)
        self.assertIn("cache.put(clean, response.clone())", sw)
        self.assertIn("clean.replace(/-\\d+\\.webp$/, '-768.webp')", sw)
        self.assertIn("await cache.match(fallback)", sw)

    def test_focus_tokens_have_three_to_one_surface_contrast(self):
        colors = json.loads((DEMO / "tokens/primitives.json").read_text("utf-8"))["color"]
        themes = json.loads((DEMO / "tokens/semantics.json").read_text("utf-8"))

        def luminance(value):
            channels = [int(value[index:index + 2], 16) / 255 for index in (1, 3, 5)]
            linear = [channel / 12.92 if channel <= 0.04045 else ((channel + 0.055) / 1.055) ** 2.4
                      for channel in channels]
            return sum(channel * weight for channel, weight in zip(linear, (0.2126, 0.7152, 0.0722)))

        for theme, tokens in themes.items():
            for ring, surface in (("toast-focus", "toast-bg"), ("focus", "surface")):
                with self.subTest(theme=theme, ring=ring, surface=surface):
                    values = sorted(luminance(colors[tokens[key]]) for key in (ring, surface))
                    contrast = (values[1] + 0.05) / (values[0] + 0.05)
                    self.assertGreaterEqual(contrast, 3)
        toast = (DEMO / "assets/css/components/toast.css").read_text("utf-8")
        self.assertRegex(toast, r"\.toast :focus-visible\s*\{\s*outline-color: var\(--c-toast-focus\);")

    def test_prep_checkbox_labels_cover_the_whole_tap_row(self):
        for folder in ("", "zh/", "ms/"):
            source = (DEMO / f"{folder}commerce.html").read_text("utf-8")
            boxes = [(attrs, ancestors) for tag, attrs, ancestors in pomelo.PageStructure(source).elements
                     if tag == "input" and "data-prep" in attrs]
            self.assertEqual(len(boxes), 3)
            for attrs, ancestors in boxes:
                with self.subTest(locale=folder, checkbox=attrs["id"]):
                    labels = [parent for tag, parent in ancestors if tag == "label"]
                    self.assertEqual(len(labels), 1)
                    self.assertEqual(labels[0].get("for"), attrs["id"])


    def test_shell_controls_and_no_js_language_links(self):
        tables = pomelo.dictionaries()
        for name, source in pomelo.outputs().items():
            if not name.endswith(".html"):
                continue
            with self.subTest(page=name):
                elements = pomelo.PageStructure(source).elements
                lang = next(attrs["lang"] for tag, attrs, _ in elements if tag == "html")
                locale = next(key for key, info in pomelo.LOCALES.items() if info["html"] == lang)
                table = tables[locale]
                ids = Counter(attrs["id"] for _, attrs, _ in elements if "id" in attrs)
                self.assertTrue(all(count == 1 for count in ids.values()), ids)
                buttons = [attrs for tag, attrs, ancestors in elements if tag == "button"
                           and any("data-lang-menu" in parent for _, parent in ancestors)]
                self.assertEqual(len(buttons), 1)
                button = buttons[0]
                self.assertIn("hidden", button)
                self.assertEqual(button["type"], "button")
                self.assertEqual(button["aria-expanded"], "false")
                self.assertEqual(button["aria-label"], table["lang.button"].format(language=table[f"lang.{locale}"]))
                controlled = [attrs for tag, attrs, _ in elements if attrs.get("id") == button["aria-controls"] and tag == "ul"]
                self.assertEqual(len(controlled), 1)
                self.assertIn("hidden", controlled[0])
                for hook in ("data-lang-menu", "data-lang-row"):
                    links = [(attrs, ancestors) for tag, attrs, ancestors in elements if tag == "a"
                             and any(hook in parent for _, parent in ancestors)]
                    self.assertEqual({attrs["data-lang"] for attrs, _ in links}, set(pomelo.LOCALES))
                    self.assertEqual(len(links), 3)
                    for attrs, _ in links:
                        target = attrs["data-lang"]
                        self.assertEqual(attrs["lang"], pomelo.LOCALES[target]["html"])
                        self.assertEqual(attrs["hreflang"], attrs["lang"])
                        self.assertIn("data-lang-option", attrs)
                        self.assertEqual(attrs.get("aria-current"), "true" if target == locale else None)
                        checks = [node for tag, node, parents in elements if tag == "svg"
                                  and any(parent is attrs for _, parent in parents)]
                        self.assertEqual(len(checks), int(target == locale))
                        self.assertTrue(((DEMO / name).parent / attrs["href"]).is_file())
                top = [attrs for tag, attrs, _ in elements if tag == "button" and "data-back-to-top" in attrs]
                self.assertEqual(len(top), 1)
                self.assertIn("inert", top[0])
                self.assertEqual(top[0]["aria-hidden"], "true")
                self.assertEqual(top[0]["aria-label"], table["top.label"])
                self.assertEqual(len([attrs for tag, attrs, _ in elements if tag == "a" and attrs.get("class") == "skip-link"]), 1)
                self.assertFalse(any(attrs.get("role") == "menu" for _, attrs, _ in elements))
                runtime = json.loads(re.search(r'<script type="application/json" id="i18n-runtime">(.*?)</script>', source, re.S)[1])
                for key in ("lang.button", "lang.short", "lang.label", "top.label"):
                    self.assertEqual(runtime[key], table[key])

    def test_build_rejects_missing_or_duplicate_shell_controls(self):
        result = pomelo.outputs()
        for marker, label in (("data-lang-menu", "[data-lang-menu] button"), ("data-back-to-top", "back-to-top button")):
            for duplicate in (False, True):
                with self.subTest(marker=marker, duplicate=duplicate):
                    broken = result.copy()
                    if duplicate:
                        addition = '<div data-lang-menu><button></button></div>' if marker == "data-lang-menu" else '<button data-back-to-top></button>'
                        broken["index.html"] = result["index.html"].replace("</body>", addition + "</body>")
                    else:
                        broken["index.html"] = result["index.html"].replace(marker, "data-removed-control")
                    self.assertIn(f"index.html must have exactly one {label}", pomelo.check_rules(broken))

    def test_new_components_and_icon_are_precached(self):
        sw = (DEMO / "sw.js").read_text("utf-8")
        for name in ("lang-menu", "back-to-top"):
            self.assertIn(f'"assets/js/components/{name}.js"', sw)
        self.assertNotIn("lang-switch.js", sw)
        self.assertIn("arrow-up", pomelo.icons())

    def test_css_custom_properties_are_defined(self):
        css = (DEMO / "assets/css/site.bundle.css").read_text("utf-8")
        defined = set(re.findall(r"(--[\w-]+)\s*:", css))
        runtime = {"--lang-menu-shift", "--back-to-top-lift"}
        used = set(re.findall(r"var\((--[\w-]+)", css))
        self.assertEqual(used - defined - runtime, set())


if __name__ == "__main__":
    unittest.main()
