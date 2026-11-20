"""S15 Casio instruments in metres, with local +Y up and +Z front."""
from math import cos, sin, tau

from mesh import CRAFT

CT_S1_NAME = "Casio CT-S1BK"
CT_S1_POSITION = (1.10, 1.28, -.59)
CT_S1_DIMENSIONS = (.930, .258, .083)
CT_S1_TEXTILE = "1d1e21"
GP_510_NAME = "Casio GP-510BP"
GP_510_POSITION = (1.55, .081, -4.00)
GP_510_DIMENSIONS = (1.434, .489, .963)


class _PaintedModel:
    def __init__(self, room, origin):
        self.mesh = room.batches[CRAFT]
        self.origin = origin
        self.parts = {}

    def part(self, name):
        self.parts[name] = len(self.mesh.faces)

    def face(self, points, pigment):
        ox, oy, oz = self.origin
        self.mesh.face([(x + ox, y + oy, z + oz) for x, y, z in points], pigment)

    def across(self, left, right, start, end, pigment):
        """Span an oriented side-profile edge across the width."""
        y0, z0 = start
        y1, z1 = end
        self.face(((left, y0, z0), (right, y0, z0),
                   (right, y1, z1), (left, y1, z1)), pigment)

    def profile(self, left, right, outline, pigments, cap):
        for start, end, pigment in zip(outline, outline[1:] + outline[:1], pigments):
            if pigment is not None:
                self.across(left, right, start, end, pigment)
        self.face([(left, y, z) for y, z in outline], cap)
        self.face([(right, y, z) for y, z in reversed(outline)], cap)


def add_ct_s1(room, origin=CT_S1_POSITION):
    """Add the CT-S1BK to the opaque painted batch and return named face starts."""
    model = _PaintedModel(room, origin)
    width, depth, height = CT_S1_DIMENSIONS
    x, z = width / 2, depth / 2
    case, strip = "101115", "141519"
    bed_front, bed_rear, bed_y = .117, -.023, .037
    strip_front_y, strip_back_y, speaker_front = .064, .070, -.054

    model.part("Beveled chassis and continuous textile speaker deck")
    outline = ((0, -.117), (0, .119), (.016, z),
               (bed_y, bed_front), (bed_y, bed_rear),
               (strip_front_y, bed_rear), (strip_back_y, speaker_front),
               (.073, -.119), (.059, -z))
    pigments = (None, "16171a", "1b1c21", "17181a", "262428",
                strip, CT_S1_TEXTILE, "24252a", case)
    widths = (x - .008, x - .024, x - .014, x - .014, x, x, x, x - .004, x - .011)
    sides = [[(side * w, y, z) for w, (y, z) in zip(widths, outline)] for side in (-1, 1)]
    left, right = sides
    for i, pigment in enumerate(pigments):
        if pigment is not None:
            j = (i + 1) % len(outline)
            model.face((left[i], right[i], right[j], left[j]), pigment)
    model.face(left, case)
    model.face(right[::-1], case)

    model.part("Tapered end cheeks")
    cheek_inner = .422
    for side in (-1, 1):
        outer_back = (side * x, strip_front_y, bed_rear)
        inner_back = (side * cheek_inner, strip_front_y, bed_rear)
        outer_tip = (side * (x - .014), bed_y, bed_front)
        inner_tip = (side * (cheek_inner + .012), bed_y, bed_front)
        inner_base = (side * cheek_inner, bed_y, bed_rear)
        # The chassis end cap already closes the outer face of this cheek.
        faces = (
            ((outer_tip, inner_tip, inner_back, outer_back), "191a1d"),
            ((inner_tip, inner_base, inner_back), "1d1e20"),
        )
        for points, pigment in faces:
            model.face(points if side < 0 else points[::-1], pigment)

    model.part("Red keybed felt")
    model.across(-cheek_inner, cheek_inner, (.047, bed_rear + .0005),
                 (.0505, bed_rear + .0005), "713135")

    model.part("White keys C2 through C7")
    pitch, gap = .02335, .00085
    key_front, key_back, key_top = .115, -.0227, .046
    for index in range(36):
        center = (index - 17.5) * pitch
        half_key = (pitch - gap) / 2
        left, right = center - half_key, center + half_key
        model.across(left, right, (bed_y, key_front), (key_top, key_front), "cac8c1")
        model.across(left, right, (key_top, key_front), (key_top, key_back), "f0eee8")

    model.part("Black keys across five octaves")
    # The sharps sit only after C, D, F, G and A in each complete octave.
    for octave in range(5):
        for after, offset in ((0, -.0014), (1, .0014), (3, -.0017), (4, 0), (5, .0017)):
            center = (7 * octave + after - 17) * pitch + offset
            left, right = center - .0054, center + .0054
            model.across(left, right, (key_top, .060), (.057, .059), "1b1c1e")
            model.across(left, right, (.057, .059), (.061, key_back), "26272a")

    def control_y(z_coord):
        fraction = (z_coord - bed_rear) / (speaker_front - bed_rear)
        return strip_front_y + fraction * (strip_back_y - strip_front_y)

    model.part("Volume knob")
    knob_x, knob_z = -.157, -.049
    angles = [i * tau / 6 for i in range(6)]
    knob_base_y = control_y(knob_z + .012)  # Seat the flat base in the sloped strip.
    base = [(knob_x + .012 * cos(a), knob_base_y,
             knob_z + .012 * sin(a)) for a in angles]
    top = [(knob_x + .010 * cos(a), height, knob_z + .010 * sin(a)) for a in angles]
    for i in range(len(angles)):
        j = (i + 1) % len(angles)
        model.face((base[j], base[i], top[i], top[j]), "212226")
    model.face(top[::-1], "414247")

    model.part("Unmarked control buttons")
    button_z = -.036
    # Centres from the CT-S1BK AR reference: power, four utilities, seven
    # main tones, and the separate tone variation button on the right.
    centers = (-.181, -.121, -.103, -.085, -.067, -.034, -.016,
               .002, .020, .038, .056, .074, .106)
    for center in centers:
        model.across(center - .005, center + .005,
                     (control_y(button_z + .004) + .0012, button_z + .004),
                     (control_y(button_z - .004) + .0006, button_z - .004),
                     "45464a" if center == centers[0] else "1c1d20")
    return model.parts


def add_gp_510(room, origin=GP_510_POSITION):
    """Add the closed GP-510BP to the opaque painted batch and return face starts."""
    model = _PaintedModel(room, origin)
    width, depth, height = GP_510_DIMENSIONS
    x, z = width / 2, depth / 2
    front, side, trim = "24252a", "191a1d", "37383e"
    cabinet_bottom = .682

    model.part("Cabinet, closed keyboard cover and closed top lid")
    outline = ((cabinet_bottom, -z), (cabinet_bottom, z - .007), (.714, z),
               (.871, .116), (.937, .116),
               (height, .097), (height, -z))
    model.profile(-x, x, outline,
                  ("141518", trim, "2c2d32", front, trim, "303138", side), side)

    model.part("Recessed rear panel")
    rear_inner = -z + .022
    stand_x = x - .013
    panel_inner = stand_x - .033
    for start, end, pigment in (
        ((.126, rear_inner), (cabinet_bottom, rear_inner), "1c1d21"),
        ((cabinet_bottom, -z), (0, -z), side),
    ):
        model.across(-panel_inner, panel_inner, start, end, pigment)

    model.part("Left and right side panels")
    for left, right in ((-stand_x, -panel_inner), (panel_inner, stand_x)):
        panel = ((0, -z), (0, -.083), (cabinet_bottom, -.083), (cabinet_bottom, -z))
        model.profile(left, right, panel, (None, "202126", None, side), side)

    model.part("Pedal crosspiece")
    rail_front = -.123
    model.across(-panel_inner, panel_inner, (0, rail_front), (.126, rail_front), front)
    model.across(-panel_inner, panel_inner, (.126, rail_front), (.126, rear_inner), trim)

    model.part("Slender front legs with brass toes")
    for left, right in ((-stand_x, -stand_x + .038), (stand_x - .038, stand_x)):
        near, far, toe_y, leg_top = .224, .173, .027, .686
        contour = ((left, near), (right, near), (right, far), (left, far))
        for i, (ax, az) in enumerate(contour):
            bx, bz = contour[(i + 1) % len(contour)]
            outside = 3 if left < 0 else 1
            split = toe_y if i in (0, outside) else 0
            model.face(((ax, split, az), (bx, split, bz),
                        (bx, leg_top, bz), (ax, leg_top, az)), front if i == 0 else side)
            if split:
                model.face(((ax, 0, az), (bx, 0, bz),
                            (bx, split, bz), (ax, split, az)), "aa894a" if i == 0 else "7d6636")

    for name, px, length in (("Left", -.063, .109), ("Center", 0, .101), ("Right", .063, .109)):
        model.part(f"{name} projecting brass pedal")
        heel = ((px - .013, .059, rail_front), (px + .013, .059, rail_front))
        tip_z = rail_front + length
        tip = ((px - .017, .041, tip_z), (px + .017, .041, tip_z))
        lower_heel = [(u, y - .010, v) for u, y, v in heel]
        lower_tip = [(u, y - .009, v) for u, y, v in tip]
        model.face((tip[0], tip[1], heel[1], heel[0]), "c6a56b")
        model.face((lower_tip[0], lower_tip[1], tip[1], tip[0]), "9c7b47")
        model.face((lower_heel[0], lower_tip[0], tip[0], heel[0]), "826436")
        model.face((lower_tip[1], lower_heel[1], heel[1], tip[1]), "a6844c")
    return model.parts
