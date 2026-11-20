"""Unprinted S05 cartons in room coordinates (+Y up, +Z forward)."""

# The manufacturer photo establishes the single-unit silhouette. These are
# enlarged display dimensions in metres, estimated from its proportions.
CARTON_ENVELOPE = (.220, .216, .100)
CINNABAR = "bf4d36"
FOLD_SHADOW = "a94633"

# The 2023 manufacturer's front and back photos guide the face proportions
# and strip placement. This is an estimated display envelope in metres.
TEN_CARTON_ENVELOPE = (.310, .153, .115)
TEN_PAPERBOARD = "c59b7e"
TEN_TEAR_STRIP = "bc957b"


def add_pzh_carton(mesh, x=0.0, y=0.0, z=0.0):
    """Append the closed specimen to a craft Mesh at its bottom centre."""
    width, height, depth = CARTON_ENVELOPE
    back, front = -depth / 2, depth / 2
    edge = .0015
    tuck = front - .008
    # Sweep a closed side profile across the width. The shallow V at the
    # top front edge is the tuck seam, with paperboard underneath it.
    profile = (
        (0, back + edge),
        (edge, back),
        (height - edge, back),
        (height, back + edge),
        (height, tuck - .002),
        (height - .0018, tuck),
        (height, tuck + .002),
        (height, front - edge),
        (height - edge, front),
        (edge, front),
        (0, front - edge),
    )
    left = [(x - width / 2, y + v, z + w) for v, w in profile]
    right = [(x + width / 2, y + v, z + w) for v, w in profile]
    mesh.face(left[::-1], CINNABAR)
    mesh.face(right, CINNABAR)
    for i in range(len(profile)):
        j = (i + 1) % len(profile)
        colour = FOLD_SHADOW if i in (4, 5) else CINNABAR
        mesh.face((left[i], left[j], right[j], right[i]), colour)


def add_pzh_ten_carton(mesh, x=0.0, y=0.0, z=0.0, *, strip_mesh=None):
    """Append the ten-unit carton and exterior film loop at the bottom centre."""
    width, height, depth = TEN_CARTON_ENVELOPE
    edge = .0015
    clearance = .00025

    def ring(at_x, inset):
        bottom, top = y + .0001 + inset, y + height - inset
        back, front = z - depth / 2 + inset, z + depth / 2 - inset
        return (
            (at_x, bottom, back + edge),
            (at_x, bottom + edge, back),
            (at_x, top - edge, back),
            (at_x, top, back + edge),
            (at_x, top, front - edge),
            (at_x, top - edge, front),
            (at_x, bottom + edge, front),
            (at_x, bottom, front - edge),
        )

    left, right = ring(x - width / 2, clearance), ring(x + width / 2, clearance)
    mesh.face(left[::-1], TEN_PAPERBOARD)
    mesh.face(right, TEN_PAPERBOARD)

    if strip_mesh is None:
        strip_mesh = mesh
    # A fixed width coordinate appears on the opposite side in the rear view.
    strip_x = x + .075
    strip_left, strip_right = ring(strip_x - .001, 0), ring(strip_x + .001, 0)
    for i in range(len(left)):
        j = (i + 1) % len(left)
        mesh.face((left[i], left[j], right[j], right[i]), TEN_PAPERBOARD)
        strip_mesh.face((strip_left[i], strip_left[j], strip_right[j], strip_right[i]), TEN_TEAR_STRIP)
