# Landing style atlas source

[Review all 46 landing pages against their primary mockups on desktop and phone](anchor-audit.md).

The [live atlas](https://yapweijun1996.github.io/Webpage-Design-Gallery/style-atlas/) contains 60 landscape UI references. Each company's source file records the visual style, palette, composition, headline, primary action, three supporting labels and a concrete adaptation for the actual edition. [Goh Joo Hin](gjh/directions.json) · [Yeo Hiap Seng](yeos/directions.json) · [Thow Kwang Pottery Jungle](thow-kwang/directions.json)

The source image in each direction is an existing subject reference from the demo. The finished mockup lives in `style-atlas/images/<company>/<key>.webp`. Generated studies interpret the brief. When a composition needs exact labels or source imagery, a typeset study can use verified project assets. Each company's optional `verified-renders.json` lists those replacement keys. Product details, dates and visitor arrangements belong to the working demo and its official sources.

## Add or revise a direction

1. Find the published edition in the gallery catalogue and choose its principal visitor action. Keep one primary record per edition. Give any alternate its own key and a visibly different composition.
2. Use the record to create a landscape mockup. Keep text legible at full size and retain clear contrast between the subject, heading and action. Verify business details before using any mockup wording on a live page.
3. Write the WebP at the matching key. Compare it with the working page, implement the appropriate changes, then refresh the edition previews with the company browser runner. Keep page screenshots separate from mockup images.
4. With Pillow installed, run `python scripts/render_style_sheets.py` to refresh the three labelled overview images. Run `python scripts/build_gallery.py` to update the Pages index, GitHub image directory and release assets. Run `python scripts/build_gallery.py --check` and the browser checks in the project README. Open an actual demo footer, follow its reference, expand the published preview and return to the demo.

The primary deep link is `style-atlas/index.html#<company>-<version>`. Alternate links use `#<company>-<key>`. The root gallery caches the atlas index and stylesheet with its shell. Full-size mockups load when viewed online.

## Refresh a desktop and phone audit

Capture the same public entry on the baseline and revised build, using a fresh browser profile at 1440 × 900 and 390 × 844. Save the first viewport as `<capture-root>/<company>/<before|after>/<version>-<width>.png`. Record any setup needed to reach a stable first view in the company's audit notes. Inspect both screens against the original primary mockup, including the mobile reading order and the primary action. Keep the baseline images from the original revision when repeating a fix.

Run `python scripts/render_anchor_audit.py <capture-root>` with Pillow installed. It pairs the four browser captures with the original artwork, validates their dimensions and writes the comparison sheets under each company's `audit/` directory. Run the gallery generator after the sheets are in place so the public atlas links to the evidence.
