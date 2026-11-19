# GJH v11 graphics quality

Low caps device pixel ratio at 1, disables real-time shadows, and admits up to two ambient visitors on desktop and one on mobile.

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

The current all-tier result is unverified in headed Chrome. The 60-second early-entry probe records peak live triangles for each tier, alongside the visitor route, shader and upload events. See [GJH v11 late asset uploads](gjh-v11-late-asset-uploads.md).
