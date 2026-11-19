"""Unprinted S05 single-unit carton in room coordinates (+Y up, +Z forward)."""

# The manufacturer photo establishes the single-unit silhouette. These are
# enlarged display dimensions in metres, estimated from its proportions.
CARTON_ENVELOPE = (.220, .216, .100)
CINNABAR = "bf4d36"
FOLD_SHADOW = "a94633"


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
