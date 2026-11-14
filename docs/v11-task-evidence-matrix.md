# V11 task evidence matrix — final incremental reconciliation

Runtime baseline: main `d1d091d513b6188582cb4ac15b8ce99d53d1dfbb`, application **1.1.14**, Pages run **43577660591** succeeded. This update changes documentation and tests only, not runtime behavior.

**PASS** means the stated implementation/Chromium laboratory evidence, not packaging certification or all-device acceptance. **PARTIAL** identifies a real unresolved validation dimension. **DEFER** is an evaluated optional change, not blocked essential work. Historical reports retain their original scope.

| Plan item | Status | Requirement |
|---|---|---|
| Phase 0 / 1 | PASS | Inspect the current working tree, repository instructions, V11 source, deployed version and relevant tests. |
| Phase 0 / 2 | PASS | Record existing behavior for entry, all stores, four products, dialogs, navigation, keyboard/touch controls and list view. |
| Phase 0 / 3 | PASS | Inventory candidate model sources, revisions, hashes, dimensions, orientation, triangles, materials, file sizes and rights. |
| Phase 0 / 4 | PASS | Capture desktop, tablet and mobile baseline views and record performance measurements with their test environment. |
| Phase 0 / 5 | PASS | Verify current upstream model reports and pin the revision chosen for implementation. |
| Phase 1 / 1 | PASS | Vendor selected GLBs locally and record upstream commit, export hashes and attribution. |
| Phase 1 / 2 | PASS | Organize product, furniture and decorative asset configuration without leaking styles or behavior into other versions. |
| Phase 1 / 3 | PASS | Load each shared asset once and reuse geometry and materials for repeated placements. |
| Phase 1 / 4 | PASS | Check scale, floor contact, orientation, lighting and scene placement. |
| Phase 1 / 5 | PASS | Preserve a usable per-asset fallback when loading or validation fails. |
| Phase 1 / 6 | DEFER | Evaluate distant LOD and close-up detail using measured results before adopting runtime switching. |
| Phase 2 / 1 | PASS | Replace the four simplified cans with the reviewed New Zealand, Australia, South Africa and Mexico models. |
| Phase 2 / 2 | PARTIAL | Match each model, label, name and product record against existing verified source data. |
| Phase 2 / 3 | PASS | Evaluate the existing display-shelf model; arrange products for clear near and distant viewing. |
| Phase 2 / 4 | PASS | Provide discoverable inspection cues for F and click/tap. |
| Phase 2 / 5 | PASS | Keep paths, collision boundaries and camera sightlines clear. |
| Phase 2 / 6 | PASS | Review lighting and readability so labels are not hidden or washed out. |
| Phase 3 / 1 | PASS | Add an interactive 3D product preview with rotation, zoom and reset. |
| Phase 3 / 2 | PASS | Support mouse, touch and keyboard access to preview controls. |
| Phase 3 / 3 | PASS | Retain verified product text, images, existing official eShop link and list view. |
| Phase 3 / 4 | PASS | Disclose relevant packaging limitations without presenting estimates as verified facts. |
| Phase 3 / 5 | PASS | Provide loading, error and non-WebGL image alternatives. |
| Phase 3 / 6 | PASS | Pause mall movement while a dialog is open and restore focus when it closes. |
| Phase 4 / 1 | PASS | Evaluate the mall directory kiosk as an entrance focal point connected to the existing three-store map and teleport actions. |
| Phase 4 / 2 | PASS | Distinguish the model's decorative screen from functional wayfinding; do not present its fictional map as real navigation. |
| Phase 4 / 3 | DEFER | Improve sightlines and store-name visibility from the entrance. |
| Phase 4 / 4 | PASS | Selectively place existing display shelves, lightboxes or bins where they support the scene. |
| Phase 4 / 5 | PASS | Keep circulation paths clear and avoid overcrowding or hiding existing controls. |
| Phase 4 / 6 | PASS | Check map, help, joystick, Run and inspect prompt for mobile overlaps. |
| Phase 5 / 1 | PASS | Add concise, dismissible first-use guidance for movement, Q/E turning and F inspection, with appropriate touch instructions. |
| Phase 5 / 2 | PASS | Preserve WASD, arrow keys, Shift, Q/E, scene dragging and touch controls. |
| Phase 5 / 3 | PASS | Check visitor animation, camera obstruction and collisions around new models. |
| Phase 5 / 4 | PASS | Preserve reduced-motion behavior and the accessible list view. |
| Phase 6 / 1 | PASS | Compare transferred bytes, render calls and observed performance with the recorded baseline. |
| Phase 6 / 2 | PASS | Load assets on demand where appropriate; measure before changing texture, shadow or LOD quality. |
| Phase 6 / 3 | PARTIAL | Verify keyboard focus, accessible names, touch targets, dialog focus and contrast. |
| Phase 6 / 4 | PASS | Exercise reduced motion, WebGL/WASM failures and no-JavaScript alternatives. |
| Phase 6 / 5 | PASS | Preserve the existing PWA update and cache policy; assess download size and update integrity before expanding offline scope. |
| Phase 6 / 6 | PASS | Record physical-device, browser and assistive-technology coverage separately from simulated results. |
| Verification and release gates / 1 | PASS | Verify each product model, associated record, preview and existing link, including failed asset loading. |
| Verification and release gates / 2 | PASS | Exercise walking, running, Q/E turning, F inspection, map navigation, touch, focus restoration and collision. |
| Verification and release gates / 3 | PASS | Review desktop, tablet and mobile layouts for overflow, overlap and unobstructed controls. |
| Verification and release gates / 4 | PARTIAL | Test keyboard operation, accessible names, reduced motion and available fallback modes. |
| Verification and release gates / 5 | PASS | Measure loading and rendering against Phase 0; report device, browser and remaining limitations. |
| Verification and release gates / 6 | PASS | Run the repository checks in `AGENTS.md` and relevant V11, asset, accessibility and regression checks; fix failures and repeat affected checks. |
| Verification and release gates / 7 | PASS | Review the final diff, provenance and credential exposure before committing. |
| Verification and release gates / 8 | PASS | After applicable gates pass, commit and push to `origin/main`; verify the remote SHA, GitHub Actions, Pages deployment and live key flows. |
| Verification and release gates / 9 | PASS | Report PASS, FAIL or UNVERIFIED for each applicable gate; do not claim physical-device, Safari or screen-reader coverage without running it. |

## Evidence and scope per phase

### Phase 0
Baseline and source receipts: v11-newmoon-demo-review, v11-kiosk-review, v11-performance-review; source rights limitations recorded, not certified.

### Phase 1
Pinned local assets, shared instances and independent fallbacks: v11-newmoon-demo-review. Current LOD1 fits measured budget and inspected close-up. Runtime LOD switching is deferred because no measured need justifies additional assets/complexity.

### Phase 2
Four exact SKU records, shelf collision and render review: v11-newmoon-demo-review. Full label panel order, physical dimensions and Mexico missing sector remain unverified; exact hash/name mapping is not packaging certification.

### Phase 3
Four interactive previews: v11-newmoon-preview-review; new final incremental audit confirms paused mall, focus cycle, 320/768 layout and repeat cleanup. Touch means real browser/CDP touch events, not physical-device certification.

### Phase 4
Kiosk/maps: v11-kiosk-review. Four shelf placements and paths: v11-newmoon-demo-review. HUD overlaps: v11-performance-review. Further entrance sightline changes/additional fixtures are deferred: existing store signs/map remain available and no demonstrated obstruction warrants unrelated geometry.

### Phase 5
First-use guide, existing V11/character suite, pointer fixes, new shelf collision and accessible directory: corresponding guide/pointer/newmoon-demo/directory reviews. Preview does not modify scene movement or colliders.

### Phase 6
Final incremental audit plus newmoon-preview/PWA/fallback reviews. New preview axe has zero violations. Incomplete symbol/overlap color-contrast flags were separately reviewed: computed foreground/background ratios 5.62–14.73:1 and unobscured centre hit tests passed (v11-preview-contrast-review.json); rendered views inspected. This is not a full screen-reader or physical-device accessibility sign-off.

### Verification and release gates
Per-slice release evidence and scoped final incremental audit. Unchanged suites are reused per owner instruction not to rerun unrelated checks. No whole-device accessibility claim; version 1.1.14 main d1d091d, Pages 43577660591 and six live file hashes verified.

## Remaining work that cannot be honestly replaced by more mock testing

1. Physical Android and iOS/Safari sessions, notched safe areas, native install behavior, actual thumb reach and screen-reader operation. Requires access to those devices/assistive technologies. Browser emulation and axe results are retained separately.
2. Physical packaging dimensions, full label wrap/panel order and Mexico missing artwork. Requires suitable real package/reference materials. Owner demo permission is already recorded and is not being requested again.
3. Independent brand-artwork rights/official edition remain unverified. Demo use is explicitly owner-authorized and unofficial; no third-party license is granted.
Automated color-contrast incomplete flags were individually checked against computed solid backgrounds and hit testing; they are not an outstanding implementation blocker. These scoped checks still do not replace assistive-technology certification.

Optional changes: additional bins/lightboxes, new entrance geometry and dynamic LOD are not added merely to clear checkboxes. Existing reusable shelves/kiosk satisfy the useful scene scope; payload/draw-call budgets remain within limits. No new commerce, product SKUs or brand claims are needed.
