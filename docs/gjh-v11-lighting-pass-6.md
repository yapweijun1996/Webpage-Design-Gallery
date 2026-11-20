# GJH v11 lighting pass 6

Base revision: `b48e4715`, the worktree's local `origin/main` at the start of this pass. The reference is the modern premium courtyard concept. [Reference image](references/gjh-mall-modern-premium-concept.png)

The courtyard and upper deck share one ivory marble draw. The seamless 512 px tile repeats in world metres, and the lift kit's existing atlas uses the same pattern. Marble roughness is 0.28 on Low, 0.255 on Balanced and 0.238 on Detailed. The fitted lift uses 0.282. The atrium environment now includes a cooler overhead reflection and narrow warm vertical highlights for the piers. The brighter blue canopy backing shows darker tree silhouettes through the existing ribs. Balanced and Detailed retain the projected sunlight layer with tighter mullion edges, warmer sun and less leaf modulation. Low uses the shared marble, skylight and environment reflections with its existing projection draw disabled.

Warm focal pools use each shop's authored light and standing positions. The New Moon cabinet wall gets a wider wash, and MILI and GOGO get tighter pools near the island and cart. The existing wash batch culls these instances using shop proximity, frustum and shop occlusion. Everyday key intensity is slightly lower, the New Moon lamp is less saturated, and GOGO and LG have dimmer focal peaks. The Low atrium and LG get a small lift from the existing hemisphere light. LG fill tapers toward the doorway.

## Scorecard

The scorer measured the reference at 0.420 mean, 0.216 standard deviation, 0.097 P5, 0.796 P95, 1.572 R/B, 0.412 saturation and 0.261 dark share. [Scorer and tolerances](../scripts/lighting_score.py)

Only the supplied pass 5 values appear below. The supplied New Moon saturation was 0.457, with its tier unspecified. A dash marks unavailable candidate measurements. The shot runner was attempted on both revisions. Chrome exited at Mach bootstrap and the sandbox rejected the local HTTP bind, so no matching frames were available for candidate scoring.

| Tier | Pose | Supplied pass 5 readings | Mean | Std | P5 | P95 | R/B | Sat | Dark |
| --- | --- | --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: |
| Balanced | Atrium | Mean 0.499, R/B 1.446 | — | — | — | — | — | — | — |
| Balanced | New Moon | — | — | — | — | — | — | — | — |
| Balanced | MILI | — | — | — | — | — | — | — | — |
| Balanced | GOGO | Mean 0.502, R/B 1.416 | — | — | — | — | — | — | — |
| Balanced | LG (`planned-space-14`) | P95 0.861, R/B 1.424, dark 0.335 | — | — | — | — | — | — | — |
| Low | Atrium | Dark 0.360 | — | — | — | — | — | — | — |
| Low | New Moon | — | — | — | — | — | — | — | — |
| Low | MILI | — | — | — | — | — | — | — | — |
| Low | GOGO | — | — | — | — | — | — | — | — |
| Low | LG (`planned-space-14`) | — | — | — | — | — | — | — | — |

Run the standard five-pose capture with the same Chrome, theme, viewport, NPC settings and crop for both revisions. The capture script writes full viewports at 1440 × 900 for Balanced and 393 × 700 for Low at DPR 2. Match the scoring crop to the baseline before comparing values. [Five-pose capture](lighting_shots.py)

```sh
python -m http.server 8830 --bind 127.0.0.1
# In another terminal with GALLERY_CHROME set:
python docs/lighting_shots.py 8830 pass6
python scripts/lighting_score.py --check light_pass6_*.png
```

## Verification

The gallery build check, Python gallery suite (15 passes), lighting scorer suite (5 passes) and both procedural texture checks passed. The Node suite had 376 passes and one skip for the optional Studio checkout. The bundled world test verifies the shared marble batch leaves the shaft open and the skylight faces into the atrium. A byte comparison verified the three lift tiers changed only the stone regions of their embedded base and surface textures.

The stock material layouts, three PMREM zones and live light count are retained. The courtyard and deck marble reuse the paving batch, and the shop decals reuse the wash batch. A visible wash can contribute one draw in a view where the batch was previously empty. The lift GLBs keep their existing mesh data and material bindings, with the stone region updated in the base and surface sheets. The source tool can regenerate the sheets with `python scripts/build_elevator_atlas.py <sheet-directory>`.

Runtime acceptance remains open for the new scores, visual match, Low's 70-draw cap and +1 delta, tier triangle ceilings, linked shader program parity, zero early-entry frames at or above 50 ms, 65 shop interactions and 20 upper POIs. The browser suites were blocked at localhost bind. [Performance probes](gjh-v11-probes.md) · [Interactions](verify_interactions.py) · [Upper level](verify_upper_level.py)
