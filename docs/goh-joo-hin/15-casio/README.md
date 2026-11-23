# S15 · Casio

**Status: the catalogue story is implemented.** The four concept views show the broader room proposal.

[First-party brand research and product photo sources](brand-research.md)

## Player walkthrough

The existing curved acoustic-style grand is a strong stage anchor. The right passage worked when the visitor turned before the instrument.

[Chrome player baseline](player-baseline.webp)

## Interior design

Present a compact recital exhibit backed by walnut slats. Keep the original acoustic silhouette as scene scenery and reserve separate product displays for Casio’s electronic instruments.

| Element | Placement and interaction |
| --- | --- |
| Main display | Open baby grand and bench on recital oval, local XYZ (-1.05, 0.081, -1.02), yaw -22°. Retain the larger grand fixture as a visual anchor with a clear side pass. |
| Visitor route | Threshold local XZ (0, 5). Turn into the established right aisle before reaching the piano nose, then continue to the keyboard showcase. |
| Fixtures and use points | Display the cabinet hybrid with its independent three-pedal base. Keep the compact 61-key product on a side stand and leave room for access. |

World origin (40, 0, 28), yaw -90°. Dimensions are authored metres. The [floor plan](floor-plan.webp) shows programme footprints and the [inventory](model-inventory.md) resolves fixture coordinates and upstream assets.

## Display products and model work

| Reference | Proposed placement | Model status |
| --- | --- | --- |
| Casiotone CT-S1BK | Right-side instrument stand | Installed 930 × 258 × 83 mm study with 61 keys, top controls and a dark textile speaker deck. |
| CELVIANO Grand Hybrid GP-510BP | Cabinet-form sample beyond the recital anchor | Installed straight cabinet at (1.55, 0.081, -4.00). The covered instrument uses the published envelope and three visible pedals. |

Use the Casio product and AR reference to separate the instrument forms.

[Top-down floor plan](floor-plan.webp) · [Model inventory](model-inventory.md) · [Product model reference](product-model-reference.webp)

The built-in image generator made the interior proposal and unlabelled product shape study. The proposal contains lighting and material intent. Use the actual browser capture for installed visuals and the source listings for real product forms and label details.

## Interior viewpoints

The four ImageGen studies cover the entrance, the main fixture, the browse aisle and the return toward the concourse. The floor plan records authored placement. The concepts illustrate finishes and sightlines, and the Chrome baseline records the installed room.

[1. Entrance](interior-concept.webp) · [2. Signature display](signature-display.webp) · [3. Furniture and aisle](furniture-angle.webp) · [4. Back toward the entrance](reverse-to-entry.webp)

## Runtime acceptance

The audience chair beside the piano offers **Sit** from the side aisle. The visitor sits at world Y 0.601 m. **Stand** on touch or **Escape** on the keyboard restores the visitor to the clear floor beside the instrument. At 390 and 1440 px, Chrome completed the seat transition, the piano phrase and the walk back to the arcade. The seated view looks past the raised piano lid so the visitor and chair stay visible. [Seated touch view](seat-touch.webp)

The CT-S1 keyboard has a 0.690 m-high bench. Approach from the aisle and sit facing the keys. The seated camera shows the visitor in profile. Stand and approach the keyboard to play the C4, E4 and G4 phrase. [Seated view on touch and desktop](keyboard-bench-runtime.webp)

The brown bench belongs to the central recital grand. Enter from the side aisle and sit at its 0.726 m cushion, then stand to play the original piano phrase. The walking collision around the instrument stays in place. On a failed tier download the current piano remains usable. If the replacement loads without a bench, the visitor stands at the clear aisle point before the seat is removed. Returning to a valid model restores one seat. [Phone and desktop seated views](recital-grand-bench.webp) · [Missing-bench and recovery test](../../../tests/browser_gjh_grand_tier.py)

The black grand near the storefront has a separate bench with a cushion 0.512 m above the floor (world Y 0.593 m). Use the inner aisle to sit facing its keys and stand at the same clear point. The bench offers Sit when the loaded model shows its cushion. Chrome verified touch and keyboard seating, a live Detailed-to-Low switch while seated, and the missing-model and missing-cushion paths. [Seated views at both widths](storefront-piano-bench.webp) · [Storefront bench and neighboring seat test](../../../tests/browser_gjh_storefront_bench.py)

## Catalogue exhibit

The recital grand remains the room's architectural anchor. The adjacent station holds the CT-S1BK form study. The separate GP-510BP cabinet sits in the rear alcove. The story compares the portable keyboard with the three-pedal GP-510BP cabinet form and links to Casio Music Singapore.

Desktop and 390 px touch-emulated Chrome entered through the existing doorway, reached the display and returned to the arcade. The Story action opened the reference and displayed the source link. [Runtime Chrome views](exhibit-runtime.webp)

[Editable Blender sources and QA receipt](../../../models/gjh-casio-instruments/README.md)
