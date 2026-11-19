"""Unprinted S04 exhibit packs in room coordinates, with Y up and +Z forward."""

from math import cos, pi, sin

# Patch display dimensions are staging estimates in metres. The catalogue
# envelope does not establish the individual carton, pouch or sheet dimensions.
PATCH_CARTON = (.136, .246, .023)
PATCH_POUCH = (.110, .174, .012)
PATCH_BACKING = (.104, .001, .120)
LINGZHI_CARTON = (.073, .104, .054)
LINGZHI_PAIR_WIDTH = .150

APRICOT = "d4a172"
PAPER = "f0e1c5"


def _prism(face, x, width, profile, colours, ends):
    """Extrude a counterclockwise (Y, Z) profile across X."""
    left = [(x - width / 2, y, z) for y, z in profile]
    right = [(x + width / 2, y, z) for y, z in profile]
    face(left[::-1], ends)
    face(right, ends)
    for i, colour in enumerate(colours):
        j = (i + 1) % len(profile)
        face((left[i], left[j], right[j], right[i]), colour)


def _carton(face, x, z, width, height, depth, body, top):
    back, front = z - depth / 2, z + depth / 2
    profile = ((0, back), (height, back), (height, front), (0, front))
    _prism(face, x, width, profile, (body, top, body, body), body)


def _hanger(face, width, bottom, top, z):
    middle = (bottom + top) / 2
    half = width / 2
    outer = ((half, middle), (half, top), (-half, top),
             (-half, middle), (-half, bottom), (half, bottom))
    # Opposed rings and the inner wall leave a clear 47 x 12 mm opening.
    tip, shoulder, rise = .0235, .0175, .006
    hole = ((tip, middle), (shoulder, middle + rise), (-shoulder, middle + rise),
            (-tip, middle), (-shoulder, middle - rise), (shoulder, middle - rise))
    front, cut_front, back, cut_back = [
        [(u, v, depth) for u, v in loop]
        for depth in (z + .0015, z - .0015) for loop in (outer, hole)
    ]
    for i in range(len(outer)):
        j = (i + 1) % len(outer)
        face((front[i], front[j], cut_front[j], cut_front[i]), APRICOT)
        face((back[j], back[i], cut_back[i], cut_back[j]), APRICOT)
        face((front[j], front[i], back[i], back[j]), APRICOT)
        face((cut_front[i], cut_front[j], cut_back[j], cut_back[i]), "b48960")


def _patch(face, x, y, z):
    half, radius = .016, .004
    inset = half - radius
    cap = []
    for quarter, (u, v) in enumerate(((inset, inset), (inset, -inset),
                                       (-inset, -inset), (-inset, inset))):
        for sample in range(3):
            angle = (2 - 2 * quarter - sample) * pi / 4
            cap.append((x + u + radius * cos(angle), y + .0016,
                        z + v + radius * sin(angle)))
    face(cap, "d8bc94")


def add_borsch_patch_pack(mesh, x=-.89, y=1.153, z=-.23):
    """Append to a craft Mesh. Origin is the carton centre at support height.

    Return part names mapped to face ranges for the editable model helper.
    """
    def face(points, colour):
        mesh.face([(x + u, y + v, z + w) for u, v, w in points], colour)

    parts = {}
    start = len(mesh.faces)
    width, height, depth = PATCH_CARTON
    body_height = height - .046
    _carton(face, 0, 0, width, body_height, depth, APRICOT, APRICOT)
    _hanger(face, width - .020, body_height, height, depth / 2 - .005)
    parts["Patch carton"] = range(start, len(mesh.faces))

    start = len(mesh.faces)
    width, height, depth = PATCH_POUCH
    pouch_z = .025
    back, front = pouch_z - depth / 2, pouch_z + depth / 2
    seam = height - .012
    profile = ((0, back), (seam, back), (height, pouch_z), (seam, front), (0, front))
    _prism(face, .30, width, profile, ("dfba92", PAPER, PAPER, "dfba92", "dfba92"), "dfba92")
    parts["Sealed patch pouch"] = range(start, len(mesh.faces))

    start = len(mesh.faces)
    sheet_x, sheet_z = .53, .010
    width, height, depth = PATCH_BACKING
    left, right = sheet_x - width / 2, sheet_x + width / 2
    back, front = sheet_z - depth / 2, sheet_z + depth / 2
    # The ledge supports the sheet, so only the top and near edge are modeled.
    face(((left, height, back), (left, height, front),
          (right, height, front), (right, height, back)), PAPER)
    face(((left, height, front), (left, 0, front),
          (right, 0, front), (right, height, front)), PAPER)
    parts["Patch backing paper"] = range(start, len(mesh.faces))
    for row, v in enumerate((.038, 0, -.038), 1):
        for column, u in enumerate((-.022, .022), 1):
            start = len(mesh.faces)
            _patch(face, sheet_x + u, height, sheet_z + v)
            parts[f"Patch row {row} column {column}"] = range(start, len(mesh.faces))
    return parts


def add_borsch_lingzhi_pair(mesh, x=0.0, y=0.0, z=0.0, *, yaw=0.0):
    """Append to a craft Mesh. Origin is the pair centre at support height.

    The cartons face +Z at yaw zero and -X at yaw -pi/2. Return named face ranges.
    """
    cosine, sine = cos(yaw), sin(yaw)

    def face(points, colour):
        mesh.face([(x + u * cosine + w * sine, y + v, z - u * sine + w * cosine)
                   for u, v, w in points], colour)

    width, height, depth = LINGZHI_CARTON
    offset = (LINGZHI_PAIR_WIDTH - width) / 2
    parts = {}
    for i, u in enumerate((-offset, offset), 1):
        start = len(mesh.faces)
        _carton(face, u, 0, width, height, depth, PAPER, "bba270")
        parts[f"Lingzhi carton {i}"] = range(start, len(mesh.faces))
    return parts
