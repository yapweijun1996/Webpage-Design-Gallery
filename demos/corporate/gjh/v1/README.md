# Goh Joo Hin - Corporate Clarity (V1)

An independent, unofficial corporate website concept, not affiliated with or endorsed by Goh Joo Hin Pte Ltd.

## Direction

Warm white surfaces (`#FAF9F6` / `#FFFFFF`), a sage-tinted business discovery entry (`#EFF2E8` / `#214337`), deep berry primary actions (`#A20C3B`), and a high-contrast plum-berry contact panel (`#3A1426`). The division finder leads directly into Food, Electronics, and Health & Nutrition while keeping the corporate GJH mark, consumer brand marks, and official eShop distinct. See the [v1 design system & component reference](../../../../docs/gjh-v1-design-system.md).

## Independent Source Generation & Localization

`demos/corporate/gjh/v1/locales/` holds the scoped edition data (`shared.json`), language catalogs (`en.json`, `zh-Hans.json`, `ms.json`), and terminology [glossary](locales/glossary.md). Run `python scripts/build_gjh_v1.py` (or `python scripts/build_gallery.py`) to validate catalogs and emit static HTML routes:

- `demos/corporate/gjh/v1/index.html` (`en` — approved default)
- `demos/corporate/gjh/v1/zh-Hans/index.html` (`zh-Hans` — draft pending fluent review, gated on EN)
- `demos/corporate/gjh/v1/ms/index.html` (`ms` — draft pending fluent review, gated on EN)

All three routes share one `manifest.webmanifest` identity and one generated `sw.js` cache. Draft routes carry `noindex` and a visible review banner and remain gated from public switcher links on the English entry until fluent review updates `reviewStatus` to `"approved"`.

## Local preview

From the repository root run `python -m http.server 8000 --bind 127.0.0.1`, then open `http://localhost:8000/demos/corporate/gjh/v1/`. No backend or npm dependency is required. Edit `locales/`, `style.css`, `script.js`, or `design-system/themes.json`, then rebuild via the repository generators rather than hand-editing generated HTML, theme CSS, or worker outputs.

## Sources and rights

`assets/sources.json` records unaltered copies of source-verified official images, hashes, and responsive display derivatives (`480`, `768`, `1200`, `1920` WebP and `480`, `768`, `1200` JPEG derived from the authorized `family-lifestyle.jpg`). Original official image bytes remain unchanged; the user confirmed project-use authorization. Lifestyle subjects are not identified as GJH employees. Manrope is self-hosted with `assets/OFL-Manrope.txt`; Simplified Chinese uses a system CJK stack for immediate first paint.

See the [brand research](../../../../docs/gjh-newmoon-brand-research.md) and [source library](../../../../assets/companies/gjh/official/README.md). New Moon's 1959 brand origin is distinct from GJH's 1940s business beginnings. Selected regional markets do not imply every product is available in each location.

## Verification

Run `python scripts/build_design_system.py --check`, `python scripts/check_ssot.py`, `python scripts/build_gallery.py --check`, `python -m unittest discover -s tests -p 'test_*.py' -v`, `python tests/browser_gjh_demos.py`, `python tests/browser_gjh_v1_improvement.py`, `python tests/browser_company_pwas.py`, and `python tests/browser_gallery.py`. Contact and shopping links open the official sites in a new tab; this demo submits no enquiries or orders.
