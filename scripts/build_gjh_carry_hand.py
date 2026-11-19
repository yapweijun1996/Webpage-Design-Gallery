"""Bake the modular chibi's cylindrical grip for the GJH first-person camera.

Run with Blender 5.1 in background mode. On macOS the process-local launcher
in docs/gjh-v11-signage-assets.md also works for this builder.
"""
from math import atan2, cos, hypot, pi, radians, sin
from pathlib import Path

import bmesh
import bpy
from mathutils import Matrix, Vector

ASSETS = Path(__file__).resolve().parents[1] / "demos/corporate/gjh/v11/assets"
SOURCE = ASSETS / "chibi-crowd"
# Cylinder measured by the modular chibi's hand_grip_small_R authoring fixture.
CENTER = Vector((-.303460, -.010269, .520307))
UP = Vector((-.41036, -.91192, 0)).normalized()
RIGHT = Vector((0, 0, 1))
FRONT = RIGHT.cross(UP)
SCALE = .0775 / .040
CUT = -.234


def grip_point(point):
    local = (point - CENTER) * SCALE
    x, y, z = local.dot(RIGHT), local.dot(UP), local.dot(FRONT)
    # Retain contact with the can while reducing the bulk of the enlarged chibi
    # knuckles. Turn the distal fingers around the barrel and oppose the thumb.
    gauge = .0775 / 2
    radius = hypot(x, z)
    arc = atan2(z, x) - radians(45 + 65 * max(0, -z / radius))
    forearm = min(1, max(0, (point.x + .270) / (CUT + .270)))
    excess = radius - gauge
    pad = excess / (1 + max(0, excess) / .028)
    fitted = gauge + (1 - forearm) * pad + forearm * .54 * excess
    return Vector((fitted * cos(arc), -fitted * sin(arc),
                   y * .63 - .024 - .055 * forearm))


def fit_digits(body, rig, posed):
    # The source grip fits a short 40 mm gauge. Retain each digit's authored
    # cross sections and rounded tip as its centreline wraps the taller tin.
    influences = {}
    frames = {}
    for digit, height, end_angle in (("Index", .023, -232), ("Middle", .002, -236),
                                    ("Ring", -.019, -228), ("Pinky", -.039, -215),
                                    ("Thumb", .008, 73)):
        prefix = "mixamorig:RightHand" + digit
        names = [prefix + str(i) for i in range(1, 5)]
        groups = {body.vertex_groups[name].index for name in names}
        for index in groups:
            influences[index] = digit
        start = rig.matrix_world @ rig.data.bones[names[0]].head_local
        direction = ((rig.matrix_world @ rig.data.bones[names[-1]].head_local) - start).normalized()
        across = Vector((0, 0, 1)).cross(direction).normalized()
        dorsal = direction.cross(across)
        extent = max((v.co - start).dot(direction) for v in body.data.vertices
                     if any(w.group in groups and w.weight > .5 for w in v.groups))
        knuckle = grip_point(rig.matrix_world @ rig.pose.bones[names[0]].head)
        angle = atan2(-knuckle.y, knuckle.x)
        frames[digit] = start, direction, across, dorsal, extent, knuckle, angle, radians(end_angle), height

    positions = {}
    for rest, current in zip(body.data.vertices, posed.data.vertices):
        weights = {}
        for group in rest.groups:
            digit = influences.get(group.group)
            if digit:
                weights[digit] = weights.get(digit, 0) + group.weight
        if not weights:
            continue
        point = grip_point(current.co)
        fitted = point * max(0, 1 - sum(weights.values()))
        for digit, weight in weights.items():
            start, forward, across, dorsal, extent, knuckle, a0, a1, height = frames[digit]
            delta = rest.co - start
            t = min(1, max(0, delta.dot(forward) / extent))
            blend = min(1, t / .36)
            blend = blend * blend * (3 - 2 * blend)
            angle = a0 + (a1 - a0) * t
            pad_radius = .048 if digit == "Thumb" else .046
            radius = (1 - blend) * hypot(knuckle.x, knuckle.y) + blend * pad_radius
            radius += delta.dot(dorsal) * (-1 if digit == "Thumb" else 1)
            elevation = (1 - blend) * knuckle.z + blend * height + delta.dot(across) * 1.06
            if digit == "Thumb":
                elevation += .005 * sin(pi * t)
            surface = Vector((radius * cos(angle), -radius * sin(angle), elevation))
            # Feather the web into the existing baked palm at each knuckle.
            fitted += weight * point.lerp(surface, min(1, t / .18))
        positions[tuple(current.co)] = fitted
    return positions


def material(name, rgb):
    mat = bpy.data.materials.new(name)
    mat.use_nodes = True
    shader = mat.node_tree.nodes.get("Principled BSDF")
    def linear(c):
        v = c / 255
        return ((v + .055) / 1.055) ** 2.4 if v > .04045 else v / 12.92
    shader.inputs["Base Color"].default_value = (*map(linear, rgb), 1)
    shader.inputs["Roughness"].default_value = .85
    mat.use_backface_culling = True
    return mat


def surface(name, bm, mat):
    bmesh.ops.recalc_face_normals(bm, faces=list(bm.faces))
    bm.verts.index_update()
    mesh = bpy.data.meshes.new(name)
    # The static export owns only the posed surface, without the body's deform
    # weights, custom normals, UV seams or shape attributes.
    mesh.from_pydata([v.co.copy() for v in bm.verts], [],
                     [[v.index for v in face.verts] for face in bm.faces], shade_flat=False)
    bm.free()
    mesh.update()
    obj = bpy.data.objects.new(name, mesh)
    bpy.context.collection.objects.link(obj)
    mesh.materials.append(mat)
    return obj


def bake_hand():
    bpy.ops.import_scene.gltf(filepath=str(SOURCE / "base_body.glb"))
    body, rig = bpy.data.objects["Base_Body"], bpy.data.objects["Armature"]
    bpy.ops.import_scene.gltf(filepath=str(SOURCE / "hand_gestures.glb"))
    for bone in rig.pose.bones:
        bone.matrix_basis = Matrix.Identity(4)
    action = bpy.data.actions["hand_grip_small_R"]
    rig.animation_data_create().action = action
    rig.animation_data.action_slot = action.slots[0]
    bpy.context.scene.frame_set(1)
    evaluated = body.evaluated_get(bpy.context.evaluated_depsgraph_get())
    fingers = fit_digits(body, rig, evaluated)
    bm = bmesh.new()
    bm.from_mesh(evaluated.data)
    bm.transform(evaluated.matrix_world)
    # Crop in the posed body's space. Weld UV seams before closing the wrist.
    bmesh.ops.delete(bm, geom=[v for v in bm.verts if v.co.x > -.18 or not .44 < v.co.z < .64], context="VERTS")
    bmesh.ops.remove_doubles(bm, verts=list(bm.verts), dist=.000002)
    bmesh.ops.bisect_plane(bm, geom=[*bm.verts, *bm.edges, *bm.faces], dist=.000001,
                           plane_co=(CUT, 0, 0), plane_no=(1, 0, 0), clear_outer=True)
    boundary = [edge for edge in bm.edges if edge.is_boundary]
    assert boundary and all(abs(v.co.x - CUT) < .00001 for e in boundary for v in e.verts)
    ring = [v.co.copy() for v in bm.verts if v.is_boundary]
    bmesh.ops.holes_fill(bm, edges=boundary)
    for v in bm.verts:
        v.co = fingers.get(tuple(v.co), grip_point(v.co))
    hand = surface("ChibiGrip", bm, material("Visitor skin", (250, 204, 177)))
    # Fuse the finger webs after bending around the can. Retopologize this solid
    # before reducing it so thin, folded triangles cannot survive at the thumb.
    bpy.context.view_layer.objects.active = hand
    volume = hand.modifiers.new("Continuous finger webs", "REMESH")
    volume.mode = "VOXEL"
    volume.voxel_size = .0022
    volume.use_smooth_shade = True
    bpy.ops.object.modifier_apply(modifier=volume.name)
    smooth = hand.modifiers.new("Round pads", "SMOOTH")
    smooth.factor = .85
    smooth.iterations = 5
    bpy.ops.object.modifier_apply(modifier=smooth.name)
    hand.data.calc_loop_triangles()
    modifier = hand.modifiers.new("Grip silhouette", "DECIMATE")
    modifier.ratio = 504 / len(hand.data.loop_triangles)
    bpy.ops.object.modifier_apply(modifier=modifier.name)
    return hand, ring


def sleeve(ring):
    bm = bmesh.new()
    y0, y1 = min(p.y for p in ring), max(p.y for p in ring)
    z0, z1 = min(p.z for p in ring), max(p.z for p in ring)
    cy, cz = (y0 + y1) / 2, (z0 + z1) / 2
    ry, rz = (y1 - y0) / 2, (z1 - z0) / 2
    # The rounded hem encloses the cut. Extend only the cloth off the screen.
    loops = []
    for along, radius in [(-.008, 1.02), (-.006, 1.18), (-.001, 1.23), (.048, 1.43)]:
        loop = []
        for i in range(12):
            a = i * 2 * pi / 12
            p = grip_point(Vector((CUT, cy + radius * ry * cos(a), cz + radius * rz * sin(a))))
            p += Vector((along * 1.20, -along * 1.0, -along * 3.8))
            loop.append(bm.verts.new(p))
        loops.append(loop)
    for a, b in zip(loops, loops[1:]):
        for i in range(len(a)):
            bm.faces.new((a[i-1], a[i], b[i], b[i-1]))
    for loop in (loops[0], loops[-1]):
        bm.faces.new(loop)
    return surface("SleeveCuff", bm, material("Visitor purple cotton", (90, 66, 104)))


def main():
    bpy.ops.wm.read_factory_settings(use_empty=True)
    hand, ring = bake_hand()
    cuff = sleeve(ring)
    bpy.ops.object.select_all(action="DESELECT")
    for obj in (hand, cuff):
        obj.select_set(True)
    bpy.ops.export_scene.gltf(filepath=str(ASSETS / "visitor-carry-hand.glb"), use_selection=True,
                              export_animations=False, export_skins=False, export_texcoords=False,
                              export_vertex_color="NONE", export_yup=True)


if __name__ == "__main__":
    main()
