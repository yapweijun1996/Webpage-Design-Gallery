"""Unprinted MILI 510 g sauce bottle geometry study from official catalogue silhouettes."""
from math import cos, pi, sin
from pathlib import Path
import bpy
import bmesh

OUTPUT=Path(__file__).resolve().parent / 'exports'
RADIUS=.0275
HEIGHT=.245

# Millimetre envelope from the eShop listing. Shoulder contour is inferred
# from frontal photos, with the cylindrical cross section treated as a study.
GLASS=((.83,0),(.89,.010),(.968,.047),(.99,.092),(1,.23),(1,.48),
       (.962,.56),(.856,.66),(.735,.75),(.628,.83),(.535,.905),(.536,.944))
CAP=((.555,.913),(.59,.919),(.605,.936),(.604,.989),(.57,1.0))

def solid(name, profile, sides, color, roughness):
    vertices=[(RADIUS*r*cos(2*pi*i/sides),RADIUS*r*sin(2*pi*i/sides),HEIGHT*y)
              for r,y in profile for i in range(sides)]
    faces=[tuple(reversed(range(sides)))]
    for row in range(len(profile)-1):
        for col in range(sides):
            a=row*sides+col;b=row*sides+(col+1)%sides
            faces.append((a,b,b+sides,a+sides))
    faces.append(tuple(range(len(vertices)-sides,len(vertices))))
    mesh=bpy.data.meshes.new(name)
    mesh.from_pydata(vertices,[],faces)
    edit=bmesh.new();edit.from_mesh(mesh)
    bmesh.ops.recalc_face_normals(edit,faces=list(edit.faces))
    edit.to_mesh(mesh);edit.free()
    mesh.update()
    obj=bpy.data.objects.new(name,mesh)
    bpy.context.collection.objects.link(obj)
    m=bpy.data.materials.new(name);m.diffuse_color=(*color,1);m.use_nodes=True
    shader=m.node_tree.nodes.get('Principled BSDF')
    shader.inputs['Base Color'].default_value=(*color,1)
    shader.inputs['Roughness'].default_value=roughness
    obj.data.materials.append(m)
    for face in mesh.polygons:face.use_smooth=len(face.vertices)==4


def build():
    OUTPUT.mkdir(exist_ok=True)
    for tier,sides in [('low',12),('balanced',20),('detailed',32)]:
        bpy.ops.wm.read_factory_settings(use_empty=True)
        bpy.context.scene.unit_settings.system='METRIC'
        solid('Dark filled bottle',GLASS,sides,(.063,.029,.010),.30)
        solid('Red-orange closure',CAP,sides,(.80,.075,.028),.52)
        bpy.ops.export_scene.gltf(filepath=str(OUTPUT/f'mili-oyster-sauce-bottle-{tier}.glb'),export_format='GLB')
        if tier=='detailed':
            bpy.ops.wm.save_as_mainfile(filepath=str(OUTPUT/'mili-oyster-sauce-bottle.blend'))
    return {p.name:p.stat().st_size for p in OUTPUT.iterdir()}


if __name__ == '__main__':
    print(build())
