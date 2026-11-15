# GJH V11 eight-asset pilot review

Implementation verified 15 November 2026 on the original local runtime. The initial evidence below is historical; current release reconciliation and verification are recorded in [release review](gjh-v11-interior-pilot-release.md). The selected eight candidate IDs are implemented and integrated into V11. Three existing originals were reused, one kiosk was adapted and four models were authored. This is technical/visual acceptance for an independent concept, with explicit UV/LOD/lighting applicability records; the other 192 candidates remain pending.

## Delivered models

Dimensions below are reviewed native **W × D × H**, in metres. These intentionally replace generic source-row proposals; the tolerance is measured against these targets. Existing placement multipliers remain, including 0.8 bench height for visitor-v2 and taller perimeter planters.

| Candidate / role | Decision | Reviewed W × D × H | Triangles / primitives | Instances | Action |
| --- | --- | --- | ---: | ---: | --- |
| PUB-002 bench | Reuse | 2.58 × .922 × 1.3175 | 5,640 / 5 | 8 | SIT |
| PUB-008 planter | Reuse | 1.230091 × 1.191551 × 2.347567 | 5,160 / 6 | 11 | Passive |
| PUB-017 directory | Adapt | .96 × .68 × 2.05 | 4,866 / 7 | 1 | USE |
| DSP-001 shelf | Reuse | 1.52 × .58 × 1.96 | 5,712 / 5 | 4 | INSPECT existing products |
| STF-008 sign frame | New | 2.52 × .213 × 1.21 | 540 / 3 | 3 | Passive |
| LGT-009 wall light | New | .32 × .255 × 1 | 540 / 3 | 14 | Passive |
| PUB-005 coffee table | New | 1.61 × 1.61 × .875 | 4,272 / 2 | 2 | Passive |
| VER-017 plinth | New | 4.5 × 4.5 × .6525 | 3,820 / 4 | 1 | Passive |

[Authoring README](../models/gjh-interior-pilot/README.md) gives reproduction commands. The [acceptance manifest](../models/gjh-interior-pilot/manifest.json) records original proposals, priorities, reviewed dimensions, hashes, sources, blockers and per-asset G01–G12 results. Native editable files, visual exports and the generated runtime registry share stable IDs.

## Scene changes

The directory moves from (-3.3, 9.9) to (-5.3, 10.4), leaving the central cart approach clear. Its decorative screen has three numbered blocks matching the existing three destination buttons. The real accessible map remains application UI. The planter's foliage stays non-blocking above a pot proxy. Tables use conservative full-size blockers; all eight seat/exit anchors remain unchanged.

The low beveled plinth retains the existing sculpture and conservative cylindrical blocker. A second upright sculpture ring is removed for a simpler silhouette. Frame geometry leaves original official brand art intact. Wall-light and frame instances do not cast extra shadows; existing lighting pools remain. No additional real-time light or texture was introduced.

## Verification

- Blender 5.1.2 source inspection: all eight have unit transforms, finite nondegenerate geometry and positive determinants. New solid components are closed. Original foliage sheets, curve ends and text faces intentionally have open surfaces.
- Independent Blender reimport and Three.js runtime load: all eight match root identity and actual bounds within 0.001m. Khronos Validator reports **zero errors and zero warnings for all eight**. See [source inspection](../models/gjh-interior-pilot/reports/source-inspection.json), [reimport](../models/gjh-interior-pilot/reports/blender-reimport.json), [validator](../models/gjh-interior-pilot/reports/gltf-validation.json).
- [Pilot E2E](evidence/interior-pilot-e2e.json): 14 cases. At 390/639/1440px, every model loads once; real physics drives kiosk collision and the cart route in both directions; all three portals and four SKU details open; bag/cart work; all eight seats pass on desktop and two on each smaller viewport. Four List/3D cycles preserve renderer geometry/texture counts and do not refetch models.
- Every GLB is independently forced to 404; the other seven load and product browsing works. Invalid bytes fail the hash check. A parse delayed beyond the real eight-second deadline uses fallback and disposes its late geometry. A no-WebGL directory/detail journey passes. No uncaught page errors in normal/failure cases.
- [Five-view contact sheet](../models/gjh-interior-pilot/previews/contact-sheet.jpg) and its 40 source PNGs were reviewed for silhouette, orientation and visible surface artifacts. Scene captures cover [390](screenshots/interior-pilot/integrated-390.png), [639](screenshots/interior-pilot/integrated-639.png), [1440](screenshots/interior-pilot/integrated-1440.png), each store and cart clearance. Fixed dusk lighting has no day/night mode; no such coverage is claimed.

The [command receipt](evidence/interior-pilot-verification.json) also records the required 11 Gallery unit tests, ten asset tests, Gallery/GJH/PWA browser suites, broad V11 regression and 17 furniture normal/missing/aborted cases. Detailed regression records: [Gallery](evidence/interior-pilot-regression-gallery.json), [GJH demos](evidence/interior-pilot-regression-demos.json), [PWA](evidence/interior-pilot-regression-pwa.json), [V11](evidence/interior-pilot-regression-v11.json), [furnishings](evidence/interior-pilot-regression-furnishings.json). Broad V11 checks include walking boundaries, doors, keyboard inspection, reduced motion, hidden pause and context/WebGL/Wasm/no-JavaScript failures.

## Performance observations

Eight GLBs total **1,097,696 bytes (1.05 MiB)**. All are self-contained and texture-free, with 2–7 primitives each. [Before](evidence/interior-pilot-baseline.json) and [after](evidence/interior-pilot-performance.json) retain startup resource/draw data. Four old furniture files (704,536 decoded bytes) were replaced by eight pilot files, an increase of 393,160 bytes for the expanded set; original product-can files remain unchanged.

| Viewport | Before startup calls | After startup calls | After rendered triangles | After rAF median / P95 ms |
| ---: | ---: | ---: | ---: | ---: |
| 390 | 144 | 150 | 284,242 | 16.7 / 16.7 |
| 639 | 160 | 170 | 314,508 | 16.7 / 16.7 |
| 1440 | 181 | 191 | 321,620 | 16.7 / 16.7 |

Scene-wide draw calls stay below the existing 200-call ceiling in tested startup/store views. Values vary with viewport, culling and active animation; the shared worktree also contains unrelated visitor/amenity changes. These snapshots do not isolate the pilot's cost from those changes. No frame-time baseline was recorded, so the 120-sample after-only rAF intervals are local scheduling observations, not an improvement claim or physical-device FPS certification.

UV/lightmap gates are inapplicable because these assets have no textures or baking. LOD uses the documented simple/instance-only exemption; there are no three exported levels. This does not establish that larger future batches can use the same exemption. HUD/map/help consolidation and broader shell/retail production remain separate pending work.

Physical phones, Safari, screen readers and official packaging/brand certification are outside this verification. The subsequent explicit commit/push request is covered by the release review, which preserves later upstream features and selects the complete pilot with `?interior=pilot`.
