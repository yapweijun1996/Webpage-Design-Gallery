# GJH V11 interior additions

The owner confirmed public redistribution of these Tripo Studio models on 2026-11-20. The texture-free static GLBs in `sources/` were exported from Blender. The existing pilot bench retains GJH-PUB-002.

Edit `data/gjh-interior-additions.json` for positions, rotations, mounting surfaces and minimum graphics tiers. The gallery build runs `scripts/gjh_interior_additions.py` before bundling the world. It verifies the source hashes, retargets GLB root names and exports the active mesh bounds with the registry. Coordinates are world metres and rotations turn about +Y. The framed print pivots at the centre of its back and the pendant at its ceiling attachment. Floor props use bottom-centre origins.

| Placement | Registered props |
| --- | --- |
| West atrium lounge | PUB-001 ottoman, with a seat anchor facing the table |
| East atrium lounge | PUB-007 planter and LGT-017 arched reading lamp |
| West side of entrance | PUB-016 directory facing arriving visitors |
| East side of entrance | PUB-018 coat-check desk, DSP-009 garment rail, STF-014 framed print on the wall, LGT-008 globe on the arcade soffit |
| S08 Skippy | DSP-003 pantry display shelf |
| S13 Sony | DSP-007 accessory display table |
| S17 Gigaset | STF-016 side checkout counter |

The existing upper lounge keeps its separately authored furniture. Each new placement has a Rapier box computed from the same transformed GLB bounds as its draw. The ottoman has a temporary seat pan during loading. Other boxes become solid when their warmed batch attaches and follow the active graphics tier.

Low fetches the ottoman and entrance directory (2,195 triangles in one opaque draw). Balanced and Detailed add the remaining nine (13,949 triangles and two draws total before culling). Each GLB is fetched and converted in a separate idle slice. The two packed draws preserve per-vertex PBR finishes and skip ranges outside the camera or active shop. The model upload scheduler warms each draw before scene attachment. These optional GLBs are outside the startup pack.

Run `node --test tests/gjh_interior_additions.test.mjs` for the offline loader, placement, seat, collision and tier smoke tests. The shop sweep includes the new boxes and checks existing standing points, 1.2 m routes and 1.5 m turning circles. Full-scene budgets and cold frame times require the [headed lap and early-entry probes](../../docs/gjh-v11-probes.md). Walk the live routes using `docs/verify_interactions.py` and `docs/verify_upper_level.py`.
