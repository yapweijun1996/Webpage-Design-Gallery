"""Link the two editable S15 Casio instrument meshes in Blender."""
from pathlib import Path
import sys

sys.path.insert(0, str(Path(__file__).resolve().parents[2] / "scripts" / "gjh_interiors"))
from build_rooms import material
from casio_instruments import (
    CT_S1_NAME, CT_S1_POSITION, CT_S1_TEXTILE, GP_510_NAME, GP_510_POSITION, add_ct_s1, add_gp_510,
)
from mesh import CRAFT, Room


def build():
    """Link and return the CT-S1BK and GP-510BP in S15 placement order."""
    finish = material(CRAFT, None)
    finish.name = "Casio instruments painted finish"
    textile = finish.copy()
    textile.name = "CT-S1BK matte speaker cloth"
    shader = textile.node_tree.nodes.get("Principled BSDF")
    shader.inputs["Roughness"].default_value = .91
    shader.inputs["Metallic"].default_value = 0
    shader.inputs["Specular IOR Level"].default_value = .12
    models = []
    for name, position, add in (
        (CT_S1_NAME, CT_S1_POSITION, add_ct_s1),
        (GP_510_NAME, GP_510_POSITION, add_gp_510),
    ):
        room = Room(15)
        parts = list(add(room, origin=(0, 0, 0)).items())
        mesh = room.batches[CRAFT]
        obj = mesh.object(name, finish, painted=True)
        if add is add_ct_s1:
            obj.data.materials.append(textile)
            for face in obj.data.polygons:
                if mesh.colours[face.vertices[0]] == CT_S1_TEXTILE:
                    face.material_index = 1
        ends = [start for _, start in parts[1:]] + [len(mesh.faces)]
        for (part, start), end in zip(parts, ends):
            group = obj.vertex_groups.new(name=part)
            vertices = [vertex for face in mesh.faces[start:end] for vertex in face]
            group.add(vertices, 1.0, "REPLACE")
        x, y, z = position
        obj.location = x, -z, y
        models.append(obj)
    return models


if __name__ == "__main__":
    build()
