"""Focused local contract checks for the bounded New Moon Phase 1/2 integration."""

import hashlib
import json
import re
import unittest
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
ASSETS = ROOT / "demos/corporate/gjh/v11/assets"


class NewMoonIntegrationTests(unittest.TestCase):
    def test_reviewed_glb_hashes_and_flat_asset_names(self):
        expected = {
            "new-moon-can-nz-425g-lod1.glb": "fcb92b1c62e10338a3295cb56006365da747ad7f25d6b6bec0964d600b742cdb",
            "new-moon-can-au-425g-lod1.glb": "d1ae9ff1b35a65c6bb4cafb4a70ff3dd746bf3f70c8ffdac3f93546478feacde",
            "new-moon-can-sa-425g-lod1.glb": "7728989f5e4c695c7b4765d219501349898ca1e72f0630bde13c66fc9811e0b5",
            "new-moon-can-mx-454g-lod1.glb": "52f8952ca698cc77c6aaf8f1ef5c607a31c401817e6bf6741426e17510164acb",
            "mall-display-shelf.glb": "9538cc7b954a1510397e4f1dffc47bbed6c99f7460edfb1e55ef4dc28561966d",
        }
        for filename, digest in expected.items():
            with self.subTest(filename=filename):
                self.assertEqual(hashlib.sha256((ASSETS / filename).read_bytes()).hexdigest(), digest)

    def test_source_contract_preserves_native_scale_and_fallbacks(self):
        source = (ASSETS / "products.js").read_text()
        self.assertIn("const shelfTops = Object.freeze([.6825, 1.1925, 1.7025])", source)
        self.assertIn("totalInstances: 36", source)
        self.assertIn("crypto.subtle.digest('SHA-256'", source)
        for token in ("hash-mismatch", "unsupported-external-resource", "invalid-dimensions", "timeout"):
            self.assertIn(token, source)
        self.assertIn("fallbackCan", source)
        self.assertIn("fallbackShelf", source)
        self.assertNotIn("cdn", source.lower())

    def test_world_removes_legacy_rack_and_exposes_frozen_snapshot(self):
        world = (ASSETS / "world.js").read_text()
        script = (ROOT / "demos/corporate/gjh/v11/script.js").read_text()
        self.assertIn("productDisplay = await addProducts", world)
        self.assertNotIn("box('dark', x, 1.55, -9.85", world)
        self.assertIn("productAssets: world?.productAssets || null", script)
        self.assertIn("Object.freeze(worldProductAssets)", world)


if __name__ == "__main__":
    unittest.main()
