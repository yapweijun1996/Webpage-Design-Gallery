# S07 · Gu Long

**Status: the catalogue story is implemented.** The four concept views show the broader room proposal.

[First-party brand research and product photo sources](brand-research.md)

## Player walkthrough

The original jade can pyramid stands out in both views. The Low version compresses the cylinder silhouettes and generic cans contain no SKU art.

[Chrome player baseline](player-baseline.webp)

## Interior design

Use a low dark-red floor field and a jade-coloured base to stage one distinct pyramid. Let the storefront copy and back-wall relief carry the heritage identity. Two low courses of unprinted stock fill the left window. The central pyramid holds six courses on its jade drum. Use scalloped highlights at the tin edges to retain silhouette on small screens.

| Element | Placement and interaction |
| --- | --- |
| Main display | Jade drum and stepped banquet pyramid, local XYZ (-0.55, 0.48, -0.85), yaw -8°. Keep the primary tiers left of the walking line, with the readable faces toward the aisle. |
| Visitor route | Threshold local XZ (0, 5). Keep the right channel open through the middle, then turn toward the left display face. |
| Fixtures and use points | Keep lanterns overhead and side shelving against the walls. Set an optional discussion label at hand height, outside the collision envelope. |

World origin (-20, 0, 12), yaw 90°. Dimensions are authored metres. The [floor plan](floor-plan.webp) shows programme footprints and the [inventory](model-inventory.md) resolves fixture coordinates and upstream assets.

## Display products and model work

The [two editable 256 g tin studies](../../../models/gjh-gulong-tins/README.md) sit on the left provision shelf. The official product photos support their short form, rolled rims and pull rings. The estimated geometry is unprinted.

| Reference | Proposed placement | Model status |
| --- | --- | --- |
| GuLong Stewed Pork Chops 256g | Left provision shelf, visitor edge | Unprinted form installed. Physical measurements and current label mapping remain pending. The existing pyramid is a reusable fixture. |
| GuLong Stewed Pork 256g | Left provision shelf beside Pork Chops | Unprinted form installed from its own official reference. Exact dimensions and print remain pending. |

Use GJH carton-deal imagery to identify the variants. The opening shape and exact pack measurements remain separate decisions.

[Top-down floor plan](floor-plan.webp) · [Model inventory](model-inventory.md) · [Product model reference](product-model-reference.webp)

The built-in image generator made the interior proposal and unlabelled product shape study. The proposal contains lighting and material intent. Use the actual browser capture for installed visuals and the source listings for real product forms and label details.

## Interior viewpoints

The four ImageGen studies cover the entrance, the main fixture, the browse aisle and the return toward the concourse. The floor plan records authored placement. The concepts illustrate finishes and sightlines, and the Chrome baseline records the installed room.

[1. Entrance](interior-concept.webp) · [2. Signature display](signature-display.webp) · [3. Furniture and aisle](furniture-angle.webp) · [4. Back toward the entrance](reverse-to-entry.webp)

## Runtime acceptance

At the doorway, the six-course banquet pyramid on the jade drum is the tallest display. The left window holds 61 generic tins on the original plinth, 36 on the lower course and 25 on the upper. Its mounted top falls from 1.665 m to 0.679 m. The window asset drops from 17,896 to 12,016 triangles and from 418,872 to 282,628 bytes. Its square collision footprint stays 1.127 m across. The other 187 collision boxes retain their original dimensions and positions. [Window model and rebuild source](../../../models/gjh-gulong-window-stock/README.md)

The three earlier comparison boards follow the same five stops from the arcade into the shop and back. The top row shows the original window and the bottom row shows the two-course display. The table reports the window's projected height, its visible pixels and the whole scene's submitted triangles at the doorway. Pixel counts compare a frozen render with a render in which only the window mesh is hidden.

| Paired Chrome views | Window height, CSS px | Visible window pixels | Scene triangles | Camera separation |
| --- | ---: | ---: | ---: | ---: |
| [390 px · Low · touch](evidence/window-stock-390.webp) | 91 → 49 | 2,566 → 1,805 | 65,363 → 59,449 | 4.30 cm |
| [768 px · Balanced · touch](evidence/window-stock-768.webp) | 204 → 109 | 12,873 → 8,939 | 68,789 → 62,909 | 1.82 cm |
| [1440 px · Detailed · keyboard](evidence/window-stock-1440.webp) | 178 → 95 | 9,836 → 6,771 | 113,541 → 107,625 | 2.91 cm |

At all three centred doorway stops, none of the sampled rays aimed at the central display hit the window first in either version. The taller stock repeated the central pyramid's silhouette. An eye-height check farther left found direct obstruction. At local X −1.56 m and −1.85 m, Y 1.64 m, Z 4.2 m, the original window intercepted 361 of 4,117 and 1,501 of 4,157 rays to the Low pyramid. The counts were 375 of 4,175 and 1,508 of 4,213 with the Balanced/Detailed model. The two-course display cleared those sampled rays at both positions. [Geometry, camera positions and render measurements](evidence/window-stock.json)

All six visitors used Map and the doorway controls, collected the tower sample, opened the catalogue Story, plated the sample at the side shelf and returned to the arcade until the door closed. Close inspection used capsule steering. Both 390 px runs also took the lift to the upper plaque. Threshold draw calls held at 37, 40 and 55 across the three profiles. The paired captures came from builds `2ec7b68e307bbce6` and `b80cd22c2a35ace8`. The evidence file identifies the same store assets and declarations in the subsequent integrated build `b18e06b75f45e37c`.

The lighting, visual, brand, mobile and spatial reviews passed the window change. Low detail still draws the central tins as broad dark-green courses with narrow highlights. Balanced and Detailed show individual rounded sides. The brighter bronze highlights and timber drum in the central display concept remain design targets. The Chrome captures used desktop Metal with touch emulation and stationary timing samples. Physical-handset pacing and crowded-aisle behaviour remain unmeasured. [Signature display concept](signature-display.webp)

### Release replay after the street and theme updates

All four visits crossed the open shop doorway with an active capsule, completed the sample, catalogue Story and shelf serving, then returned to the arcade and allowed the door to close. On the candidate build `b18e06b75f45e37c`, the 390 and 768 touch profiles recorded 37 and 40 doorway draws (59,483 and 62,909 scene triangles), with six-stop peaks of 61 and 62. The 390 visit also checked the separate 397 g plaque upstairs.

The initial desktop camera faced the arcade. Both 1440 keyboard runs reacquired the shop-facing view at the open doorway. The two camera positions differed by 2.2 mm. The post-theme control `73400e23cbd1fea0` and candidate each submitted 55 draws there, with 113,505 and 107,625 scene triangles respectively. Both six-stop peaks were 81. The desktop captures show the change in the left-window stock while the central banquet display remains in view. [Release doorway comparison](evidence/window-stock-release-threshold-1440.webp) · [Replay inputs and receipt hashes](evidence/window-stock.json)

## Catalogue exhibit

The jade pyramid has a small stewed-pork plaque and a catalogue Story. The downstairs Story links to GJH’s GuLong catalogue and identifies two separate products, Stewed Pork Chops 256 g and Stewed Pork 256 g. The two unprinted form studies sit on the provision shelf. The pyramid illustrates the range, and product-specific label mapping remains pending. [Merchant catalogue](https://www.gjheshop.com/brand/gulong/) · [Shelf studies and source photographs](../../../models/gjh-gulong-tins/README.md)

The upstairs plaque identifies a third product, Pork Leg Mushroom 397 g. Its visitor button opens the general eShop, and its source record cites the individual listing. The programme presents the showroom as an independent concept. The window uses the owner’s procedural fixture and original materials under its project reuse terms. The retail photographs serve as references for the separate shelf studies. [Upper plaque sources](../../../demos/corporate/gjh/v11/assets/brand-kit/brand-kit-sources.md) · [Original fixture licence](https://github.com/yapweijun1996/Blender-3D-Gallery/blob/a87117622ed25efc5f804c9ee6ed0171e4946cf7/models/stacked-can-pyramid/LICENSE.md)

Desktop and 390 px touch-emulated Chrome entered through the existing doorway, reached the display and returned to the arcade. The Story action displayed the referenced catalogue link. [Runtime Chrome views](exhibit-runtime.webp)
