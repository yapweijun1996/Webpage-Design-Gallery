"""Author/re-export the eight texture-free pilot assets in a background Blender.

Usage: Blender --background --factory-startup --python build.py -- --upstream PATH
Only models/gjh-interior-pilot and the eight named demo exports are written.
"""
import argparse
import hashlib
import json
import math
import sys
from pathlib import Path
import bpy
from mathutils import Vector

HERE = Path(__file__).resolve().parent
ROOT = HERE.parents[1]
RUNTIME = ROOT / 'demos/corporate/gjh/v11/assets'
SPECS = [
    ('GJH-PUB-002', 'bench', 'gjh-mall-furniture/sources/gjh-lounge-bench.blend', 'reuse', ['SIT']),
    ('GJH-PUB-008', 'planter', 'gjh-mall-furniture/sources/gjh-areca-planter.blend', 'reuse', []),
    ('GJH-PUB-017', 'kiosk', 'mall-essentials/sources/mall-directory-kiosk.blend', 'adapt', ['USE']),
    ('GJH-DSP-001', 'shelf', 'mall-essentials/sources/mall-display-shelf.blend', 'reuse', ['INSPECT']),
    ('GJH-STF-008', 'storeSign', None, 'new', []),
    ('GJH-LGT-009', 'wallLight', None, 'new', []),
    ('GJH-PUB-005', 'coffeeTable', None, 'new', []),
    ('GJH-VER-017', 'plinth', None, 'new', []),
]


def digest(path):
    return hashlib.sha256(path.read_bytes()).hexdigest()


def material(name, rgb, roughness=.6, metallic=0, emission=0):
    m = bpy.data.materials.new(name)
    m.use_nodes = True
    node = m.node_tree.nodes.get('Principled BSDF')
    linear = lambda v: v / 12.92 if v <= .04045 else ((v + .055) / 1.055) ** 2.4
    rgba = tuple(linear(v / 255) for v in rgb) + (1,)
    node.inputs['Base Color'].default_value = rgba
    node.inputs['Roughness'].default_value = roughness
    node.inputs['Metallic'].default_value = metallic
    node.inputs['Emission Color'].default_value = rgba
    node.inputs['Emission Strength'].default_value = emission
    return m


def finish(obj, name, mat, bevel=.01):
    obj.name = name
    obj.data.materials.append(mat)
    if bevel:
        mod = obj.modifiers.new('Manufactured edge bevel', 'BEVEL')
        mod.width = bevel
        mod.segments = 2
        mod = obj.modifiers.new('Weighted surface normals', 'WEIGHTED_NORMAL')
    return obj


def box(name, xyz, size, mat, bevel=.01):
    bpy.ops.mesh.primitive_cube_add(size=1, location=xyz)
    obj = bpy.context.object
    obj.dimensions = size
    bpy.ops.object.transform_apply(location=False, rotation=False, scale=True)
    return finish(obj, name, mat, bevel)


def cylinder(name, xyz, radius, height, mat, bevel=.008, segments=48):
    bpy.ops.mesh.primitive_cylinder_add(vertices=segments, radius=radius, depth=height, location=xyz)
    return finish(bpy.context.object, name, mat, bevel)


def palette():
    return {'brass': material('Satin brass', (163, 132, 69), .35, .68),
            'jade': material('Jade lacquer', (30, 65, 51), .48),
            'stone': material('Ivory stone', (211, 203, 174), .72),
            'dark': material('Dark reveal', (24, 36, 29), .8),
            'wood': material('Warm oak', (105, 72, 43), .58),
            'glow': material('Warm diffuser', (255, 227, 173), .65, 0, .8),
            'water': material('Still jade water', (47, 102, 83), .23)}


def original(kind):
    bpy.ops.wm.read_factory_settings(use_empty=True)
    p = palette()
    if kind == 'storeSign':
        box('Brass perimeter', (0, 0, .605), (2.52, .14, 1.21), p['brass'], .018)
        box('Rear shadow reveal', (0, .075, .605), (2.40, .05, 1.09), p['dark'], .01)
        box('Ivory sign face', (0, -.085, .605), (2.40, .04, 1.09), p['stone'], .012)
        for x in (-1.12, 1.12):
            box('Corner fixing', (x, -.109, .605), (.025, .008, .025), p['brass'], .004)
    elif kind == 'wallLight':
        box('Mounting plate', (0, .015, .5), (.32, .08, 1), p['brass'], .016)
        box('Recessed dark backing', (0, -.04, .5), (.27, .04, .91), p['dark'], .01)
        box('Opal diffuser', (0, -.105, .5), (.22, .10, .78), p['glow'], .025)
        for z in (.06, .94):
            box('Brass end cap', (0, -.10, z), (.30, .20, .12), p['brass'], .014)
    elif kind == 'coffeeTable':
        for x in (-.43, .43):
            for y in (-.43, .43):
                cylinder('Brass levelling foot', (x, y, .025), .07, .05, p['brass'])
                box('Tapered oak leg', (x, y, .39), (.095, .095, .73), p['wood'], .014)
        for y in (-.43, .43):
            box('Oak apron', (0, y, .72), (.96, .07, .09), p['wood'])
        cylinder('Brass shadow line', (0, 0, .7825), .805, .025, p['brass'])
        cylinder('Rounded oak top', (0, 0, .835), .80, .08, p['wood'], .018, 64)
    elif kind == 'plinth':
        cylinder('Ground brass shoe', (0, 0, .11), 2.25, .22, p['brass'], .025, 64)
        cylinder('Recessed shadow seam', (0, 0, .225), 2.10, .045, p['dark'], .008, 64)
        cylinder('Ivory bowl wall', (0, 0, .395), 2.04, .34, p['stone'], .035, 64)
        cylinder('Satin coping', (0, 0, .58), 2.055, .045, p['brass'], .012, 64)
        cylinder('Still water surface', (0, 0, .63), 1.88, .045, p['water'], .005, 64)
    return [o for o in bpy.context.scene.objects if o.type == 'MESH']


def import_source(path, kind):
    bpy.ops.wm.open_mainfile(filepath=str(path))
    roots = [o for o in bpy.context.scene.objects if o.type == 'EMPTY' and o.name.startswith('ASSET_')]
    if len(roots) != 1:
        raise ValueError(f'Expected one authored root in {path}: {[o.name for o in roots]}')
    objects = [o for o in roots[0].children_recursive if o.type in ('MESH', 'CURVE', 'FONT')]
    keep = set(objects)
    for obj in list(bpy.context.scene.objects):
        if obj not in keep:
            bpy.data.objects.remove(obj, do_unlink=True)
    if kind == 'kiosk':
        # Align the decorative screen's three store blocks with the real mall map.
        for obj in list(objects):
            if any(label in obj.name for label in ('Illustrative shop block', 'Touch category tile', 'Map route')):
                objects.remove(obj)
                bpy.data.objects.remove(obj, do_unlink=True)
        jade = next(m for m in bpy.data.materials if 'jade' in m.name.lower())
        cream = material('Pilot ivory index', (230, 222, 197))
        for i, x in enumerate((-.23, 0, .23), 1):
            objects.append(box(f'Store {i:02} block', (x, .155, 1.33), (.18, .012, .34), jade, .006))
            bpy.ops.object.text_add(location=(x, .17, 1.35), rotation=(math.pi/2, 0, math.pi))
            obj=bpy.context.object;obj.name=f'Store {i:02} index';obj.data.body=f'{i:02}';obj.data.align_x='CENTER';obj.data.size=.05;obj.data.materials.append(cream);objects.append(obj)
    return objects


def evaluated_bounds(objects):
    bpy.context.view_layer.update()
    deps = bpy.context.evaluated_depsgraph_get()
    points = []
    for obj in objects:
        evaluated = obj.evaluated_get(deps)
        mesh = evaluated.to_mesh()
        points.extend(evaluated.matrix_world @ vertex.co for vertex in mesh.vertices)
        evaluated.to_mesh_clear()
    low = Vector(tuple(min(v[i] for v in points) for i in range(3)))
    high = Vector(tuple(max(v[i] for v in points) for i in range(3)))
    return low, high


def export_asset(asset_id, kind, source, reuse, capabilities, upstream):
    source_path = upstream / 'models' / source if source else None
    objects = import_source(source_path, kind) if source else original(kind)
    scene = bpy.context.scene
    scene.unit_settings.system = 'METRIC'; scene.unit_settings.scale_length = 1
    for obj in objects:
        world = obj.matrix_world.copy(); obj.parent = None; obj.matrix_world = world
    low, high = evaluated_bounds(objects)
    offset = Vector(((low.x+high.x)/2, (low.y+high.y)/2, low.z))
    for obj in objects:
        obj.location -= offset
    root = bpy.data.objects.new(asset_id, None); scene.collection.objects.link(root)
    root['asset_id'] = asset_id; root['version'] = '1.0.0'; root['units'] = 'metres';root['origin'] = 'ground-centre'
    for obj in objects: obj.parent = root
    for name in ('VISUAL', 'COLLISION', 'SOCKETS', 'LOD0', 'LOD1', 'LOD2'):
        collection=bpy.data.collections.new(name);scene.collection.children.link(collection)
        if name=='VISUAL':
            for obj in objects:
                for old in list(obj.users_collection):old.objects.unlink(obj)
                collection.objects.link(obj)
    file = asset_id.replace('-', '_')
    bpy.ops.wm.save_as_mainfile(filepath=str(HERE/'sources'/f'{file}.blend'), compress=True)
    # Bake evaluated, joined copies; keep the editable original source intact.
    bpy.ops.object.select_all(action='DESELECT')
    copies=[]
    for obj in objects:
        copy=obj.copy();copy.data=obj.data.copy();scene.collection.objects.link(copy);copy.select_set(True);copies.append(copy)
    bpy.context.view_layer.objects.active=copies[0]
    bpy.ops.object.convert(target='MESH');bpy.ops.object.join()
    merged=bpy.context.object;merged.name=f'{asset_id}_VISUAL';merged.parent=root
    bpy.ops.object.transform_apply(location=False, rotation=False, scale=True)
    scene.cursor.location=(0,0,0);bpy.ops.object.origin_set(type='ORIGIN_CURSOR')
    root.select_set(True)
    target=RUNTIME/f'{file}.glb'
    bpy.ops.export_scene.gltf(filepath=str(target), export_format='GLB',use_selection=True,export_apply=True,
        export_yup=True, export_animations=False,export_texcoords=False,export_extras=True,export_cameras=False,export_lights=False)
    size=high-low
    record={'asset_id':asset_id,'kind':kind,'version':'1.0.0','file':target.name,'sha256':digest(target),'bytes':target.stat().st_size,
        'dimensions_m':[round(size.x,6),round(size.z,6),round(size.y,6)],'authoring_dimensions_wdh_m':[round(size.x,6),round(size.y,6),round(size.z,6)],
        'reuse_decision':reuse,'source':source or 'Original geometry in models/gjh-interior-pilot/build.py',
        'source_sha256':digest(source_path) if source_path else digest(Path(__file__)), 'capabilities':capabilities,
        'editable_source':f'models/gjh-interior-pilot/sources/{file}.blend','lod_policy':'Single native-scale static mesh instanced per primitive; reviewed simple/instance-only exemption. No distance LOD claim.',
        'uv_policy':'No textures or baking; UV0/UV1 not required.','collision_owner':'V11 app-owned Rapier proxies; no visual collision nodes exported.',
        'rights':'Original owner-project assets/adaptations; project reuse authorized; no new third-party artwork or textures.'}
    return record


def main():
    args=argparse.ArgumentParser();args.add_argument('--upstream',type=Path,required=True)
    opts=args.parse_args(sys.argv[sys.argv.index('--')+1:])
    for name in ('sources','reports','previews'):(HERE/name).mkdir(exist_ok=True)
    records=[export_asset(*spec,opts.upstream) for spec in SPECS]
    manifest={'schema_version':1,'assets':records,'scope':'Eight-ID interior pilot; no expansion to the other 192 candidates.'}
    (RUNTIME/'interior-pilot.json').write_text(json.dumps(manifest,indent=2)+'\n')
    registry={item['kind']:item for item in records}
    (RUNTIME/'interior-pilot-registry.js').write_text('// Generated by models/gjh-interior-pilot/build.py.\nexport const INTERIOR_PILOT = Object.freeze('+json.dumps(registry,indent=2)+');\n')
    print('PILOT_EXPORT_COMPLETE',json.dumps({r['asset_id']:r['dimensions_m'] for r in records}))

if __name__=='__main__':main()
