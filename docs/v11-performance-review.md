# V11 laboratory budgets and landscape controls

Baseline: public application 1.1.7 / main `4e6a0c13f91bb26d1f69f5afa1c9d1851582a4a3`. Runtime assets and rendering architecture are retained. This slice adds reproducible laboratory measurement and a CSS-only landscape control correction; it does not claim that the whole task plan is complete.

## Measurements and gates

On Linux ARM64 Chromium 158/SwiftShader, reduced motion, fresh browser contexts, local uncompressed HTTP and service workers blocked:

- Ready-stage resource payload: approximately 7.78 MB decoded, 36–37 resource timing entries. This snapshot excludes the navigation document, unfinished/deferred loads and HTTP protocol overhead; it is not compressed production traffic or a GPU-memory measurement.
- Rendering at atrium and the three store entrances: maximum 130 draw calls across 320×740, 390×844, 768×1024, 1440×900 and 844×390.
- The original demo-tin GLB is absent from initial resources. Five actual open/load/close cycles per viewport leave zero tracked viewer resources and zero live viewer contexts. These are application counters, not a driver-level memory-leak guarantee.
- Mall render count stays unchanged while the first-use guide or directory is active. No external-origin requests or page errors were observed.
- Regression limits: 10 MiB ready-stage decoded resource payload, 45 resources, 200 draw calls. Ready-time observations are recorded but not used as a universal speed SLA. Full resource manifests are in `docs/evidence/v11-budget.json`.

## Landscape correction

The expanded compact map obscured Run in short landscape viewports. Run now moves next to the joystick only when a coarse-pointer landscape map is open, and returns to its normal right-hand position when closed. No maps, store targets, movement logic or models were changed.

Actual same-page orientation cycle 390×844 → 844×390 → 667×375 → 568×320 → 390×844 passed: Run centre hit test, no rectangle intersection with joystick/help/map, at least 44px target and 18px viewport edge clearance, keyboard Space toggling and closed-map position restoration. Screenshots at 568 and 844 were inspected. This is geometric browser evidence, not a real-user thumb-reach study; device safe-area env values were zero in this Linux environment.

39 unit tests, SSOT/generation checks, the full existing V11 movement/doors/inspection/failure/reduced-motion suite and PWA update/offline tests passed after the CSS correction. Earlier same-day guide/list regression evidence remains preserved.

## Limitations

Physical iOS/Android, Safari, notched-screen safe areas, real thumb ergonomics and screen-reader sessions remain UNVERIFIED. Branded model rights/label fidelity and remaining scene/kiosk tasks are not completed by these tests. Earlier audit samples that did not await the guide close/focus event are superseded by the final report; source logs are preserved locally.

Rollback: revert this isolated commit and deploy via the existing Pages workflow; prior main is `4e6a0c13f91bb26d1f69f5afa1c9d1851582a4a3`.
