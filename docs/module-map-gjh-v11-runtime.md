# GJH v11 Virtual Mall: runtime module map

Scanned from this checkout on 2026-11-19. Scope: `demos/corporate/gjh/v11/script.js`, `pwa.js`, and every authored JS module under `assets/` (104 top-level files, 12 in `assets/interiors/`, 10 in `assets/signage/`). The four `*.bundle.js` files and `pwa-sw.js` are generated and excluded. Paths are relative to `demos/corporate/gjh/v11/` unless stated; test paths are relative to the repo root.

Method: import edges were derived by regex over `import ... from`, `export ... from` and `import(...)` in every authored file. "Imported by" lists static plus dynamic importers; `*` marks dynamic-only. Responsibilities come from exports and call sites. Items not confirmed in code are marked NOT VERIFIED. Vendored Three.js, `GLTFLoader.js`, `BufferGeometryUtils.js` and `rapier.mjs` are omitted from the tables. "Test" lists `tests/gjh_*.test.mjs` first (those that import the module), then Python suites whose source names the module file; "none found" means no test file names it (it may be covered indirectly through `world.js` or `player.js`).

## 1. Architecture in one picture

```
index.html
 |- <script module> assets/loader.js --(dynamic)--> ../script.bundle.js   (generated from script.js)
 `- <script module> pwa.js --> mall-language.js, color-scheme.js, icons.js
script.js (entry, no exports)
 |- static (23): UI, HUD, modes, quality, warmup, movement, spatial, registry modules
 `- dynamic (in initialize): three, rapier, world, mall-themes (+3 seasonal packs), elevator-v2, player, npcs,
    dom-projection, target-guidance, shelf-focus, visitor-v2-product-ui, visitor-v2-controls
world.js  --> shell, public-architecture, amenities, furnishings, upper-level, expanded-interiors, interiors/runtime, shop-signs -> signage ...
player.js --> character --> character-v2 | character-tripo --> visitor-gltf, push-cart, seat-contact, visitor-v2-contact ...
```

Evidence: `index.html` lines 18-19 load `assets/loader.js` and `pwa.js`; `assets/loader.js:267` runs `import('../script.bundle.js')`. The loader's own comment says it is loaded independently so a failed startup import leaves the directory and retry controls usable. `data/gjh-startup-bundles.json` lists four generated bundles (`script.bundle.js`, `assets/world.bundle.js`, `assets/player.bundle.js`, `assets/character-v2.bundle.js`), so the browser runs the bundle, not authored `script.js` (see `tests/gjh_bundle_imports.test.mjs`).

## 2. Startup order

### 2.1 Page level

| Step | File | What happens |
|---|---|---|
| 1 | `index.html:16` | Inline script reads `gjh-v11-color-scheme` and sets `data-color-scheme` before paint. |
| 2 | `assets/loader.js` | Creates `window.mallLoader` (`createLoaderState`, `window.mallLoader = state` at line 151). Stages: `physics, scene, models, frame, warm` (line 5). Dynamic-imports the script bundle; owns retry, enter-now, directory dismiss, motion pause. |
| 3 | `pwa.js` | Imports `mall-language.js`, `color-scheme.js`, `icons.js`; registers `./pwa-sw.js`, runs version check and update UI (service worker code around line 142). |

### 2.2 `script.js` top level (synchronous, before WebGL)

Verified from lines 1-250 and 750-995:

1. Static imports; replace every `[data-icon]` slot with an SVG from `icons.js` (lines 25-37).
2. `expanded = ?layout !== 'classic'`; toggles `body.is-expanded` (line 38).
3. Create `createArrivalChime`, `createFixedClock`, `createGraphicsQuality`, `createModes`, `createUI(expanded)`, `storeDestinations`, `createMallHud`, `createPerformanceMonitor`, `createPerformancePanel`, `createSpatialHud`.
4. Define frozen `window.__mall` (line 256); keydown handler at line 645.
5. If `body.dataset.entryMode !== 'directory'`, call `initialize()` (line 972). Directory mode never downloads physics, models or WebGL.

### 2.3 `initialize()` (async, `script.js` about 766-990)

| # | Step | Module | Loader stage completed |
|---|---|---|---|
| 1 | Two `requestAnimationFrame` waits so the overlay paints | - | - |
| 2 | `getContext('webgl2')` (Android Chrome first tries `failIfMajorPerformanceCaveat`); no context -> `fallback()` | `graphics-quality.js` | - |
| 3 | Import three; `WebGLRenderer`, ACES tone mapping, PCFSoft shadows | vendor | - |
| 4 | Import Rapier, `R.init()` (failure -> `fallback()`); `new R.World({y:-24})`, `timestep = STEP` | vendor, `movement.js` | `physics` |
| 5 | `createModelWarmup`, `createTierQueue` | `model-warmup.js`, `scene-warmup.js` | - |
| 6 | `await createWorld(...)` | `world.js` | `scene` |
| 7 | `createMallAtmosphere`, `restoreEnvironment()` | `mall-atmosphere.js` | - |
| 8 | If expanded: theme coordinator with lazy seasonal packs (template-literal dynamic imports, lines 844-846) | `mall-themes.js` | - |
| 9 | Unless `?visitor=v1`: `createElevatorV2` | `elevator-v2.js` | - |
| 10 | `createPlayer` | `player.js` | - |
| 11 | NPC install (now if `player.npcSource`, else after first frame for the Tripo visitor) | `npcs.js` | - |
| 12 | `createDOMProjection`, `createTargetGuidance`, `createShelfFocus` | dynamic modules | - |
| 13 | `createInteractionRegistry(world.interactables, ...)` | `interaction-registry.js` | - |
| 14 | Optional `installPhysicalProductControl`, `installVisitorV2Controls` (each in try/catch) | `visitor-v2-*` | - |
| 15 | `ui.setElevator/setSeats/onCart/onCollect/onBagChange` wiring; `player.teleport('entry' or 'atrium')` | `ui.js` | `models` |
| 16 | Wait until the tab is visible, `await mallTheme.restore()`, `resize()`, 5 x `tick()`, `render(true)`; throws if zero draw calls | - | `frame`/`warm` are completed elsewhere (warm runner around `script.js:448-478`); exact `complete('frame')` call site NOT VERIFIED |
| 17 | `__sceneReady = true`, `ui.offerFirstGuide()`, `resume()`, `scheduleThemeMidnight()` | - | - |

`pagehide` (non-persisted) disposes elevator kit, chime, tier queue, warm runner, theme, NPCs, player, interiors and warmup (`script.js:989`). Context loss is handled by `validateRestoration()` (around line 740), which re-renders and pixel-checks before setting `ready`.

## 3. Modules by layer

### 3.1 Boot and startup

| Module | Responsibility | Main exports | Imported by | State | Test |
|---|---|---|---|---|---|
| `script.js` | Entry: render loop, fixed-step tick, HUD sync, context-loss recovery, quality scaling, theme and NPC wiring | none | `loader.js` (via bundle) | module-level `ready, player, world, physics, renderer, elevator, manual`, frame counters, `modes`, `ui`, `quality` | `gjh_bundle_imports`; `browser_gjh_v11.py`, `browser_gjh_hud_ownership.py` |
| `assets/loader.js` | Startup overlay, stage counter, retry, enter-now, directory dismiss | `loaderLabels, createLoaderState` | none (entry in `index.html`) | `window.mallLoader`: completed stage, hidden, contextLost, failed, dismissed; sessionStorage `gjh-v11-loader-motion-paused` | `gjh_loader`, `gjh_v11_header`, `gjh_scene_warmup`; `browser_gjh_pwa.py` |
| `pwa.js` | Install, update, offline notice UI, `version.json` check, SW registration | none | `index.html` | IIFE locals `registration, prompt, checking, applying, lastCheck` | `browser_gjh_pwa.py`, `browser_gjh_expanded_pwa.py` |
| `assets/color-scheme.js` | Light/dark toggle for the v11 page | none (side effect) | `pwa.js` | localStorage `gjh-v11-color-scheme` | none found |
| `assets/mall-language.js` | Language picker and DOM translation (en, zh-Hans, ms), 525 lines | none (side effect) | `pwa.js` | localStorage `wdg.language` | none found |
| `assets/mall-theme-copy.js` | Per-language copy for festival themes | `MALL_THEME_COPY` | `mall-language`, `ui` | constant | none found |
| `assets/startup-asset-pack.js` | Fetch GLBs from `startup-assets.pack`; release after use | `fetchStartupAsset, releaseStartupAssetPack` | `amenities, products, static-asset, world` | pack byte cache | `gjh_startup_pack`; `browser_gjh_startup_pack.py` |
| `assets/static-asset.js` | Load one static GLB from pack or network | `loadStaticAsset` | `furnishings, public-architecture, shell, upper-level` (and unused `deck-railings`) | none | `browser_gjh_runtime_assets.py` (NOT VERIFIED which module it names) |

### 3.2 World and layout

Layout modules are pure data/geometry helpers; builders import them, never the reverse.

| Module | Responsibility | Main exports | Imported by | State | Test |
|---|---|---|---|---|---|
| `assets/world.js` | Composition root of the 3D scene: shell, shops, products, signs, amenities, upper level, doors, seats, interactables, colliders (1332 lines) | `applyMallThemeToWorld, createWorld` | `script.js*` | scene graph, `doors, seats, interactables, shelves, cameraObstacles` | `gjh_mall_themes`, `gjh_lift_layout`; `test_gjh_newmoon_assets.py`, `browser_gjh_furniture_disposal.py` |
| `assets/spatial.js` | Classic-layout store rectangles, map projection, `storeAt` | `createSpatialRegistry, spatial, courtyardArrival, storeCenterX, storeAt, mapPoint, mapStoreRect, mapView` | script, expanded-layout, player, scene-warmup, seat-placements, store-destinations, ui, ux-spatial-hud, world | frozen registry | `gjh_spatial`, `gjh_ux_spatial` |
| `assets/expanded-layout.js` | 17-slot expanded plan: entrances, arrivals, map points | `expandedLayout, plannedSpaces, shopEntrance, expandedStoreArrival, expandedStoreAt, expandedMapPoint` | 10 files (script, player, ui, world ...) | frozen layout | `gjh_expanded_layout`; `browser_gjh_lift_map.py` |
| `assets/atrium-layout.js` | Atrium geometry constants | `atriumLayout` | 8 files incl. world, upper-level, festival packs | constants | `gjh_atrium_layout` |
| `assets/lift-layout.js` | Lift, void, showcase placement; rectangle cutting | `liftLayout, cutRectangle, showcaseProducts` | amenities, elevator-v2, expanded-layout, player, seat-placements, ui, upper-level, world | constants | `gjh_lift_layout`, `gjh_lift_themes` |
| `assets/restroom-layout.js` | Restroom parcels and `restroomAt` | `restroomParcel, restroomArrival, restroomRooms, restroomAt` | script, expanded-layout, lift-layout, restrooms, ui | constants | none found |
| `assets/restrooms.js` | Builds restroom rooms and doors | `buildRestrooms` | `world` | meshes | none found |
| `assets/shell.js`, `interior-shell-registry.js` | Shell GLBs and registry data | `createShell`; `SHELL_LAYOUT, INTERIOR_SHELL` | world; shell, world | loaded shell | `gjh_spatial`, `gjh_npcs`; `test_gjh_interior_shell.py`, `browser_gjh_interior_shell.py` |
| `assets/public-architecture.js` | Atrium and public-space meshes | `buildPublicArchitecture` | `world` | meshes | `gjh_arcade_wall_joint` |
| `assets/upper-level.js`, `upper-level-atlas.js` | Upper deck: planters, void, thresholds, painted atlas | `loadUpperLevel, buildUpperLevel, deckPlanters, galleryVoid, thresholdReturns`; `paintUpperAtlas, atlasPx, categories, cells` | world; upper-level | `world.upperWarmStatus` | `gjh_upper_level`; `browser_gjh_expanded_lift.py` |
| `assets/window-studios.js` | Per-shop window/display studios | `buildWindowStudio, shopIslandZ, pzhCartonX, pzhCartonStandingZ, shopLamp` | expanded-interiors, shop-anchor-details-last, world | none | `gjh_arcade_wall_joint` |
| `assets/expanded-storefronts.js`, `expanded-interiors.js` | Storefront facades; enterable-interior composition | `addExpandedStorefronts`; `createExpandedInteriors` | world | meshes | `gjh_interiors` (interiors) |
| `assets/gallery-east-shops.js`, `gallery-west-shops.js` | Shop placement tables | `eastShopPlacements`, `westShopPlacements` | expanded-interiors, shop-signs | constants | `browser_gjh_model_preload.py` |
| `assets/shop-anchor-details-first.js`, `-last.js` | Original-shop and late-anchor detail props | `addOriginalShopDetails`; `buildLateShopAnchorDetails` | world; expanded-interiors | meshes | `gjh_interiors_layout` (first) |
| `assets/borsch-exhibit.js`, `gogo-exhibit.js`, `mili-exhibit.js`, `pzh-exhibit.js`, `new-moon-exhibit.js` | Brand story data per shop | `borschExhibit, gogoExhibit, miliExhibit, pzhExhibit, newMoonExhibit, heritagePanel` | `world` | constants | none found |
| `assets/feature-kiosk.js` | Feature kiosk record and mesh | `FEATURE_KIOSK_ID, FEATURE_KIOSK_RECORD, addFeatureKiosk` | ui, world | none | `test_gjh_kiosk.py`, `browser_gjh_kiosk.py` |
| `assets/amenities.js` | Directory kiosks, benches, showcase products | `AMENITIES, SHOWCASE_PRODUCTS, addAmenities` | `world` | none | `gjh_lift_layout`; `browser_gjh_amenities.py` |
| `assets/furnishings.js`, `interior-pilot-registry.js`, `interior-additions-registry.js` | Bench/planter props and their data registries | `simplifyBench, createFurnishings`; `INTERIOR_PILOT`; `INTERIOR_ADDITIONS` | world; furnishings, products, seat-placements; furnishings | per-asset `status` records | `gjh_interior_additions`, `gjh_packed_render`; `test_gjh_furnishings.py`, `test_gjh_interior_pilot.py` |
| `assets/interiors/*` (12 files) | Enterable-shop kit: `config` (tiers, routes), `layout`, `action-layout`, `baked-layout`, `cabinet-layout`, `detail-files`, `models`, `decoration`, `surfaces`, `mili-seats`, `warmup`, `runtime` | `createInteriorKit, interiorTiers, interiorStores, layouts, miliSeats, registerInteriorWarmup ...` | `runtime` -> world; `config` -> 7 files | loaded models, kit report | `gjh_interiors`, `gjh_interiors_layout`, `gjh_seat_placements`; `browser_gjh_interior_visibility.py` |
| `assets/signage/*` (10 files) | Shop-sign system: `config, presets, tokens, atlas-layout, atlas` (progressive baking), `builder, hardware, models, phone-proof, runtime` | `createSignageSystem, bakeAtlas, createProgressiveAtlas, createShopSign ...` | `shop-signs` -> world; `builder` also by upper-level | atlas textures, sign LOD | `gjh_signage`, `gjh_signage_models` |
| `assets/shop-signs.js`, `shop-sign-vendor.js` | Wire signage into shops; re-export vendor `mergeGeometries`, `GLTFLoader` | `addShopSignAtlas`; `mergeGeometries, GLTFLoader` | world; interiors and signage | none | `gjh_signage` |
| `assets/shop-visibility.js` | Per-shop show/hide | `createShopVisibility` | `world` | visibility flags | `gjh_packed_render` |
| `assets/doorway-occupancy.js` | Whether a body stands in a doorway | `createDoorwayOccupancy` | restrooms, world | occupancy flag | `gjh_movement` |
| `assets/brand-wall.js` | Brand wall atlas, started lazily on first upper-level visit (`script.js` about line 300) | `addBrandWallAtlas` | `world*` | atlas | `gjh_artwork_textures`, `gjh_upper_level` |

### 3.3 Player, camera, physics

| Module | Responsibility | Main exports | Imported by | State | Test |
|---|---|---|---|---|---|
| `assets/player.js` | Rapier capsule, input, chase/first-person camera, sit/stand, cart, collection, elevator ride (677 lines) | `playerCameraFraming, createPlayer` | `script.js*` | body, capsule, camera, input, `state` (seated, cart, elevatorTravel); localStorage `gjh.v11.fullscreenJoystick` | `gjh_movement`, `gjh_camera_controller`, `gjh_tripo_visitor`; `browser_gjh_camera.py` |
| `assets/camera-controller.js` | Pitch/zoom clamps, obstacle sweep, floor limit | `createCameraController, clampCameraPitch, sweepCameraClearance, firstPersonFov ...` | `player` | sessionStorage `gjh.v11.cameraZoom` | `gjh_camera_controller`; `browser_gjh_camera_pitch.py` |
| `assets/movement.js` | Fixed-step clock, velocity integration, stick curve | `FIXED_STEP, MOVEMENT, stickStrength, advanceVelocity, createFixedClock, interpolate, interpolateAngle` | script, player | clock accumulator | `gjh_movement` |
| `assets/elevator-ride.js` | Ride timing curves | `rideTime, easedInterval, sampleRide` | `player` | none | `gjh_elevator_kit` |
| `assets/auto-door.js` | Door-open predicate | `shouldOpenStoreDoor` | `script` | none | `gjh_auto_door`; `browser_gjh_auto_doors.py` |
| `assets/frame-trace.js` | Opt-in `?traceWarm=1` frame trace | `createFrameTrace` | `script` | trace buffer | none found |

### 3.4 Character and visitor

| Module | Responsibility | Main exports | Imported by | State | Test |
|---|---|---|---|---|---|
| `assets/character.js` | Visitor factory choosing v1, v2 or Tripo; locomotion continuity | `createLocomotionContinuity, createSelectedVisitor, createCharacter` | `player` | model id, `cart`, `collection`, `physicalProduct` | `gjh_tripo_visitor`, `gjh_npc_tripo`; `test_gjh_character.py`, `browser_gjh_character.py` |
| `assets/character-v2.js` | Visitor v2 rig | `createCharacterV2` | `character*` | rig, LOD | `gjh_tripo_visitor`, `gjh_visitor_shoes`; `browser_gjh_visitor_v2.py` |
| `assets/character-tripo.js`, `character-tripo-pose.js` | Tripo visitor and poses | `createCharacterTripo, normalizeTripoHeight, mapTripoClips`; `createTripoPoses` | character*; character-tripo | clips | `gjh_tripo_visitor`, `gjh_npc_tripo` |
| `assets/visitor-gltf.js` | GLB load and dispose helper | `disposeVisitorScene, loadVisitorGLTF` | character-tripo, crowd, npc-tripo, npcs, visitor-carry-hand, visitor-v2-lod | none | `gjh_npc_tripo` |
| `assets/visitor-v2-lod.js` | Visitor LOD switching | `createVisitorLOD` | character-v2, character-tripo | active LOD | `gjh_visitor_lod_preload` |
| `assets/visitor-v2-customization.js` | Skin and outfit options | `createVisitorCustomization` | character-v2, npcs | options | `gjh_visitor_shoes` |
| `assets/visitor-v2-controls.js` | Settings-panel appearance controls | `readVisitorAppearance, saveVisitorAppearance, installVisitorV2Controls` | `script*` | localStorage `gjh-v11-visitor-appearance` | `gjh_visitor_shoes` |
| `assets/visitor-v2-contact.js` | Contact solver, shelf reach, product transfer | `createContactSolver, isShelfInReach, createProductTransfer` | character-v2, character-tripo, player, seat-contact, visitor-v2-product-ui | contact state | `gjh_held_product` |
| `assets/visitor-v2-product-ui.js` | Held-product pickup/put-back buttons | `installPhysicalProductControl` | `script*` | button DOM | `gjh_held_product` |
| `assets/visitor-carry-hand.js`, `carry-bag.js`, `collection-gesture.js`, `seated-pose.js`, `seat-contact.js` | First-person hand; carried bag; collect gesture; procedural seated pose; seat contact | `createFirstPersonHand, createCarryBag, createCollectionGesture, createSeatedPose, createSeatContact` | character-v2/-tripo; character*; character*; character*; character, -v2, -tripo | gesture and pose state | `browser_gjh_carry_bag.py`, `browser_gjh_collect.py`, `browser_gjh_seat.py` (filename match for carry-bag, collection-gesture, seated-pose only; others NOT VERIFIED) |
| `assets/push-cart.js` | Demo push cart mesh and pose | `createPushCart` | character, character-v2, character-tripo | cart mesh | `browser_gjh_cart.py` (NOT VERIFIED by name) |

### 3.5 NPC crowd

| Module | Responsibility | Main exports | Imported by | State | Test |
|---|---|---|---|---|---|
| `assets/npcs.js` | Admission limits, routes, rig cloning, instancing, lifecycle (685 lines) | `NPC_ROUTES, npcLimit, nextNpcAdmission, cloneNpcRig, loadNpcSystem, createNpcSystem` | `script*` | NPC bodies, instance pools, `dispose()` | `gjh_npcs`, `gjh_npc_compact`, `gjh_npc_continuity`; `browser_gjh_npc_instance_continuity.py`, `browser_gjh_npc_facing.py`, `browser_gjh_npc_render_continuity.py` |
| `assets/crowd.js`, `crowd-rig.js` | Modular wardrobe driven by `chibi-crowd/manifest.json`; skinned-part retargeting | `validateManifest, loadModularLooks`; `skinnedParts, retargetCrowdClips, fitCrowdPart` | `npcs*`; crowd | looks cache | `gjh_npc_tripo` |
| `assets/npc-tripo.js` | Tripo boy NPC loader | `tripoNpcClips, loadTripoNpc` | `npcs` | clips | `gjh_npc_tripo` |

### 3.6 Interaction, seats, doors, elevator

| Module | Responsibility | Main exports | Imported by | State | Test |
|---|---|---|---|---|---|
| `assets/interaction-registry.js` | Nearest-target selection over `world.interactables`; subscriptions | `createInteractionRegistry` | `script` | targets, subscribers | `gjh_interaction_registry`, `gjh_ux_spatial`, `gjh_ux_tutorial`, `gjh_held_product` |
| `assets/seat-placements.js` | Bench/seat anchors and front test | `benchScale, groundBenchFallback, deckBenchFallback, createSeatPlacements, createSeatAnchor, isInFrontOfSeat` | interaction-registry, player, shop-anchor-details-first, world | seat list | `gjh_seat_placements`; `browser_gjh_all_seats.py`, `browser_gjh_seat*.py` |
| `assets/elevator-v2.js`, `elevator-kit.js` | Lift car and kit assembly from `assets/elevator/{low,balanced,detailed}.glb`; theme-aware | `createElevatorV2`; `assembleElevatorKit, createKitLoader` | `script*`; elevator-v2 | kit, colliders, `interactables` | `gjh_elevator_kit`, `gjh_lift_themes`; `browser_gjh_lift.py`, `browser_gjh_lift_interruptions.py` |
| `assets/audio.js` | [Procedural audio and narration](gjh-v11-audio.md) | `mallAudio`, `createAudioManager`, `createTramNarration` | entry, world, player, shop feedback, demo bag, lift and tram | audio mixer, voice pool and preferences | `gjh_audio` |
| `assets/target-guidance.js`, `dom-projection.js` | On-screen target pointer; world-to-screen projection | `createTargetGuidance`; `createDOMProjection` | `script*` | DOM node | `browser_gjh_target_guidance.py` (NOT VERIFIED which module) |
| `assets/shelf-focus.js` | Shelf close-up camera with details/add actions | `createShelfFocus` | `script*` | `open` flag, saved camera | `browser_gjh_shelf_focus.py` (NOT VERIFIED by name) |

### 3.7 Products, bag, cart

| Module | Responsibility | Main exports | Imported by | State | Test |
|---|---|---|---|---|---|
| `assets/products.js` | New Moon can shelves/cabinets and pack loading | `NEW_MOON_CANS, addProducts` | `world*`, `newmoon-detail-preview*` | `productAssets` status | `gjh_tripo_visitor`, `gjh_interiors_layout`; `test_gjh_newmoon_assets.py` |
| `assets/product-display-lod.js` | Can display LODs and instancing | `createProductDisplayLod, makeCanLods, canDetail, createCanDisplay` | products | LOD batches | `gjh_product_display_lod`, `gjh_packed_render` |
| `assets/demo-bag.js` | Demo bag store and dialog; no payment | `createBagStore, setupDemoBag` | loader, ui | sessionStorage `gjh-v11-demo-bag-v1` | `gjh_held_product`; `browser_gjh_bag.py` (NOT VERIFIED by name) |
| `assets/newmoon-detail-preview.js` | 3D product preview inside the dialog | `setupNewMoonPreview` | `ui` | own renderer | `browser_gjh_newmoon_detail.py` (NOT VERIFIED by name) |
| `assets/original-tin.js` | Original-tin viewer dialog | `setupOriginalTin` | `script` | own renderer | `browser_gjh_original_tin.py` (NOT VERIFIED by name) |
| `assets/store-destinations.js` | Store list for HUD and map | `storeDestinations` | script, performance-panel, ui, ux-spatial-hud | none | `browser_gjh_store_integration.py` (NOT VERIFIED by name) |

### 3.8 UI, HUD, modes, tutorial, map

| Module | Responsibility | Main exports | Imported by | State | Test |
|---|---|---|---|---|---|
| `assets/ui.js` | DOM UI: panels, map, directory, dialogs, bag, seats, theme dialog, guide (1040 lines) | `reducedMotion, createUI` | `script` | panel flags; reads localStorage `ob:gjh-v11:preferences:v1` (line 126) | `gjh_v11_hud_layout`; `browser_gjh_accessibility.py`, `browser_gjh_panel_input.py`, `browser_gjh_modes.py` |
| `assets/modes.js` | Layered mode stack: explore/seated/cart plus overlays menu, inspect, shop, shelf | `deriveMode, createModes` | `script` | `layers`, `illegalCount` | `gjh_modes`; `browser_gjh_modes.py` |
| `assets/hud-coordinator.js` | Context queue, objective tracker, nearby store, HUD facade | `createContextQueue, createObjectiveTracker, nearbyStore, createMallHud` | `script` | queue, objective | `gjh_v11_hud`, `gjh_held_product`; `browser_gjh_hud_ownership.py` |
| `assets/ux-spatial-hud.js` | Zone/location label | `createSpatialHud` | `script` | label state | `gjh_ux_spatial`; `browser_gjh_location_hud.py` |
| `assets/ux-tutorial.js` | First-use guide state | `tutorialStorageKey, createTutorialState, createTutorial` | `ui` | localStorage `gjh-v11-tutorial-v1` | `gjh_ux_tutorial`; `browser_gjh_onboarding.py` |
| `assets/context-navigation.js` | Prev/next footer in dialogs | `createContextNavigation` | `ui` | none | `browser_gjh_context_navigation.py` |
| `assets/icons.js` | SVG icon registry | `registry, icon` | script, pwa, demo-bag, hud-coordinator, loader, signage/atlas, ui | `registry` | `gjh_v11_icons` |
| Shared, outside v11: `assets/onboarding/gamepad.js`, `action-dialog.js` | Gamepad read; action dialog | `readStandardGamepad, gamepadMotion`; `createActionDialog` | script; ui | - | see `docs/3d-onboarding-components.md` |

### 3.9 Themes, lighting, quality

| Module | Responsibility | Main exports | Imported by | State | Test |
|---|---|---|---|---|---|
| `assets/mall-themes.js` | Theme definitions and coordinator (prepare, commit, suspend, restore) | `THEME_STORAGE_KEY, EVERYDAY, LUNAR_NEW_YEAR, CHRISTMAS, DEEPAVALI, MALL_THEMES, createMallThemeCoordinator` | `script*` | localStorage `gjh-v11-mall-theme-v1` | `gjh_mall_themes`, `gjh_lift_themes`; `browser_gjh_mall_theme.py`, `browser_gjh_automatic_theme.py` |
| `assets/festival-calendar.js` | Auto theme from the date (Intl lunar) | `LUNAR_NEW_YEAR_DATES, lunarNewYearFromIntl, FESTIVAL_CALENDAR, resolveAutoTheme` | `mall-themes` | none | `gjh_festival_calendar` |
| `assets/lunar-new-year.js`, `christmas.js`, `deepavali.js` | Lazy seasonal decor packs | `prepareLunarDecor, prepareChristmasDecor, prepareDeepavaliDecor` (plus `*_DECOR_LAYOUT`) | `script.js` (template-literal `import()`) | stage group with `dispose()` | `gjh_mall_themes`; `browser_gjh_lunar_theme.py`, `browser_gjh_christmas_theme.py`, `browser_gjh_deepavali_theme.py` |
| `assets/mall-atmosphere.js` | Lights, environment map, light wash, visitor shadows, theme apply | `allowMallLightWash, createMallSurfaceAtmosphere, mallEnvironmentZone, createMallAtmosphere, createVisitorShadows` | script, world | env and light state | `gjh_atmosphere`, `gjh_atmosphere_budget`; `browser_gjh_shadow_budget.py` |
| `assets/graphics-quality.js` | Device class, quality tier, adaptive resolution, render cadence | `QUALITY_KEY, RESOLUTION_KEY, MALL_FRAME_BUDGETS, resolveQuality, createAdaptiveQuality, createRenderCadence, createGraphicsQuality ...` | `script` | localStorage `gjh-v11-graphics-quality-v1`, `gjh-v11-auto-resolution-v1` | `gjh_graphics_quality`, `gjh_atmosphere_budget`; `browser_gjh_graphics_recovery.py`, `browser_gjh_quality_preload.py` |
| `assets/performance-monitor.js`, `performance-panel.js` | Frame statistics; FPS panel | `createPerformanceMonitor`; `createPerformancePanel` | script | localStorage `gjh-v11-show-fps` (panel) | `gjh_performance_monitor`; `browser_gjh_stage11_performance.py` |
| `assets/natural-materials.js`, `artwork-textures.js`, `surface-decals.js` | Procedural surface textures; artwork texture tiers; decal offsets and placement | `createNaturalSurfaceTextures`; `setupArtworkTexture, setArtworkTextureTier ...`; `placeDecal, decalMaterial ...` | world*; 12 files; 13 files | tier flag | `gjh_natural_materials`, `gjh_artwork_textures`; `browser_gjh_materials.py` |

### 3.10 Loaders, asset packs, preload, upload scheduling, draw batching

| Module | Responsibility | Main exports | Imported by | State | Test |
|---|---|---|---|---|---|
| `assets/model-warmup.js` | GPU upload scheduler and model warm-up | `createUploadScheduler, meshTextures, limitWarmGeometry, createModelWarmup` | script, interiors/warmup, scene-warmup | pending-upload queue, `report()` | `gjh_model_warmup`, `gjh_upload_scheduler` |
| `assets/scene-warmup.js` | Tier queue, probe poses, entry-frame prep, warm runner (492 lines) | `createWarmReport, prepareEntryFrame, createTierQueue, prepareTier, createWarmRunner, mallProbePoses, prepareScene` | `script` | warm report | `gjh_scene_warmup`; `browser_gjh_final_incremental.py` |
| `assets/interiors/warmup.js` | Interior warm-up registration | `emptyInteriorReport, registerInteriorWarmup` | script, interiors/runtime, scene-warmup | interior report | `gjh_interiors` |
| `assets/packed-draw.js`, `opaque-batch.js`, `merge-static-geometries.js` | Draw-call reduction: merging, instance visibility, glass and projected batches | `createPackedDraw, mergeOpaqueMeshes, createInstanceVisibility ...`; `opaqueBatch`; `mergeStaticGeometries` | 8, 5 and 3 files respectively | batch meshes | `gjh_packed_render` |

### 3.11 PWA

| Module | Responsibility | Test |
|---|---|---|
| `pwa.js` | v11 offline-fallback UI and update flow (sections 2.1, 3.1) | `browser_gjh_pwa.py`, `browser_gjh_expanded_pwa.py` |
| `pwa-sw.js` (generated, not read) | Scoped worker; per `FEATURES_MAP.md` it precaches a small shell and lazily caches verified NPC wardrobe GLBs | same suites |

## 4. Import and dependency overview

- **Direction:** `script.js` -> (`ui`, `world`, `player`, `npcs`, HUD, quality, warmup) -> domain builders -> leaf data and geometry helpers.
- **Cycles:** a depth-first search over all static and dynamic local edges found 0 cycles.
- **Leaves (no authored imports):** `atrium-layout, spatial, movement, modes, camera-controller, elevator-ride, auto-door, artwork-textures, surface-decals, interior-*-registry, *-exhibit, restroom-layout, icons, shop-visibility, doorway-occupancy, visitor-v2-contact, visitor-v2-customization, interiors/layout, interiors/cabinet-layout, signage/atlas-layout`.
- **Hubs by fan-in:** `surface-decals` (13 importers), `artwork-textures` (12), `expanded-layout` (10), `spatial` (9), `packed-draw` (8), `lift-layout` (8), `atrium-layout` (8), `interiors/config` (7), `icons` (7).
- **Hubs by fan-out:** `world.js` imports about 35 local modules; `script.js` has 23 static imports (counting the shared gamepad module) plus 12 dynamic imports and 3 template-literal seasonal imports.
- **Lazy (dynamic-only) edges:** `script -> world, mall-themes, elevator-v2, player, npcs, dom-projection, target-guidance, shelf-focus, visitor-v2-product-ui, visitor-v2-controls, lunar-new-year, christmas, deepavali`; `character -> character-tripo, character-v2, push-cart, seated-pose, collection-gesture, carry-bag`; `npcs -> crowd`; `world -> natural-materials, products, brand-wall`; `interiors/config -> action-layout`; `newmoon-detail-preview -> products`; `loader -> ../script.bundle.js`.
- **Layering observed:** layout modules never import builders; `player` imports `character` and layout but not `ui` or `world`; `ui` imports layout and `store-destinations` but not `world` or `player`. `ui`, `world` and `player` are connected only through `script.js` callbacks (for example `ui.setSeats(world.seats)`, `ui.onCart(...)`, `ui.setElevator(...)`).
- **Cross-folder imports:** `script.js` and `ui.js` import `assets/onboarding/gamepad.js` and `action-dialog.js` from the repo-level shared folder.

## 5. `window.*` debug and test surface

| Name | Defined in | Notes |
|---|---|---|
| `window.__mall` (frozen, non-writable) | `script.js:256` | `performanceReport()`, `movementSample()`, `emote(name)`, `ready` (getter), `state` (getter -> `snapshot()`: doors, drawCalls, renderTriangles, rendererResources, frames, roomSigns, pixelRatio, hidden and more), `mode` (getter), `camera` (getter), `heroVisibility(n)`, `teleport(zone)`, `setInput({forward,right,run,yaw,pitch} or null)`, `step(ms)` (max 600 ticks; sets manual mode). Mutators are no-ops until `ready`. |
| `window.mallLoader` | `assets/loader.js:151` | `snapshot(), skipSignal, ready, complete(stage, skipFade), enterNow(), prepare(msg), visibility(v), context(v), fail(msg), dismiss()`. |
| `window.__sceneReady`, `window.__sceneFailed` | `script.js` (lines 407, 633, 766, 984) | Set on first frame, fallback and graphics restore. |
| Query flags | `script.js` | `?layout=classic`, `?npcs=off`, `?visitor=v1`, `?debugShaders=1`, `?traceWarm=1`. |

Per-test usage of `__mall` is concentrated in `tests/browser_gjh_*.py`; individual suites were not read in depth.

## 6. Storage keys (verified by grep)

| Key | Store | Owner |
|---|---|---|
| `gjh-v11-color-scheme` | localStorage | `assets/color-scheme.js`; early read in `index.html:16` |
| `wdg.language` | localStorage | `assets/mall-language.js` (shared with the gallery) |
| `gjh-v11-graphics-quality-v1`, `gjh-v11-auto-resolution-v1` | localStorage | `assets/graphics-quality.js` |
| `gjh-v11-mall-theme-v1` | localStorage | `assets/mall-themes.js` |
| `gjh-v11-tutorial-v1` | localStorage | `assets/ux-tutorial.js` |
| `gjh-v11-visitor-appearance` | localStorage | `assets/visitor-v2-controls.js` |
| `gjh-v11-show-fps` | localStorage | `assets/performance-panel.js` |
| `gjh.v11.fullscreenJoystick` | localStorage | `assets/player.js:173` |
| `ob:gjh-v11:preferences:v1` | localStorage | read in `assets/ui.js:126`; key pattern `ob:<storageKey>:preferences:v1` is built in `assets/onboarding/onboarding.js:24` |
| `gjh-v11-demo-bag-v1` | sessionStorage | `assets/demo-bag.js` |
| `gjh-v11-loader-motion-paused` | sessionStorage | `assets/loader.js` |
| `gjh.v11.cameraZoom` | sessionStorage | `assets/camera-controller.js:75` |

Each storage read/write seen in the files above is wrapped in `try/catch` with an in-memory fallback.

## 7. Non-JS descriptors

| File | Used for |
|---|---|
| `assets/chibi-crowd/manifest.json` | NPC wardrobe list with provenance and hashes; validated by `crowd.js` `validateManifest` |
| `assets/brand-kit/brand-kit.json` | Per-slot (S01-S17) brand, hero product, story, evidence level; read by `tests/gjh_artwork_textures.test.mjs` and `gjh_expanded_layout.test.mjs`; runtime importer NOT VERIFIED (no JS import found) |
| `assets/signage/manifest.json` | Signage module list; imported by `signage/models.js`, `hardware.js`, `tokens.js` |
| `assets/interiors/manifest.json`, `interior-pilot.json`, `interior-shell.json` | Interior GLB manifest and registries; relation to the generated `*-registry.js` files NOT VERIFIED |
| `assets/*-source.json`, `sources.json`, `character-sources.json` | Provenance and hashes; build-time, no runtime importer found |
| `assets/startup-assets.pack` | Binary pack read by `startup-asset-pack.js` |

## 8. Dead, unused and special-case modules

| Module | Evidence | Verdict |
|---|---|---|
| `assets/deck-railings.js` (`createDeckRailings`) | `grep -rl deck-railings` over `demos/corporate/gjh/v11`, `scripts`, `tests`, `data`, `src` matches only `README.md` and the file itself is the only place naming `createDeckRailings`; no importer in the edge list; no test; not listed in `data/gjh-startup-bundles.json` (0 matches) | **Unused**: no importer, no test, not bundled |
| `assets/christmas.js`, `deepavali.js`, `lunar-new-year.js` | No static importer, but loaded by template-literal `import()` at `script.js:844-846` and tested in `gjh_mall_themes` | **Not dead** (a plain import grep gives a false positive) |
| `assets/loader.js`, `color-scheme.js`, `mall-language.js` | No importer inside `assets/`; loaded from `index.html` or `pwa.js` | **Not dead** (entry or side-effect modules) |

No other authored JS file lacks an importer once these entry and dynamic cases are accounted for.

## 9. Test coverage gaps

No `tests/gjh_*.test.mjs` imports these: `script.js`, `pwa.js`, `ui.js`, `restroom-layout`, `restrooms`, the five `*-exhibit` files, `feature-kiosk`, `frame-trace`, `color-scheme`, `mall-language`, `mall-theme-copy`, `store-destinations`, `target-guidance`, `dom-projection`, `shelf-focus`, `context-navigation`, `newmoon-detail-preview`, `original-tin`, `push-cart`, `carry-bag`, `collection-gesture`, `seated-pose`, `seat-contact`, `deck-railings`. Some have Python browser coverage (section 3). Per `FEATURES_MAP.md`, browser suites are not part of CI.

## 10. Refreshing this document

The edge list and export counts came from a throwaway regex scan of `script.js`, `pwa.js` and `assets/**/*.js` excluding `*.bundle.js`. After adding or removing a module, rerun an equivalent scan and recheck `ls assets/*.js assets/*/*.js` before editing the counts above.
