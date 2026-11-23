# S01 New Moon flagship: design acceptance checklist

Authority: `docs/references/gjh-mall-concept-board.png`, panel "S01 - New Moon Flagship Store", plus the board's spatial plan (S01 = 10 x 12 m, north side, 5 m storefront) and visual style (Forest Green, Ivory, Champagne Gold, Warm Wood, Light Stone).
Pass bar (owner decision): overall mood close to the concept. Loop: one round = one change, advisor review of real screenshots, manager's own look, then push. Max 5 rework rounds, then downgrade to a procedural stand-in and record the gap in `task.md`.
Scoring: each item is Pass / Partial / Fail with a named defect. Items marked [P1] depend on models still to be delivered (glazed storefront module, chilled freezer, and so on) and may be Partial until then.

## A. What the concept shows (visual advisor)
1. Facade: wide red fascia with the New Moon crescent logo and wordmark, readable from the atrium at the default camera distance (1440 and 390).
2. Facade glazing: shop interior visible through the front without heavy mullions blocking the hero display [P1 glazed storefront module].
3. Interior colour block: red back wall with warm gold accent lines; red and gold shelving full of product tins in clear rows.
4. Hero display: abalone tins stacked or fanned on a feature fixture, large enough to read as the hero from the entrance.
5. Central counter: red counter with cash-wrap look, placed so the walkway stays clear.
6. Greenery: at least one tall plant beside the entrance, as in the concept.
7. Light: warm interior light brighter than the atrium, visible glow at the fascia, no flat white wash.
8. Material mood: warm wood or light stone floor tone consistent with the board palette, no untextured grey surfaces.

## B. Interaction (functional)
1. Walk to the door: Open prompt appears at the correct distance; door animates and the player can enter.
2. Products: each hero tin supports Inspect, 3D rotate, real package face and Add to Bag; the Bag count updates.
3. Seats: any bench or stool in or at the shop is sittable via the registry; decor is not interactive.
4. No dead interaction targets: nothing highlights without doing something.

## C. Mobile performance (mobile advisor)
1. Draw calls <= 200 at the shop entrance, inside the shop and with the door open (desktop and mobile tier).
2. 390 px width: fascia, hero display and HUD buttons do not overlap; tap targets >= 44 px.
3. No new network assets beyond the shared model set; no frame-time regression against the previous round.

## D. Spatial flow (spatial advisor)
1. S01 sits at the north side with a 5 m storefront and 12 m depth, matching the spatial plan.
2. Walkway outside is clear; entering and leaving does not collide with benches, plants or NPCs.
3. The player can see the hero display from the entrance without turning the camera.

## E. Brand facts (brand advisor)
1. Brand name, logo and product claims match the official sources already used in v11; AI-generated imagery is labelled.
2. The unofficial-concept disclaimer stays visible.

## F. Lighting (lighting advisor)
1. Tiered lighting rules hold (desktop bloom only, capped lights, procedural environment).
2. No blown-out highlights on the red fascia; gold accents keep their warmth.

## Release gate for each round
- build `--check`, Node tests, unittest, SSOT, full browser suite run by the manager (RC=0), draw calls <= 200.
- 1440 and 390 screenshots viewed by the manager, side by side with the concept panel.
- Advisor scores recorded per section A-F; push only when no Fail remains in A1, A3, A4, B1, B2 and C1, or the gap is recorded.

## Current showroom evidence

The later [New Moon showroom brief](goh-joo-hin/01-new-moon/README.md#interior-design) specifies honey oak, cream, blue and a yellow crescent. The original board remains the reference for the route, feature display and entrance sightline.

| Items | Assessment | Observation |
| --- | --- | --- |
| A1, A3, A5, A7, A8 | Pass at the sampled viewpoints | The complete official mark is visible at both Map arrivals. Four stocked cabinets face the entrance. The stone tasting island stands to the right, the planter at the left return, and the centre aisle stays clear. The ceiling highlight leaves the stock, crescent and warm timber distinguishable. [Entrance and showroom views](goh-joo-hin/01-new-moon/README.md#storefront-sign-at-the-map-arrival) |
| A6 | Partial at the straight-on arrival | The planter is present at the left return and visible inside. The front view does not show the tall silhouette seen in the reference. |
| A2 | Partial | Dark fixed rails remain on the side glazing. The fully open entrance gives an unobstructed central route. [Storefront comparison](goh-joo-hin/01-new-moon/map-arrival-fascia.webp) |
| A4, D3 | Category and route pass. Product scale remains partial. | First-time image readers could locate the four cabinets. The reader shown the category crown could also read ABALONE from the Map. At that distance the tins remain small and do not reproduce the original large stacked or fanned composition. [Matched phone and desktop views](goh-joo-hin/01-new-moon/README.md#finding-the-abalone-cabinets-from-the-entrance) |
| B1–B4, D2 | Pass on the two exercised routes | A touch visitor and a keyboard visitor entered through the opening door, inspected and rotated all four products, added them to the bag, used both stools, opened both stories and left through the closing door. The routes exercised 15 shop operations at each width. [Four-product regression](../tests/browser_gjh_newmoon_pickup_bag.py) |
| C1 | Pass | Arrival and cabinet-aisle draws stayed at 58 and 43 on phone. Desktop scene draws excluding NPCs held at 87 and 64. [Rendering evidence](goh-joo-hin/01-new-moon/README.md#finding-the-abalone-cabinets-from-the-entrance) |
| C2 | Pass for sampled 390 px controls | The sign clears the movement HUD. More, Inspect, Pickup, Drop, Bag and Return met 44 × 44 CSS px and passed their centre hit tests. [HUD measurements](gjh-v11-hud.md#roaming-disclosure) |
| C3 | Partial | Before and after the crown change, the test loaded the same 159 phone and 194 desktop request paths. The model grew by 4,992 bytes per tier. Matched host frame timing covers the arrival, entrance and cabinet aisle. Physical device timing remains open. [Frame samples](evidence/gjh-v11-shop-frame-timing/README.md) |
| D1 | Pass against the later floor plan | The shop occupies the north lot. The finished room is 10.5 m deep and its clear opening is 4.7 m. [As-built floor plan](goh-joo-hin/01-new-moon/floor-plan.png) |
| E1–E2 | Pass for the demo | The four stocked origins and official product images have source records. The roaming HUD now shows the unofficial-concept label. Packaging-edition verification remains documented, including the Mexico placeholder sector. [Product sources](goh-joo-hin/01-new-moon/brand-research.md) · [Disclosure](gjh-v11-hud.md#roaming-disclosure) |
| F1–F2 | Pass in the recorded lighting samples | Low and Detailed preserve the distinction between the cabinet crown, yellow crescent and lit shelf edges in Everyday. The earlier Low and Balanced measurements also cover Christmas. [Store lighting review](goh-joo-hin/01-new-moon/README.md#finding-the-abalone-cabinets-from-the-entrance) |

Five independent advisers reviewed the whole shop across visual design, mobile use, brand, spatial flow and lighting. The visual review rates the shop Partial. The side framing, prominence of the entrance planter and scale of the tins account for that score. The shop has separate five-adviser reviews for the country labels, the fascia and the category crown. These observations cover native desktop Chrome and touch-emulated Chrome. Physical phone acceptance remains open.
