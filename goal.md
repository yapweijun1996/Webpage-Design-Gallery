# Goal: GJH Virtual Mall and the Singapore-Malaysia Virtual World

Owner: Wei Jun. Last updated 2026-11-17. Tasks live in `task.md`; acceptance loop in `docs/gjh-v11-qa-loop.md`; model inventory in `docs/sg-my-world-model-inventory.md`. This is an independent concept; no tenancy or partnership claims.

## Final goal
A complete Singapore-Malaysia Virtual World that runs in the browser (desktop and mobile), built from reusable modules. The GJH Virtual Mall is its first district and its proving ground.

## Core experience (acceptance target)
1. GTA-style free roaming: third-person character, walk, run, camera, not clicking product cards.
2. Real multi-floor mall (about 70 m x 60 m): atrium, viewing deck, more floors, escalators, lifts, corridors, food area, facilities.
3. Interactive products: Inspect, rotate in 3D, real package and official image, product info, Bag.
4. Modular chibi characters (swappable hair, clothes, shoes, accessories; Idle, Walk, Run, Sit, Pick Up) and NPCs.
5. Desktop (WASD + mouse) and mobile (full-screen joystick, Run, Interact, Camera, Map, Bag); no large install.
6. All 17 GJH brand shops with verified product data (no invented SKUs) and, in time, enterable interiors.
7. Singapore world (HDB, MRT, shophouse, hawker centre, kopitiam, offices, homes, streets, parks, malls) and Malaysia world (kampung, terrace house, shoplot, pasar malam, mamak, malls, residential areas, city streets).

## Interaction rules
- Every chair must be sittable (restaurant, rest-area, bar stools).
- Not every object needs interaction; walls, decor and ordinary lights stay static.
- Interaction must be meaningful: products Inspect, doors Open, chairs Sit.

## Architecture: Modular 3D World Engine
A reusable set of systems that assembles buildings, furniture, roads, characters and products into worlds, like LEGO. It is the shared base for the GJH mall and the Singapore-Malaysia world, so character movement, camera, interaction, collision and scene loading are not rebuilt per mall or per city.
- Layering: Blender-3D-Gallery stays the 3D asset library (models); the World Engine is a separate layer that uses those assets to run the world.
- Build on Three.js (already used, r170) with our own Modular World Framework. We do not build a full game engine from scratch. Keep browser, mobile, reusable models and the 17-shop mall as the fixed priorities.
- Reusable behaviors: one logic per interaction type, configured per asset. Example Sit: the engine detects distance to a seat, shows "Press E to Sit", moves the character to the seat anchor, plays the sit animation, and Stand returns to free movement. A new chair only needs a Seat Anchor, sitting pose and collision parameters; 1,000 more chairs reuse the same logic. Same pattern for Inspect, Open and Pick Up.
- World streaming: load nearby districts and unload far ones (for example leaving the mall unloads interior detail and loads roads, HDB and shops), so the whole world is never loaded at once. Needs chunks, LOD and per-chunk budgets (current single-scene budget: 200 draw calls).
- Shared engine services: camera, movement, collisions (Rapier is already vendored), streaming, interaction registry, theme and lighting tiers.

| World | Reusable modules |
|---|---|
| GJH Mall | 17 brand shops, multiple floors, escalators, products |
| Singapore | HDB, MRT, hawker centres, shophouses, roads |
| Malaysia | Kampung, terrace houses, shoplots, mamak stalls |
| Characters | Modular chibi, NPC, animations |
| Interactions | Sit, Inspect, Open, Pick Up |
| Shared engine | Camera, movement, collisions, streaming |

## Phases
- P0 Mall quality: design-acceptance QA loop, one shop per round, concept image as authority.
- P1 Multi-floor mall and enterable shops, sittable chairs, doors that open.
- P2 Engine extraction and streaming: split the current monolithic v11 script into engine modules (interaction registry, seat anchors, streaming); district chunking.
- P3 Singapore districts. P4 Malaysia districts.

## Constraints
Browser first; mobile must work; reuse Blender-3D-Gallery models before requesting new ones; icons from SVG-Icon-Studio; v11 PWA zoom locked; no GitHub Actions; verified product facts only; independent concept footer kept.

## Done means
Each phase passes tests, advisor review against the concept image and the manager's own look at real screenshots at 390, 768 and 1440 widths, then ships to main with the Pages deploy confirmed.
