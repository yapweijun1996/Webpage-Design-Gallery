# Goh Joo Hin - Portfolio Modern (V6)

An independent, unofficial corporate website concept, not affiliated with or endorsed by Goh Joo Hin Pte Ltd.

## Direction

Modular berry-and-yellow company introduction with a product-aware brand portfolio. The corporate GJH mark, consumer brand marks and official eShop remain distinct. This is an owner-review proposal, not a company-approved brand standard.

## Local preview

From the repository root run `python -m http.server 8000 --bind 127.0.0.1`, then open `http://localhost:8000/demos/corporate/gjh/v6/`. No backend or npm dependency is required. This directory contains its own editable HTML, CSS, JavaScript and assets; changing another concept does not change this one.

## Sources and rights

`assets/sources.json` records original official image URLs, source pages and hashes. Images and marks preserve their original bytes; the user confirmed project-use authorization. Lifestyle subjects are not identified as GJH employees. The small corporate PNG is not a high-resolution master. Manrope is self-hosted with `assets/OFL-Manrope.txt`; Georgia is a concept editorial choice in applicable versions. There are no AI-generated company scenes or regenerated product labels.

See the [brand research](../../../../docs/gjh-newmoon-brand-research.md) and [source library](../../../../assets/companies/gjh/official/README.md). New Moon's 1959 brand origin is distinct from GJH's 1940s business beginnings. Selected regional markets do not imply every product is available in each location.

## Verification

Run `python tests/browser_gjh_demos.py` from the repository root. A reviewed local axe-core bundle can be supplied with `--axe-script /path/to/axe.min.js`. Browser captures are in `screenshots/`; `assets/thumbnail.webp` is derived from the real desktop capture. Rebuild Gallery metadata after recapture with `python scripts/build_gallery.py`.

The [redesign review](../../../../docs/gjh-redesign-review.md) owns the current test matrix and limitations. Automated accessibility checks do not establish full WCAG conformance. Contact and shopping links open the official sites in a new tab; this demo submits no enquiries or orders.
