# Premium landing-page QA

Release 1.1.64, November 17, 2026. The review covers eight independent GJH landing pages and their gallery integration. See the [page-by-page findings and next-iteration plan](gjh-landing-roadmap.md), [desktop overview](screenshots/premium-landings/overview.jpg) and [mobile overview](screenshots/premium-landings/mobile.jpg).

## Browser evidence

| Check | Result |
| --- | --- |
| Built site | The production generator included two companies and seventeen designs, including sixteen GJH concepts. The landing-page test served the generated Pages artifact. All eight pages loaded their local images, CSS and scripts without recorded console errors or local HTTP failures. |
| Responsive layout | Chrome 157 passed all 32 combinations of V12–V19 and 320, 390, 768 and 1440 CSS pixels. Each page had one visible primary heading and no document-level horizontal overflow. Extra V13 tests measured actual heading text bounds on either side of its narrow breakpoint. |
| Keyboard and accessibility | The skip link reached main content on every route. Automatic WCAG-tagged axe-core 4.10.3 scans returned zero violations at 390 and 1440 for all eight initial states. Focused checks also covered the selected V18 channel and the generated V19 draft. V16 Escape returned focus to the menu button. |
| Without JavaScript | At 320 and 390 each page kept its heading, navigation and readable width. V17 links exposed the food profiles, V18 exposed all four chapters and V19 offered the official contact form directly. |
| Page-specific tasks | V17 exercised a brand link and Back to restore the last-opened marker using a deterministic brand-destination fixture. V18 switched four channels by keyboard, restored a channel with Back and retained it on reload. V19 generated a category/topic-specific draft, selected the full message and cleared stale text after an input change. |
| External destinations | A separate live check fetched all 18 distinct URLs and matched page titles or content to the expected destinations. Sony and Casio's manufacturer URLs returned 403 in the tested browser. Their replacements on GJH's own site returned 200. The contact form was opened for verification without submitting an enquiry. |
| Gallery and PWA regressions | Isolated browser suites exercised filtering, device switching, live/screenshot comparison, error states, offline access, update integrity and legacy GJH navigation. The legacy demo suite covered 28 viewport cases and four no-JavaScript paths. |
| Asset integrity | All 98 original WebPs decoded. IDs, sizes, dimensions, transparency and SHA-256 matched the library manifest. Full-resolution assets total 15,683,678 bytes. Each concept uses only its selected local runtime files. |
| Build checks | Theme generation and the design-system debt check passed. All 61 Python tests passed. The Node suite passed 103 tests and skipped one optional comparison with an external SVG Icon Studio checkout. |

## Changes confirmed during review

- V12 and V13 preserve the proportions of official brand artwork. V12 names its hero action and identifies the generated family illustration. V13 gives prospective partners a direct contact route and fits its headline at 320px.
- V14 distinguishes its generated provision-counter illustration from the historical composite published by GJH. V15 gives food, electronics and health separate destinations. V16 leads to the collection and supports compact navigation with and without JavaScript. A full-size, colour-profile-preserving WebP of the New Moon brand cover reduces its requested file from 219,929 to 61,522 bytes on V15 and V16. Cold-cache requests dropped by 154.7 KiB per first visit at both viewport sizes in local Chrome. The original JPEG and derivative source records are retained.
- The eight pages use the repository's version-scoped theme registry. Site-generated comparison and service-worker outputs were rebuilt. Gallery titles and summaries have English, Simplified Chinese and Malay entries.
- The review used KB-MCP guidance for task-based inspection, independent design themes and desktop/mobile visual checks. The observations and test counts above come from this repository's browser runs.

## Reproduction

Run from the repository root with the local Chrome executable in `GALLERY_CHROME`. The browser environment requires Playwright and Pillow.

```sh
python scripts/build_gallery.py --output _site
python tests/browser_premium_landings.py --site-root _site --axe-script /path/to/axe.min.js
```

The runner checks the bundled audit script's SHA-256 against the reviewed axe-core 4.10.3 digest. Add `--capture` to refresh the 390, 768 and 1440px screenshots and thumbnails, then regenerate the gallery. Browser emulation and automated accessibility scans leave physical devices, Safari, screen readers, field performance and real buyer or consumer usability for the next round of review.
