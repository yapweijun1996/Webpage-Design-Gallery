# Swarm Design System

SDS provides shared tokens, components, preferences, localization and a PWA export shell for pages assembled from Swarm section fragments. Use the [binding interface spec](SDS_SPEC.md) for names and APIs and the [standard](STANDARD.md) for acceptance rules.

## File map

| Path | Purpose |
| --- | --- |
| `tokens.json`, `build.js` | Editable token source and generator |
| `tokens.css`, `themes.css`, `TOKENS.md` | Generated tokens, theme and brand overrides, and token reference |
| `components.css`, `components.html` | Shared component styles and a page for inspecting states |
| `boot.js`, `runtime.js` | Pre-paint preferences and shared `window.SDS` behavior |
| `i18n.js`, `i18n/*.json` | Localization runtime and English, Simplified Chinese and Malay catalogs |
| `shell/` | HTML, manifest and service worker templates, offline fallback and icons |
| `ssot-baseline.json` | Per-project lint ratchet counts |
| `../tools/` | Section checks, catalog extraction and page export |
| `../test/` | Swarm and SDS contract tests |

## Author a section

1. Read the project brief, assigned lane, direction and decisions. Edit only your assigned fragment, stylesheet and notes.
2. Use one section root and scope local styles under its `.s-NN` class. Keep fragments script-free.
3. Use `.sds-*` components and `var(--sds-*)` tokens. Keep raw colors, type sizes, durations and easings out of section styles.
4. Keep English text inline and add a lowercase, dot-separated `data-i18n` key. Use `data-i18n-attr` for translated attributes. Put translated text on a text-bearing element so translation preserves child controls or icons.
5. Mark optional reveal targets with `data-reveal="fade"`, `"rise"` or `"scale"`. Use the shared runtime for theme, brand, language, loader and service worker behavior.
6. Run the checks, review the assembled section at mobile width, communicate handoffs in the channel and post the verified result.

## Commands

Run these from the repository root with Node 23. Replace `<projectDir>` with the Swarm project directory.

```sh
node swarm/design-system/build.js
node swarm/design-system/build.js --check
node swarm/tools/check-sections.js <projectDir> --baseline
node swarm/tools/check-sections.js <projectDir> --ssot
node swarm/tools/i18n-extract.js <projectDir> --check
node swarm/tools/i18n-extract.js <projectDir> --write
node swarm/tools/export-page.js <projectDir>
node --test swarm/test/sds-standard.test.js
node --test swarm/test/*.test.js
```

Use `--brand forest-gold` to select that brand for export or `--no-pwa` for a single-file export. Use the [acceptance checklist](STANDARD.md#acceptance-checklist-for-a-finished-page) to review the exported page.
