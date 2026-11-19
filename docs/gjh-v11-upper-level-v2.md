# GJH v11 · Premium Open Atrium

The expanded mall’s upper landing at +7.2 m now overlooks a permanent 5.47 × 12 m lightwell. The lift can be upstairs while visitors look down into the ground court. The arrival view pairs a GJH mark with a directory, an upholstered lounge and four illuminated category windows. The opposite gallery is display architecture. The 17 operating shop destinations remain on the ground floor.

## What the iPhone capture showed

Research used the supplied current and concept images and worktree revision `0181ffd6`.

| Existing owner | Finding and design decision |
| --- | --- |
| `atrium-layout.js`, `seat-placements.js` | The original atrium layout described ground-floor planting and lounges. The upper deck had three seats and four planters. Its seat anchors, published exits and bench IDs also drive the player’s sit/stand interaction. The shared layout now identifies the two slatted seats and the upholstered sofa. |
| `public-architecture.js`, `world.js` | The north and west edges already had display bays. The east roof cut lacked a finished frontage. A Chrome raycast through the pale steps in the arrival view also hit the tops of ground-floor window studios. A continuous east fascia, balcony edge and glazed outer return bays now screen those surfaces. A louvred cap and cladding finish the service reservation seen below the east rail. All four fascia centres share world Y = 11.40 m. |
| `public-architecture.js`, `mall-atmosphere.js` | The glazed barrel used overlapping transparent boxes against a flat scene colour. Single glass sheets sit along the original ribs above a world-space gradient. LEDs use emissive geometry. Warm floor washes join the existing atmosphere batch, with opacity selected by tier. |
| `lift-layout.js`, `elevator-v2.js`, `player.js` | The 12 m square landing already had four outer guards, a 4 m square shaft, a moving floor and a west gate. Its dark green centre panel is the back of the cabin. Exterior decorative GLB bays duplicated three of the four outer guards. The glass and Rapier perimeter supplied by the lift are reused with instanced gold posts, rail caps and light channels. |
| `brand-wall.js`, `script.js` | The south story wall has correctly wound atlas faces and a 256 px atlas. On the first upper-level approach, the module loads, warms the plaque mesh and registers all 17 story interactions. The central mark uses the existing GJH loader artwork on the cabin rear and on the fixed screen behind it. |
| `graphics-quality.js`, `scene-warmup.js`, `model-warmup.js` | Phone Auto resolves to Low. The loader’s scene sweep traverses hidden deck meshes. The upper level also queues its exact meshes and textures with landing lighting at startup and graphics recovery. The physical cabin carries its decal through both stops. `__mall.performanceReport().warm.upperLevel` reports the preparation state. |

## Design and asset sources

The west landing looks across lightly tinted glass and champagne rails toward the opposite arcade. A rug, floor lamp and side table group the existing upholstered seat into a lounge. The directory faces arrivals and its arrows follow the four windows in world order. The directory, mall mark, shop graphics, rug and daylight gradient share one 256 × 256 atlas using the signage kit’s colours and half-texel UV inset.

The sofa and four areca planters reuse the mall’s Blender pilot assets. Three texture-free glTF 2.0 files are byte copies from the Blender-3D-Gallery handoff at `output/v11-handoff/interiors/static/`. The scene merges their original coloured geometry into one opaque batch. A second slatted seat uses simple boards at its existing interaction anchor.

| Gallery asset | Source triangles | SHA-256 |
| --- | ---: | --- |
| GJH_NEW_bench_oak | 1,198 | `064fb57f222a95e9327e2fa9ea9e111a2020dbcfc02590c6d6060a54e7570bd9` |
| GJH_NEW_lamp_floor | 1,498 | `5cb040bd1982017acc97b2d96cb80963516be67814c92cab49d816539c1581f2` |
| GJH_NEW_table_display | 997 | `30234aa8ff7d21761920ee1527f374076ded2ae2d296f6499edea2e2759d4ba9` |

The stock loader checks dimensions and hashes. Local Khronos validation returned zero errors and zero warnings for all three delivered files. Each furnishing has an in-loader geometry fallback.

## Collision and navigation

- The original landing spans X −9…3 and Z 4…16. The visitor capsule has radius 0.30 m, half-height 0.55 m and a 0.20 m autostep. Full-height, continuous cuboids stop the capsule between posts and at corners. Existing sofa and bench colliders remain selectable for sitting.
- The permanent lightwell opens beyond the east rail at X 3. The inclined side bridges and opposite balcony apron suggested a route from the landing, but their end rails kept them inaccessible. The current facade retains the illuminated category windows and display shelves across the lightwell. The landing rail follows the edge of the public floor.
- The lift shaft is a separate opening at X −5…−1 and Z 8…12. The cabin gate owns the only boarding passage, on the west at Z 9…11. Two short side returns protect the 0.40 m threshold. The docked threshold and cabin floor provide continuous support. The gate closes during travel and while the car is away.
- The floor finish clips to the real slab panels. Rugs, printed faces and LED strips have no walkable collision. The fixed directory, lamp base, side table and screen have small physical proxies. A 1.02 m aisle between the directory and south shaft guard connects both sides of the deck. The seat exits and west lift approach remain clear.


## Visitor access and reachability

The map offers **Upper level** and **Ground floor**. **Ride lift** uses the same boarding rules, moving cabin and exit as the landing action. The map shortcut brings a walking visitor to the lift approach on their current floor and calls the cabin if needed. Stow the cart in Bag or return or add the held product before riding. Selecting a ground-floor store or the restrooms from upstairs rides down before applying the ground-floor shortcut. A first-visit hint appears near the ground-floor lift. The upper-level objective completes after exiting the cabin and resets with the page session. Store objective hints appear on the ground floor.

| Source | Surface or point of interest | Access |
| --- | --- | --- |
| `lift-layout.js`, `elevator-v2.js` | Four upper slab panels around the shaft, including the west landing, north and south corridors, and east deck | Continuous level route from the lift exit at **(-6.4, 10)**. Glass guards protect the outer edges and shaft. |
| `lift-layout.js`, `elevator-v2.js` | West boarding threshold and cabin floor | The threshold and gate permit access while the cabin is docked. |
| `upper-level.js`, `atrium-layout.js` | Three lounge seats, directory, east lightwell viewpoint and south brand-story gallery | All three seat approaches, the directory front, the lightwell rail and all 17 brand plaques have a capsule route. |
| `upper-level.js` | Former north and south ramps, bridge ends and opposite balcony apron | The false walking surfaces and their guards were removed. The opposite category windows remain part of the facade. |
| `expanded-layout.js` | All 17 shop lots and their entrances | Ground floor. The upper gallery provides brand stories and views across the lightwell. |

The Node suite shares the shop audit's flood grid with the upper deck. It uses Rapier collider footprints, a .30 m walking capsule and .025 m controller clearance, then follows the continuous route with the Rapier character controller. The headed Chrome probe shares the route and reads the actual seat and plaque positions from the test hook.

```sh
python -m http.server 8830
GALLERY_CHROME="/Applications/Google Chrome.app/Contents/MacOS/Google Chrome" python docs/verify_upper_level.py
```

The probe uses a 390 × 844 touch viewport with `?test=1`. It taps Ride in the HUD and map, checks floor height and zone, visits the upper points via normal movement, and captures the lift, directory and viewpoint.

Chrome DevTools ran the itinerary at 390 × 844 with touch enabled and Low quality using a local file preview with bundled assets. All 39 walking stops passed, including the three lounge seats, 17 plaques, directory, and viewpoint. The run verified HUD and map round trips, automatic cabin calling, the cart block reason, and a ground-floor store shortcut from upstairs. The ground lift entry and Ride button were visible after trimming the planter. The local shell sandbox blocked HTTP server binding and Playwright's Chrome launch. The iPhone browser remains unverified.

## Phone budget

These are conservative submissions for all new batches with frustum culling ignored. Counts include instance multiplicity and the moving logo. The comparison gives no credit for deleting the old decorative GLB bays, the old roof boxes or replacing two upholstered seat instances. The existing plaque wall remains one draw. On the higher tiers, the table charges the entire shared wash draw even though that batch was already present in the mall.

| Tier | Draws | Triangles | New lights / shadow casters | Largest upper texture |
| --- | ---: | ---: | ---: | ---: |
| Low · limit 6 / 6,000 | 6 | 5,937 | 0 / 0 | 256 × 256 |
| Balanced | 7 | 5,967 | 0 / 0 | 256 × 256 |
| Detailed | 7 | 5,967 | 0 / 0 | 256 × 256 |

The six Low submissions are the opaque furniture and architecture, printed faces, instanced brass, emissive channels, glazing and cabin mark. Balanced and Detailed expose the existing additive floor washes with their shared 64 px texture. The upper scene uses the direct pass on all tiers.

## Verification

`tests/gjh_upper_level.test.mjs` parses the shipped models, builds the production meshes and checks draws, triangles, lights, shadows, atlas dimensions and return to Low. Real Rapier capsule sweeps cover the outer landing, both lightwell side galleries, shaft corners, gate and docked threshold. Downward rays verify the permanent lightwell stays open with the cabin at either stop. A camera ray verifies that the visible centre panel samples the mark’s atlas cell at both stops.

Before the lazy story wall was merged, Chrome DevTools ran the mall with the real loader, generated JavaScript, Rapier controller and GLBs in a 393 × 664 touch viewport at Low. The local review package supplied the worktree assets from memory because this environment denies HTTP socket binding. The capsule rode the lift to +7.2 m, reached the S01 story, sat and stood at the slatted bench and the lounge sofa, and stopped at the east rail with the cabin still upstairs. The visitor also crossed the directory aisle in both directions and rode back to the ground floor. The overview submitted 90 whole-scene draws. The upstairs bindings reported ready before the ride, and the instrumented asset loader recorded zero additional reads through arrival.

| West landing overview | East rail, cabin still docked upstairs |
| --- | --- |
| ![Upper landing, directory, central logo and illuminated shops](evidence/gjh-v11-upper-level-v2.webp) | ![View down through the permanent atrium to the ground floor](evidence/gjh-v11-upper-level-v2-lightwell.webp) |

The gallery generation check and 15 Python gallery tests passed. The Node suite passed 224 tests. One optional external SVG Studio checkout comparison was skipped. The repository’s HTTP browser gallery, GJH demo and PWA commands could not bind a loopback socket. Physical iPhone Safari frame pacing, driver memory and HTTP/PWA delivery remain unverified.
