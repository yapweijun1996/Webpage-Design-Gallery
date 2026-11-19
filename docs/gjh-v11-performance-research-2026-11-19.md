# GJH v11 performance research (2026-11-19)

Four independent read-only studies (GPT 6.2 Sol, GPT 6.2 Astra, Fable 5.2, Opus 5.5) were run on the same brief: how to remove lag on phone, tablet and PC, and whether WebAssembly helps. This note records the consensus and the owner decisions. Raw reports are not stored; every claim below is an estimate until measured with `docs/mall_lap_probe.py` on real hardware.

## Owner decisions (2026-11-19)

- Targets: phone = stable 30 FPS (render loop capped at 30 Hz), tablet and PC = stable 60 FPS.
- Automatic degradation order: dynamic resolution first (100% down to 60%), then drop one quality tier. A manual tier choice disables the automatic tier downgrade.
- Accepted visual trade-offs: simplified far products, Low tier without shadows and glow, lower phone pixel ratio cap (1.5, and 1.25 on low-end devices).
- Real devices the owner can test: iPhone and an Android phone. iPad and the Windows laptop are covered by throttled emulation only.

## Diagnosis (all four agree)

1. The owner's Windows integrated-GPU laptop (75 Hz, 1920x893, Balanced) is GPU fill-rate and presentation bound, not JavaScript bound. Frame times 13/26/40 ms are whole multiples of the 13.3 ms refresh; `renderMs` is only 4-13 ms.
2. Fill-rate suspects: 4x MSAA on the default framebuffer (`script.js:717,722`), Balanced pixel ratio cap 1.5 on wide screens (`graphics-quality.js:18-20`), about nine per-pixel point lights (6 permanent accent lights compiled even at intensity 0 in `mall-atmosphere.js:56-91`, one per shop in `world.js:673`) plus two directional lights, double-sided transparent glass overdraw (`world.js:80,344`, `upper-level.js:288`, `elevator-v2.js:116`), and in Detailed a 25-tap full-resolution composite (`mall-atmosphere.js:139-159`).
3. Vertex load is the second factor: before the LOD work MILI submitted 992k triangles, mostly invisible product cans; Low-end Android is vertex and texture-bandwidth bound.
4. iPad is classified as a phone (coarse pointer) and therefore pinned to Low with pixel ratio 1; this is a quality problem, not a lag problem.
5. The JS main thread is not the bottleneck (fixed 1/60 physics step, 4 ms upload slices).

## WebAssembly

Not a fix for this lag. Rapier is already WebAssembly. Culling, LOD and skinning are small or on the GPU. Useful WASM: meshopt decoder and Basis/KTX2 transcoding, which reduce download size, upload spikes and texture bandwidth (small indirect FPS gain). OffscreenCanvas plus worker does not make the GPU faster and costs a large rewrite. WebGPU is a future optional backend only.

## Ranked work list

1. Dynamic resolution 0.6-1.0 with hysteresis, inner loop of the tier controller (in progress).
2. Cut per-pixel point lights (6 permanent accents to 2-3, shop lights only when near) and re-warm light variants.
3. MSAA off or FXAA on integrated GPUs and phones at Balanced; fix Detailed (base target without MSAA, composite into an MSAA buffer).
4. Balanced pixel ratio cap 1.5 to 1.25.
5. Transparent overdraw: single-sided skylight glass, cheaper door glass, no glow wash on integrated GPUs.
6. Detailed composite: quarter-resolution blur, one sample; smaller or no shadow map on integrated GPUs.
7. Triangle and draw budgets per tier (Low 220k/70, Balanced 300k/90, Detailed 420k/110) with far can LOD, packed instance batches, merged draws (in progress).
8. Tablet class: wide coarse-pointer devices get Balanced with pixel ratio 1.5 and dynamic resolution.
9. Frame pacing: cap at the target only on displays at or above 100 Hz (120 to 60, 144 to 72); keep 75 Hz native to avoid judder.
10. KTX2 (ASTC/ETC2/BC7) textures, 1024 signage atlas on phones, meshopt-quantised GLBs.
11. Zone streaming (unload far shop geometry) and shop portal culling.

## Verification plan

Extend `docs/mall_lap_probe.py` with `--refresh-hz`, `--cpu-throttle N` (CDP `Emulation.setCPUThrottlingRate`), `--dsf 2|3` (GPU fill-rate proxy: the slope of ms per frame versus device scale factor tells fill-rate from vertex/CPU bound), GPU timer (`EXT_disjoint_timer_query_webgl2`) in the performance report, refresh rate and GPU renderer string in the exported JSON, and an in-page `?autolap=1` route for real phones. Acceptance: zero frames at or above 50 ms, p95 and p99 within the device budget, no regression after 10 minutes of heat soak, triangle and draw budgets per tier.
