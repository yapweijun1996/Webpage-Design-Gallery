"""Link three editable, unprinted S12 Zeria specimens in Blender."""
from pathlib import Path
import sys

sys.path.insert(0, str(Path(__file__).resolve().parents[2] / "scripts" / "gjh_interiors"))
from build_rooms import material
from mesh import CRAFT, Room
from zeria_packs import (
    BOTTLES, CARTON_NAME, CARTON_X, SHELF_DEPTH, SHELF_TOP,
    add_bottle, add_carton, smooth_zeria_bottles,
)


def build():
    """Link and return the carton, Chondro bottle and Lively bottle in order."""
    enamel = material(CRAFT, None)
    enamel.name = "Zeria unprinted carton and closures"
    glasslike = enamel.copy()
    glasslike.name = "Zeria unprinted bottle finish"
    shader = glasslike.node_tree.nodes.get("Principled BSDF")
    shader.inputs["Roughness"].default_value = .22
    shader.inputs["Metallic"].default_value = 0
    shader.inputs["Coat Weight"].default_value = .35

    carton_room = Room(12)
    add_carton(carton_room, 0, 0, 0)
    carton = carton_room.batches[CRAFT].object(CARTON_NAME, enamel, painted=True)
    carton.location = (CARTON_X, -SHELF_DEPTH, SHELF_TOP)
    objects = [carton]
    for name, x, profile, body, *closure in BOTTLES:
        mesh = Room(12).batches[CRAFT]
        band = add_bottle(mesh, 0, 0, 0, profile, body, *closure, editable=True)
        bottle = mesh.object(name, enamel, painted=True)
        bottle.data.materials.append(glasslike)
        for face in bottle.data.polygons:
            if mesh.colours[face.vertices[0]] == body:
                face.material_index = 1
        smooth_zeria_bottles(bottle, (band,))
        bottle.location = (x, -SHELF_DEPTH, SHELF_TOP)
        objects.append(bottle)
    return objects


if __name__ == "__main__":
    build()
