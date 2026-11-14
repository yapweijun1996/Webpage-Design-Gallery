# V11 interaction target guidance plan

Selected task: Phase 7 interaction target highlight and distance hint only.
Base: a88fd1ccb7430e124732373ec40476085c2364f5, application 1.1.39,
build 276a97a8850f6aaf. Shelf passed CI 43645553904 and live 390/1440
verification before this task was selected.

## Existing behavior and boundaries

script.js updateHUD owns nearest-target selection, using the existing horizontal
interaction-point distance/radius, floor checks and bench approach-side filter.
World/product/elevator modules own their actual anchors and assets. Shelf already
has a projected whole-shelf outline and a separate presentation target. There are
four New Moon shelves, MILI/GOGO brand displays, the entrance kiosk, eight benches
and two floor-specific elevator anchors in default Visitor v2. Legacy v1 has no
elevator. The guide/map, native details, physical pickup, seats, Cart, Shelf,
Demo bag and fallback contracts remain authoritative.

Implement a clear spatial cue for the currently selected existing interaction
and an approximate distance hint. Use the same selected record and distance as
the actual action; do not introduce another nearest search, change radii or
collisions, gate actions by camera direction, or invent targets/SKUs. Reuse the
whole-shelf cue rather than drawing duplicate Shelf outlines. For other targets,
reuse owner-provided transforms/bounds or an explicitly identified interaction-
point marker; do not claim an approximate interaction-area proxy is an exact
mesh silhouette. The cue must visibly identify the selected object/interaction
area in actual views. Hide behind-camera/offscreen/invalid projections rather
than leaving a stale rectangle, marker or another floor's target.

Reuse existing geometry/materials/textures; no new 3D assets, icons, effects or
framework. A small shared DOM projection helper is justified only for the actual
Shelf/guidance callers. Keep presentation separate from gameplay, with one owner
for projection/selection/availability. Native action controls stay the action
owners; guidance must not enable disabled actions or alter their explanations.

## Distance and availability

Use finite horizontal distance to the existing interaction point, rounded to a
useful one-decimal metre value. Make the approximation/demo interaction-point
meaning visible or discoverable in existing How to explore content and in the
accessible description. Do not imply a surveyed physical store distance. Update
stable values without frame-by-frame live announcements; announce a newly
selected target once and preserve readable full action names. Do not add noisy
continuous aria-live distance updates.

Guidance is for the eligible nearby walking/Cart interaction. Keep Seated Stand
and existing blocked-action explanations intact. Clear/hide it on Menu, Inspect,
Shop, Shelf, hidden/blur interruption, List and graphics fallback without waiting
for a gameplay tick. Pause remains exclusively owned by modes.js. Returning to a
running mode, viewport changes, camera turns and target changes must project the
current owner; no stale target/floor or hidden-focus side effect is allowed.

## Layout and verification

Preserve the approximately 121.59px current combined New Moon prompt, its compact
identity, full accessible country/name/weight, two 44px actions and visible
physical-product notice. Prefer an inline distance treatment, not another row.
Other target chips must keep meaningful labels/actions, 44px controls, visible
focus and no horizontal overflow or overlap with header, Map/Help, avatar-critical
view, joystick/Run or disclaimer. Use current design-system tokens and current
semantic color/focus treatments. Any spatial marker is decorative, pointer-safe
and not a new misleading action control.

Verify all target categories and all four SKUs through actual movement and normal
F/pointer/touch actions. Check distance correctness, rounding, value changes,
range exit, wrong-floor exclusion, camera-away/near-plane cases, rapid target
switches, disabled bench/Cart paths, carrying a physical can, retained Seated/Cart,
mode overlay round trips, resize, blur/hidden handling and real context loss.
Keep actual browser events distinct from fixture-backed interruption coverage.

Use 320x568, 390x844, 667x375, 844x390, 768x1024 and 1440x900 plus both sides of
changed breakpoints and existing software safe-area profiles. Take real frames
for kiosk, shelf, brand display, bench and both elevator levels. Measure text,
focus, target hit testing, cue geometry, combined prompt height, resource/draw
calls and repeated lifecycle/GPU balances against the pinned base. Preserve
current laboratory ceilings (10 MiB decoded resources / 200 draw calls); record
actual deltas and do not relabel stale historical ceilings as passes.

Run focused guidance tests and relevant Shelf, modes, mode-review, navigation,
accessibility, physical pickup/return, map and V11 regressions. Parent runs the
required Gallery/legacy/PWA, generation, unit and generated-prefix checks. A
source/actual-frame independent review >=85/100 is required before task.md,
release metadata, one focused commit/push, CI/Pages and live verification.
Physical devices, Safari, screen readers, device FPS and packaging fidelity remain
separate gates. Graphics recovery/quality tiers and commerce are not part of this
task.
