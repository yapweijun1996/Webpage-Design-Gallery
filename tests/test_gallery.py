"""Contract tests for metadata, safe paths and deterministic gallery generation."""

import copy
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


class GalleryTests(unittest.TestCase):
    def test_real_company_contains_all_versions(self):
        catalog = gallery.load_catalog()
        versions = [d["version"] for d in catalog["designs"]]
        self.assertEqual(versions, ["v1", "v5", "v6", "v7", "v8", "v9", "v10", "v11"])
        self.assertEqual({d["companyId"] for d in catalog["designs"]}, {"gjh"})

    def test_v8_metadata_exposes_immersive_concept_contract(self):
        catalog = gallery.load_catalog()
        design = next(item for item in catalog["designs"] if item["version"] == "v8")
        self.assertEqual(design["id"], "gjh-v8")
        self.assertEqual(design["companyId"], "gjh")
        self.assertIn("heritage", design["styles"])
        self.assertIn("editorial", design["styles"])
        self.assertEqual(design["devices"], ["desktop", "tablet", "mobile"])
        self.assertTrue(design["demoPath"].endswith("demos/corporate/gjh/v8/index.html"))

    def test_home_only_links_to_company_collections(self):
        page = gallery.build_pages(gallery.load_catalog())["index.html"]
        self.assertIn('href="companies/gjh/index.html"', page)
        self.assertNotIn('class="design-card"', page)
        self.assertNotIn('href="demos/', page)

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

    def test_published_shared_resources_and_precache_boundary(self):
        catalog = gallery.load_catalog()
        with tempfile.TemporaryDirectory() as directory:
            output = Path(directory)
            gallery.build(output)
            for name in ("assets/tokens.css", "assets/icons.svg",
                         "demos/corporate/gjh/shared/interaction.css",
                         "demos/corporate/gjh/shared/navigation.js"):
                self.assertEqual((output / name).read_bytes(), (ROOT / name).read_bytes())
            self.assertFalse((output / "design-system/tokens.json").exists())
            self.assertFalse((output / "demos/corporate/gjh/research").exists())
            worker = (output / "sw.js").read_text()
            entries = json.loads(re.search(r"const PRECACHE = (\[.*?\]);", worker, re.S).group(1))
            cached = {entry["path"] for entry in entries}
            self.assertIn("assets/tokens.css", cached)
            self.assertIn("assets/icons.svg", cached)
            self.assertNotIn("demos/corporate/gjh/shared/navigation.js", cached)
            self.assertNotIn("demos/corporate/gjh/v11/vendor/rapier.mjs", cached)
            self.assertTrue(all(design["thumbnail"] in cached for design in catalog["designs"]))

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
