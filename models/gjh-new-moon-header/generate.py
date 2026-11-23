"""Author the New Moon wall header in metric dimensions for the expanded shop."""
from math import acos, cos, pi, sin
from pathlib import Path
import argparse
import sys

import bmesh

import bpy
from mathutils import Vector

WIDTH = 8.94
DEPTH = .24
HEIGHT = .65


def finish(name, color, *, metallic=0, roughness=.68, emission=0):
    material = bpy.data.materials.new(name)
    material.diffuse_color = (*color, 1)
    material.use_nodes = True
    shader = material.node_tree.nodes.get('Principled BSDF')
    shader.inputs['Base Color'].default_value = (*color, 1)
    shader.inputs['Metallic'].default_value = metallic
    shader.inputs['Roughness'].default_value = roughness
    shader.inputs['Emission Color'].default_value = (*color, 1)
    shader.inputs['Emission Strength'].default_value = emission
    return material


def extrude_strip(name, pairs, front, depth, material):
    profile = tuple(point for pair in pairs for point in pair)
    vertices = [(x, face, z) for face in (front, front+depth) for x,z in profile]
    count = len(profile)
    faces = []
    for index in range(0,count-2,2):
        band = (index,index+2,index+3,index+1)
        faces.extend([band,tuple(i+count for i in reversed(band))])
        faces.append((index,index+count,index+2+count,index+2))
        faces.append((index+1,index+3,index+3+count,index+1+count))
    faces.extend([(0,1,1+count,count),(count-2,2*count-2,2*count-1,count-1)])
    mesh = bpy.data.meshes.new(name)
    mesh.from_pydata(vertices,[],faces)
    mesh.validate()
    mesh.update()
    obj = bpy.data.objects.new(name,mesh)
    bpy.context.collection.objects.link(obj)
    obj.data.materials.append(material)
    return obj


def add_category_lettering(crown, material):
    """Fit original block lettering into the crown's existing cream face."""
    def rectangle(left, bottom, right, top):
        return ((left,bottom),(right,bottom),(right,top),(left,top))

    def rim(outer, inner, closed=False):
        return [(outer[i-1],outer[i],inner[i],inner[i-1])
                for i in range(0 if closed else 1,len(outer))]

    a = [
        ((0,0),(.18,0),(.52,1),(.31,1)),
        ((.67,0),(.85,0),(.52,1),(.435,.75)),
        ((.282,.30),(.576,.30),(.523,.47),(.3398,.47)),
    ]
    b = [rectangle(0,0,.20,1)] + rim(
        ((.20,1),(.60,1),(.83,.84),(.67,.50),(.20,.50)),
        ((.20,.82),(.53,.82),(.65,.78),(.56,.66),(.20,.66)),
    ) + rim(
        ((.20,.50),(.67,.50),(.88,.34),(.69,0),(.20,0)),
        ((.20,.33),(.59,.33),(.69,.29),(.60,.17),(.20,.17)),
    )
    o = rim(
        ((.19,0),(.66,0),(.85,.19),(.85,.81),(.66,1),(.19,1),(0,.81),(0,.19)),
        ((.28,.18),(.57,.18),(.66,.27),(.66,.73),(.57,.82),(.28,.82),(.19,.73),(.19,.27)),
        closed=True,
    )
    glyphs = {
        'A': a,
        'B': b,
        'L': [rectangle(0,0,.20,1), rectangle(.20,0,.76,.18)],
        'O': o,
        'N': [rectangle(0,0,.18,1), rectangle(.67,0,.85,1),
              ((.18,1),(.18,.72),(.67,0),(.67,.28))],
        'E': [rectangle(0,0,.20,1), rectangle(.20,0,.79,.18),
              rectangle(.20,.41,.65,.59), rectangle(.20,.82,.79,1)],
    }
    word = 'ABALONE'
    advances = [.85,.88,.85,.76,.85,.85,.79]
    cap_height, tracking = .45,.24
    offset = -(sum(advances) + tracking*(len(word)-1))/2
    vertices, faces = [], []
    for letter, advance in zip(word,advances):
        for quad in glyphs[letter]:
            start = len(vertices)
            # Face the aisle and stay ahead of the painted crown by 3 mm.
            vertices.extend(((offset+x)*cap_height,.025,.185+y*cap_height) for x,y in quad)
            area = sum(x*v-y*u for (x,y),(u,v) in zip(quad,quad[1:]+quad[:1]))
            face = tuple(range(start,start+4))
            faces.append(face if area>0 else face[::-1])
        offset += advance+tracking

    mesh = bpy.data.meshes.new('Abalone lettering')
    mesh.from_pydata(vertices,[],faces)
    mesh.update()
    ink = bpy.data.objects.new('Abalone lettering',mesh)
    bpy.context.collection.objects.link(ink)
    mesh.materials.append(material)
    colour = mesh.color_attributes.new(name='Finish',type='FLOAT_COLOR',domain='CORNER')
    for loop in colour.data:
        loop.color = (.018,.032,.09,1)
    crown.select_set(True)
    ink.select_set(True)
    bpy.context.view_layer.objects.active = crown
    bpy.ops.object.join()
    crown.select_set(False)


def build(samples, crescent_segments):
    bpy.ops.wm.read_factory_settings(use_empty=True)
    bpy.context.scene.unit_settings.system = 'METRIC'
    opaque = finish('Cream enamel, honey oak and yellow finish', (1,1,1))
    colour = opaque.node_tree.nodes.new('ShaderNodeVertexColor')
    colour.layer_name = 'Finish'
    shader = opaque.node_tree.nodes.get('Principled BSDF')
    opaque.node_tree.links.new(colour.outputs['Color'], shader.inputs['Base Color'])

    def coloured(name, pairs, front, depth, tint):
        obj = extrude_strip(name, pairs, front, depth, opaque)
        values = obj.data.color_attributes.new(name='Finish', type='FLOAT_COLOR', domain='CORNER')
        for loop in values.data:
            loop.color = (*tint, 1)
        return obj

    glow = finish('Warm white concealed underside', (1,.84,.54), emission=.58)
    count = samples * 6
    edge = [(WIDTH*(index/count-.5),.09*(1-cos(index/count*pi*12))) for index in range(count+1)]
    crown = coloured('Scalloped cream crown', [(p,(p[0],HEIGHT)) for p in edge], .028, DEPTH-.028, (.88,.77,.59))
    coloured('Oak profile bead', [(p,(p[0],p[1]+.038)) for p in edge], .013, .032, (.55,.31,.125))
    extrude_strip('Bounced cabinet light strip', [(p,(p[0],p[1]+.018)) for p in edge], .003, .019, glow)

    outer_radius=.47
    inner_offset=.19
    inner_radius=.385
    intersection=(outer_radius**2-inner_radius**2+inner_offset**2)/(2*inner_offset)
    outer_angle=acos(intersection/outer_radius)
    inner_angle=acos((intersection-inner_offset)/inner_radius)
    base_height=1.19
    pairs=[]
    for index in range(crescent_segments+1):
        fraction=index/crescent_segments
        outside=outer_angle+(2*pi-2*outer_angle)*fraction
        inside=inner_angle+(2*pi-2*inner_angle)*fraction
        inner=(inner_offset+inner_radius*cos(inside),base_height+inner_radius*sin(inside))
        outer=(outer_radius*cos(outside),base_height+outer_radius*sin(outside))
        # Preserve a short, flat cap at each end to avoid degenerate GLB faces.
        if index in {0,crescent_segments}:
            inner=(inner[0]-.012,inner[1])
        pairs.append((outer,inner))
    coloured('Yellow crescent wall mark',pairs,0,.045,(.98,.63,.019))

    for mesh in bpy.data.meshes:
        data = bmesh.new()
        data.from_mesh(mesh)
        bmesh.ops.recalc_face_normals(data, faces=list(data.faces))
        data.to_mesh(mesh)
        data.free()
    # Only the closed forms need outward normals recalculated.
    add_category_lettering(crown,opaque)


def add_preview(output):
    scene=bpy.context.scene
    scene.render.engine='CYCLES'
    scene.cycles.samples=16
    scene.cycles.use_denoising=True
    scene.render.resolution_x=820
    scene.render.resolution_y=360
    scene.render.resolution_percentage=100
    scene.world = bpy.data.worlds.new('Warm neutral studio')
    scene.world.color=(.24,.24,.24)
    def orient(obj, target):
        obj.rotation_euler=(Vector(target)-obj.location).to_track_quat('-Z','Y').to_euler()
    bpy.ops.object.camera_add(location=(.7,-13,3.15))
    camera=bpy.context.object
    orient(camera,(0,0,.78))
    camera.data.type='ORTHO'
    camera.data.ortho_scale=10.2
    scene.camera=camera
    for name,location,energy,size in [('Soft key',(-1.4,-4.6,5.7),1100,7),('Fill',(3,-2,2.8),110,4)]:
        bpy.ops.object.light_add(type='AREA',location=location)
        lamp=bpy.context.object
        lamp.name=name
        lamp.data.energy=energy
        lamp.data.shape='DISK'
        lamp.data.size=size
        orient(lamp,(0,0,.85))
    scene.render.filepath=str(output/'crescent-header-front.png')
    bpy.ops.render.render(write_still=True)


def main(output, *, preview=False):
    output.mkdir(parents=True,exist_ok=True)
    for tier,samples,segments in [('low',5,20),('balanced',8,30),('detailed',12,42)]:
        build(samples,segments)
        bpy.ops.export_scene.gltf(filepath=str(output/f's01-crescent-header-{tier}.glb'),export_format='GLB',export_yup=True,export_vertex_color='ACTIVE')
        if tier=='detailed':
            bpy.ops.wm.save_as_mainfile(filepath=str(output/'s01-crescent-header.blend'))
    if preview:
        add_preview(output)


if __name__=='__main__':
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--output', required=True, type=Path)
    parser.add_argument('--preview', action='store_true')
    options = parser.parse_args(sys.argv[sys.argv.index('--')+1:])
    main(options.output.resolve(), preview=options.preview)
