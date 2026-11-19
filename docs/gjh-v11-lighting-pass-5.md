# GJH v11 lighting pass 5

The atrium barrel has an unlit daylight backing with a deterministic 256 × 256 sRGB tree canopy and a soft glass highlight. The existing ribs and mullions sit in front of the backing. The green lacquer reflects the existing environment, with brass edges and a soft vertical highlight in the same wash batch that carries the stronger cove spill. The public paving and everyday key are dimmer, while the hemisphere ground fill is lighter.

The entrance cove and threshold spill share the interior lamp tint for each shop. New Moon uses gold, MILI cream-green, GOGO teal-white, Sony and LG cool whites, and Casio amber. The exact focus coordinates and other shops' Kelvin values still come from the shop programme. The existing two focus lights carry those colours inside the bays. LG also gets extra fill through the frontage. The player's Tripo materials receive a small emissive lift by zone, including after a material LOD swap. The crowd uses the same hemisphere light with a temporary intensity lift during its existing pass.

The glazing can submit one 48-triangle draw. It uses the stock textured basic material and is available to the existing scene warm-up. The coloured wash remains one instanced batch, with its colour attribute shared by standalone light pools. Light count, shadow passes and environment map count are fixed.

## Before and after

The concept image scores 0.420 mean, 0.216 standard deviation, 0.097 P5, 0.796 P95, 1.572 R/B, 0.412 mean saturation and 0.261 dark share in the current scorer. The limits are mean 0.34–0.50, standard deviation ≥0.20, P5 ≤0.12, P95 ≤0.85, R/B 1.45–1.70, saturation 0.38–0.45 and dark share 0.18–0.32. [Concept reference](references/gjh-mall-modern-premium-concept.png) · [Scorer](../scripts/lighting_score.py)

The complete historical before scores below are from the pass 4 SwiftShader capture of the five poses. The latest reported pass 4 measurements were Balanced atrium mean 0.506 and R/B 1.43, Balanced GOGO mean 0.503 and R/B 1.44, Balanced LG dark share 0.338, and Low atrium dark share 0.369. Compare the candidate to a matched capture on the same machine. Chrome failed during sandbox launch with a Mach bootstrap permission error, so the after cells await a capture. [Pass 4 report](gjh-v11-lighting-pass-4.md)

| Tier | Pose | Before mean | Std | P5 | P95 | R/B | Sat | Dark | After |
| --- | --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: | --- |
| Balanced | Atrium | 0.543 | 0.234 | 0.058 | 0.797 | 1.457 | 0.353 | 0.156 | Pending |
| Balanced | New Moon | 0.443 | 0.247 | 0.010 | 0.778 | 1.551 | 0.415 | 0.232 | Pending |
| Balanced | MILI | 0.511 | 0.277 | 0.013 | 0.814 | 1.477 | 0.380 | 0.210 | Pending |
| Balanced | GOGO | 0.514 | 0.274 | 0.013 | 0.828 | 1.461 | 0.379 | 0.223 | Pending |
| Balanced | LG (`planned-space-14`) | 0.409 | 0.249 | 0.013 | 0.807 | 1.483 | 0.400 | 0.310 | Pending |
| Low | Atrium | 0.472 | 0.254 | 0.110 | 0.806 | 1.525 | 0.401 | 0.230 | Pending |
| Low | New Moon | 0.496 | 0.217 | 0.079 | 0.810 | 1.550 | 0.403 | 0.141 | Pending |
| Low | MILI | 0.542 | 0.238 | 0.128 | 0.817 | 1.515 | 0.387 | 0.128 | Pending |
| Low | GOGO | 0.564 | 0.246 | 0.125 | 0.844 | 1.474 | 0.369 | 0.169 | Pending |
| Low | LG (`planned-space-14`) | 0.470 | 0.214 | 0.049 | 0.800 | 1.543 | 0.401 | 0.186 | Pending |

## Verification

The regenerated gallery passed its build check. The Node suite had 334 passes and one skip, the gallery Python suite had 15 passes, and the scorer suite had five passes. Browser-free smoke checks exercised the generated world across tiers, the inward-facing skylight, the colour-packed wash, the six lamp tints and player LOD handoff, and restoration of the crowd-pass light intensity.

Run the five-pose shot script on the same Chrome, theme, viewport and crop for both revisions. For the pass 4 table, crop to the scene buffer so the fixed header and HUD are excluded. Inspect one upward view from the lift landing for the skylight and compare each named shop's entrance with an interior view.

```sh
python -m http.server 8830 --bind 127.0.0.1
# In a second terminal with GALLERY_CHROME set:
python docs/lighting_shots.py 8830 pass5
python scripts/lighting_score.py --check light_pass5_*.png
python docs/verify_interactions.py
```

The hardware gates are pending. Repeat the three tier laps against the reported 20/20 baseline per tier and record linked programs and peak draws and triangles. Match the phone 30 FPS and tablet/PC 60 FPS targets, the tier budgets and the early-entry limit of zero frames at or above 50 ms. The static interaction programme still enumerates 65 playable actions over all 17 shops. [Hardware probes](gjh-v11-probes.md)
