# GJH V8 — Generations of Goodness

An independent, unofficial corporate landing-page concept. Forest green, champagne gold and warm ivory are proposed design colors, not approved GJH brand tokens. No affiliation or endorsement is implied.

## Open locally

From the repository root, run `python -m http.server 8088 --bind 127.0.0.1` and open `http://localhost:8088/demos/corporate/gjh/v8/index.html`. Python 3.10+ builds the parent gallery with `python scripts/build_gallery.py`. The standalone page has no runtime package dependency, account, API, WebGL resource or CDN requirement.

## Source and assets

- `index.html`, `style.css`, `script.js`: handwritten source.
- `metadata.json`: gallery registration; stable `gjh-v8` ID, `order: 50`.
- `assets/sources.json`: asset provenance, usage boundaries and file hashes.
- `screenshots/1440.png`, `768.png`, `390.png`: real Chrome captures for gallery details and comparison; regenerate after visual changes.
- [Logic and motion](logic.md): scene architecture, state ownership and fallbacks.
- [Verified facts](../../../../docs/gjh-v8-facts.md): official sources and limits.
- [Candidate review](../../../../docs/gjh-v8-review.md): browser/audit evidence and release assessment.

GJH remains the corporate parent. Original New Moon, MILI and GOGO artwork is preserved. New Moon uses the original New Zealand abalone 425g packshot; MILI/GOGO use official brand photographs because verified product models and equivalent packshots were unavailable. The brand universe is 2.5D, not a 3D product simulation. Sony is represented by the official brand tile, not an invented product photograph.

The hero is an AI-created illustration of a fictional family, made with the built-in image generation tool. It does not document a GJH event. The history visual is an official-site composite, not an archival scan. Company dates and market references are attributed to official histories; no distributor/market totals, sustainability claims or product efficacy claims were added. Formal brand/publication approval remains unverified.

## Verification

```sh
python scripts/verify_gjh_asset_library.py
python scripts/build_gallery.py --check
python -m unittest discover -s tests -p test_gallery.py -v
python tests/browser_gjh_v8.py
python tests/browser_gallery.py
```

Browser checks require the existing Python Playwright package, Pillow for thumbnail creation, and locally installed Chrome. Set `GALLERY_CHROME` for an alternate executable. Optional `--axe-script /path/to/axe.min.js` supplies an already-installed audit bundle; no runner installs or downloads dependencies. Run the gallery generator again after captures update screenshot dimensions. Full Lighthouse performance, physical-device and manual assistive-technology results must not be inferred from functional checks.
