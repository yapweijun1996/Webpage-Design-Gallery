"""S16 GP specimens on the existing plinth, with slot-local +Y up."""
from math import cos, hypot, sin, tau

from mesh import CRAFT, Room


PLINTH_TOP = 1.0525

AA_NAME = "GP Ultra+ GP15AUP AA"
AA_POSITION = (.978, PLINTH_TOP, -.11)
ETAG_NAME = "GP eTag White"
ETAG_POSITION = (1.13, PLINTH_TOP, 0)
CR2032_NAME = "GP CR2032"
CR2032_POSITION = (1.045, PLINTH_TOP, -.008)
SIDES = 24


def _lathe_mm(room: Room, origin, diameter, height, rings, colors):
    """Revolve a bottom-to-top profile of (radius, axial height) in mm."""
    radius = diameter / 2
    profile = [(r / radius, y / height) for r, y in rings]
    first_face = len(room.batches[CRAFT].faces)
    room.lathe(*origin, radius / 1000, height / 1000, profile, colors, n=SIDES)
    return first_face, rings


def add_aa(room: Room, origin=AA_POSITION):
    """Add the upright GP15AUP cell with its positive button up."""
    return _lathe_mm(room, origin, 14.5, 50.5, (
        (3.65, 0), (3.65, .20), (6.80, .20), (7.25, .70),
        (7.25, 48.65), (7.05, 49.18), (6.55, 49.40),
        (2.75, 49.40), (2.75, 50.31), (2.59, 50.50),
    ), (
        "bcc2c0", "4f5952", "67764e", "6c8150", "728653", "65774b",
        "a8afaa", "adb5b2", "c9cfcb", "d3d8d6",
    ))


def add_etag(room: Room, origin=ETAG_POSITION):
    """Add the closed white eTag with its contoured face up."""
    return _lathe_mm(room, origin, 32, 8.3, (
        (13.9, 0), (16, 2.50), (16, 3.55), (15.75, 3.80),
        (16, 4.05), (15.6, 5.90), (13.9, 7.90), (11.9, 8.30),
        (9.3, 8.01),
    ), (
        "e9e9e6", "eeefed", "b8bcb9", "d7d9d6", "edefec", "f5f6f3",
        "f7f8f5", "eff1ee", "f5f6f4",
    ))


def add_cr2032(room: Room, origin=CR2032_POSITION):
    """Add a loose CR2032 with its broad unmarked face up."""
    return _lathe_mm(room, origin, 20, 3.2, (
        (8.45, 0), (8.45, .42), (10, .42), (10, 2.75), (9.55, 3.2),
    ), ("b8bfbe", "8a9494", "b5bdbf", "c9cecf", "d3d8d9"))


def smooth_gp_profiles(obj, profiles):
    """Smooth the circumference while retaining the rolled edges and case seam."""
    data = obj.data
    normals = [(0, 0, 0)] * len(data.loops)
    angles = [i * tau / SIDES for i in range(SIDES)]
    for start, rings in profiles:
        for row, ((r0, y0), (r1, y1)) in enumerate(zip(rings, rings[1:])):
            dr, dy = r1 - r0, y1 - y0
            length = hypot(dr, dy)
            ring = [(dy * cos(a) / length, -dy * sin(a) / length, -dr / length) for a in angles]
            for i in range(SIDES):
                j = (i + 1) % SIDES
                face = data.polygons[start + row * SIDES + i]
                face.use_smooth = True
                index = face.loop_start
                normals[index:index + 4] = (ring[j], ring[i], ring[i], ring[j])
    data.normals_split_custom_set(normals)
