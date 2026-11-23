# S03 · GOGO

The potong cart and rear-left freezer are installed. The four concept views describe the wider showroom proposal. The cart uses the existing brand artwork and illustrates two historic flavours with unwrapped forms.

[GOGO brand research and product evidence](brand-research.md)

## Interior design

Turn the shop’s warm-weather drinks and frozen-treat identity into a compact potong gallery. Keep the original cart on the left and use a side-facing lip and soft canopy light to make it readable from the forward view. The lagoon bar and tea niches stay to the right. Arrange floor accents to point from the entrance toward the cart and leave the centre open for circulation to the rear artwork.

| Element | Local placement | Plan |
| --- | --- | --- |
| Door and main aisle | Threshold XZ (0, 6.0), through (0, 2.55) to (0, −3.0) | The Expanded room keeps a clear centre path. The legacy three-store view retains its table. |
| Potong cart | XYZ (−2.35, 0.025, 2.05), yaw 12° | Keep the canopy and cart facing the open aisle. The source logo sits above the counter lip. A pair of unwrapped samples sits to its left. |
| Drinks counter and stools | Counter XZ (3.15, 3.6); stools X 1.93 at Z 2.6, 3.6, 4.6 | All three counter stools support Sit and Stand. Each faces the bar and has an approach from the aisle. |
| Lounge seats | XZ (−3, −0.8) and (3, −0.8) | Keep Sit and Stand anchors. The apron at Z 0.4 connects either seat to the centre aisle. |
| Cold chest and brand artwork | Chest XZ (−2.8, −3.95) and rear-centre artwork | View the ivory freezer, its blue handle and the twin wire baskets. Both exhibits remain accessible from the rear aisle. |

World origin XYZ (10, 0, −6). Visitor movement follows the [interior programme](../../gjh-v11-interior-program.json). The baseline live desktop path stopped near world Z −4.37 at the centre table. The existing side routes led to the rear, and both bench interactions passed.

## Product and model plan

| Product reference | Placement and model deliverable |
| --- | --- |
| GoGo Premium Potong Ice Cream Red Bean, historical 6 × 65 g | Unwrapped red-bean ice pop study at the cart. Current wrapper, product geometry and contemporary availability remain unverified. |
| GoGo Premium Potong Ice Cream Assorted Real Fruit, historical 6 × 65 g | A warm fruit-coloured form displayed beside red bean. Current box art and individual formats remain pending. |

Both references come from the [Singapore HPB historical product list](https://www.healthhub.sg/sites/assets/Assets/PDFs/HPB/Food/HCS%20products%20list%20for%20website%20updated%20till%2031%20July%2016.pdf#page=51). The geometry study is a category interpretation without wrapper art.

[Interior concept](interior-concept.webp) · [Top-down floor plan](floor-plan.webp) · [Model inventory](model-inventory.md) · [Unwrapped sample concept](product-model-reference.webp)

The built-in image generator produced the proposed warm metal and seafoam entrance view and two unwrapped form studies. The app keeps its original left cart and three backed stools. The header uses the already-loaded full-resolution GOGO mark. The counter and tea niches retain their positions.

## Arcade frontage

Expanded GOGO uses clear fixed display spans, slim floor channels and small patch fittings on its automatic leaves. The existing fascia, 4.7 m portal and sliding colliders still serve the same path to the left cart, central aisle and right tea counter. Classic keeps its original framed frontage.

The original Open and Closed variants use 12 mm glass and 26 mm floor channels. The mall adapts these parts and the door patch fittings to its existing glass and trim batches. The source permits reuse in the owner's projects. [Pinned Blender source and scale](https://github.com/yapweijun1996/Blender-3D-Gallery/tree/a87117622ed25efc5f804c9ee6ed0171e4946cf7/models/glass-storefront-module)

At 390 px the closed glass looks faint from the arcade. Both touch-width and desktop Chrome routes crossed the doorway and returned. With the doors closed and open, the matched Low view used 46 and 42 draws. Detailed used 67 and 63. Five independent reviewers checked the pilot’s sightlines, lighting, brand treatment, mobile render budget and physical clearances. [Arcade views before and after](arcade-frontage.webp)

## Cart identity and product references

The cart uses the [existing sourced GOGO mark](../../../demos/corporate/gjh/v11/assets/gogo-logo.jpg) in the header slot. The [existing drinks cover](../../../demos/corporate/gjh/v11/assets/gogo-brand-cover.jpg) stays in the refreshment zone. For the cart, the [HPB historical list](https://www.healthhub.sg/sites/assets/Assets/PDFs/HPB/Food/HCS%20products%20list%20for%20website%20updated%20till%2031%20July%2016.pdf) establishes Assorted Real Fruit and Red Bean formats. The installed samples are unwrapped. Current wrappers and exact product dimensions remain open. The brand’s [GOGO page](https://gjh.com.sg/gogo/) establishes both categories.

## Interior viewpoints

Four generated views describe one proposed room and its visitor circulation. Compare placements with the separately annotated floor plan.

[1. Entrance](interior-concept.webp) · [2. Signature display](signature-display.webp) · [3. Furniture and aisle](furniture-angle.webp) · [4. Back toward the entrance](reverse-to-entry.webp)

The story is reachable from the entrance side of the cart. It links to the GJH brand page and identifies the 2016 records. The visitor can continue through the centre aisle to the existing rear GOGO artwork.

On published build `077553e3b1a6c526`, desktop and 390 px touch-emulated Chrome verified the existing entrance, the cart story, the official link and the route through the open centre to the rear artwork. The desktop run also checked the story in Simplified Chinese and Malay. Both runs loaded the revised room GLB. [Runtime Chrome captures](cart-runtime.webp) · [Pages deployment](https://github.com/yapweijun1996/Webpage-Design-Gallery/actions/runs/44549696669)

## Rear-left freezer

The raised lid reveals the two steel baskets under the blue handle. The 390 px touch view shows both baskets from the rear aisle. The active View label sits above the open lid. The 1440 px view looks in from the west, beyond the interaction prompt. Both Chrome routes reached **View** and walked back through the automatic door. [Runtime screenshots](freezer-runtime.webp)

All three quality tiers share the 128-triangle model in the existing room file. A browser using the previous room file displays the original chest and keeps the same **View** action. The cart bell, drinks counter, stools and other S03 controls passed the ten-action walkthrough. [Model and source](model-inventory.md) · [Walkthrough](../../verify_interactions.py)

Five independent reviewers checked this fixture. The phone review identified a label across the basket rims. Moving its pointer to the physical top of the lid cleared the projected steel by at least 70 CSS pixels at the normal standing point. The visual recheck passed, as did the mobile budget, source attribution, spatial and lighting checks. The whole-shop concept review remains open.

### Lounge and bar routes

At 390 px with touch and 1440 px with the keyboard, the visitor entered from the Map, followed the centre lane to the cross-aisle at local Z +0.4 m and used both lounge benches. Each circuit ended in the atrium with the door fully closed. All ten registered fixtures worked, including the three bar stools. Both the potong Story and the separate rear brand artwork opened. The keyboard route used F to sit and Escape to stand. The benches were vacant during these GOGO visits. [Seated views](side-bench-routes.webp) · [Action results for revision 22d7c788](../../evidence/gjh-v11-s02-s03-interactions.json)
