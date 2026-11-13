# Compact company directory — release 1.1.4

## Delivered scope

The single-company directory now presents its real design preview and collection action before secondary filters. The desktop featured card uses the full content width. At narrow widths the preview precedes the company copy in both DOM and visual order. Multi-company catalogs retain filters before the grid. Company and demo URLs, source inventory, PWA update consent and independent demo themes are unchanged.

Sources: `templates/gallery/home.html`, `assets/gallery.css`, `scripts/build_gallery.py`, `data/app.json`. Generated pages and worker are rebuilt, never hand-edited. An added contract test checks single/multiple inventory order, one filter instance, cover-before-copy DOM order and the separate Companies route heading. No new design-system token debt.

## Verification

- 36 Python unit tests: PASS.
- Design-system/SSOT and deterministic generated-artifact check: PASS.
- Existing `browser_gallery.py`: PASS at 1440, 768, 390 and 375, including company flow, filters, comparison, images and no console errors. Synthetic 120-company / 1,200-design pagination/search, no-JavaScript browsing and invalid-route handling also pass. Synthetic inventory is not public content or field-performance evidence.
- Existing `browser_pwa.py`: PASS for real Chromium service-worker installability, offline browsing, mixed-hash rejection, waiting-worker update prompt, explicit activation, other-tab consent, owned-cache cleanup and timeout recovery.
- Independent visual inspection at 320, 390, 768 and 1440: PASS for the intended hierarchy, loaded cover, visible company identity/action and no horizontal overflow. Mobile cover begins near y=357, compared with the earlier live baseline near y=825 at 390px. Card → search → category keyboard sequence matches the source order.
- Keyboard no-results/reset/category checks and 200% CSS-zoom reflow: PASS. CSS zoom is not a native browser-zoom or screen-reader certification.
- Final source diff/whitespace review: PASS. An initial final-step whitespace failure was corrected in the template and both complete browser suites rerun successfully. All earlier evidence is retained separately.

Evidence: `evidence/homepage-compact-20261113/final/` and `independent/`. Independent screenshots preceded the final version-label/Companies-heading correction; layout CSS is identical. Final browser-suite screenshots and PWA report cover release 1.1.4. Earlier project evidence was preserved rather than overwritten.

## Limits and release controls

Physical Android/iOS, Safari, screen readers and native OS install dialogs were not tested. The empty-results reset precedes the search input in DOM; users can reach it with reverse Tab, while keyboard Enter activates it normally. No claim of complete accessibility compliance or field Core Web Vitals is made.

KB retrieval completed under the updated caller-runtime permission model. Optional companion was unavailable; these are actual local test observations, not companion-signed receipts or host-audited completion.

Main publication and GitHub Pages deployment were explicitly requested by the owner. Before publication, require remote main to remain at the reviewed baseline `17fad71d8be714cc4ce3ce7ddfc1bc9e4de08acd`; stop on divergence. Rollback, if needed and authorized, is a revert of this release commit followed by the same generator/test/deployment checks, not a force push. This review records local validation; deployment requires separate live observation.
