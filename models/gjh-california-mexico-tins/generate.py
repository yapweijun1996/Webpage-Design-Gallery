"""Link the two editable, unprinted S10 comparison tins in Blender."""
from pathlib import Path
import sys

sys.path.insert(0, str(Path(__file__).resolve().parents[2] / "scripts" / "gjh_interiors"))
from build_rooms import material
from california_mexico_tins import (
    LID, ROLL, SAMPLES, SHELF_DEPTH, SHELF_TOP,
    add_california_mexico_tin, smooth_california_mexico_tins,
)
from mesh import CRAFT, Mesh


def build():
    """Return the two separately named specimens at the original shelf positions."""
    enamel = material(CRAFT, None)
    enamel.name = "California Mexico unprinted enamel"
    metal = enamel.copy()
    metal.name = "California Mexico rolled metal"
    shader = metal.node_tree.nodes.get("Principled BSDF")
    shader.inputs["Roughness"].default_value = .36
    shader.inputs["Metallic"].default_value = .75

    specimens = []
    for name, pigment, x in SAMPLES:
        mesh = Mesh()
        band = add_california_mexico_tin(mesh, pigment, 0, 0, 0)
        specimen = mesh.object(name, enamel, painted=True)
        specimen.data.materials.append(metal)
        for face in specimen.data.polygons:
            if mesh.colours[face.vertices[0]] in (ROLL, LID):
                face.material_index = 1
        smooth_california_mexico_tins(specimen, (band,))
        specimen.location = (x, -SHELF_DEPTH, SHELF_TOP)
        specimens.append(specimen)
    return specimens


if __name__ == "__main__":
    build()
