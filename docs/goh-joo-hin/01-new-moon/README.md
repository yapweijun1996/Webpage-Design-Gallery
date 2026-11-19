# S01 · New Moon

## Brand and assortment

Goh Joo Hin introduced New Moon as its first house brand in 1959, starting with abalone. The brand’s timeline records later launches in bird’s nest, chicken essence, fragrant rice, sauces, pastes, chilled and frozen foods, and other groceries. The current Singapore eShop illustrates that wider assortment. Abalone gives this shop a clear focus and lets visitors compare four real products in the same fixture. [GJH New Moon timeline](https://gjh.com.sg/newmoon-history/) · [GJH New Moon portfolio](https://www.gjhglobal.com/newmoon/) · [Official New Moon eShop catalogue](https://www.gjheshop.com/brand/new-moon/)

| Display, left to right from the entrance | Official visual and identity | Installed GLB |
| --- | --- | --- |
| Premium Wild Caught New Zealand Abalone 425g | [GJH eShop front and back](https://www.gjheshop.com/product/new-moon-premium-wild-caught-new-zealand-abalone-425g/) | [NZ tin](../../../demos/corporate/gjh/v11/assets/new-moon-can-nz-425g-lod1.glb) |
| Premium Wild Caught Australia Abalone 425g | [GJH eShop front and back](https://www.gjheshop.com/product/new-moon-premium-wild-caught-australia-abalone-425g/) | [AU tin](../../../demos/corporate/gjh/v11/assets/new-moon-can-au-425g-lod1.glb) |
| Premium South Africa Abalone (4–5 pcs) 425g | [GJH eShop product visuals](https://www.gjheshop.com/product/new-moon-premium-south-africa-abalone-4-5pcs-425g/) | [SA tin](../../../demos/corporate/gjh/v11/assets/new-moon-can-sa-425g-lod1.glb) |
| Premium Mexico Abalone 454g | [GJH eShop front and back](https://www.gjheshop.com/product/new-moon-premium-mexico-abalone-454g/) | [MX tin](../../../demos/corporate/gjh/v11/assets/new-moon-can-mx-454g-lod1.glb) |

## Interior design

Pale honey oak cabinetry, a cream rear wall, New Moon blue accents and a yellow crescent frame a clear sightline from the glass entrance to the four abalone bays. On the left, the heritage panel introduces the 1959 launch and original abalone focus. On the right, an optional tasting story offers serving ideas. Keep both off the central route and let visitors reach Inspect without opening either story.

| Element | Shop-local position | Visitor use |
| --- | --- | --- |
| Threshold and aisle | Threshold XZ (0, 6.0), centreline to (0, −2.635), then lateral browse | From the map landing at (0, 8.4), approach the sliding doors and keep the centre clear. |
| Crescent and scalloped header | Above the existing cabinets, centred on the back wall | The yellow crescent establishes the brand at the threshold. The cream header and honey oak frame the real-size tins. |
| Four cabinets | Nominal centre X values −3.63, −1.21, 1.21, 3.63, at Z −3.25 | Browse along Z −2.635. Move to the highlighted bay for Shelf View, product inspection, 3D rotation and Demo Bag. |
| Sampling island | XZ (2.65, 2.0), stone top Y 1.185 | Keep tea service and the sample can on the right to preserve sight down the main route. |
| Two tasting stools | X 1.49, Z 2.71 and 1.42 | Add sit anchors at cushion centres, facing the aisle. Stand points are on the aisle side (X 0.54). |
| Heritage panel and entry greenery | Left wall and the existing orchid at XZ (−3.6, 3.7) | Use verified present-day New Zealand product imagery with a short 1959 timeline. Keep optional reading out of the main aisle. |

The ground frame is at world XYZ (−10, 0, −6), with local Y up and +Z toward the entrance. Installed room depth is 10.5 m. Placement data and acceptance criteria are maintained in the [programme](../../gjh-v11-interior-program.json) and [S01 checklist](../../gjh-v11-s01-newmoon-acceptance.md).

## Model plan

- **Light display models.** The [crescent header](../../../demos/corporate/gjh/v11/assets/interiors/s01-crescent-header-balanced.glb) has Low, Balanced and Detailed variants from [the editable Blender source](../../../models/gjh-new-moon-header/README.md). Its two material batches cover the warm surface colors and the luminous underside. The [room detail GLB](../../../demos/corporate/gjh/v11/assets/interiors/s01-new-moon-details.glb) adds tags and a floor crescent. Stools and the sampling island are procedural.
- **Installed product models.** The four existing photo-derived demo tins remain at native demo size. The installed GLBs measure approximately 77.5 mm across and 124 mm high. The exact real package dimensions and current approval status are tracked per SKU. Product pages are the reference for label imagery. The repo records estimates and coverage in the [merchandising review](../../v11-newmoon-merchandising-density-review.md).
- **Pending packaging upgrade.** Track NZ, AU, SA and MX independently. Each needs verified current edition, compatible front and back photography, and rights clearance before any wider reuse. MX additionally needs a flat or multi-view source to resolve the documented 121° photo-derived face. Keep geometry and asset IDs until a verified replacement has passed shelf, rotation and pickup checks.

## Visual references

[Interior concept](interior-concept.webp) · [Top-down floor plan](floor-plan.png) · [Model inventory](model-inventory.md) · [Tin geometry study](product-model-reference.webp)

The four generated views show the same proposed light interior: glass entrance, baked-looking vertical cabinet lighting, unchanged physical tin scale, and the tasting island on the right. Illustration tin art, labels, dishes, furnishings and styling are planning references. The installed product assets take their identity from the linked listings and verified demo geometry. The [heritage poster study](heritage-poster-study.webp) is a contemporary concept with an illustration, alongside the documented launch date. Use the existing sourced NZ front packshot in the interactive exhibit.

## Runtime result

The light interior was verified in headed Chrome on build `a793a237cd50e587`. Desktop keyboard and 390 × 844 Chrome touch emulation entered through the automatic glass doors. Both brand stories opened, all four native-size product models opened in Inspect and could be rotated, picked up and returned, and both tasting stools supported Sit and Stand. The Australian product could be added to the Demo Bag. Interior approaches used collision-aware test waypoints after the real-input entry.

[Player walkthrough](browser-walkthrough.webp) · [Australia model in Inspect](installed-product-preview.webp)

The recorded entry walks sampled p95 scene-frame intervals of 17.7 ms on the 1440 × 900 Detailed desktop and 34.3 ms under 390 × 844 Low touch emulation. The desktop sample had zero intervals at or above 50 ms. The phone emulation had one interval at 50 ms. Sampling ran with screen recording disabled. These checks cover the short route in Chrome.

## Interior viewpoints

Four generated views describe one proposed room and its visitor circulation. Compare placements with the separately annotated floor plan.

[1. Entrance](interior-concept.webp) · [2. Signature display](signature-display.webp) · [3. Furniture and aisle](furniture-angle.webp) · [4. Back toward the entrance](reverse-to-entry.webp)

Published touch-emulated Chrome on build `95e5ba13a1d96807` used the joystick at the entrance and collision-aware waypoints inside. The route opened both stories, inspected and rotated all four 3D cans, picked up and returned each can, used Sit and Stand on both tasting stools and exited to the concourse. The Australia action added one item to the demo bag. [Pages deployment](https://github.com/yapweijun1996/Webpage-Design-Gallery/actions/runs/44555819324)
