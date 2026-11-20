"""Link the two editable S13 Sony audio meshes in Blender."""
from pathlib import Path
import sys

sys.path.insert(0, str(Path(__file__).resolve().parents[2] / "scripts" / "gjh_interiors"))
from build_rooms import material
from mesh import CRAFT, Room
from sony_audio_models import (
    AISLE_YAW, HEADPHONES_NAME, HEADPHONES_POSITION, WALKMAN_NAME, WALKMAN_POSITION,
    add_headphones, add_walkman, smooth_headphones,
)


def build():
    """Link and return the Walkman and headphones meshes in cabinet position."""
    enamel = material(CRAFT, None)
    enamel.name = "Sony audio painted finish"
    models = []
    for name, position, add in (
        (WALKMAN_NAME, WALKMAN_POSITION, add_walkman),
        (HEADPHONES_NAME, HEADPHONES_POSITION, add_headphones),
    ):
        room = Room(13)
        part_starts = add(room)
        parts = list(part_starts.items())
        mesh = room.batches[CRAFT]
        obj = mesh.object(name, enamel, painted=True)
        for (part, start), (_, end) in zip(parts, parts[1:] + [("", len(mesh.faces))]):
            group = obj.vertex_groups.new(name=part)
            group.add([vertex for face in mesh.faces[start:end] for vertex in face],
                      1.0, "REPLACE")
        if add is add_headphones:
            smooth_headphones(obj, part_starts)
        x, y, z = position
        obj.location = x, -z, y
        obj.rotation_euler.z = AISLE_YAW
        models.append(obj)
    return models


if __name__ == "__main__":
    build()
