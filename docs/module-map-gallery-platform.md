# Gallery platform module map

Scope: the static gallery platform (generator, design system, runtime JS, service workers, locales, CI) and its tests. The GJH mall (`demos/corporate/gjh/v11`) is covered only where the platform builds or publishes it.

Method: every claim below was read from the named file. Verified by execution on 2026-11-19: `python3 scripts/check_ssot.py` (PASS, 0/1211 legacy declarations), `python3 scripts/build_gallery.py --check` (3 companies, 50 designs, current), and `python3 -m unittest tests.test_design_system tests.test_preferences tests.test_gallery` (39 tests, OK). Browser tests (Playwright plus Chrome) were NOT run; their coverage is taken from file headers and function names. Anything marked NOT VERIFIED was not confirmed.

Legend: G = generated (never hand-edit), A = authored source.

## 1. Data flow

```
A data/{companies,categories,styles}.json
A demos/<category>/<company>/<vN>/{metadata.json,index.html,assets/,screenshots/{1440,768,390}.png}
        |  load_catalog()  (validation, scripts/build_gallery.py)
        v
   catalog = {companies, categories, styles, designs[]}
        |
        +--> build_pages() --> G index.html, companies/**, designs/, compare/, offline.html, data/designs.json
        +--> release_info() --> {version (A data/app.json), build = sha256[:16] of catalog + file bytes}
        +--> pwa_outputs() --> G sw.js, version.json, demos/corporate/gjh/v11/pwa-sw.js,
                                 G demos/<...>/<vN>/{manifest.webmanifest,sw.js}   (build_demo_pwas.outputs)

A design-system/{tokens,themes,icons}.json --build_design_system--> G assets/{tokens.css,gjh-themes.css,icons.svg},
                                                                     G demos/corporate/gjh/v2{0,1,2,3}/assets/theme.css
A locales/source/en.json + zh-Hans.json + ms.json --validate_locales--> G locales/en.json, G demos/.../v11/assets/mall-theme-copy.js
A docs/landing-atlas/<company>/directions.json + style-atlas/{images,sheets} --build_style_atlas--> G style-atlas/{index.html,README.md}
A third_party/rapier/rapier-original.mjs.gz --build_rapier--> G v11/vendor/{rapier.mjs,rapier_bg.wasm}
A 6 source CSS files --build_gjh_css--> G v11/style.bundle.css
A data/gjh-startup-assets.json + v11/assets/*.glb --build_gjh_startup_pack--> G startup-assets.pack, startup-asset-pack.js
A v11 JS modules --build_gjh_startup_js (Bun)--> G script/world/player/character-v2 .bundle.js, G data/gjh-startup-bundles.json
```

Dependency direction: `build_gallery.py` loads every other generator via `importlib.util.spec_from_file_location` (no package imports) and calls their `build(check=...)`. `check_ssot.py` and `build_gallery.release_info` both call `build_design_system.build(check=True)`. `review_landings.py` imports `build_gallery`. `render_anchor_audit.py` and `render_style_sheets.py` import `build_style_atlas`. Nothing in `src/` imports Python output except through generated HTML and JSON.

Order inside `build_gallery.build()`: `validate_locales` -> `build_english_pack` -> `build_mall_theme_copy` -> `rapier.build` -> `gjh_css.build` -> `gjh_pack.build` -> `gjh_js.build` -> `design_system.build` -> `load_catalog` -> `style_atlas.build` -> `release_info` -> `build_pages` + `pwa_outputs` -> write (or compare, in `--check`).

## 2. Module table (quick index)

| Module | Kind | Output | Test coverage |
|---|---|---|---|
| `scripts/build_gallery.py` | generator and validator | pages, `data/designs.json`, `sw.js`, `version.json`, `_site` | `test_gallery.py`, `test_preferences.py`, CI `--check` |
| `scripts/build_demo_pwas.py` | generator | per-demo manifest and `sw.js` | `browser_company_pwas.py` (no unit test) |
| `scripts/build_design_system.py` | generator | tokens, themes, icons | `test_design_system.py` |
| `scripts/check_ssot.py` | ratchet checker | none (exit code) | `test_design_system.py`, CI |
| `scripts/build_style_atlas.py` | generator | `style-atlas/index.html`, `README.md` | `browser_style_atlas.py`, `--check` |
| `scripts/build_gjh_css.py`, `_startup_pack.py`, `_startup_js.py`, `build_rapier.py` | mall build steps | bundles, pack, vendor | `test_gjh_runtime_build.py` (not all functions; see 3.6) |
| `src/preferences-boot.js`, `preferences.js` | runtime | theme and language | `test_preferences.py`, `browser_preferences.py`, `browser_gallery_theme.py` |
| `src/gallery.js` | runtime | search, filters, compare, detail | `browser_gallery.py`, `browser_gallery_layout.py`, `browser_ssot.py` |
| `src/pwa.js`, `templates/gallery/sw.js` | runtime | gallery install and update | `browser_pwa.py`, `browser_pwa_demo_boundary.py` |
| `src/demo-pwa.js`, `templates/gallery/demo-sw.js` | runtime | per-demo install and update | `browser_company_pwas.py` |
| `.github/workflows/{pages,validate}.yml` | CI | Pages deploy, PR gate | n/a |

## 3. Generators (scripts)

### 3.1 `scripts/build_gallery.py` (A; orchestrator)

Purpose: validate the authored catalog, render static HTML from templates, compute the release identity, emit service workers, and optionally publish an allowlisted `_site`.

CLI: `--output DIR` (default repo root), `--check`. Python 3.10+ per AGENTS.md; CI uses 3.13.

| Function | Behavior |
|---|---|
| `read_json` | reads with `utf-8-sig` (BOM tolerant). |
| `local_path(root, value)` | rejects non-string, empty, backslash, URL scheme, leading `/`, any `..`, symlink escape (`resolve()` must be inside root), and missing files. Raises `ValueError`. |
| `load_catalog` | the single validation gate (rules below). Sorts designs by `(companyId, order, id)`. |
| `render(name, **v)` | `string.Template(templates/gallery/<name>.html).substitute`; a missing placeholder raises `KeyError`. |
| `icon(name, prefix)` | allows only ids in `design-system/icons.json`; emits `<use href="{prefix}assets/icons.svg#id">`. |
| `company_card`, `collection_feature`, `design_card` | HTML builders; every dynamic value goes through `escape()` (`html.escape(quote=True)`). Compare checkboxes only when the company has more than one design. |
| `validate_locales(directory)` | see section 6. |
| `build_english_pack`, `build_mall_theme_copy` | write `locales/en.json` and `v11/assets/mall-theme-copy.js`; in `--check` raise if stale. |
| `runtime_resources(catalog)` | the publication allowlist (below). |
| `source_bytes(path)` | for `.html .css .js .json .webmanifest .txt` and `assets/icons.svg`, reads as `utf-8-sig` text and re-encodes, so CRLF checkouts hash the same as Linux. Everything else is raw bytes. |
| `release_info` | calls `design_system.build(ROOT, check=True)` first, then `version` from `data/app.json` (must match `\d+\.\d+\.\d+`) and `build` = first 16 hex of SHA-256 over `json.dumps(catalog, sort_keys=True)` plus, for every input, `path \0 bytes`. Inputs: `runtime_resources`, all `templates/gallery/*`, `scripts/build_gallery.py`, `scripts/build_demo_pwas.py`, `data/app.json`. |
| `build_pages` | companies home (`index.html`, `companies/index.html`), one page per company, `designs/index.html`, `compare/index.html`, `offline.html`, and `data/designs.json`. |
| `pwa_outputs` | gallery `sw.js`, `version.json`, the mall worker, and per-demo outputs. |
| `build` | sequence in section 1. `--check` collects stale pages into one error; the sub-generators raise on the first stale file. |

`load_catalog` invariants (all raise `ValueError`):
- IDs unique for companies, categories, styles, designs; company slugs unique and `[a-z0-9]+(-[a-z0-9]+)*`.
- Company `categories` subset of category ids; `officialWebsite` scheme is `https`.
- `demoDirectory` is a safe existing path; each `*/metadata.json` needs `demoRoute == <dir>/<version>/`, `version == folder name`, `companyId`, `company == legalName`, styles subset of known style ids, integer `order`, and an existing `thumbnail` and `index.html`.
- Each design needs `screenshots/1440.png`, `768.png`, `390.png` with a valid PNG signature; the width and height are read from the IHDR chunk into `designs[].screenshots`.
- `featuredVersion` must exist for its company. Optional `landing`: `image` must resolve to `<version>/assets/<file>` with a `.jpg/.jpeg/.png/.svg/.webp` suffix; `anchor` matches `[a-z0-9-]*`; `alternativeVersion` must be a published design.
- The catalog hard-codes design `status: "concept"` and `devices`; `company.status` is not validated or read here.

`runtime_resources` (Pages allowlist, also the hash input):
- Shell: `assets/{tokens,gjh-themes,gallery,pwa,demo-pwa}.css`, `assets/icons.svg`, gallery icons, `src/*.js` (five files), `locales/{en,zh-Hans,ms}.json`, `data/{companies,categories,styles}.json`, `manifest.webmanifest`.
- Mall: `demos/corporate/gjh/v11/{manifest.webmanifest,offline.html,pwa.js,style.bundle.css,script.bundle.js}`, everything under `assets/onboarding` and `design-system/onboarding`.
- Per company: `shared/*.css|*.js`. Per design: `index.html`, `style.css`, `script.js` if present, every top-level file in `assets/` (the directory must exist, otherwise `iterdir()` raises `FileNotFoundError`), recursive `assets/{brand-kit,brands,gallery-assets,signage,interiors,chibi-crowd,elevator}`, `vendor/*`, and the three screenshots.
- Plus `style_atlas.resources(ROOT)`.
- Anything else under a demo directory is NOT published. `design-system/tokens.json`, research folders and `docs/` are not published (asserted in `test_gallery.py`).

`pwa_outputs` details:
- Gallery `PRECACHE` = rendered pages + allowlist, minus `src/demo-pwa.js`, `assets/demo-pwa.css`, anything under `demos/`, `style-atlas/images|sheets/`, `assets/onboarding/`, `design-system/onboarding/`; plus each thumbnail and company landing image. Each entry is `{path, sha256}`. Placeholders `__BUILD__`, `__VERSION__`, `__PRECACHE__` are replaced in `templates/gallery/sw.js`.
- Mall worker (`demos/corporate/gjh/v11/pwa-sw.js`): eager `PRECACHE` of 11 small files (`offline.html`, manifest, two icons, `style.bundle.css`, loader, mark, signage tokens/manifest/presets/preset-icons); `__LAZY_ASSETS__` = wardrobe manifest plus each `verified` NPC GLB. Each GLB must match `[a-z0-9_-]+\.glb`, and its size and SHA-256 must equal the manifest receipt, else `ValueError`.
- Per-demo workers come from `build_demo_pwas.outputs`.

Failure behavior: any validation error aborts before any page is written (pages are written last). Caveat: the sub-generators run before `load_catalog` and already wrote their outputs.

Tests: `tests/test_gallery.py` (real companies, escaping, path escape, missing assets, duplicate IDs, deterministic `build_pages`, precache boundary, mall worker entries and size cap 256 KiB, nested prefix safety); CI `build_gallery.py --check`.

### 3.2 `scripts/build_demo_pwas.py` (A)

Inputs: catalog, release, `runtime_resources`, `source_bytes`, `templates/gallery/demo-sw.js`. Output: `<demo>/manifest.webmanifest` and `<demo>/sw.js` for every design except `id == "gjh-v11"` (hard-coded skip; the mall has its own worker).
- `DemoTheme` HTMLParser reads `<meta name="theme-color">`; it must match `#rrggbb`, else `ValueError("Missing opaque theme color")`. The color becomes both `theme_color` and `background_color`.
- Manifest: `scope "./"`, `start_url "./index.html"`, `display standalone`, `lang en-SG`, shared gallery icons (192, 512, 512 maskable) via relative paths.
- Cached files per demo: its own directory, company `shared/`, shared UI (`src/demo-pwa.js`, `assets/demo-pwa.css`, `assets/tokens.css`, gallery icons), excluding `thumbnail.webp` and any `screenshots` path. For `yeos` and `thow-kwang`, v1 images and fonts are added; for `gjh`, `assets/gjh-themes.css`.
- Worker placeholders: `__RELEASE__`, `__ASSETS__` (relative path to sha256), `__IDENTITY__` (relative path to root `version.json`).
- Tests: `browser_company_pwas.py` (catalogue identity, real workers, offline pair, release update). No unit test: NOT VERIFIED beyond the browser file's function names.

### 3.3 `scripts/build_design_system.py` and `scripts/check_ssot.py`

`build_design_system.py` (A) reads `design-system/tokens.json` (`primitives`, `semantics`, `aliases`; version `x.y.z`) and writes:
- `assets/tokens.css` (`:root` variables).
- `assets/icons.svg`. Allowed shapes are only `path{d}` and `circle{cx,cy,r}`; each id must also exist in `assets/icons-sources.json` and be unique.
- `assets/gjh-themes.css`, rules scoped `html[data-gjh-design="vN"]` from `themes.json`. Versions v20 to v23 are split to `demos/corporate/gjh/v2N/assets/theme.css` via `DEMO_THEME_OUTPUTS`; the shared file excludes them.

Validation:
- Token names match `[a-z][a-z0-9-]*`, are not duplicated across groups, and values avoid `; { } < >`. References are resolved recursively, and missing or circular ones raise.
- WCAG contrast gate: text, muted text and action on surface and page >= 4.5; on-action on action and hover >= 4.5; control border and focus on surface >= 3; success/warning/error on their surfaces >= 4.5. Both colors must resolve to `#rrggbb`.
- `icons.json`, `themes.json` and `tokens.json` versions must be equal.
- Theme override `condition` must match `@media (max|min-width: Npx)`. A selector may not contain `{}<>;`.

`build(root, check)`: writes, or in `--check` lists stale files and raises. CLI exits 1 with the message.

`check_ssot.py` (A): `check()` returns `(errors, remaining, original)`.
- Runs `design_system.build(check=True)`.
- Rejects any `(min|max)-width` in `assets/*.css` (except the generated two) that is not a registered `breakpoint-*` primitive.
- Debt ratchet over `assets/*.css` and `demos/**/*.css` (excluding `vendor`, generated tokens/themes, `v11/style.bundle.css`, v20-v23 theme outputs). Violations are keyed `path|property|value`: raw color literals (hex, rgb/hsl/lab/lch/oklab/oklch/`color()`, 148 named colors, fallbacks inside `var(--x, red)`), numeric literals in `border-radius`, shadows, `font-size`, `font`, `z-index`, and numeric custom-property primitives (except `--app-chrome-height`, `--gjh-header-size`, `--gjh-safe-*`).
- A violation count above `design-system/legacy-baseline.json` `declarations[key]` is an error. The baseline is currently `{}`, so the ratchet is zero-debt (`originalCount` 1211 is history only).
- Duplicate ownership: the same `.container`, `.header-inner`, `.company-card`, `.design-card`, `.filter-bar`, `.primary-link`, `.device-control` or `.compare-tray` selector defined in more than one `assets/*.css` file is flagged.
- It is a regex ratchet, not a CSS parser or an accessibility audit (its own docstring).
- Tests: `tests/test_design_system.py` (determinism, stale artifacts, new/same-count/fallback/named/modern color debt, shorthand font, custom primitives, ownership incl. comma selectors, circular refs, contrast, unapproved icon, version mismatch, unregistered breakpoint). `browser_ssot.py` is a separate runtime audit.

### 3.4 `scripts/build_style_atlas.py` (A)

Inputs: `docs/landing-atlas/<company>/directions.json` (authored records: `key, version, kind, style, headline, action, image, notes, ...`), optional `verified-renders.json` and `audit/<version>.webp`, `style-atlas/images/<company>/<key>.webp`, `templates/atlas/index.html`. Output: `style-atlas/index.html` and `style-atlas/README.md` (G); `atlas.css`, images and sheets are A.
- Invariants: company and key match the slug regex; the source image resolves inside `demos/` and exists; a published mockup WebP exists; `kind` is `primary` or `alternate`; keys are unique; exactly one `primary` per published version of each company; `verified-renders.json` keys must exist (this switches the label to "Typeset UI study", otherwise "AI-generated UI study").
- Hard-coded live URL `https://yapweijun1996.github.io/Webpage-Design-Gallery/` and the GitHub repo URL in generated output.
- `resources(root)` feeds `runtime_resources`. `render_style_sheets.py` (Pillow) builds the sheets and `render_anchor_audit.py` builds `audit/*.webp` from captures. Both are manual and have no test or CI; NOT VERIFIED beyond reading.
- Tests: `browser_style_atlas.py` (nested Pages URL), `build --check`. The README claim of 64 references matches the count of 64 records in the three `directions.json` files.

### 3.5 Other platform scripts (manual tools; mostly no CI)

| Script | Purpose and notes |
|---|---|
| `review_landings.py` | Compares current screenshots with a Git revision's `data/designs.json` and screenshots; writes a portable HTML via `templates/review/landings.html`. Requires Pillow and git. `--base` and `--output` are required. Widths limited to 390/768/1440. |
| `run_perf_suite.py` | Serves the repo on a random port and runs `docs/mall_lap_probe.py`, `docs/mall_video_probe.py`, `tests/browser_lighting.py` sequentially; writes `summary.json`; exit 1 on any FAIL. Not in CI. |
| `verify_gjh_asset_library.py` | Offline integrity check of `assets/companies/gjh/official/manifest.json` (sha256, bytes, official hosts only, no active SVG content). Uses `assert`, so `python -O` disables it. No test or workflow references it (README mentions it). |
| `sync_gjh_icons.py` | Copies 36 SVGs from an external `SVG-Icon-Studio` checkout into `v11/assets/icons.js`. `--check` needs that checkout; used by `tests/gjh_v11_icons.test.mjs` only when `SVG_ICON_STUDIO_ROOT` is set. NOT in the default CI path. |
| `validate_signage_glb.py`, `build_signage_kit.py` | GLB validator (`main`, `validate_presets`, `collect_manifest`) and Blender 5.x builder for the mall signage kit. `build_signage_kit.py` needs `bpy`. No test or workflow references the validator (grep). NOT VERIFIED (not executed). |
| `build_elevator_kit.py`, `build_elevator_atlas.py`, `build_gjh_carry_hand.py`, `gjh_interior_additions.py`, `scripts/gjh_interiors/` | Blender/Pillow asset builders for the mall; out of platform scope. Not executed. |

### 3.6 Mall build steps invoked by `build_gallery.build()`

| Script | What it enforces |
|---|---|
| `build_rapier.py` | Decompresses `third_party/rapier/rapier-original.mjs.gz`, checks the pinned source SHA-256 and WASM SHA-256, requires exactly one embedded WASM literal, and writes `rapier.mjs` (with `new URL("./rapier_bg.wasm", import.meta.url)`) and `rapier_bg.wasm`. |
| `build_gjh_css.py` | Concatenates 6 source CSS files in fixed order. Refuses any `@import` other than the single onboarding token import, and any `url(` in non-`style.css` sources. |
| `build_gjh_startup_pack.py` | Packs the GLBs named in `data/gjh-startup-assets.json` (sorted, unique, `[A-Za-z0-9_-]+\.glb`) into `startup-assets.pack` (`GJHPACK1` + header length + JSON header + bytes, max 10 MiB) and renders `startup-asset-pack.js` from `templates/gallery/gjh-v11-startup-asset-pack.js`. |
| `build_gjh_startup_js.py` | `current()` compares SHA-256 of 4 entries, outputs, the builder itself and Bun version `1.3.11` against `data/gjh-startup-bundles.json`. If current it does nothing, so a clean checkout needs Python only. If stale: `--check` raises; otherwise it needs Bun 1.3.11 on PATH and rewrites bundles and manifest. The Bun path was NOT executed in this review. |

Tests: `tests/test_gjh_runtime_build.py` has four tests (startup pack content, prebuilt JS needs no Bun, Rapier pinned and detects change, CSS bundle current and rejects stale). Bundle regeneration with Bun is not covered by a test.

## 4. Runtime JavaScript (`src/`, all A)

### 4.1 `src/preferences-boot.js` (classic script, runs before CSS)

Reads `localStorage['wdg.theme']`, falls back to `system`, validates against `light|dark|system`, and sets `<html data-theme-choice>` and `data-theme`. A storage exception is swallowed (session-only). Test: `browser_preferences.py`, `browser_gallery_theme.py`.

### 4.2 `src/preferences.js` (module)

| Item | Detail |
|---|---|
| Storage keys | `wdg.theme` (`system|light|dark`), `wdg.language` (`en|zh-Hans|ms`). Wrapped in try/catch; failure shows "Preferences apply to this tab. Storage is unavailable." |
| Events fired | `window` `wdg:languagechange` (consumed by `gallery.js`). Listens to `storage` events for cross-tab sync, and `prefers-color-scheme` changes. |
| Fetch | `locales/{en,zh-Hans,ms}.json`, 5 s abort timeout each. A pack is valid only if `messages` and `patterns` are plain objects with string values (`mallTheme` is not checked at runtime). A failed pack becomes `null`. |
| Translation | English source text is the key. `translate()` tries an exact `messages` match on whitespace-normalized text, else the `patterns` (longest static text first, `{name}` becomes `(.+?)`; digit captures are localized with `Intl.NumberFormat`). Results cache, cleared above 2000 entries. |
| DOM | `render()` walks text nodes (skipping `script, style, noscript, textarea, [translate="no"]`) and attributes `aria-label, title, alt, placeholder`. A `WeakMap` keeps the original English so repeated switching never translates a translation. A `MutationObserver` re-renders on DOM changes. |
| Failure | Missing `en` pack falls back to an identity pack, so English markup still works. A missing chosen language falls back to `en` with the message "Language unavailable. English is shown...". |
| Exports | `formatNumber`, `formatDate`, `formatCurrency` (locales `en-SG`, `zh-Hans-SG`, `ms-MY`). |
| Also | Sets `meta[name=theme-color]` from the computed `.site-header` background. Sets `data-preferences-ready="true"` when initialised (a test hook). |

Tests: `test_preferences.py` (packs complete; every piece of generated copy is translatable; invalid packs fail), `browser_preferences.py`.

### 4.3 `src/gallery.js` (module; dispatches by `main[data-page]`)

| Page | Function | Behavior |
|---|---|---|
| all | `initSettings` | The `.gallery-settings` details is open on wide screens and collapsed at or below `--breakpoint-medium` (read from CSS token). Escape and outside click close it; focus is restored. Opens/closes on `wdg:updateavailable`. |
| companies | `initCompanies` | Search, category filter and sort (`name`/`designs`), 12 per page, URL state `q, category, sort, page` (`history.replaceState`, `pushState` for pagination, `popstate` restore). Re-runs on `wdg:languagechange`. |
| company | `initCompany` | Up to two selected designs; URL state `left, right, style, sort`; sets the Compare link `compare/index.html?company=..&left=..&right=..`. Does nothing for a single-design company. |
| design | `initDesign` | Fetches `data/companies.json` and `data/designs.json`; needs `?company=&design=`; shows the screenshot for the device (initial device from breakpoints); unknown ids render `errorState`. |
| compare | `initCompare` | Two iframes (live) or screenshots; devices 1440x900, 768x1024, 390x844; synchronized scroll (try/catch for cross-origin); fullscreen; rewrites links inside the iframe (`target=_top` for the collection, `_blank noopener` for external). Needs two different designs from one company. |

Dynamic HTML is escaped with a local `escape()`. Tests: `browser_gallery.py`, `browser_gallery_layout.py`, `browser_ssot.py`, `browser_premium_landings.py` (named, not read).

### 4.4 `src/pwa.js` (gallery install and update UI)

- Reads `<meta name="app-version">` and `app-build` (stamped by `build_pages`).
- Registers `sw.js` at scope of the app root with `updateViaCache: 'none'`, only in secure contexts.
- Messages to the worker: `GET_VERSION` (3 s timeout, reply `{version, build}` through a `MessageChannel`), `SKIP_WAITING`. Message from the worker: `CHECK_FOR_UPDATE`.
- Checks run: at start, `visibilitychange` (throttled to 10 min), `online`, a 10-minute timer, and manually. The final fallback fetches `version.json?check=<ts>` with `cache: 'no-store'`; a differing build with no waiting worker is reported as "publishing".
- Applying requires a verified waiting worker with the same build as the target; it is refused while `.compare-tray.has-selection` exists. There is a 20 s activation timeout; the page reloads on `controllerchange` after `GET_VERSION` confirms the new build.
- Event `wdg:updateavailable` is dispatched; `beforeinstallprompt`/`appinstalled` manage `#install-app`. A broken screenshot image offline is replaced with a placeholder message.
- Test: `browser_pwa.py` (real two-release lifecycle), `browser_pwa_demo_boundary.py`.

### 4.5 `src/demo-pwa.js` (per-demo widget, injected by demos)

- Skipped inside iframes, so compare previews do not register workers. Requires a secure context and Service Worker support.
- Scope derives from the demo's `<link rel="manifest">`; registers `./sw.js`. Only treats a worker whose `scriptURL` equals `<scope>sw.js` as its own.
- Adds an "Install / offline" panel and an "Update available" button; `GET_VERSION` 3.5 s timeout; `SKIP_WAITING` apply with a 15 s timeout; passive re-check after 10 min hidden.
- No `localStorage` use. Test: `browser_company_pwas.py`.

## 5. Service worker templates (`templates/gallery/`, A; outputs G)

| Template | Output | Behavior |
|---|---|---|
| `sw.js` | `/sw.js` | Cache `wdg:<base path>:shell:<BUILD>`. `install` fetches `version.json?v=BUILD` (`cache: reload`) and requires build and version to equal the embedded ones. It then fetches every precache entry with `?v=BUILD`, rejects non-OK or redirected responses, and verifies SHA-256 before `cache.put`. Any failure deletes that cache and rethrows (the old release stays intact). `activate` deletes only older caches with the same prefix; no `clients.claim`. `fetch` serves precached paths from the cache (503 text if missing). For requests from clients under `demos/`, non-navigation requests go to the network (`no-cache`) so an old shell never mixes with a new demo. Other navigations go to the network; offline redirects to `offline.html`; a 404 posts `CHECK_FOR_UPDATE`. Messages: `GET_VERSION`, `SKIP_WAITING`. |
| `demo-sw.js` | `<demo>/sw.js` | Cache `wdg:demo:<path>:<build>`. Installs in batches of 6 with SHA-256 checks against the `__ASSETS__` map (`credentials: omit`); any failure deletes the cache. Serves canonical (search and hash stripped) files from the cache; offline navigations in scope redirect to `index.html`. |
| `gjh-v11-sw.js` | `v11/pwa-sw.js` | Cache `gjh-v11:<path>:offline:<BUILD>`, identity from the repo-root `version.json`. Precache is small (see 3.1). Navigation falls back to the cached `offline.html`. Wardrobe GLBs in `__LAZY_ASSETS__` are fetched with a verified SHA-256 on first use and cached (storage failure is ignored). `activate` calls `clients.claim()` within its narrower scope. |
| `gjh-v11-startup-asset-pack.js` | `v11/assets/startup-asset-pack.js` | Loads `startup-assets.pack` (4 s abort, 10 MiB cap) and exposes the packed models; each consumer re-checks hashes (per the template header comment). Body beyond line 15 NOT read in full. |
| `base.html`, `home.html`, `company.html`, `collection-controls.html`, `design.html`, `compare.html`, `offline.html` | pages | `string.Template` placeholders (`$title`, `${prefix}`, `$content`, `$design_cards`, ...). `base.html` carries a CSP meta: `default-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline'; img-src 'self' data:; frame-src 'self'; worker-src 'self'; object-src 'none'; form-action 'none'` and others. |

Release identity: `version.json` (G) = `{version, build}`. The build changes when any hashed input changes, so a changed template or runtime file produces a new worker and a visible update.

## 6. Data schemas and locales (A unless noted)

| File | Shape (observed) | Validated by |
|---|---|---|
| `data/app.json` | `{version: "1.4.0"}` | `release_info` regex |
| `data/companies.json` | array of 3: `id, slug, name, legalName, initials, industry, categories[], location, description, demoDirectory, featuredVersion, status, officialWebsite, landing{image,action,anchor,alternativeVersion,alternativeAction}` | `load_catalog` (3.1); `status` unchecked |
| `data/categories.json` | 4: `id, slug, name, parentId` | uniqueness; `parentId` unchecked |
| `data/styles.json` | 5: `id, slug, name` | uniqueness; referenced by `metadata.json.styles` |
| `data/designs.json` (G) | 50 records: `id, companyId, slug, version, title, description, styles, status, order, demoPath, thumbnail, screenshots{device:{path,width,height}}, devices, disclaimer` | regenerated; `--check` compares |
| `data/gjh-startup-assets.json` | sorted string list of GLB names (19) | `build_gjh_startup_pack` |
| `data/gjh-startup-bundles.json` (G) | Bun bundle receipts | `build_gjh_startup_js.current` |
| `data/gjh-interior-additions.json` | `schema_version, note, assets[]` (mall; builder `scripts/gjh_interior_additions.py`) | NOT VERIFIED |
| `design-system/tokens.json` | `version, primitives, semantics, aliases` | `read_tokens` |
| `design-system/themes.json` | `version, themes{vN:{tokens,overrides[]}}`, 20 themes | `render_themes` |
| `design-system/icons.json` | `version, provenance, icons[6]` | `render_icons`; each id also in `assets/icons-sources.json` |
| `design-system/legacy-baseline.json` | `declarations: {}` (zero-debt) | `check_ssot` |
| `demos/**/metadata.json` | per design: `id, companyId, company, version, displayTitle, summary, styles[], order, demoRoute, thumbnail, disclaimer` (also `title, industry, designStyle, officialWebsite`, not read) | `load_catalog` |

Locales:
- Authoring: `locales/source/en.json` (the key source), `locales/zh-Hans.json`, `locales/ms.json`; each has `messages` (283), `patterns` (46) and `mallTheme` (10). `locales/en.json` (G) is the runtime English pack: `messages` minus identity entries, plus `patterns` and `mallTheme`.
- `validate_locales`: each pack's three maps must be non-empty string maps with exactly the same key set as the English source, and `{name}` placeholders must match between key and value (sorted). It raises `ValueError` otherwise, before any output is written.
- `mall-theme-copy.js` (G) is `export const MALL_THEME_COPY = {en, zh-Hans, ms}` from `mallTheme`.
- Cross-module: the mall reads the same key `wdg.language` (`demos/corporate/gjh/v11/assets/mall-language.js`) and listens to `storage` events.

## 7. CI (`.github/workflows`)

| Workflow | Trigger | Steps |
|---|---|---|
| `pages.yml` | push to `main`, manual | checkout, configure Pages, Python 3.13; `python scripts/check_ssot.py`; `python scripts/build_gallery.py --check`; `python scripts/build_gallery.py --output _site`; upload `_site`; deploy. No unit or browser tests. |
| `validate.yml` | pull_request, manual | `check_ssot.py`, `build_gallery.py --check`, `python -m unittest discover -s tests -p 'test_*.py' -v`, `node --test tests/gjh_*.test.mjs`. No Playwright browser tests. |

## 8. Tests that cover the platform

| Test | Type | Needs | Covers |
|---|---|---|---|
| `tests/test_gallery.py` (15 tests) | unit | Python only | catalog validation, rendering, publication and precache boundary |
| `tests/test_design_system.py` (21 tests) | unit | Python only | tokens, icons, themes, SSOT ratchet |
| `tests/test_preferences.py` (3 tests) | unit | Python only | locale packs and copy coverage |
| `tests/test_gjh_runtime_build.py` | unit | Python only | mall build steps |
| `tests/browser_gallery.py` | Playwright | Chrome (`GALLERY_CHROME`) | built artifact at a Pages-style prefix; landing review |
| `browser_gallery_layout.py`, `browser_gallery_theme.py` | Playwright | Chrome | compact layout, settings, theme isolation |
| `browser_pwa.py`, `browser_pwa_demo_boundary.py` | Playwright | Chrome | worker lifecycle, update, demo boundary |
| `browser_company_pwas.py` | Playwright | Chrome | per-demo manifests and workers |
| `browser_preferences.py` | Playwright | Chrome | persistence, offline language packs |
| `browser_ssot.py` | Playwright | Chrome and axe script | a11y, layout and lab performance over the gallery and GJH routes |
| `browser_style_atlas.py` | Playwright | Chrome | atlas at a nested URL |

## 9. Known gaps and doc drift

1. **Version drift.** `data/app.json` is `1.4.0`. `ds.md` line 3 still says "Application release: 1.1.4" and its verification block is for 1.1.0. README mixes 1.1.0 / 1.1.3 / 1.1.49 / 1.4.0 as history, so the current version is stated only by `data/app.json`.
2. **`--output` is not isolated.** `build(output=...)` still writes `locales/en.json`, `mall-theme-copy.js`, Rapier vendor files, the mall CSS and startup pack, design-system CSS/SVG and `style-atlas/*` into the repo root, not into `output`. `test_gallery.py` and several browser tests call `gallery.build(tmp)` and therefore touch the working tree (it stayed clean in this run because the outputs are deterministic). README presents `--output _site` as plain staging.
3. **`--check` mixes error styles.** Stale pages are listed together; each sub-generator raises on its first stale file, so a run can need several iterations.
4. **Missing `assets/` crashes.** A design without `assets/` raises `FileNotFoundError` in `runtime_resources`, not a validation message, even though README says each demo needs one.
5. **Allowlist silently drops files.** Any demo file outside the `runtime_resources` patterns (for example a nested folder not in the kit list) is neither published nor hashed, with no warning.
6. **Release hash scope.** README says the build ID derives from "runtime sources, templates, catalog and demo assets". Actually not hashed directly: `templates/atlas`, `templates/review`, `scripts/build_design_system.py`, `locales/source/en.json`, `design-system/*.json` (only their generated outputs are hashed).
7. **Unvalidated fields.** `company.status`, `category.parentId`, and most metadata extras (`designStyle`, `industry`, `title`, `officialWebsite`) are neither validated nor consumed; design `status` is hard-coded to `"concept"`.
8. **Hard-coded identities.** `build_demo_pwas.py` skips `gjh-v11` by id; `build_style_atlas.py` hard-codes `yapweijun1996.github.io` URLs; the `yeos`/`thow-kwang` v1 asset sharing and the `gjh` theme inclusion are hard-coded by company id.
9. **Test-run inconsistencies.** `AGENTS.md` runs only `test_gallery.py`, while CI and README run `test_*.py` (which includes mall and probe tests). `browser_gallery.py` defaults to a Windows Chrome path, other browser tests default to macOS paths or require `GALLERY_CHROME`. `AGENTS.md` lists three browser tests; README lists many more (`browser_ssot.py`, `browser_style_atlas.py`, `browser_company_pwas.py`).
10. **CI gaps.** No workflow runs any Playwright test. `pages.yml` runs no unit tests. `verify_gjh_asset_library.py`, `validate_signage_glb.py`, `run_perf_suite.py`, `render_*` and `review_landings.py` have no test and no workflow. `sync_gjh_icons.py --check` depends on an external checkout and is skipped unless an environment variable is set.
11. **Bun path untested.** Regenerating the bundles needs Bun 1.3.11 and is not exercised by `test_gjh_runtime_build.py`; only the "current, no Bun needed" case is.
12. **Runtime-only validation.** `preferences.js` does not validate `mallTheme`; only the build does. `verify_gjh_asset_library.py` uses `assert` and is bypassed under `python -O`.
13. **Icon registry size.** README describes `design-system/icons.json` as the icon registry; it holds only 6 icons, used by gallery chrome. The mall uses a separate registry (`sync_gjh_icons.py`, 36 icons).
14. **Not verified in this pass.** Playwright suites (not run); `docs/pwa-preferences.md`, `docs/pwa-review.md` and `ds.md` claims beyond the version line; `build_gjh_startup_js` with Bun; Blender and Pillow builders; the full body of `gjh-v11-startup-asset-pack.js`; `assets/gallery.css`, `assets/pwa.css`; `data/gjh-interior-additions.json` and its builder.
