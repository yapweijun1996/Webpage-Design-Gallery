"""Unprinted S10 California Mexico Abalone 454 g tins in slot-local metres."""
from math import cos, hypot, sin, tau

SHELF_TOP = 2.1125
SHELF_DEPTH = -4.070
SAMPLES = (
    ("Red California Mexico Abalone 454 g", "bc2026", -2.69),
    ("Black California Mexico Abalone 454 g", "191819", -1.51),
)
ROLL = "c2ae79"
LID = "a79976"
SIDES = 16

# The photos support the proportions. The diameter, height and seam section
# are display estimates pending measurements of the matching tins.
PROFILE = (
    (.0375, 0),
    (.0358, .004),
    (.0358, .115),
    (.0375, .120),
    (.0335, .117),
)


def add_california_mexico_tin(mesh, pigment, x, y, z, *, include_base=True):
    """Append a straight shell, rolled rims and recessed lid to a painted batch."""
    rings = [
        [(x + radius * cos(angle), y + height, z + radius * sin(angle))
         for angle in (i * tau / SIDES for i in range(SIDES))]
        for radius, height in PROFILE
    ]
    if include_base:
        mesh.face(rings[0], ROLL)
    first_band = len(mesh.faces)
    for lower, upper, colour in zip(rings, rings[1:], (ROLL, pigment, ROLL, ROLL)):
        for i in range(SIDES):
            j = (i + 1) % SIDES
            mesh.face((lower[j], lower[i], upper[i], upper[j]), colour)
    mesh.face(rings[-1][::-1], LID)
    return first_band


def smooth_california_mexico_tins(obj, first_bands):
    """Smooth each circumference while preserving the seam profile breaks."""
    data = obj.data
    normals = [(0.0, 0.0, 0.0)] * len(data.loops)
    for row, ((r0, y0), (r1, y1)) in enumerate(zip(PROFILE, PROFILE[1:])):
        dr, dy = r1 - r0, y1 - y0
        length = hypot(dr, dy)
        ring = [(dy / length * cos(a), -dy / length * sin(a), -dr / length)
                for a in (i * tau / SIDES for i in range(SIDES))]
        for start in first_bands:
            for i in range(SIDES):
                j = (i + 1) % SIDES
                face = data.polygons[start + row * SIDES + i]
                face.use_smooth = True
                pos = face.loop_start
                normals[pos:pos + 4] = (ring[j], ring[i], ring[i], ring[j])
    data.normals_split_custom_set(normals)
