# Gallery collection redesign

Date: 15 November 2026 (Asia/Singapore).

## Behavior

The GJH collection now uses two compact cards per row from 560px upward and one card below 560px. Narrow-phone previews are 180px tall; larger previews use a 16:10 frame. Cards retain their version, title, description, details route and comparison checkbox, with Open live demo presented as the primary action. The independent-concept disclosure appears once above the collection toolbar.

The company introduction and toolbar are compact through tablet widths. Theme, language, build information and Check updates remain inline on desktop; at 1000px and below they are available through Settings. The native disclosure supports keyboard activation, first-control focus, Escape, outside click and focus restoration. Its panel overlays the page without changing the collection's layout. It is non-modal, so normal Tab navigation remains available. Crossing the desktop breakpoint resets the disclosure to the appropriate presentation.

The comparison tray retains removable design names, a selection count and the existing two-design limit. It uses normal document flow at compact widths to avoid covering card actions. Selections survive filtering; clearing restores focus to the style filter. Desktop retains the existing sticky comparison behavior.

When a verified application update becomes available, the settings disclosure closes through the `wdg:updateavailable` event. This fixes an E2E-reproduced case in which the settings panel intercepted clicks on the update notice. Existing verification, offline and update-consent rules are preserved.

## Source ownership

Templates and the card builder own markup; `assets/gallery.css` owns layout; `src/gallery.js` owns settings and collection interactions; `src/pwa.js` announces update availability. New strings are present in all three locale packs. Collection breakpoints and the square preview corner token are registered in `design-system/tokens.json`. Gallery pages and PWA hashes are regenerated through `scripts/build_gallery.py`.

## Verification

The focused runner `python tests/browser_gallery_layout.py` covers 320, 390, 559, 560, 639, 650, 651 and 1440px in three languages and two themes. It checks grid columns, header height, viewport overflow, settings bounds, keyboard/outside dismissal, focus return, background stability, resize transitions, comparison selection/removal/clear, card action hit areas, thumbnail decoding and runtime errors. It writes [layout evidence](evidence/gallery-layout.json) and screenshots under `docs/screenshots/gallery-layout/`.

The existing Gallery, PWA, preferences, shared-theme, unit and GJH-demo suites are run separately. Tests that capture existing reference screenshots run in an isolated working-tree copy to preserve ongoing repository evidence. The preferences/PWA runners use a shared helper that opens Settings through its visible control before interacting with controls inside it. The PWA scroll test closes settings and removes header focus before checking automatic header hiding; header focus intentionally keeps it visible.

Results: Gallery E2E passed at 1440/768/390/375px, including details/demo entry, comparison device previews, synchronized scrolling, invalid routes and no-JavaScript browsing. The focused layout runner passed all 48 width/language/theme combinations. Preferences passed its 24 combinations and persistence/offline/error recovery; the PWA suite passed after the update-action obstruction fix, including real service-worker update and activation-timeout recovery. Shared-theme checks passed across six routes, three widths and two themes. Gallery unit tests (11), preference unit tests (3), 28 GJH demo cases, four no-JavaScript demo journeys and source-asset integrity passed. Generator and SSOT checks passed after rebuilding.

The 390px first card measured approximately 400px high versus 487px in the baseline; the 639px first card is approximately 423px high versus 643px, with two cards per row. Its first row starts around document y=573 instead of y=773. Long descriptions and translations may increase height naturally. The 650/651px column discontinuity is removed: both widths now use two columns.

Retained suite evidence: [PWA](evidence/gallery-collection-pwa.json), [preferences](evidence/gallery-collection-preferences.json), [GJH demos](evidence/gallery-collection-demos.json) and [shared themes](evidence/gallery-collection-theme.json). Final state captures include settings, comparison selection and the collection at 390/639/1440px under `docs/screenshots/gallery-layout/`.

Final visual review also corrected intrinsic thumbnail sizing inside flex cards: images are positioned within the preview frame so their source proportions cannot enlarge it. The focused runner now asserts the preview height for every card (180px on phones, 16:10 otherwise) and passed again across all 48 combinations. The independent advisor accepted the refreshed desktop screenshot as well as the 639px collection, phone settings and selected-comparison states, with no blocking UI/UX/layout findings. Compact header height measured 73px including its border.

Limitations: headless Chrome and simulated viewport sizes do not establish physical-phone, Safari, screen-reader or field-performance acceptance. No local axe bundle was supplied. The earlier [advisor baseline](gjh-gallery-advisor-e2e-review.md) remains a historical record of the pre-redesign findings.

## Release verification — application 1.1.32

The collection changes were isolated on top of remote `main` commit `53a3e6e3f160da9def53bf6dc21d397621f039d8`, preserving the published V11 mode and LOD work. Uncommitted local onboarding and visitor changes were excluded. All 46 unit tests, SSOT/generated-output checks, Gallery E2E, all 48 layout combinations and the PWA lifecycle suite passed again in the release worktree. Earlier demo/preferences/theme evidence remains dated evidence of the implementation review; it is not represented as a fresh run against 1.1.32. See [release gate evidence](evidence/gallery-collection-release.json).
