# Player face comparison

Both sides use the shipped desktop 2K near mesh. The baseline is the portrait asset before the redraw. The per-render JSON files identify the GLB and PNGs by SHA-256. The PNGs are native 1920 × 900 renders. Each contact sheet magnifies the same native head crop using nearest-neighbour scaling for inspection. All measurements use native pixels.

Blender 5.1.2 Cycles CPU renders the bind pose with a fixed sun, neutral ambient illumination, Standard display transform, fixed sampling seed and 48 samples. The camera reproduces the desktop portrait probe's head-to-hips focus (45%), hand-derived front direction, 64° vertical field of view and scene scale (1.7 m player height). The two camera distances are 2.5 m and 5.2 m. The offline setup isolates the character and does not measure the mall's post-processing, dynamic resolution or live frame timing. Chrome terminated during launch, local HTTP bind returned EPERM and Blender EEVEE aborted during GPU initialization in this sandbox.

## Native measurements

| Camera distance | Entire face | Eyes | Eyebrows | Mouth |
| --- | ---: | ---: | ---: | ---: |
| 2.5 m | 2.39× | 2.55× | 1.57× | 1.39× |
| 5.2 m | 1.27× | 1.33× | 1.09× | 0.73× |

The full-face target is 2× at 2.5 m. At 5.2 m the smaller mouth projects to fewer pixels and its measured edge variance decreases. The oblique capture shows the purple rim separated from the cheek, with the red temple locks preserved.

[2.5 m contact sheet](contact-2.5m.png) · [5.2 m contact sheet](contact-5.2m.png) · [Oblique contact sheet](contact-oblique.png)

## Mall runtime recheck

Headed Chrome 158 with ANGLE Metal measured the shipped runtime at commit
`130f8ea377`. The 2.5 m score reached **1.51×** against the **2.00×** target.

| Camera distance | Baseline variance | Shipped variance | Face ratio | Eye ratio | Brow ratio | Mouth ratio |
| --- | ---: | ---: | ---: | ---: | ---: | ---: |
| 2.5 m | 2,655.45 | 4,010.02 | **1.51×** | 1.71× | 0.95× | 0.78× |
| 5.2 m | 6,492.00 | 6,433.93 | 0.99× | 1.01× | 0.73× | 0.54× |

The test loaded the archived Round 2 rig from `dbad8a11b` and staged it at the
same player placement as the shipped `gjh-tripo-entry.glb`. It waited for the
shipped `gjh-tripo-portrait-2k.webp` to load before capture. Both rigs used
2048² atlases, the same material shader and texture sampling, and the same
1920 × 900 native buffer at render scale 1. The Detailed tier used Everyday
atrium lighting, ACES exposure 0.72 and bloom. Camera, focus, head and hand
positions matched at both distances. The table uses the same native face and
feature boxes as the offline test. The 5.2 m score is informational.

[2.5 m browser comparison](chrome-comparison-2.5m.png) · [5.2 m browser comparison](chrome-comparison-5.2m.png) · [Native-pixel measurements](chrome-metrics.json) · [Capture settings](chrome-capture.json)

## Artwork trials

Two isolated SVG revisions from `8e013cb5` were baked from the original 4K
source through the existing UV and LOD pipeline. The first revised the brows,
smile and frame and simplified lens reflections. The second also revised the
iris outline, lower iris color and existing catchlights. Both were rendered
against the archived Round 2 asset and the shipped 2K atlas with the same
headed Chrome 158 C1 settings and native measurement boxes. Matched oblique
views rotated the portrait camera by 40° in each direction.

| Distance | Shipped vs. Round 2 | Trial 1 vs. Round 2 | Trial 2 vs. Round 2 |
| --- | ---: | ---: | ---: |
| 2.5 m | 1.510× | 1.383× | 1.308× |
| 5.2 m | 0.991× | 1.084× | 1.091× |

At 2.5 m the first trial's eye, brow and mouth ratios relative to the shipped
render were 0.959×, 1.059× and 1.191×. The second measured 0.863×, 1.061× and
1.195×. The broader rim and smile stayed easier to distinguish obliquely.
Both trials remained below the 2× near target and were held. All three LODs
kept identical non-image GLB buffers. The four matched views used 37, 41, 50
and 39 draw calls respectively. These still captures cover the asset and draw
budgets. Gameplay frame timing is a separate test.

[Native crop comparisons](chrome-trial-contact.png) show the shipped artwork
and both trials at 2.5 m, 5.2 m and both oblique headings. SHA-256 identifies
the candidate desktop atlases and the original native frontal captures.

| Trial | Desktop WebP SHA-256 | Native 2.5 m PNG SHA-256 |
| --- | --- | --- |
| 1 | `91c0ccdd605c56f2719958a629e34df82942434b02a82278c8a42f098384416f` | `5c9851f141d376e766da07b8b3805b2758b3d1869bcd897cd46008d9012723fc` |
| 2 | `e6a8a31bf0a94c76c1c00e1541dbf91ccfef9c38e12a3be5684ec755cf80a987` | `c10cddbdd1d87be7cb7801eba3c312d830234b2babc955fce91b3868231b28b7` |

### Spectacle rim ownership

An instrumented bake reproduced the shipped 2K GLB byte-for-byte and marked
which UV texels retained the source coating or received the authored rim
color. The pale double line follows the authored color where it overlaps
the raised source wire. At four native frontal samples on the upper wire
(`y=317`, `x=904, 910, 916, 922`), 8-bit luma was `158, 156, 168, 158` in
the shipped render and `81, 79, 82, 90` with the original source atlas on
the same UVs. The diagnostic also shows the frontal projection extending
past the source wire at the temples.

A candidate assigned the full raised wire coating to the source texture and
kept the SVG skin layer. The double line disappeared at 0° and ±40°, with
sample luma `81, 79, 81, 93` in the matched frontal render. The 2.5 m C1 score
fell from **1.510×** to **1.311×** against Round 2, so the candidate was held.
Non-image GLB buffers matched and each view kept its draw count. A next design
option is to author a continuous finish in the raised wire's own UV charts
and judge its reflection and silhouette at all three headings.

[Matched rim crops and ownership legend](chrome-rim-ownership.png)

## Reproduce

Use the guarded Blender invocation in [the signage documentation](../../gjh-v11-signage-assets.md). Supply a Round 2 baseline GLB with the hash recorded in `before.json`.

```sh
out=docs/evidence/gjh-v11-face-redraw
asset=demos/corporate/gjh/v11/assets/gjh-tripo-visitor-2k.glb
for pair in before after; do
  glb="$asset"
  if [ "$pair" = before ]; then glb="$BASELINE_GLB"; fi
  "$BLENDER" -b --factory-startup --disable-autoexec --python-exit-code 1 \
    --python scripts/render_avatar_portraits.py -- "$glb" "$out/$pair" --engine CYCLES
done
python scripts/avatar_sharpness.py "$out/before-2.5m.png" "$out/after-2.5m.png" \
  --face 886,294,1033,385 --eye 898,318,948,364 --eye 968,318,1020,364 \
  --brow 903,294,941,312 --brow 976,294,1017,312 --mouth 940,366,976,386 \
  --skin 949,280,970,302 --context 839,204,1078,425 --label '2.5 m' \
  --sheet "$out/contact-2.5m.png" > "$out/measures-2.5m.json"
python scripts/avatar_sharpness.py "$out/before-5.2m.png" "$out/after-5.2m.png" \
  --face 924,377,993,421 --eye 928,388,953,412 --eye 962,388,989,412 \
  --brow 934,377,951,386 --brow 967,377,985,386 --mouth 950,412,968,422 \
  --skin 955,370,964,379 --context 895,330,1022,434 --label '5.2 m' \
  --sheet "$out/contact-5.2m.png" > "$out/measures-5.2m.json"
```

The face box spans both eyebrows, the eyes and frames, nose and smile. Feature boxes were chosen from the baseline before rendering the candidate. Each pair of eye or brow crops has one pooled four-neighbour Laplacian variance, excluding the one-pixel border of each separate box. The ratio is candidate variance divided by baseline variance. Contrast as well as edge width can influence this metric. The legacy skin-range flag in the JSON uses the earlier lighting setup; the forehead samples here compare brightness only within this matched studio pair.

For the oblique comparison, use the same render command for each GLB with the output prefix `oblique-before` or `oblique-after`, and append `--yaw 40 --distance 2.5`. This rotates the camera around the same focus with the studio lights fixed. The comparison shows native rectangle `835,204,1080,425` at 2× display magnification.
