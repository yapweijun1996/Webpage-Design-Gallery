"""Unprinted S11 HORMEL Chili 15 oz tins in slot-local metres."""
from math import cos, hypot, sin, tau

from mesh import CRAFT

SHELF_TOP = 2.1125
PLACEHOLDER_Y = 2.113
SHELF_DEPTH = -4.070
SAMPLES = (
    ("HORMEL Chili No Beans 15 oz", "b72931", -2.42),
    ("HORMEL Chili With Beans 15 oz", "aa2933", -1.24),
)
SILVER = "b8c3cc"
GOLD = "c3a558"
LID = "ad9358"
SIDES = 24

# Display envelope inferred from the front views. Seam sections and lid depth
# are simplified because the photos do not resolve the closure tooling.
PROFILE = (
    (.0375, 0),
    (.0364, .0025),
    (.0364, .114),
    (.0375, .117),
    (.0345, .1155),
)
CIRCLE = tuple((cos(i * tau / SIDES), sin(i * tau / SIDES)) for i in range(SIDES))


def add_hormel_chili_tin(mesh, pigment, x, y, z, *, include_base=True):
    """Append one can and return the index of its first seam face."""
    rings = [
        [(x + radius * u, y + height, z + radius * v) for u, v in CIRCLE]
        for radius, height in PROFILE
    ]
    if include_base:
        mesh.face(rings[0], SILVER)
    first_band = len(mesh.faces)
    for lower, upper, colour in zip(rings, rings[1:], (SILVER, pigment, GOLD, GOLD)):
        for i in range(SIDES):
            j = (i + 1) % SIDES
            mesh.face((lower[j], lower[i], upper[i], upper[j]), colour)
    mesh.face(rings[-1][::-1], LID)
    return first_band


def add_hormel_chili_tins(room):
    """Append both shelf specimens to the existing painted batch."""
    mesh = room.batches[CRAFT]
    return tuple(
        add_hormel_chili_tin(mesh, pigment, x, SHELF_TOP, SHELF_DEPTH, include_base=False)
        for _, pigment, x in SAMPLES
    )


def smooth_hormel_chili_tins(obj, first_bands):
    """Smooth around the sides and retain the profile breaks at the seams."""
    data = obj.data
    normals = [(0.0, 0.0, 0.0)] * len(data.loops)
    for row, ((r0, y0), (r1, y1)) in enumerate(zip(PROFILE, PROFILE[1:])):
        dr, dy = r1 - r0, y1 - y0
        length = hypot(dr, dy)
        # Mesh.face maps room (+Y up, +Z out) into Blender (+Z up, -Y out).
        ring = [(dy * u / length, -dy * v / length, -dr / length) for u, v in CIRCLE]
        for start in first_bands:
            for i in range(SIDES):
                face = data.polygons[start + row * SIDES + i]
                face.use_smooth = True
                j = (i + 1) % SIDES
                pos = face.loop_start
                normals[pos:pos + 4] = (ring[j], ring[i], ring[i], ring[j])
    data.normals_split_custom_set(normals)
