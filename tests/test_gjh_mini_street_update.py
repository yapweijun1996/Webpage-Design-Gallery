"""Publication contracts for the Mini Street page and its release record."""
import base64
import hashlib
import importlib.util
import json
from pathlib import Path
import re
import unittest


ROOT = Path(__file__).resolve().parents[1]
SPEC = importlib.util.spec_from_file_location("build_gallery", ROOT / "scripts/build_gallery.py")
gallery = importlib.util.module_from_spec(SPEC)
SPEC.loader.exec_module(gallery)


class MiniStreetReleaseTest(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.catalog = gallery.load_catalog()
        cls.page, manifest = gallery.build_mini_street(cls.catalog, "1.4.0")
        cls.release = json.loads(manifest)

    def test_release_identity_is_deterministic_and_includes_the_version(self):
        self.assertEqual(gallery.build_mini_street(self.catalog, "1.4.0")[0], self.page)
        next_page, next_manifest = gallery.build_mini_street(self.catalog, "1.4.1")
        next_release = json.loads(next_manifest)
        self.assertNotEqual(self.release["build"], next_release["build"])
        self.assertIn('name="mini-street-version" content="1.4.1"', next_page)
        self.assertIn(f'name="mini-street-build" content="{next_release["build"]}"', next_page)

    def test_page_assets_are_pinned_to_the_exported_bytes(self):
        build = self.release["build"]
        self.assertRegex(build, "^[0-9a-f]{16}$")
        self.assertIn(f'name="mini-street-build" content="{build}"', self.page)
        import_map = json.loads(re.search(r'<script type="importmap">(.*?)</script>', self.page)[1])
        self.assertIn("./assets/update.js", import_map["imports"])
        self.assertIn("../v11/vendor/GLTFLoader.js", import_map["imports"])
        entry_assets = dict(re.findall(r'(?:href|src)="([^"]+)" integrity="([^"]+)"', self.page))
        self.assertIn(f"./script.js?build={build}", entry_assets)
        self.assertIn(f"./style.css?build={build}", entry_assets)
        published = set(gallery.runtime_resources(self.catalog))
        for url, integrity in (entry_assets | import_map["integrity"]).items():
            with self.subTest(url=url):
                self.assertTrue(url.endswith(f"?build={build}"))
                path = (ROOT / gallery.MINI_STREET / url.split("?")[0]).resolve()
                self.assertIn(path.relative_to(ROOT), published)
                digest = hashlib.sha256(gallery.source_bytes(path)).digest()
                self.assertEqual(integrity, "sha256-" + base64.b64encode(digest).decode("ascii"))

    def test_publication_leaves_the_authored_development_page_unstamped(self):
        source = (ROOT / gallery.MINI_STREET / "index.html").read_text(encoding="utf-8")
        self.assertNotIn('name="mini-street-build"', source)


if __name__ == "__main__":
    unittest.main()
