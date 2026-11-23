# GJH v11 mall: design-acceptance QA loop

Status: owner-approved decisions, 2026-11-17. Independent virtual-mall concept; no tenancy claims.

## Why
Tests and draw-call budgets pass while the scene still looks flat and does not match the design. The loop makes the design itself the acceptance test.

## Decisions (owner)
- Design authority: concept images `docs/references/gjh-mall-concept-board.png` and `gjh-mall-viewing-deck.png`. Documents follow the images.
- Pass bar: overall mood close to the concept image (tone, light, materials). Fine detail is not strict.
- Step size: one shop per round (change, advisor review of real screenshots, push to main). First shop: S01 New Moon.
- Rework cap: 5 rounds per shop. After that, downgrade to a procedural stand-in, record it as a known gap, move on.
- Advisors: five independent reviewers: visual vs concept image, mobile performance (390 width, draw calls), brand facts, spatial flow, lighting. Critique only, never edit code.
- Round-2 OMP work (visibility and contrast) finishes first and is the loop's starting point; its screenshots go to the advisors.
- Release: push to main without asking when tests pass, advisors pass and the manager has looked at the screenshots.
- Progress reports: every 20 minutes (SGT) until finished.

## Loop
1. Checklist: per shop, visible acceptance items derived from the concept image (what is seen, scale, placement, light, palette). Stored in KB-MCP (project gjh-virtual-mall).
2. Change: OMP makes one small change for one shop in an isolated worktree.
3. Evidence: build `--check`, Node tests, unit tests, SSOT, browser test, draw calls <= 200, per-shop screenshots at 390 and 1440 (`~/omp-tasks/shopcheck.py`).
4. Advisor review: the five advisors score screenshots against the checklist and concept image.
5. Rework: OMP fixes only the named issues; repeat from step 3 (max 5 rounds).
6. Release: push, confirm Pages deploy and live version, record result and lessons in KB-MCP and `task.md`.

## Shopfront review checklist

Use the [mall concept board](references/gjh-mall-concept-board.png) for the overall light, circulation and S01 red flagship. The [individual shop references](mall-design-anchors/README.md#shop-lots) show the composition of the other storefronts and a closer interior view of S01. Start each review with a normal approach at 390 and 1440 CSS pixels. At each width, check whether the sign is legible, the main display is visible past the avatar and glazing, and the door and circulation path remain clear. Record a screenshot and a Pass, Partial or Fail for each of the two observations in the shop's row. A released interior can have a different fixture. Score its visual effect against the reference and use the [as-built entrance inventory](gjh-v11-interior-program.md#how-to-verify) to identify it.

| Shop and reference | Display and placement | Light, colour and material |
| --- | --- | --- |
| [S01 New Moon](mall-design-anchors/S01.webp) | From the atrium, read the red flagship sign and see a central tin or tasting display with stocked shelving behind it. | Warm light picks out red and gold product bays against wood or light stone. Apply the [full S01 checklist](gjh-v11-s01-newmoon-acceptance.md). |
| [S02 MILI](mall-design-anchors/S02.webp) | See a green-tiled kitchen island and the hood above it, with shelves and a clear path beside the island. | Warm timber and lit shelving frame the darker green tile. |
| [S03 GOGO](mall-design-anchors/S03.webp) | Read the curved counter, row of stools and seating area through the open corner. | Pastel teal and coral accents stand out against cream arches and warm pendant light. |
| [S04 Borsch Med](mall-design-anchors/S04.webp) | A low rose counter leads the eye toward orderly shelves. The curved glazed corner leaves the display visible. | Pale shelving and soft, even light keep the rose counter distinct. |
| [S05 Pien Tze Huang](mall-design-anchors/S05.webp) | Read a central cabinet, drawer-lined wall and a circular display niche from the entrance. | Dark wood and the warm lit niche give the cabinetry depth. |
| [S06 Flying Wheel](mall-design-anchors/S06.webp) | Hanging noodles form a recognisable silhouette above a timber display, with shelving on both sides. | Pale grain and wheat colours remain distinct against the darker timber frame. |
| [S07 Gu Long](mall-design-anchors/S07.webp) | See the stepped tin arrangement in front of stocked arched display bays. | Deep red lacquer, warm gold and pools of light separate the display from the backdrop. |
| [S08 Skippy](mall-design-anchors/S08.webp) | A round display and peanut motif read between arched shelf bays, with a visible chequered floor. | Blue and cream remain distinguishable on the counter, shelves and floor. |
| [S09 SPAM](mall-design-anchors/S09.webp) | Read the stepped can display against its round rear recess, with an open line of sight past the counter. | Gold lettering and the mustard recess stand out from the navy counter and fascia. |
| [S10 California Mexico](mall-design-anchors/S10.webp) | Shell-shaped displays in the windows frame a rounded island and a coastal rear feature. | Sea-glass green, pale shell surfaces and warm highlights retain a luminous interior. |
| [S11 Hormel](mall-design-anchors/S11.webp) | A substantial market table sits in front of stocked rear shelves, with an aisle to either side. | Burgundy trim, timber and a light chequered floor separate the table from the room. |
| [S12 Zeria](mall-design-anchors/S12.webp) | See a low central island, illuminated side shelves and the layered rear wall beyond. | Soft white and sage finishes retain their edges under diffuse light. |
| [S13 Sony](mall-design-anchors/S13.webp) | See the rear screen and listening lounge, with product stations at the sides. | The screen and overhead ring stand out against charcoal surfaces and warm acoustic slats. |
| [S14 LG](mall-design-anchors/S14.webp) | Two display screens face the lounge, with larger appliances at the sides. | The display colours and red sign remain legible against the softly lit pale interior. |
| [S15 Casio](mall-design-anchors/S15.webp) | A keyboard or piano and its bench are visible to the right, with low glass displays toward the centre. | Dark timber, warm case lighting and the contrasting piano keys distinguish the recital area. |
| [S16 GP](mall-design-anchors/S16.webp) | A compact display island sits between stocked side displays, with smaller products visible behind it. | Lime panels and product accents remain legible against the bright white shelving. |
| [S17 Gigaset](mall-design-anchors/S17.webp) | See the low handset island, side display shelves and concentric signal arcs on the rear wall. | Warm highlights pick out the handsets and arcs against the darker rear wall. |

## Known gaps carried in
- Round-1 displays are small or hidden behind mullions; scene still flat beige.
- Missing models (owner's AI agent): grand piano, chilled freezer, ice-cream cart, mullion-free glazed storefront module, canned-food pyramid display.
- Physical-device acceptance deferred; new model licences have unspecified public redistribution terms.

## Core experience (owner, 2026-11-17): the acceptance target
1. GTA-style free roaming: third-person character, walk, run, camera orbit, explore the mall (not clicking product cards).
2. Real multi-floor mall (about 70 m x 60 m): central atrium, second-floor viewing deck, shops, corridors, escalators, rest areas, food area, directory kiosks, advertising lightboxes.
3. Interactive products: walk up to a product (e.g. New Moon abalone can), Inspect, rotate in 3D, see the real package and official image, product info, add to Bag.
4. Modular chibi characters: big head, small body, swappable hair, clothes, shoes, accessories; Idle, Walk, Run, Sit, Pick Up; NPCs in the mall.
5. Desktop and mobile: WASD + mouse; full-screen joystick with Run, Interact, Camera, Map and Bag buttons; no large install.

Every advisor round scores against these five items first, then the per-shop checklist.

## Interaction rules (owner, 2026-11-17)
1. Every chair must be sittable: all chairs in the mall, including restaurant chairs, rest-area seats and bar stools, support Sit interaction.
2. Not every object needs interaction: walls, decorations and ordinary light fixtures may stay static models.
3. Products support Inspect, storefront doors open on approach and chairs support Sit. Do not make every object clickable.

Advisors check these three rules in every round (sit coverage, door open, product inspect, no pointless clickable objects).

## Full vision (owner, 2026-11-17): Singapore-Malaysia Virtual World
The final goal is a complete Singapore-Malaysia Virtual World, not a small mall demo.
1. All 17 GJH brands: each with its own shop, brand visuals, product display and an enterable interior. Real product data must be verified; never invent SKUs.
2. Real multi-floor mall: atrium, second-floor viewing deck, more floors, escalators, lifts, connecting corridors, food area and public facilities, free movement between floors.
3. Complete Singapore world: HDB, MRT, shophouse, hawker centre, kopitiam, offices, homes, streets, parks and malls.
4. Complete Malaysia world: kampung, terrace house, shoplot, pasar malam, mamak, shopping malls, residential areas and city streetscape.

### Notes for planning (manager)
- Supersedes the earlier "glazed storefront, no walkable interior" decision for the long term: shops must become enterable. Treat as a later phase; the current glazed-facade work stays as the interim state.
- The 200 draw-call single-scene budget cannot carry a whole world. A district-streaming design (chunked districts, LOD, unload far areas) is needed before Singapore and Malaysia districts are added.
- The Blender-3D-Gallery already holds many Singapore and Malaysia models (HDB staircase, shophouse staircase, kampung house staircase, hawker stalls, kopitiam kettle, wet-market counters and more); reuse before requesting new ones.
- Suggested phases: P0 v11 mall quality (current loop); P1 multi-floor and enterable shops; P2 streaming architecture; P3 Singapore districts; P4 Malaysia districts.
