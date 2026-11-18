"""Build the GJH v11 modular signage kit with Blender 5.x."""

import argparse
import hashlib
import json
import re
import sys
from math import cos, pi, radians, sin, tan
from pathlib import Path
from xml.etree import ElementTree

import bmesh
import bpy
from mathutils import Vector

sys.path.insert(0, str(Path(__file__).resolve().parent))
sys.dont_write_bytecode = True
from validate_signage_glb import CONTRACT, MODELS, ROOT, collect_manifest, linear_rgb

SOURCES = MODELS.parent / "sources"
RENDERS = ROOT / "docs/gjh-v11-signage-system-assets"
FONT = ROOT / "demos/heritage/thow-kwang/v1/assets/instrument-serif.ttf"


class Mesh:
    def __init__(self):
        self.vertices = []
        self.faces = []
        self.finishes = []

    def face(self, indices, finish):
        self.faces.append(indices)
        self.finishes.append(finish)

    def rings(self, rings, finish):
        """Join equal-size loops and cap both ends."""
        start = len(self.vertices)
        sides = len(rings[0])
        for ring in rings:
            self.vertices.extend(ring)
        self.face(tuple(reversed(range(start, start + sides))), finish)
        for row in range(len(rings) - 1):
            base = start + row * sides
            for index in range(sides):
                a, b = base + index, base + (index + 1) % sides
                self.face((a, b, b + sides, a + sides), finish)
        end = start + (len(rings) - 1) * sides
        self.face(tuple(range(end, end + sides)), finish)

    def plate(self, width, height, depth, finish, *, x=0, y=0, z=0, radius=0.003):
        # Rounded corners in the face plane and a small depth bevel.
        bevel = min(depth * 0.22, radius * 0.5)
        rings = []
        for level, inset in ((0, bevel), (bevel, 0), (depth - bevel, 0), (depth, bevel)):
            ring = []
            corners = ((1, 1), (-1, 1), (-1, -1), (1, -1))
            for quadrant, (sx, sy) in enumerate(corners):
                for step in range(3):
                    angle = (quadrant + step / 2) * pi / 2
                    ring.append((x + sx * (width / 2 - radius) + (radius - inset) * cos(angle),
                                 y + height / 2 + sy * (height / 2 - radius) + (radius - inset) * sin(angle),
                                 z + level))
            rings.append(ring)
        self.rings(rings, finish)

    def object(self, name, materials):
        mesh = bpy.data.meshes.new(name)
        mesh.from_pydata([blender_point(v) for v in self.vertices], [], self.faces)
        for finish in dict.fromkeys(self.finishes):
            mesh.materials.append(materials[finish])
        for face, finish in zip(mesh.polygons, self.finishes):
            face.material_index = mesh.materials.find(finish)
        bm = bmesh.new()
        bm.from_mesh(mesh)
        bmesh.ops.recalc_face_normals(bm, faces=list(bm.faces))
        bmesh.ops.triangulate(bm, faces=list(bm.faces))
        bm.to_mesh(mesh)
        bm.free()
        mesh.update()
        obj = bpy.data.objects.new(name, mesh)
        bpy.context.collection.objects.link(obj)
        return obj


def blender_point(point):
    x, y, z = point
    return x, -z, y


def material(name, spec):
    result = bpy.data.materials.new(name)
    result.use_nodes = True
    result.use_backface_culling = not spec.get("doubleSided", False)
    base = (*linear_rgb(spec["color"]), 1.0)
    result.diffuse_color = base
    shader = result.node_tree.nodes.get("Principled BSDF")
    shader.inputs["Base Color"].default_value = base
    shader.inputs["Metallic"].default_value = spec["metallic"]
    shader.inputs["Roughness"].default_value = spec["roughness"]
    if "emission" in spec:
        shader.inputs["Emission Color"].default_value = base
        shader.inputs["Emission Strength"].default_value = spec["emission"]
    return result


def trim(mesh, width, height, kind):
    # The same cross-section terminates at every seam, including both miter ends.
    rail_width = CONTRACT["frame"]["railWidthMetres"]
    profiles = {
        "brushed_black_metal": [(0, 0), (rail_width, 0), (rail_width, .036),
                               (rail_width - .003, .043), (.003, .043), (0, .039)],
        "brass_trim": [(.009, .043), (.019, .043), (.019, .0448),
                       (.0178, .046), (.0102, .046), (.009, .0448)],
    }
    for finish, profile in profiles.items():
        if kind == "corner":
            stations = (lambda u: (width / 2, u), lambda u: (u - width / 2, u),
                        lambda u: (u - width / 2, height))
        elif kind == "h":
            stations = (lambda u: (-width / 2, u), lambda u: (width / 2, u))
        else:
            stations = (lambda u: (u - width / 2, 0), lambda u: (u - width / 2, height))
        mesh.rings([[(*station(u), depth) for u, depth in profile] for station in stations], finish)


def cylinder(mesh, finish, radius, levels, *, x=0, depth=0, sides=20):
    # Cylinder along sign +Y. The visible emitter sits on the lower cap.
    mesh.rings([[(x + radius * cos(i * 2 * pi / sides), y,
                  depth + radius * sin(i * 2 * pi / sides)) for i in range(sides)]
                for y in levels], finish)


def downlight(mesh, width, height, depth):
    mesh.plate(width, height - .012, depth, "gunmetal", y=.012, radius=.008)
    cylinder(mesh, "gold_disc", .023, (.002, .015), depth=depth / 2)
    cylinder(mesh, "emissive_letter", .018, (0, .004), depth=depth / 2)


def bracket(mesh, width, height, depth):
    mesh.plate(.048, height, .019, "gunmetal", x=-(width - .048) / 2, radius=.006)
    mesh.plate(width - .014, .024, depth, "gunmetal", x=.007, y=.042, radius=.005)
    for y in (.011, .082):
        mesh.plate(.011, .011, .004, "silver_ring", x=-(width - .048) / 2,
                   y=y, z=.019, radius=.0047)


def blade(mesh, width, height, depth):
    mesh.plate(width, height, depth - .003, "brass_plate", z=.0015, radius=.028)
    mesh.plate(width - .018, height - .018, .0015, "lacquer_fascia",
               y=.009, z=depth - .0025, radius=.022)
    mesh.plate(width - .018, height - .018, .0015, "lacquer_fascia", y=.009, z=.001, radius=.022)
    for z in (0, depth - .001):
        mesh.plate(width - .039, height - .039, .001, "glass_panel", y=.0195, z=z, radius=.017)


def crescent(mesh, spec):
    """Flatten the one closed cubic path that defines the official yellow crescent."""
    root = ElementTree.parse(ROOT / spec["sourceArtwork"])
    candidates = [path for path in root.iter("{http://www.w3.org/2000/svg}path")
                  if path.get("d", "").startswith(spec["svgPathStartsWith"])]
    if len(candidates) != 1 or candidates[0].get("fill") != "#FFF200":
        raise ValueError("Expected exactly one yellow crescent path in the official artwork")
    tokens = re.findall(r"[A-Za-z]|[-+]?(?:\d*\.\d+|\d+)", candidates[0].get("d"))
    if tokens[0] != "M" or tokens[-1] != "z":
        raise ValueError("Unexpected crescent path endpoints")
    point = Vector(tuple(map(float, tokens[1:3])))
    outline = [point]
    index = 3
    command = None
    while index < len(tokens) - 1:
        if tokens[index] in ("c", "C"):
            command = tokens[index]
            index += 1
        if command is None:
            raise ValueError("Expected a cubic after the crescent move command")
        coordinates = list(map(float, tokens[index:index + 6]))
        origin = point if command == "c" else Vector((0, 0))
        a, b, end = [origin + Vector(coordinates[i:i + 2]) for i in (0, 2, 4)]
        flatten_cubic(point, a, b, end, spec["svgTolerance"], outline)
        point = end
        index += 6
    if (outline[0] - outline[-1]).length < 1e-5:
        outline.pop()
    lo_x, hi_x = min(p.x for p in outline), max(p.x for p in outline)
    lo_y, hi_y = min(p.y for p in outline), max(p.y for p in outline)
    _, height, depth = spec["sizeMetres"]
    scale = height / (hi_y - lo_y)
    contour = [Vector(((p.x - (hi_x + lo_x) / 2) * scale, (hi_y - p.y) * scale)) for p in outline]
    signed_area = sum(a.x * b.y - a.y * b.x for a, b in zip(contour, contour[1:] + contour[:1]))
    if signed_area < 0:
        contour.reverse()
    inset = []
    for i, current in enumerate(contour):
        edge_in, edge_out = current - contour[i - 1], contour[(i + 1) % len(contour)] - current
        normals = [Vector((-edge.y, edge.x)).normalized() for edge in (edge_in, edge_out)]
        # Cap the miter near the tip so the highlight cannot erase the point.
        direction = (normals[0] + normals[1]).normalized()
        distance = min(.0014, .0008 / max(.1, direction.dot(normals[0])),
                       .25 * min(edge_in.length, edge_out.length))
        inset.append(current + direction * distance)
    mesh.rings([[(p.x, p.y, z) for p in loop]
                for loop, z in ((contour, 0), (contour, depth - .0015), (inset, depth))],
               "emissive_letter")


def flatten_cubic(start, a, b, end, tolerance, result):
    delta = end - start
    if delta.length and max(abs(delta.cross(p - start)) / delta.length for p in (a, b)) <= tolerance:
        result.append(end)
        return
    first, middle, last = (start + a) / 2, (a + b) / 2, (b + end) / 2
    left, right = (first + middle) / 2, (middle + last) / 2
    midpoint = (left + right) / 2
    flatten_cubic(start, first, left, midpoint, tolerance, result)
    flatten_cubic(midpoint, right, last, end, tolerance, result)


def ivy(mesh, size):
    for branch in range(3):
        rings = []
        for i in range(10):
            t = i / 9
            x = t - .5
            y = (branch - 1) * .045 - (.18 - branch * .045) * sin(t * pi)
            z = .014 + branch * .004 + .008 * sin(2 * t * pi + branch)
            rings.append([(x, y + .003 * cos(j * 2 * pi / 5), z + .003 * sin(j * 2 * pi / 5))
                          for j in range(5)])
            if i == 0:
                continue
            angle = (i % 2 * 2 - 1) * (.86 + .2 * sin(i + branch))
            length = .084 + .017 * sin(i * 2 + branch)
            outline = [(0, -.34), (.26, -.43), (.58, -.29), (1, 0),
                       (.54, .24), (.28, .43), (0, .34), (.11, 0)]
            start = len(mesh.vertices)
            mesh.vertices.append((x + length * .32 * cos(angle), y + length * .32 * sin(angle), z + .016))
            mesh.vertices.extend((x + length * (u * cos(angle) - v * sin(angle)),
                                  y + length * (u * sin(angle) + v * cos(angle)), z + .006 + u * .008)
                                 for u, v in outline)
            for j in range(len(outline)):
                mesh.face((start, start + 1 + j, start + 1 + (j + 1) % len(outline)), "ivy_leaf")
        mesh.rings(rings, "timber_slat")
    low = [min(axis) for axis in zip(*mesh.vertices)]
    high = [max(axis) for axis in zip(*mesh.vertices)]
    mesh.vertices = [tuple((value - low[i]) * size[i] / (high[i] - low[i]) - (size[i] / 2 if i == 0 else 0)
                           for i, value in enumerate(vertex)) for vertex in mesh.vertices]


def build_objects(materials):
    objects = {}
    for name, spec in CONTRACT["models"].items():
        mesh = Mesh()
        width, height, depth = spec["sizeMetres"]
        match name.removeprefix("sign_"):
            case "frame_corner" | "frame_edge_h" | "frame_edge_v":
                trim(mesh, width, height, name.rsplit("_", 1)[-1])
            case "backplate" | "timber_slat":
                mesh.plate(width, height, depth, spec["materials"][0])
            case "downlight":
                downlight(mesh, width, height, depth)
            case "blade_bracket":
                bracket(mesh, width, height, depth)
            case "blade_panel":
                blade(mesh, width, height, depth)
            case "logo3d_new_moon":
                crescent(mesh, spec)
            case "ivy_swag":
                ivy(mesh, spec["sizeMetres"])
            case _:
                raise ValueError(f"Missing geometry builder for {name}")
        objects[name] = mesh.object(name, materials)
    return objects


def export_models(objects):
    MODELS.mkdir(parents=True, exist_ok=True)
    for name, obj in objects.items():
        bpy.ops.object.select_all(action="DESELECT")
        bpy.context.view_layer.objects.active = obj
        obj.select_set(True)
        bpy.ops.export_scene.gltf(filepath=str(MODELS / f"{name}.glb"), export_format="GLB",
                                  use_selection=True, export_yup=True, export_normals=True,
                                  export_texcoords=False, export_extras=False, export_animations=False)


def arrange_sources(objects):
    for index, obj in enumerate(objects.values()):
        obj.location = blender_point(((index % 5 - 2) * 1.18, -(index // 5) * .82, 0))
    bpy.ops.object.select_all(action="DESELECT")
    bpy.context.preferences.filepaths.save_version = 0
    bpy.ops.wm.save_as_mainfile(filepath=str(SOURCES / "signage-kit.blend"), compress=True)


def aim(obj, target):
    obj.rotation_euler = (Vector(blender_point(target)) - obj.location).to_track_quat("-Z", "Y").to_euler()


def area(name, position, target, energy, color, size):
    light = bpy.data.lights.new(name, "AREA")
    light.energy, light.color, light.size = energy, color, size
    obj = bpy.data.objects.new(name, light)
    bpy.context.collection.objects.link(obj)
    obj.location = blender_point(position)
    aim(obj, target)


def start_preview(name, location, target, scale, resolution):
    scene = bpy.context.scene
    scene.render.engine = "CYCLES"
    scene.cycles.device = "CPU"
    scene.cycles.samples = 24
    scene.cycles.use_denoising = True
    scene.world = bpy.data.worlds.new(name)
    scene.world.use_nodes = True
    scene.world.node_tree.nodes.get("Background").inputs["Color"].default_value = (.24, .26, .24, 1)
    scene.world.node_tree.nodes.get("Background").inputs["Strength"].default_value = .30
    scene.view_settings.view_transform = "AgX"
    scene.render.resolution_x, scene.render.resolution_y = resolution
    camera = bpy.data.objects.new("Review camera", bpy.data.cameras.new("Review camera"))
    bpy.context.collection.objects.link(camera)
    camera.data.type = "ORTHO"
    camera.data.ortho_scale = scale
    camera.location = blender_point(location)
    aim(camera, target)
    scene.camera = camera
    scene.render.image_settings.file_format = "PNG"
    scene.render.filepath = str(RENDERS / f"{name}.png")
    return scene


def reset_scene():
    bpy.ops.wm.read_factory_settings(use_empty=True)
    scene = bpy.context.scene
    scene.unit_settings.system = "METRIC"
    scene.unit_settings.scale_length = 1.0


def import_models():
    meshes = {}
    finishes = {}
    for name in CONTRACT["models"]:
        bpy.ops.import_scene.gltf(filepath=str(MODELS / f"{name}.glb"))
        obj, = bpy.context.selected_objects
        if obj.name != name or obj.type != "MESH":
            raise ValueError(f"Invalid Blender reimport for {name}")
        for i, finish in enumerate(obj.data.materials):
            obj.data.materials[i] = finishes.setdefault(finish.name.split(".")[0], finish)
        meshes[name] = obj.data
        bpy.data.objects.remove(obj, do_unlink=True)
    return meshes


def instance(meshes, name, location, *, scale=(1, 1, 1), roll=0, yaw=0):
    obj = bpy.data.objects.new(name, meshes[name])
    bpy.context.collection.objects.link(obj)
    obj.location = blender_point(location)
    obj.scale = scale[0], scale[2], scale[1]
    obj.rotation_euler = (0, -roll, yaw)
    return obj


def frame(meshes, width, height, base, depth=0):
    corner = CONTRACT["frame"]["cornerMetres"]
    rail = CONTRACT["frame"]["railWidthMetres"]
    nominal_w, nominal_h, _ = CONTRACT["nominalFasciaMetres"]
    instance(meshes, "sign_backplate", (0, base, depth), scale=(width / nominal_w, height / nominal_h, 1))
    for x, y, angle in ((-width / 2 + corner / 2, 0, 0),
                        (width / 2, corner / 2, pi / 2),
                        (width / 2 - corner / 2, height, pi),
                        (-width / 2, height - corner / 2, 3 * pi / 2)):
        instance(meshes, "sign_frame_corner", (x, base + y, depth), roll=angle)
    for y, angle in ((0, 0), (height, pi)):
        instance(meshes, "sign_frame_edge_h", (0, base + y, depth), roll=angle,
                 scale=((width - 2 * corner) / (nominal_w - 2 * corner), 1, 1))
    for x, y, angle in ((-width / 2 + rail / 2, corner, 0), (width / 2 - rail / 2, height - corner, pi)):
        instance(meshes, "sign_frame_edge_v", (x, base + y, depth), roll=angle,
                 scale=(1, (height - 2 * corner) / (nominal_h - 2 * corner), 1))


def preview_text(text, x, y, z, height, finish, font=None, align="CENTER"):
    curve = bpy.data.curves.new(text, "FONT")
    curve.body, curve.align_x = text, align
    if font:
        curve.font = font
    curve.materials.append(finish)
    obj = bpy.data.objects.new(text, curve)
    bpy.context.collection.objects.link(obj)
    obj.location = blender_point((x, y, z))
    obj.rotation_euler.x = pi / 2
    bpy.context.view_layer.update()
    corners = [corner[1] for corner in obj.bound_box]
    obj.scale = (height / (max(corners) - min(corners)),) * 3
    return obj


def preview_plate(width, height, depth, finish, *, x=0, y=0, z=0, radius=.009):
    mesh = Mesh()
    mesh.plate(width, height, depth, finish.name, x=x, y=y, z=z, radius=radius)
    mesh.object(finish.name, {finish.name: finish})


def render_lineup():
    reset_scene()
    meshes = import_models()
    scene = start_preview("kit-lineup", (.95, 1.63, 8.6), (0, .91, 0), 7.13, (1600, 630))
    stone = material("Preview limestone", {"color": "#B3A28F", "metallic": 0, "roughness": .62})
    label = material("Preview cream", {"color": "#FFF0CC", "metallic": .04, "roughness": .5, "emission": .4})
    shadow = material("Preview backing", {"color": "#302922", "metallic": 0, "roughness": .56})
    preview_plate(8, 4, .13, shadow, y=-.52, z=-.21)
    preview_plate(6.26, 1.18, .09, stone, y=.72, z=-.08)
    frame(meshes, 6.0, .9, .83)
    instance(meshes, "sign_logo3d_new_moon", (-1.66, 1.08, .038), scale=(1.35, 1.35, 1))
    # The exported mark is separate from this flat storefront name sample.
    serif = bpy.data.fonts.load(str(FONT))
    title = preview_text("New Moon", .25, 1.095, .038, .49, label, serif)
    x_probe = preview_text("x", 0, 0, 0, 1, label, serif)
    lettering = json.loads((MODELS / "presets.json").read_text(encoding="utf-8"))["lettering"]
    x_height = max(lettering["targetXHeightMetres"], title.scale.x / x_probe.scale.x)
    title.scale = (x_height * x_probe.scale.x,) * 3
    bpy.data.objects.remove(x_probe, do_unlink=True)
    for x in (-2.33, -1.16, 0, 1.16, 2.33):
        instance(meshes, "sign_downlight", (x, 1.75, 0))
        area("Warm fixture wash", (x, 1.82, .33), (x, 1.48, .03), 8, (1, .71, .42), .16)
    samples = [
        ("sign_backplate", -2.58, "Fascia"), ("sign_frame_corner", -1.57, "Corner"),
        ("sign_frame_edge_h", -.67, "Rails"), ("sign_downlight", .34, "Downlight"),
        ("sign_blade_bracket", 1.14, "Blade mount"), ("sign_blade_panel", 1.98, "Blade panel"),
        ("sign_ivy_swag", 2.69, "Timber & ivy"),
    ]
    for x in (2.58, 2.69, 2.80):
        instance(meshes, "sign_timber_slat", (x, .22, -.03), scale=(1, .48, 1))
    for name, x, caption in samples:
        height = CONTRACT["models"][name]["sizeMetres"][1] * .81
        instance(meshes, name, (x, .36 - height / 2, 0), scale=(.81, .81, .81))
        preview_text(caption, x, .035, 0, .064, label)
    instance(meshes, "sign_frame_edge_v", (-.66, .40, 0), scale=(.81, .49, .81), roll=pi / 2)
    area("Warm key", (-2.6, 3.4, 3.5), (0, 1, 0), 375, (1, .80, .60), 3.0)
    area("Soft fill", (2.6, 1.7, 3.0), (0, .95, 0), 180, (1, .88, .77), 3.0)
    area("Brass bounce", (0, -.57, 1.5), (0, 1.28, 0), 95, (1, .79, .47), 2.4)
    bpy.ops.render.render(write_still=True, scene=scene.name)
    viewport = lettering["referenceViewportCssPx"]
    # Mirror the expanded portrait camera framing in assets/player.js.
    half_fov_tangent = min(tan(radians(50)), max(tan(radians(34)), tan(radians(30)) * viewport[1] / viewport[0]))
    css_sizes = {str(distance): round(viewport[1] * x_height / (2 * distance * half_fov_tangent), 2)
                 for distance in (6, 9, lettering["referenceDistanceMetres"], 15)}
    return {"viewportCssPx": viewport, "xHeightMetres": round(x_height, 4), "xHeightCssPxByDistanceMetres": css_sizes}


def render_relief():
    reset_scene()
    meshes = import_models()
    scene = start_preview("new-moon-relief", (.54, .55, 1.38), (0, .32, 0), .91, (1120, 850))
    shadow = material("Preview backing", {"color": "#191E1B", "metallic": 0, "roughness": .5})
    preview_plate(2, 1.5, .13, shadow, y=-.4, z=-.16)
    frame(meshes, .72, .55, .05)
    instance(meshes, "sign_logo3d_new_moon", (0, .15, .039), scale=(1.10, 1.10, 1))
    area("Warm graze", (-.52, .77, .35), (0, .34, .045), 30, (1, .66, .35), .38)
    area("Warm reflection", (.40, .51, .47), (0, .34, .045), 19, (1, .85, .53), .48)
    area("Soft bounce", (.03, -.06, .49), (0, .34, .045), 5, (.88, .91, 1), .33)
    bpy.ops.render.render(write_still=True, scene=scene.name)


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--skip-renders", action="store_true")
    args = parser.parse_args(sys.argv[sys.argv.index("--") + 1:] if "--" in sys.argv else [])
    reset_scene()
    materials = {name: material(name, spec) for name, spec in CONTRACT["materials"].items()}
    objects = build_objects(materials)
    export_models(objects)
    manifest = collect_manifest()
    (MODELS / "manifest.json").write_text(json.dumps(manifest, indent=2) + "\n", encoding="utf-8")
    arrange_sources(objects)
    if not args.skip_renders:
        RENDERS.mkdir(parents=True, exist_ok=True)
        projection = render_lineup()
        render_relief()
        evidence = {
            "blender": bpy.app.version_string,
            "renderer": "Cycles CPU, AgX, 24 samples with denoising",
            "lineupFasciaMetres": [6.0, .9, .055],
            "letteringProjectionEstimate": projection,
            "glbSha256": {asset["file"]: asset["sha256"] for asset in manifest["assets"]},
            "pngSha256": {name: hashlib.sha256((RENDERS / name).read_bytes()).hexdigest()
                          for name in ("kit-lineup.png", "new-moon-relief.png")},
        }
        (RENDERS / "evidence.json").write_text(json.dumps(evidence, indent=2) + "\n", encoding="utf-8")


if __name__ == "__main__":
    main()
