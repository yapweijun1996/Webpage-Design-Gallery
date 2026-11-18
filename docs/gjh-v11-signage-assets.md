# GJH v11 signage assets

The kit contains ten static GLBs, eight style presets and a reproducible Blender source. The GLBs total **2,374 triangles and 141,076 bytes**. All use core glTF metallic-roughness materials, metre coordinates and zero textures. [Model contract](../demos/corporate/gjh/v11/assets/signage/models/README.md) · [Manifest](../demos/corporate/gjh/v11/assets/signage/models/manifest.json)

## Build and extend

From the repository root, use Blender 5.x and Python 3.10 or newer. The build exports the models, validates the GLB bytes when creating the manifest, lays out the editable source scene and reimports the exports for the two CPU renders.

```sh
/Applications/Blender.app/Contents/MacOS/Blender -b -noaudio --factory-startup --disable-autoexec \
  --python-exit-code 1 --python scripts/build_signage_kit.py
python3 scripts/validate_signage_glb.py
python3 scripts/build_gallery.py --check
python3 scripts/check_ssot.py
```

For mesh changes, edit [kit.json](../demos/corporate/gjh/v11/assets/signage/sources/kit.json) and the appropriate builder in [build_signage_kit.py](../scripts/build_signage_kit.py). To add a module, give it a unique `sign_` name, set its dimensions, expected finish classes, triangle limit and provenance, then add its geometry branch. Model in `(horizontal, height, depth)` coordinates. The builder maps them to Blender `(X, −Y, Z)` axes and the exporter produces glTF +Y up and +Z forward. Keep normals and local bounds consistent with the model contract. Run the build again and check the resulting hashes and budget changes. For a preset revision, update `presets.json` and rerun the validator.

On this macOS sandbox, the signed app's Blender 5.1.2 binary crashed at startup in Metal detection before Python ran. The completed build used the existing process-local null-string guard and a temporary ad hoc signed Blender copy from the earlier asset job. Cycles used the CPU. The same fallback can be reproduced with the installed app if the stock command crashes in the same function. [Blender 5.1.2 Metal probe](https://raw.githubusercontent.com/blender/blender/v5.1.2/source/blender/gpu/metal/mtl_backend.mm)

```sh
signage_work=$(mktemp -d)
cat > "$signage_work/metal-null-guard.c" <<'C'
#include <string.h>
static char *guarded_strstr(const char *haystack, const char *needle)
{
    return haystack == NULL ? NULL : strstr(haystack, needle);
}
__attribute__((used, section("__DATA,__interpose")))
static const struct { const void *replacement; const void *original; }
guard = { (const void *)guarded_strstr, (const void *)strstr };
C
clang -dynamiclib "$signage_work/metal-null-guard.c" -o "$signage_work/metal-null-guard.dylib"
mkdir -p "$signage_work/Blender.app/Contents/MacOS"
cp /Applications/Blender.app/Contents/MacOS/Blender "$signage_work/Blender.app/Contents/MacOS/"
ln -s /Applications/Blender.app/Contents/Resources "$signage_work/Blender.app/Contents/Resources"
signage_blender="$signage_work/Blender.app/Contents/MacOS/Blender"
codesign --force --sign - "$signage_blender"
BLENDER_USER_RESOURCES="$signage_work/user" DYLD_INSERT_LIBRARIES="$signage_work/metal-null-guard.dylib" \
  "$signage_blender" -b -noaudio --factory-startup --disable-autoexec \
  --python-exit-code 1 --python scripts/build_signage_kit.py
```

## Preset library

The [owner's sheet](gjh-v11-references/ref-signage-system-sheet.png) supplies the visual direction. T1, T4, T5, T6 and T7 retain the readable width pairs interpreted in template order. T2 retains the readable 8 m maximum and uses a 2.4 m minimum. T3 retains the 1.5 m endpoint and uses a 6 m maximum in place of the reversed second endpoint. T8 uses an authored range because there is no eighth row. The height and depth columns are too inconsistent to use directly. Heights and depths below are authored limits that fit the modular frame and the 6 m × 0.9 m check. Validate all three dimensions before assembly.

| Preset | Width × height × depth ranges (m) | Finish and treatment | Existing stores |
| --- | --- | --- | --- |
| `t1-classic` | 4–8 × 0.60–1.20 × 0.040–0.060 | Green lacquer, brass keyline, cream serif and warm downlights | New Moon, Gu Long, California Mexico |
| `t2-fashion` | 2.4–8 × 0.60–1.20 × 0.035–0.060 | Brushed charcoal, monoline outline and serif caps | Unassigned |
| `t3-cafe` | 1.5–6 × 0.60–1.30 × 0.045–0.060 | Timber slats, ivy, cream serif and steam-cup motif | MILI, Flying Wheel |
| `t4-tech` | 0.6–3 × 0.60–1.20 × 0.035–0.060 | Dark gunmetal, blue emissive outline and monitor motif | Sony, Casio, GP, Gigaset |
| `t5-book` | 0.6–2.2 × 0.60–1.20 × 0.035–0.060 | Green lacquer, gold open-book outline and serif | Unassigned |
| `t6-beauty` | 0.6–3 × 0.60–1.20 × 0.035–0.060 | Rose gradient, cream serif and lotus motif | Borsch Med, Pien Tze Huang, Zeria |
| `t7-home` | 0.6–2 × 0.60–1.20 × 0.035–0.060 | Dark brown lacquer, brass keyline, serif and house motif | SPAM, Hormel, LG |
| `t8-kids` | 1.8–4 × 0.60–1.20 × 0.035–0.060 | Pastel enamel, dark multicolour lettering and bear motif | GOGO, Skippy |

The finish library includes brushed black metal, brass bar and plate, gunmetal, gold disc, green lacquer and silver ring. The eight templates share the frame geometry. The rose gradient and multicolour text are specified as 2D palette data for runtime composition. Decorative icons ship as a flat SVG sprite. The existing slot artwork and actual store names remain the source for identity. [Preset data](../demos/corporate/gjh/v11/assets/signage/models/presets.json) · [Brand artwork receipts](../demos/corporate/gjh/v11/assets/brands/logo-sources.json)

The New Moon relief follows the official SVG's standalone yellow crescent path. The build adaptively samples the cubics with a 0.20 SVG-unit flatness tolerance and bevels the front edge. The local GJH loader SVG is a trace of the official PNG. The official vector source needed for a GJH relief is unavailable in the checked-in library. The ivy is original procedural geometry with folded leaves and three stems. [New Moon source artwork](../demos/corporate/gjh/v11/assets/new-moon-logo.svg) · [GJH loader provenance](gjh-v11-loader.md)

## Measured results

| GLB | Triangles | Bytes |
| --- | ---: | ---: |
| `sign_frame_corner` | 64 | 4,948 |
| `sign_frame_edge_h` | 40 | 3,832 |
| `sign_frame_edge_v` | 40 | 3,916 |
| `sign_backplate` | 92 | 5,656 |
| `sign_downlight` | 244 | 13,984 |
| `sign_blade_bracket` | 368 | 20,240 |
| `sign_blade_panel` | 460 | 25,644 |
| `sign_timber_slat` | 92 | 5,672 |
| `sign_logo3d_new_moon` | 470 | 23,124 |
| `sign_ivy_swag` | 504 | 34,060 |
| **Total** | **2,374** | **141,076** |

The local validator reads the embedded JSON and BIN chunks, indices, normals, coordinates, bounds and material factors. It checks every GLB against its manifest and the preset ranges, artwork references, slot assignments and lettering colours. Khronos glTF Validator `2.0.0-dev.3.10` reported zero errors and warnings on all ten assets. The mall's vendored Three.js r170 `GLTFLoader` parsed all ten GLBs in Node with the recorded triangle counts and dimensions. With the documented transforms, all eight corner-to-rail seams align at 1.0 × 0.6 m, 6.0 × 0.9 m and 8.0 × 1.2 m. A second Blender build produced the same ten GLB hashes. The v11 vendor directory ships the plain GLTFLoader. The uncompressed indexed exports retain module boundaries and establish the baseline for later optimisation measurements.

The Blender check reimports the delivered GLBs and shares mesh data and named finishes across placements. The 6.0 × 0.9 m fascia uses four native corners, four longitudinally resized straight rails, one backplate, five repeated downlights and one relief. The close-up shows the traced silhouette and bevel. Independent visual review confirmed the brass keyline, green sheen, five warm pools of light, readable display name, relief profile and the sampled assemblies. The fixtures use compact rectangular housings, with softer washes than the round recessed spots in the reference. [Lineup PNG](gjh-v11-signage-system-assets/kit-lineup.png) · [Relief PNG](gjh-v11-signage-system-assets/new-moon-relief.png) · [Hash and projection evidence](gjh-v11-signage-system-assets/evidence.json)

At 393 × 852 CSS px, the expanded portrait camera's 100° vertical FOV gives a face-on projected x-height of **21.75 px at 6 m, 14.50 px at 9 m, 10.87 px at 12 m and 8.70 px at 15 m**. The calculation uses the measured 0.365 m `x` glyph height of the Blender typesetting sample and the scene's projection formula. The eight palettes measure **6.04:1 to 13.67:1** at their least-contrasting text/background pairs. The ratios use configured sRGB colours, including both ends of the rose gradient. They are design measurements before runtime lighting, fog, bloom and compositing. [Camera framing source](../demos/corporate/gjh/v11/assets/player.js)

## UNVERIFIED

- Live 393 px phone readability, oblique views, tier transitions, baked far-plane sharpness, real-scene draw calls, frame time and GPU memory. The parallel runtime job owns the sign assembly and distance tiers.
- Pages delivery. The current gallery publisher includes the mall index in a clean output build and omits `assets/signage/` because its nested-asset list has no signage entry. The integration must include the runtime files under `models/` in its publishing change.
- `browser_gallery.py`, `browser_gjh_demos.py` and `browser_pwa.py` reached local HTTP server startup with the existing Playwright and Pillow environment. The sandbox denied the `127.0.0.1` bind before browser launch. Asset parsing with the project's loader and offline Blender previews ran independently.
