# GJH V11 Virtual Mall Improvement Plan

Status: **partially implemented; remaining phases are not complete**. This file records proposed work; unchecked items are not evidence of completed implementation or verification.

## Objective and scope

Use reviewed assets from [Blender-3D-Gallery](https://github.com/yapweijun1996/Blender-3D-Gallery) to improve product discovery, navigation and presentation in the existing GJH V11 mall. Prioritize the New Moon product experience, then wayfinding and selective scene improvements. Preserve existing URLs, content, business behavior, controls, accessibility fallbacks and the mall's visual direction.

The mall already has three stores, the green-polo visitor, benches, planters, walking and turning controls, inspection dialogs and a list view. Its four canned products currently use simplified geometry with front-label presentation. Confirm these observations against current source and the deployed site before making changes.

## Phase 0 — Audit and baseline

- [ ] Inspect the current working tree, repository instructions, V11 source, deployed version and relevant tests.
- [ ] Record existing behavior for entry, all stores, four products, dialogs, navigation, keyboard/touch controls and list view.
- [ ] Inventory candidate model sources, revisions, hashes, dimensions, orientation, triangles, materials, file sizes and rights.
- [ ] Capture desktop, tablet and mobile baseline views and record performance measurements with their test environment.
- [ ] Verify current upstream model reports and pin the revision chosen for implementation.

Acceptance: the baseline and asset inventory are reviewable; verified facts, assumptions and unresolved packaging details are distinguished.

## Phase 1 — Asset integration

Depends on Phase 0.

- [ ] Vendor selected GLBs locally and record upstream commit, export hashes and attribution.
- [ ] Organize product, furniture and decorative asset configuration without leaking styles or behavior into other versions.
- [ ] Load each shared asset once and reuse geometry and materials for repeated placements.
- [ ] Check scale, floor contact, orientation, lighting and scene placement.
- [ ] Preserve a usable per-asset fallback when loading or validation fails.
- [ ] Evaluate distant LOD and close-up detail using measured results before adopting runtime switching.

Acceptance: the mall does not fetch models from GitHub at runtime; asset provenance is traceable; a failed asset does not disable navigation or product information.

## Phase 2 — New Moon product presentation

Depends on Phase 1. This is the first implementation priority.

- [ ] Replace the four simplified cans with the reviewed New Zealand, Australia, South Africa and Mexico models.
- [ ] Match each model, label, name and product record against existing verified source data.
- [ ] Evaluate the existing display-shelf model; arrange products for clear near and distant viewing.
- [ ] Provide discoverable inspection cues for F and click/tap.
- [ ] Keep paths, collision boundaries and camera sightlines clear.
- [ ] Review lighting and readability so labels are not hidden or washed out.

Use the official-photo-derived labels as the primary candidate. Panel order and spacing are estimates; the Mexico model has an unprinted placeholder sector. The separate AI-generated flat-label comparison set can contain incorrect text or marks and must not be represented as official packaging. Do not add invented prices, inventory or a purchase flow.

Acceptance: all four products are distinguishable, open the correct details and retain accurate disclosures about unverified packaging.

## Phase 3 — Product detail experience

Depends on Phase 2.

- [ ] Add an interactive 3D product preview with rotation, zoom and reset.
- [ ] Support mouse, touch and keyboard access to preview controls.
- [ ] Retain verified product text, images, existing official eShop link and list view.
- [ ] Disclose relevant packaging limitations without presenting estimates as verified facts.
- [ ] Provide loading, error and non-WebGL image alternatives.
- [ ] Pause mall movement while a dialog is open and restore focus when it closes.

Acceptance: desktop, touch and keyboard users can inspect and close product details; product information remains available if 3D fails.

## Phase 4 — Entry, wayfinding and spatial design

Depends on Phase 1; coordinate layouts with Phase 2.

- [ ] Evaluate the mall directory kiosk as an entrance focal point connected to the existing three-store map and teleport actions.
- [ ] Distinguish the model's decorative screen from functional wayfinding; do not present its fictional map as real navigation.
- [ ] Improve sightlines and store-name visibility from the entrance.
- [ ] Selectively place existing display shelves, lightboxes or bins where they support the scene.
- [ ] Keep circulation paths clear and avoid overcrowding or hiding existing controls.
- [ ] Check map, help, joystick, Run and inspect prompt for mobile overlaps.

Acceptance: visitors can find all three stores; critical controls remain visible and usable without horizontal overflow.

## Phase 5 — Visitor guidance and usability

Depends on the finalized interaction design from Phases 3 and 4.

- [x] Add concise, dismissible first-use guidance for movement, Q/E turning and F inspection, with appropriate touch instructions.
- [ ] Preserve WASD, arrow keys, Shift, Q/E, scene dragging and touch controls.
- [ ] Check visitor animation, camera obstruction and collisions around new models.
- [ ] Preserve reduced-motion behavior and the accessible list view.

Acceptance: new users can understand the controls; existing movement, animation and collision behavior does not regress.

## Phase 6 — Performance, accessibility and PWA

Runs throughout implementation and is completed after Phases 2–5.

- [ ] Compare transferred bytes, render calls and observed performance with the recorded baseline.
- [ ] Load assets on demand where appropriate; measure before changing texture, shadow or LOD quality.
- [ ] Verify keyboard focus, accessible names, touch targets, dialog focus and contrast.
- [ ] Exercise reduced motion, WebGL/WASM failures and no-JavaScript alternatives.
- [ ] Preserve the existing PWA update and cache policy; assess download size and update integrity before expanding offline scope.
- [ ] Record physical-device, browser and assistive-technology coverage separately from simulated results.

Acceptance: no unacceptable measured regression; key information remains available without 3D; offline claims match the assets actually cached.

## Verification and release gates

- [ ] Verify each product model, associated record, preview and existing link, including failed asset loading.
- [ ] Exercise walking, running, Q/E turning, F inspection, map navigation, touch, focus restoration and collision.
- [ ] Review desktop, tablet and mobile layouts for overflow, overlap and unobstructed controls.
- [ ] Test keyboard operation, accessible names, reduced motion and available fallback modes.
- [ ] Measure loading and rendering against Phase 0; report device, browser and remaining limitations.
- [ ] Run the repository checks in `AGENTS.md` and relevant V11, asset, accessibility and regression checks; fix failures and repeat affected checks.
- [ ] Review the final diff, provenance and credential exposure before committing.
- [ ] After applicable gates pass, commit and push to `origin/main`; verify the remote SHA, GitHub Actions, Pages deployment and live key flows.
- [ ] Report PASS, FAIL or UNVERIFIED for each applicable gate; do not claim physical-device, Safari or screen-reader coverage without running it.

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
- The four-SKU New Moon source integration remains an unpublished local candidate; public redistribution rights and close-up label review are unresolved. It is not counted as released Phase 1–3 work.
- First-visit guidance is implemented with session memory, keyboard/touch instructions, map and accessible-directory actions. See `docs/first-use-guide-review.md`. Wayfinding/kiosk integration, wider scene improvements and the remaining performance/device acceptance work are still pending. Unchecked items above remain unchecked intentionally.
