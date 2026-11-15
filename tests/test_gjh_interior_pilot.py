"""Eight scoped assets, real geometry, identity and publication boundaries."""
import hashlib
import json
import unittest
from pathlib import Path
from test_gjh_furnishings import read_glb, scene_metrics

ROOT=Path(__file__).resolve().parents[1]
ASSETS=ROOT/'demos/corporate/gjh/v11/assets'
IDS={'GJH-PUB-002','GJH-PUB-008','GJH-PUB-017','GJH-DSP-001','GJH-STF-008','GJH-LGT-009','GJH-PUB-005','GJH-VER-017'}

class InteriorPilotTests(unittest.TestCase):
    def test_eight_native_scale_exports_match_their_editable_sources_and_receipts(self):
        records=json.loads((ASSETS/'interior-pilot.json').read_text())['assets']
        self.assertEqual({r['asset_id'] for r in records},IDS)
        self.assertEqual(len(records),8)
        total=0
        for record in records:
            with self.subTest(asset=record['asset_id']):
                file=ASSETS/record['file'];total+=file.stat().st_size
                self.assertEqual(hashlib.sha256(file.read_bytes()).hexdigest(),record['sha256'])
                self.assertTrue((ROOT/record['editable_source']).is_file())
                data,binary=read_glb(file)
                self.assertFalse(data.get('images') or data.get('animations') or data.get('skins') or data.get('extensionsRequired'))
                root=next(n for n in data['nodes'] if n['name']==record['asset_id'])
                self.assertEqual(root['extras']['asset_id'],record['asset_id'])
                self.assertEqual(root.get('scale',[1,1,1]),[1,1,1])
                bounds,triangles=scene_metrics(data,binary)
                for actual,expected in zip(bounds,record['dimensions_m']):self.assertAlmostEqual(actual,expected,places=4)
                ceiling=2000 if record['kind']=='wallLight' else 8000 if record['kind']=='storeSign' else 12000 if record['kind']=='plinth' else 6000
                self.assertLessEqual(triangles,ceiling)
                self.assertLessEqual(sum(len(m['primitives']) for m in data['meshes']),16)
        self.assertLessEqual(total,1200*1024)

    def test_passive_props_do_not_gain_fabricated_interactions(self):
        rows={r['kind']:r for r in json.loads((ASSETS/'interior-pilot.json').read_text())['assets']}
        for kind in ['coffeeTable','planter','wallLight','storeSign','plinth']:self.assertEqual(rows[kind]['capabilities'],[])
        self.assertEqual(rows['bench']['capabilities'],['SIT'])
        self.assertEqual(rows['kiosk']['capabilities'],['USE'])
        self.assertEqual(rows['shelf']['capabilities'],['INSPECT'])
        # Product scope remains exactly the already supported four products.
        source=(ASSETS/'products.js').read_text()
        self.assertEqual(source.count("{sku: '"),4)

if __name__=='__main__':unittest.main()
