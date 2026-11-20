"""Link two editable, unprinted S11 Hormel tins in Blender."""
from pathlib import Path
import sys

sys.path.insert(0, str(Path(__file__).resolve().parents[2] / "scripts" / "gjh_interiors"))
from build_rooms import material
from hormel_chili_tins import (
    GOLD, LID, PLACEHOLDER_Y, SAMPLES, SHELF_DEPTH, SILVER,
    add_hormel_chili_tin, smooth_hormel_chili_tins,
)
from mesh import CRAFT, Mesh


def build():
    """Link and return the two named meshes at the former placeholder positions."""
    enamel = material(CRAFT, None)
    enamel.name = "Hormel unprinted enamel"
    metal = enamel.copy()
    metal.name = "Hormel gold top seam"
    shader = metal.node_tree.nodes.get("Principled BSDF")
    shader.inputs["Roughness"].default_value = .36
    shader.inputs["Metallic"].default_value = .75
    silver = enamel.copy()
    silver.name = "Hormel silver bottom seam"
    shader = silver.node_tree.nodes.get("Principled BSDF")
    shader.inputs["Roughness"].default_value = .50
    shader.inputs["Metallic"].default_value = .0
    shader.inputs["Specular IOR Level"].default_value = .22
    shader.inputs["Emission Color"].default_value = (.34, .44, .54, 1)
    shader.inputs["Emission Strength"].default_value = .23

    specimens = []
    for name, pigment, x in SAMPLES:
        mesh = Mesh()
        first_band = add_hormel_chili_tin(mesh, pigment, 0, 0, 0)
        specimen = mesh.object(name, enamel, painted=True)
        specimen.data.materials.append(metal)
        specimen.data.materials.append(silver)
        for face in specimen.data.polygons:
            colour = mesh.colours[face.vertices[0]]
            if colour == SILVER:
                face.material_index = 2
            elif colour in (GOLD, LID):
                face.material_index = 1
        smooth_hormel_chili_tins(specimen, (first_band,))
        specimen.location = (x, -SHELF_DEPTH, PLACEHOLDER_Y)
        specimens.append(specimen)
    return specimens


if __name__ == "__main__":
    build()
