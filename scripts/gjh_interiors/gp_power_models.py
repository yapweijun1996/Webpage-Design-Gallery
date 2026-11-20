"""S16 GP specimens on the existing plinth, with slot-local +Y up."""
from math import cos, hypot, sin, tau

from mesh import CRAFT, Room


PLINTH_TOP = 1.0525

AA_NAME = "GP Ultra+ GP15AUP AA"
AA_POSITION = (.978, PLINTH_TOP, -.11)
ETAG_NAME = "GP eTag White"
ETAG_POSITION = (1.13, PLINTH_TOP, 0)
CR2032_NAME = "GP CR2032"
CR2032_POSITION = (1.045, PLINTH_TOP, -.008)
SIDES = 24
ETAG_RELEASE_ROW = 1
ETAG_RELEASE_SECTOR = 5


def _lathe_mm(room: Room, origin, diameter, height, rings, colors):
    """Revolve a bottom-to-top profile of (radius, axial height) in mm."""
    radius = diameter / 2
    profile = [(r / radius, y / height) for r, y in rings]
    first_face = len(room.batches[CRAFT].faces)
    room.lathe(*origin, radius / 1000, height / 1000, profile, colors, n=SIDES)
    return first_face, rings, None


def add_aa(room: Room, origin=AA_POSITION):
    """Add the upright GP15AUP cell with its positive button up."""
    return _lathe_mm(room, origin, 14.5, 50.5, (
        (3.65, 0), (3.65, .20), (6.80, .20), (7.25, .70),
        (7.25, 48.65), (7.05, 49.18), (6.55, 49.40),
        (2.75, 49.40), (2.75, 50.31), (2.59, 50.50),
    ), (
        "bcc2c0", "4f5952", "67764e", "6c8150", "728653", "65774b",
        "a8afaa", "adb5b2", "c9cfcb", "d3d8d6",
    ))


def add_etag(room: Room, origin=ETAG_POSITION):
    """Add the closed white eTag with its contoured face up."""
    start, rings, _ = _lathe_mm(room, origin, 32, 8.3, (
        (13.9, 0), (16, 2.50), (16, 3.55), (15.75, 3.80),
        (16, 4.05), (15.6, 5.90), (13.9, 7.90), (11.9, 8.30),
        (9.3, 8.01),
    ), (
        "e9e9e6", "eeefed", "b8bcb9", "d7d9d6", "edefec", "f5f6f3",
        "f7f8f5", "eff1ee", "f5f6f4",
    ))
    side_face = start + ETAG_RELEASE_ROW * SIDES + ETAG_RELEASE_SECTOR
    return start, rings, _cut_etag_release(room.batches[CRAFT], side_face)


def _cut_etag_release(batch, side_face):
    """Replace one flat chord of the perimeter with a blind pocket."""
    bl, br, tr, tl = batch.faces[side_face]
    left, right, top = (batch.points[i] for i in (bl, br, tl))
    chord = hypot(right[0] - left[0], right[1] - left[1])
    ux, uy = (right[0] - left[0]) / chord, (right[1] - left[1]) / chord
    cx, cy, cz = ((a + b) / 2 for a, b in zip(right, top))

    # The GP Malaysia FAQ photo and Nordic TAGA drawing show the port.
    # Its 2.8 x 0.9 mm mouth and 82.5° azimuth (+X toward +Z) are estimates.
    # The 0.42 mm recess gives the exhibit a closed, shaded floor.
    radius = .00045
    straight_half = .00095
    diagonal = radius / 2**.5
    end = (
        (straight_half, -radius), (straight_half + diagonal, -diagonal),
        (straight_half + radius, 0), (straight_half + diagonal, diagonal),
        (straight_half, radius),
    )
    outline = end + tuple((-u, -v) for u, v in end)
    rim_start = len(batch.points)
    for width, height, depth, pigment in (
        (1, 1, 0, batch.colours[bl]),
        (.84, .72, .00042, "535650"),
    ):
        # Mesh points are already in Blender space. The inward vector is (-uy, ux).
        batch.points.extend(
            (cx + u * width * ux - depth * uy,
             cy + u * width * uy + depth * ux,
             cz + v * height)
            for u, v in outline
        )
        batch.colours.extend([pigment] * len(outline))
        batch.uvs.extend([(0, 1)] * len(outline))
    rim = tuple(range(rim_start, rim_start + len(outline)))
    floor = tuple(i + len(outline) for i in rim)

    batch.faces[side_face] = (bl, br, rim[0], rim[-1])
    first_surround = len(batch.faces)
    batch.faces.append((tr, tl, rim[5], rim[4]))
    for a, b, arc in ((br, tr, rim[:5]), (tl, bl, rim[5:])):
        near, lower, tip, upper, far = arc
        batch.faces.extend((
            (a, b, tip), (a, tip, lower), (a, lower, near),
            (b, far, upper), (b, upper, tip),
        ))
    end_surround = len(batch.faces)
    for i in range(len(rim)):
        j = (i + 1) % len(rim)
        batch.faces.append((rim[i], rim[j], floor[j], floor[i]))
    batch.faces.append(floor)
    return side_face, first_surround, end_surround


def add_cr2032(room: Room, origin=CR2032_POSITION):
    """Add a loose CR2032 with its broad unmarked face up."""
    return _lathe_mm(room, origin, 20, 3.2, (
        (8.45, 0), (8.45, .42), (10, .42), (10, 2.75), (9.55, 3.2),
    ), ("b8bfbe", "8a9494", "b5bdbf", "c9cecf", "d3d8d9"))


def smooth_gp_profiles(obj, profiles):
    """Smooth the circumference while retaining the rolled edges and case seam."""
    data = obj.data
    normals = [(0, 0, 0)] * len(data.loops)
    angles = [i * tau / SIDES for i in range(SIDES)]
    for start, rings, release in profiles:
        for row, ((r0, y0), (r1, y1)) in enumerate(zip(rings, rings[1:])):
            dr, dy = r1 - r0, y1 - y0
            length = hypot(dr, dy)
            ring = [(dy * cos(a) / length, -dy * sin(a) / length, -dr / length) for a in angles]
            for i in range(SIDES):
                j = (i + 1) % SIDES
                face_index = start + row * SIDES + i
                if release and face_index == release[0]:
                    _smooth_etag_release(data, normals, release, ring[j], ring[i])
                    continue
                face = data.polygons[face_index]
                face.use_smooth = True
                index = face.loop_start
                normals[index:index + 4] = (ring[j], ring[i], ring[i], ring[j])
    data.normals_split_custom_set(normals)


def _smooth_etag_release(data, normals, release, left_normal, right_normal):
    """Carry the original side shading over the shell polygons around the rim."""
    side_face, first, end = release
    left, right = (data.vertices[i].co for i in data.polygons[side_face].vertices[:2])
    dx, dy = right.x - left.x, right.y - left.y
    chord_squared = dx * dx + dy * dy
    for index in (side_face, *range(first, end)):
        face = data.polygons[index]
        face.use_smooth = True
        for loop, vertex in zip(face.loop_indices, face.vertices):
            point = data.vertices[vertex].co
            t = ((point.x - left.x) * dx + (point.y - left.y) * dy) / chord_squared
            normal = tuple(a + (b - a) * t for a, b in zip(left_normal, right_normal))
            length = hypot(*normal)
            normals[loop] = tuple(component / length for component in normal)
