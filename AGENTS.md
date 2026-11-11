# Repository Guidelines

## Structure

The Python generator in `scripts/build_gallery.py` builds the static gallery from `data/`, `templates/gallery/`, `assets/`, `src/` and demo metadata under `demos/`. Gallery pages, `data/designs.json`, `version.json` and `sw.js` are generated outputs. Never hand-edit generated files; change their sources and run the generator.

## Development

Use Python 3.10+; no npm dependencies are required. Keep demo HTML, CSS, JavaScript and assets with each demo. Write code, identifiers, comments and documentation in English.

## Verification

Run the commands listed in README.md:

```sh
python scripts/build_gallery.py --check
python -m unittest discover -s tests -p test_gallery.py -v
python tests/browser_gallery.py
python tests/browser_gjh_demos.py
python tests/browser_pwa.py
```