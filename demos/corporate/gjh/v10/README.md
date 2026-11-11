# GJH v10 — Virtual Stores 3D

Independent, unofficial concept. Not affiliated with or endorsed by Goh Joo Hin Pte Ltd.

## Open

From the repository root, run `python -m http.server 8000` and open `http://localhost:8000/demos/corporate/gjh/v10/`. All runtime scripts, textures and fonts are local; no CDN, bundler, account or runtime network service is used. A disconnected computer can serve the same files locally. Opening `index.html` directly retains the complete HTML list; browsers' native ES-module/file-origin restrictions mean the 3D enhancement requires static HTTP hosting. JavaScript-disabled and unavailable/lost-WebGL views retain all stores and four verified products.

## Experience

One modeled arcade connects three open rooms. Each includes floor, walls, ceiling, shelves, counter and pendant lighting. New Moon presents the four verified front packshots at their original aspect ratios. MILI and GOGO contain official brand-cover panels and seating, not invented merchandise. These are source-verified assets, not confirmed current brand-approved packaging. The South Africa display title repairs the upstream manifest's misdecoded en dash; the receipt preserves the original title.

Select an entrance, floor marker, floor-plan button or Prev/Next to travel. Arrow Right/Up and W/D advance; Arrow Left/Down and A/S reverse; Escape returns to the lobby. Drag the canvas to look within bounded angles. No pointer lock. Only the canvas suppresses touch scrolling. Products are selectable by scene raycast or the keyboard-accessible **Products in this store** disclosure below New Moon's scene. The native modal traps focus, closes with Escape and restores its trigger; its sole link is the official eShop home page. There are no prices, stock claims or cart.

## Rendering and provenance

Three.js 0.170.0 is the sole vendored dependency, copied from its npm tarball as one self-contained module plus MIT license. `assets/sources.json` records official source URLs, manifest identities, local SHA-256 values, vendor hashes, font license and SVG-Icon-Studio icon sources. Source rasters are already at most 1000px, so no downscaled derivatives are necessary. The only procedural texture is an authored 128px radial contact-shadow gradient. Geometry and material instances batch repeated architecture. Three warm point lights, hemisphere/directional lighting, fog, contact shadows and one static 512px shadow map require no postprocessing.

Rendering stops at idle and while hidden; reduced motion uses instant waypoint cuts and no ambient animation. Pixel ratio is capped at 2, or 1.5 below 600px. SwiftShader verification measured 62 lobby draw calls at all three captured sizes, not physical-phone frame rate. `window.__sceneReady`, `window.__sceneFailed` and `window.__sceneStats` expose capture readiness and render diagnostics.

## Verification and captures

```sh
export GALLERY_CHROME="/Applications/Google Chrome.app/Contents/MacOS/Google Chrome"
~/venvs/gallery/bin/python tests/browser_gjh_v10.py --capture
~/venvs/gallery/bin/python scripts/build_gallery.py
~/venvs/gallery/bin/python scripts/build_gallery.py --check
~/venvs/gallery/bin/python -m unittest discover -s tests -p test_gallery.py -v
~/venvs/gallery/bin/python tests/browser_gallery.py
```

The v10 browser check launches Chrome with `--use-angle=swiftshader --enable-unsafe-swiftshader --ignore-gpu-blocklist`, waits for scene readiness, and captures the lobby at 1440×900, 768×1024 and 390×844. Interior captures go to a printed temporary directory, not the repository. It exercises every room by keyboard, four scene product raycasts, DOM product panels/focus restoration, an entrance click, drag look, view switching, 44px DOM targets, overflow, local-only requests, idle rendering, reduced motion, a visibility override, context loss, forced WebGL denial and no-JavaScript/file list browsing. Omit `--capture` to leave committed previews unchanged.

Two visual refinement rounds addressed initial striped flooring, obstructed products, excessive interior heading overlays and weak shadow depth; portrait cameras were then widened for the final captures. The mobile overview remains deliberately smaller than an entered room. Physical-phone 60fps, screen-reader announcements and Safari are unverified. The small static shadow map is intentionally softer/less precise than a photorealistic renderer. No missing icons.

Final checks: gallery generation and `--check` exited 0; all eight gallery unit tests passed; `browser_gallery.py` and `browser_gjh_v10.py --capture` exited 0. The gallery, legacy-demo and PWA browser scripts ran from an isolated temporary copy to avoid rewriting other demos or unrelated evidence. The legacy-demo script exited 1 on the existing v6 `new-moon-logo.svg` receipt comparison. The PWA script exited 1 because `#connection-notice` was not visible after its offline reload; full PWA verification is therefore incomplete. Those unrelated surfaces were not changed.
