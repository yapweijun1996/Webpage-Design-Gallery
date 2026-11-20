# GJH v11 NPC face comparison

| Boy camera distance | Baseline variance | Redraw variance | Ratio |
| --- | ---: | ---: | ---: |
| 2.5 m | 686.54 | 1,883.37 | **2.74×** |
| 5.2 m | 2,020.44 | 3,476.71 | **1.72×** |

The 2.5 m target is 1.8×. Both pairs use the shipped near mesh, its rest pose, the runtime scale of 1.6 metres per model unit and the player portrait probe's camera framing. Blender 5.1.2 Cycles CPU uses the same studio lights, exposure, seed and 48 samples for each image. The lens has a vertical field of view of 64° at 1920 × 900. The measurement uses four-neighbour Laplacian variance of display-referred luma over the same native pixel rectangle in both images. It responds to edge contrast and edge width. The larger contact-sheet crops use nearest-neighbour magnification. The manifests identify the GLBs and renders by SHA-256.

[2.5 m contact sheet](contact-2.5m.png) · [5.2 m contact sheet](contact-5.2m.png) · [2.5 m measurements](measures-2.5m.json) · [5.2 m measurements](measures-5.2m.json)

## Mall inventory and budgets

| Visible face | Where it appears | Artwork and allocation |
| --- | --- | --- |
| Tripo boy | One admitted ground-floor visitor. The system prefers a seat when modular walkers are enabled. Otherwise he can walk the arcade. | Brown eyes, brown hair, blue-and-white cap. The two independently simplified meshes share one material and atlas. The new features are drawn directly into the original UVs. The near and far meshes keep 6,313 and 2,630 triangles. |
| V2 visitor | Initial crowd, seated visitors, loading or asset fallback. | The rig has no face texture or UVs. Its peach skin, chestnut brows, raised spectacles, cream catchlights and smile are modeled. The NPC template colours the existing vertices for the iris gradient, dark upper lids, brows, nose, lips and blush before upload. It still takes three draws in the compact default outfit and zero texture bytes. |
| Modular chibi | Verified T-shirt or dress outfits on walking slots. Bob, spiky and side-part hair share the neutral body. Mobile Low suppresses the modular crowd. | The face is projected once per atlas size onto the shared body. Existing seeded outfit and skin tints still apply. Blender packs the face islands at 4.00× the texels per square metre of the other islands, or 2.00× linear density. The skeleton, topology, attachments and animation library are shared as before. |

The expanded route serves the arcade outside the shops. Ground-floor seats are registered in the courtyard lounges and inside MILI and GOGO. The Node scene smoke test visits all three locations, checks a registered seat in each and finds V2, boy and modular face meshes under visible scene roots. It uses the production NPC system and seat placements with unobstructed collision queries. Camera occlusion, actual seat clearance and framebuffer appearance in the mall remain live checks.

Balanced and Detailed desktop/tablet sessions use 1024² boy and crowd atlases. Phones and sessions starting on Low select 512². The session keeps its initial selection through later quality changes. The boy's 512² body source is resampled while the face artwork is sampled at the full 1024² destination resolution. Its two LODs retain their common UV coordinate space. This gives twice the source sampling resolution on the desktop face without a geometric change to its UV density. The unused embedded far material is disposed before GPU preparation.

A full RGBA8 mip chain occupies 5,592,404 bytes at 1024² and 1,398,100 bytes at 512². The desktop/tablet upgrade adds exactly **4 MiB** for the boy. The modular body was already 1024², and all walkers share its texture. Low adds **zero** texture bytes. When a compact modular body replaces the previous 1K body, it saves 4 MiB. These are texture allocation calculations. A hardware memory trace was unavailable.

## Reproduce

Use the original boy and modular body from commit `6ec566df`. The bake needs Node with `sharp`, Python with NumPy and Pillow, and Blender. Set `BLENDER` to its executable. The Mac sandbox setup uses the same optional `BLENDER_METAL_GUARD` as the player bake. [Blender setup](../../gjh-v11-signage-assets.md)

```sh
a=demos/corporate/gjh/v11/assets
baseline=$(mktemp -d)
git archive 6ec566df "$a/gjh-tripo-npc-boy.glb" "$a/chibi-crowd/base_body.glb" | tar -x -C "$baseline"
python scripts/bake_npc_faces.py "$baseline/$a" "$a"
python scripts/build_gallery.py
out=docs/evidence/gjh-v11-npc-face
for pair in before after; do
  model="$a/gjh-tripo-npc-boy-1k.glb"
  if [ "$pair" = before ]; then model="$baseline/$a/gjh-tripo-npc-boy.glb"; fi
  "$BLENDER" -b --factory-startup --disable-autoexec --python-exit-code 1 \
    --python scripts/render_avatar_portraits.py -- "$model" "$out/$pair" --engine CYCLES --model-scale 1.6
done
python scripts/avatar_sharpness.py "$out/before-2.5m.png" "$out/after-2.5m.png" \
  --face 907,319,1010,395 --skin 971,309,984,319 --context 860,212,1060,422 \
  --target 1.8 --label '2.5 m' --sheet "$out/contact-2.5m.png" > "$out/measures-2.5m.json"
python scripts/avatar_sharpness.py "$out/before-5.2m.png" "$out/after-5.2m.png" \
  --face 936,391,982,426 --skin 964,387,969,391 --context 907,342,1012,438 \
  --measure-only --label '5.2 m' --sheet "$out/contact-5.2m.png" > "$out/measures-5.2m.json"
node --test tests/gjh_npc_face_contract.test.mjs tests/gjh_npc_compact.test.mjs tests/gjh_npc_tripo.test.mjs
```

The browser-free checks read the embedded image dimensions, exercise the sliced model uploader across four device/tier combinations and verify both live boy LOD bindings. Binary contract checks compare rig, topology and animation data with the original release. Khronos validation found zero errors in all five runtime GLBs checked.

The local HTTP bind returned EPERM and headed Chrome terminated during startup. Early-entry frames ≥50 ms, hardware draw/triangle peaks and the live courtyard/shop view remain unverified. [Early-entry probe](../../gjh-v11-late-asset-uploads.md)
