"""Link the editable S14 LG OLED55C5PSA mesh in Blender."""
from pathlib import Path
import sys

sys.path.insert(0, str(Path(__file__).resolve().parents[2] / "scripts" / "gjh_interiors"))
from build_rooms import material
from lg_oled_model import LG_OLED_NAME, LG_OLED_POSITION, add_lg_oled
from mesh import CRAFT, Room


def build():
    """Link and return the editable TV at its S14 room position."""
    room = Room(14)
    parts = list(add_lg_oled(room, origin=(0, 0, 0)).items())
    mesh = room.batches[CRAFT]
    finish = material(CRAFT, None)
    finish.name = "LG OLED painted finish"
    obj = mesh.object(LG_OLED_NAME, finish, painted=True)
    ends = [start for _, start in parts[1:]] + [len(mesh.faces)]
    for (name, start), end in zip(parts, ends):
        group = obj.vertex_groups.new(name=name)
        group.add([vertex for face in mesh.faces[start:end] for vertex in face], 1.0, "REPLACE")
    x, y, z = LG_OLED_POSITION
    obj.location = x, -z, y
    return obj


if __name__ == "__main__":
    build()
