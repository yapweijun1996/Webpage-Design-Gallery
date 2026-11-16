# GJH v11 — Virtual Mall

Independent, unofficial concept. Not affiliated with or endorsed by Goh Joo Hin Pte Ltd.

## Open and explore

The accessible directory contains a separate **Original demo tin — not New Moon packaging** viewer. It lazy-loads the byte-pinned original generic tin, preserves native metre scale, and supports drag/keyboard orbit, zoom, reset and mutually exclusive illustrative OpenClose/Exploded clips. The native dialog is keyboard-contained, restores focus, pauses the mall, and releases resources on close. Missing or invalid assets show a readable fallback; no branded product image, text, eShop link or world geometry is replaced.

The original GLB is 186,016 bytes, SHA-256 `4b265f78a711d95a80b730ebeaae3906f42c93fbd28f0b8c6e64c8c003eee0ee`. Geometry and DEMO artwork were created for the owner's project; owner-project public demo use is authorized, not a new general third-party license. The accompanying provenance and DejaVu font license are retained. This independent demonstration does **not** complete the planned four-SKU New Moon Phase 3 viewer. See [the review](../../../../docs/original-tin-viewer-review.md).

Serve the repository with `~/venvs/gallery/bin/python -m http.server 8000`, then open `/demos/corporate/gjh/v11/`. Everything is local: no runtime CDN, external font, analytics or network service. Official eShop links navigate only on user activation.

WASD or arrow keys walk freely; Shift runs. Hold Q/E to turn left/right, including while moving; opposite turn keys cancel. Turning alone does not translate the player. Drag the scene to orbit the collision-constrained spring-arm camera. On touch devices, the left joystick walks, right-side dragging turns the camera, and Run toggles pace. Two fingers can walk and turn simultaneously. Only the canvas uses `touch-action:none`; the joystick is a visual overlay whose touches reach the canvas. Page zoom remains enabled. Help is collapsible. At narrow widths the map starts as one 44px icon button; opening it reveals full store labels, choosing a store closes it, and Escape closes it with focus restored. Help and the map do not expand together on mobile. The map's three keyboard-accessible buttons teleport to storefronts, not interiors.

Approach a verified can display or MILI/GOGO brand panel, then press F or tap Inspect. The native modal traps focus, pauses controls, restores focus and closes with Escape. Its only link is the official eShop home page. No verified prices or inventory are supplied. The directory labels both as unavailable and links to the official eShop; its session-only demo bag creates no payment, order, or stock reservation. The directory includes all three stores and four official product packshots, including when JavaScript, WebGL or WebAssembly is unavailable. With JavaScript, visitors can filter stores, search and sort the New Moon products, add demo items, and enter or return from the 3D mall without losing the bag. Opening the HTML as a local file retains that directory; browser module security requires HTTP for 3D.

New Moon product details automatically open an unofficial interactive 3D preview. Drag to rotate, use the mouse wheel or a two-finger pinch to zoom, and use arrow keys, +/− and R for keyboard rotation, zoom and reset. If loading or WebGL fails, the official packshot remains visible; close and reopen the detail to retry. MILI and GOGO retain their official artwork viewers.

## Shared current-store spatial data

The existing three storefronts use [assets/spatial.js](assets/spatial.js) for stable IDs, numbers, labels, nominal bounds and arrival anchors. The world, player, map and live directory consume these records; static directory HTML remains available without JavaScript. The records describe the current scene, not the proposed 17-store expansion. See the [stage 2 spatial pilot](../../../../docs/gjh-v11-stage2-spatial-pilot.md) for contracts, fallback behavior, evidence and remaining work.

## World and implementation

One continuous, metre-scale interior connects a skylit atrium and three real-scale rooms. Jade tiles and brass inlay surround a water court with a moon-ring sculpture. A double-bordered stone arrival inset, nested gold diamonds and corner details furnish the foreground without new collision obstacles. Planters, benches, wall sconces, pendant lights, wayfinding and a three-step terrace furnish the concourse. Each storefront has two physical, automatically sliding glass leaves. Layered skirting, cornices and bordered flat rugs add depth to all three rooms. New Moon holds the four verified canned products on shelves, using the same front-label cylindrical projection as v10; unseen backs remain plain metal. MILI is a cream gathering room; GOGO is a green, timber-screened garden room. Their original cover artwork is not fictional merchandise.

The third polish pass adds a double moon-ring sculpture, layered fountain rims, fluted planter bases, brass bench edges and storefront washes. A shared instanced light-pool texture supplies floor and wall glow without more point lights. Interior wall bays, sconces, framed artwork, rug corner/fringe details and botanical shelf styling deepen each room without new products or collision obstacles.

The fourth polish pass lowers all three room-name plaques into the doorway with a bordered green backing. On narrow canvases, the entire plaque hides whenever its projected bounds enter the header, help or map bounds plus an 8px gutter; projection uses the current camera matrix, including during movement and expanded HUD states. Pale jade storefront solids, glass-look insets and brass borders lighten both faces without changing collision boxes or sliding doors.

`script.js` owns initialization and the 60Hz fixed physics timestep. `assets/world.js` owns instanced architecture, static collisions and doors; `products.js` owns shared wrapped-can geometry; `player.js` owns the capsule, Rapier kinematic character controller, gravity, auto-step, movement state, smooth turning, spring arm and desktop/two-finger input; `character.js` owns visitor loading and authored animation blending; `ui.js` owns accessible view state and inspection.

Original Blender furniture now supplies eight lounge benches and eleven areca-inspired planters. The editable master assets and generator live in the owner's `Blender-3D-Gallery` repository; [furnishings-sources.json](assets/furnishings-sources.json) pins the upstream commit and byte-identical exports. `assets/furnishings.js` fetches each local GLB once and instances its five/six material primitives across placements. The two assets total 354,048 bytes with no textures or external requests. Parallel loads have an eight-second deadline; a missing, invalid or aborted asset independently retains its procedural furniture. Existing collisions, contact shadows, seating directions and light pools remain owned by `world.js`.

The source models are original decorative concepts, not official company merchandise. Owner-project reuse is authorized; a public artwork redistribution license is not specified. The scene does not preload unrelated models from the owner's broader library or add GLBs to the PWA installation cache. Source and integration evidence are recorded in [the furniture review](../../../../docs/gjh-furnishings-review.md).

### Original visitor (application 1.1.2)

The current visitor direction follows the latest green-polo mascot reference with original Blender geometry. The editable source belongs in `Blender-3D-Gallery`; `assets/gjh-mall-visitor.glb` is the local export. [character-sources.json](assets/character-sources.json) is the receipt for its final source commit, SHA-256, dimensions and triangle count. The frozen revision 3 export measures 369,976 bytes, 10,356 triangles, 25 primitives and eight materials with no textures. Source commit `1a091b18e29b34ca468baf506968e1e65d815005` is verified and pinned in the website receipt; upstream PR #5 is merged. The user confirmed the green-polo direction; independent review accepted the avatar in 18 actual mall screenshots, with surrounding scene/UI limitations recorded in the character review. Reference images are not published.

`assets/character.js` loads the authored PBR materials at native metre scale, with front +Z and floor Y=0. It maps the `idle`, `walk` and `sprint` clips to the existing idle/walk/run movement states, preserves pace-transition phase and continuous animation weights, and pauses idle motion when reduced motion is requested. A PI visual rotation aligns the asset with -Z locomotion. A 60 ms presentation-only interval bridges isolated zero-motion contact ticks while input remains held after actual movement; release immediately targets idle, and persistent blockage expires the interval. Held input from rest does not fabricate movement. There are no model-specific shader, hair recoloring, shoulder or leg-track corrections. `player.js` retains the capsule, movement speeds, collision controller, input and camera behavior. A failed visitor load uses the existing directory fallback instead of silently substituting the previous model.

The previous Kenney **Mini Characters 2.0 / character-male-a** asset remains preserved as historical material, not the default visitor. Its **CC0-1.0** license and acquisition hashes remain in [assets/sources.json](assets/sources.json) and [shopper-LICENSE.txt](assets/shopper-LICENSE.txt); `assets/shopper.glb` is retained unchanged. The original visitor has separate provenance and is not covered by Kenney's license. Acceptance and remaining limitations are tracked in [the character review](../../../../docs/gjh-character-review.md).

Three.js and its local GLTFLoader/BufferGeometryUtils are pinned to 0.170.0 (MIT). Rapier compat 0.21.0 (Apache-2.0) is one local ES module with embedded WASM. Official image/font receipts are preserved from v10; no official library or older demo was changed. The mobile map control uses an inline SVG icon; the floorplan is an inline SVG data visualization.

Textures are at most 1024px. Repeated architecture and cans use instancing/shared resources. Graphics quality is owned by `assets/graphics-quality.js`. Auto selects Low when a reported CPU or memory hint is at most 2, Detailed at widths of at least 1000px when both hints are at least 4, and Balanced otherwise (including missing hints). Low caps DPR at 1 and disables real-time shadows. Balanced caps DPR at 1.25 below 600px and 2 otherwise, without real-time shadows. Detailed caps DPR at 2 and enables the existing 1024px main-light shadow map only at widths of at least 1000px. The existing How to explore panel offers Auto / Low / Balanced / Detailed. Valid selections use optional, guarded localStorage; missing or invalid storage uses Auto. Lower quality reduces rendering work, not downloads, product content or simulation. This deterministic policy does not measure or certify FPS. Rendering and simulation stop while the tab is hidden; modal/list views pause movement and rendering. Reduced motion has no camera bob, sway or idle drift, and cuts doors instantly. UI copy uses opaque or near-opaque green scrims and visible keyboard focus.

The generator already publishes direct-child `vendor/` and `assets/` files. The uncompressed vendor payload is approximately 5.19MB; the asset directory measured approximately 1.53MB before adding the original visitor; the original visitor adds 369,976 bytes. Its existing PWA policy excludes live demos from precaching, caching only the mall thumbnail with gallery browsing resources. The embedded WASM and furniture therefore do not inflate offline installation; a locally served complete checkout works without internet, while the gallery's existing offline fallback applies to uncached live demos.

## Interrupted graphics

Native context loss stops frames and transient input through the existing mode/pause owner, closes Shelf, and exposes the complete directory immediately. Scene Inspect retains its established loss-time auto-close; directory Inspect and Bag remain usable. Bag quantities stay separate from physical shelf reservations. A held physical shelf product retains its reservation; an unfinished pickup/return follows the existing transfer cancellation policy. Cart and seating stop. An interrupted elevator settles its rider and cabin on the nearest floor and re-enables the capsule, so an old journey cannot resume.

The same Three r170 renderer handles the native restoration event. Application validation runs in a later task after Three's handler, waits for the single async initialization to finish, renders without stepping physics, and checks the framebuffer and GL error state. Loss epochs reject stale restoration tasks. A hidden document postpones validation until visible. A successful frame makes **Return to 3D mall** and the existing 3D entry actions available, without changing the current directory/dialog view or focus. Recovery selects Low for this page; Help visibly shows Low and can directly select Detailed again. This temporary recovery selection does not overwrite the previously stored preference. Independent initialization or validation failures remain unavailable and offer **Reload page to retry 3D**. There is no initialization retry loop or production `WEBGL_lose_context` call.

`__mall.state.graphics` exposes read-only status, loss/validation counts, scene/camera identity, effective quality, actual shadow enablement and drawing-buffer dimensions for checks. Status availability is distinct from explicit user re-entry. See [graphics recovery evidence](../../../../docs/v11-graphics-recovery-review.md) for exact tested revisions, native Metal results, retained failures and platform limits.

## Mobile HUD (touch and narrow screens)

On coarse pointers or widths up to 650px the header is one slim row (logo, Map, Bag, List view), the interaction prompt is a one-row chip with touch labels ("Tap ..."), and controls and prompts respect `env(safe-area-inset-*)`. In short landscape the disclaimer is centred at the bottom so it never covers Run. Seated and cart prompts sit above the disclaimer in portrait. Planned work and the design decision about the bottom navigation are in `../../../../docs/gjh-v11-mobile-redesign-gap-report.md`.

## Review and hooks

`window.__mall` is frozen and read-only: `ready`, a snapshot `state`, `teleport(zone)`, `setInput({forward,right,run,yaw,pitch})`, and `step(ms)`. Teleport accepts `atrium`, `newmoon`, `mili`, `gogo`. Input values are bounded. Supplying input enters deterministic manual stepping; `setInput(null)` restores live input. Steps are bounded to ten seconds and cannot advance paused/hidden controls. `window.__sceneReady` marks the first completed render; initialization failure sets `window.__sceneFailed`.

The state snapshot exposes immutable `character` metadata and normalized idle/walk/run animation weights for regression checks. It also exposes read-only `roomSigns` screen bounds and visibility for HUD-clearance regression checks; no scene or material mutation is exposed.

The polish review captures spawn, walking, every interior and all panels at 1440×900, 768×1024 and 390×844. Desktop help now sits in the lower-left utility area with separate headline/disclaimer spacing; mobile keeps a compact top row. Temporary review images are not published; only three final spawn screenshots and the thumbnail are retained. Front-only can labels remain a packaging limitation. The replacement visitor passed a fresh full V11 run at all three widths, with maximum draw calls of 130, 114 and 101; the canonical character review records focused animation-transition and release checks.

## Verification

```sh
export GALLERY_CHROME="/Applications/Google Chrome.app/Contents/MacOS/Google Chrome"
~/venvs/gallery/bin/python scripts/build_gallery.py
~/venvs/gallery/bin/python scripts/build_gallery.py --check
~/venvs/gallery/bin/python -m unittest discover -s tests -p test_gallery.py -v
~/venvs/gallery/bin/python tests/browser_gallery.py
~/venvs/gallery/bin/python tests/browser_gjh_demos.py
~/venvs/gallery/bin/python tests/browser_gjh_v11.py
~/venvs/gallery/bin/python tests/browser_gjh_hybrid.py
~/venvs/gallery/bin/python tests/browser_gjh_startup_retry.py
node --test tests/gjh_graphics_quality.test.mjs
~/venvs/gallery/bin/python tests/browser_gjh_graphics_recovery.py --root . --prefix gallery --output /tmp/gallery-graphics-check
~/venvs/gallery/bin/python -m unittest discover -s tests -p test_gjh_character.py -v
~/venvs/gallery/bin/python tests/browser_gjh_character.py
~/venvs/gallery/bin/python tests/browser_gjh_furnishings.py
~/venvs/gallery/bin/python tests/browser_pwa.py
```

The mall browser check uses SwiftShader by default. Set `GALLERY_WEBGL_BACKEND=metal` on macOS to exercise native ANGLE Metal at the same viewport sizes and DPR. It tests the published artifact, actual keyboard walking and Q/E turning, deterministic walk/run/idle transitions, outer-wall collision/no tunnelling, storefront teleports and doors, F/Escape inspection, modal focus/pause, camera drag, two-finger touch, run toggle, list switching, target sizes/overflow, reduced motion, hidden-tab pause, context loss, WebGL/WASM failures and no-JavaScript browsing. The mobile map regression covers collapsed startup, mutually exclusive help, label bounds, Escape focus restoration and closing after store selection. `--capture` refreshes only v11 previews; regenerate the gallery afterward. Physical-phone frame rate, Safari and screen-reader behavior remain unverified.

Essential scene textures retry twice after a failed request, without navigating away. If all attempts fail, initialization reports the asset name in the console and retains the accessible directory. The startup retry browser check covers both temporary and persistent failures.

The third-pass visual review covered atrium, walking, every store and every inspection panel at all three widths, followed by a contact-shadow refinement and fresh reviewed spawn screenshots/thumbnail. The 390px map, 100px joystick and 58px Run control remain separated from the header. Browser regression coverage now also checks mobile HUD intersections and the 200-draw-call budget in every store and while walking.

Historical fourth-pass commands (before the original visitor replacement) each ran once and exited 0: gallery build, `--check`, eight unit tests, `browser_gallery.py`, `browser_gjh_demos.py` (28 cases), and `browser_gjh_v11.py`. The two screenshot-writing legacy/gallery runners used an isolated temporary copy to avoid unrelated file changes. No PWA code changed or PWA check was requested for this pass.

Fourth-pass SwiftShader spawn / sampled maximum draw calls at 1440, 768 and 390 were **97 / 98**, **82 / 82** and **69 / 69**, respectively: all below the existing 200-call budget. Entry views used **57 / 50 / 46** in New Moon, **67 / 55 / 49** in MILI, and **58 / 51 / 46** in GOGO. V11 reported no console errors or external requests; walking, collision, doors, inspection, touch, target sizes, room-sign/HUD clearance, reduced motion, visibility pause and fallbacks passed.

The fourth-pass visual review covers atrium, walking, every storefront/entry/interior, all four product panels, both brand panels and the map at 1440×900, 768×1024 and 390×844. Three settled-idle arrival screenshots and the thumbnail are refreshed. Regression coverage checks room-sign HUD clearance along every approach, expanded mobile help/map states, complete desktop/tablet plaque framing, and sampled maximum draw calls.

Independent >=88 visual scores on every shot, physical-phone frame rate, Safari and screen-reader behavior remain unverified. Front-only can labels remain a visual limitation. The historical Kenney rig limitations do not describe the replacement visitor; its revision-3 measurements and fresh full V11 evidence are recorded in the character review, with release and deployment status maintained in that canonical review.

## Hybrid directory imagery

The directory uses 20 original AI-generated, unbranded concept illustrations in its optional concept gallery and one entry preview. They are not photographs of the current 3D scene, real premises, merchandise, or official brand material. Image subjects and generation provenance are listed in `assets/concept-imagery.json`; official New Moon product packshots and existing brand artwork remain separate. The gallery images load lazily and are not part of the gallery shell precache.

The three store sections also use nine AI-generated lifestyle scenes, three per brand, inspired by the existing official cover images. They are labelled as concepts and use the original official logo assets separately. The MILI and GOGO original covers remain available in their brand artwork viewers, the original New Moon cover remains in the assets, and the four verified product packshots are unchanged. See `assets/concept-imagery.json` for the scene and reference inventory.

## Standalone PWA

V11 has its own scoped manifest and an integrity-checked worker that saves only a reconnect screen and app icons. The directory and 3D mall still require a connection; the demo bag remains session-only. Updates require an explicit action. See [PWA scope, tests and limitations](../../../../docs/gjh-v11-pwa.md).
