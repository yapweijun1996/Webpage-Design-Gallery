# GJH v10 — Virtual Stores 3D

Independent, unofficial concept. Not affiliated with or endorsed by Goh Joo Hin Pte Ltd.

## Open

From the repository root, run `python -m http.server 8000` and open `http://localhost:8000/demos/corporate/gjh/v10/`. All runtime scripts, textures and fonts are local; no CDN, bundler, account or runtime network service is used. A disconnected computer can serve the same files locally. Opening `index.html` directly retains the complete HTML list; browsers' native ES-module/file-origin restrictions mean the 3D enhancement requires static HTTP hosting. JavaScript-disabled and unavailable/lost-WebGL views retain all stores and four verified products.

## Experience

One modeled arcade connects three open rooms. Each includes floor, walls, ceiling, shelves, counter and pendant lighting. New Moon presents four verified can packshots as cylindrical solids on shelving, with a repeated New Zealand can on the counter. MILI and GOGO contain official brand-cover panels, seating and architectural planting, not invented merchandise. GOGO adds a timber garden screen; MILI uses lighter paneling. These are source-verified assets, not confirmed current brand-approved packaging. The South Africa display title repairs the upstream manifest's misdecoded en dash; the receipt preserves the original title.

Select an entrance, floor marker, floor-plan button or Prev/Next to travel. Arrow Right/Up and W/D advance; Arrow Left/Down and A/S reverse; Escape returns to the lobby. Drag the canvas to look within bounded angles. No pointer lock. Only the canvas suppresses touch scrolling. Products are selectable by scene raycast or the keyboard-accessible **Products in this store** disclosure below New Moon's scene. The native modal traps focus, closes with Escape and restores its trigger; its sole link is the official eShop home page. There are no prices, stock claims or cart.

## Rendering and provenance

Three.js 0.170.0 is the sole vendored dependency, copied from its npm tarball as one self-contained module plus MIT license. `assets/sources.json` records official source URLs, manifest identities, local SHA-256 values, vendor hashes, font license and SVG-Icon-Studio icon sources. Source rasters are already at most 1000px. `assets/product-models.js` projects the verified front-label crop onto a cylindrical front hemisphere, preserving the photographed can aspect and adding modeled gold lids/rims. Unseen backs remain plain metal rather than invented label artwork. All four verified products are cans; no fictional box packaging is added.

The dusk sky uses a world-space vertical gradient, a static star field, a soft moon and exponential fog. Jade tiles have restrained specular highlights; a patterned runner, brass inlays, planters, benches, lanterns and an open pergola replace the empty forecourt. Repeated architecture is instanced. Desktop quality requires an initial viewport of at least 1000px, four logical processors and at least 4GB reported memory (4GB assumed when the memory API is absent). It adds a single static 1024px PCF-soft key-light shadow map and emissive halo sprites, without postprocessing. Shadows/halos disable below 1000px on resize. Smaller/low-capability devices retain inexpensive contact shadows, floor-light gradients and emissive fixtures.

Rendering stops at idle and while hidden. Trips use an ease-in-out dolly with a restrained two-degree FOV pull; reduced motion cuts instantly, including the FOV. Pixel ratio is capped at 2, or 1.5 below 600px. Portrait architecture narrows while logos, front-facing brand artwork and cans retain their proportions; the lower, aspect-aware camera no longer retreats into a large empty sky. Compact high-contrast scrims sit above the scene, and all navigation occupies a separate footer rather than covering products or doors. `window.__sceneReady`, `window.__sceneFailed` and `window.__sceneStats` expose capture readiness and render diagnostics.

## Verification and captures

```sh
export GALLERY_CHROME="/Applications/Google Chrome.app/Contents/MacOS/Google Chrome"
~/venvs/gallery/bin/python tests/browser_gjh_v10.py --capture
~/venvs/gallery/bin/python scripts/build_gallery.py
~/venvs/gallery/bin/python scripts/build_gallery.py --check
~/venvs/gallery/bin/python -m unittest discover -s tests -p test_gallery.py -v
~/venvs/gallery/bin/python tests/browser_gallery.py
```

The v10 browser check launches Chrome with `--use-angle=swiftshader --enable-unsafe-swiftshader --ignore-gpu-blocklist`, waits for scene readiness, and captures the lobby at 1440×900, 768×1024 and 390×844. All three interiors are also captured at 1440 and 390 into a printed temporary directory, not the repository. It exercises every room by keyboard, four scene product raycasts, DOM product panels/focus restoration, an entrance click, drag look, view switching, 44px DOM targets, overflow, local-only requests, idle rendering, reduced motion, a visibility override, context loss, forced WebGL denial and no-JavaScript/file list browsing. Omit `--capture` to leave committed previews unchanged.

The polish review compared two lobby rounds at all three widths and each interior at desktop/mobile sizes. It corrected sign occlusion, excessive beige flooring/sky, heavy overlays and flat product plaques, then tightened portrait architecture and added room-specific planting. The mobile lobby remains panoramic rather than showing desktop-sized products; entering New Moon provides the useful product inspection view. Real-phone frame rate, screen-reader announcements and Safari remain unverified. Front-only packshot projection is not a complete packaging master. No new icons were needed.

The overlay's worst-case contrast over a white scene is 9.50:1 (ivory), 6.48:1 (muted) and 6.05:1 (gold). A two-core desktop override exercised the cheap rendering path; a normal trip sampled an in-flight FOV pull and returned exactly to its destination FOV at rest.

Final V10 acceptance (`tests/browser_gjh_v10.py --capture`) exited 0: lobby draw calls were 104 at 1440, 90 at 768 and 97 at 390. Both portrait sizes used the cheap tier. Keyboard travel, product raycasts/panels, minimum targets, overflow, idle rendering, reduced motion, visibility pause, context loss, forced WebGL-off and no-JavaScript/file fallback all passed with no console errors or external requests.

The gallery browser check exited 0 in an isolated temporary copy. Required legacy-demo/PWA checks also ran in separate copies so they could not rewrite other demos or unrelated evidence. The legacy check exited 1 on the existing v6 `new-moon-logo.svg` receipt comparison; PWA exited 1 because `#connection-notice` was not visible after the offline reload. Those unrelated failures remain unchanged.
