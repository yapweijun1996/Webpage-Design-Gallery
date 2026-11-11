# GJH v10 — Virtual Stores 3D

Independent, unofficial concept. Not affiliated with or endorsed by Goh Joo Hin Pte Ltd.

## Open

From the repository root, run `python -m http.server 8000` and open `http://localhost:8000/demos/corporate/gjh/v10/`. All runtime scripts, textures and fonts are local; no CDN, bundler, account or runtime network service is used. A disconnected computer can serve the same files locally. Opening `index.html` directly retains the complete HTML list; browsers' native ES-module/file-origin restrictions mean the 3D enhancement requires static HTTP hosting. JavaScript-disabled and unavailable/lost-WebGL views retain all stores and four verified products.

## Experience

One modeled arcade connects three open rooms. New Moon is a warm provision shop with four verified can packshots on shelving and a repeated New Zealand can on its low counter. Its side-wall brand cover has a brass frame. MILI is a bright cream gathering room; GOGO is a green garden room with a timber screen and additional planting. Both have a gold-framed official cover, a low official-logo plinth, a rug and side shelving containing only plants, books and vases—not invented merchandise. Amber, cream and green-tinted room lights give each a restrained signature. Source-verified assets are not confirmed current brand-approved packaging. The South Africa display title repairs the upstream manifest's misdecoded en dash; the receipt preserves the original title.

Select an entrance, floor marker, floor-plan button or Prev/Next to travel. Arrow Right/Up and W/D advance; Arrow Left/Down and A/S reverse; Escape returns to the lobby. Drag the canvas to look within bounded angles, with time-based damping. Desktop mouse movement adds restrained parallax. No pointer lock. Only the canvas suppresses touch scrolling. Double-sided artwork and reverse entrance signs retain brand presence from oblique views; the introductory eyebrow changes to the room name indoors. Products are selectable by scene raycast or keyboard-accessible **Products in this store** buttons. Hover/focus adds a warm local rim light and a fine gold selection ring. The modal explicitly cycles Tab/Shift+Tab between close and its sole official-eShop-home link, closes with Escape and restores its trigger. There are no prices, stock claims or cart.

## Rendering and provenance

Three.js 0.170.0 is the sole vendored dependency, copied from its npm tarball as one self-contained module plus MIT license. `assets/sources.json` records official source URLs, manifest identities, local SHA-256 values, vendor hashes, font license and SVG-Icon-Studio icon sources. Source rasters are already at most 1000px. `assets/product-models.js` projects the verified front-label crop onto a cylindrical front hemisphere, preserving the photographed can aspect and adding modeled gold lids/rims. Unseen backs remain plain metal rather than invented label artwork. All four verified products are cans; no fictional box packaging is added.

The dusk sky uses a world-space vertical gradient, a static star field, a soft moon and exponential fog. Jade tiles have restrained specular highlights; a patterned runner, brass inlays, planters, benches, lanterns and an open pergola form the forecourt. Layered cornices, gold-trimmed pilasters and warm sconces articulate the edges. Repeated architecture is instanced. Instanced architecture receives but does not cast the key shadow, avoiding the former hard centre-floor band; cheap radial contact shadows and additive pendant pools provide falloff above the rugs. Desktop quality requires an initial viewport of at least 1000px, four logical processors and at least 4GB reported memory (4GB assumed when absent). It adds one static 1024px PCF-soft key-light shadow map and emissive halo sprites, without postprocessing. Shadows/halos disable below 1000px on resize.

The lobby has a gentle angular breathing drift, disabled with reduced motion, while hidden, in list view and while its product dialog is open. Rooms stop rendering when travel/drag/parallax settles. Trips use an ease-in-out dolly with a restrained two-degree FOV pull; reduced motion cuts instantly, including the FOV, and disables parallax. Pixel ratio is capped at 2, or 1.5 below 600px. Portrait lobby architecture is narrower with a lower, closer 45-degree camera; rooms widen again for product inspection. Logos, covers and cans retain their proportions. Entrance signs hang in front of the masonry rather than clipping into it. Compact high-contrast scrims sit above the scene, and navigation occupies a separate compact footer. `window.__sceneReady`, `window.__sceneFailed` and `window.__sceneStats` expose capture readiness, draw calls, quality, motion and product-highlight diagnostics.

## Verification and captures

```sh
export GALLERY_CHROME="/Applications/Google Chrome.app/Contents/MacOS/Google Chrome"
~/venvs/gallery/bin/python tests/browser_gjh_v10.py --capture
~/venvs/gallery/bin/python scripts/build_gallery.py
~/venvs/gallery/bin/python scripts/build_gallery.py --check
~/venvs/gallery/bin/python -m unittest discover -s tests -p test_gallery.py -v
~/venvs/gallery/bin/python tests/browser_gallery.py
```

The v10 browser check launches Chrome with `--use-angle=swiftshader --enable-unsafe-swiftshader --ignore-gpu-blocklist`, waits for scene readiness, and captures the lobby at 1440×900, 768×1024 and 390×844 only with `--capture`. All three interiors and an open product panel are captured at every width into a printed temporary directory. It exercises keyboard room travel, four scene product raycasts, DOM focus highlights, modal focus cycling/Escape/restoration, an entrance click, damped drag, view switching, 44px DOM targets, overflow, local-only requests, lobby breathing/visibility pause, room idle rendering, reduced motion, context loss, forced WebGL denial and no-JavaScript/file browsing. Omit `--capture` to leave committed previews unchanged.

The second polish compared the baseline with two complete visual iterations: lobby, each store and the New Zealand product panel at all three requested viewports. Round one enlarged the portrait entrances and cleared the room foregrounds; round two moved signs clear of masonry, refined proportional framing, added side sconces and restored pendant pools above rugs. The compact portrait lobby now gives the arches and signs more vertical presence without losing the carpet approach. Physical-phone frame rate, screen-reader announcements and Safari remain unverified. Low-poly planting and front-only can projection remain deliberate visual limitations.

The overlay's worst-case contrast over a white scene is 9.50:1 (ivory), 6.48:1 (muted) and 6.05:1 (gold). A two-core desktop override exercised the cheap rendering path; a normal trip sampled an in-flight FOV pull and returned exactly to its destination FOV at rest.

Final second-polish acceptance (`tests/browser_gjh_v10.py --capture`) exited 0 with 124/99/106 lobby draw calls at 1440/768/390, below the 150-call ceiling. Both portrait sizes used the cheap tier; device scale factor 3 exercised DPR caps of 2/2/1.5. Keyboard travel, four product raycasts, pointer/focus highlights, modal focus cycling/Escape/restoration, 44px targets, overflow, motion/visibility rules and all fallback paths passed with no console errors or external requests. `build_gallery.py`, `--check`, all eight `test_gallery.py` unit cases and `browser_gallery.py` also exited 0; the gallery browser harness redirected only its unrelated screenshot output to a temporary directory.

Historical baseline checks (not rerun in this V10-only polish) recorded an existing legacy-demo failure on the v6 `new-moon-logo.svg` receipt comparison and a PWA failure because `#connection-notice` was not visible after an offline reload. Those unrelated failures remain outside this change.
