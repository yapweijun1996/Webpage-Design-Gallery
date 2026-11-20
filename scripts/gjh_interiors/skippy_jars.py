"""Unprinted Skippy 500 g jar studies in slot-local metres."""

from math import cos, hypot, sin, tau

SHELF_TOP = 2.113
SHELF_DEPTH = -3.98
SAMPLES = (
    ("Skippy Creamy 500 g", "008daa", "00697f", -2.55),
    ("Skippy Chunky 500 g", "165ab0", "104383", -1.37),
)
BODY = "be874e"
# Radius, height and circumference segments. The skirt uses twice the
# underlying body's count so each rib has a narrow groove facing.
PROFILE = (
    (.0270, .0000, 8),
    (.0325, .0040, 8),
    (.0360, .0130, 16),
    (.0360, .0980, 16),
    (.0318, .1032, 16),
    (.0365, .1034, 16),
    (.0359, .1050, 32),
    (.0359, .1215, 32),
    (.0340, .1240, 16),
)


def _join_rings(mesh, lower, upper, colour):
    if len(lower) == len(upper):
        for i, point in enumerate(lower):
            j = (i + 1) % len(lower)
            mesh.face((lower[j], point, upper[i], upper[j]), colour)
    elif len(upper) > len(lower):
        for i, point in enumerate(lower):
            j = (i + 1) % len(lower)
            middle = upper[2 * i + 1]
            mesh.face((lower[j], point, upper[2 * i], middle), colour)
            mesh.face((lower[j], middle, upper[2 * j]), colour)
    else:
        for i, point in enumerate(upper):
            j = (i + 1) % len(upper)
            middle = lower[2 * i + 1]
            mesh.face((middle, lower[2 * i], point), colour)
            mesh.face((lower[2 * j], middle, point, upper[j]), colour)


def add_skippy_jar(mesh, lid, groove, x, y, z):
    """Append the nominal 73 × 73 × 124 mm jar and its closed lid."""
    rings = []
    for radius, height, sides in PROFILE:
        ring = []
        for i in range(sides):
            channel = sides == 32 and i % 2
            angle = (i - .64 * channel) * tau / sides
            distance = radius - .0018 * channel
            ring.append((x + distance * cos(angle), y + height, z + distance * sin(angle)))
        rings.append(ring)

    mesh.face(rings[0], BODY)
    heel_start = len(mesh.faces)
    for row, (lower, upper) in enumerate(zip(rings, rings[1:])):
        if row == 3:
            heel_end = len(mesh.faces)
        if row == 6:
            # The shallow narrow face catches the shadow of the cap ridges.
            for i, point in enumerate(lower):
                j = (i + 1) % len(lower)
                mesh.face((lower[j], point, upper[i], upper[j]), groove if i % 2 == 0 else lid)
        else:
            _join_rings(mesh, lower, upper, BODY if row < 4 else lid)
    mesh.face(rings[-1][::-1], lid)
    return (heel_start, heel_end, x, y, z)


def smooth_skippy_heels(obj, heels):
    """Blend the heel into the cylinder while preserving the ribbed cap."""
    data = obj.data
    normals = [(0.0, 0.0, 0.0)] * len(data.loops)
    for first, end, x, y, z in heels:
        for poly in data.polygons[first:end]:
            poly.use_smooth = True
            for i in poly.loop_indices:
                point = data.vertices[data.loops[i].vertex_index].co
                u, v, height = point.x - x, point.y + z, point.z - y
                radial, axial = (.0, -1.) if height < .002 else (
                    (.733, -.68) if height < .008 else (1., .0)
                )
                distance = hypot(u, v)
                normals[i] = (radial * u / distance, radial * v / distance, axial)
    data.normals_split_custom_set(normals)
