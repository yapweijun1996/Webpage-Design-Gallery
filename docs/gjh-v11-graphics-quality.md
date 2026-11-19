# GJH v11 graphics quality

## Render cadence and resolution

Phones render at up to 30 FPS, drawing every second refresh at 60 Hz, every third at 90 Hz, and every fourth at 120 Hz. Tablets and desktops draw at native refresh below 100 Hz. At 100 Hz and above, they use an integer divisor near the nominal 60 FPS target, yielding 60 FPS at 120 Hz and 72 FPS at 144 Hz. The app estimates the refresh rate from the median of 120 animation callback intervals after entry. Physics consumes 60 Hz fixed steps on animation callbacks, including those that skip drawing. Device classification combines mobile browser identifiers, iPadOS touch and platform hints, and coarse touch input with the shorter viewport dimension.

Auto starts at Balanced on phones and on viewports narrower than 1000 CSS pixels, and at Detailed on wider tablets and desktops. A reported CPU or memory hint of 2 or less starts Auto at Low. Phone DPR caps are 1.5, or 1.25 when the browser reports at most 4 GB of RAM, at most four logical cores, or Android Chrome lacks a WebGL2 context that accepts the high-performance preference without a major performance caveat. Low caps DPR at 1, disables real-time shadows and glow, and admits up to two ambient visitors on desktop and one on mobile.

**Auto resolution** is enabled by default in Tools. It lowers the drawing-buffer scale in 5-percentage-point steps from 100% to 60%. The rolling window uses the 80th percentile and the rate of missed render slots. A scale increase requires 10 seconds of headroom at the target cadence with spare CPU submission time. A failed increase lengthens the next recovery wait. Once at 60%, five seconds of sustained overload can lower an Auto tier by one step. Auto tiers can only move downward within a page session. A manual tier selection locks that tier and keeps Auto resolution available. Turning Auto resolution off restores 100% scale and suspends automatic tier changes. Both explicit settings are saved locally.

The controller skips entry's first three seconds, asset warm-up, hidden or unfocused time, and lift rides. It clears its sample window and settles after view or zone transitions, teleports, and resizes. Scale applies to the full-resolution base and composite output and their quarter-resolution glow targets. Each pass retains its MSAA settings. The camera, HUD and pointer coordinates use the canvas's CSS size. The performance report and JSON export include `renderScale`, the effective `targetFps`, measured `refreshHz`, `deviceClass` and the number of completed automatic `tierDowngrades`. `refreshHz` is `null` until the sample window fills. The history also records the scale used for each frame.

In the expanded mall, loaded shelves and stock use compacted submissions with current bounds. The 18 m range applies to the loaded shelf fixtures, shelf stock and hero can. Showcase cans remain eligible whenever their bounds intersect the view. Authored slot indices own pickup and reservation.

The expanded mall uses frame budgets of 220,000 triangles and 70 draws on Low, 300,000 and 90 on Balanced, and 420,000 and 110 on Detailed. Ambient visitor admission uses the remaining budget after the world and post-processing passes. An opaque shop wall can reject a render bound only when it covers every sightline to that bound. Partial views through the glazing remain eligible. Physics uses the authored room and door geometry.

Detailed uses the same selective glow radius with a quarter-resolution filter and a full-resolution composite. The expanded mall uses a 768 × 768 shadow map. Product shadow casters are selected using bounds that include their projected reach. Distant furnishings use reduced geometry when the estimated displacement, including the projected shadow, is subpixel.

## Historical triangle breakdown

Before compaction applied to all tiers, the figures below were CPU-side estimates of submitted geometry, using the actual expanded scene, vendored Three.js geometry and real Rapier collision queries in Node. The probe loaded all 14 secondary shop groups and all four pinned can GLBs, stubbed image decoding and 2D canvas drawing, and used the deployed player controller's `teleport('entry')` and `teleport('atrium')` poses. The 1440 × 900 viewport was modeled with a 1440 × 844 scene canvas. The probe applied the camera frustum, visible ancestors, render layers, draw ranges, instance counts and double-sided transparent passes. The illustrative NPC sample used 45 fixed ticks, with the same available draw budget in each tier.

| Submitted triangles | Entry Balanced | Entry Low | Atrium Balanced | Atrium Low |
| --- | ---: | ---: | ---: | ---: |
| New Moon display cans | 636,196 | 12,176 | 636,196 | 0 |
| New Moon shelf fixtures | 12,528 | 0 | 12,528 | 0 |
| Public and architecture instance batches | 125,032 | 125,032 | 122,076 | 122,076 |
| Expanded shop interiors and window studios | 165,006 | 165,006 | 31,856 | 31,856 |
| Blender furnishings | 22,560 | 22,560 | 22,560 | 22,560 |
| Other public fixtures, doors and signs | 35,276 | 35,276 | 18,326 | 18,326 |
| Player | 11,764 | 11,764 | 11,764 | 11,764 |
| Ambient NPCs | 30,017 | 18,165 | 30,257 | 6,313 |
| **Total** | **1,038,379** | **389,979** | **885,563** | **212,895** |
| **Estimated draw calls** | **111** | **104** | **82** | **59** |

The 209 loaded can instances comprise 204 shelf facings, four showcase cans and one hero can. At 3,044 triangles per can they account for 636,196 triangles in each Balanced sample. Scaling the out-of-range instances to zero still submits their geometry when a batch is in the frustum. Low removes those submissions. The four showcase cans contribute 12,176 triangles at entry and sit outside the tighter batch frustum at the atrium. The shelf fixtures add another 12,528 triangles that Low can skip at both positions. The probe observed the same Balanced totals after switching back from Low at each position.

The historical modeled reductions from Balanced to Low were **62.44% at entry** and **75.96% at the atrium**. Excluding NPCs, the reductions are 636,548 and 648,724 triangles, respectively. Nearby, a full set of in-range cans can still be submitted at original detail. The measured savings at the two target positions did not require simplifying foliage, furnishings, window scenery or character LOD.

## Browser verification

Run `python docs/mall_lap_probe.py --device phone --tier balanced` against a locally served checkout in headed Chrome. The phone preset uses 393 × 700 and requires p95 ≤ 36 ms and mean ≥ 29 FPS. The tablet preset uses 820 × 1180. The desktop preset uses 1920 × 893. Both 60 FPS presets require p95 ≤ 20 ms and mean ≥ 57 FPS. The probe uses rendered frame intervals and reports the active scale and submission budget at each stop. Keyboard walking and lift travel use the browser's normal timing. Device presets emulate viewport and input on the host. Use a display whose refresh cadence can present the target evenly when evaluating p95.

The 60-second early-entry probe records peak live triangles for each tier, alongside the visitor route, shader and upload events. [GJH v11 late asset uploads](gjh-v11-late-asset-uploads.md)
