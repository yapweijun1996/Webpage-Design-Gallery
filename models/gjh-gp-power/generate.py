"""Link the three editable S16 GP specimen meshes in Blender."""
from pathlib import Path
import sys

sys.path.insert(0, str(Path(__file__).resolve().parents[2] / "scripts" / "gjh_interiors"))
from build_rooms import material
from gp_power_models import (
    AA_NAME, AA_POSITION, CR2032_NAME, CR2032_POSITION, ETAG_NAME, ETAG_POSITION,
    add_aa, add_cr2032, add_etag, smooth_gp_profiles,
)
from mesh import CRAFT, Room


def build():
    """Link and return the AA, eTag and CR2032 in display order."""
    finish = material(CRAFT, None)
    finish.name = "GP power painted finish"
    models = []
    for name, (x, y, z), add in (
        (AA_NAME, AA_POSITION, add_aa),
        (ETAG_NAME, ETAG_POSITION, add_etag),
        (CR2032_NAME, CR2032_POSITION, add_cr2032),
    ):
        room = Room(16)
        profile = add(room, origin=(0, 0, 0))
        obj = room.batches[CRAFT].object(name, finish, painted=True)
        smooth_gp_profiles(obj, (profile,))
        obj.location = x, -z, y
        models.append(obj)
    return models


if __name__ == "__main__":
    build()
