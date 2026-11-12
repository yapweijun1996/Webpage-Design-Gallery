# Webpage Design Gallery

A company-first design exploration platform. Browse companies, enter a company collection, explore design directions, and open an independent live demo. This checkout contains **one company and eight designs**. All concepts are unofficial and do not imply company endorsement.

The [Design System SSOT](ds.md) owns shared gallery design and UX contracts, the prioritized UI audit, cross-project reuse boundaries and acceptance criteria. Its version 1.0.0 tracks the executable token/icon registry, gallery adoption and remaining verification. Run `python scripts/check_ssot.py` to check generated artifacts and prevent new design-system debt.

Application **1.1.0** introduced the compact gallery layouts, responsive previews, shareable discovery state, accessible comparison controls and shared GJH interaction/theme foundations. The design-system contract remains **1.0.0**; application and DS versions are independent.

See the [1.1.0 release review](docs/ssot-release-review.md) for the actual verification scope. The static gate reports zero remaining declarations in its measured raw-style categories; this does not mean every layout dimension is tokenized. Physical-device testing, screen-reader sessions and field performance remain separate from the local browser evidence.

## Browse

- `/index.html`: company discovery with search, category filtering, sorting and pagination.
- `/companies/index.html`: the complete company directory.
- `/companies/gjh/index.html`: GJH's design collection, style filters and two-design comparison selection.
- `/designs/index.html?company=gjh&design=v6`: design details and captured desktop/tablet/mobile screenshots.
- `/compare/index.html?company=gjh&left=v5&right=v7`: two live previews or screenshots, device widths, optional relative scroll synchronization, and fullscreen preview where supported.
- Existing `demos/corporate/gjh/v1/`, `v5/`, `v6/`, `v7/`, `v8/` and `v9/` URLs are preserved; `v10/` adds a real 3D store arcade and `v11/` adds a freely walkable virtual mall.

## Local development

Python 3.10+ is required for the static generator. No npm packages, backend, database or account system are required.

```sh
python scripts/build_gallery.py
python -m http.server 8000
```

Open `http://localhost:8000/`. The generated company and demo links work without JavaScript; search, filters, design details and comparison need JavaScript and an HTTP server. Do not edit generated HTML directly.

## Add a company or design

1. Add a company to `data/companies.json` with a stable `id`, unique `slug`, category IDs, official website and demo directory. Keep IDs stable when renaming a company.
2. Add independent demos under that company's demo directory. Each version needs `index.html`, `style.css`, `script.js`, `assets/`, screenshots at `1440.png`, `768.png` and `390.png`, and `metadata.json` following an existing version's contract.
3. Give each design a stable unique `id`, matching `companyId`, `displayTitle`, `summary`, `styles` and explicit numeric `order`. Version labels do not determine sorting; gaps between versions are allowed.
4. Run the generator. It reads demo metadata, validates paths and references, creates static gallery pages and emits `data/designs.json`. Commit those generated outputs with their sources.

`data/categories.json` and `data/styles.json` define the filter vocabularies. Company categories and design styles are arrays. Gallery templates live in `templates/gallery/`; shared presentation and behavior live in `assets/gallery.css` and `src/gallery.js`. `data/designs.json` is generated, not a second authoring source.

## Verification

```sh
python scripts/build_design_system.py --check
python scripts/check_ssot.py
python scripts/build_gallery.py --check
python -m unittest discover -s tests -p 'test_*.py' -v
python tests/browser_gallery.py
python tests/browser_gjh_demos.py
python tests/browser_gjh_v9.py
python tests/browser_gjh_v10.py
python tests/browser_gjh_v11.py
python tests/browser_gjh_furnishings.py
python -m unittest discover -s tests -p test_gjh_character.py -v
python tests/browser_gjh_character.py
python tests/browser_pwa.py
```

Browser checks use the locally installed Playwright Python package and Chrome. Set `GALLERY_CHROME` if Chrome is elsewhere. The Gallery and PWA suites build into temporary directories and verify a GitHub Pages-style path prefix. The GJH check captures updated device screenshots and thumbnails; run the gallery generator again afterward. Add `--axe-script /path/to/axe.min.js` to run an already-reviewed local axe-core 4.10.3 bundle. See [gallery evidence](docs/gallery-v2-review.md) and the [GJH redesign review](docs/gjh-redesign-review.md) for coverage and limitations.

Run `python tests/browser_ssot.py --axe-script /path/to/axe.min.js` for the generated Gallery and all eight GJH routes at desktop, tablet and mobile widths. It uses an already-reviewed local axe-core bundle, records runtime errors and overflow, and writes [SSOT browser evidence](docs/evidence/ssot-browser.json). Its LCP/CLS values are local laboratory observations, not field Core Web Vitals or INP measurements. See [GJH shared interaction review](docs/gjh-ssot-review.md) for theme boundaries and remaining device limitations.

Canonical shared values live in `design-system/tokens.json`, icons in `design-system/icons.json`, and per-version GJH themes in `design-system/themes.json`. `scripts/build_design_system.py` generates their CSS/SVG artifacts. Edit these registries rather than generated `assets/tokens.css`, `assets/icons.svg` or `assets/gjh-themes.css`; local demo styles retain their independent compositions.

## PWA and updates

The Gallery is a standalone PWA with project-scoped caching. Its header shows the application version/build and **Check updates**. New releases download automatically during visible-tab checks; **Update to v…** activates the verified waiting worker only when clicked, displays an updating dialog, then reloads the same URL. Other open tabs require their own reload consent. Checks run on startup, on returning to a visible tab (throttled to ten minutes), on reconnect and manually.

`data/app.json` owns the semantic version. The generator derives a changing build ID from runtime sources, templates, catalog and demo assets; it emits `version.json` and `sw.js`. Edit `templates/gallery/sw.js`, not the generated worker. Every precached file is SHA-256 checked before a candidate release can install. Failed/mixed CDN releases leave the current cache intact.

After the first successful installation, company browsing, search, filters, collections and thumbnails work offline. Independent live demos, full screenshots and official external sites require a connection; an explicit fallback explains this. The Gallery has light system chrome, safe-area CSS, a smart scrolling header and a contextual back-to-top action. Physical iOS and native installation dialogs remain unverified. See [PWA verification](docs/pwa-review.md).

## GitHub Pages

Pages uses the **Deploy demo to GitHub Pages** workflow, triggered automatically by pushes to `main` or manually through `workflow_dispatch`. Pushing a verified commit to `main` therefore initiates deployment. The workflow generates `_site` from metadata, includes only gallery resources and known demo runtime assets/screenshots, and excludes research downloads and project documentation. Local staging uses `python scripts/build_gallery.py --output _site`.

## Assets and research

The V1/V5/V6/V7 GJH concepts use original corporate/brand marks and official-site photographs, with project use authorized by the user. Invented company lettering and obsolete AI scenes were removed. Each demo retains independent runtime files, exact original image copies, a self-hosted OFL-licensed Manrope font and `assets/sources.json` receipts. Its HTML/CSS/JavaScript are handwritten authoring sources; only the surrounding Gallery HTML/data index and captured previews are generated.

The curated [GJH / New Moon source-verified library](assets/companies/gjh/official/README.md) contains 26 originals with page-context receipts, timestamps and hashes. Selected unaltered copies are published inside the demos; the full library, reports and bulk research downloads are excluded from the Pages artifact. See the [Brand Research Report](docs/gjh-newmoon-brand-research.md), [redesign review](docs/gjh-redesign-review.md) and [asset plan](docs/gjh-newmoon-asset-plan.md). Validate the recorded library capture with `python scripts/verify_gjh_asset_library.py`. Current packaging masters and a formal brand manual remain unavailable; no endorsement is implied.

## GJH V8 candidate

[Generations of Goodness](demos/corporate/gjh/v8/README.md) adds a forest-green/gold/ivory immersive direction with seven scenes, a disclosed AI-created family illustration, verified brand artwork, 2.5D layers and an accessible schematic network. The existing four versions and deployment configuration are preserved. See the [V8 logic and motion contract](demos/corporate/gjh/v8/logic.md) and [local candidate review](docs/gjh-v8-review.md) for evidence, limits and release status.

## GJH V10 — Virtual Stores 3D

[Virtual Stores 3D](demos/corporate/gjh/v10/README.md) connects three real, low-poly rooms through a warm evening arcade. The self-contained local Three.js ES module is the only vendored dependency; the gallery generator includes demo `vendor/` files in the static publication artifact. Waypoint travel, bounded drag look and verified product raycasts have keyboard-accessible DOM alternatives. The complete HTML store list survives JavaScript/WebGL failure. Run `python tests/browser_gjh_v10.py --capture` to refresh only v10's lobby screenshots and thumbnail; interior review captures stay in a temporary directory. Physical-phone frame rate is unverified.


## GJH V11 — Virtual Mall

[Virtual Mall](demos/corporate/gjh/v11/README.md) adds free third-person walking and running through one continuous mall, using a local authored visitor and Rapier kinematic capsule physics. Automatic glass doors connect three real-scale stores; verified products and brand panels open accessible inspection dialogs. The complete HTML directory survives JavaScript, WebGL and WASM failure. The existing PWA policy excludes heavy live-demo dependencies from precaching. Run `python tests/browser_gjh_v11.py` for SwiftShader walking, collision, touch, inspection and fallback checks.

Original Blender-authored lounge benches and areca-inspired planters are reused from the owner's [Blender-3D-Gallery collection PR](https://github.com/yapweijun1996/Blender-3D-Gallery/pull/4). Editable sources stay upstream; local GLBs are pinned by commit and SHA-256, loaded once and instanced across the mall. Per-asset procedural fallback preserves the scene on load failure. See [furniture source and verification](docs/gjh-furnishings-review.md); `python tests/browser_gjh_furnishings.py` covers responsive loading, instance reuse and independent failure recovery.

### Reference-led visitor (application 1.1.2)

Application **1.1.2** replaces the legacy shopper rendering with an original, locally vendored green-polo mascot `gjh-mall-visitor.glb`. Editable geometry and the reproducible authoring script belong to `Blender-3D-Gallery/models/gjh-mall-visitor/`; [character receipts](demos/corporate/gjh/v11/assets/character-sources.json) pin source `1a091b18e29b34ca468baf506968e1e65d815005` and the accepted export SHA-256 (upstream PR #5 merged). The original Kenney model and its license remain preserved as legacy assets, without serving as an automatic fallback.

`assets/character.js` owns the native-scale PBR model and authored `idle`, `walk` and `sprint` clips. `assets/player.js` retains movement, physics and camera behavior. A failed character load uses the existing accessible directory fallback. The GLB remains outside the PWA installation cache. See [character acceptance and verification](docs/gjh-character-review.md) for the current evidence status; revision 3 measures 369,976 bytes and 10,356 triangles, and the full V11 suite passed at all three widths. A bounded presentation interval bridges isolated contact corrections without changing physics; [the canonical review](docs/gjh-character-review.md) records source, browser, release and deployment evidence.
