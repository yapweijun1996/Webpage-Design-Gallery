"""Check editable sources separately from glTF split-vertex topology."""
import hashlib,json,math
from pathlib import Path
import bpy,bmesh
HERE=Path(__file__).resolve().parent
ROOT=HERE.parents[1]
manifest=json.loads((ROOT/'demos/corporate/gjh/v11/assets/interior-pilot.json').read_text())
rows=[]
for record in manifest['assets']:
    source=ROOT/record['editable_source'];bpy.ops.wm.open_mainfile(filepath=str(source))
    scene=bpy.context.scene;root=scene.objects.get(record['asset_id']);assert root and root.get('asset_id')==record['asset_id']
    assert scene.unit_settings.system=='METRIC' and scene.unit_settings.scale_length==1
    assert all(name in bpy.data.collections for name in ('VISUAL','COLLISION','SOCKETS','LOD0','LOD1','LOD2'))
    objects=[o for o in root.children_recursive if o.type in ('MESH','CURVE','FONT')]
    opened=[];degenerated=[]
    for obj in objects:
        assert obj.matrix_world.determinant()>0 and all(abs(v-1)<.00001 for v in obj.scale),(record['asset_id'],obj.name)
        evaluated=obj.evaluated_get(bpy.context.evaluated_depsgraph_get());mesh=evaluated.to_mesh();bm=bmesh.new();bm.from_mesh(mesh)
        assert all(math.isfinite(v) for vertex in bm.verts for v in vertex.co)
        boundaries=sum(edge.is_boundary for edge in bm.edges)
        if boundaries:opened.append({'object':obj.name,'type':obj.type,'boundary_edges':boundaries})
        if any(face.calc_area()<1e-12 for face in bm.faces):degenerated.append(obj.name)
        bm.free();evaluated.to_mesh_clear()
    assert not degenerated,(record['asset_id'],degenerated)
    if record['reuse_decision']=='new':assert not opened,(record['asset_id'],opened)
    rows.append({'asset_id':record['asset_id'],'source_sha256':hashlib.sha256(source.read_bytes()).hexdigest(),'objects':len(objects),'unitsAndScale':'PASS','finiteNondegenerateGeometry':'PASS','open_surfaces':opened,'open_surface_policy':'Intentional original foliage sheets, curve stem ends and text faces; inspect names and five-view renders. New solid models require closed components.'})
(HERE/'reports/source-inspection.json').write_text(json.dumps({'blender_version':bpy.app.version_string,'assets':rows},indent=2)+'\n')
print('SOURCE_INSPECTION_PASS',len(rows))
