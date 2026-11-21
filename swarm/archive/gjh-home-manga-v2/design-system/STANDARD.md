<!-- The SDS spec sets no raster byte cap, so PERF-02 uses existing gallery landing targets when the brief leaves the budget open. -->
# Swarm Design System standard

This standard applies to Swarm pages. [SDS_SPEC.md](SDS_SPEC.md) defines the interfaces. The gallery's SSOT ownership model and PWA browser checks inform the review procedure. [Gallery design system](../../ds.md) · [Gallery PWA checks](../../tests/browser_pwa.py)

Run commands from the repository root. Replace `<projectDir>` with the actual project directory. Lint references identify checks on section source. Test files verify implementation contracts. Manual rows describe checks on the assembled page or export. Accessibility rows cite applicable WCAG 2.2 A and AA criteria.

| id | rule | enforced by | verify command |
| --- | --- | --- | --- |
| UX-01 | Use one page `h1` and one banner, main, primary navigation and contentinfo landmark. Give distinct names to any additional navigation regions. Inspect the assembled heading outline and landmark list. | manual | manual |
| UX-02 | Design at 393 CSS px first. Reflow to 320 CSS px without document-level horizontal scrolling or loss of content or controls (WCAG 1.4.10). At 320, 393, 768 and 1440 px, check wrapping, content rail alignment and the reachability of controls. Horizontal rails must contain their own scrolling. | manual | manual |
| UX-03 | Use `--sds-safe-*` at the edges and reserve space for sticky or fixed controls. Check portrait and landscape on a device with a cutout. Verify that navigation and bottom actions clear the cutout and home indicator. | manual | manual |
| UX-04 | Links navigate and buttons act. Check default, hover, pressed, focus, disabled and busy states where applicable. Verify blocked activation while disabled and a stable accessible name while busy. | manual | manual |
| UX-05 | Give each data-driven block loading, empty, populated and error states with a recovery action where possible. Exercise each state and verify that status updates are announced without taking focus (WCAG 4.1.3). | manual | manual |
| A11Y-01 | Give each `img` an `alt` attribute (presence check for WCAG 1.1.1). | `missing-alt` | `node swarm/tools/check-sections.js <projectDir> --baseline` |
| A11Y-02 | Describe the purpose of meaningful images and use empty alt text for decorative images. Inspect rendered accessible names and read the image context to verify the alternatives (WCAG 1.1.1). | manual | manual |
| A11Y-03 | Make controls reachable and operable by keyboard (2.1.1). Tab forward and backward to check visible focus (2.4.7) and verify that sticky UI never fully hides the focused control (2.4.11). | manual | manual |
| A11Y-04 | Give controls hit areas of at least 44 × 44 CSS px using `--sds-tap`. Measure the actual clickable area at the narrowest supported view. | manual | manual |
| A11Y-05 | Give every form field a persistent, associated label and identify errors in text (WCAG 3.3.2 and 3.3.1). Submit empty and invalid values and verify that each error identifies the affected field. | manual | manual |
| A11Y-06 | Test the semantic color pairs in every light and dark brand combination. Require 4.5:1 for text pairs and 3:1 for specified focus and essential boundary pairs (WCAG 1.4.3 and 1.4.11). | `swarm/test/sds-tokens.test.js` | `node --test swarm/test/sds-tokens.test.js` |
| A11Y-07 | Check contrast where text or controls sit over imagery or custom surfaces. Sample the least favorable rendered backgrounds and states in each theme. Require 4.5:1 for normal text, 3:1 for large text and 3:1 for essential controls and state indicators (WCAG 1.4.3 and 1.4.11). | manual | manual |
| MOT-01 | Animate `transform` and `opacity` only. Inspect keyframes and transition property lists, including reveal and loader animations. | manual | manual |
| MOT-02 | Use `--sds-dur-*` for time-based motion. | `raw-duration` | `node swarm/tools/check-sections.js <projectDir> --baseline` |
| MOT-03 | Use `--sds-ease-*` for easing. | `raw-easing` | `node swarm/tools/check-sections.js <projectDir> --baseline` |
| MOT-04 | Cap time-based motion at 600 ms and honor `prefers-reduced-motion`. Inspect animation and transition timings, then enable reduced motion and check that reveals, controls and loader effects stay readable without motion. | manual | manual |
| MOT-05 | Mark reveals with `data-reveal="fade"`, `"rise"` or `"scale"`. Use `animation-timeline: view()` when supported. Check the runtime fallback and disable JavaScript in a browser without timeline support to confirm content remains visible. | manual | manual |
| LDR-01 | Show a first-paint skeleton or progress indicator and preserve the final content's footprint. On a throttled cold load, compare content positions before and after the loader clears and check the performance trace for loader-induced layout shifts. | manual | manual |
| LDR-02 | Dismiss the first-paint loader after paint and readiness of fonts and above-the-fold images, or at the 2,500 ms fallback, whichever comes first. | `swarm/test/sds-runtime.test.js` | `node --test swarm/test/sds-runtime.test.js` |
| PWA-01 | Export a standalone manifest with `name`, `short_name`, relative `start_url` and `scope` (`./`), theme and background colors, and 192, 512 and maskable 512 px icons. Inspect the manifest and browser installability on a project subpath. | manual | manual |
| PWA-02 | Name the service worker cache with `sds-`, the release version and the file-list hash. Require its precache list to match the exported file list exactly. | `swarm/test/sds-pwa.test.js` | `node --test swarm/test/sds-pwa.test.js` |
| PWA-03 | Serve precached assets cache-first with network fallback. Reload a controlled page offline and visit an uncached navigation to check `offline.html`. Exercise a missing cached asset online to verify the network fallback. | manual | manual |
| PWA-04 | The owner requires a scale-1 zoom lock on the PWA shell only. Locking zoom fails WCAG 1.4.4 (Resize Text). Inspect the shell for the exact viewport meta specified in SDS_SPEC.md, `touch-action: manipulation` on `html`, and `data-viewport-lock`. Check pinch suppression on iOS and confirm that text in the `--no-pwa` export can resize to 200 percent without loss of content or function. | manual | manual |
| PWA-05 | Apply a waiting update only after the user selects **Update now**. Serve two releases under the same subpath. Verify that **Check updates** offers the new version while the old one remains visible, then apply it and verify the new version displays at the same URL. Check that stale SDS caches are removed, unrelated caches survive and a failed update leaves a usable page. | manual | manual |
| I18N-01 | Mark visible section text with `data-i18n` and keep the inline English fallback. The check reports unmarked text as a warning. | `no-i18n-text` | `node swarm/tools/check-sections.js <projectDir> --baseline` |
| I18N-02 | Set `<html lang>` on each language change (WCAG 3.1.1). Use `Intl.PluralRules` for plurals and `SDS.i18n.format` for localized number, date and currency display. | `swarm/test/sds-i18n.test.js` | `node --test swarm/test/sds-i18n.test.js` |
| I18N-03 | Use `data-i18n-attr` for localized attributes and keep meaningful text in HTML. Inspect generated CSS content and switch among `en`, `zh-Hans` and `ms` to check labels, titles, alt text and English fallback. Confirm `machine-draft` status on unreviewed translations. | manual | manual |
| I18N-04 | Allow 40 percent text expansion. Keep Chinese text free of inline `<br>` elements and use the shared `:lang(zh)` line-breaking styles. At 320 and 393 px, test expanded headings, buttons and messages, then switch to Chinese and check punctuation, wrapping and clipping. | manual | manual |
| TOK-01 | Consume semantic color tokens. Keep raw colors and private color custom properties out of section CSS and inline styles. | `raw-color` | `node swarm/tools/check-sections.js <projectDir> --baseline` |
| TOK-02 | Use SDS type tokens in section CSS and inline styles. Use `var()` references for type sizes within fluid `clamp()` expressions. | `raw-font-size` | `node swarm/tools/check-sections.js <projectDir> --baseline` |
| TOK-03 | Use SDS z-index tokens for section layers. | `raw-z-index` | `node swarm/tools/check-sections.js <projectDir> --baseline` |
| TOK-04 | Use SDS spacing tokens in section CSS. The check reports raw spacing as a warning. | `raw-spacing` | `node swarm/tools/check-sections.js <projectDir> --baseline` |
| TOK-05 | Keep editable token values in `tokens.json` and regenerate `tokens.css`, `themes.css` and `TOKENS.md` with `build.js`. | `swarm/test/sds-tokens.test.js` | `node swarm/design-system/build.js --check` |
| TOK-06 | Scope section selectors under the owning `.s-NN`. | `unscoped-selector` | `node swarm/tools/check-sections.js <projectDir> --baseline` |
| TOK-07 | Use the `.sds-*` component bases from `components.css`. Keep unscoped base redefinitions out of sections. | `redefine-sds-base` | `node swarm/tools/check-sections.js <projectDir> --baseline` |
| TOK-08 | Keep `!important` out of section styles. | `important` | `node swarm/tools/check-sections.js <projectDir> --baseline` |
| TOK-09 | Keep section fragments script-free and shared behaviors in the SDS runtime. Use one root per section. Review the fragments and exported document for section scripts, inline handlers or local implementations of theme, language, reveal, loader or PWA behavior. | manual | manual |
| THM-01 | Support `light`, `dark` and system-following `auto`, plus a separate `none`, `forest-gold` or `gjh-classic` brand choice. Switch both controls, reload, change the OS preference under `auto` and inspect the shell before first paint with saved preferences. | manual | manual |
| THM-02 | Keep the full semantic role set in all six theme and brand combinations. Generate theme and brand overrides from `tokens.json`. | `swarm/test/sds-tokens.test.js` | `node --test swarm/test/sds-tokens.test.js` |
| PERF-01 | Keep inline data URIs at or below 20 KB. Reference larger assets by URL. | `inline-large-data-uri` | `node swarm/tools/check-sections.js <projectDir> --baseline` |
| PERF-02 | Use responsive image candidates and lazy-load below-the-fold images. Apply the brief's image budgets or default to 150 KB for the mobile hero and 200 KiB per other page raster candidate. On cold mobile and desktop loads, verify requested sizes, encoded image bytes and which images load before scroll. | manual | manual |
| PERF-03 | Reserve image space with intrinsic dimensions and a matching aspect ratio for each art-directed crop. Record a cold-load performance trace and verify that image and font loading introduces no layout shifts. | manual | manual |

The default raster budgets come from existing landing-page work. [Mobile hero budget](../../docs/gjh-landing-roadmap.md) · [Raster candidate cap](../../docs/gjh-v22/design-brief.md)

## Acceptance checklist for a finished page

- [ ] Run the token sync check, section ratchet, catalog check and SDS tests. Resolve new findings and record any baseline debt by rule ID.
- [ ] Inspect the exported page at 320 px, 393 px, tablet and desktop widths. Verify hierarchy, keyboard operation, touch targets, form feedback and safe areas. Check the console and network for unexpected errors or failed requests.
- [ ] Switch language, theme and brand live. Test expanded text and Chinese wrapping. Obtain and record native-speaker review of machine-drafted translations before publication.
- [ ] Exercise reduced motion, a cold throttled load, and the reveal fallback. Record layout-shift and image-size evidence.
- [ ] Serve the export under a project subpath and check installability, offline reload, fallback and the consent-based update path across two versions. Record browser, viewport and revision with the evidence. Record physical iOS or Safari checks as unverified until exercised.

## Definition of done per round

- **Discuss and decide**. Read the brief, direction, decisions and channel. Identify dependencies and overlaps, mention the relevant section owners and record the agreed handoffs before implementation.
- **Work**. Edit only assigned files, verify the changed section in the assembled page and run its relevant checks. Send the handoff to affected owners and post one `done` line with the result.
- **Review**. The manager reads the page as a whole and records findings for accessibility, localization, and motion and performance. Assign each change to its owner with the failed rule or observable behavior.
- **Improve and close**. Apply assigned fixes, rerun the failed checks and affected interactions, and record the results and any unverified items. The manager applies the finished-page checklist before closing the page.
