# S04 · Borsch Med

**Status: the two catalogue stops are implemented.** The four concept views describe the wider room proposal. The installed product forms are unprinted studies.

[First-party brand research and product photo sources](brand-research.md)

## Player walkthrough

Chrome entry and the shop’s right-side circulation passed on desktop and in touch emulation. Two inclined leaves and a centre gutter identify the patch folio from the doorway. The surrounding generic shelf stock remains contextual display dressing.

[Chrome player baseline](player-baseline.webp)

## Open folio

From the Map entrance the central display now shows two cream pages meeting at a dark spine on a burgundy plinth. At 390 px the spread occupied about 50 CSS px on arrival and 70 at the door. The left page carries an unprinted patch-shaped inset. The catalogue’s carton, pouch and 2 × 3 backing sheet sit on the 1.15 m front ledge. The right aisle leads separately to the Lingzhi twin pack.

| Matched views in Chrome | Arrival | Door | Inside | Folio | Right aisle | Exit |
| --- | ---: | ---: | ---: | ---: | ---: | ---: |
| [390 px, Low](folio-comparison-390.webp) | 27 | 35 | 34 | 25 | 21 | 31 |
| [768 px, Balanced](folio-comparison-768.webp) | 28 | 37 | 36 | 29 | 22 | 37 |
| [1440 px, Detailed](folio-comparison-1440.webp) | 38 | 60 | 53 | 40 | 34 | 50 |

The table shows draw calls with NPCs disabled for the before-and-after comparison. The door was fully open for both arrival frames and all 18 pairs had equal draw counts. The folio uses one draw at every quality level and 114, 162 and 226 triangles respectively. The integrated run kept the normal NPC setting, crossed the door with the touch joystick or W key, followed the right aisle, opened both Story dialogs and returned to the arcade. Seven requested file hashes per profile identify the build and models used. [Routes, geometry and source files](folio-route.json)

Five advisers accepted the display change. A small patch remains difficult to see from the corridor, and the dense, symmetrical shelving differs from the off-centre folio and quieter right-hand passage in the later concept. The original right-hand walking line remains clear. Retail print and the physical patch-pack dimensions still require source material. [Product research](brand-research.md)

## Interior design

Turn the pale space into a quiet product library. Use warm bone plaster, brushed bronze and restrained oxblood around the folio, with a shallow back wall for the capsule category and folio lighting that reveals the products at approachable eye height.

| Element | Placement and interaction |
| --- | --- |
| Main display | Open two-leaf patch folio on a rose and oxblood plinth, local XYZ (-0.48, 0.081, -0.63), yaw 7°. The existing carton, pouch and sticker study remain on the 1.15 m ledge. |
| Visitor route | Threshold local XZ (0, 6). Keep the tested right aisle beside the folio open from the entry through to the rear cabinets. |
| Fixtures and use points | Shallow wall stock rails and the service shelf stay off the walking route. The Lingzhi story opens from the right aisle near the cabinet. |

World origin (20, 0, -6), yaw 0°. Dimensions are authored metres. The [floor plan](floor-plan.webp) shows programme footprints and the [inventory](model-inventory.md) resolves fixture coordinates and upstream assets.

## Display products and model work

| Reference | Proposed placement | Model status |
| --- | --- | --- |
| Borsch Med Mosquito Repellent Patch, 18 patches | Front ledge of the open folio | Unprinted carton with a through-hanger, sealed pouch and six rounded-square patches on a 2 × 3 backing sheet. Physical dimensions and retail surfaces remain pending. |
| Lingzhi Cracked Spores Powder Capsule 200 mg × 60 twin pack | Right product library shelf | Two unprinted cartons use the catalogue's single-box dimensions and twin-pack envelope. The pack photographs remain in the separate catalogue listing. |

The [editable packaging studies](../../../models/gjh-borsch-packs/README.md) link the official references and describe the dimensional evidence. The proposal presents the products without treatment, dosing or performance claims.

[Interior angle](interior-concept.webp) · [Top-down floor plan](floor-plan.webp) · [Model inventory](model-inventory.md) · [Product model reference](product-model-reference.webp)

The built-in image generator made the interior proposal and unlabelled product shape study. The proposal contains lighting and material intent. Use the actual browser capture for installed visuals and the source listings for real product forms and label details.

## Runtime acceptance

On published build `8e4599e605ef0138`, desktop and 390 px touch-emulated Chrome followed the entrance route, opened the patch story in front of the folio and reached the separate Lingzhi story via the right aisle. Each action linked to its own official catalogue entry and used the static story image. The desktop run also checked the patch card’s Simplified Chinese and Malay titles. [Runtime Chrome captures](folio-runtime.webp) · [Pages deployment](https://github.com/yapweijun1996/Webpage-Design-Gallery/actions/runs/44550489149)

## Catalog images by display

The folio is a frame for the [Mosquito Repellent Patch 18-patch outer pack, pouch and sticker gallery](https://www.gjheshop.com/product/borsch-med-mosquito-repellent-patch-18-patches/). The separate rear shelf points to the [Lingzhi capsule twin-pack front and side gallery](https://www.gjheshop.com/product/borsch-med-100-lingzhi-cracked-spores-powder-capsule-200mg-x-60-capsules-twin-pack/). Use the [existing Borsch Med mark](../../../demos/corporate/gjh/v11/assets/brands/S04-borsch-med.webp) as the shop identifier. The neutral packets in the four views place the fixtures. Product identity comes from the two distinct library references and text labels. Product usage and marketing claims remain with the source listings.

## Interior viewpoints

Four generated views describe one proposed room and its visitor circulation. Compare placements with the separately annotated floor plan.

[1. Entrance](interior-concept.webp) · [2. Signature display](signature-display.webp) · [3. Furniture and aisle](furniture-angle.webp) · [4. Back toward the entrance](reverse-to-entry.webp)
