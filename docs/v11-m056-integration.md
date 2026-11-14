# V11 New Moon M056 display integration

Release 1.1.35, based on main `55fb275`, preserving Visitor v2, physical product pickup/return, derived modes, accessibility fixes and the recent gallery redesign. This replaces only the four New Moon display fixtures; it does not implement a new Shelf focus mode.

## Source / measured geometry

Original M056 furniture from Blender-3D-Gallery revision `4e9787ddc010cdabbee37d200aaa1aff5730437d`, `models/gjh-m056-premium-wall-shelf-straight/exports/lod1.glb`. Pinned SHA-256 `949e8278034779c129e3494e614a002d5542108b74e081296acffd8e9d7c6037`, 338,236 bytes, 3,132 triangles, 29 primitives and two embedded original wood/stone textures. Owner-project public-demo reuse is authorized; this grants no general redistribution licence. Full provenance is in `assets/m056-source.json`. Existing can source files/hashes and the former shelf/provenance remain unchanged.

Four 2.4×2.4×0.55m native-scale shelves face +Z at X −13.63, −11.21, −8.79, −6.37m, Z −9.25m. They have 2cm inter-fixture gaps and 17cm nominal end margins within the 10m shop. Bounding-box collision follows each new cabinet. Existing country text is aligned with the blank header, not a newly invented brand logo. Warm LED emission is a material effect, not dynamic lighting or a measured colour-temperature claim. Fixed LOD1 is selected for this slice; no automatic shelf LOD is claimed.

All 36 existing cans remain at native scale and keep their SKU identity. Actual shelf surface Y values are approximately .450/.990/1.530m; placement .451/.991/1.531m leaves the source anchor's 1mm clearance. All four can GLBs have identity node transforms and minimum Y=0, checked from actual position accessors. Existing middle-row centre reservation slots remain index 4; repeated pickup/return restores the same source instance, separate from Demo bag selections. Mexico's conceptual blank-sector limitation remains unchanged.

## Necessary evidence

- Four focused unit tests: new/legacy asset hashes, three support planes, all four can origins, loading/fallback contract.
- `browser_gjh_m056.py`: actual 390×844 and 1440×900 Chromium WebGL. Four loaded shelf instances, 36 cans, all four SKU repeated physical pickup/return, no demo-bag mutation, front cabinet collision, zero page errors, native-scale placement. Forced shelf request failure retains loaded can products and explicit fallback status.
- Observed same-view calls: 80→104 at 390, 86→110 at 1440. This is a measured +24 draw-call tradeoff for the more detailed shelf, not an FPS improvement or physical-device benchmark.
- Existing seven asset fault cases passed: normal, unavailable, body timeout, hash mismatch, invalid dimensions, late parse disposal and missing label texture. Fallback bounds expectations were updated to the new support surface, not relaxed.
- The first combined browser invocation reached its 60s tool limit; it was not counted as a pass. Durable job `1845cf4b-e331-4cfe-9dd1-1d9d7cb8bfb1` subsequently completed successfully with the full report.
- Before/after screenshot advisor reviewed the actual wide and held-product views. The default Mexico-end portrait view is partly occluded by the existing checkout planter; this is retained as a limitation, not claimed as an all-angle visibility pass. A further view uses the existing camera-turn control toward the aisle (measured yaw −0.704 rad), without moving fixtures or changing camera code. See `docs/evidence/v11-m056/` for actual images and reports.
- 47 repository static tests and four derived-mode tests pass; no mode table changes were made.

## Limits / rollback

No real iPhone/Android, device FPS, dynamic shelf lighting, prices, stock orders or payments are claimed. The previous shelf files are retained for rollback/history but not loaded by this display. Rollback by reverting this release and rebuilding generated outputs; no bag schema migration. Physical held-product and bag state rules, player/camera logic, mode state and input controls are not modified.
