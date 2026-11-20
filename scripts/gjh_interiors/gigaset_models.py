"""S17 cordless phones in slot coordinates (+Y up, +Z toward visitors)."""
from math import cos, pi, radians, sin, tau

from mesh import CRAFT


ISLAND_TOP = 1.15
A170_POSITION = (-.32, ISLAND_TOP, -.63)
COMFORT_POSITION = (.32, ISLAND_TOP, -.63)

# Handset profiles are in mm, counterclockwise from the lower left in front view.
A170_OUTLINE = (
    (-9, 0), (9, 0), (15, 1.0), (18.5, 2.8), (21, 6), (22, 10),
    (23, 20), (24, 67), (24, 135), (23.7, 141), (22.5, 148),
    (20.5, 152), (18, 155), (14.5, 157.1), (10, 158.4), (0, 159),
    (-10, 158.4), (-14.5, 157.1), (-18, 155), (-20.5, 152), (-22.5, 148),
    (-23.7, 141), (-24, 135), (-24, 67), (-23, 20), (-22, 10), (-21, 6),
    (-18.5, 2.8), (-15, 1.0),
)
COMFORT_OUTLINE = (
    (-17, 0), (17, 0), (23, 2), (25.5, 7), (26, 16), (26, 146),
    (24.8, 154), (21, 158.5), (15, 161), (-15, 161), (-21, 158.5),
    (-24.8, 154), (-26, 146), (-26, 16), (-25.5, 7), (-23, 2),
)
# Depth, width scale, end inset, finish on the band leading into each ring.
A170_SHELL = (
    (-13.5, .83, 3.4, "242526"),
    (0, 1, 0, "202123"),
    (9, .98, .8, "18191b"),
    (13, .88, 3, "262729"),
)
COMFORT_SHELL = (
    (-13, .89, 2, "242526"),
    (0, 1, 0, "1d1e21"),
    (7, .98, .6, "202225"),
    (10, .91, 1.8, "73777a"),
)

# Base plan uses (x, -z), so the rear of the deck has positive plan depth.
A170_DOCK = (-23, 23, -31, 7, 34)
COMFORT_DOCK = (-50.75, 1.75, -29, 10, 32.5)
ANSWER_PANEL = (5, 47, -21, 26, 39.5)
KEY_GRID = (("1", "2", "3"), ("4", "5", "6"), ("7", "8", "9"), ("*", "0", "#"))


def _mm_faces(face):
    def draw(points, color):
        face([(x / 1000, y / 1000, z / 1000) for x, y, z in points], color)
    return draw


def _rect(x, y, width, height, corner=0):
    left, right = x - width / 2, x + width / 2
    low, high = y - height / 2, y + height / 2
    if not corner:
        return [(left, low), (right, low), (right, high), (left, high)]
    return [
        (left + corner, low), (right - corner, low),
        (right, low + corner), (right, high - corner),
        (right - corner, high), (left + corner, high),
        (left, high - corner), (left, low + corner),
    ]


def _join(draw, first, second, color):
    for i in range(len(first)):
        draw((first[i - 1], first[i], second[i], second[i - 1]), color)


def _rounded_rect(x, y, width, height, radius):
    left, right = x - width / 2 + radius, x + width / 2 - radius
    low, high = y - height / 2 + radius, y + height / 2 - radius
    return [[(cx + radius * cos(start + i * pi / 6),
              cy + radius * sin(start + i * pi / 6)) for i in range(4)]
            for cx, cy, start in ((right, low, -pi / 2), (right, high, 0),
                                  (left, high, pi / 2), (left, low, pi))]


def _relief(draw, plan, back, front, color, edge, *, bevel=0, on_deck=False):
    """Draw a raised cap with its underside embedded in the mounting face."""
    cx = sum(x for x, _ in plan) / len(plan)
    cy = sum(y for _, y in plan) / len(plan)

    def ring(depth, scale):
        outline = [(cx + (x - cx) * scale, cy + (y - cy) * scale) for x, y in plan]
        return [(x, depth, -y) if on_deck else (x, y, depth) for x, y in outline]

    outer, cap = ring(back, 1), ring(front, 1 - bevel)
    _join(draw, outer, cap, edge)
    draw(cap, color)


def _shell_rings(outline, shell):
    height = max(y for _, y in outline)
    return [
        [(x * scale, inset + y * (height - 2 * inset) / height, z) for x, y in outline]
        for z, scale, inset, _ in shell
    ]


def _handset(draw, outline, shell, face_color):
    rings = _shell_rings(outline, shell)
    draw(rings[0][::-1], shell[0][3])
    for back, front, (_, _, _, color) in zip(rings, rings[1:], shell[1:]):
        _join(draw, back, front, color)
    draw(rings[-1], face_color)
    return 1 + len(outline) * (len(rings) - 1)


def _display(draw, plan, depth, color):
    draw([(x, y, depth) for x, y in plan], color)


def _dial_pad(draw, *, pitch, top, row_step, size, surface, crown, corner=0):
    # The regular grid follows the physical key order; the caps carry no glyphs.
    for row, digits in enumerate(KEY_GRID):
        for column, _ in enumerate(digits):
            key = _rect((column - 1) * pitch, top - row * row_step, *size, corner)
            _relief(draw, key, surface, crown, "414244", "202123", bevel=.14)


def add_a170_handset(face):
    draw = _mm_faces(face)
    curved_end = _handset(draw, A170_OUTLINE, A170_SHELL, "343537")
    receiver = [(8.7 * cos(i * tau / 10), 138.5 + 8.7 * sin(i * tau / 10))
                for i in range(10)]
    _relief(draw, receiver, 12.9, 14.15, "212224", "151618", bevel=.13)

    _display(draw, _rect(0, 108, 36, 24), 13.06, "5e5342")
    _display(draw, _rect(0, 108, 34, 22), 13.1, "e7b652")
    for x in (-9.4, 9.4):
        _relief(draw, _rect(x, 81, 17.5, 4.5), 12.9, 15,
                "424346", "191a1c", bevel=.13)
    for x in (-14, 0, 14):
        width = 12 if x else 12.7
        crown = 16.5 if x else 16.45
        _relief(draw, _rect(x, 68, width, 13, 2.1), 12.9, crown,
                "333437" if x else "3d3e40", "191a1b", bevel=.19)
    _display(draw, _rect(0, 68, 9.5, .7), 16.5, "242527")
    _dial_pad(draw, pitch=12.1, top=54, row_step=10.15, size=(9.6, 7.4),
              surface=12.9, crown=16.2, corner=1.9)
    _display(draw, _rect(0, 8.3, 10, .9), 13.05, "18191a")
    return curved_end


def add_comfort_handset(face):
    draw = _mm_faces(face)
    curved_end = _handset(draw, COMFORT_OUTLINE, COMFORT_SHELL, "292b2d")
    _display(draw, _rect(0, 115.8, 45, 79, 2.5), 10.15, "939799")
    _display(draw, _rect(0, 115.8, 42, 76, 2), 10.2, "1c1f21")
    _display(draw, _rect(0, 105.5, 35, 44), 10.25, "2d353a")
    _display(draw, _rect(0, 148, 12, 1.7), 10.25, "555b5e")

    for x, width in ((-15, 13), (0, 10), (15, 13)):
        _relief(draw, _rect(x, 77.4, width, 4), 9.99, 11.95,
                "6a6e71" if x else "54595d", "1c1e21", bevel=.07)
    _display(draw, _rect(0, 64, 43, 18, 3.2), 10.25, "36393c")
    for x in (-15.6, 15.6):
        _relief(draw, _rect(x, 64, 10.1, 14.5), 10.24, 12.45,
                "424649", "232528", bevel=.12)
    _relief(draw, _rect(0, 64, 17.7, 15.2, 2.7), 10.24, 12.5,
            "969a9c", "35393c", bevel=.07)
    _relief(draw, _rect(0, 64, 13.8, 11.5, 1.8), 12.49, 13,
            "34373a", "575b60", bevel=.09)
    _dial_pad(draw, pitch=13.3, top=48.4, row_step=10, size=(10.9, 7.7),
              surface=9.99, crown=12.1)
    _display(draw, _rect(0, 8.1, 10.5, 1.1), 10.12, "16181a")
    return curved_end


def _base(draw, rings, pockets, deck_color):
    """Build a closed base shell and partition the flat deck around its wells."""
    arcs = [_rounded_rect(0, 0, w, d, corner) for _, w, d, corner, _ in rings]
    outlines = [sum(corners, []) for corners in arcs]
    levels = [[(x, level, -v) for x, v in outline]
              for (level, _, _, _, _), outline in zip(rings, outlines)]
    draw(levels[0][::-1], rings[0][4])
    for lower, upper, (_, _, _, _, color) in zip(levels, levels[1:], rings[1:]):
        _join(draw, lower, upper, color)

    near_right, far_right, far_left, near_left = arcs[-1]
    y = rings[-1][0]
    draw([(x, y, -v) for x, v in far_left + near_left], deck_color)
    draw([(x, y, -v) for x, v in near_right + far_right], deck_color)

    def patch(left, right, low, high):
        draw([(x, y, -v) for x, v in
              ((left, low), (right, low), (right, high), (left, high))], deck_color)

    cursor, near, far = near_left[-1][0], near_left[-1][1], far_left[0][1]
    for left, right, low, high, floor in pockets:
        patch(cursor, left, near, far)
        patch(left, right, near, low)
        patch(left, right, high, far)
        mouth = ((left, low), (right, low), (right, high), (left, high))
        top = [(x, y, -v) for x, v in mouth]
        bottom = [(x, floor, -v) for x, v in mouth]
        _join(draw, top, bottom, "202224")
        draw(bottom, "151719")
        cursor = right
    patch(cursor, near_right[0][0], near, far)
    return 1 + len(outlines[0]) * (len(rings) - 1)


def add_a170_base(face):
    return _base(_mm_faces(face), (
        (0, 70, 70, 13, "191a1b"),
        (4, 77, 77, 14, "191a1b"),
        (22, 89, 89, 16.5, "1d1e20"),
        (24, 89, 89, 16.5, "101113"),
        (35, 84, 86, 15, "17181a"),
        (43, 62, 72, 7, "202123"),
    ), (A170_DOCK,), "202123")


def add_comfort_base(face):
    draw = _mm_faces(face)
    curved_end = _base(draw, (
        (0, 106, 85, 10, "191a1b"),
        (6, 116, 93, 12, "1d1f21"),
        (15, 123, 99, 14, "222426"),
        (17, 123, 99, 14, "131416"),
        (34, 120, 96, 11, "1d1f20"),
        (43, 116, 91, 7, "252627"),
    ), (COMFORT_DOCK, ANSWER_PANEL), "252627")

    # Manual p. 5: volume down/up and paging above back/forward/delete.
    for v in (19.8, 8.2):
        for x in (12.6, 26, 39.4):
            _relief(draw, _rect(x, v, 11.2, 8.8), 39.49, 42.55,
                    "55595b", "252729", bevel=.13, on_deck=True)
    _relief(draw, _rect(19.2, -8.1, 23.3, 16.6), 39.49, 40.25,
            "3d443a", "1e201f", on_deck=True)
    _relief(draw, _rect(39.4, -8.1, 11.2, 16.6), 39.49, 42.7,
            "4f5355", "252729", bevel=.12, on_deck=True)
    return curved_end


def _seat(position, dock, outline, shell, tilt):
    _, _, near, far, floor = dock
    lowest = min(y * cos(tilt) + z * sin(tilt)
                 for ring in _shell_rings(outline, shell) for _, y, z in ring)
    x = position[0] + (dock[0] + dock[1]) / 2000
    return x, position[1] + (floor - lowest) / 1000, position[2] - (near + far) / 2000


A170_TILT = radians(9)
COMFORT_TILT = radians(7)
PARTS = (
    ("Gigaset A170 cradle", add_a170_base, A170_POSITION, 0),
    ("Gigaset A170 handset", add_a170_handset,
     _seat(A170_POSITION, A170_DOCK, A170_OUTLINE, A170_SHELL, A170_TILT), A170_TILT),
    ("Gigaset COMFORT 550A answering base", add_comfort_base, COMFORT_POSITION, 0),
    ("Gigaset COMFORT 550A handset", add_comfort_handset,
     _seat(COMFORT_POSITION, COMFORT_DOCK, COMFORT_OUTLINE, COMFORT_SHELL, COMFORT_TILT),
     COMFORT_TILT),
)


def add_gigaset(room):
    """Append both seated sets to the room's existing painted batch."""
    def place(draw, origin, tilt):
        x, y, z = origin
        c, s = cos(tilt), sin(tilt)

        def placed(points, color):
            room.face([(x + u, y + v * c + w * s, z + w * c - v * s)
                       for u, v, w in points], color)

        return draw(placed)

    ranges = []
    for _, draw, origin, tilt in PARTS:
        start = len(room.batches[CRAFT].faces)
        ranges.append((start + 1, start + place(draw, origin, tilt)))
    return ranges
