"""Unprinted S12 Zeria shelf specimens in slot-local metres."""
from math import cos, hypot, sin, tau

from mesh import CRAFT

SHELF_TOP = 2.1125
SHELF_DEPTH = -4.04
CARTON_X, CHONDRO_X, LIVELY_X = -2.78, -2.68, -1.65
CARTON_NAME = "Chondro Max 300 Carton"
CARTON_WIDTH, CARTON_HEIGHT, CARTON_DEPTH = .104, .204, .060
CARTON_PIGMENT = "e8aa42"
SIDES = 28

# Body rings are (radius, height), from the heel to the underside of the cap.
CHONDRO = ((.039, 0), (.043, .008), (.043, .113), (.041, .128), (.035, .139), (.029, .147))
LIVELY = ((.041, 0), (.045, .010), (.045, .126), (.044, .140), (.040, .148), (.036, .152))
BOTTLES = (
    ("Chondro Max 300 Bottle", CHONDRO_X, CHONDRO, "e2e0cd", .0315, .026, "c8cc83", "e0dfaa"),
    ("Lively & Healthy 180 Bottle", LIVELY_X, LIVELY, "703b21", .039, .023, "dfb736", "ead266"),
)


def add_carton(room, x, y, z):
    room.box(x, y + CARTON_HEIGHT / 2, z, CARTON_WIDTH, CARTON_HEIGHT,
             CARTON_DEPTH, CARTON_PIGMENT)


def add_bottle(mesh, x, y, z, profile, body, cap_radius, cap_height,
               cap_edge, cap_top, *, editable=False):
    """Append a shoulder bottle and ribbed closure to one Pigment batch."""
    def ring(radius, height, rib=0):
        return [(x + (radius - rib * (i % 2)) * cos(tau * i / SIDES), y + height,
                 z + (radius - rib * (i % 2)) * sin(tau * i / SIDES))
                for i in range(SIDES)]

    def band(lower, upper, pigment, ribbed=False):
        for i in range(SIDES):
            j = (i + 1) % SIDES
            tone = cap_top if ribbed and i % 2 else pigment
            mesh.face((lower[j], lower[i], upper[i], upper[j]), tone)

    rings = [ring(radius, height) for radius, height in profile]
    body_start = len(mesh.faces)
    for lower, upper in zip(rings, rings[1:]):
        band(lower, upper, body)
    if editable:
        mesh.face(rings[0], body)

    base = profile[-1][1]
    cap = (
        rings[-1],
        ring(cap_radius, base + .002, .0009),
        ring(cap_radius, base + cap_height - .003, .0009),
        ring(cap_radius - .0018, base + cap_height),
    )
    for row, (lower, upper, pigment) in enumerate(zip(cap, cap[1:], (cap_edge, cap_edge, cap_top))):
        band(lower, upper, pigment, ribbed=row == 1)
    mesh.face(cap[-1][::-1], cap_top)
    return body_start, profile


def add_zeria_packs(room):
    """Add the three shelf specimens without creating a finish or an instance."""
    add_carton(room, CARTON_X, SHELF_TOP, SHELF_DEPTH)
    return [add_bottle(room.batches[CRAFT], x, SHELF_TOP, SHELF_DEPTH, *finish)
            for _, x, *finish in BOTTLES]


def smooth_zeria_bottles(obj, bodies):
    """Blend shoulder normals along each profile and leave closure ribs faceted."""
    data = obj.data
    normals = [(0.0, 0.0, 0.0)] * len(data.loops)
    for first_face, profile in bodies:
        bands = []
        for i in range(len(profile)):
            r0, y0 = profile[max(0, i - 1)]
            r1, y1 = profile[min(len(profile) - 1, i + 1)]
            dr, dy = r1 - r0, y1 - y0
            length = hypot(dr, dy)
            radial = dy / length
            bands.append([(radial * cos(tau * j / SIDES),
                           -radial * sin(tau * j / SIDES), -dr / length)
                          for j in range(SIDES)])
        for row, (lower, upper) in enumerate(zip(bands, bands[1:])):
            for i in range(SIDES):
                j = (i + 1) % SIDES
                face = data.polygons[first_face + row * SIDES + i]
                face.use_smooth = True
                start = face.loop_start
                normals[start:start + 4] = (lower[j], lower[i], upper[i], upper[j])
    data.normals_split_custom_set(normals)
