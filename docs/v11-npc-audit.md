# GJH v11 modular NPC audit

The integration targets revision `3545bb9d`, which includes interiors for all 17 expanded shops, the loader warm stage, updated HUD, signage and camera. The audit covers the existing scene and the modular wardrobe introduced in packages 1 and 2.

## Rendering and walkable layout

- V11 uses local Three.js r170 (0.170.0), its matching GLTFLoader and BufferGeometryUtils, and Rapier compat 0.21.0 with local WASM. [Mall README](../demos/corporate/gjh/v11/README.md)
- `world.js` builds one metre-scale scene with instanced architecture, repeated products, shared-atlas signage, doors, fixtures and Rapier colliders. The player is a kinematic capsule with a collision-constrained spring-arm camera. The host advances fixed 60 Hz physics and renders the current camera. Interior geometry loads by tier and proximity, shares a frame-budgeted upload scheduler, and is preinstalled during normal loader warm-up. [World source](../demos/corporate/gjh/v11/assets/world.js) · [Host source](../demos/corporate/gjh/v11/script.js)
- The expanded ground floor is 70 × 60 m, with two lounges, a public arcade, 17 walkable shops and automatic sliding doors. The lift connects a +7.2 m viewing deck. Classic mode provides the three original shops. Ambient visitors spawn on the ground floor within 18 m of the player and cull beyond 22 m. Route segments and bench approaches use collider clearance; visitors yield to the player and rotate along their routes. [Expanded layout](../demos/corporate/gjh/v11/assets/expanded-layout.js) · [NPC routes and seats](../demos/corporate/gjh/v11/assets/npcs.js)
- The default player avatar is Tripo. Visitor V2 remains selectable and supplies the compacted fallback crowd, with V2 model resources shared when applicable. The optional Tripo boy occupies one existing slot; his LOD, seated pose and animation lifecycle already belong to the NPC system. The accessible store directory handles loss of WebGL or JavaScript. [NPC behavior](gjh-v11-npcs.md)

## Constraints and design weaknesses

| Tier | Desktop maximum | Mobile maximum |
| --- | ---: | ---: |
| Low | 2 | 1 |
| Balanced | 4 | 2 |
| Detailed | 6 | 3 |

The 200-call cap covers the current mall, NPC overlay, shadows and applicable desktop Detailed bloom submissions. The renderer measures the mall first and admits NPCs from remaining headroom. It cuts admission immediately and grows after eight safe frames with a four-call margin. Mobile Low has DPR 1 and no real-time shadows. The acceptance probe is a 393 × 612 Low walk through 17 shops, with zero intervals of 50 ms or more. [NPC render policy](gjh-v11-npcs.md) · [17-shop probe](interiors_probe.py)

The large floor and long side arcades spread visitors across the camera's local view. At aisle turns, shop thresholds and occupied bench approaches, clearance and camera framing can make the space look empty even with active visitors. The upper deck is a separate destination and sits outside the crowd's ground-floor policy. The published route logic sends walkers along public lanes; that creates shopper movement but cannot communicate shop staff, security or guide roles. The small capacity also makes visual repetition easy to notice.

V2's repeated silhouette and the single Tripo boy give limited outfit variation. The verified modular selection has one neutral base and one bob. Hair and body tint and a small scale range provide some visual variation today. Distinct uniforms, optional clothing layers and further body silhouettes depend on fit-verified exports. The wardrobe has standing and walking motion available; the reviewed base does not have an approved mall bench pose. [Wardrobe receipt](../demos/corporate/gjh/v11/assets/chibi-crowd/manifest.json)

## Integration plan and scope

1. Keep the present shop geometry, walking routes, bench ownership, product interactions and official links. Change appearances on existing walkway visitors through the same admission renderer and use the current V2 and Tripo seat poses.
2. Select verified modules from a local manifest using a seed and each visitor's spawn index. Choose a compatible body, hair, top, bottom and shoes where available. Use shared mesh buffers and one skeleton per outfit. Prepare new renderables through the existing staged GPU queue.
3. Retarget idle, walk, wave and nod from the motion library and apply the relaxed hand pose. Use route pauses for brief gestures. Honor the mall's pause state and reduced-motion preference. Keep Mobile Low on the existing models to protect the smallest frame budget.
4. Publish the verified local assets with the mall and cache them on demand by release hash. Keep the reconnect screen as the offline navigation fallback. Exercise count, animation, pause, error fallback and overflow in tests, then run the native Chrome/Metal walk probe before release.

## Measured and pending evidence

The body and bob account for 12,506 triangles and two opaque material passes per outfit. The four GLBs total 1,146,484 bytes. The Node integration fixture loads the shipped models and exercises six admitted desktop Detailed visitors with five modular walkers and one Tripo boy. The 600-tick sample takes 217.53 ms total (0.36 ms per tick) on one local Node run alongside the related tests. It includes simulation, animation evaluation, budget admission and state reads with stubbed collision queries and no GPU. No 15-visitor render sample applies to the revised ceilings.

A separate Node run with the expanded scene and Rapier colliders admitted two Balanced mobile visitors in the atrium, including one modular visitor that idled, nodded and walked. An in-memory worker fixture exercised the five cache entries, rejected tampered bytes and returned saved responses offline. A local, intercepted Chromium run confirmed a 390 px document at the arrival screen and in the WebGL fallback directory, with no external requests.

The required HTTP browser suites could not bind a loopback port inside the managed sandbox. Chrome exited during launch for the Metal walk probes, leaving their frame interval and draw-call measurements unverified. Physical iPhone performance, Safari, live WebGL appearance and service-worker cache behavior also remain to be checked.
