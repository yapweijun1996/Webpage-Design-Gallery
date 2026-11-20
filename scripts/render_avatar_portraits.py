"""Render a GLB at the GJH desktop portrait camera settings in Blender 5.1."""
import argparse
import hashlib
import json
from math import radians, tan
from pathlib import Path
import sys

import bpy
from mathutils import Matrix, Vector


def capture(glb, prefix, engine, yaw, distances, model_scale=None):
    bpy.ops.wm.read_factory_settings(use_empty=True)
    bpy.ops.import_scene.gltf(filepath=str(glb))
    scene = bpy.context.scene
    for obj in scene.objects:
        obj.animation_data_clear()
    rig, = (obj for obj in scene.objects if obj.type == 'ARMATURE')
    rig.data.pose_position = 'REST'
    bpy.context.view_layer.update()
    mesh, = (obj for obj in scene.objects if obj.type == 'MESH' and obj.find_armature() == rig)
    heights = [(mesh.matrix_world @ v.co).z for v in mesh.data.vertices]
    native_height = max(heights) - min(heights)
    native_per_metre = 1 / model_scale if model_scale else native_height / 1.7

    def joint(suffix):
        bone, = (b for b in rig.data.bones if b.name.endswith(suffix))
        return rig.matrix_world @ bone.head_local

    focus = joint('Head').lerp(joint('Hips'), .45)
    forward = (joint('LeftHand') - joint('RightHand')).cross(Vector((0, 0, 1))).normalized()
    camera_data = bpy.data.cameras.new('GJH portrait')
    camera = bpy.data.objects.new('GJH portrait', camera_data)
    scene.collection.objects.link(camera)
    scene.camera = camera
    width, height = 1920, 900
    camera_data.sensor_fit = 'VERTICAL'
    camera_data.lens = camera_data.sensor_height / (2 * tan(radians(64) / 2))
    view_direction = Matrix.Rotation(radians(yaw), 3, 'Z') @ forward
    camera.rotation_euler = (-view_direction).to_track_quat('-Z', 'Y').to_euler()
    camera_data.clip_start = .05 * native_per_metre

    # Fixed soft studio fill keeps the atlas and geometry visible; the live
    # mall shader and postprocessing are measured separately in the browser.
    scene.world = bpy.data.worlds.new('Neutral fill')
    scene.world.use_nodes = True
    fill = scene.world.node_tree.nodes.get('Background')
    fill.inputs['Color'].default_value = (.7, .7, .7, 1)
    fill.inputs['Strength'].default_value = .9
    sun = bpy.data.lights.new('Portrait key', 'SUN')
    sun.energy = 2.0
    sun.angle = radians(15)
    light = bpy.data.objects.new(sun.name, sun)
    scene.collection.objects.link(light)
    light.rotation_euler = (-forward + Vector((.28, 0, -.5))).to_track_quat('-Z', 'Y').to_euler()

    scene.render.engine = engine
    scene.cycles.device = 'CPU'
    scene.cycles.samples = 48
    scene.cycles.seed = 17
    scene.cycles.use_denoising = False
    scene.cycles.use_adaptive_sampling = False
    scene.view_settings.view_transform = 'Standard'
    scene.render.resolution_x = width
    scene.render.resolution_y = height
    scene.render.resolution_percentage = 100
    scene.render.image_settings.color_mode = 'RGB'
    manifest = {'asset_sha256': hashlib.sha256(glb.read_bytes()).hexdigest(),
                'renderer': engine, 'blender': bpy.app.version_string, 'size': [width, height],
                'vertical_fov_degrees': 64, 'normalized_height_m': native_height / native_per_metre,
                'pose': 'bind', 'focus': list(focus), 'forward': list(forward),
                'native_units_per_metre': native_per_metre, 'images': {}}
    if yaw:
        manifest['yaw_degrees'] = yaw
    for distance in distances:
        camera.location = focus + view_direction * (distance * native_per_metre)
        path = prefix.with_name(f'{prefix.name}-{distance:.1f}m.png')
        scene.render.filepath = str(path)
        bpy.ops.render.render(write_still=True)
        manifest['images'][path.name] = hashlib.sha256(path.read_bytes()).hexdigest()
    prefix.with_suffix('.json').write_text(json.dumps(manifest, indent=2) + '\n')


if __name__ == '__main__':
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('glb', type=Path)
    parser.add_argument('prefix', type=Path)
    parser.add_argument('--engine', choices=['BLENDER_EEVEE', 'CYCLES'], default='BLENDER_EEVEE')
    parser.add_argument("--model-scale", type=float, help="Runtime metres per native model unit")
    parser.add_argument('--yaw', type=float, default=0.0)
    parser.add_argument('--distance', type=float, choices=[2.5, 5.2], action='append')
    args = parser.parse_args(sys.argv[sys.argv.index('--') + 1:])
    capture(args.glb.resolve(), args.prefix.resolve(), args.engine, args.yaw, args.distance or [2.5, 5.2], args.model_scale)
