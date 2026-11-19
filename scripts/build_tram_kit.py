"""Build the three GJH sightseeing carriages with headless Blender 5.1."""
import math
import struct
import sys
import tempfile
import zlib
from pathlib import Path

import bpy

HERE = Path(__file__).resolve().parent
sys.path.insert(0, str(HERE))
sys.dont_write_bytecode = True
from validate_signage_glb import CONTRACT, MODELS
from gjh_interiors.palette import SWATCHES

OUTPUT = MODELS.parents[1] / "tram"
FINISHES = {key: CONTRACT["materials"][key] for key in (
    "lacquer_fascia", "brass_trim", "emissive_letter", "gunmetal", "timber_slat")}
FINISHES.update(canvas=dict(color="#" + SWATCHES[0], roughness=.84, metallic=0),
                leather=dict(color="#A75E43", roughness=.62, metallic=.02))


def palette_image(directory, name, colors):
    # One texel per finish, sampled at its centre with nearest filtering.
    def chunk(tag, data):
        return struct.pack(">I", len(data)) + tag + data + struct.pack(">I", zlib.crc32(tag + data))
    header = struct.pack(">IIBBBBB", len(colors), 1, 8, 2, 0, 0, 0)
    scanline = bytes([0]) + b"".join(bytes(color) for color in colors)
    path = directory / (name + ".png")
    path.write_bytes(b"\x89PNG\r\n\x1a\n" + chunk(b"IHDR", header)
                     + chunk(b"IDAT", zlib.compress(scanline)) + chunk(b"IEND", b""))
    image = bpy.data.images.load(str(path))
    if name == "surface":
        image.colorspace_settings.name = "Non-Color"
    image.pack()
    return image


def atlas(directory):
    mat = bpy.data.materials.new("Carriage finishes")
    mat.use_nodes = mat.use_backface_culling = True
    nodes, links = mat.node_tree.nodes, mat.node_tree.links
    shader = nodes.get("Principled BSDF")
    shader.inputs["Emission Strength"].default_value = .85
    colors = [bytes.fromhex(f["color"][1:]) for f in FINISHES.values()]
    surface = [(255, round(f["roughness"] * 255), round(f["metallic"] * 255)) for f in FINISHES.values()]
    light = [c if "emission" in f else (0, 0, 0) for c, f in zip(colors, FINISHES.values())]
    for name, pixels in (("base", colors), ("emission", light), ("surface", surface)):
        tex = nodes.new("ShaderNodeTexImage")
        tex.image = palette_image(directory, name, pixels)
        tex.interpolation = "Closest"
        if name == "surface":
            split = nodes.new("ShaderNodeSeparateColor")
            links.new(tex.outputs[0], split.inputs[0])
            links.new(split.outputs["Green"], shader.inputs["Roughness"])
            links.new(split.outputs["Blue"], shader.inputs["Metallic"])
        else:
            links.new(tex.outputs[0], shader.inputs["Base Color" if name == "base" else "Emission Color"])
    return mat


def build(tier, detail, directory):
    bpy.ops.wm.read_factory_settings(use_empty=True)
    finish = atlas(directory)
    pieces = []
    lacquer, brass, glow, iron, wood, cream, leather = FINISHES

    def paint(obj, name, color):
        obj.name = name
        obj.data.materials.append(finish)
        uv = obj.data.uv_layers.active or obj.data.uv_layers.new()
        for loop in uv.data:
            loop.uv = ((list(FINISHES).index(color) + .5) / len(FINISHES), .5)
        pieces.append(obj)
        return obj

    def block(name, color, x, y, z, width, height, length, bevel=0):
        bpy.ops.mesh.primitive_cube_add(size=1, location=(x, -z, y))
        obj = bpy.context.object
        obj.dimensions = (width, length, height)
        bpy.ops.object.transform_apply(location=False, rotation=False, scale=True)
        if bevel:
            mod = obj.modifiers.new("Rolled edge", "BEVEL")
            mod.width = bevel
            mod.segments = 1 + int(detail == 2 and bevel >= .03)
            bpy.ops.object.modifier_apply(modifier=mod.name)
        return paint(obj, name, color)

    def disc(name, color, x, y, z, radius, depth, axle=False):
        rotation = (0, math.pi / 2, 0) if axle else (math.pi / 2, 0, 0)
        bpy.ops.mesh.primitive_cylinder_add(vertices=(8, 12, 20)[detail], radius=radius, depth=depth,
                                            location=(x, -z, y), rotation=rotation)
        return paint(bpy.context.object, name, color)

    block("Rail skirt", iron, 0, .19, 0, 1.10, .22, 2.68, .065 if detail else 0)
    block("Lacquer sill", lacquer, 0, .31, 0, 1.34, .14, 2.89, .045 if detail else 0)
    block("Timber deck", wood, 0, .385, 0, 1.30, .035, 2.80)
    for side in (-1, 1):
        x = side * .48
        # Leave the rear bay on the platform side open for boarding.
        bench_length = 1.62 if side < 0 else 2.27
        centre = (2.27 - bench_length) / 2
        for end in (-1, 1):
            z = end * .98
            disc("Wheel", iron, side * .56, .175, z, .175, .115, True)
            disc("Hub", brass, side * .622, .175, z, .075, .018, True)
            block("Canopy stanchion", brass, side * .596, 1.49, end * 1.31, .044, 1.19, .044)
        block("Bench plinth", lacquer, x, .49, centre, .32, .18, bench_length - .01)
        block("Boxed cushion", leather, x, .6375, centre, .40, .135, bench_length, .043)
        back = block("Upholstered bolster", leather, side * .612, .84, centre, .105, .32, bench_length - .03, .041)
        back.rotation_euler.y = side * .10
        block("Waist rail", brass, side * .658, .98, centre, .035, .037, bench_length)
        if side < 0:
            block("Boarding tread", wood, -.614, .222, -.88, .17, .048, .69)
        if detail:
            for i in range(7):
                block("Stitched pleat", leather, side * .554, .845, centre + (i - 3) * bench_length / 7.5,
                      .024, .255, .026, .009 if detail == 2 else 0)
        for end in (-1, 1):
            if detail:
                block("Post collar", brass, side * .596, 1.96, end * 1.31, .075, .076, .075)
    for end in (-1, 1):
        block("End apron", lacquer, 0, .64, end * 1.32, 1.31, .58, .19, .075)
        block("Apron cap", brass, 0, .919, end * 1.32, 1.29, .035, .17)
    block("Canopy binding", brass, 0, 2.066, 0, 1.39, .07, 2.99, .032)
    block("Cream canopy", cream, 0, 2.121, 0, 1.40, .158, 3, .073)
    for side in (-1, 1):
        block("Warm valance strip", glow, side * .64, 2.031, 0, .037, .028, 2.84)
    disc("Headlamp bezel", brass, 0, .79, 1.433, .105, .078)
    disc("Headlamp lens", glow, 0, .79, 1.476, .080, .016)
    block("Builder plate", brass, 0, .553, 1.419, .40, .153, .018)
    bpy.ops.object.text_add(location=(0, -1.43, .551), rotation=(math.pi/2, 0, 0))
    label = bpy.context.object
    label.data.body = "GJH"
    label.data.align_x = label.data.align_y = "CENTER"
    label.data.size = .138
    label.data.resolution_u = 2
    bpy.ops.object.convert(target="MESH")
    paint(bpy.context.object, "GJH inscription", lacquer)

    for name, point in (("TramSeatAnchor", (-.48, -.73, .705)), ("TramLamp", (0, -1.484, .79))):
        bpy.ops.object.empty_add(type="ARROWS", location=point)
        bpy.context.object.name = name
        bpy.context.object.empty_display_size = .10
        if name == "TramSeatAnchor":
            # Avatar forward is local -Z in glTF; point it across the aisle.
            bpy.context.object.rotation_euler.z = -math.pi / 2
    if detail == 2:
        bpy.context.preferences.filepaths.save_version = 0
        bpy.ops.wm.save_as_mainfile(filepath=str(HERE / "gjh-tram.blend"), compress=True)
    bpy.ops.object.select_all(action="DESELECT")
    for obj in pieces:
        obj.select_set(True)
    bpy.context.view_layer.objects.active = pieces[0]
    bpy.ops.object.join()
    car = bpy.context.object
    car.name = "SightseeingCarriage"
    bpy.ops.object.transform_apply(location=True, rotation=True, scale=True)
    bpy.ops.export_scene.gltf(filepath=str(OUTPUT / (tier + ".glb")), export_format="GLB",
                              export_tangents=False, export_cameras=False, export_lights=False)


if __name__ == "__main__":
    OUTPUT.mkdir(parents=True, exist_ok=True)
    with tempfile.TemporaryDirectory() as temp:
        for level, name in enumerate(("low", "balanced", "detailed")):
            build(name, level, Path(temp))
