# GJH V11 stage 8: natural finishes and warm lighting

The separately developed [local stage 8 report](gjh-v11-stage8-materials-local.md) and its original evidence are retained as historical observations. Later theme and startup integration is documented in [stage 11b](gjh-v11-stage11b-startup.md).

## Current expanded-mall lighting

The everyday palette uses lighter ivory walls and ceilings with forest-green and champagne-gold accents. Warm, non-shadow-casting shop lights blend a small amount of each shop's accent color; at most six are active near the visitor. Seasonal themes retain their color overrides. Classic global lighting is unchanged; its shop accents use the same warm lights.

These changes reuse the existing lights and materials, add no external assets or geometry, and leave the direct mobile/Low render path and selective desktop bloom unchanged. Visual readability and the 200-call budget require fresh browser verification; historical measurements below do not establish the result for this revision.

Application 1.1.52/build `3ac382081b3b16d2` refines the opt-in expanded preview with subtle stone and wood patterns, warmer existing light sources and coordinated cream stone on the upper landing. The [receipt](evidence/gjh-stage8-materials.json) pins exact source phases, raw evidence and selected before/after images. Current focused/integration checks and independent local acceptance pass; main/CI/Pages/publication remain the release gates. It preserves the three current stores, four products, closed candidate bays and visitor interactions. Theme infrastructure and seasonal decorations belong to later stages.

## Implementation and reuse

The selected [premium concept](references/gjh-mall-modern-premium-concept.png) guides warmth and restraint; it is not a rendered result or photorealism certification. The same owner's existing, uncommitted `natural-materials.js` was inspected and reused byte-for-byte with source SHA provenance. The surrounding older world was not copied: it contains different lift geometry, later theme work and incompatible historical performance assumptions.

The optional module draws original deterministic patterns into two 256 × 256 canvases. One sRGB repeat texture serves the expanded stone floor; one shared wood texture serves existing built-in wood/oak/timber materials. No external image, new model, texture download, decoder or image-generation service is added. The module itself is an additional local JavaScript request. Canvas failure returns solid finishes and disposes any texture already created.

The expanded world gives the optional dynamic import a two-second deadline. After timeout it continues without invoking a late factory; a late module evaluation cannot assign maps or allocate finish textures. A settled import clears the timer. The floor remains walkable and verified information remains in the Directory when the module is missing or canvas allocation fails.

Existing ceiling/wall/glass materials and existing hemisphere/fill colors are warmed. Recessed strips reuse the emissive batch and their soft pools reuse the existing additive instance batch. Both follow retained ceiling rectangles clipped against the actual stage7 roof opening; strips are not suspended across the lift camera aperture. No visitor collider, new dynamic light or shadow-casting light is added. The expanded lift changes only one stone color; its geometry, gates, cabin, motion and classic legacy body remain exact.

All player, UI, mode, product, amenity, lift-layout and P0-shell modules retain their published stage7 bytes. Classic uses its original materials/light values and makes no optional finish-module request in the focused, service-worker-blocked scene tests. The existing PWA cache policy remains unchanged; this task does not expand offline content claims.

## Actual visual and resource comparison

Before editing, two exact-source099 profiles captured ten poses, including entry, court, New Moon frontage, a collision-controller west-court approach and a real upper ride at390Auto and1440Detailed/DPR1. The early candidate repeats those poses under the same parameters. Primary review sees restrained floor seams/grain, readable store imagery and labels, an unobstructed upper avatar and a cream landing consistent with the warmer ground floor. These are browser-emulated viewports, not physical-device or complete packaging checks.

Eight current states and eight fresh adjacent099 controls each record120 distinct advancing renders after30warmup renders:1,920 measured samples overall. All149 served baseline V11 files match099; its outer test harness uses the current generated gallery with service workers blocked. Hardware fields, viewport, quality, shadows and cart state match each pair.

| State | Baseline → candidate draw calls |
| --- | ---: |
| Classic390Auto, idle/cart |159/162 →159/162|
| Classic1440Detailed, idle/cart |197/200 →197/200|
| Expanded390Auto, idle/cart |157/160 →157/160|
| Expanded1440Detailed, idle/cart |179/182 →179/182|

The200-call gate is unchanged for every sampled idle/cart state. Expanded adds98 rendered triangles, two renderer texture objects and zero geometry objects; classic counters remain exact. The two source canvases hold512KiB of RGBA pixels before overhead/mipmaps, a theoretical source size rather than a GPU-memory measurement. Full source accounting identifies150 runtime files versus149, with146 old files exact, changes to world/expanded lift color/generated PWA worker, and one2,372-byte module. All75 existing binary asset files remain exact.

The earlier stage7 loop samples were approximately16.7ms; the new current run observed33.3ms even in unchanged classic. Therefore those earlier timings were not reused for this comparison. Fresh adjacent099 controls also observe33.3ms median and33.4ms P95, matching the candidate. The host/display/compositor cause is unproven. These are vsync-capped loop observations, not GPU timing, throughput, fieldFPS or a claimed speedup.

## Verification boundary

Current generation,55Python tests,31Node contracts and SSOT0/1211 pass. The new Node checks exercise deterministic sharing, first/second-canvas partial cleanup and allocation failure. Current browser checks pass five viewports/four quality choices and seven fault/isolation cases: missing module, first/second canvas failure, held late import, native context restoration, and classicv2/v1 zero module requests. Late evaluation creates no maps; second-canvas failure disposes the first map exactly once. Native context restoration retains one factory call, two created maps, one module request and equal before/after texture counts. Strict console checks separate only exact expected fixture messages. Eight current integration groups pass: expanded shell/loop/Map/native recovery and fallback, store/four-SKU/Bag/physical pickup-return, expanded PWA, standalone mall PWA, cache boundary, older GJH demos, Gallery and global PWA. They run in an isolated copy; twenty screenshot/thumbnail refreshes from older demos are restored before exact generated-prefix verification. No optional axe bundle was supplied to that legacy demo suite; its printed zero count does not certify accessibility.

Physical iPhone/Android/Safari, real safe areas, assistive technology and GPU allocation remain unverified. Historical45-request/10MiB startup gates remain unpassed; this slice does not relabel them or use the older sibling205-call observation to relax the current200-call contract. Main, head-specific CI/Pages and actual public-source/scene checks are required before stage9.


Selected actual images: [390court before](screenshots/gjh-stage8-materials/before-court-390.png) and [after](screenshots/gjh-stage8-materials/after-court-390.png); [New Moon frontage before](screenshots/gjh-stage8-materials/before-store-1440.png) and [after](screenshots/gjh-stage8-materials/after-store-1440.png); [upper landing after](screenshots/gjh-stage8-materials/after-upper-1440.png); [320entry](screenshots/gjh-stage8-materials/entry-320.png); [restored textures](screenshots/gjh-stage8-materials/context-restored.png). The changed timing basis prompted a fresh adjacent control, without changing production code or the200-call threshold.
