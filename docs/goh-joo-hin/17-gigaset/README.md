# S17 · Gigaset

**Status: the catalogue story is implemented.** The four concept views show the broader room proposal.

[First-party brand research and product photo sources](brand-research.md)

## Player walkthrough

The telephone gable and handset silhouettes remain recognizable across views. The lounge sofa now offers Sit and Stand at the aisle end of the upholstered cushion.

[Chrome player baseline](player-baseline.webp)

## Interior design

Keep the arched phone alcove and use softly illuminated cream shelving, smoked timber and dark bronze phone trays. Arrange cradle face and handset controls toward the visitor.

| Element | Placement and interaction |
| --- | --- |
| Main display | Gabled private-call alcove with open front, local XYZ (-0.55, 0.081, -2.95), yaw -5°. Retain the telephone alcove as architecture, with separate slots for two reference devices. |
| Visitor route | Threshold local XZ (0, 5). Guide visitors around the low central cabinet and toward the rear display from the right. |
| Fixtures and use points | Keep the mall and handset routes clear. The sofa uses the gallery model’s scaled cushion and original collision footprint. Its stand point is on the aisle side at world XZ (38.046, 43.669), on the raised shop floor. |

World origin (40, 0, 44), yaw -90°. Dimensions are authored metres. The [floor plan](floor-plan.webp) shows programme footprints and the [inventory](model-inventory.md) resolves fixture coordinates and upstream assets.

## Display products and model work

| Reference | Proposed placement | Model status |
| --- | --- | --- |
| Gigaset A170 | Left side of the tabletop island | Installed handset and rounded cradle. The A170 has an amber 34 × 22 mm display and a 159 × 48 × 30 mm handset. [Manufacturer gallery](https://www.gigaset.com/en_en/gigaset-a170/) |
| Gigaset COMFORT 550A | Right side of the tabletop island | Installed handset with a wider answering base and control panel. The black 550A handset is 161 × 52 × 26 mm and its base is 43 × 123 × 99 mm. [Manufacturer gallery and specifications](https://www.gigaset.com/hq_en/gigaset-comfort-550/), with the black answering-machine variant selected. |

The official product galleries supply model views, while the dealership source covers product families.

[Top-down floor plan](floor-plan.webp) · [Model inventory](model-inventory.md) · [Product model reference](product-model-reference.webp)

The built-in image generator made the interior proposal and unlabelled product shape study. The proposal contains lighting and material intent. Use the actual browser capture for installed visuals and the source listings for real product forms and label details.

## Interior viewpoints

The four ImageGen studies cover the entrance, the main fixture, the browse aisle and the return toward the concourse. The floor plan records authored placement. The concepts illustrate finishes and sightlines, and the Chrome baseline records the installed room.

[1. Entrance](interior-concept.webp) · [2. Signature display](signature-display.webp) · [3. Furniture and aisle](furniture-angle.webp) · [4. Back toward the entrance](reverse-to-entry.webp)

## Runtime acceptance

In Chrome at 390 × 844 on Low, the visitor sat on the rendered cushion, stood with the touch control, answered the handset, opened the catalogue and walked back into the arcade. At 1440 × 900 on Detailed, the keyboard route used F to sit and Escape to stand. Both routes also passed with a deliberately truncated 4,096-byte sofa model. Switching from Detailed to Low kept both the loaded seat and its fallback visible and selectable. [Touch-emulated seated view](sofa-seated-touch.png)

The walkthrough checks the existing handset and catalogue story, entry and exit, and native Sit and Stand with the keyboard and touch controls. The procedural seat remains visible and usable while the gallery GLB is loading or unavailable. Run `python tests/browser_gjh_gigaset_seat.py --out /tmp/gigaset-seat` with Chrome and Playwright installed. `--truncate-sofa` exercises a partial GLB response, and `--switch-tier` repeats the live seat-target check after switching from Detailed to Low.

## Catalogue exhibit

Two editable tabletop sets show the A170 handset with amber display and rounded cradle, and the 550A handset with its wider answering base, message window and physical controls. The A170 base axes and exact finishes remain open.

Desktop and 390 px touch-emulated Chrome entered through the existing doorway, reached the display and returned to the arcade. The Story action opened the reference and displayed the source link. [Runtime Chrome views](exhibit-runtime.webp)

[Editable Blender sources and QA receipt](../../../models/gjh-gigaset-handsets/README.md)
