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

## Round log

Round 1 scores below are the worker's recorded after-scores; the visual advisor separately rated A5 and A8 Partial and rejected shipment (mood 4/10). Round 2 scores are the implementer's assessment of the supplied captures, not independent advisor approval.

| Item | Round 1 | Round 2 | Remaining gap |
|---|---|---|---|
| A1 fascia | Partial | Partial | Atrium fascia remains visible, but its entrance view is HUD-cropped; a lower inset wordmark provides a second view. |
| A2 glazing | Partial | Partial | Heavy mullions remain; P1 glazing module required. |
| A3 shelves | Partial | Partial | Red/gold trim and real can instances added; native-size rows remain small from the entrance. |
| A4 hero | Fail | Partial | Enlarged tins on a plinth are visible from the atrium, but are clipped at the mobile entrance edge. |
| A5 counter | Pass | Pass | Worker assessment; advisor found its cash-wrap appearance unconvincing. |
| A6 greenery | Partial | Partial | Plant remains inside rather than beside entrance. |
| A7 light | Partial | Partial | Wall pools reduced and fascia strips retained; warm glow and wall detail still need visual review. |
| A8 material | Pass | Pass | Worker assessment; advisor found glazing visually flat. |
| B1 door | Pass | Pass | Door opens in the capture. |
| B2 products | Partial | Partial | Shelf inspection was exercised in round 1; feature tins are decorative and do not support Inspect. |
| B3 seats | Partial | Partial | Shop seat coverage not independently exercised in these captures. |
| B4 dead targets | Partial | Partial | Feature tins are not highlighted; full target audit not independently exercised. |

P1 chilled freezer and mullion-free glazed storefront remain unavailable and are not simulated. Round 1 sampled maxima: desktop 168, mobile 89 draw calls. Round 2 sampled atrium/entrance/door-open/inside: desktop 149/153/153/171, mobile 80/84/84/90. These are sampled maxima, not proof for every scene state. The single round 2 browser suite returned RC=1 when the first fixture placement blocked shelf approach; the fixture was moved left afterward and a focused desktop door/shelf Inspect, 3D rotation and Add to Bag check passed. The full browser suite was not rerun. Physical-device performance and independent round 2 advisor and manager approval are NOT FOUND.

### Round 3 — implementer visual assessment

| Item | Score | Evidence and remaining defect |
|---|---|---|
| A1 fascia | Partial | The wordmark remains obscured by the HUD at the entrance, especially at 390. |
| A2 glazing | Partial | Side-frame uprights are thinner; the door and horizontal rails still cross the view. P1 glazing remains outstanding. |
| A3 shelves | Partial | The right wall now has dense ivory, gold and red box rows; the rear tins remain small from the entrance. |
| A4 hero | Partial | The centered tin pyramid is fully within the mobile frame, but remains visually small against the rear shelves and its plinth is not clearly distinguishable. |
| A5 counter | Partial | Framed front, slab and POS are visible; the backdrop is still limited. |
| A6 greenery | Pass | An instanced plant stands beside the left entrance jamb. |
| A7 light | Partial | A warm fascia strip and floor pool were added without lights; bright pale-wall areas remain. |
| A8 material | Partial | Timber shelves and gold trim break up the right wall; some pale areas remain flat. |

The feature tins and decorative boxes are not inspectable; B2 remains Partial. Door opening was captured, but B3–B4 and sections D–F were not independently reviewed in this round. HUD changes are outside this round. Captures and the before/after comparison are stored under `~/omp-tasks/out/s01r3-*`; these scores are not independent advisor approval.

The first full Round 3 browser run returned RC=1: the initial centered fixture blocked the automated rear-shelf approach. The fixture was moved right to clear that route; the full rerun returned RC=0. The build and check, Node tests (one optional Studio checkout test skipped), gallery unittest and SSOT check passed. The browser log's maximum sampled draw call count was 193. Capture samples at atrium/entrance/door-open/inside were 156/150/160/168 at 1440 and 77/85/85/92 at 390.
