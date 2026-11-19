# GJH v11 lighting pass 3

Base revision `612f0395` matched the checkout’s local `origin/main`. The [premium mall concept](references/gjh-mall-modern-premium-concept.png) sets the tone for the expanded mall. The brighter surfaces concentrate around the storefronts, warm fixtures and skylight. Public walls, lacquer piers and the ceiling recess carry the shadows.

## Theme and world parameters

| Theme | ACES exposure before → after | Hemisphere intensity | Directional key and intensity | Fog |
| --- | --- | --- | --- | --- |
| Everyday | 1.03 → 0.72 | 0.48 | `#ffbf8c` at 1.82 | `#66513b` |
| Lunar New Year | 1.01 → 0.70 | 0.46 | `#ffbb83` at 1.76 | `#70503a` |
| Christmas | 1.03 → 0.72 | 0.50 | `#ffc08f` at 1.78 | `#665642` |
| Deepavali | 1.04 → 0.71 | 0.45 | `#ffb97f` at 1.80 | `#6d4d40` |

- The prior hemisphere intensity was 1.05. The new upper hemisphere is warm and the lower hemisphere uses deeper brown tones. The key colours are display RGB approximations of 3000–3500 K. Visible daylight through the glazed-roof structure uses muted `#819b9b`. Fog retains the 75–155 m range.
- Everyday starts before optional theme selection. The theme validator accepts exposure from 0.50 to 1.25 to keep theme overrides within the expanded scene's working range.
- Everyday's ceiling is `#907c62` with 0.16 emission intensity, down from 0.55. The barrel vault has 0.14 base emission, down from 0.32. The fixture base rises from 1.20 to 1.65 to retain local highlights.
- The public stone and green inlay use 0.36 and 0.33 base roughness. Balanced scales public floor roughness by 0.91 and Detailed by 0.82. Green lacquer piers and frames use about 0.29 roughness and 0.16 metalness. Brass uses 0.28 roughness and 0.78 metalness.
- The existing three PMREMs supply reflections. Atrium and corridor intensity go from 1.00/0.90 to 0.64/0.58. The shop studio uses 0.94, with authored shop values starting at 0.91 plus the existing temperature and accent terms. Authored shops use the existing focus lights at 38/24 peak intensities, up from 26/18. New Moon uses a lighter interior wall finish and additional window-shelf washes. The shop sign atlases retain their tone-mapping-independent rendering.

## Local effects and cost

LED cove lines, pendant pools, planter uplights and shelf washes reuse the emissive geometry and additive wash batches. Close-range washes are available on all tiers. The broad wash remains limited to supported discrete GPUs on Balanced and Detailed. The roof lighting and ground projection respect the lift cutouts.

The 512 × 512 black-alpha projection tiles the leaf pattern three by two and feathers the perimeter. Source-over blending multiplies the destination colour by the inverse of that alpha. Low and reduced-motion mode hold the texture still. Balanced and Detailed oscillate by up to 0.028 and 0.020 UV units, inside the feathered border. It uses the existing instanced contact-decal material configuration and model upload queue. The dapple contributes at most one draw in view. In views where a compact warm wash becomes visible, that existing batch can contribute one more draw. The changes add zero lights and no new material shader layout. Real linked-program counts and frame budgets require a browser measurement.

Regenerate the tile before the gallery when its generator changes.

```sh
python scripts/build_gjh_skylight_dapple.py
python scripts/build_gallery.py
python scripts/build_gjh_skylight_dapple.py --check
python scripts/build_gallery.py --check
```

## Screenshot scoring and acceptance

Run the scorer with individual images or a directory. The numbers are based on display-encoded Rec.709 luma, population standard deviation, linearly interpolated percentiles, mean red divided by mean blue, mean HSV saturation, and the fraction of pixels with luma below 0.25. The longest edge is reduced to at most 512 px. Pillow supplies image decoding and resizing. NumPy is optional. The concept file measured 0.420 / 0.216 / 0.097 / 0.796 / 1.572 / 0.412 / 26.1% with this sampling.

```sh
python tests/browser_lighting.py --shop-crops --update-baseline --out output/lighting-pass-3 --baseline output/lighting-pass-3-review.json
python scripts/lighting_score.py output/lighting-pass-3 --check
python scripts/lighting_score.py output/lighting-pass-3/1440-balanced-newmoon.png --crop LEFT TOP RIGHT BOTTOM
python -m unittest discover -s tests -p test_lighting_score.py -v
```

`--crop` uses inclusive left/top and exclusive right/bottom pixel coordinates. The browser lighting probe's optional `--shop-crops` reads the native canvas frame synchronously and projects the three original storefront bounds into it and scores the visible crops. Read each crop visually at native size to check sign lettering and merchandise. Close-ups can have a different luminance distribution from the full atrium, so crop numbers are diagnostics. The historical repository storefronts S01/S02/S03 confirmed the crop-scoring path at means of 0.367/0.450/0.462. These captures predate this pass.

Keep the per-pose browser tolerance at 90–115% mean brightness, at least 95% contrast and at least 97% red/blue ratio against an approved reference. Pass 3 deliberately shifts the means outside the previous lighting baseline. Use a fresh review baseline path when taking new screenshots. Promote that JSON to the comparison baseline after checking the screenshots and storefront crops. See the [probe guide](gjh-v11-probes.md).

## Local results

Headed Chrome and the Metal backend were blocked by the local sandbox. A single-process Chromium fallback rendered the checkout with SwiftShader and local responses. These five-pose spot checks used NPCs off. They covered initial tier submissions while deferred model uploads were still pending.

| View | Mean | Std | P5 | P95 | R/B | Sat | Dark share |
| --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: |
| Balanced atrium, base revision | 0.779 | 0.225 | 0.250 | 0.995 | 1.167 | 0.191 | 5.0% |
| Low atrium | 0.454 | 0.234 | 0.109 | 0.846 | 1.649 | 0.449 | 30.7% |
| Balanced atrium, before deferred decal upload | 0.482 | 0.215 | 0.079 | 0.816 | 1.581 | 0.413 | 20.2% |
| Balanced atrium, projection diagnostic | 0.452 | 0.201 | 0.078 | 0.766 | 1.585 | 0.413 | 20.2% |
| Detailed atrium, initial submission | 0.481 | 0.214 | 0.079 | 0.816 | 1.583 | 0.414 | 20.2% |
| Balanced New Moon crop | 0.327 | 0.238 | 0.010 | 0.809 | 1.678 | 0.534 | 42.4% |
| Balanced MILI crop | 0.371 | 0.251 | 0.016 | 0.861 | 1.643 | 0.456 | 33.3% |
| Balanced GOGO crop | 0.452 | 0.295 | 0.016 | 0.889 | 1.640 | 0.455 | 30.5% |

The four Pass 3 atrium rows met all seven tone targets. The New Moon, MILI and GOGO lettering was readable in the desktop crops. New Moon still carries more dark pixels than the concept. MILI and GOGO retained bright areas around their signboards and artwork. GOGO's source artwork and sign contrast were preserved.

The initial software samples peaked at 94,752 triangles and 51 draws on Low, 109,532 and 58 on Balanced, and 109,532 and 58 on the initial Detailed path. Matched Balanced samples from the base revision and Pass 3 linked 77 programs each before deferred uploads settled. The loaded dapple texture was still queued for warm-up in the software spot checks. Enabling its mesh for the projection diagnostic verified the feathered fade and measured one additional draw (38 total, 38,140 triangles) with 77 linked programs. The no-browser smoke test verifies load and upload failure handling, the shared shader layout, motion tiers and lift clearance. The hardware program count after all resources settle, cold entry with zero frames at or above 50 ms, and the full Low 220k/70, Balanced 300k/90 and Detailed 420k/110 lap gates require hardware measurements.
