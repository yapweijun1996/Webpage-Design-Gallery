"""Author four original native-scale shell assets; run only in background Blender."""
import hashlib,json
from pathlib import Path
import bpy
from mathutils import Vector
HERE=Path(__file__).resolve().parent
ROOT=HERE.parents[1]
RUNTIME=ROOT/'demos/corporate/gjh/v11/assets'
LAYOUT=json.loads((HERE/'layout.json').read_text())
# Resolve physics references from the same native components that generate visual geometry.
for index, proxy in enumerate(LAYOUT['aggregate_colliders']):
 if 'asset' not in proxy:continue
 asset=LAYOUT['assets'][proxy['asset']];component=next(c for c in asset['components'] if c['name']==proxy['component']);placement=asset['placements'][proxy['placement_index']]
 assert placement[3]==0, 'Rotated collider references require explicit cuboid rotation support'
 LAYOUT['aggregate_colliders'][index]={'name':proxy['name'],'position':[a+b for a,b in zip(placement[:3],component['position'])],'size':component['size']}
def sha(path):return hashlib.sha256(path.read_bytes()).hexdigest()
def vector(p):return (p[0],-p[2],p[1])
def material(name,spec):
 m=bpy.data.materials.new(name);m.use_nodes=True;n=m.node_tree.nodes['Principled BSDF'];rgb=[(spec['color']>>shift&255)/255 for shift in (16,8,0)]
 n.inputs['Base Color'].default_value=tuple(v/12.92 if v<=.04045 else ((v+.055)/1.055)**2.4 for v in rgb)+(1,)
 n.inputs['Roughness'].default_value=spec['roughness'];n.inputs['Metallic'].default_value=spec['metalness'];return m
def box(spec,mat,collection):
 bpy.ops.mesh.primitive_cube_add(size=1,location=vector(spec['position']));o=bpy.context.object;o.name=spec['name'];s=spec['size'];o.dimensions=(s[0],s[2],s[1]);bpy.ops.object.transform_apply(location=False,rotation=False,scale=True)
 for c in list(o.users_collection):c.objects.unlink(o)
 collection.objects.link(o)
 if mat:o.data.materials.append(mat)
 if spec.get('bevel_m'):
  b=o.modifiers.new('Small manufactured bevel','BEVEL');b.width=spec['bevel_m'];b.segments=1;o.modifiers.new('Weighted normals','WEIGHTED_NORMAL')
 return o
records=[]
for folder in ('sources','reports','previews'):(HERE/folder).mkdir(exist_ok=True)
for kind,spec in LAYOUT['assets'].items():
 bpy.ops.wm.read_factory_settings(use_empty=True);scene=bpy.context.scene;scene.unit_settings.system='METRIC';scene.unit_settings.scale_length=1
 cols={}
 for name in ('VISUAL','COLLISION','SOCKETS','LOD0','LOD1','LOD2'):
  cols[name]=bpy.data.collections.new(name);scene.collection.children.link(cols[name])
 root=bpy.data.objects.new(spec['asset_id'],None);scene.collection.objects.link(root);root['asset_id']=spec['asset_id'];root['version']='1.0.0';root['units']='metres';root['origin']='Architectural bottom/opening-centre snap, front Blender -Y / glTF +Z'
 palette={n:material(n,p) for n,p in LAYOUT['palette'].items()};visual=[]
 for component in spec['components']:
  o=box(component,palette[component['material']],cols['VISUAL']);o.parent=root;visual.append(o)
 proxy=spec['collision_proxy']
 if 'min' in proxy:
  low,high=proxy['min'],proxy['max'];p=box({'name':'Authoring proxy only; runtime aggregate owns collision','position':[(a+b)/2 for a,b in zip(low,high)],'size':[b-a for a,b in zip(low,high)]},None,cols['COLLISION']);p.display_type='WIRE';p.hide_render=True;p['runtime_owner']=proxy['owner']
 for local in proxy.get('local_records', []):
  component=next(c for c in spec['components'] if c['name']==local['component']);p=box({**component,'bevel_m':0},None,cols['COLLISION']);p.display_type='WIRE';p.hide_render=True;p['runtime_owner']=proxy['owner']
 for name,pos in spec['sockets'].items():
  o=bpy.data.objects.new('SOCKET_'+name,None);cols['SOCKETS'].objects.link(o);o.location=vector(pos);o.empty_display_size=.12;o['snap_role']=name
 stem=spec['asset_id'].replace('-', '_');source=HERE/'sources'/f'{stem}.blend';bpy.ops.wm.save_as_mainfile(filepath=str(source),compress=True)
 # Evaluate each manufactured component independently; collision/socket collections are never exported.
 bpy.ops.object.select_all(action='DESELECT');copies=[];deps=bpy.context.evaluated_depsgraph_get()
 for obj in visual:
  mesh=bpy.data.meshes.new_from_object(obj.evaluated_get(deps));clone=bpy.data.objects.new(obj.name+' export',mesh);scene.collection.objects.link(clone);clone.matrix_world=obj.matrix_world;clone.select_set(True);copies.append(clone)
 bpy.context.view_layer.objects.active=copies[0];bpy.ops.object.join();joined=bpy.context.object;joined.name=spec['asset_id']+'_visual';joined.parent=root
 scene.cursor.location=(0,0,0);bpy.ops.object.origin_set(type='ORIGIN_CURSOR');root.select_set(True)
 target=RUNTIME/f'{stem}.glb';bpy.ops.export_scene.gltf(filepath=str(target),export_format='GLB',use_selection=True,export_apply=True,export_yup=True,export_animations=False,export_texcoords=False,export_extras=True,export_cameras=False,export_lights=False)
 w,d,h=spec['target_dimensions_wdh_m'];record={**{k:spec[k] for k in ('asset_id','priority','source_dimensions_wdh_m','target_dimensions_wdh_m','bounds_min','bounds_max','collision_proxy','sockets','capabilities')},'kind':kind,'version':'1.0.0','file':target.name,'sha256':sha(target),'bytes':target.stat().st_size,'dimensions_m':[w,h,d],'editable_source':str(source.relative_to(ROOT)),'editable_source_sha256':sha(source),'layout_sha256':sha(HERE/'layout.json'),'build_sha256':sha(Path(__file__)),'rights':'Original project geometry and texture-free materials; no third-party artwork.','lod_policy':'Simple architectural instance-only exception; <=700 native triangles. No distance LOD or D5 acceptance.','uv_policy':'No textures or baking; UV0/UV1 not required.','collision_owner':'Existing V11 aggregate Rapier definitions; authoring proxy is not an extra live collider.'};records.append(record)
manifest={'schema_version':1,'scope':'Four P0 shell IDs only; not all79P0 or complete M1. Existing three stores retained.','assets':records}
(RUNTIME/'interior-shell.json').write_text(json.dumps(manifest,indent=2)+'\n')
# Generated values are recursively frozen; layout.json is the sole editable geometry/physics placement definition.
js='// Generated by models/gjh-interior-shell/build.py; edit its canonical layout.json.\nconst freeze=value=>{if(value&&typeof value==="object"){Object.values(value).forEach(freeze);Object.freeze(value);}return value;};\n'
js+='export const SHELL_LAYOUT=freeze('+json.dumps(LAYOUT,separators=(',',':'))+');\n'
js+='export const INTERIOR_SHELL=freeze('+json.dumps({r['kind']:r for r in records},separators=(',',':'))+');\n'
(RUNTIME/'interior-shell-registry.js').write_text(js)
print('SHELL_EXPORT_PASS',json.dumps({r['asset_id']:{'bytes':r['bytes'],'dimensions':r['dimensions_m']} for r in records}))
