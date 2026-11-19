# Ground sightseeing tram

The opt-in carriage follows the [surveyed ground loop](gjh-v11-tram-route-report.md). Only the south side of the entrance has a clear candidate landing. Enable the ride in the expanded mall with `?tram=1`.

| Stage | Implementation and dependencies | Acceptance |
|---|---|---|
| T2 — Single-station ride (implemented) | Start at the entrance. Register F/touch boarding, a moving seat anchor, and first-person or V chase view. Drive the car, seated body and exit state from one fixed-step clock. Lock walking while seated. Keep the exterior landing clear and check live occupancy before stopping or opening the exit. | Ride two laps without seat drift. Block boarding while carrying or pushing. Block a crowded exit, then restore walking, collision and the previous camera after a clear exit. Compare the chase framing at all four bends with the surveyed camera pocket. |
| T3 — Carriage and 17 introductions (done) | One open-sided carriage with a warm cream canopy, lacquered sill, brass plaque and two inward-facing benches. The rider occupies the front of the inner bench, facing the shops. The original 17 captions follow the surveyed route distances. | Each tier uses one opaque draw and one PBR material. The canopy strip and headlamp share an emission texture. Boarding waits for the sliced upload and GPU fence. |
| T4 — Three stations | Add the east stop after resolving S14/NPC landing conflicts. Prototype the western vertical rail, short bridge, opening in the gallery guard and interlocked gates beside the existing lift. Reroute affected pedestrians, wait for clear track and a clear landing, dock for eight seconds, and provide wait skipping and safe recovery from obstruction. | Verify boarding and alighting at each station, clear approach and egress, blocked-door recovery, alignment interlocks and the original lift round trip. Re-sweep the entire vertical journey and bridge before enabling the upper stop. |
| T5 — Accessible brand tour | Build on T3 captions with pause/resume, skip, end and optional speech. Provide keyboard, screen-reader and 44 CSS px touch controls. Offer a static card tour for reduced motion. | Pause keeps distance and narration synchronized. Skip or end cancels old speech. Every brand remains accessible with audio off; restore focus to the station on exit. |

## T3 carriage

The installed carriage measures 1.4 m across, 3.0 m along local +Z and 2.2 m high. The glTF root sits at ground level. `TramSeatAnchor` marks the cushion surface and inward yaw. `TramLamp` marks the lens centre. The body follows the anchor at simulation ticks, and the visible rider follows it at interpolated render time. The chase camera retains its surveyed track pocket.

| Export | Triangles | Budget | Draws |
|---|---:|---:|---:|
| Low | 875 | 900 | 1 |
| Balanced | 1,315 | 1,800 | 1 |
| Detailed | 2,723 | 3,000 | 1 |

The editable Detailed source is [gjh-tram.blend](../scripts/gjh-tram.blend). The [Blender builder](../scripts/build_tram_kit.py) recreates it and all three runtime exports. Lacquer, brass, timber, wheel metal and emitter values come from the signage kit. The canopy uses the interior print palette's cream. The embedded base, metallic/roughness and emissive swatches keep all finishes in one primitive.

```sh
blender --background --factory-startup --python-exit-code 1 --python scripts/build_tram_kit.py
node scripts/validate_elevator_glb.cjs demos/corporate/gjh/v11/assets/tram
node --test tests/gjh_tram*.test.mjs tests/gjh_npcs.test.mjs
```

The validator uses the Khronos `gltf-validator` package on Node's module search path. All three exports passed with zero errors and warnings. The no-browser smoke exercises real GLB parsing, delayed warmup, boarding, anchor tracking, both cameras and exit. The earlier Chrome timing covered the prototype. Frame times for the production carriage still require a foreground run of `docs/verify_tram.py`.

## Device acceptance

Use matched foreground runs with the debug flag off/on for T1 and with the ride off/on after T2. Follow the [probe protocol](gjh-v11-probes.md). On iPhone and Android start on Low at 30 FPS; target 60 FPS on tablet and PC. Record p95/p99, ≥50 ms frames, triangles, draw calls and dynamic render scale for cold entry, first lap and a warm ten-minute run. Require zero ≥50 ms early-entry frames. Enforce Low 220k/70, Balanced 300k/90 and Detailed 420k/110. Record separate short clips of turns and door approaches and compare each shop from the survey's seat pose.
