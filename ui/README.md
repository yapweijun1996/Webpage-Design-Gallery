# Homepage editorial redesign

The user requested a whole-page redesign with a UI advisor. Codex CLI `gpt-6-luna` reviewed the real desktop/mobile baseline and produced `home-redesign-proposal.md` and `home-redesign-proposal.svg`. The PNG export is an illustration, including a schematic company preview; the implementation uses the existing real company screenshot.

## Evidence

- Proposal illustration: [home-redesign-proposal.png](home-redesign-proposal.png).
- Real desktop: [before](home-before-1440.png), [after](home-after-1440.png).
- Real mobile: [before](home-before-390.png), [after](home-after-390.png).
- Additional real after screenshots: 829, 768 and 375px.

The implementation adopts warm paper, dark ink, burnt-orange accents, serif display type, an asymmetric desktop introduction and a stacked mobile company feature. Theme overrides are limited to company discovery. Actual inventory, search/filter controls, company navigation and PWA controls are preserved.

## Verification

Real Chrome checks at 1440, 829, 768, 390 and 375px passed: no horizontal overflow, skip-link keyboard focus, empty search, category filtering/reset, company collection navigation, eight-design inventory and no page exceptions. The built-in browser was updated through the existing explicit PWA update action and visibly showed the new homepage.

Generator freshness and all 11 gallery unit tests passed. Browser regression suites run from an isolated copy to avoid overwriting concurrent demo screenshots. All required browser suites passed: `browser_gallery.py` (four widths, synthetic catalog, no-JavaScript and invalid-route cases), `browser_pwa.py` (offline/update/cache consent and recovery), and `browser_gjh_demos.py` (28 responsive cases, four no-JavaScript journeys and asset integrity). The demo runner was not supplied an axe-core script, so its printed zero violations is not an executed axe audit. No physical-device or screen-reader session was performed.

The additional SSOT gate reports a concurrent, out-of-scope `demos/corporate/gjh/v11/style.css` declaration (`font-size: .85em`). The changed gallery CSS adds no SSOT debt. Concurrent demo source and screenshot changes were preserved.
