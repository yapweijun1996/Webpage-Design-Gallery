# GJH v11 ambient NPCs

The ambient system reuses the already loaded v2 chibi visitor scene and idle, walk and sit clips. Each visitor has its own skeleton and mixer. Compatible opaque leaf meshes with identical transforms, bindings and materials are merged once into a frozen NPC template; merged buffers are shared by visitors and disposed with the system. Other geometries, materials, textures and clips remain shared with the player. Animated mesh targets, transparent parts and incompatible bindings are not merged. No model downloads, physics bodies, interactions, raycasts or prompts are added. NPCs yield to the player and keep their distance from one another.

## Policy

| Graphics tier | Desktop maximum | Mobile maximum |
| --- | ---: | ---: |
| Low | 2 | 1 |
| Balanced | 4 | 2 |
| Detailed | 6 | 3 |

These are simulation ceilings, not guaranteed visible populations. `enabled:false` and `?npcs=off` disable visitors. Missing v2 source or clips also disables them without a download. NPCs never cast shadows; they reuse the current world's lighting and shadow maps.

Admission uses **this frame's measured non-NPC cost**, not the previous camera view. The host first hides NPCs and renders the mall once. Desktop Detailed retains main's full-resolution base, quarter-resolution selective glow and final composite, under the same expanded/ground-floor/width conditions. Glow is measured before admission and its single composite draw is reserved. Unknown headroom hides every NPC.

For measured non-NPC cost `B` (including the composite reservation), conservative template cost `C`, population/tier ceiling `L` and optional NPC-only allowance `A` (default 200), capacity is `min(L, floor(min(200 - B, A) / C))`, clamped at zero. Insufficient headroom cuts admission immediately, before any NPC draw. Growth requires eight consecutive safe rendered frames with four extra calls beyond the next visitor's full cost; admit only one visitor per eight frames. A sudden yaw, moving door, LOD change or lift transition cannot reuse stale headroom. Counts can therefore fall below the tier ceiling.

Admitted visitors render through exclusive layer 2 into the existing base color/depth, with clearing and shadow updates disabled. This resubmits **only NPC geometry**, not the mall. Direct rendering uses one mall submission plus an optional NPC submission. Bloom uses base + selective glow + optional NPC + composite; NPCs off use exactly main's three submissions. Frame counters accumulate all submissions rather than reporting only the last render.

Visitors are created within 18 m of the player and removed past 22 m, on a different floor, or within the player's personal space. Route candidates are authored for each mall layout; the actual world physics is queried for clearance at spawn, along the candidate segment, and during movement. Blocked candidates are skipped. NPCs do not travel to upper floors. Accessible registered ground-floor seats may be occupied only when their approach is clear and the player is not using them. A seated visitor leaves after 18 seconds, followed by a seating cooldown, allowing walking even when the rendering budget admits only one visitor.

`state.callsPerNpc` counts every potentially visible material pass of the frozen template, including double-sided transparency, without relying on frustum culling. Actual submitted NPC cost may be lower when visitors are offscreen. Simulation continues at the tier ceiling while budget-hidden; upper-floor visitors are removed under the existing ground-floor-only policy.

## Adding a visitor route

Add a ground-floor waypoint to `NPC_ROUTES` in `assets/npcs.js` for the applicable layout, on an existing public walking route. The system spawns visitors from these points and chooses reachable nearby points; runtime Rapier clearance checks reject obstructed points and segments. Add a layout validity case to `tests/gjh_npcs.test.mjs` and verify the route in the rendered mall. Visitors use the shared rig and clips; do not register them as interaction targets.

## Host contract

When V2 is the player, pass the loaded V2 GLTF from `player.npcSource` to `createNpcSystem`. With the Tripo player, `loadNpcSystem` loads a separate V2 source after the first frame unless `?npcs=off` is set. NPCs are optional if the V2 source fails. V1 has no NPC source. Call `update(dt, player.state)` each simulation tick. Before player sitting, call `releaseSeat(id)` and pass `player.state.seatId` so the player's seat takes precedence. Apply partial settings with `setQuality({tier, mobile, enabled, drawCallBudget})`. `setDrawCallBudget(value)` changes the extra NPC-only allowance within the 200 total cap. Call `dispose()` on teardown.

`createMallAtmosphere.render(camera, bloomEnabled, npcs)` owns the frame protocol: `setVisible(false)`, mall/glow measurement, `admit(nonNpcCalls)`, isolated NPC submission, composite. `setVisible` only hides/restores the current admission; it does not advance hysteresis. `nextNpcAdmission(previous, options)` is the pure policy used by Node tests. NPC `state` reports tier, availability, simulation limit/active, admitted/visible, conservative draw calls, per-NPC cost, capacity, headroom, safe-frame streak and occupied seats. `window.__mall.state.renderBudget` exposes measured non-NPC/NPC/total calls, admission, Bloom use and submission count.

The NPC system never owns or disposes the shared player assets. Scene physics and the player's collision controller remain authoritative; NPCs do not obstruct movement or sitting.

## Tuning

- Keep the 200 total-call cap fixed. Lower `drawCallBudget` for an extra NPC-only ceiling; never use it to infer non-NPC headroom.
- `nextNpcAdmission` contains the eight-frame growth delay and four-call growth margin. Increasing either makes admission more cautious. Cuts must remain immediate and unknown measurements must remain hidden; keep the boundary/hysteresis Node tests aligned.
- To reduce `callsPerNpc`, author compatible opaque parts/materials. Do not merge independently animated targets or transparency, discard visible parts, change the player model, or disable Bloom to increase population.
- Observe `renderBudget`, not a single `renderer.render` counter. Direct frames have 1–2 submissions; desktop ground-floor Detailed has 3–4. The optional submission is NPC-only.

## Submission and Bloom evidence

At the same desktop Detailed atrium view, main with NPCs off submits **116 base + 3 selective-glow + 1 composite = 120** calls. With main's NPC system active, it submits that entire pipeline twice: **240 actual calls**, while its reset counter still reports only 120. The glow submission is layer 1 only, not a second full-world draw.

The replacement keeps the NPC-off sequence at **116 + 3 + 1 = 120**. The 1440 × 900 comparison pair `~/omp-tasks/out/npc2-bloom-{main,branch}.png` has identical pixels (RGB difference zero), with NPCs off, the same camera, tier and view. The browser budget probe independently checks base/glow/NPC/composite masks, call sums, clearing and shadow-update state.

All new frame totals include shadow draws (`renderer.info.autoReset=false`) as well as every color/post submission. Main's direct path reset its counter after shadow rendering: classic v1 at startup reported 147 although it submitted 205. Classic floor-contact shadow quads now use the existing instance batching path with their original shared texture, color and transforms. Expanded floor-contact quads and desktop Bloom/lighting are unchanged.

## Measured budget (Chrome Metal, 2026-11-17)

`tests/browser_gjh_v11.py`: **RC=0**, log `~/omp-tasks/out/npc2-browser.log`. The six viewport/tier runs observed **3,131 rendered frames**, including full yaw sweeps, a verified instantaneous 180° camera turn, door open/close, walking approaches and real elevator travel. Maximum total across these runs: **194 calls**. The conservative template cost is **12 calls per NPC** in every tier; independently observed NPC submissions reached 12 per fully submitted visitor (48 for four). Offscreen/partially culled visitors cost less.

Triples below are **Low / Balanced / Detailed**. `B` is measured non-NPC calls at yaw 0 after the sweep (mid-travel for the lift); admission ranges cover the state's orbit, not a promise of a fixed population. `Max` covers the entire orbit, or the entire lift transition, and includes NPCs, shadows and postprocessing.

### Desktop 1440 × 900

| State | B, L/B/D | Admitted, L/B/D | Max total, L/B/D |
| --- | --- | --- | --- |
| Atrium | 82 / 82 / 120 | 2 / 4 / 5 | 105 / 120 / 158 |
| New Moon open | 94 / 94 / 135 | 2 / 4 / 3–5 | 138 / 150 / 187 |
| MILI open | 106 / 106 / 149 | 2 / 4 / 4 | 127 / 139 / 194 |
| GOGO open | 86 / 86 / 129 | 2 / 3 / 3–4 | 140 / 140 / 183 |
| Upper deck | 95 / 95 / 131 | 0 / 0 / 0 | 100 / 100 / 136 |
| Lift, mid-travel | 81 / 81 / 119 | 0 / 0 / 0 | 114 / 138 / 164 |

Closed-door sweeps: New Moon has the same B/admission ranges/maxima as open; MILI likewise. GOGO closed admits **2 / 4 / 3–4**, with maxima **140 / 152 / 183**. Ground-floor Detailed non-NPC orbit ranges are atrium **90–131**, New Moon open **116–155**, MILI open **133–150**, and GOGO open **109–159**. The six-NPC simulation ceiling was exercised at New Moon, and six admissions were observed during the screenshot route; the atrium sample had only five route-clear visitors. GOGO Balanced had three during its open-door sample and four after closing, due to population/route availability.

### Mobile 390 × 844

| State | B (all tiers) | Admitted, L/B/D | Max total, L/B/D |
| --- | ---: | --- | --- |
| Atrium | 54 | 1 / 2 / 3 | 85 / 94 / 104 |
| New Moon open | 83 | 1 / 2 / 3 | 96 / 108 / 120 |
| MILI open | 98 | 1 / 2 / 3 | 110 / 110 / 110 |
| GOGO open | 81 | 1 / 2 / 3 | 108 / 110 / 110 |
| Upper deck | 88 | 0 / 0 / 0 | 90 / 90 / 90 |
| Lift, mid-travel | 75 | 0 / 0 / 0 | 91 / 91 / 92 |

Closed-door maxima are New Moon **98 / 109 / 121**, MILI **110 / 110 / 110**, GOGO **108 / 110 / 112**; B and admission counts remain as above.

The lift is **FOUND and measured in motion**, not inferred from either landing. A focused repeat (`~/omp-tasks/out/npc2-lift.log`, RC=0) captured 36 travelling frames per viewport/tier: admission ranges were desktop **0–2 / 0–4 / 0–6**, mobile **0–1 / 0–2 / 0–3**. Visitors disappear as the rider leaves their ground-floor range; the table's midpoint is therefore zero. Non-NPC travel ranges were desktop **81–99 / 81–99 / 119–135**, mobile **72–91** in every tier. Focused repeat maxima were desktop **114 / 138 / 152**, mobile **91 / 91 / 102**; population positions differ from the full shop/sweep route, whose transition maxima are listed above.

Screenshots `~/omp-tasks/out/npc2-1440.png` and `npc2-390.png` each show two real NPCs, with the tutorial dismissed. Their screenshot-only smoke passed (RC=0). Desktop Detailed Bloom was asserted active on every ground-floor frame; upper-floor direct rendering retained main's eligibility rule. No camera/framing, loader, icons or interaction-registry behavior changed. Physical-device performance remains unverified.

Other required checks passed (RC=0): generated `build_gallery.py --check`, all `gjh_*.test.mjs` (86 passed, one optional icon-catalog check skipped), 12 `test_gallery.py` unit tests, and `check_ssot.py`.

In the expanded mall, walkers can select adjacent arcade waypoints up to 12.5 metres away. The walking rig faces the direction of travel, and seated poses face the accessible side of the bench. Run `python tests/browser_gjh_npc_facing.py` to verify the skinned face orientation and movement against the live mall colliders.
