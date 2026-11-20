"""S13 Sony audio specimens in metres, with local +Y up and +Z front."""
from collections import defaultdict
from math import cos, pi, sin, tau

from mathutils import Vector

from mesh import CRAFT

WALKMAN_NAME = "Sony NW-A306 Walkman"
HEADPHONES_NAME = "Sony WH-1000XM6 Headphones"
WALKMAN_POSITION = (-3.05, 1.004, .10)
HEADPHONES_POSITION = (-3.05, .9775, .48)
AISLE_YAW = pi / 2

CASE = "343639"
REAR = "2b2d30"
RECESS = "101113"


class Specimen:
    """Send the same local faces to an editable or placed painted batch."""

    def __init__(self, room, origin, yaw):
        self.room = room
        self.mesh = room.batches[CRAFT]
        self.origin = origin
        self.yaw = yaw
        self.cos = cos(yaw)
        self.sin = sin(yaw)
        self.parts = {}

    def part(self, name):
        self.parts[name] = len(self.mesh.faces)

    def place(self, x, y, z):
        ox, oy, oz = self.origin
        return ox + x * self.cos + z * self.sin, oy + y, oz - x * self.sin + z * self.cos

    def face(self, points, pigment):
        self.mesh.face([self.place(*point) for point in points], pigment)

    def box(self, x, y, z, width, height, depth, pigment):
        self.room.box(*self.place(x, y, z), width, height, depth, pigment, yaw=self.yaw)

    def band(self, first, second, pigment):
        for i in range(len(first)):
            j = (i + 1) % len(first)
            self.face((first[i], first[j], second[j], second[i]), pigment)


def add_walkman(room, origin=(0, 0, 0), yaw=0):
    """Add the case, front glass, right-side controls and recessed hardware."""
    model = Specimen(room, origin, yaw)
    half_width, half_depth = .02785, .0059
    bevel, bottom, top = .00085, .0002, .0984
    x, z = half_width - bevel, half_depth - bevel
    outline = ((-x, half_depth), (x, half_depth), (half_width, z),
               (half_width, -z), (x, -half_depth), (-x, -half_depth),
               (-half_width, -z), (-half_width, z))
    lower = [(u, bottom, v) for u, v in outline]
    upper = [(u, top, v) for u, v in outline]
    model.part("Chamfered chassis")
    for i in (0, 1, 2, 3, 5, 6, 7):
        j = (i + 1) % len(outline)
        model.face((lower[i], lower[j], upper[j], upper[i]), CASE)
    model.face(upper, CASE)

    model.part("Rear panel and grip grooves")
    rear_z = -half_depth
    mic_low, mic_high = .083, .086
    # The grooves share the rear panel surface, with an inset bottom and sloped banks.
    heights = [(bottom, rear_z)]
    for center in (.039, .044):
        groove = ((center - .00065, rear_z), (center - .00026, rear_z + .00030),
                  (center + .00026, rear_z + .00030), (center + .00065, rear_z))
        heights.extend(groove)
        model.face([(-x, y, z) for y, z in groove], REAR)
        model.face([(x, y, z) for y, z in reversed(groove)], REAR)
    heights.append((mic_low, rear_z))
    for (y0, z0), (y1, z1) in zip(heights, heights[1:]):
        model.face(((x, y0, z0), (-x, y0, z0), (-x, y1, z1), (x, y1, z1)), REAR)
    model.face(((x, mic_high, rear_z), (-x, mic_high, rear_z),
                (-x, top, rear_z), (x, top, rear_z)), REAR)

    model.part("Rear microphone recess")
    rim = ((x, mic_low, rear_z), (-x, mic_low, rear_z),
           (-x, mic_high, rear_z), (x, mic_high, rear_z))
    mic = ((.00068, .0839), (-.00068, .0839), (-.00068, .0851), (.00068, .0851))
    opening = [(u, v, rear_z) for u, v in mic]
    inset = [(u * .73, .0845 + (v - .0845) * .73, rear_z + .0007) for u, v in mic]
    model.band(rim, opening, REAR)
    model.band(opening, inset, "1b1c1e")
    model.face(inset, RECESS)

    model.part("Front glass")
    glass = ((-.0250, .0120), (.0250, .0120), (.0250, .0938), (-.0250, .0938))
    frame = [(u, v, half_depth - .00032) for u, v in glass]
    pane = [(u * .973, .0529 + (v - .0529) * .983, half_depth) for u, v in glass]
    front = (lower[0], lower[1], upper[1], upper[0])
    model.band(front, frame, CASE)
    model.band(frame, pane, "181b20")
    model.face(pane, "252a33")

    # Right side ordered top to bottom as viewed from the front.
    for name, cy, height in (
        ("Power", .086, .0048), ("Volume up", .074, .0048),
        ("Volume down", .067, .0048), ("Next", .054, .0044),
        ("Play", .0465, .0060), ("Previous", .039, .0044), ("Hold", .024, .0080),
    ):
        model.part(name)
        y0, y1 = cy - height / 2, cy + height / 2
        rim = ((half_width, y0, .0016), (half_width, y0, -.0016),
               (half_width, y1, -.0016), (half_width, y1, .0016))
        button = ((.02865, y0 + .00065, .0010), (.02865, y0 + .00065, -.0010),
                  (.02865, y1 - .00065, -.0010), (.02865, y1 - .00065, .0010))
        model.band(rim, button, "42454b")
        model.face(button, "53565e")

    model.part("Bottom case chamfers")
    model.face((lower[4], lower[3], lower[2], lower[1]), CASE)
    model.face((lower[0], lower[7], lower[6], lower[5]), CASE)

    # Each cell bridges the visible bottom face to an opening with a recessed floor.
    for name, left, right, center, rx, rz, depth, sides, cover in (
        ("Headphone jack", -x, -.013, -.020, .00205, .00205, .0022, 8, False),
        ("Strap loop opening", -.013, -.005, -.009, .00165, .00105, .0018, 4, False),
        ("USB-C port", -.005, .008, .001, .00425, .00138, .0020, 8, False),
        ("microSD cover", .008, x, .017, .00765, .00158, .00050, 4, True),
    ):
        model.part(name)
        corners = ((left, half_depth), (left, -half_depth),
                   (right, -half_depth), (right, half_depth))
        if sides == 8:
            corners = tuple(point for i, a in enumerate(corners)
                            for point in (a, tuple((u + v) / 2
                                                   for u, v in zip(a, corners[(i + 1) % 4]))))
        edge = [(u, bottom, v) for u, v in corners]
        mouth = [(-cos(t), sin(t)) for t in (tau * i / sides - pi / 4 for i in range(sides))]
        opening = [(center + rx * u, bottom, -rz * v) for u, v in mouth]
        inset = [(center + rx * .83 * u, bottom + depth, -rz * .83 * v) for u, v in mouth]
        model.band(edge, opening, CASE)
        model.band(opening, inset, "202125")
        model.face(inset, RECESS)
        if cover:
            lid = [(center + rx * .75 * u, 0, -rz * .75 * v) for u, v in mouth]
            foot = [(u, bottom + depth, v) for u, _, v in lid]
            model.band(foot, lid, "37393c")
            model.face(lid, "424449")
    return model.parts


def add_headphones(room, origin=(0, 0, 0), yaw=0):
    """Add the Sand Pink headphones and their separate gallery plinth."""
    model = Specimen(room, origin, yaw)
    outer, edge, cushion = "bda4ab", "a78d96", "967e88"
    model.part("Tapered headband and underside padding")
    section = ((-1, 0), (-.76, -1), (.76, -1), (1, 0), (.76, 1), (-.76, 1))
    arch = []
    for i in range(17):
        theta = pi * i / 16
        crown = sin(theta)
        cx, cy = .075 * cos(theta), .133 + .076 * crown
        half_span = .010 + .008 * crown
        ring = []
        for across, radial in section:
            thickness = .004 + (.005 if radial < 0 else .002) * crown
            ring.append((cx + radial * thickness * cos(theta),
                         cy + radial * thickness * crown, across * half_span))
        arch.append(ring)
    model.face(arch[0][::-1], edge)
    for a, b in zip(arch, arch[1:]):
        for i in range(len(section)):
            j = (i + 1) % len(section)
            pigment = cushion if i < 3 else outer
            model.face((a[i], a[j], b[j], b[i]), pigment)
    model.face(arch[-1], edge)

    for side, label in ((-1, "Left"), (1, "Right")):
        # Splay the ovals slightly so the face and cushion edge read from the aisle.
        def oval(axis, height, ry, rz, count):
            return [(side * (.061 + .971 * axis - .239 * rz * sin(t)),
                     height + ry * cos(t),
                     .239 * axis + .971 * rz * sin(t))
                    for t in (tau * i / count for i in range(count))]

        def cup_band(a, b, pigment):
            if side == 1:
                model.band(b, a, pigment)
            else:
                model.band(a, b, pigment)

        model.part(f"{label} cup shell and inset pad")
        profile = (
            (.028, .72, "c3adb4"), (.025, .87, outer), (.017, .974, outer),
            (.006, 1, edge), (-.003, .96, "9a808b"), (-.018, .91, cushion),
            (-.023, .75, "876e7b"), (-.013, .57, "554850"),
        )
        rings = [oval(axis, .058, .050 * scale, .040 * scale, 16)
                 for axis, scale, _ in profile]
        for a, b, (_, _, pigment) in zip(rings, rings[1:], profile):
            cup_band(a, b, pigment)
        model.face(rings[0] if side == 1 else rings[0][::-1], profile[0][2])
        model.face(rings[-1][::-1] if side == 1 else rings[-1], "493e45")

        model.part(f"{label} slider and folding hinge")
        model.box(side * .075, .123, 0, .010, .027, .015, "aa909a")
        hinge_base = oval(.009, .108, .010, .010, 8)
        hinge_face = oval(.018, .108, .008, .008, 8)
        cup_band(hinge_face, hinge_base, edge)
        model.face(hinge_face if side == 1 else hinge_face[::-1], outer)
        model.face(hinge_base[::-1] if side == 1 else hinge_base, edge)

    model.part("Gallery plinth")
    model.box(0, .004, 0, .184, .008, .094, "51433e")
    return model.parts


def add_sony_audio_models(room):
    """Append only the two cabinet specimens to the existing Enamel batch."""
    add_walkman(room, WALKMAN_POSITION, AISLE_YAW)
    return add_headphones(room, HEADPHONES_POSITION, AISLE_YAW)


def smooth_headphones(obj, parts):
    """Share normals across joined shell faces without rounding the narrow hinge."""
    data = obj.data
    data.update()
    normals = [(0, 0, 0)] * len(data.loops)
    ordered = list(parts.items())
    for (name, start), (_, stop) in zip(ordered, ordered[1:]):
        if "cup shell" not in name and "headband" not in name:
            continue
        faces = data.polygons[start:stop]
        adjacent = defaultdict(list)
        for face in faces:
            for vertex in face.vertices:
                adjacent[tuple(data.vertices[vertex].co)].append(face.normal.copy())
        for face in faces:
            face.use_smooth = True
            for index in face.loop_indices:
                coordinate = tuple(data.vertices[data.loops[index].vertex_index].co)
                nearby = (normal for normal in adjacent[coordinate] if face.normal.dot(normal) > .48)
                normals[index] = sum(nearby, Vector()).normalized()
    data.normals_split_custom_set(normals)
