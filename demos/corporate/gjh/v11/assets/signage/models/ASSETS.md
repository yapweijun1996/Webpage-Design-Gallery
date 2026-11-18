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

## Runtime handoff

- Load each model once. Reuse geometries by asset and primitive and deduplicate PBR materials by their canonical names. The manifest stores sRGB authoring colours and numeric finish parameters. GLB factors are linear RGB. Match every value when deduplicating a named finish. Preset material overrides select another named finish from the manifest.
- The downlight contains a downward-facing emissive mesh. Runtime lighting and its quality-tier gating belong to the signage system. The frosted blade insert uses opaque metallic-roughness material parameters.
- Use `storeSlots` with the existing brand kit and logo receipts. Treat `iconMotif` and [preset-icons.svg](preset-icons.svg) as decorative unbranded template artwork. Use the verified store artwork for brand marks. The `official-crescent` motif is New Moon's only close-range 3D relief.
- The fascia dimensions in each preset are inclusive limits for the finished sign. Fit the name within those limits. The smallest panels can be secondary identifiers. Preserve the full name on the fascia or in the accessible label where a one-line lock-up would shrink it below the target.
- At distance, use a single flat baked-name plane with the approved artwork and fascia colours. Use the available contrast-tested palette for every tier. Trim profiles, fixtures and the relief are close-range assets. The GLBs use zero textures. Far-plane label baking, atlas, distance thresholds and draw-call measurements belong to the runtime integration.
