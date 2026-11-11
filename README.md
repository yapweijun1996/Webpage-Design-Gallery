# Webpage Design Gallery

A company-first design exploration platform. Browse companies, enter a company collection, explore design directions, and open an independent live demo. This checkout contains **one company and five designs**. All concepts are unofficial and do not imply company endorsement.

## Browse

- `/index.html`: company discovery with search, category filtering, sorting and pagination.
- `/companies/index.html`: the complete company directory.
- `/companies/gjh/index.html`: GJH's design collection, style filters and two-design comparison selection.
- `/designs/index.html?company=gjh&design=v6`: design details and captured desktop/tablet/mobile screenshots.
- `/compare/index.html?company=gjh&left=v5&right=v7`: two live previews or screenshots, device widths, optional relative scroll synchronization, and fullscreen preview where supported.
- Existing `demos/corporate/gjh/v1/`, `v5/`, `v6/`, `v7/` and `v8/` URLs are preserved.

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
python scripts/build_gallery.py --check
python -m unittest discover -s tests -p test_gallery.py -v
python tests/browser_gallery.py
python tests/browser_gjh_demos.py
python tests/browser_pwa.py
```

Browser checks use the locally installed Playwright Python package and Chrome. Set `GALLERY_CHROME` if Chrome is elsewhere. Both build into temporary directories and verify a GitHub Pages-style path prefix. The GJH check captures updated device screenshots and thumbnails; run the gallery generator again afterward. Add `--axe-script /path/to/axe.min.js` to run an already-reviewed local axe-core 4.10.3 bundle. See [gallery evidence](docs/gallery-v2-review.md) and the [GJH redesign review](docs/gjh-redesign-review.md) for coverage and limitations.

## PWA and updates

The Gallery is a standalone PWA with project-scoped caching. Its header shows the application version/build and **Check updates**. New releases download automatically during visible-tab checks; **Update to v…** activates the verified waiting worker only when clicked, displays an updating dialog, then reloads the same URL. Other open tabs require their own reload consent. Checks run on startup, on returning to a visible tab (throttled to ten minutes), on reconnect and manually.

`data/app.json` owns the semantic version. The generator derives a changing build ID from runtime sources, templates, catalog and demo assets; it emits `version.json` and `sw.js`. Edit `templates/gallery/sw.js`, not the generated worker. Every precached file is SHA-256 checked before a candidate release can install. Failed/mixed CDN releases leave the current cache intact.

After the first successful installation, company browsing, search, filters, collections and thumbnails work offline. Independent live demos, full screenshots and official external sites require a connection; an explicit fallback explains this. The Gallery has light system chrome, safe-area CSS, a smart scrolling header and a contextual back-to-top action. Physical iOS and native installation dialogs remain unverified. See [PWA verification](docs/pwa-review.md).

## GitHub Pages

Pages uses the manually triggered **Deploy demo to GitHub Pages** workflow. After pushing a verified commit, run it on `main`. The workflow generates `_site` from metadata, includes only gallery resources and known demo runtime assets/screenshots, and excludes research downloads and project documentation. Local staging uses `python scripts/build_gallery.py --output _site`.

## Assets and research

The V1/V5/V6/V7 GJH concepts use original corporate/brand marks and official-site photographs, with project use authorized by the user. Invented company lettering and obsolete AI scenes were removed. Each demo retains independent runtime files, exact original image copies, a self-hosted OFL-licensed Manrope font and `assets/sources.json` receipts. Its HTML/CSS/JavaScript are handwritten authoring sources; only the surrounding Gallery HTML/data index and captured previews are generated.

The curated [GJH / New Moon source-verified library](assets/companies/gjh/official/README.md) contains 26 originals with page-context receipts, timestamps and hashes. Selected unaltered copies are published inside the demos; the full library, reports and bulk research downloads are excluded from the Pages artifact. See the [Brand Research Report](docs/gjh-newmoon-brand-research.md), [redesign review](docs/gjh-redesign-review.md) and [asset plan](docs/gjh-newmoon-asset-plan.md). Validate the recorded library capture with `python scripts/verify_gjh_asset_library.py`. Current packaging masters and a formal brand manual remain unavailable; no endorsement is implied.

## GJH V8 candidate

[Generations of Goodness](demos/corporate/gjh/v8/README.md) adds a forest-green/gold/ivory immersive direction with seven scenes, a disclosed AI-created family illustration, verified brand artwork, 2.5D layers and an accessible schematic network. The existing four versions and deployment configuration are preserved. See the [V8 logic and motion contract](demos/corporate/gjh/v8/logic.md) and [local candidate review](docs/gjh-v8-review.md) for evidence, limits and release status.
