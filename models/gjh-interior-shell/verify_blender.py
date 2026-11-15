"""Inspect editable sources, then independently import exports and render six views."""
import hashlib,json,math,sys
from pathlib import Path
import bpy,bmesh
from mathutils import Vector,Matrix
def assert_root(root):
 assert all(abs(root.matrix_world[i][j]-(1 if i==j else 0))<1e-6 for i in range(4) for j in range(4))
 return {"translation":list(root.matrix_world.translation),"matrix": [list(row) for row in root.matrix_world]}
HERE=Path(__file__).resolve().parent;ROOT=HERE.parents[1]
manifest=json.loads((ROOT/'demos/corporate/gjh/v11/assets/interior-shell.json').read_text());sources=[];imports=[]
for row in manifest['assets']:
 source=ROOT/row['editable_source'];assert hashlib.sha256(source.read_bytes()).hexdigest()==row['editable_source_sha256']
 bpy.ops.wm.open_mainfile(filepath=str(source));scene=bpy.context.scene;root=scene.objects.get(row['asset_id']);assert root and root.get('asset_id')==row['asset_id'];assert scene.unit_settings.system=='METRIC' and scene.unit_settings.scale_length==1
 assert all(n in bpy.data.collections for n in ('VISUAL','COLLISION','SOCKETS','LOD0','LOD1','LOD2'))
 source_root=assert_root(root)
 counts=[]
 for o in bpy.data.collections['VISUAL'].objects:
  assert all(abs(v)<1e-6 for v in o.rotation_euler)
  assert o.type=='MESH' and o.parent==root and all(abs(v-1)<1e-6 for v in o.scale) and o.matrix_world.determinant()>0
  evaluated=o.evaluated_get(bpy.context.evaluated_depsgraph_get());mesh=evaluated.to_mesh();bm=bmesh.new();bm.from_mesh(mesh)
  assert all(math.isfinite(v) for p in bm.verts for v in p.co);assert all(f.calc_area()>1e-12 for f in bm.faces);assert all(e.is_manifold for e in bm.edges);assert bm.calc_volume(signed=True)>0
  counts.append({'name':o.name,'closedManifold':True,'positiveVolume':True});bm.free();evaluated.to_mesh_clear()
 proxy_count=len(bpy.data.collections['COLLISION'].objects);assert proxy_count==(3 if row['kind']=='frontage' else 0 if row['kind']=='ceiling' else 1)
 sources.append({'asset_id':row['asset_id'],'sha256':row['editable_source_sha256'],'unitScaleAndTransforms':'PASS','observedRoot':source_root,'solidComponents':counts,'proxyCount':proxy_count,'socketCount':len(bpy.data.collections['SOCKETS'].objects)})
 bpy.ops.wm.read_factory_settings(use_empty=True);bpy.ops.import_scene.gltf(filepath=str(ROOT/'demos/corporate/gjh/v11/assets'/row['file']));scene=bpy.context.scene;meshes=[o for o in scene.objects if o.type=='MESH'];root=scene.objects.get(row['asset_id']);assert root and root.get('asset_id')==row['asset_id'];assert all(all(abs(v-1)<1e-6 for v in o.scale) for o in scene.objects)
 observed_root=assert_root(root)
 points=[o.matrix_world@v.co for o in meshes for v in o.data.vertices];low=Vector(tuple(min(v[i] for v in points) for i in range(3)));high=Vector(tuple(max(v[i] for v in points) for i in range(3)))
 # Blender Z up, front-Y: transform observed min/max back to glTF X/Y/Z.
 gltf_min=[low.x,low.z,-high.y];gltf_max=[high.x,high.z,-low.y]
 assert all(abs(a-b)<.001 for a,b in zip(gltf_min,row['bounds_min'])),(row['asset_id'],gltf_min,row['bounds_min'])
 assert all(abs(a-b)<.001 for a,b in zip(gltf_max,row['bounds_max'])),(row['asset_id'],gltf_max,row['bounds_max'])
 for engine in ('BLENDER_EEVEE','BLENDER_EEVEE_NEXT'):
  try:scene.render.engine=engine;break
  except TypeError:pass
 scene.render.resolution_x=scene.render.resolution_y=384;scene.render.resolution_percentage=100;scene.render.image_settings.file_format='PNG';scene.world=bpy.data.worlds.new('Neutral shell QA');scene.world.use_nodes=True;scene.world.node_tree.nodes['Background'].inputs['Color'].default_value=(.28,.32,.28,1);scene.world.node_tree.nodes['Background'].inputs['Strength'].default_value=.7
 centre=(low+high)/2;scale=max(high-low)
 for p,power in [((3,-4,6),700),((-4,-1,3),400),((1,4,5),800)]:
  bpy.ops.object.light_add(type='AREA',location=centre+Vector(p)*scale/2);o=bpy.context.object;o.data.energy=power*max(1,scale/2)**2;o.data.size=scale*2;o.rotation_euler=(centre-o.location).to_track_quat('-Z','Y').to_euler()
 bpy.ops.object.camera_add();camera=bpy.context.object;scene.camera=camera;camera.data.type='ORTHO';camera.data.ortho_scale=scale*1.35
 views={'front':(0,-3,.1),'side':(3,0,.1),'back':(0,3,.1),'top':(0,.001,4),'bottom':(0,.001,-4),'three-quarter':(2.5,-3,2)}
 for name,direction in (views.items() if '--no-render' not in sys.argv else []):
  camera.location=centre+Vector(direction)*scale;camera.rotation_euler=(centre-camera.location).to_track_quat('-Z','Y').to_euler();scene.render.filepath=str(HERE/'previews'/f'{row["asset_id"]}-{name}.png');bpy.ops.render.render(write_still=True)
 imports.append({'asset_id':row['asset_id'],'gltf_min':gltf_min,'gltf_max':gltf_max,'openingCentrePivot':observed_root['translation'],'observedRoot':observed_root,'front':'Blender -Y / glTF +Z','boundsAndNativeScale':'PASS','views':list(views)})
(HERE/'reports/blender-verification.json').write_text(json.dumps({'blenderVersion':bpy.app.version_string,'source':sources,'reimport':imports},indent=2)+'\n');print('SHELL_BLENDER_PASS',len(sources),len(imports))
