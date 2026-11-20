"""Stand-free S14 LG OLED55C5PSA in metres, with +Y up and +Z front."""
from math import cos, pi, sin

from mesh import CRAFT

LG_OLED_NAME = "LG OLED55C5PSA"
LG_OLED_POSITION = (2.34, 1.70, -3.928)
WIDTH, HEIGHT, DEPTH = 1.222, .703, .0451

GLASS = "101419"
EDGE = "272b30"
BACKPLATE = "2d2d30"
HOUSING = "242529"
RECESS_WALL = "191a1c"
RECESS_FLOOR = "111214"


def _outline(half_width, bottom, top, clip, z):
    """Return a clipped rectangle wound toward the front."""
    x = half_width
    return (
        (-x + clip, bottom, z), (x - clip, bottom, z),
        (x, bottom + clip, z), (x, top - clip, z),
        (x - clip, top, z), (-x + clip, top, z),
        (-x, top - clip, z), (-x, bottom + clip, z),
    )


def _rear_rect(left, right, bottom, top, z):
    return ((right, bottom, z), (left, bottom, z), (left, top, z), (right, top, z))


def add_lg_oled(room, origin=LG_OLED_POSITION):
    """Append the television to the painted batch and return named face starts."""
    mesh = room.batches[CRAFT]
    ox, oy, oz = origin
    parts = {}

    def part(name):
        parts[name] = len(mesh.faces)

    def face(points, pigment):
        mesh.face([(x + ox, y + oy, z + oz) for x, y, z in points], pigment)

    def band(outer, inner, pigment):
        for i in range(len(outer)):
            j = (i + 1) % len(outer)
            face((outer[i], outer[j], inner[j], inner[i]), pigment)

    def recess(cell, opening, depth):
        floor = [(x, y, z + depth) for x, y, z in opening]
        band(cell, opening, HOUSING)
        band(opening, floor, RECESS_WALL)
        return floor

    half_width, half_height, half_depth = WIDTH / 2, HEIGHT / 2, DEPTH / 2
    rim_z = half_depth - .0015
    panel_back_z = half_depth - .0065
    rim = _outline(half_width, -half_height, half_height, .002, rim_z)
    back = _outline(half_width, -half_height, half_height, .002, panel_back_z)
    glass = _outline(half_width - .003, -half_height + .004,
                     half_height - .003, .001, half_depth)

    part("Inactive display glass")
    face(glass, GLASS)
    part("Display edge and thin panel backing")
    band(rim, glass, EDGE)
    band(back, rim, EDGE)

    # Join the exposed upper backing directly to the stepped lower housing.
    housing_x, housing_top, rear_z = .488, .160, -half_depth
    shoulder = _outline(housing_x - .004, -half_height + .002,
                        housing_top - .004, .010, panel_back_z)
    step = _outline(housing_x, -half_height, housing_top, .010, panel_back_z - .006)
    lip = _outline(housing_x, -half_height, housing_top, .010, rear_z + .004)
    rear = _outline(housing_x - .004, -half_height + .004,
                    housing_top - .004, .008, rear_z)
    band(back[::-1], shoulder[::-1], BACKPLATE)
    part("Stepped electronics housing")
    band(shoulder[::-1], step[::-1], HOUSING)
    band(step[::-1], lip[::-1], HOUSING)
    band(lip[::-1], rear[::-1], HOUSING)

    left, bottom, _ = rear[0]
    right, top, _ = rear[4]
    face((rear[4], rear[3], rear[2], rear[1]), HOUSING)
    face((rear[0], rear[7], rear[6], rear[5]), HOUSING)

    # Each recess replaces its patch of the back face, leaving real inset walls.
    def mount(x, y, cell_left, cell_right, lower, upper):
        cell = _rear_rect(cell_left, cell_right, lower, upper, rear_z)
        angles = [-pi / 4 - i * pi / 4 for i in range(8)]
        opening = [(x + .003 * cos(t), y + .003 * sin(t), rear_z) for t in angles]
        for i in range(4):
            j = (i + 1) % 4
            face((cell[i], cell[j], opening[2 * j], opening[2 * i + 1],
                  opening[2 * i]), HOUSING)
        floor = [(u, v, z + .0035) for u, v, z in opening]
        band(opening, floor, RECESS_WALL)
        face(floor, RECESS_FLOOR)

    previous = bottom
    for name, center, height, detail in (
        ("Lower rear relief", -.319, .030, "relief"),
        ("Central rear relief", -.220, .056, "relief-with-patch"),
        ("Horizontal vent", -.170, .036, "vent"),
        ("Lower VESA mounting points", -.125, .034, "mounts"),
        ("Upper VESA mounting points", .075, .034, "mounts"),
    ):
        lower, upper = center - height / 2, center + height / 2
        part(f"Rear casing below {name.lower()}")
        face(_rear_rect(left, right, previous, lower, rear_z), HOUSING)
        part(name)
        cell = _rear_rect(left, right, lower, upper, rear_z)

        if detail == "mounts":
            mount(-.150, center, left, 0, lower, upper)
            mount(.150, center, 0, right, lower, upper)
        elif detail == "vent":
            vent_left, vent_right = -.406, .406
            low, high = center - .015, center + .015
            opening = _rear_rect(vent_left, vent_right, low, high, rear_z)
            floor = recess(cell, opening, .002)
            strips = 21
            interval = (vent_right - vent_left) / strips
            for i in range(strips):
                start = vent_left + i * interval
                end = vent_right if i == strips - 1 else vent_left + (i + 1) * interval
                pigment = RECESS_FLOOR if i % 2 == 0 else RECESS_WALL
                face(_rear_rect(start, end, low, high, floor[0][2]), pigment)
        elif detail == "relief-with-patch":
            # The rear photo shows a light rectangular patch to the right of the recess.
            split = -.105
            relief = _rear_rect(-.040, .040, center - .019, center + .019, rear_z)
            face(recess(_rear_rect(split, right, lower, upper, rear_z), relief, .004), RECESS_FLOOR)
            patch = _rear_rect(-.253, -.135, center - .024, center + .024, rear_z)
            band(_rear_rect(left, split, lower, upper, rear_z), patch, HOUSING)
            face(patch, "4b4b4e")
        else:
            opening = _rear_rect(-.040, .040, lower + .005, upper - .005, rear_z)
            face(recess(cell, opening, .004), RECESS_FLOOR)
        previous = upper

    part("Rear casing above upper VESA mounts")
    face(_rear_rect(left, right, previous, top, rear_z), HOUSING)
    return parts
