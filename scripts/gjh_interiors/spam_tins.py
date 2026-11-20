"""Unprinted SPAM 340 g display specimens in slot-local metres."""
from math import cos, pi, sin, tau

SHELF_TOP = .899
SHELF_DEPTH = -3.92
SAMPLES = (
    ("SPAM Classic 340 g", "494e55", -.83),
    ("SPAM Lite 340 g", "98958d", -.64),
    ("SPAM Less Sodium 340 g", "666e69", -.45),
)
ROLL = "c6a351"
PANEL = "a88943"
TAB = "e1c681"
PANEL_HEIGHT = .079

# The 100 × 56 × 83 mm display envelope is nominal. The offsets and
# corner curvature are modelled for silhouette, without a seam undercut.
PROFILE = (
    (.050, .028, 0),
    (.047, .025, .004),
    (.047, .025, .074),
    (.049, .027, .079),
    (.050, .028, .083),
    (.044, .022, PANEL_HEIGHT),
)


def add_spam_tin(mesh, pigment, x, y, z, *, include_base=True):
    """Append the shell and open tab to the existing painted mesh batch."""
    def outline(half_width, half_depth, height):
        points = []
        for corner in range(4):
            cx = .038 if corner in (0, 3) else -.038
            cz = .016 if corner < 2 else -.016
            for step in range(5):
                angle = corner * pi / 2 + step * pi / 8
                points.append((x + cx + (half_width - .038) * cos(angle),
                               y + height,
                               z + cz + (half_depth - .016) * sin(angle)))
        return points

    def tab_loop(half_width, half_depth, height, offset):
        return [(x + offset + half_width * cos(angle), y + height, z + half_depth * sin(angle))
                for angle in (i * tau / 8 for i in range(8))]

    def band(lower, upper, colour):
        for i in range(len(lower)):
            j = (i + 1) % len(lower)
            mesh.face((lower[j], lower[i], upper[i], upper[j]), colour)

    # Five 20-sided bands, the lid and three eight-sided tab bands use
    # 266 triangles per shelf specimen. The shelf hides the optional base.
    rings = [outline(*section) for section in PROFILE]
    if include_base:
        mesh.face(rings[0], ROLL)
    for lower, upper, colour in zip(rings, rings[1:], (ROLL, pigment, ROLL, ROLL, ROLL)):
        band(lower, upper, colour)
    mesh.face(rings[-1][::-1], PANEL)

    tab_height = PANEL_HEIGHT + .0025
    outer_base = tab_loop(.017, .009, PANEL_HEIGHT, -.021)
    outer_top = tab_loop(.017, .009, tab_height, -.021)
    inner_top = tab_loop(.0115, .0055, tab_height, -.019)
    inner_base = tab_loop(.0115, .0055, PANEL_HEIGHT, -.019)
    band(outer_base, outer_top, TAB)
    band(outer_top, inner_top, TAB)
    band(inner_top, inner_base, TAB)
