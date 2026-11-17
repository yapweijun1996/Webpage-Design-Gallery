"""Contract tests for metadata, safe paths and deterministic gallery generation."""

import copy
import hashlib
import importlib.util
import json
import re
import tempfile
import unittest
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
SPEC = importlib.util.spec_from_file_location("build_gallery", ROOT / "scripts/build_gallery.py")
gallery = importlib.util.module_from_spec(SPEC)
SPEC.loader.exec_module(gallery)


ZOOMABLE_VIEWPORT = "width=device-width, initial-scale=1, viewport-fit=cover"

class GalleryTests(unittest.TestCase):
    def test_real_companies_contain_their_own_versions(self):
        catalog = gallery.load_catalog()
        versions = [d["version"] for d in catalog["designs"] if d["companyId"] == "gjh"]
        self.assertEqual(versions, ["v1", *(f"v{number}" for number in range(5, 20))])
        self.assertEqual({c["id"] for c in catalog["companies"]}, {"gjh", "yeos", "thow-kwang"})
        for company in catalog["companies"]:
            designs = [d for d in catalog["designs"] if d["companyId"] == company["id"]]
            self.assertGreaterEqual(len({d["demoPath"] for d in designs}), 15)
            self.assertEqual(len({d["title"] for d in designs}), len(designs))

    def test_v8_metadata_exposes_immersive_concept_contract(self):
        catalog = gallery.load_catalog()
        design = next(item for item in catalog["designs"] if item["id"] == "gjh-v8")
        self.assertEqual(design["id"], "gjh-v8")
        self.assertEqual(design["companyId"], "gjh")
        self.assertIn("heritage", design["styles"])
        self.assertIn("editorial", design["styles"])
        self.assertEqual(design["devices"], ["desktop", "tablet", "mobile"])
        self.assertTrue(design["demoPath"].endswith("demos/corporate/gjh/v8/index.html"))

    def test_home_only_links_to_company_collections(self):
        page = gallery.build_pages(gallery.load_catalog())["index.html"]
        self.assertIn('href="companies/gjh/index.html"', page)
        self.assertIn('href="companies/yeos/index.html"', page)
        self.assertNotIn('class="design-card"', page)
        self.assertNotIn('href="demos/', page)

    def test_directory_order_matches_inventory_and_company_route_title(self):
        catalog = gallery.load_catalog()
        pages = gallery.build_pages(catalog)
        self.assertIn("All companies.", pages["companies/index.html"])
        page = pages["index.html"]
        self.assertIn("All companies.", page)
        self.assertLess(page.index('id="company-search"'), page.index('class="company-grid"'))
        self.assertLess(page.index('class="company-cover"'), page.index('class="company-card-copy"'))
        self.assertEqual(page.count('id="company-search"'), 1)

        catalog["companies"] = [c for c in catalog["companies"] if c["id"] == "gjh"]
        catalog["designs"] = [d for d in catalog["designs"] if d["companyId"] == "gjh"]
        page = gallery.build_pages(catalog)["index.html"]
        self.assertIn("One company.", page)
        self.assertLess(page.index('class="company-grid"'), page.index('id="company-search"'))
        self.assertEqual(page.count('id="company-search"'), 1)

    def test_single_design_collection_links_to_demo_without_comparison_controls(self):
        catalog = gallery.load_catalog()
        catalog["designs"] = [d for d in catalog["designs"] if d["companyId"] != "yeos" or d["version"] == "v1"]
        pages = gallery.build_pages(catalog)
        page = pages["companies/yeos/index.html"]
        self.assertIn('href="../../demos/food-beverage/yeos/v1/index.html"', page)
        self.assertIn('company=yeos&amp;design=v1', page)
        self.assertNotIn('id="style-filter"', page)
        self.assertNotIn('class="compare-checkbox"', page)
        self.assertNotIn('class="compare-tray"', page)
        self.assertIn('class="compare-checkbox"', pages["companies/gjh/index.html"])

    def test_generation_is_deterministic(self):
        catalog = gallery.load_catalog()
        self.assertEqual(gallery.build_pages(catalog), gallery.build_pages(copy.deepcopy(catalog)))

    def test_paths_cannot_escape_repository(self):
        with tempfile.TemporaryDirectory() as directory:
            root = Path(directory)
            for value in ("../secret", "/absolute", "https://example.com/a", "a\\b"):
                with self.subTest(value=value), self.assertRaises(ValueError):
                    gallery.local_path(root, value)

    def test_missing_assets_stop_build(self):
        with tempfile.TemporaryDirectory() as directory:
            with self.assertRaisesRegex(ValueError, "Missing resource"):
                gallery.local_path(Path(directory), "missing.webp")

    def test_duplicate_stable_ids_are_rejected(self):
        with self.assertRaisesRegex(ValueError, "Duplicate"):
            gallery.unique([{"id": "same"}, {"id": "same"}], "company")

    def test_metadata_text_is_escaped(self):
        catalog = copy.deepcopy(gallery.load_catalog())
        catalog["companies"][0]["name"] = '<script>alert("test")</script>'
        page = gallery.build_pages(catalog)["index.html"]
        self.assertNotIn('<script>alert("test")</script>', page)
        self.assertIn("&lt;script&gt;", page)

    def test_pages_allow_zoom_and_maskable_icon_is_separate(self):
        pages = gallery.build_pages(gallery.load_catalog())
        pages["v11-source.html"] = (ROOT / "demos/corporate/gjh/v11/index.html").read_text(encoding="utf-8")
        for name, page in pages.items():
            if name.endswith(".html"):
                viewport = re.search(r'<meta name="viewport" content="([^"]+)">', page)
                self.assertIsNotNone(viewport, name)
                content = viewport.group(1).lower()
                self.assertEqual(content, ZOOMABLE_VIEWPORT, name)
                self.assertNotIn("user-scalable=no", content, name)
                self.assertNotIn("maximum-scale", content, name)

        manifest = json.loads((ROOT / "manifest.webmanifest").read_text(encoding="utf-8"))
        icons = manifest["icons"]
        self.assertIn({"src": "assets/icons/gallery-maskable-512.png", "sizes": "512x512",
                       "type": "image/png", "purpose": "maskable"}, icons)
        self.assertFalse(any("any maskable" in icon["purpose"] for icon in icons))
        self.assertEqual(sum(icon["purpose"] == "maskable" for icon in icons), 1)

    def test_published_shared_resources_and_precache_boundary(self):
        catalog = gallery.load_catalog()
        with tempfile.TemporaryDirectory() as directory:
            output = Path(directory)
            gallery.build(output)
            gallery_models = Path("demos/corporate/gjh/v11/assets/gallery-assets")
            for source in (gallery.ROOT / gallery_models).glob("*.glb"):
                self.assertEqual((output / gallery_models / source.name).read_bytes(), source.read_bytes())
            for name in ("assets/tokens.css", "assets/icons.svg", "assets/icons/gallery-maskable-512.png",
                         "assets/onboarding/action-dialog.js", "assets/onboarding/onboarding.css",
                         "design-system/onboarding/index.html",
                         "demos/corporate/gjh/shared/interaction.css",
                         "demos/corporate/gjh/shared/navigation.js",
                         "demos/corporate/gjh/v11/style.bundle.css",
                         "demos/corporate/gjh/v11/script.bundle.js",
                         "demos/corporate/gjh/v11/assets/world.bundle.js",
                         "demos/corporate/gjh/v11/assets/player.bundle.js",
                         "demos/corporate/gjh/v11/assets/character-v2.bundle.js",
                         "demos/corporate/gjh/v11/assets/startup-asset-pack.js",
                         "demos/corporate/gjh/v11/assets/startup-assets.pack",
                         "demos/corporate/gjh/v11/vendor/rapier_bg.wasm"):
                self.assertEqual((output / name).read_bytes(), (ROOT / name).read_bytes())
            self.assertFalse((output / "design-system/tokens.json").exists())
            self.assertFalse((output / "demos/corporate/gjh/research").exists())
            worker = (output / "sw.js").read_text()
            entries = json.loads(re.search(r"const PRECACHE = (\[.*?\]);", worker, re.S).group(1))
            cached = {entry["path"] for entry in entries}
            self.assertIn("assets/tokens.css", cached)
            self.assertIn("assets/icons/gallery-maskable-512.png", cached)
            self.assertNotIn("assets/onboarding/action-dialog.js", cached)
            self.assertNotIn("design-system/onboarding/index.html", cached)
            self.assertNotIn("demos/corporate/gjh/shared/navigation.js", cached)
            self.assertNotIn("demos/corporate/gjh/v11/vendor/rapier.mjs", cached)
            self.assertTrue(all(design["thumbnail"] in cached for design in catalog["designs"]))
            mall = output / "demos/corporate/gjh/v11"
            mall_worker = (mall / "pwa-sw.js").read_text()
            mall_entries = json.loads(re.search(r"const PRECACHE = (\[.*?\]);", mall_worker, re.S).group(1))
            self.assertEqual({entry["path"] for entry in mall_entries}, {
                "offline.html", "manifest.webmanifest", "assets/mall-icon-192.png", "assets/mall-icon-512.png",
                "style.bundle.css", "assets/loader.js", "assets/gjh-loader-mark.svg"})
            self.assertLessEqual(sum((mall / entry["path"]).stat().st_size for entry in mall_entries), 256 * 1024)
            for entry in mall_entries:
                self.assertEqual(hashlib.sha256((mall / entry["path"]).read_bytes()).hexdigest(), entry["sha256"])
            self.assertTrue((mall / "pwa.js").is_file())


    def test_nested_pages_use_prefix_safe_sprite_and_company_identity(self):
        pages = gallery.build_pages(gallery.load_catalog())
        self.assertIn('href="../assets/icons.svg#arrow-down"', pages["companies/index.html"])
        company = pages["companies/gjh/index.html"]
        self.assertIn('data-company="gjh"', company)
        self.assertIn('href="../../assets/icons.svg#arrow-right"', company)
        self.assertNotIn("<path ", company)
        with self.assertRaisesRegex(ValueError, "Unknown Gallery icon"):
            gallery.icon("unapproved")


if __name__ == "__main__":
    unittest.main()
