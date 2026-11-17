# GJH v11 ambient NPCs

The ambient system reuses the already loaded v2 chibi visitor scene and idle, walk and sit clips. Each visitor has its own skeleton and mixer; geometries, materials, textures and clips are shared. It does not request another model, create physics bodies, register interactions, intercept raycasts or present prompts. NPCs yield to the player and keep their distance from one another.

## Policy

| Graphics tier | Desktop maximum | Mobile maximum |
| --- | ---: | ---: |
| Low | 2 | 1 |
| Balanced | 4 | 2 |
| Detailed | 6 | 3 |

These are ceilings, not guaranteed populations. A separate draw-call budget defaults to 30 calls; it counts every model mesh, including hidden customization alternatives, and can reduce the count further. It is an NPC-only allowance, not a guarantee that the whole scene stays under any particular draw-call limit. The host should choose a conservative allowance that accounts for the maximum non-NPC scene cost. No shadows are cast by NPCs. `enabled:false` is the off switch. Missing v2 source or clips also disables visitors without a download.

Before drawing visible NPCs, the host renders the current view without them and reserves their conservative mesh count against the 200-call limit. If it does not fit, the NPCs remain simulated but hidden for that view. This can render the scene twice per frame when visitors fit; physical-device performance is not established.

Visitors are created within 18 m of the player and removed past 22 m, on a different floor, or within the player's personal space. Route candidates are authored for each mall layout; the actual world physics is queried for clearance at spawn, along the candidate segment, and during movement. Blocked candidates are skipped. NPCs do not travel to upper floors. Accessible registered ground-floor seats may be occupied only when their approach is clear and the player is not using them. A seated visitor leaves after 18 seconds, followed by a seating cooldown, allowing walking even when the rendering budget admits only one visitor.

Use `?npcs=off` to disable ambient visitors. With the current 17-mesh model, the 30-call allowance admits at most one visitor despite the tier ceilings.

## Adding a visitor route

Add a ground-floor waypoint to `NPC_ROUTES` in `assets/npcs.js` for the applicable layout, on an existing public walking route. The system spawns visitors from these points and chooses reachable nearby points; runtime Rapier clearance checks reject obstructed points and segments. Add a layout validity case to `tests/gjh_npcs.test.mjs` and verify the route in the rendered mall. Visitors use the shared rig and clips; do not register them as interaction targets.

## Host contract

Expose the existing loaded v2 GLTF as `player.npcSource` (leave it undefined for v1), then create `createNpcSystem(T, {scene:world.scene, source:player.npcSource, seats:world.seats, physics, R, playerCollider:player.capsule, playerBody:player.body, expanded, mobile, tier, enabled})`. Call `update(dt, player.state)` each frame. Before the player attempts to sit, call `releaseSeat(id)` so the player always wins; pass `player.state.seatId` each update to prevent reoccupation. Apply graphics/viewport changes with `setQuality({tier, mobile, enabled, drawCallBudget})` and call `dispose()` on teardown. The settings are optional partial updates. `state` reports tier, enabled, availability, effective limit, active and visible counts, conservative `drawCalls` and `callsPerNpc`, and occupied seat IDs. `occupiedSeatIds` is also available directly.

The NPC system never owns or disposes the shared player assets. Scene physics and the player's collision controller remain authoritative; NPCs do not obstruct movement or sitting.
