# GJH v11 signage model contract

[manifest.json](manifest.json) describes the GLBs and the shared material finish library. [presets.json](presets.json) defines eight styles, allowable dimensions and assignments keyed by the existing `S01`–`S17` brand slots. See the [build and evidence notes](../../../../../../../docs/gjh-v11-signage-assets.md) for reproduction and validation.

## Coordinates and assembly

Each plain glTF 2.0 binary has one identity-transform mesh node named after its file, starting with `sign_`. Units are metres. +Y is up and +Z faces visitors. The local origin is at the bottom centre of the rear bounds. Vertex bounds satisfy `minY = minZ = 0` and `minX = −maxX`. At zero rotation the module mounts against the `z = 0` plane. [Khronos glTF 2.0 specification](https://registry.khronos.org/glTF/specs/2.0/glTF-2.0.html#coordinate-system-and-units)

The standard fascia starts at **1.00 × 0.60 m**. Its backplate is 35 mm thick. The base frame reaches 46 mm in front of the wall, leaving room for a 17 mm relief mounted on the backplate within the 60 mm envelope.

For a fascia of width `W` and height `H`, use the following local positions and rotations about +Z. Coordinates use the fascia's bottom-centre-back origin. Let `C = 0.06 m` be the corner size and `R = 0.034 m` the outer rail width, as recorded in the manifest.

| Part | Position `(X, Y)` | Rotation | Scaling in the face plane |
| --- | --- | --- | --- |
| Backplate | `(0, 0)` | 0° | `X = W / 1.0`, `Y = H / 0.6` |
| Bottom-left corner | `(-W/2+C/2, 0)` | 0° | Native |
| Bottom-right corner | `(W/2, C/2)` | 90° | Native |
| Top-right corner | `(W/2-C/2, H)` | 180° | Native |
| Top-left corner | `(-W/2, H-C/2)` | 270° | Native |
| Bottom and top rails | `(0, 0)` and `(0, H)` | 0°, 180° | `X = (W-2C) / 0.88` |
| Left and right rails | `(-W/2+R/2, C)` and `(W/2-R/2, H-C)` | 0°, 180° | `Y = (H-2C) / 0.48` |

Keep corners at native size and scale straight pieces along their run only. The end profiles match, so straight pieces may also be tiled end to end with one fitted segment. Place the frame, rails and backplate at `Z = 0`. Adjust the whole assembly's Z scale around that plane if the mounting envelope requires it. The blade plate is two-sided. Its local +Z face is the front. Rotate a blade assembly at the wall mount to direct its faces along the arcade.

## Runtime sockets

The manifest registers all ten filenames and node IDs. A fresh Low view makes zero GLB requests. The first Balanced or Detailed update starts one fetch per registered file. Each successfully parsed module stays available across tier changes. A missing or undecodable file leaves its own procedural fitting in place. [Loader](../models.js) · [Hardware assembly](../hardware.js)

| Node ID | Close-range placement |
| --- | --- |
| `sign_backplate` | Lacquer support with its front 1 mm behind the atlas face. |
| `sign_frame_corner` | Four native mitres with quarter-turn rotations as above. |
| `sign_frame_edge_h`, `sign_frame_edge_v` | Stretch along the run between mitres. The upper and right profiles rotate 180°. |
| `sign_blade_bracket` | Local −X mounting end against the wall, with the arm turned toward the aisle. |
| `sign_blade_panel` | Turned 90° about Y with an atlas decal just outside each face. Both decals keep their outward winding. |
| `sign_downlight` | Three downward emitters along the upper rail in Detailed. |
| `sign_timber_slat` | Three vertical slats at each end of a timber fascia, clear of the central mark. |
| `sign_ivy_swag` | Hangs from each end of the café fascia above the timber. Its folded leaves render on both sides. |
| `sign_logo3d_new_moon` | Raised crescent fitted proportionally to the yellow path in S01's trimmed official SVG, in both near tiers. |

The shared material library in the manifest defines sRGB authoring colours, roughness, metallic factors, emission strength and sidedness. glTF stores linear RGB. The loader shares imported materials by name across files. The hardware template packs their canonical factors into vertex attributes and instances the assembly across nearby bays. The two café ends share an instanced ornament template. The crescent keeps its imported finish in the near relief batch. The kit adds zero textures, lights or decoders.

The kit presets specify eight design samples, dimensions and decorative motifs. The live mall keeps its existing bay dimensions, style assignments, approved logos and atlas artwork. It uses the baked fascia, blades and posters at distance in every tier. Detailed adds hardware downlights and extruded lettering. Missing crescent art uses the existing ink treatment for the tier. [Kit presets](presets.json) · [Unbranded motifs](preset-icons.svg) · [Live store configuration](../config.js)

## Verify and publish

Run `python3 scripts/validate_signage_glb.py` and `node --test tests/gjh_signage_models.test.mjs tests/gjh_signage.test.mjs` from the repository root. The release build copies the entire signage directory. The v11 offline shell precaches the manifest, preset definitions, icon sprite and colour tokens. All ten GLBs remain outside the shell precaches and startup model pack. [Tier measurements and headed checks](../../../../../../../docs/gjh-v11-signage-system.md)
