# GJH v11 lighting pass 4

The worktree started at `c6aba63e`, matching both GitHub `main` and the local `origin/main`. The ivory stone, brass, deep green piers, and warm daylight follow the reference. [Premium mall concept](references/gjh-mall-modern-premium-concept.png)

- The public paving uses a lighter ivory tint with roughness from 0.289 on Detailed to 0.34 on Low. The brighter atrium ceiling in the existing zone PMREM supplies a view-dependent highlight. Short, feathered reflections below the north pier bases are baked into the existing floor atlas. A narrow wash over the polished brass inlay adds a faint warm highlight.
- The 512 px dapple texture contains a sheared five-row grid of warm sun patches. Soft mullion gaps and foliage modulate the alpha. The projection uses additive blending, the existing contact-decal program, and the lift cutout. Low and reduced motion use fixed UVs. Balanced and Detailed drift by at most 0.008 and 0.006 UV units.
- The fixture geometry and wash batches carry the north and arcade cove strips, wall spill, pendant pools and planter uplights. The changes keep the existing light count and render passes. New Moon has more neutral fill and fascia, GOGO has a dimmer sign face and a tighter public pendant pool, and LG has more fill at its storefront and lighter display plinths in the existing coloured trim batch.

## Five-pose scores

Chromium with ANGLE SwiftShader rendered the local worktree with the Everyday theme and NPCs off. The CSS viewports were 1440 × 900 and 393 × 700. Scores use the scene buffers at 1440 × 852 and 393 × 652, which exclude the fixed header and HUD. Each capture teleported to the named pose and submitted one controlled frame after the sun and floor decal atlases were visible. Room assets also warm opportunistically, so near-field crop results can vary with the upload state.

Run `python scripts/lighting_score.py <images>` on the captured frames. The scorer uses display-encoded Rec.709 luma, mean HSV saturation and the share of pixels below 0.25 luma. The headed shot script captures the whole viewport for visual comparison. [Five-pose shot script](lighting_shots.py)

| Tier | Pose | Mean | Std | P5 | P95 | R/B | Sat | Dark share | Outside target |
| --- | --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: | --- |
| Balanced | `atrium` | 0.543 | 0.234 | 0.058 | 0.797 | 1.457 | 0.353 | 0.156 | mean, sat, dark |
| Balanced | `newmoon` | 0.443 | 0.247 | 0.010 | 0.778 | 1.551 | 0.415 | 0.232 | PASS |
| Balanced | `mili` | 0.511 | 0.277 | 0.013 | 0.814 | 1.477 | 0.380 | 0.210 | mean, sat |
| Balanced | `gogo` | 0.514 | 0.274 | 0.013 | 0.828 | 1.461 | 0.379 | 0.223 | mean, sat |
| Balanced | `planned-space-14` | 0.409 | 0.249 | 0.013 | 0.807 | 1.483 | 0.400 | 0.310 | PASS |
| Low | `atrium` | 0.472 | 0.254 | 0.110 | 0.806 | 1.525 | 0.401 | 0.230 | PASS |
| Low | `newmoon` | 0.496 | 0.217 | 0.079 | 0.810 | 1.550 | 0.403 | 0.141 | dark |
| Low | `mili` | 0.542 | 0.238 | 0.128 | 0.817 | 1.515 | 0.387 | 0.128 | mean, p5, dark |
| Low | `gogo` | 0.564 | 0.246 | 0.125 | 0.844 | 1.474 | 0.369 | 0.169 | mean, p5, sat, dark |
| Low | `planned-space-14` | 0.470 | 0.214 | 0.049 | 0.800 | 1.543 | 0.401 | 0.186 | PASS |

## Floor and storefront checks

The floor targets apply to the marble itself. The whole-frame targets also count the storefronts, ceiling, glass and avatar.

Two Balanced atrium marble crops averaged 0.704 with sunlight and 0.665 with the decal hidden. The native-buffer rectangles were `(60, 505, 610, 810)` and `(810, 505, 1320, 810)`. In the left crop, the brightest 5% of pixels that gained at least 0.035 luma over marble with baseline luma above 0.45 gained about 21% relative to the same floor without sun.

The north shop crops use the projected bounds from the lighting browser probe. The LG crop projects the frontage at world X 34.64 from Z 16.3 to 23.7 and Y 0.10 to 5.55. [Lighting browser probe](../tests/browser_lighting.py)

| Metric | Reported before, Balanced | Target | Balanced crop | Low crop | Balanced whole pose |
| --- | ---: | ---: | ---: | ---: | ---: |
| New Moon saturation | 0.463 | ≤0.450 | 0.430 | 0.429 | 0.415 |
| GOGO P95 | 0.851 | ≤0.850 | 0.809 | 0.823 | 0.828 |
| LG dark share | 0.344 | 0.180–0.320 | 0.316 | 0.280 | 0.310 |

## Rendering and verification

The atrium projection added one draw and zero linked programs when toggled in a controlled sample. The Balanced atrium used 84 active programs in both the base and the pass. The release spot checks that linked extra programs during the pose sequence traced them to existing deferred catalog display materials. Lighting retained the existing shader source and cache-key layout.

| Tier | Peak draws / budget | Peak triangles / budget | Scope |
| --- | ---: | ---: | --- |
| Low | 63 / 70 | 104,976 / 220,000 | Five poses with the floor and sun decals visible |
| Balanced | 74 / 90 | 122,212 / 300,000 | Five poses with the floor and sun decals visible |
| Detailed | 67 / 110 | 113,296 / 420,000 | Five initial poses before the final storefront trim adjustment, with deferred uploads pending |

Gallery generation, gallery Python tests, lighting score tests, and both decal generation checks passed. The Node suite had 313 passes and one skip for the optional Studio checkout. The general browser suites could not bind localhost in the sandbox. Headed Chrome/Metal failed at launch, so the hardware cold early-entry gate of zero frames and zero callbacks at or above 50 ms and the full hardware lap remain unverified. The render probe guide lists the headed commands. [Render probe guide](gjh-v11-probes.md)
