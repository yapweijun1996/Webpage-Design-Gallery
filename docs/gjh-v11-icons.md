# GJH v11 icons

The v11 UI uses inline SVGs from SVG-Icon-Studio's `icons/catalog/`. The generated `demos/corporate/gjh/v11/assets/icons.js` exports `registry`, whose values preserve the catalog SVG bytes (including line endings and the final newline), and `icon(name, {size, label})`, which creates an SVG element. Unknown IDs throw. Unlabelled icons are decorative and hidden from assistive technology; pass a meaningful `label` only when the icon itself needs an accessible name. Label icon-only controls on the control, rather than relying on an unexplained picture. SVGs use `currentColor` and do not require a font or an image request.

## Updating from Studio

Make the source changes in SVG-Icon-Studio first. Add any newly used IDs to `ICON_IDS` in `scripts/sync_gjh_icons.py`, then regenerate from the desired Studio checkout:

```sh
python3 scripts/sync_gjh_icons.py --studio-root /path/to/SVG-Icon-Studio
python3 scripts/sync_gjh_icons.py --studio-root /path/to/SVG-Icon-Studio --check
```

The default checkout is `~/Documents/GitHub/SVG-Icon-Studio`. Do not hand-edit the generated registry or generated bundles. Run the gallery build as appropriate for the release after updating source files.

The Node regression test checks the v11 source and registry without requiring an external checkout. To additionally compare every registry value byte-for-byte against its catalog SVG and check for generated drift, supply an explicit checkout:

```sh
SVG_ICON_STUDIO_ROOT=/path/to/SVG-Icon-Studio node --test tests/gjh_v11_icons.test.mjs
```

Without `SVG_ICON_STUDIO_ROOT`, the catalog comparison is skipped; a configured but missing or mismatched checkout fails. The source check excludes generated bundles and vendor files, and permits ordinary punctuation, translated copy and mathematical signs.

## Pre-migration audit

| Surface | Previous technique |
| --- | --- |
| Header map, bag and view switch | Text labels; map disclosure used a hand-drawn inline SVG |
| Guide, help, theme and cart | Text controls; onboarding used hand-drawn SVG paths and glyph close buttons |
| Inspect, Run, Sit, Open, Pick Up and Travel | Context-dependent text buttons; joystick was a CSS-drawn movement control |
| Interaction-point marker | CSS-drawn box and circular pointer |
| Map close and product, shelf, bag, theme and object dialogs | Text controls; onboarding/object dialog close used a glyph |
| Directory and product links, tin viewer orbit/zoom | Unicode arrow and mathematical glyphs |
| Install, check and apply update | Text buttons |
| Ceiling wayfinding | Unicode arrows painted into a canvas texture |
| Floorplan | Inline SVG data visualization, retained as non-icon artwork |
| Product and brand images, PWA app images | Content images or application identity, not UI icons |

The camera is controlled by dragging the scene, not a separate camera button. Directional wayfinding now uses words; the joystick remains an interactive movement surface rather than an icon.

## Offline scope

The v11 service worker precaches the offline fallback page, manifest and app PNGs, not the live application assets. It does not promise an offline 3D UI; the inline icon module does not need separate precaching under that policy. Keep the fallback usable independently of the live icon module.
