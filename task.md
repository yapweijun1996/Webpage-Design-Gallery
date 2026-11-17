# GJH V11 Virtual Mall Improvement Plan

Status: **previous authorized software work and the requested 17-lot visual-concept delivery are complete**. The 2026-11-16 owner decision still defers physical-device acceptance and real/operational brand activation. This task authorizes the limited visual use of supplied brand names and logos on concept storefronts; it does not verify tenancy, current brand relationships, merchandise, claims, or general artwork rights. No unperformed device acceptance or real-world authorization is represented as passed.

## Deferred follow-ups — non-blocking

Owner decision, 2026-11-16: defer the following work outside the completed software scope. These items do not block software completion or the existing release.

- **Physical-device and accessibility acceptance — deferred, not performed:** physical iPhone Safari / Android Chrome, real safe-area insets, screen-reader sessions and the remaining device-specific contrast review. Existing browser and automated accessibility evidence keeps its original scope. Reopen as a separate acceptance task when the required devices and testing access are available.
- **Real brand authorization and activation — deferred, not established:** the earlier neutral placeholders remain unavailable for store actions. This new task authorizes only supplied-name/logo concept signage and evidence-bounded display silhouettes; do not claim current relationships, tenancy, distribution, stock, medical benefits, or general third-party artwork rights. Reopen actual activation only after current relationship, content and rights are verified for each candidate.

## Objective and scope

Use reviewed assets from [Blender-3D-Gallery](https://github.com/yapweijun1996/Blender-3D-Gallery) to improve product discovery, navigation and presentation in the existing GJH V11 mall. Prioritize the New Moon product experience, then wayfinding and selective scene improvements. Preserve existing URLs, content, business behavior, controls, accessibility fallbacks and the mall's visual direction.

## Shop lot design — GJH V11 expanded layout

The expanded 17-lot storefront design is tracked in [the shop-lot design matrix](docs/gjh-v11-shop-lot-design.md). The owner-authorized concept direction uses the supplied logo and brand name on each sign, glazed storefronts with visible non-walkable displays, accurate hero-product scale where evidence supports it, and generic stand-ins where products/models are unverified. This design work does not establish tenancy, distribution, product availability, brand authorization or medical benefits.

## Upper-level viewing deck — brand wall

Design and implementation are tracked in [the upper-deck brand-wall brief](docs/gjh-v11-upper-deck-brand-wall.md). Add a 12 × 12 m viewing deck at +7.2 m with an atrium glass railing, a few benches and planters, and one gallery wall of 17 small brand plaques. Reuse validated local furniture/railing assets only. Build plaque art as one atlas; keep the expanded default and deck views at <=190 draw calls without changing startup cost. The independent-concept footer stays; no prices or medical claims. Keep S03, S05 and S11 neutral. Correct only expanded-layout “three stores” copy; classic retains its three-store wording.

- [x] Stage 1 — Add the design brief and this checklist.
- [x] Stage 2 — Build the upper deck, railing, benches and planters.
- [x] Stage 3 — Build the 17-plaque atlas and accessible nearby/tap story interaction.
- [ ] Stage 4 — Fix expanded-layout copy, extend `tests/browser_gjh_v11.py`, update README, regenerate outputs, and verify both views <=190 draw calls.


- [x] Stage 2 — Build one 17-sign texture atlas with logo/text fallback and add category storefront variants.
- [x] Stage 3 — Implement S01–S03 and S06–S11 with validated shelf/showcase models and evidence-bounded hero stand-ins.
- [x] Stage 4 — Implement S04–S05 and S12–S17 with existing displays or simple generated geometry; record missing matching models.
- [x] Stage 5 — Measure browser draw calls/startup and apply facade-plus-sign distant LOD to stay within 200 calls.
- [x] Stage 6 — Update README, check off completed stages, regenerate generated outputs, and run requested checks.

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
- [x] Evaluate distant LOD and close-up detail using measured results before adopting runtime switching.

Acceptance: the mall does not fetch models from GitHub at runtime; asset provenance is traceable; a failed asset does not disable navigation or product information.

## Phase 2 — New Moon product presentation

Depends on Phase 1. This is the first implementation priority.

- [x] Replace the four simplified cans with the reviewed New Zealand, Australia, South Africa and Mexico models.
- [x] Match each model, label, name and product record against existing verified source data.
- [x] Generate four unofficial flat-label candidate PNGs with Codex CLI from the existing photo/SKU references (owner request, 2026-11-15). Keep estimated wrap/disclosure information and preserve the published GLBs until separately accepted.
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
- [x] Improve sightlines and store-name visibility from the entrance.
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
- [x] Verify keyboard focus, accessible names, touch targets, dialog focus and contrast.
- [x] Exercise reduced motion, WebGL/WASM failures and no-JavaScript alternatives.
- [x] Preserve the existing PWA update and cache policy; assess download size and update integrity before expanding offline scope.
- [x] Record physical-device, browser and assistive-technology coverage separately from simulated results.

Acceptance: no unacceptable measured regression; key information remains available without 3D; offline claims match the assets actually cached.

## Phase 7 — Mobile HUD redesign (design specified; partly implemented)

Specification and status table: `docs/gjh-v11-mobile-redesign-gap-report.md`. The external proposals (P0/P1/P2 counts, token values, 100 E2E tests, concept images) are design input, not audit results.

Design decision: the bottom five-item navigation (Home, Shops, Events, Rewards, Profile) is not shown permanently. Free exploration keeps the joystick and the contextual interaction action; full navigation appears only in menu or shop mode.

- [x] Compact single-row header on touch and narrow screens (72px at 390x844); Bag width stays constant from 0 to 99.
- [x] One-row contextual prompt chip with touch labels ("Tap ...") instead of "Press F"; prompt no longer covers the avatar.
- [x] Safe-area insets in the header, controls and prompts (real device insets not yet verified).
- [x] Landscape disclaimer no longer covers Run; seated and cart prompts clear the disclaimer in portrait.
- [x] HUD buttons at least 44x44 CSS px; no horizontal overflow at 320, 360, 390, 667, 844, 1024, 1280.
- [x] Explicit mode state machine (Explore, Menu, Inspect, Seated, Cart, Shop) with enter, exit, cleanup, restore.
- [x] Mode-state review and focused browser verification: `docs/v11-mode-state-review.md`.
- [x] Contextual navigation rule: hide the bottom navigation during exploration, show it in menu or shop mode.
- [x] Shelf focus mode: implemented scope in `docs/gjh-v11-shelf-focus-scope.md`; 4 verified SKUs only, shelf-level highlight, compact nearby card, demo Add to Bag without price.
- [x] Interaction target highlight and distance hint.
- [x] WebGL context-loss recovery and low-end quality tiers.
- **Deferred, non-blocking:** physical-device and remaining device-specific accessibility acceptance is tracked in the follow-ups above, outside this completed software release scope.
- [x] Define any future real-commerce scope separately. The existing Demo bag and pushable 3D cart are authorized simulations, with no prices, stock reservation, real orders or payment. The official eShop link is external and does not check out the demo selection. See the commerce clarification below; no real-commerce implementation is approved by this checklist.

Optional scoped item, not committed: Diner Dash-style 4-table restaurant mini-game, see `docs/gjh-v11-restaurant-minigame-scope.md`.

## Verification and release gates

- [x] Verify each product model, associated record, preview and existing link, including failed asset loading.
- [x] Exercise walking, running, Q/E turning, F inspection, map navigation, touch, focus restoration and collision.
- [x] Review desktop, tablet and mobile layouts for overflow, overlap and unobstructed controls.
- [x] Test keyboard operation, accessible names, reduced motion and available fallback modes.
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

## Gallery design collection redesign — advisor plan, 2026-11-15

Status: **implemented and headless-Chrome E2E verified; physical-device acceptance is owner-deferred and non-blocking**. Untested browser/device coverage remains unverified. This is a separate Gallery task for `/companies/gjh/index.html`, prompted by the owner's annotated 639x826 browser view. The implementation follows the screenshot/source advisor review; final results are documented in [collection redesign verification](docs/gallery-collection-redesign.md).

Baseline E2E review, 15 November 2026: Gallery, PWA, preferences, 28 GJH demo browser cases and supplemental navigation/sort checks passed. Measured header/card heights support the advisor's layout concerns. Original generated outputs failed synchronization; regeneration and `--check` passed in the isolated test copy. See [E2E and advisor review](docs/gjh-gallery-advisor-e2e-review.md) for scope, evidence and limitations. This baseline does not complete redesigned-interface acceptance below.

Objective: make all eight design directions easier to scan, compare and open. The baseline 650px breakpoint switched to full-width cards at 639px; large previews, repeated disclosures, generous spacing and a tall navigation/settings header slow browsing.

- [x] Obtain an independent read-only UI/UX advisor recommendation.
- [x] Rework the collection as compact cards: two columns at 639px with approximately 16px gaps and padding, using the existing design-system tokens where suitable.
- [x] Use consistent 16:10 thumbnails; below 560px, use one column with a proposed preview height of approximately 180–200px. Verify image legibility and cropping before accepting these dimensions.
- [x] Keep version, title and one concise direction description; place Compare consistently and make Open live demo the primary action, with View details secondary.
- [x] Present the independent-concept disclosure once near the collection heading while retaining any required design-specific disclosures.
- [x] After card density is resolved, compact narrow-screen navigation by moving theme, language and update controls into an accessible settings surface.
- [x] Preserve existing filters, sorting, two-design comparison, detail/demo routes, theme and language behavior.
- [x] Implement through `templates/gallery/company.html`, the card rendering in `scripts/build_gallery.py`, and `assets/gallery.css`; regenerate output rather than editing generated pages.
- [x] Capture and review the redesigned 390px, 639px and desktop views, including scrolling, settings open/close, comparison selection and keyboard navigation.
- [x] Run the required repository checks and relevant Gallery/preferences regressions after implementation; record evidence before marking acceptance complete.

Proposed acceptance targets: at 639x826, two designs are identifiable together when the collection is in view; at 390px, a card is approximately 360–400px tall without clipping content. Interactive targets are at least 44x44 CSS px, focus remains visible, and the selected-comparison tray does not obscure content or focused actions. Check the 560px and 650px breakpoint boundaries and desktop layout for overflow and wrapping. Headless-Chrome results: 390px first card approximately 400px; 639px uses two columns with approximately 423px cards. All eight tested widths passed in three languages and two themes. Long content may grow naturally; physical-device and screen-reader coverage remain unverified.

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

- Application 1.1.16 improves readability of the product-dialog independent-demo disclaimer from 9px to the existing 14px small-text token, without changing its wording or colour. Screenshot-led advisor review and focused four-viewport reflow/close checks are recorded in `docs/v11-disclosure-type-review.md`.

- Application 1.1.24 adds optional pushable demo cart mode with one shared bag state, conservative full-turn collision clearance, reversible stowing and explicitly simplified pushing pose. See `docs/v11-cart-review.md`. This does not complete sitting transitions or all-seat interaction requirements.

- Application 1.1.25 extends sitting to all eight actual V11 benches (one centre anchor each), adds visible procedural sit/stand transitions, continuous cancellation and independent safe exits. Sit/stand and collection use an action close-up that restores the previous view. See `docs/v11-all-seats-review.md`. No IK, foot planting or bag-placement animation is claimed.

- Application 1.1.26 compacts only the portrait seated action bar (95px to 62px in tested views), exposing shoes/seat edge while retaining readable labels and keyboard/touch targets. See `docs/v11-seat-hud-review.md`.

- Mobile HUD P0 round (2026-11-14): compact header, one-row touch prompt chip, safe-area insets, landscape and portrait overlap fixes, 44px targets and no horizontal overflow were verified with Playwright mobile emulation and SwiftShader WebGL (repository root served), then reviewed on screenshots. Physical devices, real safe-area insets, context loss and the full browser suites were not run. See `docs/gjh-v11-mobile-redesign-gap-report.md`.

- Documentation update, 14 November 2026: [GJH multi-brand directory and mall plan](docs/gjh-multibrand-directory.md) separates the 22 requested research candidates, 16 corporate-navigation names and 14 overlapping eShop names. Historical distribution, house-brand statements, unresolved dates and unknown relationships remain distinct. This is a planning/documentation delivery, not additional live stores, ownership certification or artwork-rights approval.

### Commerce clarification — 2026-11-14

The earlier Phase 7 wording “no prices, stock or cart” is superseded only as regards **demo cart availability**: the session-only Demo bag shipped in 1.1.20 and the optional pushable 3D cart in 1.1.24. See [Demo bag contract](docs/v11-demo-bag-review.md) and [pushable cart contract](docs/v11-cart-review.md). Their release-time limitations remain historical evidence. Neither feature creates a real order, reserves stock, sets prices or processes payment. The external official eShop does not receive this demo bag as a checkout. This clarification does not complete the mode-state-machine or Shelf focus tasks or authorize a new shopping/checkout system.


## Phase 1 LOD evaluation — 2026-11-15

Application 1.1.31 retains shared LOD1 without distance switching after measured
five-viewport budget and rendered front/side/back review. A local image request-mode
mismatch was fixed: 320px initial resource entries fell from 50 to 44; candidate
views measured 8,480,992 decoded resource bytes and at most 153 draw calls.
Generation/SSOT, 46 unit tests, Gallery, 28 legacy-demo cases, full V11 (Metal),
PWA update/offline and four-SKU/failure integration passed. Existing compact-menu
Run/focus/plaque test expectations were reconciled with current source contracts.
See `docs/v11-lod-evaluation.md` and its evidence files. Physical devices,
SwiftShader completion and packaging fidelity remain unverified. This completes
only the LOD evaluation checkbox; no runtime switching or packaging certification
is claimed.


## Entrance wayfinding — 2026-11-15

Application 1.1.33 replaces three indirect room subtitles with numbered store
names while retaining the original brand logos, camera, doors, colliders and
Map destinations. Final plaques preserve their original width and pass existing
close-interior/HUD bounds after two rejected geometry candidates. Independent
visual review accepted 1440/768/390 entrance views and the tablet doorway at
85/100 (subjective). All nine keyboard map journeys, full V11 Metal regression,
46 Python tests, Gallery, 28 legacy-demo cases and PWA update/offline checks pass.
See `docs/v11-wayfinding-review.md`. Portrait side stores remain offscreen and
use the existing Map; physical devices and screen-reader/contrast certification
are not claimed. This completes the Phase 4 entrance visibility item only.


## V11 DOM accessibility — 2026-11-15

Application 1.1.34 completes Phase 6 DOM focus/name/target/dialog/contrast
verification in five browser viewports. It fixes the Bag-to-cart focus race,
sticky-header focus obstruction and unsupported generic ARIA names, clarifies
the quantity-nine limit, and applies the shared focus treatment to Visitor v2
selects. The synchronized default v2 passes 70 state scans, all seven appearance
focus paths, shelf pickup/return and elevator round trips. DOM contrast-incomplete
checks have a conservative minimum 5.6185:1; measured controls are at least 44px.
Full V11, 46 unit, Gallery, Bag/Cart and PWA regressions pass; independent visual
review is 86/100 (subjective). See `docs/v11-accessibility-review.md`.
Native popup keyboard option choice is NOT VERIFIED: the same sequence fails in
an isolated HTML fixture on this host. Actual control selection events and model
updates pass separately. Physical devices and screen-reader sessions remain open;
this does not complete the separate final/device acceptance gates.

## V11 direct product Inspect — 2026-11-15

The nearby New Moon product Inspect action now opens the existing readable
product-detail viewer immediately. It no longer requires the full Shelf view
and a second “Inspect details” activation. The Shelf controller and layered
mode implementation remain available for retained lifecycle and fallback
coverage; product identity, four SKU mappings, bag state, held-product state,
close/back restoration and mobile controls are unchanged. A nearby SKU now
opens the existing 3D can preview automatically; if it cannot load, the
official packshot remains visible. The focused desktop and 390px touch
regression is `tests/browser_gjh_direct_inspect.py` with evidence in
`docs/evidence/v11-direct-inspect/`. Chrome desktop and 390px touch checks
pass for all four loaded 3D SKUs, repeat close/reopen and bag preservation.
49 unit tests, SSOT, gallery, demos and PWA checks pass. The broader modes
test stops at its courtyard-seat approach assertion on both this change and
untouched baseline 53e98c2; it is not counted as passing. Actual screenshot
review and independent advisor review found no blocker for this bounded fix.
Physical iPhone Safari remains unverified.


## Codex CLI flat-label candidates — 2026-11-15

The owner requested generated flat labels because complete masters are unavailable.
Codex CLI 0.167.2 (configured gpt-6.1-terra / xhigh) used native image generation
to produce four real PNG candidates in `docs/flat-label-candidates/`. Seven native
calls were used: one targeted badge/copy regeneration each for NZ, AU and SA;
Mexico passed its first generation. Parent and independent review confirmed the
four countries/weights, SA 4–5pcs, flat composition, readable concept disclosure
and absence of invented factual panels. Independent visual score: 88/100
(subjective). PNG integrity, prompt-record hashes, generation check, 11 Gallery
unit tests and exclusion from the published site artifact passed. Runtime files,
GLBs, primary photo-derived labels and application 1.1.34 remain unchanged.
See the folder README, prompts.json and acceptance.json. These are comparison
concepts, not original artwork, print masters, seamless UV textures or proof of
full physical-packaging fidelity; the source-matching item remains open.

- Application 1.1.35 integrates four owner-authorized original M056 premium shelf instances in New Moon, preserving 36 native-scale existing cans and Visitor v2 pickup/return. See [M056 integration evidence](docs/v11-m056-integration.md). This asset substitution does not complete the reserved Shelf focus mode.

## Explicit mode lifecycle — 2026-11-15

Application 1.1.36 gives the six existing modes one lifecycle and pause owner,
retains Seated/Cart beneath overlays, includes Original tin inspection, and fixes
compact/wide Map classification and hidden-focus recovery. It preserves native
Bag focus, posture, camera, physical products and session selections. After
synchronizing M056 shelves, 10 mode unit tests, 162 browser snapshots plus v1 smoke,
70 accessibility states, 47 Python tests, full V11, Gallery, 28 legacy demo cases,
four no-JavaScript journeys, Bag/legacy Cart and PWA checks pass. Normal mode flows
record zero illegal transitions; independent source review has no P0/P1 findings
and visual preservation scores 85/100. See `docs/v11-mode-state-review.md` and its
acceptance receipt. This completes the implementation item only; the separate
mode-state review task, contextual navigation, Shelf, device and packaging gates
remain open. Physical devices, screen readers and native select popup choice are
not certified by these laboratory checks.

## Focused mode-state review — 2026-11-15

Application 1.1.37 completes 15 additional scenario groups and fixes the confirmed
P2 Cart action after main WebGL loss. Cart availability and mutation now require
runtime readiness; fallback refresh also covers an already-open directory. It
hides/disables unavailable Cart controls, recovers their focus to Bag Close and
preserves other focus and nonempty selections. A stale click cannot deploy or
claim success. Ready Cart use, nested Menu restoration, real sit animation and
directory/3D product failure contracts pass. Parent verification adds 47 Python
tests, Gallery, 28 legacy cases, four no-JavaScript journeys and PWA checks; final
runtime hashes match the worker's full V11, 162 mode snapshots, 70 accessibility
states, Bag and legacy Cart regression manifest. Independent source/visual review
closes the P2 with no P0/P1 findings and scores 86/100. See
`docs/evidence/v11-mode-review/acceptance.json`. This completes only the mode-state
review item; context restoration/quality tiers and physical-device gates remain
separate and unverified.

## Contextual navigation — 2026-11-15

Application 1.1.38 projects the canonical mode into one five-item navigation node,
shown only in Menu/Shop and moved inside native Guide/Bag footer hosts. Home
retains the current 3D position/posture/camera; Shops opens the existing directory.
Events, Rewards and Profile are disabled with visible demo explanations. Readiness
guards, exact inspection-focus return, current-destination state, measured footer
reservation and strict emulated-inset target/ring clearance passed verification.
11 viewports / 18 scenario groups, 162 mode snapshots, 15 mode-review groups,
70 axe scans, 47 Python tests, full V11, Gallery, 28 legacy cases, four no-JavaScript
journeys, PWA and generated-prefix checks pass. Independent review scores 85/100.
See [acceptance receipt](docs/evidence/v11-context-navigation-acceptance.json) and
[implementation review](docs/v11-context-navigation-review.md). This completes
only contextual navigation; physical devices, screen readers, packaging fidelity,
Shelf focus and graphics recovery/quality tiers retain their separate gates.

## Shelf focus — 2026-11-15

Application 1.1.39 adds the canonical Shelf presentation, whole-shelf selection
and full-shelf framing for the four existing SKUs. It reuses M056 assets and
preserves all 36 configured placements, physical reservation/return and the
quantity-only Demo bag. A temporary camera preserves player/camera state; native
detail, Bag, List and interruption handoffs clean up before entering another mode.
The compact nearby unit measures 121.59px versus its 120.59px baseline, retaining
two 44px actions, a small packshot and the visible physical-product notice.
Strict 12-viewport four-SKU checks, five asset-failure cases, 13 mode units, 165
mode snapshots, 15 mode-review scenarios, existing 70 axe scans plus Shelf,
Guide/Bag/preview/New Moon/full V11 checks pass. Independent review scores 86/100.
Parent 47 Python tests, Gallery, 28 legacy cases, four no-JavaScript paths, PWA,
generation/SSOT and two-viewport production-prefix journeys also pass. See
[acceptance](docs/evidence/v11-shelf-focus-acceptance.json) and
[review](docs/v11-shelf-focus-review.md). Actual window blur was observed; hidden
handling is fixture-backed. Physical devices, Safari, screen readers, device FPS
and full packaging fidelity remain unverified. This completes Shelf only;
general target-distance guidance and graphics recovery/tiers remain separate.

### Interaction target guidance acceptance — 1.1.40

Application 1.1.40 adds an approximate horizontal distance from the canonical
interaction owner, a decorative interaction-point marker, and whole-shelf outlines.
The cue clears on mode changes, blur, hidden state and fallback. Elevator guidance
uses the selected floor anchor. Existing action ranges and physics are unchanged.

Acceptance covers 14 viewports, 140 targets, 20 software-inset targets, 13 Node
tests, 165 mode snapshots, 15 mode-review scenarios, 11 navigation viewports,
70 axe scans, the corrected full 12-viewport Shelf suite, 47 Python tests and
Gallery/legacy/PWA checks. Generated artifact prefix checks pass at 390 and 1440px.
Independent review: 86/100. Two local modules add 8,335 decoded bytes with unchanged
scene resources; broad draw maximum remains 181. Post-resume held-touch assertions
use a localized 10-micrometre XZ bound; synchronous restore and angles stay exact.
See `docs/v11-target-guidance-review.md` and bounded evidence under `docs/evidence/`.
Physical-device, Safari, screen-reader and complete packaging verification remain open.

## Graphics recovery and quality — 2026-11-15

Application 1.1.41 recovers the existing renderer after native context restoration,
validates a real frame, and offers explicit re-entry while the directory remains
available. It preserves Bag quantities and directory modal focus, safely settles
interrupted elevator travel, and rejects stale restoration/init callbacks. Help
provides Auto, Low, Balanced and Detailed; recovery visibly chooses Low for the
page. No scene rebuild, extra physics/input owner, real-commerce or FPS claim.

The frozen focused suite passes 73 cases/100 frames; final modes, navigation,
insets, axe, Shelf, target functional, V11, Bag and preview regressions pass.
Parent Gallery/28 legacy cases/four no-JS/PWA checks, all 47 Python tests, SSOT,
generator and the generated `/gallery/` artifact checks pass (13 cases/35 frames).
Independent approval: 86/100, no unresolved functional P2/P0/P1. All eight restored
SKU comparisons have zero mean RGB difference; matched GPU epochs stay stable.
Resources increase 55 to 56 (+8,531 decoded bytes), with broad maximum 181 draw calls.

The historical 45-request gate and target-only old cold-GPU equality remain visibly
FAIL; neither was weakened. Current pinned-baseline/profile/decoded/draw/epoch
checks provide separate evidence. See `docs/v11-graphics-recovery-review.md` and
`docs/evidence/v11-graphics-recovery-acceptance.json`. Device, Safari, screen-reader,
OS-popup, actual safe-area, FPS and complete packaging gates remain separate.

## Future commerce scope definition — 2026-11-15

Completed the separate [commerce boundary](docs/v11-future-commerce-scope.md).
The current decision keeps V11 a discovery demo; merchant handoff or real orders
require a new brief, merchant interface, authoritative data ownership, security
and operating acceptance, and explicit implementation authorization. No prices,
stock writes, customer collection or transactions were added. Independent source
and scope review approved the document. Runtime and application 1.1.41 are unchanged.

## Final software acceptance — 2026-11-15

The bounded keyboard/name/reduced-motion/fallback gate is complete on the
unchanged application 1.1.41 runtime. [Final verification](docs/v11-final-software-verification.md)
links matching current-source regression, accessibility, artifact and actual
Pages evidence. Independent audit approved this scope and all raw-evidence hashes.
No further visual score or device certification is inferred. Historical failed
budget/cold-GPU oracles remain explicit.

Exactly two acceptance items remain incomplete: full packaging/source matching
requires missing masters or package references; physical-device/inset/screen-reader
acceptance requires actual device sessions. The available ADB runner reports zero
devices, and no usable iOS runner is available. AI label concepts and more desktop
emulation cannot close those gaps. Their checkboxes remain open; no all-task
completion or real-commerce authorization is claimed.

## Interior 200-asset backlog — eight-asset pilot, 2026-11-15

Status: **eight-asset pilot implemented, integrated and locally accepted with documented G01–G12 applicability; remaining 192 candidates pending**. The owner-provided backlog contains 200 unique candidate IDs across ten categories (20 each): P0 79, P1 81 and P2 40. These counts describe proposed assets, not completed Blender files or accepted runtime models.

Source of truth for the candidate rows: [unchanged backlog v1.0](docs/references/gjh-interior-200-assets-v1.md). Project contract reconciliation, source checksum, eight-ID pilot and G01–G12 acceptance requirements: [interior asset plan](docs/gjh-v11-interior-asset-plan.md). Spatial and visual rationale: [ten-advisor review](docs/gjh-v11-interior-10-advisors.md).

- [x] Read and preserve the supplied source; verify its SHA-256, 200 unique IDs, category sequences and priority totals.
- [x] Document dimension/interaction anomalies, current texture-free loader limits, collision ownership, proposed LOD behavior and the four-storefront fixture versus three-store runtime distinction.
- [x] Define documentation, baseline, pilot, shell, retail and optional-polish phases without marking future production as complete.
- [x] D1: reproduce and resolve the pilot kiosk/cart bottleneck; verify camera framing and bidirectional cart clearance at 390/639/1440px.
- [x] D1 follow-up outside asset scope: consolidate HUD/map/help ownership.
- [x] D1: audit existing bench, planter, kiosk, shelf and architectural primitives; record explicit reuse/adapt/new decisions and candidate-ID mappings.
- [x] D1: approve per-asset dimensions, coordinate conversion, snap/interaction anchors, collision authority, material compatibility and measured scene-wide budgets.
- [x] D2: review the eight-ID pilot: PUB-002, PUB-008, PUB-017, DSP-001, STF-008, LGT-009, PUB-005 and VER-017; preserve their source priorities and correct targets before authoring.
- [x] D2: author/adapt the reviewed pilot with editable source, GLB, manifest, applicable collision definitions, provenance and actual G01–G12 results or reasoned applicability records.
- [x] D2: validate export in independent viewers and the actual mall; verify failed/delayed loading, lifecycle cleanup and mobile/desktop visuals.
- [x] D3: select necessary P0 shell families and validate a traversable fixture, wayfinding and collision; retain the three-store runtime unless its expansion is separately scoped.
- [x] D4: select supported P1 displays, seating and facilities; retain verified product content and existing bag/cart/seat/fallback behavior.
- [x] D5: evaluate optional P2 variants, reflection/texture support, streaming and LOD only after measured cost/benefit and compatibility review.
- [x] Verify pilot movement, cart, seats, map, all four products, independent failures, delayed-parse disposal and stable repeated List/3D resources. Retain before/after payload/draw calls and after-only frame samples; no pre-change frame-time or new transport certification is claimed.

Completion requires real artifacts and evidence, not a checked inventory row. Supplied dimensions, material/LOD budgets and capability tags remain proposals until individually reviewed. The existing delivered-asset evidence and other task sections retain their own status. The later explicit request authorizes this eight-asset implementation. See [pilot review](docs/gjh-v11-interior-pilot-review.md), [acceptance manifest](models/gjh-interior-pilot/manifest.json) and [14-case E2E evidence](docs/evidence/interior-pilot-e2e.json). The subsequent commit/push request is tracked in [pilot release review](docs/gjh-v11-interior-pilot-release.md). The complete pilot uses `?interior=pilot`; the default keeps later M056 shelves, Shelf focus and graphics recovery. HUD consolidation and remaining candidates remain separate work.

## Existing-source product consistency — 2026-11-15

Completed the original Phase 2 [source-consistency acceptance](docs/v11-product-source-consistency-review.md).
Fresh requests verify four official product pages, eleven unchanged original
images and four live packshots. Actual deployed GLBs and embedded JPEGs exactly
match pinned upstream photo-derived exports/textures; twelve rendered panel views
and twelve live direct-Inspect/detail/preview flows pass source-consistency review after
synchronizing the concurrent interior pilot. No
known cross-SKU panel, factual contradiction or invented mark was found.

Earlier audit notes required physical print masters for this checkbox. Independent
contract review confirmed that this exceeded the explicit task, which permits
estimated panel placement and Mexico's disclosed 121-degree blank sector. Those
notes are superseded for this checklist item; no claim of full physical-wrap,
measured dimensions, current official edition or microtext certification follows.
The four AI comparison images remain separate and undeployed. The concurrent application 1.1.43
and its pilot assets are preserved; this audit changes documentation only. The physical-device/screen-reader task is now
the only unchecked item in the original mall acceptance scope; the newly added
interior follow-ups retain their own status.

## V11 merchandising density — 2026-11-15

1.1.45 preserves native can size, stocks M056 at 17 facings per row (204 total), and retains optional pilot at 11 (132 total). Repeated pickup/return and direct Inspect pass in desktop/390 Chrome. Latest hybrid directory, showcase stock and camera changes are retained. Hybrid CSS literals were moved unchanged into canonical design tokens to restore SSOT; the gate was not relaxed. See docs/v11-newmoon-merchandising-density-review.md.

## V11 welcome modal repair (1.1.46)
- [x] Remove sticky footer overlap with preference/CTA on short screens.
- [x] Improve dark action and checkbox text contrast with canonical tokens.
- [x] Four viewport screenshot/DOM and checkbox, close/reopen/start checks; no physical iPhone claim.

## Interior D1 Help and Map ownership — 2026-11-15

Application 1.1.47 completes the [D1 ownership review](docs/v11-interior-hud-review.md).
One permanent Help owner handles tutorial, H/? and controller Menu; one compact
header Map entry serves the kiosk and quick guide. Close/Escape/controller Back
restore the surviving focus target. Graphics, appearance, guide preferences,
current native welcome flow, three-column mobile navigation and dark-theme fixes
are retained. Compact Stores labels preserve the full accessible directory name.
The latest brand imagery is preserved; its confirmed 667px Directory overflow is
fixed with a scoped responsive column rule. No model, product, collider or mode
engine changed.

Current-source checks pass 13 HUD groups/50 frames, 70 DOM accessibility states,
four dark welcome sizes, 14 native Guide Tab targets, shared component defaults,
and the documented Directory/image/boundary bridges. Primary independent checks
add 49 Python tests, six interaction cases and three strict edge cases; generation
and SSOT pass. Historical mode/Gallery/PWA proofs retain their source boundaries,
and the unreproduced earlier Hair hit failure remains recorded. Post-push CI,
Pages and actual public user flows are the release gate before D3. At this D1 checkpoint only D1 was
checked; subsequent D3/D4/D5 acceptance is recorded separately below.


D3 bounded shell acceptance — 2026-11-15: application1.1.49 adds original
ARC-001/COR-001/CEI-001/STF-002 to classic default/pilot, plus necessary cart
batching that repairs the inherited220-call failure without relaxing200. Expanded
retains its existing shell and makes zero four-kit GLB requests. Four editable
sources,40,892-byte exports and canonical placement/proxy data have independent
acceptance;12selected IDs are implemented and188candidates remain pending.
Current55Python/19Node/generator/SSOT and8browser integration groups pass.
Fourjourneys/4,745actualsteering renders peak200;960distinct advancing renders
pass; all66collider records match pinned8768 for v1/v2 x default/pilot.
See docs/v11-interior-shell-review.md and docs/evidence/interior-shell-integration.json.
Immutable950 evidence remains separate. Physical-device/AT,45requests/10MiB,
fullM1/200candidates and expanded performance are not certified. Main/CI/Pages
and actual public flows are the publication gate before D4.


D4 supported P1 selection — 2026-11-15: independently accepted reuse of
DSP-001/PUB-002/PUB-008/PUB-005/LGT-009 with their existing capabilities,
artifacts and collision/fallback owners. Default M056 is retained; DSP remains
pilot-only. All12P1 FAC candidates have individual not-selected reasons and
remain unimplemented; P2 PUB-017 is a retained Map dependency, not a P1 asset.
Current14pilot E2E checks and all148runtime hashes pass against deployed D3
e7581e6 (CI/Pages43699502215,28public hashes,fivepublic journeys).
Selection adds zero runtime resources/IDs;12implemented and188pending remain.
See docs/v11-interior-p1-review.md and docs/evidence/interior-p1-selection.json.
D4 selection is complete; FAC production, D5 and physical-device/AT acceptance
are not implied. Its own main/CI/Pages verification is required before D5.


D5 optional detail evaluation — 2026-11-15: independently accepted measured
policy retains supported P2 directory/plinth identities, existing PBR/product
label pipelines, small static shell batch and current shared LOD1/lazy previews.
No new variant/reflection/decoder/streaming/distance-switch is justified by the
current measured Detailed active-cart200-call state. All148runtime hashes match
the current source-equivalent480-frame sample (pairedbaseline/current960frames);
six fresh browser loader cases prove valid3-primitive positive parse and rejection
of5SHA-valid unsupported variants before parsing or dependent requests.
Closing55Python/19Node/generator/SSOT pass; prior current14pilot/eightintegration
checks remain source-pinned, not falsely claimed rerun for D5. See
docs/v11-interior-detail-policy.md and docs/evidence/interior-detail-policy.json.
D1/D3/D4 are already separately published (950634f/e7581e6/9c2066f); D4 CI/Pages
43700288223 and35public hashes pass. This closes the four authorized interior
follow-ups after D5 publication verification.12implemented/188pending remain;
physical-device/AT and the separately scoped expanded checklist are unchanged.

Visitor v2 UX follow-up — 2026-11-15: camera occlusion, natural bench entry, reachable pickup/return feedback, persistent held guidance, truthful recovery and direct Cart controls are implemented in an isolated local candidate. Real-input and advisor evidence: `docs/gjh-visitor-v2-ux-fixes.md`. Publication and physical-device performance are not claimed.

Visitor v2 UX release follow-up: integrated with upstream e67c2d9, preserving its amenities, camera sweep, merchandising and automatic preview. Pre-deployment regression and real-input gates pass; public acceptance is recorded in docs/gjh-visitor-v2-ux-release.md.

Visitor v2 UX public acceptance: eced12c deployed successfully via Pages run 43687815886. Seventeen public resources matched; thirteen real keyboard/touch release checks passed with normal animations and no page/console errors. See docs/gjh-visitor-v2-ux-release.md.

Visitor v2 visual acceptance follow-up: screenshot review reopened the initial live input pass because onboarding covered the seated action. Separate HUD suppression now preserves tutorial progress; current local keyboard5/touch7 and unit49 pass, with final public15 gate pending in docs/gjh-visitor-v2-ux-release.md.

Final Visitor v2 UX release: a7f4ef3 deployed via successful Pages run43688638355; final public17-resource byte check and fresh15-check normal-motion keyboard/touch E2E PASS, zero page/console errors. Tutorial visual obstruction and progress preservation are covered. Original dirty worktrees were not modified by this release.

## Modern boutique interior redesign — 2026-11-15

Status: **direction selected and documented; implementation not started**. The owner prefers the first [modern premium concept](docs/references/gjh-mall-modern-premium-concept.png), wants the central gold ring removed completely, and wants future selectable everyday and seasonal colors/decorations. The owner subsequently liked the expanded 17-store layout. These concepts are illustrative; the [design brief](docs/gjh-v11-modern-interior-redesign.md) records the visual direction and the later [upgrade master plan](docs/gjh-v11-mall-upgrade-master-plan.md) owns the detailed delivery design. Preserve all prior task histories and unrelated work.

The earlier nine-slice outline is superseded by the more detailed, dependency-aware sequence in [Expanded 17-store upgrade](#expanded-17-store-upgrade--2026-11-15), which is the single progress checklist. Its scope retains baseline/layout, atrium, seating, materials, storefronts, elevator, themes, seasonal decorations and final integration. Each step requires current-source verification and visual review; do not overwrite existing user changes or screenshot evidence when running browser suites.

## Expanded 17-store upgrade — 2026-11-15

Status: **stages 0–5 and 7–10 completed; stage 6 neutral storefront and research scope complete, with branded activation owner-deferred; stage 11b startup-budget acceptance passed and release verified**. The owner chose an expanded mall with independent candidate brand storefronts. The [dimensioned ground/upper plan](docs/references/gjh-mall-floorplan-stage1.png) and [stage 1 spatial plan](docs/gjh-v11-stage1-spatial-plan.md) propose a 70 m × 60 m shell and 17 potential stores; these remain draft technical assumptions, not final dimensions, tenant commitments or verified ownership. The expanded default runtime has three open stores and 14 closed neutral slots; `?layout=classic` selects the original three-store layout. The [master plan](docs/gjh-v11-mall-upgrade-master-plan.md) specifies migration boundaries, phased acceptance and risks; the expansion supersedes the prior three-store-only planning constraint while preserving existing journeys and their relative order.

Owner decision — 2026-11-16: the expanded 17-slot mall is now the default;
`?layout=classic` opts into the original three-store scene and
`?layout=expanded` remains an alias. Three stores are open; 14 spaces remain
closed neutral placeholders. This changes route selection only, not tenant
authorization or the separate brand-activation decision.

- [x] Inspect existing scene dimensions and repository company/brand research; check GJH corporate and eShop source listings.
- [x] Produce a labelled, dimensioned 2D ground-floor draft and reconcile area arithmetic, circulation zones, seasonal space and candidate brand evidence.
- [x] Record owner preference for the overall proposed layout and prepare the [detailed upgrade master plan](docs/gjh-v11-mall-upgrade-master-plan.md); no implementation is implied.
- [x] **0. Baseline:** inventory concurrent work and source/runtime behavior; capture desktop/tablet/mobile visuals, functionality and local performance in isolated snapshots. [Baseline report and evidence](docs/gjh-v11-stage0-baseline.md) record the exact tested sources, passing checks, failing checks and untested device coverage. This checkbox completes the baseline capture, not correction of its findings.
- [x] **Baseline follow-up — 320px header:** corrected the clipped directory control and verified visible, focus and hit-test bounds plus the directory round trip across five viewports. [Fix report](docs/gjh-v11-stage0-fixes.md).
- [x] **Baseline follow-up — V2 modes:** updated the collision-safe scripted routes; all eight seats and the complete three-viewport V2 mode suite passed. [Fix report](docs/gjh-v11-stage0-fixes.md).
- [x] **Baseline follow-up — gamepad onboarding:** reproduced stale sampled look input in manual stepping, synchronized the fixture and verified three consecutive synthetic-gamepad runs; physical controller remains untested. [Fix report](docs/gjh-v11-stage0-fixes.md).
- [x] **1. Spatial refinement:** documented 17 independent slots, 6 m loop, portals, public uses, reserve boundary access assumptions and matching lift landings; generated a [dimensioned drawing](docs/references/gjh-mall-floorplan-stage1.png) and [coordinate/verification plan](docs/gjh-v11-stage1-spatial-plan.md). This is a checked proposal, not a physically certified plan; stage 3 implements a subset in the preview.
- [x] **2. Spatial data pilot:** shared current three-store IDs, numbers, nominal bounds, availability and arrival anchors across the 3D world, map and live directory; preserved legacy IDs and static fallback. [Implementation and verification](docs/gjh-v11-stage2-spatial-pilot.md). The pilot covered only three stores; stage 3 added the wider preview later. Integrated on top of newer main with visitor and HUD fixes preserved; see [release verification](docs/gjh-v11-stage2-release.md).
- [x] **3. Expanded shell:** built an opt-in, reversible 70 × 60 m ground-floor preview with 17 numbered slots (three open, 14 closed), and tested the loop, cart, map, existing stores, bag, recovery and screen sizes. [Implementation, screenshots and limits](docs/gjh-v11-stage3-expanded-shell.md).
- [x] **4. Atrium and seating:** added a low planted bed, two lounge groups and a clear seasonal reservation to the expanded preview; verified four seat interactions, fallback, cart/loop collision, camera and screen sizes. [Implementation, visual evidence and limits](docs/gjh-v11-stage4-atrium.md).
- [x] **5. Existing stores:** integrated New Moon, MILI and GOGO into the expanded scene with visible glazed storefronts and directory-to-3D links; verified four product details, brand-only content, map, bag, fallbacks and PWA. [Implementation and evidence](docs/gjh-v11-stage5-existing-stores.md).
- [x] **6. Neutral candidate storefronts — accepted software scope:** [stage 6 evidence and neutral storefront slice](docs/gjh-v11-stage6-candidate-stores.md) records the 14 individual source/rights checks and implements numbered, closed neutral directory/map/frontage placeholders. The owner accepted retaining all 14 as neutral placeholders on 2026-11-16. Brand authorization and branded activation are deferred to the separate non-blocking follow-up above; this checkbox does not assert that any candidate brand is authorized or active.
- [x] **7. Elevator and facilities:** implemented a guarded two-level visitor lift, walkable upper landing, safe courtyard arrival and relocated self-service amenities in the expanded preview; verified travel, rail collision, cart/held-product restrictions, pause, WebGL interruption, V1/V2 behavior and existing journeys. [Implementation and evidence](docs/gjh-v11-stage7-lift-facilities.md). V1 remains ground-only; the east facilities reservation is not an operating restroom.
- [x] **8. Materials and lighting:** added optional shared procedural stone and wood finishes, clearer glass and warm batched lighting; verified multi-screen views, failure fallback, lift/stores/cart and matched performance. [Implementation and evidence](docs/gjh-v11-stage8-materials-lighting.md). The historical baseline and candidate exceeded the startup-payload budget; stage 11b subsequently addressed it.
- [x] **9. Theme infrastructure:** added Everyday theme roles, local settings and a staged coordinator with cancellation, rollback and cleanup; verified five screen sizes, storage/module failures, real graphics recovery and retained visitor states. [Implementation and evidence](docs/gjh-v11-stage9-theme-infrastructure.md).
- [x] **10a. Lunar New Year:** added the red-and-gold theme and removable lanterns, banner, kumquat trees and blossoms, with return to Everyday and recovery. [Implementation and evidence](docs/gjh-v11-stage10-lunar-new-year.md).
- [x] **10b. Christmas:** added an evergreen tree, gifts, warm lights and banner with removable decoration, three-theme switching and recovery. [Implementation and evidence](docs/gjh-v11-stage10-christmas.md).
- [x] **10c. Deepavali:** added warm lamps, floral garlands, a flat rangoli-inspired motif and jewel tones with four-theme switching and recovery. [Implementation and evidence](docs/gjh-v11-stage10-deepavali.md).
- [x] **11a. Integration verification:** tested all four themes, existing shopping and navigation, five viewport sizes, graphics/failure recovery, PWA and accessibility; fixed hidden offline help, stale theme preview and landscape Help focus. [Report and evidence](docs/gjh-v11-stage11-integration.md). Browser emulation is not physical-device or screen-reader certification.
- [x] **11b. Startup performance acceptance:** added checked JavaScript bundles and a validated, recoverable pack of 19 existing models. The unchanged default-layout budget passes at all five simulated viewports: 40–42 requests, at most 10,275,478 decoded bytes and at most 198 non-cart draw calls. Against the exact `372295c` 320 × 740 baseline, the count decreased from 82 to 40 and decoded bytes increased from 9,885,537 to 9,924,394. Headroom is tight and physical-device performance remains unverified. See [stage 11b and evidence](docs/gjh-v11-stage11b-startup.md) and the [independent current-main acceptance](docs/evidence/gjh-startup-main-acceptance.json), including actual compact Map checks and native graphics interruption during pending pack loading.

Proposed dimensions and a small upper landing are documented; owner review, actual-scene clearance, external service connectivity, store content/rights and any shared operator theme access remain open for their respective slices. Browser-local theme persistence is implemented. A checked planning item is not runtime implementation or acceptance.

Stage6 neutral-candidate acceptance — 2026-11-15: application1.1.50 adds shared
planned-space04–17 records,14truthful Directory entries and matching Map states,
while retaining3open stores/4products. Native staticdetails remains readable
withoutJS/WebGL/Rapier; closedspaces have no action and all14stale destinations
are rejected. Existing3D labels say PLANNEDSPACE, not an opening promise.
Fresh official-navigation observations match14draft names but establish no new
catalog or asset permission; all runtime candidates remain unassigned/unavailable.
Independent148source/56raw-hash review,14focusedcontexts,55Python/21Node/gen/SSOT
and8integrationgroups pass. Paired480actualrenders hold190inactive/193cart calls
at1440Detailed, unchanged from c652e9f. See docs/gjh-v11-stage6-candidates.md and
docs/evidence/gjh-stage6-candidates.json. No extra model/request/geometry is added.
Main/CI/Pages and public DOM/hash verification remain the release gate before7;
physical-device/AT and later expanded stages are not completed by this slice.

Stage6 public-check follow-up: isolate14unavailable destination calls and exact
X/Z/frameCounter equality within one JS turn. Three controls exposed cross-RPC
idle-frame sampling, not a demonstrated teleport mutation. Strict corrected
14local/fivepublic checks pass; no tolerance or runtime change. Original failure
and phase evidence remain pinned in docs/evidence/gjh-stage6-public-check.json.
The test-only repair requires main/CI/public-byte verification before stage7.


Stage7 local acceptance — 2026-11-15: application1.1.51/build68cc981c4eb25add
implements a physical expanded lift cabin, shaft opening, stop gates/thresholds,
west boarding/exit and safe interrupted-travel recovery. Empty Call requires a
separate Ride; the upper landing is visitor-only. Canonical anchors align entrance
Directory/Guest guide and west-court showcase, loaded/fallback proxies and4SKUs.
Four Map letters add location information without new destinations or live services.
Current55Python/28Node/gen/SSOT,3expanded lift configurations/5native contextlosses,
6finalMap contexts,12pause/visibility+2resize observations, loaded/fallback service
journeys and5normal native keyboard checks pass. Three unsafe-state guards use
explicit QA-only synchronous body faults, not invented native journey evidence.
Ten broader groups retain their tested pre-capability-metadata source phase with
exact geometry/motion bridges. Fourclassic profiles retain all66colliders exactly.
Independent local approval and1,920actual advancing samples preserveclassic200;
expanded1440Detailed cart changes193to182calls. See docs/gjh-v11-stage7-lift.md
and docs/evidence/gjh-stage7-lift.json. All75binaryassets remain exact; one1,494-byte
JSmodule is added. Main/CI/Pages/public verification is required beforestage8.
Physical-device/AT, historicalpayload gates and operatingfacilities remain unverified.


Stage8 local acceptance — 2026-11-15: application 1.1.52/build3ac382081b3b16d2
adds two shared256px procedural stone/wood finishes and warm existing lights in
expanded only. Instanced strips follow the real roof/camera opening; no collider,
new light or shadow caster is added. The optional module has a two-second deadline,
flat fallback, partial-allocation cleanup and no late factory execution. Classic
requests no optional finish module in focused scenes; upper lift changes one color.
Current55Python/31Node/gen/SSOT, fiveviewports/fourqualities, sevenfault/isolation
cases, native texture context restoration and eightcurrentintegrationgroups pass.
Independent local approval verifies150runtime/37raw/11screenshots and1,920fresh
adjacent-paired advancing samples: all sampled calls unchanged (classic cart200,
expanded cart182), expanded+98triangles/+2textures/0geometry objects. Both fresh099
andcurrent loop medians are33.3ms; older16.7ms samples are not reused for timing.
See docs/gjh-v11-stage8-materials-lighting.md and docs/evidence/gjh-stage8-materials.json.
ParentStage7 publication099069d/CI43711374418/37public hashes/fourpublic contexts
is preserved separately. This stage needs its own main/CI/Pages/public gate before9.
Physical-device/AT, historicalpayload gates and measuredGPUbytes remain unverified.


Stage9 merged-release acceptance follow-up — application1.1.54/builda0b67bd162653c9b
preserves owner-published646e0c2 themes/packs/integration and fixes optional-theme
startup stalls, saved-pack timeout/retry and shared gamepad-close/prepare ordering.
Two-second boundaries ignore late factories and clear only their own failed cache;
Everyday restores the published stage8 lift colors. Three corrected fault cases,
57Python/45Node/gen/SSOT and sevencurrentintegrationgroups pass. Six realThree
batch color/geometry invariants use a clearly scoped collider stub, not physical
Rapier/GPU certification. Forty-two retained posed theme/cart observations include
parcel cost: expanded entrance Christmas cart193, classic Detailed cart200, exact
warmedEveryday renderer-resource restoration. Independent local approval passes; this
follow-up was published on main before the stage 11b request reduction was integrated.
See docs/gjh-v11-stage9-theme-infrastructure.md and docs/evidence/gjh-stage9-acceptance.json.
At this historical point the 45-request gate failed at 82; stage 11b later addressed it. Candidate brand permission and physical-device/AT limits remain open.

## 2026-11-17 follow-up: shop displays, lighting, zoom lock (owner request)
- [x] Zoom lock on v11 index/offline viewport (46a5df6, live, Pages deploy green); test `tests/gjh_v11_zoom_lock.test.mjs`.
- [x] Integrate 8 of 15 new Blender models (pharmacy counter, soundbar, TV x3, keyboard, battery rack, cordless phone); 6 skipped with no matching shop; ice-cream cart and piano NOT FOUND. Committed on `omp/v11-newmodels-1117`, not pushed.
- [x] Tiered lighting/atmosphere (main light, per-shop lights, procedural env, desktop-only bloom, faint fog); tests pass, draw calls max 200.
- [ ] Taste gate: new displays still small/hidden behind mullions, scene still flat beige. Round 2: larger displays, stronger key-light contrast, re-inspect screenshots at 390 and 1440.
- [ ] Push to main only after the taste gate passes; confirm Pages deploy and live version.
- [ ] P1 model requests for the owner's AI agent: grand piano, chilled drinks/ice-cream freezer, ice-cream cart, mullion-free glazed storefront module, canned-food pyramid display.
- [ ] Physical-device acceptance (deferred); public redistribution terms of the new model licences unspecified.

## 2026-11-17 QA loop (owner-approved)
See [docs/gjh-v11-qa-loop.md](docs/gjh-v11-qa-loop.md).
- [x] Decide authority, pass bar, step size, rework cap, advisor roles and release rule (concept image; mood-level pass; one shop per round, S01 first; 5 rounds then downgrade; 5 advisors; push without asking when advisors and manager pass).
- [ ] Finish round-2 OMP work (visibility, contrast) and use it as the loop's starting point.
- [ ] Derive per-shop acceptance checklists (S01-S17) from the concept images and store them in KB-MCP.
- [ ] Advisor review of round-2 screenshots against checklist and concept image.
- [ ] Per-shop rounds, S01 first: change, evidence, advisor review, rework, push, record.
- [ ] 20-minute SGT progress reports until the loop is finished.
- [ ] Interaction rules (owner 2026-11-17): audit every chair, stool and bench for Sit support; doors Open; products Inspect; keep walls, decor and ordinary lights static. See docs/gjh-v11-qa-loop.md.
- [ ] Vision upgrade (owner 2026-11-17): Singapore-Malaysia Virtual World. Phases P0 mall quality, P1 multi-floor and enterable shops, P2 district streaming architecture, P3 Singapore districts, P4 Malaysia districts. See docs/gjh-v11-qa-loop.md. Open: enterable interiors supersede the glazed-only decision.
- [x] Model inventory for the Singapore-Malaysia world: docs/sg-my-world-model-inventory.md (names only, quality not verified).
- [ ] Goal and engine (owner 2026-11-17): goal.md created. Modular 3D World Engine on Three.js (reusable behaviors Sit/Inspect/Open/Pick Up with seat anchors, world streaming, shared camera/movement/collision). Next: write the engine design (interaction registry, seat-anchor spec, streaming chunks) and audit what v11 already has before extracting modules (P2).

## 2026-11-17 release log
- [x] Pushed to main (a05c0bb, Pages deploy green, live bundle verified): new model displays (S04/S05, S13-S17), tiered lighting, interaction registry, seat anchors (upper-deck benches sittable except one overlapping the lift shaft was moved), shop-door Open, goal.md, QA loop docs, model inventory. Owner chose to push all although the terra visual advisor scored the mall 4/10 FAIL.
- [ ] Visual quality is still below the concept (flat mood, small hero displays); waits for P1 models: glazed storefront module, chilled freezer, grand piano, ice-cream cart, canned-food pyramid.
- [ ] Next engine steps: Pick Up and Travel through the registry, shoes in character customisation, NPCs, escalator, district streaming (P2).
