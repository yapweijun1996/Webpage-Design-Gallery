# Gallery PWA preferences and acceptance

Date: 2026-11-15 (Asia/Singapore). Profile: **CONTENT**, with a public, read-only, offline gallery shell. This implements selected requirements of the house `pwa:product-standard` v1.1.0; it is not a claim of 60 executed E2E cases, complete WCAG conformance, or cross-platform release certification.

## Scope and owners

- `src/preferences-boot.js` applies Light/Dark/System before CSS paint. `src/preferences.js` owns appearance, language rendering, safe local storage, cross-tab synchronization and regional formatting. `wdg.theme` and `wdg.language` contain preferences only; no credentials or private data are stored.
- `design-system/tokens.json` owns light/dark primitives; `assets/tokens.css` is generated. `assets/gallery.css` consumes them for the gallery and its editorial directory. Independent demos/iframes are not translated or themed by the gallery.
- `locales/en.json`, `zh-Hans.json` and `ms.json` own translations. English source messages are stable keys, including named-placeholder patterns for runtime status. The renderer retains original text/attributes separately from displayed translations and observes gallery mutations, preserving input values, listeners, focus and controller state. User input and demo documents are not rewritten. Native language names remain untranslated.
- The generator rejects missing keys, empty/non-string values and mismatched placeholders. Runtime dictionary access uses own-property checks. Unknown future catalog text falls back to its original English source; new content needs corresponding locale entries. Company/brand names and technical identifiers remain proper names.
- Number, date and currency helpers use `Intl` with en-SG, zh-Hans-SG or ms-MY. Currency is explicit (SGD by default). The current gallery has no monetary/date dashboard; no fabricated financial metrics are added.

## Failure and update behavior

Language packs are loaded as small same-origin JSON files with an abort timeout covering headers and body. Missing packs fall back to English; a failed English fetch can still use canonical pattern keys from a validated available pack. All-pack failure leaves the English markup usable. Storage denial keeps the controls working in the current tab and announces that persistence is unavailable. Invalid stored preferences fall back to English/System. English remains the initial progressive-enhancement language and no-JavaScript browsing remains available.

The generator includes preference scripts and all language packs in the release hash and integrity-checked precache. Offline cold navigation can switch between all saved languages. Appearance/language choices survive reload, deep links and verified release changes. The existing worker integrity checks, app-scoped cleanup, explicit activation consent, single reload and failed-update recovery are retained. A current comparison selection blocks activation and focuses its clear action, so the user decides when to discard that transient selection. Search/filter state remains URL-backed. There are no editable drafts, payments, authenticated mutations or IndexedDB schema in this CONTENT profile; transaction and pending-write migration cases are not applicable.

## Acceptance and evidence

- `python scripts/build_gallery.py --check`: generated output and precache freshness.
- `python -m unittest discover -s tests -p test_preferences.py -v`: locale key/type/placeholder publication gates.
- `python tests/browser_preferences.py`: 24 language/theme/width combinations (1440/768/390/320), empty state, text/control contrast, 44px preference controls, System tracking, persisted explicit overrides, localized search, selection preservation, detail/compare/error/offline routes, regional formats, cross-tab synchronization, unknown-key safety, denied storage, failed/stalled language responses and real offline cold navigation.
- `python tests/browser_pwa.py`: existing release-integrity/activation/offline cases plus comparison-selection activation guard and preference persistence across A-to-B update.
- Existing Gallery and GJH demo browser suites remain regression checks. Demo screenshot-writing regression suites run in an isolated repository copy to preserve concurrent demo assets. The PWA and preference suites record their own evidence without rewriting demo assets.
- [Preference evidence](evidence/preferences-browser.json) binds the local test to build, browser, OS and timestamp. [Final smoke evidence](evidence/preferences-final-smoke.json) additionally records source and screenshot SHA-256 values against the final generated app. The full preference run and final smoke may have different build IDs because concurrent, unrelated onboarding assets participate in the shared build hash; the smoke verifies the final gallery preferences without claiming to retest that separate feature. Real screenshots live in `docs/screenshots/preferences/`.

Incremental uncompressed budget for both preference scripts and all three locale files: **80 KB combined**, checked in the browser runner. This bounds the added runtime payload only. Field LCP/INP/CLS: **INSUFFICIENT_DATA**. This work does not claim a field-performance pass.

Chrome desktop on macOS is executed. Physical Android/iOS installation, Home Screen status bar rendering, Safari/Firefox/Edge, VoiceOver and human translation review are **NOT_RUN**. Native select opening/closing remains browser/OS-owned; programmatic option selection does not prove every OS popup layout. No release, push or deployment is included. Rollback consists of reverting the feature source changes and rebuilding; existing installed users retain the old coherent shell until accepting the next verified build.

## Main publication candidate

The isolated publication candidate is based on `origin/main` commit `d636ce0` and excludes parallel, uncommitted 3D onboarding changes from the author's working copy. All generated pages and worker hashes are rebuilt from that isolated source. Real 1440/768/390 screenshots were viewed before machine checks; independent visual review scored 90/100 (18/20 hierarchy, 18/20 spacing, 13/15 typography, 14/15 color, 14/15 consistency, 13/15 responsiveness). This subjective score does not replace measured accessibility checks. Release screenshots are `ui/release-1440.png`, `release-768.png` and `release-390.png`.
