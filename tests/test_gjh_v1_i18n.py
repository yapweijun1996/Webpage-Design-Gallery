"""Unit tests for GJH v1 independent source generation, locale gating, media receipts, and SW cache coverage."""

import hashlib
import importlib.util
import json
import re
import shutil
import tempfile
import unittest
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
SPEC = importlib.util.spec_from_file_location("build_gjh_v1", ROOT / "scripts/build_gjh_v1.py")
v1 = importlib.util.module_from_spec(SPEC)
SPEC.loader.exec_module(v1)


class GjhV1LocalizationTests(unittest.TestCase):
    def setUp(self):
        self.tmp = tempfile.TemporaryDirectory(prefix="gjh-v1-i18n-")
        self.root = Path(self.tmp.name)
        shutil.copytree(ROOT / "demos/corporate/gjh/v1/locales", self.root / "demos/corporate/gjh/v1/locales")

    def tearDown(self):
        self.tmp.cleanup()

    def test_checked_in_generation_matches_and_gates_drafts(self):
        v1.build(ROOT, check=True)
        generated = v1.outputs(ROOT)
        self.assertEqual(
            set(generated),
            {
                "demos/corporate/gjh/v1/index.html",
                "demos/corporate/gjh/v1/zh-Hans/index.html",
                "demos/corporate/gjh/v1/ms/index.html",
            },
        )
        en_html = generated["demos/corporate/gjh/v1/index.html"]
        self.assertIn('lang="en"', en_html)
        self.assertIn('data-locale-gated="zh-Hans"', en_html)
        self.assertIn('data-locale-gated="ms"', en_html)
        self.assertNotIn('data-locale-link="zh-Hans"', en_html)
        self.assertNotIn('hreflang="zh-Hans"', en_html)
        self.assertNotIn('<meta name="robots" content="noindex">', en_html)
        self.assertIn('href="#business"', en_html)
        self.assertIn("Explore our businesses", en_html)
        self.assertIn("Discover Sony", en_html)
        self.assertIn("Discover Borsch Med", en_html)

        for code, expected_label in (("zh-Hans", "简体中文译稿"), ("ms", "Draf Bahasa Melayu")):
            doc = generated[f"demos/corporate/gjh/v1/{code}/index.html"]
            self.assertIn(f'lang="{code}"', doc)
            self.assertIn('<meta name="robots" content="noindex">', doc)
            self.assertIn(expected_label, doc)
            self.assertIn('href="../manifest.webmanifest"', doc)
            self.assertIn('href="../../../../../companies/gjh/index.html"', doc)
            self.assertIn('href="../../../../../style-atlas/index.html#gjh-v1"', doc)
            self.assertIn('href="../index.html"', doc)
            self.assertIn('id="demo-pwa-copy"', doc)

    def test_activated_drafts_emit_reciprocal_links_and_remove_noindex(self):
        activated = v1.outputs(self.root, activate_drafts=True)
        en_html = activated["demos/corporate/gjh/v1/index.html"]
        self.assertIn('data-locale-link="zh-Hans"', en_html)
        self.assertIn('data-locale-link="ms"', en_html)
        self.assertIn('hreflang="zh-Hans"', en_html)
        self.assertIn('hreflang="ms"', en_html)
        for code in ("zh-Hans", "ms"):
            doc = activated[f"demos/corporate/gjh/v1/{code}/index.html"]
            self.assertNotIn('<meta name="robots" content="noindex">', doc)
            self.assertNotIn('class="draft-notice"', doc)
            self.assertIn('hreflang="en"', doc)
            self.assertIn('hreflang="x-default"', doc)

    def test_catalog_validation_rejects_missing_extra_and_placeholder_errors(self):
        zh_path = self.root / "demos/corporate/gjh/v1/locales/zh-Hans.json"
        original = json.loads(zh_path.read_text(encoding="utf-8"))

        broken = json.loads(json.dumps(original))
        del broken["hero"]["cta"]
        zh_path.write_text(json.dumps(broken, ensure_ascii=False), encoding="utf-8")
        with self.assertRaisesRegex(ValueError, "Missing v1 locale keys"):
            v1.load_v1_catalogs(self.root)

        broken = json.loads(json.dumps(original))
        broken["hero"]["unusedKey"] = "extra"
        zh_path.write_text(json.dumps(broken, ensure_ascii=False), encoding="utf-8")
        with self.assertRaisesRegex(ValueError, "Unused/extra v1 locale keys"):
            v1.load_v1_catalogs(self.root)

        broken = json.loads(json.dumps(original))
        broken["pwa"]["availableOffline"] = "可离线浏览"
        zh_path.write_text(json.dumps(broken, ensure_ascii=False), encoding="utf-8")
        with self.assertRaisesRegex(ValueError, "Placeholder mismatch"):
            v1.load_v1_catalogs(self.root)

    def test_v1_service_worker_covers_locale_routes_and_derivatives(self):
        sw_text = (ROOT / "demos/corporate/gjh/v1/sw.js").read_text(encoding="utf-8")
        files = json.loads(re.search(r"const FILES = (\{.*?\});", sw_text, re.S).group(1))
        for expected in (
            "index.html",
            "zh-Hans/index.html",
            "ms/index.html",
            "manifest.webmanifest",
            "style.css",
            "script.js",
            "assets/family-lifestyle.jpg",
            "assets/family-lifestyle-480.webp",
            "assets/family-lifestyle-768.webp",
            "assets/family-lifestyle-1200.webp",
            "assets/family-lifestyle-1920.webp",
            "assets/family-lifestyle-480.jpg",
            "assets/family-lifestyle-768.jpg",
            "assets/family-lifestyle-1200.jpg",
        ):
            self.assertIn(expected, files, f"Missing from v1/sw.js precache: {expected}")
        self.assertIn("url.pathname.endsWith('/')", sw_text)

    def test_v1_derivative_receipts_match_disk_and_original(self):
        assets_dir = ROOT / "demos/corporate/gjh/v1/assets"
        sources = json.loads((assets_dir / "sources.json").read_text(encoding="utf-8"))
        hero_orig = next(item for item in sources["assets"] if item["file"] == "family-lifestyle.jpg")
        actual_orig_sha = hashlib.sha256((assets_dir / "family-lifestyle.jpg").read_bytes()).hexdigest()
        self.assertEqual(actual_orig_sha, hero_orig["sha256"])
        derivatives = sources.get("derivatives", [])
        self.assertEqual(len(derivatives), 7)
        for item in derivatives:
            file_bytes = (assets_dir / item["file"]).read_bytes()
            self.assertEqual(item["sourceSha256"], actual_orig_sha)
            self.assertEqual(len(file_bytes), item["bytes"])
            self.assertEqual(hashlib.sha256(file_bytes).hexdigest(), item["sha256"])


if __name__ == "__main__":
    unittest.main()
