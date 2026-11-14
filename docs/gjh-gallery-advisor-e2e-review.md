# GJH Gallery E2E and UI/UX advisor review

Date: 15 November 2026 (Asia/Singapore).

## Scope and environment

Review the Gallery header and GJH design collection, including the owner's 639x826 annotated viewport. Existing repository suites ran in an isolated working-tree copy so their screenshot and evidence writes would not replace ongoing work. Supplemental checks exercised the existing page at `http://127.0.0.1:23149/`. These are separate targets: repository suites build a fresh artifact under a GitHub Pages-style prefix; the live local page uses existing generated files.

Environment: macOS, headless Chrome 157.0.8103.51 and the existing Python Playwright environment at `/tmp/gjh-popup-qa-venv`. Set `GALLERY_CHROME` to `/Applications/Google Chrome.app/Contents/MacOS/Google Chrome` for the browser commands below. The default Python lacked Playwright; rerunning with the existing environment resolved that setup issue. The referenced `instruction-modules/verification.md` was absent.

## Verification

| Check | Result | Coverage |
| --- | --- | --- |
| `python scripts/build_gallery.py --check` | FAIL on original working tree and initial copy | Eight stale outputs: `index.html`, `companies/index.html`, `companies/gjh/index.html`, `designs/index.html`, `compare/index.html`, `offline.html`, `version.json`, `sw.js`. |
| Regenerate, then repeat `--check` in isolated copy | PASS | Confirms regeneration resolves the observed mismatch in that copy. Original outputs were not replaced during this review. |
| `python -m unittest discover -s tests -p test_gallery.py -v` | PASS | 11 tests. |
| `python tests/browser_gallery.py` | PASS | 1440/768/390/375px: search, filters, keyboard comparison selection, selection across filters, removal/clear, comparison device widths, synchronized scrolling, screenshots, details and live demo. Also invalid routes, no-JavaScript browsing and synthetic pagination. No captured console errors. |
| `python tests/browser_pwa.py` | PASS | Installation metadata, offline browsing, update integrity, selection/update guard, language/theme preservation and activation recovery. |
| `python tests/browser_preferences.py` | PASS | 24 responsive language/theme combinations; persistence, cross-tab synchronization, localized states and storage/network/offline recovery. |
| `python tests/browser_gjh_demos.py` | PASS | 28 browser cases across V1/V5/V6/V7, four no-JavaScript journeys and source-asset integrity. No axe bundle supplied. |
| Supplemental live-page navigation and sorting | PASS | 390/559/560/639/650/651/1440px: header identity returns home, company card returns to collection, alphabetical sorting survives reload. No page-level overflow or captured JavaScript page errors. |
| Live-page lazy thumbnails | PASS | Scrolled each of the eight cards into view and successfully decoded its image. |

Measurements are stored in [layout evidence](evidence/gjh-gallery-advisor-layout.json). They describe the tested live-page state, not a redesigned implementation or production deployment.

## Advisor recommendations

The independent advisor reviewed the supplied screenshot, current templates/CSS/JavaScript and the 639px browser capture. Functional flows passed the Gallery suite; the main design concern is browsing efficiency.

1. **Layout:** at 639px, the header is about 152px tall and the first card starts at document y=773 with a height of about 643px. At 390px, the header is about 212px tall and the first card starts at y=888. Compact the company introduction and toolbar as well as the header. The current 650/651px switch changes the first card from approximately 650px tall in one column to 444px in two columns; evaluate a two-column layout from 560px.
2. **UI:** retain the theme, establish a consistent thumbnail/version/title/description/action hierarchy, reduce repeated text and lower-card whitespace, and emphasize Open live demo over View details. Proposed 16px spacing and 16:10 previews must be reconciled with existing design tokens and image legibility.
3. **UX:** preserve tested filter, sort, details and comparison behavior. Keep Compare in a consistent location and make selected designs removable even when a filter hides their cards. Compact the selection tray without obscuring focused controls. Put narrow-screen preferences in an accessible settings entry, with explicit close and focus return behavior.

Proposed redesign acceptance: two identifiable directions together at 639px; approximately 360–400px cards at 390px, allowing natural growth for long titles/translations; 44px touch targets; visible keyboard focus; no overlapping controls or page overflow. Retest 390, 559/560, 639, 650/651 and desktop, including settings, comparison selection and scrolling. These remain proposed targets.

## Remaining limits

The original working tree still needs generated-output synchronization before release. No UI redesign was implemented by this review. Browser emulation does not establish physical iOS/Android behavior, Safari/Firefox/Edge compatibility, screen-reader coverage or field performance. Full-page screenshots can contain unloaded offscreen lazy thumbnails; this alone is not a missing-image finding. No local axe bundle was supplied, so an axe result is not claimed.
