# Pomelo STEM website design studies

Twenty self-contained, four-page, trilingual website explorations for the existing Webpage Design Gallery. These previews use illustrative scenarios, do not collect data, and do not replace the official website. The contact route links to the official public contact channels. Content is based on the four service areas shown at https://pomelostem.com/.

## Maintainer workflow

From the repository root with Node 24+ and the repository-supported Python:

1. Edit the design JSON/CSS, localizations, or illustrations in this folder. Each style has one distinct layout and one localized illustrative story.
2. Run `node scripts/pomelo-design-studies/build.mjs demos/corporate/pomelo-stem/v1`.
3. Run `python3 scripts/build_design_system.py` to refresh the checked style token output.
4. Run `node scripts/pomelo-design-studies/check-browser.cjs demos/corporate/pomelo-stem/v1 screens` to capture the actual preview images. Set `POM_CHROME` and `POM_PUPPETEER` for the machine if the defaults are unavailable.
5. Run `python3 scripts/build_gallery.py` and the Gallery checks. Run `node scripts/pomelo-design-studies/check-build.mjs demos/corporate/pomelo-stem/v1` for internal-link and locale coverage.
6. Run the browser script in `audit` mode for desktop and mobile-width checks on every page.

Do not hand-edit generated pages or add them to offline precaching. The publication manifest limits the public output to the intended pages and static assets.
