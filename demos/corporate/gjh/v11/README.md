# GJH v11 — Virtual Mall

Independent, unofficial concept. Not affiliated with or endorsed by Goh Joo Hin Pte Ltd.

## Open and explore

Serve the repository with `~/venvs/gallery/bin/python -m http.server 8000`, then open `/demos/corporate/gjh/v11/`. Everything is local: no runtime CDN, external font, analytics or network service. Official eShop links navigate only on user activation.

WASD or arrow keys walk freely; Shift runs. Drag the scene to orbit the collision-constrained spring-arm camera. On touch devices, the left joystick walks, right-side dragging turns the camera, and Run toggles pace. Two fingers can walk and turn simultaneously. Only the canvas uses `touch-action:none`; the joystick is a visual overlay whose touches reach the canvas. Page zoom remains enabled. The help card is collapsible. The map's three keyboard-accessible buttons teleport to storefronts, not interiors.

Approach a verified can display or MILI/GOGO brand panel, then press E or tap Inspect. The native modal traps focus, pauses controls, restores focus and closes with Escape. Its only link is the official eShop home page. No prices, inventory, invented products or commerce flow are present. List view contains all three stores and four complete verified packshots, including when JavaScript, WebGL or WebAssembly is unavailable. Opening the HTML as a local file retains that directory; browser module security requires HTTP for 3D.

## World and implementation

One continuous, metre-scale interior connects a skylit atrium and three real-scale rooms. Jade tiles and brass inlay surround a water court with a moon-ring sculpture. Planters, benches, wall sconces, pendant lights, wayfinding and a three-step terrace furnish the concourse. Each storefront has two physical, automatically sliding glass leaves. New Moon holds the four verified canned products on shelves, using the same front-label cylindrical projection as v10; unseen backs remain plain metal. MILI is a cream gathering room; GOGO is a green, timber-screened garden room. Their original cover artwork is not fictional merchandise.

`script.js` owns initialization and the 60Hz fixed physics timestep. `assets/world.js` owns instanced architecture, static collisions and doors; `products.js` owns shared wrapped-can geometry; `player.js` owns the capsule, Rapier kinematic character controller, gravity, auto-step, animation state machine, smooth turning, spring arm and desktop/two-finger input; `ui.js` owns accessible view state and inspection.

Kenney **Mini Characters 2.0 / character-male-a**, **CC0-1.0**, supplies the humanlike shopper. Idle, walk and sprint clips are retained from the official pack; sprint drives the run state. Other clips and unused buffer data were removed, and the unchanged 512px texture was embedded. Actual Three.js review established +Z facing; the visual rotates by PI for -Z locomotion. This is not RobotExpressive or a hand-built placeholder. The detailed acquisition receipt, source/model hashes and pack licence text are in `assets/sources.json` and `shopper-LICENSE.txt`; the receipt distinguishes source CRLF and published LF licence hashes.

Three.js and its local GLTFLoader/BufferGeometryUtils are pinned to 0.170.0 (MIT). Rapier compat 0.21.0 (Apache-2.0) is one local ES module with embedded WASM. Official image/font receipts are preserved from v10; no official library or older demo was changed. No functional icons are used; the inline SVG is a data-visualization floorplan, not a catalog icon.

Textures are at most 1024px. Repeated architecture and cans use instancing/shared resources. DPR is capped at 2, or 1.5 below 600px. Only capable desktop configurations enable one 1024px soft-shadow map. Rendering and simulation stop while the tab is hidden; modal/list views pause movement and rendering. Reduced motion has no camera bob, sway or idle drift, and cuts doors instantly. UI copy uses opaque or near-opaque green scrims and visible keyboard focus.

The generator already publishes direct-child `vendor/` and `assets/` files. The uncompressed vendor payload is approximately 5.19MB; all other runtime assets together are approximately 1.14MB. Its existing PWA policy excludes live demos from precaching, caching only the mall thumbnail with gallery browsing resources. The embedded WASM therefore does not inflate offline installation; a locally served complete checkout works without internet, while the gallery's existing offline fallback applies to uncached live demos.

## Review and hooks

`window.__mall` is frozen and read-only: `ready`, a snapshot `state`, `teleport(zone)`, `setInput({forward,right,run,yaw,pitch})`, and `step(ms)`. Teleport accepts `atrium`, `newmoon`, `mili`, `gogo`. Input values are bounded. Supplying input enters deterministic manual stepping; `setInput(null)` restores live input. Steps are bounded to ten seconds and cannot advance paused/hidden controls. `window.__sceneReady` marks the first completed render; initialization failure sets `window.__sceneFailed`.

The visual review captured spawn, walking, each interior and all panels at 1440×900, 768×1024 and 390×844, across multiple complete rounds. It corrected avatar facing/scale composition, fountain alignment, harsh floor stripes, camera elevation, contact grounding, and HUD/prompt overlap. Review images remain under `/tmp/gjh-v11-visual`; only three final spawn screenshots and the thumbnail are published. The deliberately stylized shopper and front-only can labels remain weaker than photorealistic character/packaging assets.

## Verification

```sh
export GALLERY_CHROME="/Applications/Google Chrome.app/Contents/MacOS/Google Chrome"
~/venvs/gallery/bin/python scripts/build_gallery.py
~/venvs/gallery/bin/python scripts/build_gallery.py --check
~/venvs/gallery/bin/python -m unittest discover -s tests -p test_gallery.py -v
~/venvs/gallery/bin/python tests/browser_gallery.py
~/venvs/gallery/bin/python tests/browser_gjh_v11.py
```

The mall browser check uses SwiftShader and tests the published artifact, actual keyboard walking, deterministic walk/run/idle transitions, outer-wall collision/no tunnelling, storefront teleports and doors, E/Escape inspection, modal focus/pause, camera drag, two-finger touch, run toggle, list switching, target sizes/overflow, reduced motion, hidden-tab pause, context loss, WebGL/WASM failures and no-JavaScript browsing. `--capture` refreshes only v11 previews; regenerate the gallery afterward. Physical-phone frame rate, Safari and screen-reader behavior remain unverified.

Required side-effecting legacy checks ran in isolated temporary copies, leaving all other demos unchanged. `tests/browser_gallery.py` exited 0. `tests/browser_gjh_demos.py` exited 0 (28 cases, four no-JavaScript journeys and source integrity). `tests/browser_pwa.py` exited 1 at its existing `#connection-notice` offline visibility assertion (line 138); the same issue is documented in v10's review. No PWA behavior was changed.

Final acceptance: generator build and `--check` exited 0; all eight gallery unit tests exited 0; `tests/browser_gjh_v11.py` exited 0. Initial draw calls were 92 / 77 / 64 at 1440 / 768 / 390. All walking, collision, door, inspection, touch, reduced-motion, visibility, fallback, target-size and overflow assertions passed with no console errors or external requests.
