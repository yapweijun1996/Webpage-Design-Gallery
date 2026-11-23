# GJH interior dressing, round two

One static Blender 5.1 GLB per shop supplements the original tier-specific anchor. Each detail GLB uses slot-local metres at the lot origin. All tiers reuse the same dressing. The physical envelopes, tier selection and model-backed displays are defined in the web project. The model files refer to the adjacent 256 × 256 `showroom-atlas.png`.

Set `GALLERY` to the Blender-3D-Gallery checkout, `STORE_ASSETS` to the web checkout's `demos/corporate/gjh/v11/assets`, and `BLENDER` to Blender 5.1. On headless macOS, use the process-local guard invocation documented in the gallery's `docs/gjh-v11-interiors-build.md`. Blender reads the existing gallery lantern and plate profiles. The original anchor pipeline remains in `scripts/gjh_interiors/build.py` in that repository.

```sh
python3 scripts/gjh_interiors/illustrate.py "$STORE_ASSETS/brands" "$STORE_ASSETS/interiors/showroom-atlas.png"
"$BLENDER" -b -noaudio --factory-startup --disable-autoexec --python-exit-code 1 \
  --python scripts/gjh_interiors/build_rooms.py -- --gallery "$GALLERY" --output "$STORE_ASSETS/interiors"
node scripts/gjh_interiors/package_rooms.mjs --gallery "$GALLERY" --output "$STORE_ASSETS/interiors"
node scripts/gjh_interiors/package_rooms.mjs --check --gallery "$GALLERY" --output "$STORE_ASSETS/interiors"
```

Illustration uses Pillow. Packaging uses the Blender gallery's installed `gltf-validator`. It validates the 42 active anchors and 17 room detail GLBs against the runtime files, measures mesh instances, and writes the combined manifest and loader index. S01 uses the [local crescent header source](../../models/gjh-new-moon-header/README.md) and S04 uses the [local open folio source](../../models/gjh-borsch-folio/README.md). The remaining anchor records retain the Blender gallery's original hashes. The manifest also binds the print sheet, registered logo images and room derivatives to SHA-256 hashes. Rebuild the web gallery and run its interior tests after packaging.

The Blender delivery in `exports/gjh-v11-interiors-round2` contains only the new room files and their shared sheet. To rebuild it, use that directory as the Blender output, copy in the shared sheet first, and pass `--models-only --brands "$STORE_ASSETS/brands"` to the packager. It reads the 42 reference anchors from the gallery's original export directory. The gallery branch ships the shared sheet so model rebuilding can also start directly from that image.

## GOGO freezer

The GOGO room builder reads the pinned editable freezer and bakes its 128 triangles
into the existing enamel batch. The 42-degree lid pose exposes the two steel baskets.
The cold socket supplies the floor, yaw and maximum dimensions. All tiers use the same room URL. A cached S03 room from release
`47af724f` is accepted at its original size only after its SHA-256 matches. Its
missing marker selects the original procedural chest. The V11 service worker
serves the reconnect page for offline navigation.

Run the room build and packaging commands above to rebuild the asset. To rebuild
only S03 from the project root, export the room before running the usual packager.

```sh
"$BLENDER" -b --python-exit-code 1 --python-expr \
  "import os, sys; from pathlib import Path; sys.path.insert(0,'scripts/gjh_interiors'); from build_rooms import export; export(3,Path(os.environ['GALLERY']),Path(os.environ['STORE_ASSETS'])/'interiors')"
node scripts/gjh_interiors/package_rooms.mjs --gallery "$GALLERY" --output "$STORE_ASSETS/interiors"
node --test tests/gjh_interiors.test.mjs
```

Export `GALLERY` and `STORE_ASSETS` for the single-room command. The
[asset notice](../../demos/corporate/gjh/v11/assets/interiors/s03-gogo-freezer-LICENSE.txt)
records the pinned source and the owner-project reuse terms.
