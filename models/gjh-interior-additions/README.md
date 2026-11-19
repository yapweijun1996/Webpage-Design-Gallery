# GJH V11 interior additions

Eleven props generated with Tripo Studio from owner-supplied reference images (oak, matte dark green, brushed brass), converted in Blender to texture-free, flat-colour static GLBs that pass the strict loader in `demos/corporate/gjh/v11/assets/static-asset.js`.

- `sources/GJH_NEW_*.glb`: converted exports (temporary ids). Provenance, per-asset triangle counts and materials are in `data/gjh-interior-additions.json`.
- `python scripts/gjh_interior_additions.py` rewrites each root node to its backlog id (`GJH-PUB-001` and so on), writes `demos/corporate/gjh/v11/assets/GJH_<CAT>_<NNN>.glb` and the generated `interior-additions-registry.js`; add `--check` to verify them.
- All eleven are registered (`INTERIOR_ADDITIONS`, `placed: false`) and none is mounted through the furnishings registry yet. The upper level (`assets/upper-level.js`) loads the temporary-id bench, floor lamp and display table directly from `assets/gallery-assets/upper-level/` with the same hashes. Ids: ottoman GJH-PUB-001, planter GJH-PUB-007, directory column GJH-PUB-016, information desk GJH-PUB-018, garment rail GJH-DSP-009, end-cap shelf GJH-DSP-003, island table GJH-DSP-007, cashier counter GJH-STF-016, frame panel GJH-STF-014, globe pendant GJH-LGT-008, decorative lamp GJH-LGT-017.
- The two-seat bench would be GJH-PUB-002, which already exists in the pilot; it is not replaced.
- Rights: the redistribution terms of Tripo output are unspecified. The owner must confirm them before these files count as cleared.
- To mount a kind, set `placed` to true in the data file, rebuild, add its file to `data/gjh-startup-assets.json`, call `furnishings.place(kind, ...)` and add a collider; then run `docs/interiors_probe.py` and `docs/walk_probe.py`.
