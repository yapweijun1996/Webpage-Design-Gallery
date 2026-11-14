# V11 entrance directory kiosk

Application 1.1.10 adds one original Blender directory kiosk beside the entrance at (-3.3, 0, 9.9) metres. Its native 0.96 × 2.05 × 0.68 metre bounds and floor-centred origin are preserved; rotation PI faces the arriving visitor. The central route and existing furniture remain unchanged. Nearby F or the touch Map prompt opens the existing accessible three-store map, not a new route system.

## Source and public-use basis

Pinned upstream `yapweijun1996/Blender-3D-Gallery` at `5fd5401c910a7784c2691e8e0693046f4c007e52`; originally authored by this project's dot at `51ef7b8f73b56fd228652828d9f038d3e1d11aff`. GLB SHA-256 `ebf658b6d03602e3ebeaf68e1305ce32788bcbbf3c67a10be65a0ed628836914`, 178,068 bytes, 5,360 triangles, six material primitives, no images or external resources. Original procedural geometry uses Blender bundled Bfont converted to mesh, not downloaded brand imagery.

The asset belongs to the owner's project; the owner explicitly requested reuse of this library in this public demo and deployment. This is permission for that owner-project use, not a general public redistribution license. Original source generator, upstream README and metadata are retained under `docs/sources/mall-directory-kiosk/`; exact receipt and placement are `assets/kiosk-source.json` within V11. No New Moon photo-derived GLBs or uncertain third-party material is introduced.

**The kiosk screen is fictional decorative geometry.** The nearby UI explicitly says Decorative screen and F/tap Map opens the actual three-store DOM map. It is not an actual touchscreen or a factual floor plan.

## Verified gates

- 40 unit tests: pinned bytes, geometry bounds, triangles and material count checked; SSOT and generation checks passed.
- Real GLB at 390/1440: F and touch Map lead to all three correct store entrances; focus transfers to map and returns to the scene; no product dialog opens for the kiosk.
- Forced 404: existing loader fallback renders a small procedural kiosk and retains map interaction. Existing independent furniture failures, single-fetch reuse and late-resource cleanup remain in the shared loader.
- Direct side approach contacts its collider; the central forward route remains clear. Initial diagonal edge test slid naturally around the corner, so the collision test now makes a direct centre approach; no collision assertion was removed.
- Initial left-edge placement was revised after mobile visual inspection. Final 390/1440 images show the entire kiosk and a clear view of the central concourse.
- Five-size budgets: ready-stage decoded resources approximately 7.98 MB / 37–38 entries; maximum 137 draw calls versus the prior 130. Limits remain 10 MiB / 45 / 200. Original-tin repeated cleanup still passes. These are laboratory observations, not field performance.
- Full V11 movement/doors/inspection/failure/reduced-motion, first guide, landscape Run, gallery, 28 legacy GJH responsive cases plus four no-JavaScript journeys, and PWA update/offline tests passed. No new demo offline guarantee is made.

Physical Android/iOS, Safari, screen readers and notched-screen safe areas remain UNVERIFIED. New Moon GLB rights and remaining task.md phases are not completed by this slice.

Rollback is a normal revert followed by Pages; previous main `3ab7a1cadd945d87d75fbf098c2b97ea2c225e87`. Live delivery is checked separately after deployment.
