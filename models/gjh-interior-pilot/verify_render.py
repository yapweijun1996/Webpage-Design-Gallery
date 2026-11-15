"""Independent Blender GLB reimport, transform/bounds checks and five-view QA."""
import json,math
from pathlib import Path
import bpy
from mathutils import Vector
HERE=Path(__file__).resolve().parent
ROOT=HERE.parents[1]
manifest=json.loads((ROOT/'demos/corporate/gjh/v11/assets/interior-pilot.json').read_text())
rows=[]
for record in manifest['assets']:
    bpy.ops.wm.read_factory_settings(use_empty=True)
    bpy.ops.import_scene.gltf(filepath=str(ROOT/'demos/corporate/gjh/v11/assets'/record['file']))
    scene=bpy.context.scene
    meshes=[o for o in scene.objects if o.type=='MESH']
    root=bpy.data.objects.get(record['asset_id'])
    assert root and root.get('asset_id')==record['asset_id']
    assert all(all(abs(v-1)<.00001 for v in o.scale) for o in scene.objects)
    points=[o.matrix_world@v.co for o in meshes for v in o.data.vertices]
    low=Vector(tuple(min(v[i] for v in points) for i in range(3)))
    high=Vector(tuple(max(v[i] for v in points) for i in range(3)))
    actual=high-low;expected=record['authoring_dimensions_wdh_m']
    assert all(abs(actual[i]-expected[i])<.001 for i in range(3)),(record['asset_id'],list(actual),expected)
    assert abs(low.z)<.0005 and abs(low.x+high.x)<.001 and abs(low.y+high.y)<.001
    # Report intentional open geometry (foliage and signs) instead of claiming watertightness.
    import bmesh
    boundary=0
    for o in meshes:
        bm=bmesh.new();bm.from_mesh(o.data);boundary+=sum(e.is_boundary for e in bm.edges);bm.free()
    for engine in ('BLENDER_EEVEE','BLENDER_EEVEE_NEXT'):
        try:scene.render.engine=engine;break
        except TypeError:pass
    scene.render.resolution_x=scene.render.resolution_y=256
    scene.render.resolution_percentage=100
    scene.render.image_settings.file_format='PNG'
    scene.render.film_transparent=False
    scene.world=bpy.data.worlds.new('Pilot QA neutral studio');scene.world.use_nodes=True
    scene.world.node_tree.nodes['Background'].inputs['Color'].default_value=(.32,.35,.32,1)
    scene.world.node_tree.nodes['Background'].inputs['Strength'].default_value=.7
    scale=max(actual)
    bpy.ops.mesh.primitive_plane_add(size=scale*12,location=(0,0,-.003))
    floor=bpy.context.object;floor.name='QA stage only'
    m=bpy.data.materials.new('Studio sand');m.diffuse_color=(.19,.21,.19,1);floor.data.materials.append(m)
    target=Vector((0,0,actual.z/2))
    for pos,power,size in [((3,-4,6),600,5),((-4,-1,3),300,4),((1,4,5),700,3)]:
        bpy.ops.object.light_add(type='AREA',location=Vector(pos)*max(1,scale/2));light=bpy.context.object
        light.data.energy=power*max(1,scale/2)**2;light.data.shape='DISK';light.data.size=size*max(1,scale/2)
        light.rotation_euler=(target-light.location).to_track_quat('-Z','Y').to_euler()
    bpy.ops.object.camera_add();camera=bpy.context.object;scene.camera=camera;camera.data.type='ORTHO';camera.data.ortho_scale=scale*1.35
    front=1 if record['reuse_decision']!='new' else -1
    directions={'front':(0,front*3,.6),'side':(3,0,.6),'back':(0,-front*3,.6),'top':(0,.001,4),'three-quarter':(2.5,front*3,2)}
    for view,direction in directions.items():
        camera.location=target+Vector(direction)*scale
        camera.rotation_euler=(target-camera.location).to_track_quat('-Z','Y').to_euler()
        scene.render.filepath=str(HERE/'previews'/f'{record["asset_id"]}-{view}.png')
        bpy.ops.render.render(write_still=True)
    rows.append({'asset_id':record['asset_id'],'bounds_wdh_m':list(actual),'floor_min_m':low.z,'boundary_edges':boundary,'mesh_objects':len(meshes),'reimport':'PASS','views':list(directions)})
(HERE/'reports/blender-reimport.json').write_text(json.dumps({'blender_version':bpy.app.version_string,'assets':rows},indent=2)+'\n')
print('PILOT_REIMPORT_AND_VIEWS_PASS',len(rows))
