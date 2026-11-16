"""Contracts for the four-ID native shell and its single canonical placement data."""
import copy,hashlib,json,struct,unittest
from pathlib import Path
ROOT=Path(__file__).resolve().parents[1];HERE=ROOT/'models/gjh-interior-shell';ASSETS=ROOT/'demos/corporate/gjh/v11/assets'
class ShellContract(unittest.TestCase):
 @classmethod
 def setUpClass(cls):
  cls.layout=json.loads((HERE/'layout.json').read_text());cls.manifest=json.loads((ASSETS/'interior-shell.json').read_text());js=(ASSETS/'interior-shell-registry.js').read_text();cls.generated=json.loads(js.split('export const SHELL_LAYOUT=freeze(',1)[1].split(');\nexport const INTERIOR_SHELL',1)[0]);cls.registry=json.loads(js.split('export const INTERIOR_SHELL=freeze(',1)[1].split(');\n',1)[0])
 def test_inventory_and_approved_targets(self):
  p=ROOT/'docs/references/gjh-interior-200-assets-v1.md';self.assertEqual(hashlib.sha256(p.read_bytes()).hexdigest(),self.layout['inventory_sha256'])
  self.assertEqual({r['asset_id'] for r in self.manifest['assets']},{'GJH-ARC-001','GJH-COR-001','GJH-CEI-001','GJH-STF-002'})
  targets={'wall':[4,.3,6.6],'corridor':[4,4,.2],'ceiling':[4,4,.3],'frontage':[9.8,.59,5.475]}
  for r in self.manifest['assets']:
   self.assertEqual(r['priority'],'P0');self.assertEqual(r['target_dimensions_wdh_m'],targets[r['kind']]);self.assertEqual(r['capabilities'],[])
 def test_generated_data_has_one_source(self):
  expected=copy.deepcopy(self.layout)
  for i,p in enumerate(expected['aggregate_colliders']):
   if 'asset' not in p:continue
   a=expected['assets'][p['asset']];c=next(c for c in a['components'] if c['name']==p['component']);v=a['placements'][p['placement_index']];self.assertEqual(v[3],0)
   expected['aggregate_colliders'][i]={'name':p['name'],'position':[a+b for a,b in zip(v[:3],c['position'])],'size':c['size']}
  self.assertEqual(self.generated,expected)
  self.assertEqual(self.registry,{r['kind']:r for r in self.manifest['assets']})
 def test_native_binary_identity_geometry_and_budgets(self):
  total=0
  for r in self.manifest['assets']:
   with self.subTest(asset=r['asset_id']):
    p=ASSETS/r['file'];b=p.read_bytes();total+=len(b);self.assertEqual(hashlib.sha256(b).hexdigest(),r['sha256']);self.assertEqual(r['bytes'],len(b));self.assertEqual(struct.unpack_from('<III',b),(0x46546c67,2,len(b)))
    n=struct.unpack_from('<I',b,12)[0];j=json.loads(b[20:20+n]);self.assertFalse(j.get('images'));self.assertFalse(j.get('animations'));self.assertFalse(j.get('skins'));self.assertFalse(j.get('extensionsRequired'));self.assertFalse(any(x.get('uri') for x in j['buffers']))
    root=next(x for x in j['nodes'] if x['name']==r['asset_id']);self.assertEqual(root['extras']['asset_id'],r['asset_id']);self.assertFalse(any(k in root for k in ('matrix','translation','rotation','scale')))
    ps=[p for m in j['meshes'] for p in m['primitives']];self.assertLessEqual(len(ps),3);self.assertLessEqual(sum(j['accessors'][p['indices']]['count']//3 for p in ps),700)
    mins=[j['accessors'][p['attributes']['POSITION']]['min'] for p in ps];maxs=[j['accessors'][p['attributes']['POSITION']]['max'] for p in ps]
    for i in range(3):self.assertAlmostEqual(min(v[i] for v in mins),r['bounds_min'][i],places=5);self.assertAlmostEqual(max(v[i] for v in maxs),r['bounds_max'][i],places=5)
  self.assertLessEqual(total,102400)
 def test_editable_source_and_builder_pins(self):
  for r in self.manifest['assets']:
   self.assertEqual(r['file'],r['asset_id'].replace('-','_')+'.glb');self.assertEqual(Path(r['editable_source']).name,r['asset_id'].replace('-','_')+'.blend')
   for path,key in ((ROOT/r['editable_source'],'editable_source_sha256'),(HERE/'layout.json','layout_sha256'),(HERE/'build.py','build_sha256')):self.assertEqual(hashlib.sha256(path.read_bytes()).hexdigest(),r[key])
 def test_aperture_proxy_and_inherited_floor_offset(self):
  a=self.layout['assets']['frontage'];self.assertNotIn('min',a['collision_proxy']);self.assertEqual(len(a['collision_proxy']['local_records']),3)
  components={c['name']:c for c in a['components']};left=components['Stone pier left'];right=components['Stone pier right'];lintel=components['Dark lintel'];self.assertAlmostEqual(left['position'][0]+left['size'][0]/2,-2.35);self.assertAlmostEqual(right['position'][0]-right['size'][0]/2,2.35);self.assertAlmostEqual(lintel['position'][1]-lintel['size'][1]/2,3.925)
  self.assertEqual(a['bounds_min'],[-4.9,0,-.25]);self.assertEqual(a['bounds_max'],[4.9,5.475,.34]);self.assertEqual(len(self.generated['aggregate_colliders']),13)
  f=self.layout['assets']['corridor'];self.assertAlmostEqual(f['bounds_max'][1]-f['collision_proxy']['max'][1],.035);self.assertAlmostEqual(f['collision_proxy']['max'][1]+f['placements'][0][1],-.02)
 def test_instance_counts_and_no_duplicate_floor_tiles(self):
  self.assertEqual({k:len(v['placements']) for k,v in self.layout['assets'].items()},{'wall':21,'corridor':28,'ceiling':8,'frontage':3});self.assertEqual(len(self.layout['retained_tiles']),23)
  covered={(x+dx,z+dz) for x,_,z,_ in self.layout['assets']['corridor']['placements'] for dx in [-1,1] for dz in [-1,1]};retained={(x,z) for x,_,z in self.layout['retained_tiles']};self.assertFalse(covered&retained);self.assertEqual(len(covered|retained),135)
if __name__=='__main__':unittest.main()
