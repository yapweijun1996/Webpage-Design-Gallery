import hashlib
import unittest
from pathlib import Path
ROOT=Path(__file__).resolve().parents[1]
DEMO=ROOT/'demos/corporate/gjh/v11'
class OriginalTinTests(unittest.TestCase):
 def test_real_original_asset_hash(self):
  self.assertEqual(hashlib.sha256((DEMO/'assets/original-demo-food-tin.glb').read_bytes()).hexdigest(),'4b265f78a711d95a80b730ebeaae3906f42c93fbd28f0b8c6e64c8c003eee0ee')
 def test_no_brand_substitution(self):
  html=(DEMO/'index.html').read_text()
  self.assertIn('not New Moon packaging',html)
  for marker in ['id="product-dialog"','id="product-shop"','https://www.gjheshop.com/','new-moon-nz-425g-front.jpg']:
   self.assertIn(marker,html)
 def test_runtime_integrity_and_lifecycle_contract(self):
  js=(DEMO/'assets/original-tin.js').read_text()
  for marker in ['MODEL_SHA256','LOAD_DEADLINE_MS','AbortController','forceContextLoss','disposeModel','OpenClose','Exploded']:
   self.assertIn(marker,js)
if __name__=='__main__':unittest.main()
