# SDS tool kit

Run Node commands from the repository root. Replace angle-bracketed values
with the project path, output path, or input for your check. Brackets mark
optional flags. Each tool ID below matches its name in the staff roster.

## build-tokens

`node swarm/design-system/build.js [--check]`

- **Use** after changing `tokens.json`. Before handoff, use `--check` to verify the generated files without writing them.
- **Output** is `tokens.css`, `themes.css`, and `TOKENS.md` in `swarm/design-system/`, or a synchronization result in check mode.
- **Failure** means token data is invalid, a reference cannot resolve, or checked output is missing or stale. Read the diagnostic and fix the input or regenerate.

## check-sections

`node swarm/tools/check-sections.js <projectDir> [--baseline|--ssot|--json]`

- **Use** while editing fragments. Use `--baseline` for the ratchet, `--ssot` for token and catalog sync checks, and `--json` for machine-readable findings.
- **Output** lists findings by rule and location. Baseline mode compares counts against the recorded project limits.
- **Failure** means a rule or baseline limit was breached, a requested sync check failed, or the project could not be read. Fix the source identified by the finding.

## i18n-extract

`node swarm/tools/i18n-extract.js <projectDir> [--write|--check]`

- **Use** after changing a translation key or its inline English text. Use `--write` to regenerate the English catalog and `--check` to verify catalogs.
- **Output** lists extracted keys, missing translations, and visible text without translation keys. Write mode updates the English catalog.
- **Failure** means the input could not be read, duplicate keys disagree, or check mode found stale English text or missing translation keys.

## export-page

`node swarm/tools/export-page.js <projectDir> [--out <dir>]`

- **Use** when the fragments are ready for assembled-page or PWA review. The default output is `<projectDir>/dist`.
- **Output** is the assembled `index.html`, manifest, service worker, offline page, icons, assets, CSS, scripts, catalogs, and version record. Read any reported unresolved references.
- **Failure** means the fragments or shell could not be exported. Check the input, output path, and reported assembly errors before preview.

## staff-check

`node swarm/lib/staff.js --check [--strict]`

- **Use** after changing the roster, tool kit, skill packs, or playbooks. Use `--strict` when checking a complete delivery.
- **Output** is the validation result and any missing handbook or playbook warnings during parallel work.
- **Failure** means the roster is unreadable or invalid, a tool or skill reference is unknown, or a required handbook or playbook file is missing in strict mode.

## test-runner

`node --test swarm/test/*.test.js`

- **Use** before handing off a change or combining worker changes.
- **Output** lists subtests and totals for passed, failed, and skipped tests.
- **Failure** means a test failed or could not load. Start with the first failing assertion or missing input.

## contrast

`node swarm/tools/contrast.js <fg> <bg>`

- **Use** to check a resolved foreground and background pair, for example `node swarm/tools/contrast.js '#777' '#fff'`. Accepts 3-, 6-, and 8-digit hex with an optional `#`.
- **Output** gives the ratio to two decimals and PASS or FAIL for AA and AAA, for normal and large text. Ratings use the unrounded ratio.
- **Failure** in a rating means the pair is below that threshold. A nonzero exit means the input or argument count is invalid. Eight-digit inputs use CSS alpha with the foreground over the background and a translucent background over white.

## live-preview

`/studio.html?preview=1`

- **Use** on the active Swarm server. For example, run `node swarm/tools/shot.js 'http://127.0.0.1:8800/studio.html?preview=1#01-hero' 393 844 /tmp/swarm-hero.png` to capture a section at phone width. Add `theme`, `brand` and `lang` query parameters to match the owner's appearance choices when using a fresh Chrome profile.
- **Output** is the current project rendered by the same sandboxed preview as Studio. For export-specific checks such as PWA installation and updates, export the project and test the generated bundle separately.
- **Failure** can mean the server is inactive, it is serving a different project, a section is unavailable, or a resource path is broken.

## browser-inspection

`navigate_page({pageId: <pageId>, url: "<previewUrl>"})`

- **Use** when optional Chrome DevTools tools are available. Get the tab's numeric ID from `list_pages({})` and open the preview, or start a tab with `new_page({url: "<previewUrl>"})`. Inspect the tab with `take_snapshot({pageId: <pageId>})`, `list_console_messages({pageId: <pageId>})`, and `list_network_requests({pageId: <pageId>})`.
- **Output** includes the rendered page structure, console messages, and network requests. Check responsive layout, keyboard access, and preference changes in the preview.
- **Failure** can mean the preview is unreachable, a script raised an error, or a resource request failed. Record the route, viewport, and relevant message.

## When a tool is unavailable

Run the available static checks and inspect the affected source or export. Record
the unavailable command and the behavior that remains unverified in the handoff.
If Chrome DevTools is absent and a browser can open the live preview, use the
browser's native developer tools. Leave device-dependent checks for a reviewer
with the required environment.
