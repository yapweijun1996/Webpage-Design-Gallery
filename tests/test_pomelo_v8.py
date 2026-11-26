"""Static contracts for Pomelo STEM V8: fresh outputs, i18n parity, version SSOT and SemVer."""
import importlib.util
import json
import re
import unittest
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


if __name__ == "__main__":
    unittest.main()
