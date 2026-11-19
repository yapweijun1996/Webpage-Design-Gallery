"""Unprinted MILI Vegetarian Mock Duck 280 g scene prop, in shop coordinates.

Shape reference:
https://www.gjheshop.com/product/mili-vegetarian-mock-duck-280g/
https://www.gjheshop.com/wp-content/uploads/2024/04/a08ee787192ce59100d8378c5118b4a8.jpg
"""
from math import cos, hypot, isfinite, sin, tau

BODY_BLUE = "486576"
TIN_GOLD = "b8a36e"
LID_TIN = "9e8e70"
SIDES = 20

# Radius and Y in millimetres, from the inset base to the recessed lid.
# The photo's 466 x 744 px outline includes the projected lid ellipse.
# A 76 x 113 mm envelope (H/D 1.49) and the rim details are scene estimates.
PROFILE = (
    (34.2, 1.0, TIN_GOLD),
    (37.5, 0.0, TIN_GOLD),
    (38.0, 1.8, TIN_GOLD),
    (36.8, 4.7, BODY_BLUE),
    (36.8, 108.4, BODY_BLUE),
    (38.0, 110.6, TIN_GOLD),
    (37.4, 113.0, TIN_GOLD),
    (34.8, 109.9, LID_TIN),
)
_RADIALS = tuple((cos(i * tau / SIDES), -sin(i * tau / SIDES)) for i in range(SIDES))


def add_mili_mock_duck(mesh, x=0.0, y=0.0, z=0.0, *, scale=1.0):
    """Append to a craft Mesh and return the first face index for shading."""
    if not isfinite(scale) or scale <= 0:
        raise ValueError("Can scale must be finite and positive")
    first_vertex = len(mesh.points)
    first_face = len(mesh.faces)
    metres = scale / 1000.0
    # Mesh stores Blender (X, -Z, Y) so glTF export restores the shop's Y up.
    # Adjacent bands and both caps share rings, preserving a closed mesh.
    for radius, height, colour in PROFILE:
        mesh.points.extend(
            (x + radius * metres * cx, -z + radius * metres * sy, y + height * metres)
            for cx, sy in _RADIALS
        )
        mesh.colours.extend([colour] * SIDES)
        mesh.uvs.extend([(0.0, 1.0)] * SIDES)

    mesh.faces.append(tuple(range(first_vertex, first_vertex + SIDES)))
    for row in range(len(PROFILE) - 1):
        lower = first_vertex + row * SIDES
        upper = lower + SIDES
        for i in range(SIDES):
            j = (i + 1) % SIDES
            mesh.faces.append((lower + j, lower + i, upper + i, upper + j))
    top = first_vertex + (len(PROFILE) - 1) * SIDES
    mesh.faces.append(tuple(reversed(range(top, top + SIDES))))
    return first_face


def apply_mili_mock_duck_normals(obj, first_faces):
    """Set can normals after Mesh.object(), using all can face indices in the batch."""
    data = obj.data
    normals = [(0.0, 0.0, 0.0)] * len(data.loops)
    section = [(0.0, -1.0)]
    for (r0, y0, _), (r1, y1, _) in zip(PROFILE, PROFILE[1:]):
        dr, dy = r1 - r0, y1 - y0
        length = hypot(dr, dy)
        section.append((dy / length, -dr / length))
    section.append((0.0, 1.0))

    # Blend the rim slopes along the profile. Keep the straight wall cylindrical
    # and use explicit axial normals on the two flat panels.
    rows = []
    for (_, _, colour), (r0, y0), (r1, y1) in zip(PROFILE, section, section[1:]):
        radial, axial = (1.0, 0.0) if colour == BODY_BLUE else (r0 + r1, y0 + y1)
        length = hypot(radial, axial)
        rows.append(tuple((radial * cx / length, radial * sy / length, axial / length)
                          for cx, sy in _RADIALS))

    for first_face in first_faces:
        for row, (lower, upper) in enumerate(zip(rows, rows[1:])):
            for i in range(SIDES):
                j = (i + 1) % SIDES
                face = data.polygons[first_face + 1 + row * SIDES + i]
                face.use_smooth = True
                start = face.loop_start
                normals[start:start + 4] = (lower[j], lower[i], upper[i], upper[j])
        cap_offset = 1 + (len(PROFILE) - 1) * SIDES
        for face_index, axial in ((first_face, -1.0), (first_face + cap_offset, 1.0)):
            start = data.polygons[face_index].loop_start
            normals[start:start + SIDES] = [(0.0, 0.0, axial)] * SIDES
    data.normals_split_custom_set(normals)
