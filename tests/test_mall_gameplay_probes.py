"""Pure checks for the gameplay probe inventory, geometry and evidence gates."""
import json
from pathlib import Path
import sys
import unittest

DOCS = Path(__file__).resolve().parents[1] / "docs"
sys.path.insert(0, str(DOCS))
from verify_interactions import PROGRAMME, WAYPOINTS, expected_items, shop_threshold
from verify_mall_support import probe_url
from verify_tram import ORDER, check_lap


class GameplayProbesTest(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.stores = json.loads(PROGRAMME.read_text(encoding="utf-8"))["stores"]

    def test_url_enables_hooks_and_keeps_existing_flags(self):
        actual = probe_url("http://localhost/mall/?npcs=off&test=0#experience", tram="1")
        self.assertEqual(actual, "http://localhost/mall/?npcs=off&test=1&tram=1#experience")

    def test_inventory_and_thresholds_cover_all_three_facades(self):
        items = expected_items(self.stores)
        self.assertEqual(len(items), 65)
        self.assertEqual({slot for slot, _ in items}, {f"S{i:02d}" for i in range(1, 18)})
        self.assertTrue(set(WAYPOINTS) <= {item for _, item in items})
        for index, expected in [(0, (-10, -.9)), (5, (-15.9, 4)), (11, (35.9, 4))]:
            for actual, coordinate in zip(shop_threshold(self.stores[index]), expected):
                self.assertAlmostEqual(actual, coordinate)

    def test_lap_rejects_wrong_caption_order_and_exact_50ms_gap(self):
        concepts = {store["brand"]: store["concept"] for store in self.stores}
        captions = [dict(name=name, feature=concepts[name], distance=index)
                    for index, name in enumerate(ORDER)]
        lap = dict(captions=captions, rafGaps=[16.7] * 200, drawGaps=[16.7] * 200,
                   sawArrival=True, distanceAtTenSeconds=15)
        check_lap(lap, concepts)
        with self.assertRaisesRegex(AssertionError, "Wrong caption sequence"):
            check_lap({**lap, "captions": list(reversed(captions))}, concepts)
        with self.assertRaisesRegex(AssertionError, "drawGaps"):
            check_lap({**lap, "drawGaps": lap["drawGaps"] + [50]}, concepts)


if __name__ == "__main__":
    unittest.main()
