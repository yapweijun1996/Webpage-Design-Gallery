# GJH SSOT and interaction review

## Scope and invariants

Reviewed versions: V1, V5, V6, V7, V8, V9, V10 and V11. These are the eight metadata-backed versions in this checkout. Existing addresses, company and product copy, official asset bytes, independent art directions and 3D dependencies remain unchanged.

The gallery owns the catalog and PWA lifecycle. Individual demos remain network-only independent documents. They consume generated primitive tokens without importing Gallery component CSS. Local styles still own each concept's palette, composition and scene artwork; the new shared contract changes interaction behavior and legibility, not brand identity.

## Source ownership

- `design-system/tokens.json` → `assets/tokens.css`: shared interaction dimensions, spacing and typography.
- `demos/corporate/gjh/shared/interaction.css`: scoped target sizing, text floors, focus dimensions, safe areas and reduced-motion behavior. Every rule is scoped to `data-gjh-design`; the Gallery does not import this stylesheet.
- `demos/corporate/gjh/shared/navigation.js`: one parser-blocking progressive-disclosure bootstrap and navigation implementation for V1, V5, V6, V7 and V8. It establishes the compact layout before paint and initializes its own handlers at DOM readiness; failed script loading leaves the native expanded navigation available.
- `demos/corporate/gjh/shared/scene-loading.js`: V10 initial viewport reservation, bounded loading state and accessible-directory recovery.
- `design-system/themes.json` → `assets/gjh-themes.css`: version-scoped semantic palettes, typography and art-direction tokens. Each version's `style.css` retains composition; generated token/theme CSS loads before local styles, with the shared interaction contract last.
- Each version's `script.js`: entry point and concept-specific behavior. V8 retains history, region and depth interactions; V9 retains its CSS camera; V10/V11 retain their separate graphics/physics runtimes.

No new framework, package manager, demo service worker or per-version PWA manifest is introduced. Shared resources must be in the generator's publication allowlist and release digest. The Gallery's network-only demo policy remains intact.

## Issue and fix register

| ID | Evidence before change | Resolution | Versions |
| --- | --- | --- | --- |
| GJH-01 | Four `script.js` files were byte-identical; V8 maintained another copy of the menu lifecycle. | Extract `initNavigation()` with native-anchor preservation, Escape return, outside-click focus repair and responsive disclosure handling. | V1/V5/V6/V7/V8 |
| GJH-02 | All eight viewport tags permitted zoom but lacked `viewport-fit=cover`; safe-area rules were absent or narrowly limited. | Keep zoom enabled; consume top/right/bottom/left safe insets. Immersive fixed header and scene use the same header-height contract. Dialog height accounts for safe insets. Physical-device behavior remains a separate validation requirement. | All |
| GJH-03 | Target dimensions and reduced-motion/focus rules were repeated; some footer/concept links were smaller than the project target. | Use generated interaction tokens in one scoped stylesheet; make actionable footer/concept links and shared controls at least 44px high. Preserve theme-specific focus colors. | All |
| GJH-04 | Immersive product descriptions, links and operating controls used 8–11px text in several narrow layouts. | Raise product prose/action copy to semantic 14px and operational/secondary copy to 12px where space permits; leave decorative scene labels under their own composition rules. | V9/V10/V11 |
| GJH-05 | V10's global room key handler also consumed arrow/WASD keys while navigation controls had focus. View switching could hide the focused element. | Exclude native interactive controls from room shortcuts, provide destination-specific view-toggle accessible names, and move focus into the newly visible view if necessary. | V10 |
| GJH-07 | At 390px the disclaimer and return link were stacked above the header, delaying the hero in four corporate versions. | Keep the full disclosure and 44px return target together in one compact responsive row. | V1/V5/V6/V7 |
| GJH-08 | A new browser test reproduced Tab moving focus outside the V9 product dialog after the final link. | Cycle Tab/Shift+Tab explicitly between the first and last visible dialog controls; retain native Escape and restoration of moved product details. | V9 |
| GJH-09 | PerformanceObserver identified the mobile navigation collapsing only after ES-module initialization: the main content moved upward about 270px (CLS around 0.24–0.27). | Load the shared navigation owner synchronously in the head; it establishes the compact layout before first paint and initializes its own handlers. No-JavaScript browsing stays expanded. Root targeted nine-case rerun measured CLS 0–0.000914; an independent cold-load probe measured up to 0.00927 from remaining font metrics. These are local samples, not field Core Web Vitals. | V1/V5/V6/V7/V8 |
| GJH-10 | V10 revealed the full scene only after asynchronous graphics initialization, displacing the list layout. | Reserve its actual viewport before paint, show a truthful loading message and keep the directory below. Script failure or a 20-second loading timeout reveals the directory. Late readiness does not steal the screen after fallback or user scrolling. | V10 |
| GJH-06 | V11 collected movement keys while other navigation controls had focus and could keep a previously held movement key after focus changed. | Limit movement keyboard input to canvas/body, ignore modified shortcuts, and clear held input on focus transfer. Existing touch/physics logic is preserved. | V11 |

## Thirteen review perspectives

These are thirteen analytical perspectives, not thirteen separately executed reviewers. Runtime results are reported separately from source inspection.

| Perspective | Decision and evidence boundary |
| --- | --- |
| 1. Visual identity | Preserve V1 corporate red, V5 heritage editorial, V6 bento portfolio, V7 signature dark, V8 immersive heritage, V9 CSS street, V10 arcade and V11 walkable mall. No wholesale visual replacement. |
| 2. Hierarchy | Keep each version's hero/story or store-scene focal point; improve tiny operational copy without inflating decorative signage. |
| 3. Typography | Shared 12px secondary and 14px product-reading floors coexist with local display typography. |
| 4. Spacing and density | Shared control dimensions; local scene and editorial spacing remain intentionally different. |
| 5. Branding and image fidelity | Official logos, image copies and asset receipts are unmodified. Shared primitives do not imply a new GJH brand manual. |
| 6. Navigation usability | Five corporate versions share one disclosure behavior; immersive modes retain accessible list alternatives. |
| 7. Keyboard and focus | Preserve Escape, native links and focus restoration; fix global movement shortcuts interfering with control focus. |
| 8. Responsive layout | Reserve safe areas and tokenized interaction targets; test actual mobile/tablet/desktop renders before release. |
| 9. Accessibility semantics | Preserve native buttons, links, disclosures and dialogs; viewport zoom remains permitted. No blanket WCAG conformance claim. |
| 10. Motion and performance | Preserve reduced-motion behavior and V10/V11 render/lifecycle limits; add no animation or graphics dependency. |
| 11. Reliability and fallback | Preserve no-JavaScript corporate browsing and immersive list/WebGL fallback. No fabricated loading or offline success state. |
| 12. Maintainability and isolation | One menu module replaces five ownership points. Shared CSS is explicitly scoped; local scene code remains independent. |
| 13. Business presentation | Preserve unofficial-concept disclosure, official contact/shop links and product provenance caveats. No invented products or commercial claims. |

## Verification record

- `node --check`: all eight demo entry points and the shared navigation module PASS.
- Static HTML parsing: unique IDs across all eight pages PASS.
- `git diff --check`: PASS at source handoff.
- `tests/browser_gjh_demos.py`: 28 viewport cases across V1/V5/V6/V7, four no-JavaScript journeys and official asset integrity PASS again after central-theme extraction and compact mobile-disclaimer adjustment. The subsequent pre-paint navigation timing fix is covered by root targeted CLS/browser verification; final acceptance must use the release evidence.
- `tests/browser_gjh_v8.py`: five viewport cases (1920/1440/768/390/320), normal-motion desktop/mobile behavior, keyboard controls and no-JavaScript checks PASS again after final theme extraction; subsequent pre-paint timing verification is recorded by root acceptance.
- An initial 24-capture matrix covered all eight versions at 1440×900, 768×1024 and 390×844 with no page exceptions or document overflow. The three contact sheets were visually inspected. They are intermediate evidence, not proof of the final migration state.
- `tests/browser_gjh_v9.py`: new explicit keyboard, four-product dialog, view-toggle/deep-link restoration and no-JavaScript coverage. Initial testing found GJH-08; the final four viewport journeys and no-JavaScript fallback PASS, recorded in `docs/evidence/gjh-v9-browser.json`.

The legacy GJH runner prints an axe violation count even when no axe bundle was supplied; those runs explicitly report axe as UNVERIFIED. Do not interpret a printed zero as an executed accessibility scan. Root acceptance owns the final cross-version axe/browser runs and V10/V11/PWA suites.

Release evidence must cover each version at desktop, tablet and mobile widths, keyboard and no-JavaScript/list fallback, no document overflow, real visible screenshots and console errors. Field Core Web Vitals, physical iOS/Android installation and complete screen-reader conformance cannot be established by a local static capture.
