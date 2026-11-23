"""Author the installed S04 open patch folio at its existing metric socket."""
import argparse
from pathlib import Path
import sys

import bpy

sys.path.insert(0, str(Path(__file__).resolve().parents[2] / 'scripts/gjh_interiors'))
from mesh import CRAFT, Room

WALNUT = '56372e'
ROSE = 'a65e69'
OXBLOOD = '6c2837'
BRASS = 'b39365'
PAPER = ('e9d8b9', 'f2e3c7')
BOOK_WIDTH = 1.07  # From gutter to each outside edge.


def page_point(side, across, up):
    """The opening rises outward from a shared gutter and tilts back at the top."""
    x = side * (.014 + across * BOOK_WIDTH)
    y = 1.067 + .101 * across + .84 * up
    z = .125 + .052 * across - .575 * up
    return x, y, z


def leaf(room, side, divisions, paper):
    across = [i / divisions for i in range(divisions + 1)]
    front = [(page_point(side, u, 0), page_point(side, u, 1)) for u in across]
    back = [tuple((x, y - .026, z - .029) for x, y, z in band) for band in front]

    def face(vertices, color):
        room.face(vertices if side == 1 else vertices[::-1], color)

    for i in range(divisions):
        low, high = front[i]
        out_low, out_high = front[i + 1]
        back_low, back_high = back[i]
        out_back_low, out_back_high = back[i + 1]
        face((low, out_low, out_high, high), paper)
        face((back_low, back_high, out_back_high, out_back_low), OXBLOOD)
        face((low, back_low, out_back_low, out_low), BRASS)
        face((high, out_high, out_back_high, back_high), BRASS)
    for i, inward in [(0, True), (-1, False)]:
        low, high = front[i]
        back_low, back_high = back[i]
        vertices = (low, high, back_high, back_low)
        face(vertices if inward else vertices[::-1], WALNUT if inward else BRASS)


def build(divisions):
    bpy.ops.wm.read_factory_settings(use_empty=True)
    bpy.context.scene.unit_settings.system = 'METRIC'
    room = Room(4)
    room.box(0, .034, 0, 2.18, .068, .96, BRASS)
    room.box(0, .439, 0, 2.26, .752, 1.02, WALNUT)
    room.box(0, .843, .003, 2.30, .068, 1.06, ROSE)
    room.box(0, .946, .003, 2.34, .14, 1.10, OXBLOOD)
    room.box(0, .440, .514, 2.06, .626, .021, ROSE)
    # The existing room-detail packs rest on the 1.15 m display ledge.
    room.box(0, 1.0445, .284, 2.25, .049, .536, 'd4b88d')
    # A dark book rest carries the leaves from below, away from the samples.
    room.box(0, 1.146, -.238, 1.94, .264, .24, WALNUT)
    for side, paper in zip((-1, 1), PAPER, strict=True):
        leaf(room, side, divisions, paper)
    # Thin unprinted patch inset on the left page, within the book surface.
    outline = ((.24, .24), (.65, .24), (.72, .31), (.72, .70),
               (.65, .77), (.24, .77), (.18, .70), (.18, .31))
    inset = [page_point(-1, across, up) for across, up in reversed(outline)]
    room.face([(x, y, z + .004) for x, y, z in inset], 'd8c4a0')
    material = bpy.data.materials.new('Patch folio | paper, oxblood and oak')
    material.use_nodes = True
    nodes = material.node_tree.nodes
    pigment = nodes.new('ShaderNodeVertexColor')
    pigment.layer_name = 'Pigment'
    shader = nodes.get('Principled BSDF')
    shader.inputs['Roughness'].default_value = .72
    material.node_tree.links.new(pigment.outputs['Color'], shader.inputs['Base Color'])
    room.batches[CRAFT].object('Open patch folio', material, True)


def main(output):
    output.mkdir(parents=True, exist_ok=True)
    for tier, divisions in [('low', 1), ('balanced', 4), ('detailed', 8)]:
        build(divisions)
        bpy.ops.export_scene.gltf(filepath=str(output / f's04-patch-folio-{tier}.glb'),
                                  export_format='GLB', export_yup=True, export_vertex_color='ACTIVE')


if __name__ == '__main__':
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--output', type=Path, required=True)
    main(parser.parse_args(sys.argv[sys.argv.index('--') + 1:]).output)
