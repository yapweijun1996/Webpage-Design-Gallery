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

    glow = finish('Warm white concealed underside', (1,.84,.54), emission=.58)
    count = samples * 6
    edge = [(WIDTH*(index/count-.5),.09*(1-cos(index/count*pi*12))) for index in range(count+1)]
    coloured('Scalloped cream crown', [(p,(p[0],HEIGHT)) for p in edge], .028, DEPTH-.028, (.88,.77,.59))
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
