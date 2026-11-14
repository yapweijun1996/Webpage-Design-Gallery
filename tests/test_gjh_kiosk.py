"""Pinned original kiosk bounds, materials and provenance, without external dependencies."""
import unittest,json,hashlib
from test_gjh_furnishings import ASSETS,read_glb,scene_metrics
class KioskTests(unittest.TestCase):
 def test_original_source_and_scale(self):
  receipt=json.loads((ASSETS/'kiosk-source.json').read_text());path=ASSETS/'mall-directory-kiosk.glb'
  self.assertEqual(hashlib.sha256(path.read_bytes()).hexdigest(),receipt['sha256']);self.assertRegex(receipt['source_commit'],r'^[0-9a-f]{40}$')
  doc,binary=read_glb(path);dimensions,triangles=scene_metrics(doc,binary)
  self.assertEqual(triangles,5360);self.assertEqual(path.stat().st_size,178068);self.assertEqual(len(doc['materials']),6)
  self.assertFalse(doc.get('images'));self.assertFalse(doc.get('animations'));self.assertFalse(doc.get('extensionsRequired'));self.assertNotIn('uri',doc['buffers'][0])
  for a,b in zip(dimensions,[.96,2.05,.68]):self.assertAlmostEqual(a,b,delta=.001)
  self.assertEqual(receipt['placement']['scale'],1)
if __name__=='__main__':unittest.main()
