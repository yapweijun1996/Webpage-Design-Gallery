# GJH v11 lighting pass 6

The original pass at `c0454662` added a shared marble batch for the courtyard and upper deck, a brighter skylight backing, crisp projected mullions, and focal pools at the shops' authored fixtures. The headed Chrome review confirmed clear veins and pane edges and measured a brighter, cooler render than the warm ivory concept. [Concept reference](references/gjh-mall-modern-premium-concept.png)

## Colour correction

The marble tile uses an ivory `#e9dcc0` base and low-contrast grey-brown veins. The world-metre UVs and vein shapes remain as authored. The paving material lowers diffuse reflectance and softens the brightest specular streaks with roughness of 0.30 on Low, 0.273 on Balanced and 0.255 on Detailed, alongside reduced metalness. The lift uses the revised tile in the stone region of its existing atlas. The sage terrazzo runner retains its aggregate with a warmer material tint.

The projected sun uses approximately 3200 K gold with a lower peak alpha. Pane outlines, shear, dapple pattern and edge fade are preserved. The visible skylight stays bright, while the atrium reflection uses a softer, warm-neutral ceiling with a lower gain. Low retains its existing projection culling. The two shop focus lights and existing wash batch carry the warmer tints, with a slightly lower New Moon spotlight peak. The everyday directional key and exposure retain their previous values. The existing hemisphere light adds fill on Low near the atrium and tapers across the LG entrance, including the standard pose 2.4 m outside the shop.

## Scorecard

The values below come from the owner's headed Chrome capture of the original pass 6. A dash denotes an unavailable reading. The previous New Moon baseline was R/B 1.56 and saturation 0.457. The correction has no fresh screenshot scores: the sandbox rejected the localhost bind and Chrome's Mach bootstrap. [Scorer](../scripts/lighting_score.py)

| Tier | Pose | Mean | P95 | R/B | Sat | Dark | Correction |
| --- | --- | ---: | ---: | ---: | ---: | ---: | --- |
| Balanced | Atrium | 0.547 | 0.892 | 1.214 | 0.302 | — | Awaiting capture |
| Balanced | New Moon | — | 0.851 | 1.408 | — | — | Awaiting capture |
| Balanced | MILI | 0.525 | — | 1.264 | 0.348 | — | Awaiting capture |
| Balanced | GOGO | 0.533 | — | 1.242 | — | — | Awaiting capture |
| Balanced | LG (`planned-space-14`) | — | — | 1.305 | 0.353 | 0.335 | Awaiting capture |
| Low | Atrium | — | — | 1.253 | 0.350 | 0.364 | Awaiting capture |
| Low | New Moon | — | — | — | — | — | Awaiting capture |
| Low | MILI | — | — | — | — | — | Awaiting capture |
| Low | GOGO | — | — | — | — | — | Awaiting capture |
| Low | LG (`planned-space-14`) | — | — | — | — | — | Awaiting capture |

At an atrium target of 0.45 mean, the required drop is 0.097. P95 needs a drop of at least 0.042. Relative to the reported R/B values, a midpoint of 1.55 requires increases of 28% for Balanced atrium, 23% for MILI, 25% for GOGO, 19% for LG, 10% for New Moon and 24% for Low atrium. Saturation needs increases of at least 0.078 in Balanced atrium, 0.032 in MILI, 0.027 in LG and 0.030 in Low atrium. LG and Low atrium need dark-share reductions of more than 1.5 and 4.4 percentage points, respectively.

Multiplying the linearised tile RGB by the linearised paving tint and the diffuse fraction gives channel multipliers of approximately 0.75, 0.61 and 0.40 against the original marble under the same light. That is 0.63× diffuse luma before tone mapping. The overhead reflection gain is 0.68× its previous value, and the projected layer's peak alpha is 44/49 of its previous value. These calculations size the material and lighting changes. Scene coverage, tone mapping, and the distribution of pixels near the dark threshold still require matching renders.

Capture the five standard poses with the same Chrome backend, theme, NPC settings, viewport and scoring crop as the baseline. Balanced uses 1440 × 900 CSS pixels. Low uses 393 × 700 at DPR 2. Score against atrium mean 0.42–0.48 and P95 ≤ 0.85, R/B 1.45–1.65 and saturation ≥ 0.38 across the five views, and dark share < 0.32 at LG and Low atrium. [Five-pose capture](lighting_shots.py)

```sh
python -m http.server 8830 --bind 127.0.0.1
# In another terminal with GALLERY_CHROME set:
python docs/lighting_shots.py 8830 pass6-warm
python scripts/lighting_score.py light_pass6-warm_*.png
```

## Verification

The regenerated gallery passed its freshness check. The full Node suite had 376 passes and one optional Studio skip. The Python gallery and scorer suites had 15 and five passes, respectively. Both procedural texture checks passed. The three repository browser suites stopped at the local server bind.

The bundled-world check exercises tier switching, the shared marble batch, the opening at the lift shaft, the visible skylight, and LG fill at its entrance. The colour pass uses the same draw batches, stock material program variants, three environment zones and live light count. The atlas update changes only the stone regions in the three lift GLBs. The actual Low peak of ≤70 draws, linked program counts and early entry with zero frames ≥50 ms still require headed Chrome. [Performance probes](gjh-v11-probes.md)
