# GJH V11 Virtual Mall Improvement Plan

Status: **core demo implemented and laboratory-verified; physical-device and packaging acceptance remain open**. Checked items are limited to the evidence and environments in `docs/v11-task-evidence-matrix.md`, not blanket device or brand certification. Unchecked items are explicitly partial or deferred.

## Objective and scope

Use reviewed assets from [Blender-3D-Gallery](https://github.com/yapweijun1996/Blender-3D-Gallery) to improve product discovery, navigation and presentation in the existing GJH V11 mall. Prioritize the New Moon product experience, then wayfinding and selective scene improvements. Preserve existing URLs, content, business behavior, controls, accessibility fallbacks and the mall's visual direction.

The mall already has three stores, the green-polo visitor, benches, planters, walking and turning controls, inspection dialogs and a list view. Its four canned products now use owner-authorized conceptual GLBs with photo-derived labels; product-detail dialogs retain default packshots and offer an opt-in unofficial 3D preview in application 1.1.14. Confirm these observations against current source and the deployed site before making changes.

## Phase 0 — Audit and baseline

- [x] Inspect the current working tree, repository instructions, V11 source, deployed version and relevant tests.
- [x] Record existing behavior for entry, all stores, four products, dialogs, navigation, keyboard/touch controls and list view.
- [x] Inventory candidate model sources, revisions, hashes, dimensions, orientation, triangles, materials, file sizes and rights.
- [x] Capture desktop, tablet and mobile baseline views and record performance measurements with their test environment.
- [x] Verify current upstream model reports and pin the revision chosen for implementation.

Acceptance: the baseline and asset inventory are reviewable; verified facts, assumptions and unresolved packaging details are distinguished.

## Phase 1 — Asset integration

Depends on Phase 0.

- [x] Vendor selected GLBs locally and record upstream commit, export hashes and attribution.
- [x] Organize product, furniture and decorative asset configuration without leaking styles or behavior into other versions.
- [x] Load each shared asset once and reuse geometry and materials for repeated placements.
- [x] Check scale, floor contact, orientation, lighting and scene placement.
- [x] Preserve a usable per-asset fallback when loading or validation fails.
- [ ] Evaluate distant LOD and close-up detail using measured results before adopting runtime switching.

Acceptance: the mall does not fetch models from GitHub at runtime; asset provenance is traceable; a failed asset does not disable navigation or product information.

## Phase 2 — New Moon product presentation

Depends on Phase 1. This is the first implementation priority.

- [x] Replace the four simplified cans with the reviewed New Zealand, Australia, South Africa and Mexico models.
- [ ] Match each model, label, name and product record against existing verified source data.
- [x] Evaluate the existing display-shelf model; arrange products for clear near and distant viewing.
- [x] Provide discoverable inspection cues for F and click/tap.
- [x] Keep paths, collision boundaries and camera sightlines clear.
- [x] Review lighting and readability so labels are not hidden or washed out.

Use the official-photo-derived labels as the primary candidate. Panel order and spacing are estimates; the Mexico model has an unprinted placeholder sector. The separate AI-generated flat-label comparison set can contain incorrect text or marks and must not be represented as official packaging. Do not add invented prices, inventory or a purchase flow.

Acceptance: all four products are distinguishable, open the correct details and retain accurate disclosures about unverified packaging.

## Phase 3 — Product detail experience

Depends on Phase 2.

- [x] Add an interactive 3D product preview with rotation, zoom and reset.
- [x] Support mouse, touch and keyboard access to preview controls.
- [x] Retain verified product text, images, existing official eShop link and list view.
- [x] Disclose relevant packaging limitations without presenting estimates as verified facts.
- [x] Provide loading, error and non-WebGL image alternatives.
- [x] Pause mall movement while a dialog is open and restore focus when it closes.

V11 bounded progress — 2026-11-14: New Moon-only detail previews are implemented with explicit lazy loading of the four owner-authorized conceptual GLBs, SHA-256 checks, image fallback, bounded pointer/touch/keyboard controls, context-loss and close/generation cleanup. Focused browser verification and evidence are recorded in `docs/v11-newmoon-preview-review.md`. Physical iOS/Android, actual packaging accuracy and independent artwork rights remain unverified.

Acceptance: desktop, touch and keyboard users can inspect and close product details; product information remains available if 3D fails.

## Phase 4 — Entry, wayfinding and spatial design

Depends on Phase 1; coordinate layouts with Phase 2.

- [x] Evaluate the mall directory kiosk as an entrance focal point connected to the existing three-store map and teleport actions.
- [x] Distinguish the model's decorative screen from functional wayfinding; do not present its fictional map as real navigation.
- [ ] Improve sightlines and store-name visibility from the entrance.
- [x] Selectively place existing display shelves, lightboxes or bins where they support the scene.
- [x] Keep circulation paths clear and avoid overcrowding or hiding existing controls.
- [x] Check map, help, joystick, Run and inspect prompt for mobile overlaps.

Acceptance: visitors can find all three stores; critical controls remain visible and usable without horizontal overflow.

## Phase 5 — Visitor guidance and usability

Depends on the finalized interaction design from Phases 3 and 4.

- [x] Add concise, dismissible first-use guidance for movement, Q/E turning and F inspection, with appropriate touch instructions.
- [x] Preserve WASD, arrow keys, Shift, Q/E, scene dragging and touch controls.
- [x] Check visitor animation, camera obstruction and collisions around new models.
- [x] Preserve reduced-motion behavior and the accessible list view.

Acceptance: new users can understand the controls; existing movement, animation and collision behavior does not regress.

## Phase 6 — Performance, accessibility and PWA

Runs throughout implementation and is completed after Phases 2–5.

- [x] Compare transferred bytes, render calls and observed performance with the recorded baseline.
- [x] Load assets on demand where appropriate; measure before changing texture, shadow or LOD quality.
- [ ] Verify keyboard focus, accessible names, touch targets, dialog focus and contrast.
- [x] Exercise reduced motion, WebGL/WASM failures and no-JavaScript alternatives.
- [x] Preserve the existing PWA update and cache policy; assess download size and update integrity before expanding offline scope.
- [x] Record physical-device, browser and assistive-technology coverage separately from simulated results.

Acceptance: no unacceptable measured regression; key information remains available without 3D; offline claims match the assets actually cached.

## Verification and release gates

- [x] Verify each product model, associated record, preview and existing link, including failed asset loading.
- [x] Exercise walking, running, Q/E turning, F inspection, map navigation, touch, focus restoration and collision.
- [x] Review desktop, tablet and mobile layouts for overflow, overlap and unobstructed controls.
- [ ] Test keyboard operation, accessible names, reduced motion and available fallback modes.
- [x] Measure loading and rendering against Phase 0; report device, browser and remaining limitations.
- [x] Run the repository checks in `AGENTS.md` and relevant V11, asset, accessibility and regression checks; fix failures and repeat affected checks.
- [x] Review the final diff, provenance and credential exposure before committing.
- [x] After applicable gates pass, commit and push to `origin/main`; verify the remote SHA, GitHub Actions, Pages deployment and live key flows.
- [x] Report PASS, FAIL or UNVERIFIED for each applicable gate; do not claim physical-device, Safari or screen-reader coverage without running it.

Required repository checks:

```sh
python scripts/build_gallery.py --check
python -m unittest discover -s tests -p test_gallery.py -v
python tests/browser_gallery.py
python tests/browser_gjh_demos.py
python tests/browser_pwa.py
```

Run `tests/browser_gjh_v11.py` and other focused checks for affected behavior as well. Generated gallery pages, `data/designs.json`, `version.json` and `sw.js` must be changed through their sources and the generator.

## Delivery order

1. Audit and baseline; integrate four reviewed cans and improve New Moon shelving while preserving current details.
2. Add accessible 3D product inspection and loading/failure states.
3. Add functional wayfinding, selective fixtures and visitor guidance.
4. Complete performance and accessibility review, regression tests, documentation and release verification.

Final deliverables: asset provenance, UI/UX change record, test evidence and limitations, commit SHA, Actions status and verified deployment URL.

## References

- [V11 mall](https://yapweijun1996.github.io/Webpage-Design-Gallery/demos/corporate/gjh/v11/)
- [GJH abalone cans, label limitations and verification](https://github.com/yapweijun1996/Blender-3D-Gallery/tree/main/models/gjh-abalone-cans)
- [Mall Essentials models](https://github.com/yapweijun1996/Blender-3D-Gallery/tree/main/models/mall-essentials)
- [GJH mall visitor](https://github.com/yapweijun1996/Blender-3D-Gallery/tree/main/models/gjh-mall-visitor)

## Verified progress — 2026-11-14

- Company-first homepage redesign is published (application 1.1.4).
- An independent original demo-tin viewer is implemented and tested for application 1.1.5. It uses no New Moon GLBs and is explicitly not an official SKU representation. See `docs/original-tin-viewer-review.md`.
- The earlier four-SKU New Moon candidate was unpublished pending owner permission. The owner subsequently authorized these four cans and shelf for public demo use. Application 1.1.13 integrates them as explicitly unofficial, estimated packaging; independent artwork rights and physical packaging accuracy remain unverified. Phase 3 branded interactive detail viewing is not implemented by this integration.
- First-visit guidance is implemented with session memory, keyboard/touch instructions, map and accessible-directory actions. See `docs/first-use-guide-review.md`. Kiosk integration was subsequently completed in 1.1.10; wider scene improvements and remaining performance/device acceptance work are still pending. The evidence matrix now reconciles implementation status; unverified or deferred items remain open.

- V11 List view redesigned as an independent 1.1.7 slice: compact store discovery, visible product inspection actions and matching store order, retaining all products and 3D entry. See `docs/v11-directory-review.md`. This does not complete the remaining model integration and device gates.

- Application 1.1.8 adds a repeatable five-viewport payload/draw-call/viewer-lifecycle budget check and fixes compact-landscape map overlap with Run. Same-page orientation, hit testing and keyboard evidence are in `docs/v11-performance-review.md`. Physical devices, actual notched-screen safe areas and screen readers remain unverified.

- Application 1.1.9 repairs optional furniture cleanup when GLB parsing arrives after the timeout or parsed primitives fail validation. Real-GLB fault-injection evidence and regression coverage are in `docs/v11-furniture-lifecycle-review.md`. Existing models, placement and successful-load materials remain unchanged.

- Application 1.1.10 adds the original entrance kiosk with F/touch access to the real three-store map, explicit decorative-screen disclosure, a physical collider and failed-asset fallback. Source rights, hash, dimensions, screenshots and tests are recorded in `docs/v11-kiosk-review.md`. Other fixtures and branded product phases remain pending.

- Application 1.1.11 fixes stuck joystick movement and camera dragging after pointer capture is interrupted. Real browser touch/mouse reproduction and recovery evidence are in `docs/v11-pointer-review.md`; physical-device and remaining branded-model gates remain unverified.

- Application 1.1.12 restores keyboard focus to the accessible directory when graphics loss hides the active 3D control, without interrupting an already-open directory product dialog or unrelated header focus. Twelve real context-loss cases and regression evidence are in `docs/v11-fallback-focus-review.md`; remaining asset and physical-device gates stay open.

- Application 1.1.13 integrates four owner-authorized conceptual New Moon LOD1 cans and four reusable shelf instances onto the latest main without reverting guide, kiosk, input or focus fixes. Current GLB hashes, per-SKU detail IDs, native scale, shelf collision, independent failures, disposal and rendered previews are reviewed in `docs/v11-newmoon-demo-review.md`. The Mexico blank sector remains disclosed. This is demo technical acceptance, not official packaging certification or completion of the branded 3D-detail phase.

- Application 1.1.14 adds opt-in four-SKU interactive detail previews, preserving default images, text, eShop links and conceptual-packaging disclosures. Mouse, browser touch, keyboard, resizing, focus, image fallbacks, context-loss retry and late-parse cleanup passed focused checks. See `docs/v11-newmoon-preview-review.md`. Physical devices and packaging fidelity remain unverified; unchanged broader gates are not marked complete.

- Final incremental reconciliation after 1.1.14: 320/768 preview layout, scoped axe scan, two-viewport payload/draw calls and five repeated preview cycles per viewport passed the stated laboratory limits. See `docs/v11-final-incremental-review.md` and the item-by-item evidence matrix. This documentation/test-only update does not change application assets or require a new application version.

- Application 1.1.15 keeps the existing product Close bar visible while scrolling long details in portrait as well as landscape. Before/after screenshots were reviewed by an independent read-only advisor under KB ask-advisor/UI-auditor guidance; 12 viewport/mode cases verify touch close and unobscured keyboard focus. See `docs/v11-sticky-details-review.md`.
