# V11 DOM accessibility and keyboard-focus acceptance

Initial baseline: `da360bab7df090911279f8769e8c5f8695280b51`, application 1.1.33.
Release base after synchronization: `570c11d` (Visitor v2 and its source receipt retained).
Candidate: application 1.1.34 / build `f5384847945df5e9`.

## Confirmed problems and fixes

1. Activating a cart closed Bag and briefly focused the scene, then Bag's later
   native `close` event moved focus back to its opener. Real W-key input moved
   only 0.000002m. Bag now owns its focus restoration, with an explicit scene
   destination for this handoff and a reset to its opener for subsequent normal
   closes. Real keyboard movement resumes after activation; ordinary Escape and
   Close still restore the Bag button.
2. In a long populated Bag, a focused cart button could scroll under the sticky
   title bar. Scroll padding now uses the measured header height, updated on open
   and by one page-lifetime ResizeObserver. Open-dialog 320x568 → 667x375 →
   390x844 resizing keeps the focused button unobstructed.
3. The labelled generic product grid and labelled quantity spans produced axe
   ARIA naming warnings. The grid now has a named group role; quantities use
   native `output` elements. Maximum quantity is visibly and accessibly labelled
   “9 (max)”; the disabled plus has a dashed border and muted text rather than
   relying solely on colour.
4. The synchronized Visitor v2 appearance selects now receive the existing
   product focus ring and touch treatment. Their names, Tab/Shift+Tab focus,
   focused hit targets, selection events and actual appearance-state changes
   are verified. All seven fields remain accessible through the help scroller.

No product IDs, prices, orders, permissions, storage rules or network writes
change. Visitor v2 physical products, elevator, contacts and scene assets remain
upstream-owned. The focus callback and measurement belong to the Bag component;
the UI coordinator only supplies the intended destination.

## Browser acceptance and scope

`tests/browser_gjh_accessibility.py` passed **70 states**: 14 states at each of
320x568, 390x844, 768x1024, 1440x900 and 667x375. States include the guide,
exploration, map, help, empty/populated Bag, directory, image and 3D product
details, original tin viewer, shelf/held product and elevator ground/upper level.

- axe-core 4.10.3: zero violations in the tested WCAG 2A/2AA, 2.1AA and 2.2AA tags.
  Its reviewed local SHA-256 is pinned in the test; no runtime dependency is added.
- All measured visible button, summary, input and select targets are at least
  44x44 CSS px. This is the project's control target, also described by
  [WCAG's enhanced target-size guidance](https://www.w3.org/WAI/WCAG22/Understanding/target-size-enhanced.html),
  not a claim that 44px is the general AA minimum.
- 157 axe contrast-incomplete node checks resolve to a conservative DOM contrast
  minimum of **5.6185:1**. The gate uses unrounded ratios of at least 4.5:1, as in
  [W3C contrast guidance](https://www.w3.org/WAI/WCAG22/Understanding/contrast-minimum.html).
  The helper bounds translucent HUD backgrounds over unknown WebGL colours and
  refuses unsupported image/gradient/opacity/filter/blend cases. It does not
  quantify artwork, logos, illuminated models or scene labels.
- Actual modal Tab sequences, visible focus rings, focused-centre hit tests,
  Escape/Close restoration, quantity-nine behavior and sticky Close access at
  top/middle/bottom of Bag pass. Native modal traversal may visit browser chrome;
  the next Tab is verified to return to the modal, without focusing a background
  page control.
- Real keyboard cart activation resumes scene focus and movement at all five
  viewports. Actual pickup/return buttons and elevator round trips pass without
  injecting open dialogs or fake application results.

**Native option-popup keyboard choice: NOT VERIFIED.** This macOS headless Chrome
host also fails to change a plain, isolated HTML select with the identical
Space/ArrowDown/Enter sequence, without any application code or event cancellation.
The fixture result is retained in the report. The test still verifies keyboard
focus and changes the actual native control through Playwright's selection action,
then checks the application's selected hair state. That event-path evidence is
not presented as proof of keyboard navigation inside the OS popup.

Physical iPhone/Android, real safe-area insets, screen-reader sessions and native
OS popup choice remain unverified. This completes the Phase 6 **DOM focus/name/
target/dialog/contrast verification scope** under the task matrix's laboratory
contract; it does not complete the separate physical-device or broad final
acceptance gates and is not a blanket WCAG certification.

## Regression and visual review

Generation check, SSOT, 46 Python unit tests, Gallery browser checks and PWA
update/offline/installability checks pass on the synchronized candidate. Full V11
walking/collision/doors/inspection, movement pause, context loss, reduced motion,
WebGL/WASM failure and no-JavaScript checks pass. Earlier in this slice, all 28
legacy-demo cases and four no-JavaScript journeys passed; subsequent synchronization
does not change those four demos. Bag quantity/remove/clear/storage and Cart
deploy/stow/collision/failure checks also pass with the unchanged assertions.

Native ANGLE Metal is used on macOS ARM64, Chromium 157.0.8103.51, with reduced
motion and local HTTP. Touch is emulated. The contrast and focus results are
separate from physical-device and assistive-technology coverage.

Independent review inspected 1440/768/390 Bag frames, 320/667 focused-cart frames
and the Visitor v2 help controls. An initial 84/100 aesthetic assessment identified
the ambiguous disabled-plus state; the explicit maximum cue brought it to 85.
After retaining the shorter upstream Visitor v2 description, the final subjective
score is **86/100**: hierarchy 17/20, spacing 17/20, typography 12/15, colour
14/15, consistency 14/15, responsive 12/15. It is not measured usability or
accessibility certification. No task-related P0/P1 finding remains in independent
source/visual review and author security, lifecycle, integration and release review.

Evidence: `docs/evidence/v11-accessibility-before.json`,
`docs/evidence/v11-accessibility.json` and `docs/screenshots/v11-accessibility/`.
The final report pins the tested source hashes. Temporary Gallery/PWA screenshot
refreshes are excluded. Rollback uses a normal revert and regenerated output.
Remote commit, Actions and live behavior are verified separately after publication.


The final preflight also retained the upstream Visitor v2 source-commit receipt
update (`570c11d`). Runtime model bytes and all four hash-pinned tested UI files
are unchanged. Generated artifacts were rebuilt against that receipt.
