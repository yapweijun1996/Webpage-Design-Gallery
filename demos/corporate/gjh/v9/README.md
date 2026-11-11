# GJH V9 — Virtual Stores

An independent, unofficial concept for three brand spaces in a layered 2.5D scene. It is not affiliated with or endorsed by Goh Joo Hin Pte Ltd.

## Open locally

From the repository root, run `python3 -m http.server 8088 --bind 127.0.0.1` and open `http://localhost:8088/demos/corporate/gjh/v9/index.html`. The page is static, uses no runtime packages or external requests, and self-hosts the Manrope font.

## Experience and limits

Choose a store entrance or a mini-map button to move between the lobby, New Moon, MILI and GOGO. Arrow keys move between rooms; Escape returns to the lobby. The visual view is an optional enhancement. The store and product list is the baseline without JavaScript and is the default under reduced motion. New Moon shows four official eShop packshots with their sizes and matching front/back/nutrition images where available. MILI and GOGO use official brand artwork and a story panel only because verified product packshots were unavailable. Current packshot editions are not brand-approved. The project adds no invented prices, claims or certifications.

Asset copies are byte-identical to the source files named in `assets/sources.json`; icon IDs and catalog paths are recorded in `assets/icons-sources.json`. Screenshots are real browser captures; regenerate them after visual changes.

## Verification

```sh
python3 scripts/build_gallery.py --check
python3 -m unittest discover -s tests -p test_gallery.py
python3 scripts/verify_gjh_asset_library.py
GALLERY_CHROME="/Applications/Google Chrome.app/Contents/MacOS/Google Chrome" python3 tests/browser_gallery.py
```
