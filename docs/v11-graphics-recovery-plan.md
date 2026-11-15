# V11 graphics recovery and quality plan

## Scope and baseline

One task: `WebGL context-loss recovery and low-end quality tiers.` Base main
`36d56c49283a4e1a794ba0ec15650aea85bdc615`, application 1.1.40. The target task
was independently accepted and remotely verified before starting this task.

Current loss handling prevents default, clears transient input, closes Shelf,
stops frames and exposes the complete directory. It never handles restoration.
The pinned Three.js renderer already rebuilds its internal GPU state on the native
restore event; the application must coordinate readiness and safe re-entry after
that renderer handler. Current desktop capability/width heuristic toggles shadows;
mobile DPR is capped at 1.25 for v2. No low-end profile exists.

## Decisions and ownership

- Retain one renderer, physics world, input owner and mode pause owner. Do not
  rerun initialize, install duplicate listeners or invent a second mode manager.
- Treat loss/restoration/availability separately. Existing fallback remains usable
  immediately, Bag selections and static records survive. Existing transient
  cleanup semantics remain; no stale joystick/collection/elevator action resumes.
- On actual restored event, wait until Three's own handler has rebuilt state,
  validate a real frame, and make an explicit return-to-3D action available. Do
  not force a user out of directory, Bag or a product dialog, or steal focus.
  A failed/unrestored context leaves the directory fully usable and offers a
  clearly labelled page reload recovery. Do not call the testing-only lose/restore
  extension as a production recovery mechanism. Avoid unbounded retry loops.
- Cover loss during initialization and restoration races. Async completion must
  not mark an interrupted renderer ready. No duplicate scene/assets/physics.
- Define explicit low, balanced and detailed profiles in one small owner. Auto
  chooses low for reported constrained hardware, balanced for narrow/unknown
  hardware and detailed for capable wide screens, preserving current healthy
  mobile/desktop appearance. Low caps DPR at 1 and disables real-time shadows;
  balanced caps narrow DPR at existing 1.25 and wider at a bounded value without
  real-time shadows; detailed caps DPR at 2 and wide-screen shadows only.
- Provide an accessible manual Low option (Auto and existing normal quality
  choices as appropriate) inside existing Help/settings, not another always-on
  HUD panel. Storage optional, guarded and validated. No FPS/device-performance
  claims, no adaptive oscillation, physics/labels/content/collision changes or new
  external models/dependencies. Low resolution/shadows reduce rendering work,
  not downloads. Explain the visible consequence in ordinary user language.
- A restored scene may use Low conservatively. Preserve static record/quantity
  truth and do not claim physical-product state survived if fallback reset it.

## Acceptance

- Native WEBGL_lose_context event and actual restoreContext test at 390/1440;
  loss during Explore, Shelf, Inspect, Shop, Cart/Seated and during initialization;
  restored correct scene/textures, all four products/M056 and movement remain
  functional; complete directory and focus never disappear while waiting.
- Explicit user re-entry, hidden/blur/restoration/resize race, repeated cycles,
  genuine failure and no-WebGL/no-WASM paths. No page errors, illegal transitions,
  duplicate listeners/assets/scene resources, stale gesture or background movement.
- Hardware overrides are labelled fixtures. Verify exact DPR/shadows/profile at
  core widths/DPRs and explicit selection, bad storage, missing hardware hints,
  reduced motion and actual screenshots. Compare source-pinned baseline bytes,
  draw calls and buffers; use 10MiB/200 draw budgets and report resource delta.
- Keyboard, visible focus, names, 44px controls, 320/390/667/844/768/1440 layouts,
  affected breakpoint edges and existing software safe-area profiles. Actual
  frames inspected; independent review >=85 required for changed UI.
- Focused new suite plus modes13/165, review15, navigation/insets, axe70,
  Shelf12/all4SKU, target guidance, fullV11, relevant Bag/preview regressions.
  Preserve strict synchronous restore and bounded post-resume contract.
- Parent owns 47 Python/generator/SSOT, required Gallery/legacy/PWA, generated
  artifact-prefix check, task/version/generated updates, focused main push,
  remote SHA/CI/Pages and actual live acceptance. No next task until delivered.

## Evidence and limitations

KB reuse retrieval found generic QA context, no WebGL-specific verified prior art.
Current pinned Three.js source is authoritative for renderer restoration. Primary
references: https://registry.khronos.org/webgl/specs/1.0/ and
https://wikis.khronos.org/webgl/HandlingContextLost ; reference docs:
https://threejs.org/docs/pages/WebGLRenderer . Inspect actual pinned implementation
and real Chrome behavior rather than assuming current upstream matches the vendor.
Physical devices, Safari, actual safe areas, screen readers, device FPS and full
packaging fidelity remain unverified and are separate unchecked tasks.
