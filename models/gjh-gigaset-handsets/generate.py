"""Link four editable S17 mesh parts with the room display poses."""
from pathlib import Path
import sys

sys.path.insert(0, str(Path(__file__).resolve().parents[2] / "scripts" / "gjh_interiors"))
from build_rooms import material
from gigaset_models import PARTS
from mesh import CRAFT, Room, smooth_face_ranges


def build():
    """Return A170 cradle and handset, then COMFORT 550A base and handset."""
    finish = material(CRAFT, None)
    finish.name = "Gigaset painted finish"
    objects = []
    for name, draw, (x, y, z), tilt in PARTS:
        room = Room(17)
        curved_end = draw(room.face)
        obj = room.batches[CRAFT].object(name, finish, painted=True)
        smooth_face_ranges(obj, [(1, curved_end)])
        obj.location = x, -z, y
        obj.rotation_euler.x = -tilt
        objects.append(obj)
    return objects


if __name__ == "__main__":
    build()
