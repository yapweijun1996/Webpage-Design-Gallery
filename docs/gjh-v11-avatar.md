# GJH v11 character acceptance

## Fixed C1 portraits

Capture the reference from commit `53c466e3` with `python docs/mall_video_probe.py --route character --out output/character-reference`. Serve the candidate from the same URL, then run `python tests/browser_character_closeup.py --out output/character-candidate`. Use the probe setup in [the probe guide](gjh-v11-probes.md). The test can check an existing capture with `--verify-only --out DIRECTORY`.

| Viewport and tier (DSF 1) | Player distances | Tripo boy distances |
| --- | --- | --- |
| 1920 × 900, Detailed | 5.2 m, 2.5 m | 5.2 m, 2.5 m |
| 393 × 700, Low | 5.2 m, 2.5 m | 5.2 m, 2.5 m |

Every pose uses a front camera focused 45% of the way from head to hips, bind pose, Everyday theme and the same atrium mark. Compare the full PNG and unscaled face, hair, left-hand and right-hand crops. Match renderScale and buffer dimensions across revisions. The probe uses its own camera for portraits, so verify LOD transitions separately with the live chase camera.

## Lighting, sampling and silhouette AA

Both Tripo rigs use bind-space height and atlas colour to approximate skin (roughness 0.62) and dark hair (0.43). Cloth outside those masks retains its GLB roughness. All NPC standard materials share the neutral fill and cubic Fresnel rim, with named separate skin and hair surfaces adjusted individually. Check dark collars and skin bordering hair for mask bleed. The scene warmup compiles actual skins, including separately prepared NPCs and player LOD1, with existing light and target variants.

Avatar anisotropy is 2× on phones and 4× on tablets/desktops subject to hardware support. Mip bias is zero. The player switches down at 64 CSS px and back up at 160 CSS px. The Tripo boy retains the existing player-distance LOD because its admission and updates run on physics ticks without a camera.

Keep the tier's present AA policy pending a matched live test. Record the GL sample count on the default framebuffer and the base render target's samples on Detailed. At matched drawing-buffer sizes, compare direct output and Detailed compositing while walking and rotating past the same hair outline. On a measurement build compare 2× MSAA on the base target or FXAA independently. Test 100%, 80% and 60% render scale. Judge temporal shimmer in motion and skin/atlas softening in the native crops. Record GPU time and p95/p99 without recording; retain a change only if it improves the silhouette within the device targets.

## Offline C4 candidate

The bake runs on the CPU and never initializes Blender or Metal. It reads the SHA-256-pinned 4K source, simplifies geometry with UV error weighting, groups connected indexed charts and assigns 1.5× linear texel density to upper-head charts relative to body charts. The 2K atlas includes four pixels of gutter. It retains the runtime rig and all clips, including the added sit. The command checks joint order, inverse bind matrices, triangle count and Khronos validation before creating a new output file.

The dry run used the source identified in `gjh-tripo-visitor-source.json`, Three 0.187.0's MeshoptSimplifier, Pillow 13.0.0 and the Blender-3D-Gallery checkout's gltf-validator. Supply an unused output pathname. For a desktop comparison use a disposable copy of the demo and its normal generator workflow.

```sh
export NODE_PATH="/path/to/Blender-3D-Gallery/node_modules"
export PYTHON="/path/to/python-with-pillow"
node scripts/bake_tripo_candidate.mjs /path/to/motion-BRgAS3uq.glb /tmp/portrait-2k.glb \
  "$NODE_PATH/three/examples/jsm/libs/meshopt_simplifier.module.js"
```

| Player asset | Near triangles | Base colour with RGBA8 mip chain | Plus resident 512² far texture |
| --- | ---: | ---: | ---: |
| Shipped 1K (all tiers) | 11,764 | 5.33 MiB | 6.67 MiB |
| Desktop 2K candidate | 13,997 | 21.33 MiB | 22.67 MiB |

These estimates exclude CPU decode buffers, driver alignment, and transient uploads. The dry run produced a 5,241,684-byte GLB with zero Khronos errors and the existing non-root skinned-mesh warning. The larger download and additional 16 MiB of GPU texture storage require device measurement before adoption. Inspect chart seams, hairline, hands, sit/stand and held-object alignment across LOD switches. Keep the phone on the shipped 1K.

Run cold early entry on all three tiers (zero frames ≥50 ms), compare program counts before/after LOD transitions and NPC admission, then run unrecorded phone/tablet/PC laps including the atrium. Target 30/60/60 FPS and compare GPU time, drawing buffer and upload spikes. Verify peak triangles/draws within 220k/70, 300k/90 and 420k/110 respectively. Repeat after ten minutes on the real devices.
