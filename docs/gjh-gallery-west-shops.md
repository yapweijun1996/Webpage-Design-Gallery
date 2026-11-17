# Blender gallery fixtures for S04–S11

These eight display-only bays use local static GLBs from the owner’s [Blender-3D-Gallery](https://github.com/yapweijun1996/Blender-3D-Gallery/tree/a87117622ed25efc5f804c9ee6ed0171e4946cf7/models). The shop assignments follow the architectural references in [the mall anchor gallery](mall-design-anchors/README.md). The products are illustrative, unbranded props. S05 uses a generic carton stand; no specific product or brand relationship is represented by the model.

| Bay | Source model | Placement | Authored dimensions W × H × D (m) | Runtime primitives |
|---|---|---|---:|---:|
| S04 · Borsch Med | [mosquito-patch-pack](https://github.com/yapweijun1996/Blender-3D-Gallery/tree/a87117622ed25efc5f804c9ee6ed0171e4946cf7/models/mosquito-patch-pack) | Countertop patch-pack riser on the front left of the fluted rose island. | 0.50 × 0.35 × 0.30 | 3 |
| S05 · Pien Tze Huang | [medicine-health-box-set](https://github.com/yapweijun1996/Blender-3D-Gallery/tree/a87117622ed25efc5f804c9ee6ed0171e4946cf7/models/medicine-health-box-set) | Free-standing carton and bottle display beside the drawer-and-lantern apothecary. | 0.60 × 1.70 × 0.35 | 3 |
| S06 · Flying Wheel | [instant-noodle-pack-display](https://github.com/yapweijun1996/Blender-3D-Gallery/tree/a87117622ed25efc5f804c9ee6ed0171e4946cf7/models/instant-noodle-pack-display) | Hook rack of blank noodle packs in the front left aisle, ahead of the suspended noodles. | 0.80 × 1.80 × 0.40 | 3 |
| S07 · Gu Long | [stacked-can-pyramid](https://github.com/yapweijun1996/Blender-3D-Gallery/tree/a87117622ed25efc5f804c9ee6ed0171e4946cf7/models/stacked-can-pyramid) | Lacquer-window composition with a full can pyramid between the window case and central island. | 1.20 × 1.80 × 1.20 | 3 |
| S08 · Skippy | [peanut-butter-jar-stand](https://github.com/yapweijun1996/Blender-3D-Gallery/tree/a87117622ed25efc5f804c9ee6ed0171e4946cf7/models/peanut-butter-jar-stand) | Three-tier jar stand beside the checkerboard window, visible against the blue pantry. | 0.80 × 1.02 × 0.50 | 3 |
| S09 · SPAM | [shelf-food-aisle](https://github.com/yapweijun1996/Blender-3D-Gallery/tree/a87117622ed25efc5f804c9ee6ed0171e4946cf7/models/shelf-food-aisle) | Double-sided provision gondola in the left foreground of the golden sun niche. | 1.20 × 1.80 × 0.50 | 3 |
| S10 · California Mexico | [abalone-gift-box-display](https://github.com/yapweijun1996/Blender-3D-Gallery/tree/a87117622ed25efc5f804c9ee6ed0171e4946cf7/models/abalone-gift-box-display) | Gift-box riser on the left-front quadrant of the round pearl-and-sage island, in front of the existing cans. | 1.00 × 0.90 × 0.50 | 3 |
| S11 · Hormel | [food-display-cabinet](https://github.com/yapweijun1996/Blender-3D-Gallery/tree/a87117622ed25efc5f804c9ee6ed0171e4946cf7/models/food-display-cabinet) | Timber and glazed deli case in front of the open pantry worktable. | 1.25 × 1.29 × 0.70 | 5 |

All eight sources use metre units and face glTF +Z. The scene places the seven compact source exports unchanged. S11 uses the source cabinet’s closed rest pose. Blender imported the optimized GLB, baked all mesh world transforms, joined the meshes, and exported the static selected object with its five original PBR materials and without animation. Its source GLB SHA-256 is `87ac01e90f9ae731473b7591a72ece22a5275e5b2f714c270cb6b63429a41e7d`.

Grounded fixtures sit on the 0.081 m finished floor. The S04 and S10 countertop props rest on their respective modeled caps, at 1.2875 m and 1.09 m. The S07 pyramid uses a uniform 0.88 scale to clear the adjacent fixture. The other seven models retain source dimensions. Positions and rotations are in [the placement module](../demos/corporate/gjh/v11/assets/gallery-west-shops.js).

These assets have original procedural geometry and materials. The upstream per-model license files authorize reuse in the owner’s projects and leave general public redistribution terms unspecified. The source model directories linked above preserve their individual license and source records.

## Browser evidence

[Walkway views and fixture detail crops](mall-design-anchors/runtime/gallery-west-details.webp) show the final placement in a 1280 × 800 Chrome/Metal walkthrough. Each overview marks the projected bounds of the loaded GLB. The detail is an enlargement of the same rendered pixels.

The check froze the camera and simulation, hid only the selected GLB for a second capture, and compared its screen region with the visible capture. Each model contributed visible pixels. These measurements apply to the sampled positions and resolution.

| Bay | Changed pixels inside projected bounds (luminance difference >12) | Draw calls in sampled view |
|---|---:|---:|
| S04 | 271 | 146 |
| S05 | 4410 | 82 |
| S06 | 5085 | 137 |
| S07 | 4706 | 114 |
| S08 | 2370 | 110 |
| S09 | 9615 | 101 |
| S10 | 2037 | 102 |
| S11 | 6349 | 73 |

| Local GLB | SHA-256 |
|---|---|
| mosquito-patch-pack | e8e1b38c4a7d99c3347abbb7c24c8677f68527d80804521a2c07eb96bc86dac7 |
| medicine-health-box-set | 9a0b11b759110b9f1721dcdc73684743e5a901185354427f237d5e1e2a3f7c8e |
| instant-noodle-pack-display | e4948ff0e8c5510bc6b2970bebec0c527d96ee48fb2e086ef7adc0ca42a0fa2f |
| stacked-can-pyramid | cf8cf126e0a0783f4ee9ac585b306caa6714c6dafc6a3dfbbaff117d3d494527 |
| peanut-butter-jar-stand | 42f5e1bce24dfa525305623472f42654a80fade80f79b8177cb9b6dfb4b36f28 |
| shelf-food-aisle | 362328303a1236cbedd093c376ce4665d6d63131e7673a8a3c47e1349d2f1ed4 |
| abalone-gift-box-display | d4e61761c12161baaf90f91565d82b149812992a4731d5e154f957cb1caf4dc4 |
| food-display-cabinet | d9ac669e44f902bf2f546a35667de56dc08dc04f2c1365b08b08ff683676f14b |
