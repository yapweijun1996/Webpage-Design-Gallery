"""Unprinted Gu Long 256 g display studies in slot-local metres."""
from math import cos, hypot, sin, tau

SHELF_TOP = 1.083
SAMPLES = (
    ("Gu Long Stewed Pork Chops 256 g", "c79a42", -2.33, -1.82),
    ("Gu Long Stewed Pork 256 g", "ad5844", -2.33, -2.01),
)
ROLL = "b6a06c"
LID = "97896a"
TAB = "d5c5a0"
LID_HEIGHT = .0715
SIDES = 12

# Shared display estimate: 90 mm diameter by 75 mm high. The bottom is
# a simple support plane because the product photos do not show the bases.
PROFILE = (
    (.045, 0),
    (.042, .004),
    (.042, .070),
    (.045, .075),
    (.039, LID_HEIGHT),
)


def add_gulong_tin(mesh, pigment, x, y, z, *, include_base=True):
    """Append the rolled shell, recessed lid and open pull tab to one batch."""
    def loop(sides, rx, rz, height, offset=0):
        return [
            (x + offset + rx * cos(a), y + height, z + rz * sin(a))
            for a in (i * tau / sides for i in range(sides))
        ]

    def band(lower, upper, colour):
        for i in range(len(lower)):
            j = (i + 1) % len(lower)
            mesh.face((lower[j], lower[i], upper[i], upper[j]), colour)

    rings = [loop(SIDES, radius, radius, height) for radius, height in PROFILE]
    if include_base:
        mesh.face(rings[0], ROLL)
    first_band = len(mesh.faces)
    for lower, upper, colour in zip(rings, rings[1:], (ROLL, pigment, ROLL, ROLL)):
        band(lower, upper, colour)
    mesh.face(rings[-1][::-1], LID)

    # The inset lid shows through the ring. Only the raised outer tab edge
    # needs a sidewall in this 2.5 mm thick display study.
    outer_base = loop(6, .017, .010, LID_HEIGHT, .006)
    outer = loop(6, .017, .010, LID_HEIGHT + .0025, .006)
    inner = loop(6, .010, .006, LID_HEIGHT + .0025, .007)
    band(outer_base, outer, TAB)
    band(outer, inner, TAB)
    return first_band


def smooth_gulong_tins(obj, first_bands):
    """Smooth the circumference while preserving the roll and lid breaks."""
    data = obj.data
    normals = [(0.0, 0.0, 0.0)] * len(data.loops)
    for row, ((r0, y0), (r1, y1)) in enumerate(zip(PROFILE, PROFILE[1:])):
        dy, dr = y1 - y0, r1 - r0
        length = hypot(dy, dr)
        radial, axial = dy / length, -dr / length
        ring = tuple((radial * cos(i * tau / SIDES), -radial * sin(i * tau / SIDES), axial)
                     for i in range(SIDES))
        for start in first_bands:
            for i in range(SIDES):
                j = (i + 1) % SIDES
                face = data.polygons[start + row * SIDES + i]
                face.use_smooth = True
                pos = face.loop_start
                normals[pos:pos + 4] = (ring[j], ring[i], ring[i], ring[j])
    data.normals_split_custom_set(normals)
