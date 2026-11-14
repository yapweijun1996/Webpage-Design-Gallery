# V11 Shelf focus implementation plan

Selected task: Phase 7 Shelf focus only, after contextual navigation release
27414203881ba54d0a30231493699ad7bc4e11c7 (1.1.38, build 7df78238a03883bb).
The prior task passed CI 43640214680 and live 390/1440 source/flow verification.

## Current evidence and decisions

The proposal in gjh-v11-shelf-focus-scope.md predates M056 and Visitor v2.
Current products.js is authoritative: four M056 shelf instances, three tiers of
three native-scale cans per SKU, 36 total. The four existing records/packshots,
asset hashes, collisions, model geometry/materials and physical pickup/return
remain authoritative. Demo bag changes quantities only; Shelf Add must not remove
or reserve a physical can. No new SKU, price, stock, order or checkout is allowed.

Implement the reserved Shelf overlay in the canonical lifecycle. Its UI projects
that state; the mode manager remains the sole gameplay pause owner. Inspecting a
nearby New Moon shelf opens a bounded close-up and sheet, rather than immediately
opening the existing detail dialog. Non-shelf inspection preserves its contract.
The contextual five-item navigation stays hidden in Shelf.

A compact nearby card uses the existing official packshot and product name, one
Inspect action and a subtle whole-shelf highlight. No individual-can highlight or
new 3D geometry/texture/fetch is authorized; a projected DOM outline may reuse
canonical shelf bounds. Reuse loaded geometry and shelf metadata. Selecting any
can in a shelf close-up maps to that shelf's one existing SKU, never a new variety.

The Shelf sheet has a name, concise unofficial/demo disclosure, Inspect details,
Add to demo bag, Back and Close. All controls are at least 44px. Inspect details
is an explicit handoff: restore/close Shelf before opening the existing native
product dialog, as the proposal requires other modal entry to cancel Shelf.
The detail dialog then returns to the surviving interaction owner. Other native
modals, List, blur, hidden document and graphics fallback also cancel cleanly.
Close, Back, Escape or backdrop restore the exact prior player position, posture,
camera pose and connected focus owner; stale pointers/keys cannot resume movement.
Reduced motion cuts directly to the close-up. Resize reframes the full shelf
above its sheet and restores a valid responsive camera on exit.

Only a temporary presentation camera may animate while gameplay is paused; do not
advance physics, doors, character actions or injected movement to render Shelf.
Do not introduce a second pause authority, silent forced mode transition, fake
state or permanent change to the normal camera. Existing Cart/Seated lifecycle
and physical pickup ownership must remain intact.

## Acceptance and verification

- Four SKU mappings and actual New Moon approach/F/pointer/touch paths work;
  non-SKU stores, kiosk, Original tin and directory detail flows still work.
- All four complete shelves and the sheet fit at 390x844, 320x568, 844x390,
  667x375, tablet and desktop. Nearby card, disclaimer, header and controls do not
  overlap, overflow or obscure actionable focus. Keep the added portrait Explore
  card compact (approximately 12% of viewport height including its action).
- Close/Back/Escape/backdrop, detail/Bag/List handoff, repeated entry, held input,
  resize, blur/visibility, real context loss and asset failures are exercised.
- Exact camera/player restoration and canonical mode/layers/pause legality are
  asserted; each Add changes only the shared demo quantity and respects max nine.
- Existing six-mode, context navigation, product preview, accessibility, Bag,
  physical pickup, map, gallery and PWA contracts are preserved. Fixtures can be
  reconciled only where this task intentionally changes shelf entry; preserve
  all underlying assertions and add explicit Shelf coverage.
- Measure source-matched resource/draw-call/GPU observations against 1.1.38;
  do not relabel old resource ceilings as passing or weaken limits.
- Actual final frames, strict geometry, keyboard/touch and independent visual
  review >=85/100 are required. Software safe-area stress is separate from real
  devices. Physical iPhone/Android, Safari, screen readers, device FPS and full
  packaging fidelity remain unverified without that evidence.

One task-specific commit/push follows verified acceptance. Release metadata,
task.md and Git publication belong to the parent manager. No other pending task
is completed implicitly by this implementation.

## Review clarifications and measured HUD baseline

Independent plan review approved the architecture with these acceptance details.
The 36 cans are configured placements: an existing physical pickup temporarily
hides one instance until return, so a held can can leave 35 on shelves. Shelf Add
must not affect these matrices, reservation flags or the held-product token.
Exact camera pose restoration is checked synchronously at close with the same
viewport; after resize preserve logical orientation/owner with valid responsive
projection. A modeless dialog can retain header actions; its shelf/can target
must be an actual owned reachable control, not a presumed active inert canvas.

Parent measured the published 1.1.38 full nearby prompt at 120.59px for all four
SKUs, both 320x568 (21.2%) and 390x844 (14.3%). The historical approximately 12%
figure is an advisory compact-card target, not existing full-HUD certification.
Physical Pick up/Return and its accurate visible notice are required compatibility.
Measure the added identity/card row and combined prompt separately; do not shrink
targets or hide the physical-product notice to manufacture a percentage.

The first prototype's approximately 155px combined prompt was rejected in visual
review: moving the existing physical action to a second 44px row increased avatar
obstruction. Prefer a small noninteractive identity thumbnail and concise existing
country/type/weight label (full accessible name), both actions on one 44px row,
and the physical notice below. Preserve or improve the approximately 121px full
prompt envelope and actual avatar-critical, Map/Help, joystick/Run and disclaimer
clearance. Verify 320/390, the longest label and held/returning states.
