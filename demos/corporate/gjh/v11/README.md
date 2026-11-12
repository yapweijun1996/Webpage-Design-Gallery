# GJH v11 — Virtual Mall

Independent, unofficial concept. Not affiliated with or endorsed by Goh Joo Hin Pte Ltd.

## Open and explore

Serve the repository with `~/venvs/gallery/bin/python -m http.server 8000`, then open `/demos/corporate/gjh/v11/`. Everything is local: no runtime CDN, external font, analytics or network service. Official eShop links navigate only on user activation.

WASD or arrow keys walk freely; Shift runs. Drag the scene to orbit the collision-constrained spring-arm camera. On touch devices, the left joystick walks, right-side dragging turns the camera, and Run toggles pace. Two fingers can walk and turn simultaneously. Only the canvas uses `touch-action:none`; the joystick is a visual overlay whose touches reach the canvas. Page zoom remains enabled. Help is collapsible. At narrow widths the map starts as one 44px icon button; opening it reveals full store labels, choosing a store closes it, and Escape closes it with focus restored. Help and the map do not expand together on mobile. The map's three keyboard-accessible buttons teleport to storefronts, not interiors.

Approach a verified can display or MILI/GOGO brand panel, then press E or tap Inspect. The native modal traps focus, pauses controls, restores focus and closes with Escape. Its only link is the official eShop home page. No prices, inventory, invented products or commerce flow are present. List view contains all three stores and four complete verified packshots, including when JavaScript, WebGL or WebAssembly is unavailable. Opening the HTML as a local file retains that directory; browser module security requires HTTP for 3D.

## World and implementation

One continuous, metre-scale interior connects a skylit atrium and three real-scale rooms. Jade tiles and brass inlay surround a water court with a moon-ring sculpture. A double-bordered stone arrival inset, nested gold diamonds and corner details furnish the foreground without new collision obstacles. Planters, benches, wall sconces, pendant lights, wayfinding and a three-step terrace furnish the concourse. Each storefront has two physical, automatically sliding glass leaves. Layered skirting, cornices and bordered flat rugs add depth to all three rooms. New Moon holds the four verified canned products on shelves, using the same front-label cylindrical projection as v10; unseen backs remain plain metal. MILI is a cream gathering room; GOGO is a green, timber-screened garden room. Their original cover artwork is not fictional merchandise.

The third polish pass adds a double moon-ring sculpture, layered fountain rims, fluted planter bases, brass bench edges and storefront washes. A shared instanced light-pool texture supplies floor and wall glow without more point lights. Interior wall bays, sconces, framed artwork, rug corner/fringe details and botanical shelf styling deepen each room without new products or collision obstacles.

The fourth polish pass lowers all three room-name plaques into the doorway with a bordered green backing. On narrow canvases, the entire plaque hides whenever its projected bounds enter the header, help or map bounds plus an 8px gutter; projection uses the current camera matrix, including during movement and expanded HUD states. Pale jade storefront solids, glass-look insets and brass borders lighten both faces without changing collision boxes or sliding doors.

`script.js` owns initialization and the 60Hz fixed physics timestep. `assets/world.js` owns instanced architecture, static collisions and doors; `products.js` owns shared wrapped-can geometry; `player.js` owns the capsule, Rapier kinematic character controller, gravity, auto-step, animation state machine, smooth turning, spring arm and desktop/two-finger input; `ui.js` owns accessible view state and inspection.

Original Blender furniture now supplies eight lounge benches and eleven areca-inspired planters. The editable master assets and generator live in the owner's `Blender-3D-Gallery` repository; [furnishings-sources.json](assets/furnishings-sources.json) pins the upstream commit and byte-identical exports. `assets/furnishings.js` fetches each local GLB once and instances its five/six material primitives across placements. The two assets total 354,048 bytes with no textures or external requests. Parallel loads have an eight-second deadline; a missing, invalid or aborted asset independently retains its procedural furniture. Existing collisions, contact shadows, seating directions and light pools remain owned by `world.js`.

The source models are original decorative concepts, not official company merchandise. Owner-project reuse is authorized; a public artwork redistribution license is not specified. The scene does not preload unrelated models from the owner's broader library or add GLBs to the PWA installation cache. Source and integration evidence are recorded in [the furniture review](../../../../docs/gjh-furnishings-review.md).

Kenney **Mini Characters 2.0 / character-male-a**, **CC0-1.0**, supplies the humanlike shopper. Idle, walk and sprint clips are retained from the official pack; sprint drives the run state. Runtime clip preprocessing relaxes the rigid shoulder-only arms and derives opposing arm swing from the legs. A 1.65m scale, texture-matched shadow fill and contact shadow keep the figure readable and grounded. Other clips and unused buffer data were removed from the published model, and the unchanged 512px texture was embedded. Actual Three.js review established +Z facing; the visual rotates by PI for -Z locomotion. This is not RobotExpressive or a hand-built placeholder. The detailed acquisition receipt, source/model hashes and pack licence text are in `assets/sources.json` and `shopper-LICENSE.txt`; the receipt distinguishes source CRLF and published LF licence hashes.

Shopper materials include a restrained view-space rim fill without outline meshes. The head alone remaps the original atlas's dark hair texels to chestnut, with a crown highlight and swept part in its existing shader pass. The contact shadow clears visual floor/rug inlays; relaxed shoulder poses, interruption-safe animation weights and walk/run phase continuity soften locomotion. A slightly closer, lower spring-arm framing retains the existing camera obstruction checks. The original Kenney model, texture and licence are unchanged.

Three.js and its local GLTFLoader/BufferGeometryUtils are pinned to 0.170.0 (MIT). Rapier compat 0.21.0 (Apache-2.0) is one local ES module with embedded WASM. Official image/font receipts are preserved from v10; no official library or older demo was changed. The mobile map control uses an inline SVG icon; the floorplan is an inline SVG data visualization.

Textures are at most 1024px. Repeated architecture and cans use instancing/shared resources. DPR is capped at 2, or 1.5 below 600px. Only capable desktop configurations enable one 1024px soft-shadow map. Rendering and simulation stop while the tab is hidden; modal/list views pause movement and rendering. Reduced motion has no camera bob, sway or idle drift, and cuts doors instantly. UI copy uses opaque or near-opaque green scrims and visible keyboard focus.

The generator already publishes direct-child `vendor/` and `assets/` files. The uncompressed vendor payload is approximately 5.19MB; the asset directory with the two original furniture GLBs is approximately 1.53MB. Its existing PWA policy excludes live demos from precaching, caching only the mall thumbnail with gallery browsing resources. The embedded WASM and furniture therefore do not inflate offline installation; a locally served complete checkout works without internet, while the gallery's existing offline fallback applies to uncached live demos.

## Review and hooks

`window.__mall` is frozen and read-only: `ready`, a snapshot `state`, `teleport(zone)`, `setInput({forward,right,run,yaw,pitch})`, and `step(ms)`. Teleport accepts `atrium`, `newmoon`, `mili`, `gogo`. Input values are bounded. Supplying input enters deterministic manual stepping; `setInput(null)` restores live input. Steps are bounded to ten seconds and cannot advance paused/hidden controls. `window.__sceneReady` marks the first completed render; initialization failure sets `window.__sceneFailed`.

The state snapshot also exposes read-only `roomSigns` screen bounds and visibility for HUD-clearance regression checks; no scene or material mutation is exposed.

The polish review captures spawn, walking, every interior and all panels at 1440×900, 768×1024 and 390×844. Desktop help now sits in the lower-left utility area with separate headline/disclaimer spacing; mobile keeps a compact top row. Temporary review images are not published; only three final spawn screenshots and the thumbnail are retained. The deliberately stylized, shoulder-only shopper rig and front-only can labels remain weaker than fully articulated character/packaging assets.

## Verification

```sh
export GALLERY_CHROME="/Applications/Google Chrome.app/Contents/MacOS/Google Chrome"
~/venvs/gallery/bin/python scripts/build_gallery.py
~/venvs/gallery/bin/python scripts/build_gallery.py --check
~/venvs/gallery/bin/python -m unittest discover -s tests -p test_gallery.py -v
~/venvs/gallery/bin/python tests/browser_gallery.py
~/venvs/gallery/bin/python tests/browser_gjh_demos.py
~/venvs/gallery/bin/python tests/browser_gjh_v11.py
~/venvs/gallery/bin/python tests/browser_pwa.py
```

The mall browser check uses SwiftShader and tests the published artifact, actual keyboard walking, deterministic walk/run/idle transitions, outer-wall collision/no tunnelling, storefront teleports and doors, E/Escape inspection, modal focus/pause, camera drag, two-finger touch, run toggle, list switching, target sizes/overflow, reduced motion, hidden-tab pause, context loss, WebGL/WASM failures and no-JavaScript browsing. The mobile map regression covers collapsed startup, mutually exclusive help, label bounds, Escape focus restoration and closing after store selection. `--capture` refreshes only v11 previews; regenerate the gallery afterward. Physical-phone frame rate, Safari and screen-reader behavior remain unverified.

The third-pass visual review covered atrium, walking, every store and every inspection panel at all three widths, followed by a contact-shadow refinement and fresh reviewed spawn screenshots/thumbnail. The 390px map, 100px joystick and 58px Run control remain separated from the header. Browser regression coverage now also checks mobile HUD intersections and the 200-draw-call budget in every store and while walking.

Final fourth-pass commands each ran once and exited 0: gallery build, `--check`, eight unit tests, `browser_gallery.py`, `browser_gjh_demos.py` (28 cases), and `browser_gjh_v11.py`. The two screenshot-writing legacy/gallery runners used an isolated temporary copy to avoid unrelated file changes. No PWA code changed or PWA check was requested for this pass.

Fourth-pass SwiftShader spawn / sampled maximum draw calls at 1440, 768 and 390 were **97 / 98**, **82 / 82** and **69 / 69**, respectively: all below the existing 200-call budget. Entry views used **57 / 50 / 46** in New Moon, **67 / 55 / 49** in MILI, and **58 / 51 / 46** in GOGO. V11 reported no console errors or external requests; walking, collision, doors, inspection, touch, target sizes, room-sign/HUD clearance, reduced motion, visibility pause and fallbacks passed.

The fourth-pass visual review covers atrium, walking, every storefront/entry/interior, all four product panels, both brand panels and the map at 1440×900, 768×1024 and 390×844. Three settled-idle arrival screenshots and the thumbnail are refreshed. Regression coverage checks room-sign HUD clearance along every approach, expanded mobile help/map states, complete desktop/tablet plaque framing, and sampled maximum draw calls.

Independent >=88 visual scores on every shot, physical-phone frame rate, Safari and screen-reader behavior remain unverified. The deliberately blocky Kenney head, shoulder-only rig and front-only can labels remain visual limitations; no new third-party assets or additional light/shadow passes were introduced.
