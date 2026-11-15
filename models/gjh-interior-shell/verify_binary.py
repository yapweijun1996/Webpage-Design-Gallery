"""Independent exported GLB triangle winding, normals, identity and material audit."""
from pathlib import Path
import json,struct,math,hashlib
HERE=Path(__file__).resolve().parent;ROOT=HERE.parents[1];OUT=HERE/'reports';ASSETS=ROOT/'demos/corporate/gjh/v11/assets'
manifest=json.loads((ASSETS/'interior-shell.json').read_text());layout=json.loads((ROOT/'models/gjh-interior-shell/layout.json').read_text());rows=[]
def linear(v):return v/12.92 if v<=.04045 else ((v+.055)/1.055)**2.4
for record in manifest['assets']:
 data=(ASSETS/record['file']).read_bytes();assert hashlib.sha256(data).hexdigest()==record['sha256'] and len(data)==record['bytes'];magic,version,length=struct.unpack_from('<III',data);assert magic==0x46546c67 and version==2 and length==len(data)
 n,kind=struct.unpack_from('<II',data,12);assert kind==0x4e4f534a;doc=json.loads(data[20:20+n]);bn,bkind=struct.unpack_from('<II',data,20+n);assert bkind==0x004e4942;binary=data[28+n:28+n+bn]
 assert len(doc['buffers'])==1 and not doc['buffers'][0].get('uri')
 assert not any(doc.get(k) for k in ['images','textures','animations','skins','extensionsRequired'])
 roots=[v for v in doc['nodes'] if v.get('extras',{}).get('asset_id')==record['asset_id']];assert len(roots)==1 and roots[0]['name']==record['asset_id']
 assert not any('COLLISION' in v.get('name','').upper() or v.get('name','').startswith('SOCKET_') for v in doc['nodes'])
 def accessor(index):
  a=doc['accessors'][index];v=doc['bufferViews'][a['bufferView']];fmt={5121:'B',5123:'H',5125:'I',5126:'f'}[a['componentType']];size={'SCALAR':1,'VEC2':2,'VEC3':3,'VEC4':4}[a['type']];width=struct.calcsize('<'+fmt*size);start=v.get('byteOffset',0)+a.get('byteOffset',0);stride=v.get('byteStride',width)
  return [struct.unpack_from('<'+fmt*size,binary,start+i*stride) for i in range(a['count'])]
 total=0;min_dot=1
 for mesh in doc['meshes']:
  for primitive in mesh['primitives']:
   assert primitive.get('mode',4)==4
   pos=accessor(primitive['attributes']['POSITION']);norm=accessor(primitive['attributes']['NORMAL']);indices=[v[0] for v in accessor(primitive['indices'])];assert len(indices)%3==0 and len(pos)==len(norm)
   assert all(math.isfinite(v) for item in pos+norm for v in item)
   assert all(abs(sum(v*v for v in normal)-1)<.005 for normal in norm)
   for i in range(0,len(indices),3):
    ids=indices[i:i+3];a,b,c=[pos[j] for j in ids];u=[b[j]-a[j] for j in range(3)];v=[c[j]-a[j] for j in range(3)];cross=[u[1]*v[2]-u[2]*v[1],u[2]*v[0]-u[0]*v[2],u[0]*v[1]-u[1]*v[0]];area2=math.sqrt(sum(x*x for x in cross));assert area2>1e-10
    average=[sum(norm[k][j] for k in ids)/3 for j in range(3)];dot=sum(cross[j]*average[j] for j in range(3))/area2;assert dot>0,(record['asset_id'],'normal-winding',dot);min_dot=min(min_dot,dot);total+=1
 for material in doc['materials']:
  spec=layout['palette'][material['name']];pbr=material['pbrMetallicRoughness'];expected=[linear((spec['color']>>shift&255)/255) for shift in (16,8,0)]+[1]
  assert all(abs(a-b)<1e-6 for a,b in zip(pbr['baseColorFactor'],expected));assert abs(pbr['roughnessFactor']-spec['roughness'])<1e-6 and abs(pbr['metallicFactor']-spec['metalness'])<1e-6
 assert total<=700
 rows.append({'asset_id':record['asset_id'],'sha256':record['sha256'],'trianglesInspected':total,'finiteUnitNormals':'PASS','windingAgreesWithNormals':'PASS','minNormalWindingCosine':min_dot,'linearSourcePaletteAndPBR':'PASS','noCollisionSocketsInVisualExport':'PASS'})
 print('BINARY AUDIT PASS',record['asset_id'],total,flush=True)
(OUT/'binary-audit.json').write_text(json.dumps(rows,indent=2)+'\n')
