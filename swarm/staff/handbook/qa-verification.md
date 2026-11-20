# QA and Verification

<!-- Test auto as system preference following and treat brand as a separate matrix dimension. -->

## Purpose

Verify SDS changes from source through export and browser behavior.\
Make every `done` message traceable to observed evidence and remaining gaps.

## Rules

1. Run the lint ratchet first. Inspect any changes to finding counts and use the rule IDs in the report, such as `raw-color`, `no-i18n-text`, and `redefine-sds-base`.
2. Run the token build check and i18n extractor check separately. Confirm `tokens.css` and `themes.css` match `tokens.json` and catalogs cover fragment `data-i18n` and `data-i18n-attr` keys.
3. Run the Node suite and record tests, passes, failures, and skips. Confirm that the relevant checks exercise failure and edge cases as well as the expected path.
4. Export the intended project. Inspect the generated shell, manifest, service worker, offline fallback, version line, and file list. Record the exact project and output directory.
5. In Chrome DevTools, open `/p/dist/index.html` at 390x844 and 1440x900. Check the console and failed requests during normal loading. Check horizontal overflow and keyboard focus at both sizes.
6. At both dimensions, exercise `en`, `zh-Hans`, and `ms` under `light` and `dark`, including `forest-gold` and any other exposed brand. Confirm that `.sds-prefs` changes the page live and updates `data-theme`, `data-brand`, and `lang` on `<html>`. Test `auto` with both system color preferences.
7. Capture and open the screenshots for each tested theme and language combination at both sizes. Inspect them for readability, clipping, overlap, focus visibility, and loaded imagery. Record which screenshots you actually opened.
8. With a controlling service worker, test offline reload and an uncached offline navigation that returns `offline.html`. With an update waiting, check that the version remains stable until the `.sds-toast` update action is clicked.
9. Emulate reduced motion. Check `data-reveal` visibility, suppressed animation, and keyboard focus. With a slow first load, observe `data-loading` clearing and compare content geometry before and after.
10. Label unavailable browser or device checks UNVERIFIED. Keep real iPhone and Safari gesture zoom, installation prompts, safe-area rendering, and service worker behavior UNVERIFIED until tested on the corresponding device and browser.

## Do / Don't

Check focus, accessible names, and localization on a labeled control. Avoid empty test controls.

```html
<!-- Do -->
<button class="sds-btn" data-i18n="enquiry.send">Send enquiry</button>
<!-- Don't -->
<button class="sds-btn"></button>
```

Exercise every reveal preset used by the page. Include the reveal hook on the test card.

```html
<!-- Do -->
<article class="sds-card" data-reveal="rise">…</article>
<!-- Don't -->
<article class="sds-card">…</article>
```

## Patterns

### Measure horizontal overflow

Use the browser console after loading content and after each preference switch.

```js
const root = document.documentElement;
root.scrollWidth > root.clientWidth;
```

### Record a browser matrix cell

```text
Viewport | Theme | Brand | Language | Console/requests | Overflow | Opened screenshot | Result
<size> | <theme> | <brand> | <lang> | <findings> | <result> | <path> | <result>
```

### Report verification in a done message

```text
done
Files <owned paths>
Checks <exact commands and exit results, including test totals>
Browser <preview URL, viewport and matrix cells, screenshot paths opened>
Scenarios <offline, update, reduced motion, loader, and keyboard observations>
UNVERIFIED <missing checks and specific prerequisites>
```

## Self-check

1. Did lint, token sync, catalog sync, tests, and export finish with recorded results?
2. Did both viewports pass the relevant theme and language matrix with a clean normal-load console and network?
3. Did someone open the screenshots and record what they saw?
4. Did offline reload, click-to-update, reduced motion, and loader stability pass in the browser?
5. Does the `done` evidence identify exactly which real-device and browser checks remain UNVERIFIED?

## Tools

Set `projectDir` and `outDir` to the paths under test and run these commands from the repo root in order.

```sh
node swarm/tools/check-sections.js "$projectDir" --baseline
node swarm/design-system/build.js --check
node swarm/tools/i18n-extract.js "$projectDir" --check
node --test swarm/test/*.test.js
node swarm/tools/export-page.js "$projectDir" --out "$outDir"
```

- Run `node swarm/tools/check-sections.js "$projectDir" --json` for machine-readable finding evidence.
- Inspect `/p/dist/index.html` through Chrome DevTools when available. When unavailable, retain CLI and export evidence and record browser and device items as UNVERIFIED.

## Sources

- WCAG 2.2
- Web App Manifest
- Service Workers
- web.dev Core Web Vitals
