# GJH v11 — Virtual Mall

Independent, unofficial concept. Not affiliated with or endorsed by Goh Joo Hin Pte Ltd.

## Open and explore

Design reviews, new models, loader screenshots and acceptance use the default expanded 17-shop mall. The Classic 3-store route remains available as a legacy experience. See the [current company and shop design index](../../../../docs/goh-joo-hin/).

Turn toward the south entrance beside the tram and walk through the glazed doors to reach the Singapore street. The same visitor can follow the pavement past an open HDB void deck, shophouses and Angsana trees, then walk back into the mall. The doors open once the street geometry and collision surfaces are ready. A failed request leaves the entrance closed and displays retry instructions.

[Street route, camera and memory checks](../../../../docs/gjh-v11-singapore-street.md)

The [street source receipts](assets/districts/singapore/sources.json) pin the five original GLBs and the corresponding Blender sources and project-use terms. The street loads on approach. Farther down the pavement the mall releases its detailed room models, room proxies and window-studio models. Its structural shell, transit, coarse furnishings, player and session remain resident. Returning rebuilds room details and retires the street geometry, camera bounds and collision handles. The scoped service worker caches verified model files on demand. Opening the live mall offline still uses the existing reconnect page.

A small covered food court sits beyond the final shophouse row. It loads independently on approach. Two original stall models share a browsable aisle and a four-chair table. Each chair sits and stands through the normal visitor controls. The generic stall has a kettle and the other has a chicken-rice display. The [food court source receipts](assets/districts/food-court/sources.json) pin the four owner-project GLBs. Leaving this part of the street retires its seat registrations, camera bounds, collision handles and render resources. A failed court request leaves the existing street accessible. Step away from the parcel and approach again to retry. [Walking and seating evidence](../../../../docs/gjh-v11-food-court.md)

### Malaysia · Kampung lane

In the expanded Map, select **Malaysia · Kampung lane** and choose **Visit neighbourhood** from the courtyard or Singapore street. Walk the connected verges past two raised timber houses and a terrace porch. Open Map and choose **Return to GJH courtyard** to return with the same visitor and bag. The street is an independent architectural study.

The visit loads two owner-project house models and reuses the existing road model. The origin stays playable until the new district has a mounted floor and camera bounds. Closing Map cancels a pending visit. A failed connection leaves the visitor in the original district and allows a retry. Return to the courtyard uses its resident floor. [Model sources and licences](assets/districts/malaysia/sources.json)

Open **Tools** for Guide, Help, Shopping Cart and Theme. Help includes the language picker and versioned update control. These preferences are also accessible from the directory’s **App & offline help**.

The accessible directory contains a separate **Original demo tin — not New Moon packaging** viewer. It lazy-loads the byte-pinned original generic tin, preserves native metre scale, and supports drag/keyboard orbit, zoom, reset and mutually exclusive illustrative OpenClose/Exploded clips. The native dialog is keyboard-contained, restores focus, pauses the mall, and releases resources on close. Missing or invalid assets show a readable fallback; no branded product image, text, eShop link or world geometry is replaced.

The original GLB is 186,016 bytes, SHA-256 `4b265f78a711d95a80b730ebeaae3906f42c93fbd28f0b8c6e64c8c003eee0ee`. Geometry and DEMO artwork were created for the owner's project; owner-project public demo use is authorized, not a new general third-party license. The accompanying provenance and DejaVu font license are retained. This independent demonstration does **not** complete the planned four-SKU New Moon Phase 3 viewer. See [the review](../../../../docs/original-tin-viewer-review.md).

Serve the repository with `~/venvs/gallery/bin/python -m http.server 8000`, then open `/demos/corporate/gjh/v11/`. Everything is local: no runtime CDN, external font, analytics or network service. Official eShop links navigate only on user activation.

The default expanded mall has a 70 × 60 m ground floor, two lounges and seventeen furnished, walkable stores. The map takes visitors to the public side of each doorway. All seventeen storefronts have automatic sliding doors. Approach from either side to open them and walk through. They close after you leave the doorway. At +7.2 m, a 12 × 12 m atrium viewing deck has modular glass railings, warm-wood seating and areca planters around a centred lounge, plus one gallery wall of 17 logo/tagline plaques. Each plaque has a 25–40 word story and is available nearby and through keyboard/tap Inspect. This visual concept does not establish tenancy, a current brand relationship, product availability, medical claims or general artwork rights. Choose **Classic 3-store view** in the directory or use `?layout=classic` for the original scene; `?layout=expanded` remains an alias. Each existing store retains a directory/map destination. The no-JavaScript directory remains available, and the current tab's demo bag is retained when session storage is available. The independent mall PWA provides an offline reconnect screen, not an offline 3D mall. See [stage 5 evidence](../../../../docs/gjh-v11-stage5-existing-stores.md).

The courtyard elevator has a glass car and matching green-and-gold entrances on both floors. Choose **Ride** to board. **Skip ride** and reduced motion take you directly to the destination. The loader prepares the selected model and its GPU resources before it appears. [Design, budgets and verification](../../../../docs/gjh-v11-elevator-redesign.md).

All 17 expanded shops use the configurable signage system. Official lockups, double-sided aisle blades, number plates and hero window graphics share one mipmapped atlas, 1024px on Low and 2048px on Balanced and Detailed. Balanced adds instanced trim and near-field embossing. Detailed adds raised lettering and recessed fittings. The loader stages the active tier’s sign kit and GPU resources. Runtime changes use the sliced uploader before switching. The performance report includes a per-frame signage breakdown. [Store configuration, GLB contract, measured geometry budgets and screenshot guide](../../../../docs/gjh-v11-signage-system.md).

All 17 expanded shops have an authored floor pattern, room palette and signature fixture. During the fifth loader stage the mall preinstalls the selected tier for all 17 interiors, nearest first. After six foreground seconds or an early entry, unfinished rooms continue through the sliced uploader. Each room can appear after its GPU fence signals. New Moon's collector triptych displays an official packshot above the working shelf stock. The performance report includes interior mesh submissions, resident GLB bytes and `interiors.preinstalled` with the shop count and elapsed milliseconds. [Installed budget, provenance and screenshot guide](../../../../docs/gjh-v11-interior-program.md).

WASD or arrow keys walk at 2.65 m/s. Hold Shift to sprint at up to 7.5 m/s. On foot, both visitor rigs scale the sprint clip to the distance travelled after collision resolution. Hold Q/E to turn left/right, including while moving; opposite turn keys cancel. Turning alone does not translate the player. Drag the scene to orbit the collision-constrained spring-arm camera. On touch devices, the right joystick moves at running pace by default. Tap Run to walk. Drag the scene to look, or enable Full-screen joystick in Help to start movement anywhere and use a second finger to look. The joystick preference persists across visits. Two fingers can walk and turn simultaneously. Only the canvas uses `touch-action:none`; the joystick is a visual overlay whose touches reach the canvas. Page zoom remains enabled. Help is collapsible. At narrow widths the map starts as one 44px icon button; opening it reveals full store labels, choosing a store closes it, and Escape closes it with focus restored. Help and the map do not expand together on mobile. Keyboard-accessible map destinations lead to the public side of each entrance.

Approach a verified can display or MILI/GOGO brand panel, then press F or tap Inspect. The native modal traps focus, pauses controls, restores focus and closes with Escape. Its only link is the official eShop home page. No verified prices or inventory are supplied. The directory labels both as unavailable and links to the official eShop; its session-only demo bag creates no payment, order, or stock reservation. The expanded directory lists all 17 lots, with seventeen walkable storefronts and four official product packshots, including when JavaScript, WebGL or WebAssembly is unavailable. With JavaScript, visitors can filter stores, search and sort the New Moon products, add demo items, and enter or return from the 3D mall without losing the bag. Opening the HTML as a local file retains that directory; browser module security requires HTTP for 3D.

New Moon product details automatically open an unofficial interactive 3D preview. Drag to rotate, use the mouse wheel or a two-finger pinch to zoom, and use arrow keys, +/− and R for keyboard rotation, zoom and reset. If loading or WebGL fails, the official packshot remains visible; close and reopen the detail to retry. MILI and GOGO retain their official artwork viewers.

With Tripo or Visitor v2, choose **Pick up product** within reach of a New Moon shelf. **Add to bag** follows the held can throughout the mall, including after map travel, and adds one of that product to the demo bag. The visitor lowers the can in a short gesture. Reduced motion clears the hand immediately. The original shelf's facing is restored as a reusable display, consistent with the demo bag's cosmetic stock. **Return to shelf** is available within reach of the original shelf. Either action frees your hands for seats, the cart and the elevator. If your bag has nine of the product, it opens so you can make room.

Approach a lounge bench from its open side and use **Sit**. The visitor faces the aisle and the camera frames the seated visitor from the open side at chase distance. **Stand** checks for a free spot in front of the bench and restores the previous view.

## Shared current-store spatial data

The existing three storefronts use [assets/spatial.js](assets/spatial.js) for stable IDs, numbers, labels, nominal bounds and arrival anchors. The world, player, map and live directory consume these records; static directory HTML remains available without JavaScript. The records describe the current scene, not the proposed 17-store expansion. See the [stage 2 spatial pilot](../../../../docs/gjh-v11-stage2-spatial-pilot.md) for contracts, fallback behavior, evidence and remaining work.

## World and implementation

In the expanded courtyard, Map marker E identifies the ascending escalator. Visitors can ride to the upper benches, then take the passenger lift down. [Escalator route and measurements](../../../../docs/gjh-v11-escalator.md)

One continuous, metre-scale interior connects a skylit atrium and three real-scale rooms. Jade tiles and brass inlay surround a water court with a moon-ring sculpture. A double-bordered stone arrival inset, nested gold diamonds and corner details furnish the foreground without new collision obstacles. Planters, benches, wall sconces, pendant lights, wayfinding and a three-step terrace furnish the concourse. Each storefront has two physical, automatically sliding glass leaves. Layered skirting, cornices and bordered flat rugs add depth to all three rooms. New Moon holds the four verified canned products on shelves, using the same front-label cylindrical projection as v10; unseen backs remain plain metal. Its merchandising plan has 17 visible front facings per shelf level, 204 native-scale instances total and 51 per SKU (11 per level and 132 total for the narrower optional pilot). Facings stay within the inner cabinet bays and leave side display wings clear. GLB bounds are approximately 0.0775 m diameter × 0.12399 m high for a can and 2.4 m wide × 2.4 m high × 0.55 m deep for the M056 shelf; these are estimated packaging/model dimensions, not verified manufacturing measurements. No can is enlarged for presentation. MILI is a cream gathering room; GOGO is a green, timber-screened garden room. Their original cover artwork is not fictional merchandise.

The third polish pass adds a double moon-ring sculpture, layered fountain rims, fluted planter bases, brass bench edges and storefront washes. A shared instanced light-pool texture supplies floor and wall glow without more point lights. Interior wall bays, sconces, framed artwork, rug corner/fringe details and botanical shelf styling deepen each room without new products or collision obstacles.

The fourth polish pass lowers all three room-name plaques into the doorway with a bordered green backing. On narrow canvases, the entire plaque hides whenever its projected bounds enter the header, help or map bounds plus an 8px gutter; projection uses the current camera matrix, including during movement and expanded HUD states. Pale jade storefront solids, glass-look insets and brass borders lighten both faces without changing collision boxes or sliding doors.

`script.js` owns initialization and the 60Hz fixed physics timestep. `assets/world.js` owns instanced architecture, static collisions and doors; `products.js` owns shared wrapped-can geometry; `player.js` owns the capsule, Rapier kinematic character controller, gravity, auto-step, movement state, smooth turning, spring arm and desktop/two-finger input; `character.js` owns visitor loading and authored animation blending; `ui.js` owns accessible view state and inspection.

Original Blender furniture now supplies nine lounge benches and thirteen areca-inspired planters across the three shops and upper deck. The editable master assets and generator live in the owner's `Blender-3D-Gallery` repository; [furnishings-sources.json](assets/furnishings-sources.json) pins the upstream commit and byte-identical exports. `assets/furnishings.js` fetches each local GLB once and instances its five/six material primitives across placements. The gallery's modular 2 m glass railing bays and independent posts are also reused on the deck; `assets/deck-railings.js` verifies their exported hashes and dimensions before instancing. These are decorative concepts, not safety-certified barriers. No textures or external requests are introduced. Existing collisions, contact shadows, seating directions and light pools remain owned by `world.js`.

The source models are original decorative concepts, not official company merchandise. Owner-project reuse is authorized; a public artwork redistribution license is not specified. The scene does not preload unrelated models from the owner's broader library or add GLBs to the PWA installation cache. Source and integration evidence are recorded in [the furniture review](../../../../docs/gjh-furnishings-review.md).

### Default Tripo visitor

The default 3D visitor is **Studio Gerak Chibi Tripo**, the owner's own rigged character. The adapter normalizes its bind-pose height to 1.7 m with feet at floor zero and uses the existing capsule and spring-arm camera. Startup falls back to Visitor v2 if Tripo cannot load or a required clip is missing. Use `?visitor=v2` for the customizable skinned visitor or `?visitor=v1` for the original green-polo model. Tripo keeps the demo bag and shelf pickup flow, with appearance controls and the wearable shopping bag omitted.

The visitor turns toward the camera and waves once as the scene opens. From an active scene, call `window.__mall.emote('wave')` (also `'nod'`, `'jump'` and `'dance'`) to request a one-shot. A `true` return means the emote started or was queued. Emotes require an idle visitor and follow the reduced-motion preference. Seats use a trimmed portion of the authored `sit` clip in LOD0. See the [interaction and pose details](../../../../docs/gjh-v11-engine-interactions.md#tripo-visitor).

Use the optimized `assets/gjh-tripo-visitor.glb` (LOD0) and `assets/gjh-tripo-visitor-lod1.glb` (LOD1) in the gallery build. Keep the 5.4 MB raw export out of Git. The provenance receipt records the hash of the original raw export before optimization. [Owner's gallery](https://yapweijun1996.github.io/Blender-3D-Gallery/?page=tripo-motion) · [Source receipt](assets/gjh-tripo-visitor-source.json)

### Original green-polo visitor (application 1.1.2)

The `?visitor=v1` model follows the green-polo mascot reference with original Blender geometry. The editable source belongs in `Blender-3D-Gallery`. The local frozen revision 3 export measures 369,976 bytes, 10,356 triangles, 25 primitives and eight materials. The receipt pins the accepted export and its upstream source commit. [Original character receipt](assets/character-sources.json)

`assets/character.js` loads the v1 materials at native metre scale, rotates the +Z-facing rig to match -Z locomotion and maps `idle`, `walk` and `sprint` to the engine's idle/walk/run states. The shared 60 ms locomotion continuity interval bridges isolated contact corrections while input remains held after actual movement. Releasing input targets idle immediately.

The previous Kenney **Mini Characters 2.0 / character-male-a** asset remains preserved as historical material, not the default visitor. Its **CC0-1.0** license and acquisition hashes remain in [assets/sources.json](assets/sources.json) and [shopper-LICENSE.txt](assets/shopper-LICENSE.txt); `assets/shopper.glb` is retained unchanged. The original visitor has separate provenance and is not covered by Kenney's license. Acceptance and remaining limitations are tracked in [the character review](../../../../docs/gjh-character-review.md).
Visitor v2's appearance panel includes cream, black and brown shoe colours. These recolour its existing skinned `V2_shoes_Cream white` mesh per visitor, without swapping geometry; cream restores the authored material colour. Appearance choices are saved on this device when local storage is available, and remain on the same mesh through animation and geometry-only LOD changes. Invalid or unavailable stored data is ignored. No separate shoe styles are claimed.

The local Blender-3D-Gallery candidates inspected were `chibi-mall-visitor-modular` (skinned sneaker and lacing with shared atlas charts), `gjh-chibi-visitor-code` (skinned Shoes mesh with ShoeUpper and ShoeSole materials), `chibi-visitor-v4` (Shoe.L/R, but no rig or animations), and `gjh-mall-visitor-v2` (the existing rigged visitor). The vendored high and LOD1 v2 exports both contain `V2_shoes_Cream white` using `Cream white`. The other candidates were not imported or retargeted. This is source inspection, not a visual or runtime verification.


Three.js and its local GLTFLoader/BufferGeometryUtils are pinned to 0.170.0 (MIT). Rapier compat 0.21.0 (Apache-2.0) is one local ES module with embedded WASM. Official image/font receipts are preserved from v10; no official library or older demo was changed. The mobile map control uses an inline SVG icon; the floorplan is an inline SVG data visualization.

The shared shop signage atlas uses 5.33 MiB on Low and 21.33 MiB on the other tiers. Repeated architecture and cans use instancing and shared resources. Tools offers Auto, Low, Balanced and Detailed plus a separate Auto resolution setting. Phones cap rendering at 30 FPS, while tablets and desktops cap it at 60 FPS. Physics uses 60 Hz fixed steps. Auto resolution lowers buffer scale from 100% to 60% before an Auto tier can step down. The tier remains at the lower level for the session until the visitor chooses a tier. Manual tiers retain dynamic resolution when enabled. The scene and glow composite use the scaled drawing buffer. The HUD uses CSS pixels. Auto and manual tier changes keep the current interiors and signage visible while replacements prepare. [Graphics policy, DPR caps and lap probe](../../../../docs/gjh-v11-graphics-quality.md).

Mall theme changes apply while Settings is open. From **Settings → About → Mall theme**, choose a decoration and wait for its active status. The visitor and lift stay in place until the menu closes. Closing during preparation cancels that selection. Chrome exercised Lunar New Year and the return to Everyday at 390, 768 and 1440 CSS px. A separate phone-width run exercised Christmas during lift boarding and cancellation followed by a new choice. [Menu comparison](../../../../docs/evidence/gjh-v11-theme-upload/comparison.webp) · [Browser observations](../../../../docs/evidence/gjh-v11-theme-upload/receipt.json)

Tools also provides master mute (**M**), background music and individual volume settings. Tram captions offer an optional Voice control. [Sound and music](../../../../docs/gjh-v11-audio.md).

The mall uses a warm directional key and hemisphere fill, a locally generated indoor reflection environment, and faint distance fog. Theme-coloured shop accent lights are limited to the six nearest ground-floor bays. Detailed quality at desktop widths adds a restrained selective glow for expanded-mall ground-floor signs and light strips; the upper deck, classic mode, Balanced, Low and narrow screens render without that pass. Reflections are regenerated after graphics restoration, which falls back to Low quality.

The generator already publishes direct-child `vendor/` and `assets/` files. The uncompressed vendor payload is approximately 5.19MB; the asset directory measured approximately 1.53MB before adding the original visitor; the original visitor adds 369,976 bytes. Its existing PWA policy excludes live demos from precaching, caching only the mall thumbnail with gallery browsing resources. The embedded WASM and furniture therefore do not inflate offline installation; a locally served complete checkout works without internet, while the gallery's existing offline fallback applies to uncached live demos.

## Interrupted graphics

Native context loss stops frames and transient input through the existing mode/pause owner, closes Shelf, and exposes the complete directory immediately. Scene Inspect retains its established loss-time auto-close; directory Inspect and Bag remain usable. Bag quantities stay separate from physical shelf reservations. A held physical shelf product retains its reservation; an unfinished pickup/return follows the existing transfer cancellation policy. Cart and seating stop. An interrupted elevator settles its rider and cabin on the nearest floor and re-enables the capsule, so an old journey cannot resume.

The same Three r170 renderer handles the native restoration event. Application validation runs in a later task after Three's handler, waits for the single async initialization to finish, renders without stepping physics, and checks the framebuffer and GL error state. Loss epochs reject stale restoration tasks. A hidden document postpones validation until visible. A successful frame makes **Return to 3D mall** and the existing 3D entry actions available, without changing the current directory/dialog view or focus. Recovery selects Low for this page; Help visibly shows Low and can directly select Detailed again. This temporary recovery selection does not overwrite the previously stored preference. Independent initialization or validation failures remain unavailable and offer **Reload page to retry 3D**. There is no initialization retry loop or production `WEBGL_lose_context` call.

`__mall.state.graphics` exposes read-only status, loss/validation counts, scene/camera identity, effective quality, actual shadow enablement and drawing-buffer dimensions for checks. Status availability is distinct from explicit user re-entry. See [graphics recovery evidence](../../../../docs/v11-graphics-recovery-review.md) for exact tested revisions, native Metal results, retained failures and platform limits.

## Mobile HUD (touch and narrow screens)

On coarse pointers or widths up to 650px the header is one slim row (logo, Map, Bag, List view), the interaction prompt is a one-row chip with touch labels ("Tap ..."), and controls and prompts respect `env(safe-area-inset-*)`. In short landscape the disclaimer is centred at the bottom so it never covers Run. Seated and cart prompts sit above the disclaimer in portrait. Planned work and the design decision about the bottom navigation are in `../../../../docs/gjh-v11-mobile-redesign-gap-report.md`.

## Review and hooks

`window.__mall` is frozen and read-only: `ready`, a snapshot `state`, `teleport(zone)`, `setInput({forward,right,run,yaw,pitch})`, and `step(ms)`. Teleport accepts `atrium`, `newmoon`, `mili`, `gogo`, plus `entry` in the expanded preview. Input values are bounded. Supplying input enters deterministic manual stepping; `setInput(null)` restores live input. Steps are bounded to ten seconds and cannot advance paused/hidden controls. `window.__sceneReady` marks the first completed render; initialization failure sets `window.__sceneFailed`.

The state snapshot exposes immutable `character` metadata and normalized idle/walk/run animation weights for regression checks. It also exposes read-only `roomSigns` screen bounds and visibility for HUD-clearance regression checks. `__mall.heroVisibility(number)` projects the visible shop fixture and animated visitor into CSS-pixel screen bounds for the storefront visibility gate; no scene or material mutation is exposed.

The polish review captures spawn, walking, every interior and all panels at 1440×900, 768×1024 and 390×844. Desktop help now sits in the lower-left utility area with separate headline/disclaimer spacing; mobile keeps a compact top row. Temporary review images are not published; only three final spawn screenshots and the thumbnail are retained. Front-only can labels remain a packaging limitation. The replacement visitor passed a fresh full V11 run at all three widths, with maximum draw calls of 130, 114 and 101; the canonical character review records focused animation-transition and release checks.

## Verification

For the 393×700 MILI bench 2 probe, serve this worktree with `python3 -m http.server 8812 --bind 127.0.0.1`. With Playwright available to Node and `GALLERY_CHROME` set, run `node tests/probe_gjh_mili_seat.cjs` to capture the approach, seated pose and standing exit in headed Chrome.

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

The ambient crowd includes the V2 chibi fallback, an optional Tripo boy and modular walkway outfits within the existing graphics-tier NPC limits. All visitors share the mall's routes, bench rules and render admission. The modular wardrobe loads after the first frame in eligible tiers. Mobile Low uses the original crowd models. See [NPC behavior, asset provenance and verification](../../../../docs/gjh-v11-npcs.md).

The Walk link starts Rapier and a gzip-compressed startup pack in parallel. The pack contains the first-view models, a compact visitor atlas and shop-sign artwork. The loader reports received WASM and pack payload bytes while it builds the minimum scene. Once the first visible frame renders with physics, **Enter 3D mall now** skips the remaining warm-up. Waiting keeps the six-second GPU warm-up cap. The store directory stays available throughout.

Interiors continue to install nearest-first. Shop GLB parsing, visitor LOD parsing and GPU uploads use the sliced warm-up queue. The compact visitor is parsed under the loader. Gallery fixtures and the portrait upgrade start after entry. The cart loads when requested, the tram loads near its station, and upper lounge models load on lift selection. The PWA install keeps its small reconnect shell and caches verified wardrobe files on demand.

Edit the entry template and first-view manifest in `templates/gallery/gjh-v11-index.html` and `data/gjh-first-view.json`. Regenerate with `python scripts/build_gallery.py`. To refresh entry artwork from the authored sources, run `python scripts/build_gjh_first_view_art.py` with Pillow and WebP support before building.

Use [the load probe](../../../../docs/load_probe.py) with separate baseline and candidate URLs using the same server encoding. It reports encoded response-body bytes and request counts at first **Enter now** availability and first playable view for each device, quality tier and throttle profile. The Node first-view budget uses gzip estimates for text and WASM. A plain Python HTTP server serves their raw bytes. Use the deployed HTTPS endpoint to verify the actual compression, protocol, and the Slow-3G and Fast-3G timing targets.

The third-pass visual review covered atrium, walking, every store and every inspection panel at all three widths, followed by a contact-shadow refinement and fresh reviewed spawn screenshots/thumbnail. The 390px map, 100px joystick and 58px Run control remain separated from the header. Browser regression coverage now also checks mobile HUD intersections and the 200-draw-call budget in every store and while walking.

Historical fourth-pass commands (before the original visitor replacement) each ran once and exited 0: gallery build, `--check`, eight unit tests, `browser_gallery.py`, `browser_gjh_demos.py` (28 cases), and `browser_gjh_v11.py`. The two screenshot-writing legacy/gallery runners used an isolated temporary copy to avoid unrelated file changes. No PWA code changed or PWA check was requested for this pass.

Fourth-pass SwiftShader spawn / sampled maximum draw calls at 1440, 768 and 390 were **97 / 98**, **82 / 82** and **69 / 69**, respectively: all below the existing 200-call budget. Entry views used **57 / 50 / 46** in New Moon, **67 / 55 / 49** in MILI, and **58 / 51 / 46** in GOGO. V11 reported no console errors or external requests; walking, collision, doors, inspection, touch, target sizes, room-sign/HUD clearance, reduced motion, visibility pause and fallbacks passed.

The fourth-pass visual review covers atrium, walking, every storefront/entry/interior, all four product panels, both brand panels and the map at 1440×900, 768×1024 and 390×844. Three settled-idle arrival screenshots and the thumbnail are refreshed. Regression coverage checks room-sign HUD clearance along every approach, expanded mobile help/map states, complete desktop/tablet plaque framing, and sampled maximum draw calls.

Independent >=88 visual scores on every shot, physical-phone frame rate, Safari and screen-reader behavior remain unverified. Front-only can labels remain a visual limitation. The historical Kenney rig limitations do not describe the replacement visitor; its revision-3 measurements and fresh full V11 evidence are recorded in the character review, with release and deployment status maintained in that canonical review.

## Hybrid directory imagery

The directory uses 20 original AI-generated, unbranded concept illustrations in its optional concept gallery and one entry preview. They are not photographs of the current 3D scene, real premises, merchandise, or official brand material. Image subjects and generation provenance are listed in `assets/concept-imagery.json`; official New Moon product packshots and existing brand artwork remain separate. The gallery images load lazily and are not part of the gallery shell precache.

The three store sections also use nine AI-generated lifestyle scenes, three per brand, inspired by the existing official cover images. They are labelled as concepts and use the original official logo assets separately. The MILI and GOGO original covers remain available in their brand artwork viewers, the original New Moon cover remains in the assets, and the four verified product packshots are unchanged. See `assets/concept-imagery.json` for the scene and reference inventory.

## Standalone PWA

V11 has its own scoped manifest and an integrity-checked worker that saves a reconnect screen and its supporting assets. The worker also caches verified wardrobe files on demand. The directory and 3D mall still require a connection; the demo bag remains session-only. Updates require an explicit action. See [PWA scope, tests and limitations](../../../../docs/gjh-v11-pwa.md).

In the expanded layout, the additional storefront destinations use the IDs `planned-space-04` through `planned-space-17`. Run `python tests/browser_gjh_shop_walkthrough.py` to check arrivals, doors, interior routes, fixture collisions and exits for the ground-floor shops.

## FPS and performance logs

Select the FPS counter in the 3D view to inspect frame cadence, simulation time, render submission time, draw calls and triangles. Reproduce a slowdown, open the counter and choose **Download report (JSON)**. Help includes a **Show FPS** setting. The report stays in the browser until downloaded.

Reports include the last five seconds of individual frames, up to two minutes of one-second summaries and the latest twenty slow events within the past minute. World coordinates, zone, tier and render scale help locate a problem. The report also records the device class, target FPS and completed automatic tier downgrades. Times use milliseconds relative to the report’s `timeOrigin`. Hidden and paused intervals are excluded. A `busy-callback` identifies at least 50 ms of synchronous callback work. A `raf-gap` identifies a long interval with a shorter current callback. The render metric measures CPU submission time; GPU completion can occur later. In DevTools, `window.__mall.performanceReport()` returns the same data.

## Visitor arrivals page controls

Arrivals and the store directory share a sticky header with Home, Shops, page theme, language, Bag and Enter 3D Mall. At 650 CSS pixels and below, the tabs, theme and language controls sit in a row that scrolls with the page. The header height also sets the root anchor offset. The 3D mall uses its own HUD.

The language picker offers English, 简体中文 and Bahasa Melayu. Dark is the default page theme and the selection is saved under `gjh-v11-color-scheme`. The arrivals theme also applies to the directory header. The "Check for updates" control below the arrivals board shows the release version and uses the existing update flow. The arrivals controls are covered by `check_v11_arrival_tools` in `tests/browser_gjh_demos.py`.


## In-mall menu

Tools opens the quick controls. The header hamburger opens Settings, and Help
and Quick Guide use the same modal. Back returns within the modal. Close and
Escape return to the scene and restore focus. The scene pauses while the menu
is open. The existing ground-floor minimap is scaled into the Menu thumbnail.
The Audio page and the Menu share the same master and bus controls.

Graphics reports the render scale and the detected display refresh rate. The
quality tier still controls shadows. In the scene, Q and E turn the camera.
When a nearby action is available, E or F activates it.

Run `node --test tests/gjh_v11_menu.test.mjs` for routing and graphics coverage.
The v11 section of `tests/browser_gjh_demos.py` exercises the modal in Chrome.
