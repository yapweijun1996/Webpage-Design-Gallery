# GJH v11 character acceptance

## Fixed C1 portraits

Capture the reference from commit `53c466e3` with `python docs/mall_video_probe.py --route character --out output/character-reference`. Serve the candidate from the same URL, then run `python tests/browser_character_closeup.py --out output/character-candidate`. Use the probe setup in [the probe guide](gjh-v11-probes.md). The test can check an existing capture with `--verify-only --out DIRECTORY`.

| Viewport and tier (DSF 1) | Player distances | Tripo boy distances |
| --- | --- | --- |
| 1920 × 900, Detailed | 5.2 m, 2.5 m | 5.2 m, 2.5 m |
| 393 × 700, Low | 5.2 m, 2.5 m | 5.2 m, 2.5 m |

Every pose uses a front camera focused 45% of the way from head to hips, bind pose, Everyday theme and the same atrium mark. Compare the full PNG and unscaled face, hair, left-hand and right-hand crops. Match renderScale and buffer dimensions across revisions. The probe uses its own camera for portraits, so verify LOD transitions separately with the live chase camera.

## Lighting, sampling and silhouette AA

Both Tripo rigs use bind-space height and atlas colour to approximate skin (roughness 0.62) and dark hair (0.43). Cloth outside those masks retains its GLB roughness. All NPC standard materials share the neutral fill and cubic Fresnel rim, with named separate skin and hair surfaces adjusted individually. Check dark collars and skin bordering hair for mask bleed. Late avatar uploads cover both accent-light states in Balanced and Detailed. Detailed also stages screen, linear-target and shadow-depth bindings where the mesh casts a shadow. The first-person hand starts loading with the avatar and mounts after preparation. Hidden ordinary can meshes share geometry and materials with their pickup copies so the scene sweep covers the non-instanced program. Sitting and carrying animate the existing skin. The boy has two shipped geometries and shares one atlas across them.

Open the mall with `?tracePrograms=1` and read `__mall.performanceReport().programTrace` to inspect new renderer cache keys. Samples distinguish live draws from intervening warm work, include the warm phase and zone, and record player LOD, seat, product, NPC mount, admission and NPC LOD transitions even when the program count stays flat. Use the uninstrumented route for frame-time acceptance.

Avatar anisotropy is 2× on phones and 4× on tablets/desktops subject to hardware support. Mip bias is zero. The player switches down at 64 CSS px and back up at 160 CSS px. The Tripo boy retains the existing player-distance LOD because its admission and updates run on physics ticks without a camera.

Keep the tier's present AA policy pending a matched live test. Record the GL sample count on the default framebuffer and the base render target's samples on Detailed. At matched drawing-buffer sizes, compare direct output and Detailed compositing while walking and rotating past the same hair outline. On a measurement build compare 2× MSAA on the base target or FXAA independently. Test 100%, 80% and 60% render scale. Judge temporal shimmer in motion and skin/atlas softening in the native crops. Record GPU time and p95/p99 without recording; retain a change only if it improves the silhouette within the device targets.

## Redrawn player face

The editable [face artwork](../scripts/avatar_art/visitor-face.svg) uses the original rig's frontal bind pose. The SVG has a 500-unit design grid and renders at 4096². The original nose and chin positions, iris centres, red hair, light skin and purple spectacles provide the registration. The skin layer contains the eyelids, lashes, brows, two catchlights per iris, mouth, blush and lens reflections. The rim layer belongs to the raised spectacle surface. Keeping it off the cheeks prevents a second outline when the character turns.

The walk route starts with the phone geometry and a 512² near atlas from the shared startup pack. After entry, the same near geometry receives a warmed WebP atlas sized to the selected startup profile. Balanced and Detailed on desktop and tablet receive 2048². Phones and Low receive 1024². The separate 512² far mesh also loads after entry and uses the live skeleton. Texture sampling remains capped at 4× on desktop/tablet and 2× on phones. The near-atlas upgrade keeps the existing skin, UV layout, animations and lighting shader.

### Rebuild the player

Use the original 4K GLB identified by the SHA-256 in the [visitor source manifest](../demos/corporate/gjh/v11/assets/gjh-tripo-visitor-source.json). For the offline build, make `sharp` and `gltf-validator` available to Node, provide the meshoptimizer simplifier from Three, and select a Python with Pillow and NumPy. Set `BLENDER` to Blender 5.1. On a sandboxed Mac that needs the startup workaround, set `BLENDER_METAL_GUARD` to the process-local dylib and use the temporary Blender executable described in [the signage build](gjh-v11-signage-assets.md).

```sh
out=$(mktemp -d)
node scripts/avatar_art/render_face.cjs "$out"
node scripts/bake_tripo_candidate.mjs "$SOURCE_GLB" "$out/2k.glb" "$SIMPLIFIER" \
  "$out/overlay.png" "$out/skin.png" "$out/1k.glb" "$out/512.glb"
```

Blender packs the face charts at 4.00 times the texels per square metre of the remaining charts. The desktop bake integrates four vector-layer samples per destination texel and compensates for bilinear sampling on painted edges. The phone bake protects the front of the head during simplification. The desktop, phone and far meshes have 13,997, 11,763 and 3,921 triangles respectively.

The bake validates each GLB before writing it. Use fresh output paths. The [matched camera renders and measurement commands](evidence/gjh-v11-face-redraw/README.md) use the previous shipped 2K mesh as the baseline. The Tripo boy uses a separate registration for his head mesh and shared LOD atlas.

For a browser-free smoke test, run `node --test tests/gjh_tripo_visitor.test.mjs tests/gjh_model_warmup.test.mjs`. The tests parse the shipped rigs, inspect atlas dimensions and exercise the loading and warmup paths. Early-entry frame counts require a live browser.

## Redrawn NPC faces

The Tripo boy and modular walkers use independently registered versions of the player artwork. The boy preserves his shared LOD UVs. The modular body uses Blender's face-weighted packer. The textureless V2 fallback shades its existing facial geometry. Tier selection happens once at startup and the existing sliced uploader prepares each rig before admission. [NPC inventory, tier budgets, rebuild and matched portraits](evidence/gjh-v11-npc-face/README.md)

## Round 2 player portrait (historical baseline)

Desktop and tablet sessions starting on Balanced or Detailed load `assets/gjh-tripo-visitor-2k.glb`. Low and phone sessions use the 1K near mesh. The texture choice lasts for the session so changing quality while walking never initiates a 2K upload. A missing 2K download falls back to the 1K rig. Both near meshes use the existing 512² far LOD. The Round 2 2K map replaced the 1K allocation (+16 MiB including RGBA8 mips) and used the GPU's maximum anisotropy, linear magnification, trilinear minification and implicit zero mip bias. Eyes and glasses share this opaque map. The loader drives the existing sliced model queue and waits for its GPU fence before the first visible draw. A per-material uniform adds neutral fill in proportion to the head's lighting deficit, retaining the existing rim and shared shader program.

The Round 2 CPU bake verified the 4K source hash and bind matrices, keeps the runtime clips, and simplifies the geometry while preserving UV seams. Permissive simplification in the earlier candidate introduced wrong-colour triangles across atlas charts. The head charts receive sqrt(3) times the linear sampling density of the body charts, relative to their density in the source. Four-pixel source-colour gutters separate charts.

```sh
export NODE_PATH="/path/to/Blender-3D-Gallery/node_modules"
export PYTHON="/path/to/python-with-pillow"
node scripts/bake_tripo_candidate.mjs /path/to/motion-BRgAS3uq.glb /tmp/portrait-2k.glb \
  "$NODE_PATH/three/examples/jsm/libs/meshopt_simplifier.module.js"
```

Supply an unused output path. The Round 2 file had 13,997 triangles, 3,484,156 bytes and SHA-256 `c18ad275c1c255e02cd6d0bd5750f796ab9945f982f3ec68487209c6a3b81ff9`. Khronos validation reported zero errors and one existing skinned-mesh warning.

### Measurements

In matching 500×500 front-view software renders, with bilinear sampling, no shadows and opaque geometry, the 1K near mesh showed the same dark hair and forehead streaks as the owner screenshots. Interior pixels at least 0.035 model units deeper than three of their four immediate neighbours fell from 1,299 to 4 (4K source 5). This isolates cracks in the old simplified mesh. The fixed brow, hair and glasses retained the source colours.

`python scripts/avatar_sharpness.py BEFORE.png AFTER.png` measures the supplied 600×600 Detailed close-up framing. Use the same pose, viewport and exposure for a texture comparison. The four-neighbour Laplacian uses display-referred luma; skin luminance averages linearized sRGB over fixed forehead, nose and cheek samples. Override rectangles with `--face` and repeatable `--skin` for other framings.

| Pair | Facial variance ratio | Mean linear skin luminance |
| --- | ---: | ---: |
| Owner's headed Chrome captures, old → main before Round 2 | 0.61× | 0.695 → 0.315 |
| Unchanged offline lighting, 1K → shipped 2K | 0.59× | 0.673 → 0.683 |

[Offline 1K portrait](gjh-v11-references/player-face-1k-offline.png) · [Offline 2K portrait](gjh-v11-references/player-face-2k-offline.png)

The offline comparison uses face rectangle `110,222,389,400` and skin rectangle `225,180,264,204`. Against the original 4K mesh rendered with the same camera and sampling, face-region RGB PSNR improves from 19.50 to 25.28 dB. Geometry cracks add high-frequency energy to the old mesh, and the full-face Laplacian ratio remains below 1.6×. Offline lighting does not exercise the runtime fill. A new headed Chrome capture, program trace and uninstrumented early-entry frame timings remain outstanding.

Run cold early entry on all three tiers (zero frames ≥50 ms), compare program counts before/after LOD transitions and NPC admission, then run unrecorded phone/tablet/PC laps including the atrium. Target 30/60/60 FPS and compare GPU time, drawing buffer and upload spikes. Verify peak triangles/draws within 220k/70, 300k/90 and 420k/110 respectively. Repeat after ten minutes on the real devices.
