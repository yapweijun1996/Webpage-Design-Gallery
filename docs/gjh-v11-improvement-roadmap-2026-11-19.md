# GJH v11 improvement roadmap (owner feedback of 2026-11-19)

Source: owner feedback in the 2026-11-19 session plus four read-only studies by Codex CLI workers (character quality, shop layout and interactive furniture, physics and movement, lighting) and the earlier performance research (`docs/gjh-v11-performance-research-2026-11-19.md`). A fifth study (mall train) is tracked in `task.md`. Claims below are estimates until measured with `docs/mall_lap_probe.py` and `docs/mall_video_probe.py` on real devices.

## Owner feedback, restated

1. Character detail looks blurry and poor on desktop.
2. Each of the 17 shops needs a layout (where each furniture piece, plant and prop goes, which models and furniture variants are needed), and every placed item must be usable (sit, open, pick up, try, press, play).
3. Walking is too slow.
4. The biggest problem is lighting, then shop layout and furniture placement.
5. Some things behave strangely; a physics engine may be needed for props.
6. A train or tram that circles the mall so the visitor can ride and see all 17 brands with introductions.
7. Testing should include recorded gameplay clips (10-15 s, several times) to catch flicker and stutter (done: `docs/mall_video_probe.py`).

Targets (owner decisions): phone 30 FPS (starts on Low), tablet and PC 60 FPS, dynamic resolution first, then tier downgrade. Real devices available for testing: iPhone and an Android phone.

## Findings

### A. Character clarity
- The shipped player is 11,764 triangles with a 1K texture (source 39,214 triangles, 4K); the Tripo boy NPC 6,313/2,630 triangles with a shared 512 texture; one flat base-colour map, roughness 0.9, no normal map (`assets/gjh-tripo-visitor-source.json`, `assets/npc-tripo.js:62`).
- Default chase camera 5.2 m, LOD drops beyond 11 m (`assets/player.js:19`, `assets/visitor-v2-lod.js:60`); no anisotropy or mip bias for avatar textures; the base target has no MSAA so silhouettes stay aliased (`assets/mall-atmosphere.js:138`).
- Avatar lighting is the shared warm key and fill, no rim light.

### B. Shop layouts and interactive furniture
- 17 shops have 136 prop configurations, 42 tiered main models and 17 detail packs; position, collision and action data come from different places. 59 GLBs have no embedded animation and the loader merges meshes per material, so movable parts (drawers, bells, piano keys, liquid level) need preserved nodes.
- Defects found: New Moon back cabinets touch wall decor and leave 4 cm pick-up clearance; MILI plates sit at 1.165 m while the counter is 1.22 m; GOGO has a coffee table blocking both planned routes (a Rapier probe stops at z = 1.63 while the table exists). Fourteen more shops have focal-point or occlusion issues (listed in the study table, kept in Phase 4).

### C. Lighting (owner: biggest problem)
- Global light is set by the theme (`assets/mall-themes.js:13`, applied by `assets/world.js:26-41`): cold sky 0xe5eef0, a 2.6 key like a sun, a cold fill, grey fog 0xb7ad9c, ACES exposure 1.08. Editing `world.js` alone has no effect.
- About nine per-pixel point lights (one permanent per shop door at intensity 45 and six accent lights, `world.js:706`, `assets/mall-atmosphere.js:61-95`).
- Reflection environment is a dark brown box (intensity 0.4); 174 GLBs have zero AO maps and zero UV2; phones are pinned to Low where light strips, wash and bloom are off; shadows only on Detailed wide screens with a 768 map over 40 m (about 5 cm per pixel).
- The mall shell and storefronts are generated geometry, not GLBs, so baking goes through a diagnostic GLTFExporter pass or planar top-down baked maps.

### D. Physics and movement
- Rapier 0.21 (WASM) is in use. Speeds: walk 2.65, run 7.5, cart 1.8 m/s; phone joystick starts in run with an 8 px dead zone and speed follows input directly; the render loop uses the latest 60 Hz step, so 75 and 120 Hz show judder; sit/stand/teleport/cart enabling call `physics.step()` extra times (`assets/player.js:180,343`, `script.js:508`).
- The cart uses a 2.8 m cylinder, the S04-S17 doors are 2.48 m wide, so the cart jams; interior boxes are active before models and can leave invisible blockers; the chase camera also checks axis-aligned boxes of rotated furniture (`assets/player.js:488`, `assets/world.js:833,943`, `assets/interiors/runtime.js:73`).
- Product cans interpolate between shelf and hand without contact checks; NPCs avoid the player but can overlap when the player rushes.

## Target designs

- Movement: desktop walk 3.4 m/s and Shift run 5.2 m/s; phone joystick full push 3.1 walk and 4.5 run, walking by default, explicit Run toggle, dead zone 12%; acceleration 10 and deceleration 18 m/s2; Q/E 140 deg/s; step height 0.18 m; one physics step per tick with render interpolation only; an 8 m shop crossing takes about 2.35 s (was about 3 s). Floors keep going through the lift; no jump.
- Physics scope: dynamic bodies only for one can, one basket and one ball first (release, drop, settle); seats, doors, cart, train and NPCs stay scripted or kinematic; at most 6 active bodies per zone on phones, simple proxies, sleeping, CCD only for fast props.
- Shop layout data: extend the interiors programme JSON with `zones` (polygons), `anchors` (local transforms on support surfaces), `items` (id, zone, anchor, xyz, yawDeg, scale, modelId, lod per tier, collision, action, a11y labels), reachable standing positions and touch distance. Circulation rules: 1.2 m main aisle, 1.5 m turning circle, sightline from the entrance to the brand focal item, entrance focus, side operation, return path.
- Interaction model: one generic state machine idle, focused, executing, done or cancelled with retry; stable ids; visible feedback; F key and a 44 px touch button; keyboard cycling and screen-reader text; both camera views share targets; state survives tier changes; lights toggle, plants water, seats sit.
- Lighting design (warm luxury, cheap): colour temperature 3500 K in public areas and 2700-4000 K per brand shop; top-down baked light and AO planes for floors and ceilings; blob contact shadows for furniture, avatars and NPCs; emissive cove strips; three IBL zones (atrium, corridor, shop) switched by swapping the environment map, not recompiling; dynamic lights fixed at one directional plus two focus accent lights; festival themes change parameters only; avatar fresnel rim light with a warmed-up program; shadows: blob only on Low and Balanced, a compact 1024 map around the player on Detailed.
- Character: close-up and fixed-pose baselines first; neutral fill and zone roughness for the avatar; 4x anisotropy on desktop and 1-2x on phone for avatar textures; MSAA or FXAA decision measured; re-bake from the 4K source with face and hair UV reallocation (desktop 1K/2K, phone 1K), a projected-height LOD ladder (player about 12k near, 6-8k phone; NPC 6-8k, 3-4k, 1-2k); a modular chibi trial after that.

## Phases and order (each step: goal, files, effort, dependency, acceptance)

Parallel lanes, one worker per lane at a time (lanes that edit the same files never run together):

- Lane R (render, files `assets/world.js`, `assets/mall-atmosphere.js`, `assets/mall-themes.js`, `script.js`): R1 fill-rate round (reduce per-pixel point lights, MSAA/FXAA policy, single-sided skylight glass, glow and wash on integrated GPUs, Balanced pixel ratio cap 1.25) then L1 warm theme values, L2 warmer three-zone IBL, L3 remove door lights and cut accents to two, L4 light strips on Low, L5 blob contact shadows, L7 avatar rim light, then L6 baked floor and ceiling planes, L9 Detailed compact shadows. Acceptance: `tests/browser_lighting.py` (8 poses x 3 tiers x 390 and 1440 widths, brightness mean, standard deviation, R/B ratio thresholds), no growth of `renderer.info.programs`, lap probe p95 not worse than 10%, video probe blink share within threshold.
- Lane M (movement and physics, files `assets/player.js`, `assets/camera-controller.js`, `script.js` input part): M1 baseline timing and displacement probe (8 m crossing, collisions, camera distance), M2 new speeds and one-step-per-tick interpolation (30/60/120 Hz replay endpoints within 1 cm, cruising error at most 5%), M3 passage fixes (cart contour sweep, door occupancy, GOGO table removal, camera box tests), M4 first dynamic props (can, basket, ball), M5 acceptance across 17 shops and tiers. Budget: physics and queries p95 2 ms and 1.5 ms per frame, zero frames at or above 50 ms.
- Lane S (shop layouts and interactions, files `assets/interiors/*`, `scripts/gjh_interiors`, `assets/interaction-registry.js`, `assets/ui.js`): S0 baseline and collision sweep that reproduces the GOGO block, S1 unified layout JSON and generator, S2 GOGO, then MILI, then New Moon wired interaction by interaction, S3 remaining 14 shops from the template, S4 interactive animation parts in GLBs (drawers, bell, piano keys, cup level). Acceptance: 17 unique ids, every item supported and reachable, aisles at least 1.2 m, interaction success 100% and zero mis-selection, both camera views, cancel and tier change, phone 30 FPS and PC 60 FPS.
- Lane C (character, files `assets/character-tripo*.js`, `assets/npcs.js`, `assets/visitor-v2-lod.js`, Tripo GLBs): C1 close-up baseline (native pixel PNG crops of face, hair, hands; the 960 px video analysis hides detail), C2 avatar lighting (with L7), C3 sampling and AA calibration, C4 re-bake and LOD ladder, C5 modular chibi trial.
- Lane T (train): see `task.md`, study pending.
- Lane P (probes and tests, `docs/*.py`, `tests/`): extend the lap probe with real device targets (phone 33.4 ms, tablet and PC 16.7 ms), GPU timer, refresh rate, shader program count; video probe `--route shops`; flicker and stutter reports after every lane step.

Immediately running: New Moon flicker fix (photo mip-mapping, coplanar decal offsets across all shops), dynamic resolution (done), performance budgets (done).

## Rules for every step

Edit sources, never generated files; regenerate with `scripts/build_*.py`; run `python scripts/build_gallery.py --check`, `node --test tests/*.test.mjs`, `python -m unittest discover -s tests -p test_gallery.py`; verify in headed Chrome (lap probe, video probe, screenshots) before pushing; phones stay on Low by default; never regress early-enter smoothness (zero frames at or above 50 ms on all tiers).
