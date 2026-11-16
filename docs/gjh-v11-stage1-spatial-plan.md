# GJH V11 stage 1: refined virtual mall spatial plan

Date: 15 November 2026 (Asia/Singapore)
Status: **internally checked conceptual design, awaiting owner review; not implemented**. The footprint and coordinates are design assumptions for a virtual mall, not measurements of GJH premises or a real building design. The [stage 1 ground/upper 2D plan](references/gjh-mall-floorplan-stage1.png) supersedes the earlier rough diagram for spatial planning; the earlier image remains as historical context. The [coordinate data](references/gjh-mall-spatial-plan.json) is the source used to render this diagram and run the geometric checks. It is a planning artifact, not a runtime spatial API. The [drawing source](references/gjh-mall-floorplan-stage1.py) and [checker](references/gjh-mall-spatial-check.py) are reproducible local tools.

The subsequent [stage 2 pilot](gjh-v11-stage2-spatial-pilot.md) centralizes the existing three-store runtime only; it does not implement this proposed 17-store geometry.

## Design decisions and coordinate system

The proposed ground shell stays **70 m wide × 60 m deep**, 4,200 m². A 12 m opening at the south leads to an arrival area, map and guest service. Seventeen independent retail modules face a continuous 6 m-wide rectangular circulation loop. North slots retain the existing left-to-right sequence New Moon, MILI, GOGO. A low planted area, two lounges and a 14 × 8 m flexible seasonal area sit inside the loop; there is **no central gold ring**. Everyday, Lunar New Year, Christmas and Diwali decorations must remain within the event reservation and must not intrude on the ring, lift access, sightlines or door approaches.

Plan coordinates are metres `(x, y)` with `(0, 0)` at the south-west shell corner, x increasing east/right and y north/up. The north facade is y=60. A proposed future mapping is `worldX = x - 35`, `worldZ = 30 - y`; height is a separate coordinate. This is **not** the current 3D geometry and changes existing absolute store and lift coordinates. The converter, map orientation, portals, collisions and existing persistent IDs must be explicitly migrated and verified in later implementation.

Retail blocks are gross planning rectangles with no wall thickness deducted. Storefront openings are proposed clear spans before frames or protrusions: **5 m** for each north store, **4 m** for each side store. Arrival points below are **outside** the threshold; inside points are conceptual target points. Labels S01–S17 are stable plan references, not new production store IDs. Candidate names are proposals rather than established tenancy, ownership, current distributorship or authorization. The [brand-source and rights notes](gjh-v11-expanded-mall-layout.md#candidate-brand-allocation-and-evidence) continue to apply; until individually verified, use neutral placeholder content and do not invent products or marks. New Moon retains its four current SKU journeys; MILI and GOGO retain their current demonstrated brand-only limitations.

## Seventeen independent storefronts

Coordinates list southwest–northeast block corners; a door is a line segment `(x0, y0)–(x1, y1)`. Arrival and inside positions lie on opposite sides of the opening. Wall thickness, sliding leaf travel, fixed displays and interaction/camera behavior remain implementation work.

| Slot | Proposed candidate | Block m | Entrance segment m | Arrival / inside m | Content state |
| --- | --- | --- | --- | --- | --- |
| S01 | New Moon | (10, 48)–(20, 60) | (12.5, 48)–(17.5, 48) | (15, 46.3) / (15, 49.7) | Existing demo |
| S02 | MILI | (20, 48)–(30, 60) | (22.5, 48)–(27.5, 48) | (25, 46.3) / (25, 49.7) | Existing demo |
| S03 | GOGO | (30, 48)–(40, 60) | (32.5, 48)–(37.5, 48) | (35, 46.3) / (35, 49.7) | Existing demo |
| S04 | Borsch Med | (40, 48)–(50, 60) | (42.5, 48)–(47.5, 48) | (45, 46.3) / (45, 49.7) | Candidate / unverified |
| S05 | Pien Tze Huang | (50, 48)–(60, 60) | (52.5, 48)–(57.5, 48) | (55, 46.3) / (55, 49.7) | Candidate / unverified |
| S06 | Flying Wheel | (0, 40)–(10, 48) | (10, 42)–(10, 46) | (11.7, 44) / (8.3, 44) | Candidate / unverified |
| S07 | Gu Long | (0, 32)–(10, 40) | (10, 34)–(10, 38) | (11.7, 36) / (8.3, 36) | Candidate / unverified |
| S08 | Skippy | (0, 24)–(10, 32) | (10, 26)–(10, 30) | (11.7, 28) / (8.3, 28) | Candidate / unverified |
| S09 | SPAM | (0, 16)–(10, 24) | (10, 18)–(10, 22) | (11.7, 20) / (8.3, 20) | Candidate / unverified |
| S10 | California Mexico | (0, 8)–(10, 16) | (10, 10)–(10, 14) | (11.7, 12) / (8.3, 12) | Candidate / unverified |
| S11 | Hormel | (0, 0)–(10, 8) | (10, 2)–(10, 6) | (11.7, 4) / (8.3, 4) | Candidate / unverified |
| S12 | Zeria | (60, 40)–(70, 48) | (60, 42)–(60, 46) | (58.3, 44) / (61.7, 44) | Candidate / unverified |
| S13 | Sony | (60, 32)–(70, 40) | (60, 34)–(60, 38) | (58.3, 36) / (61.7, 36) | Candidate / unverified |
| S14 | LG | (60, 24)–(70, 32) | (60, 26)–(60, 30) | (58.3, 28) / (61.7, 28) | Candidate / unverified |
| S15 | Casio | (60, 16)–(70, 24) | (60, 18)–(60, 22) | (58.3, 20) / (61.7, 20) | Candidate / unverified |
| S16 | GP | (60, 8)–(70, 16) | (60, 10)–(60, 14) | (58.3, 12) / (61.7, 12) | Candidate / unverified |
| S17 | Gigaset | (60, 0)–(70, 8) | (60, 2)–(60, 6) | (58.3, 4) / (61.7, 4) | Candidate / unverified |

North modules S01–S05 each measure **10 × 12 m** (120 m²); side modules S06–S17 each measure **10 × 8 m** (80 m²). Each has its own proposed door; these rectangles do not assert usable net retail area or actual fitting-out.

## Public areas and circulation

| Planning block | Purpose | Bounds m | Gross area |
| --- | --- | --- | ---: |
| LIFT — Lift + ground lobby | Lift shaft and waiting / approach space | (16, 34)–(24, 42) | 64 m² |
| WC — Facilities | Future facilities; connection from east aisle | (46, 34)–(54, 42) | 64 m² |
| LW — West lounge | Seating and rest | (18, 20)–(24, 28) | 48 m² |
| LE — East lounge | Seating and rest | (46, 20)–(52, 28) | 48 m² |
| P — Low planting | Low planting; preserve views | (30, 30)–(40, 34) | 40 m² |
| E — Seasonal / event | Removable seasonal installations | (28, 16)–(42, 24) | 112 m² |
| D — Directory | Map and wayfinding kiosk; public approach from north | (18, 1)–(22, 5) | 16 m² |
| G — Guest service | Guest information and assistance; public approach from north | (48, 1)–(52, 5) | 16 m² |

A clear entrance approach spans x=32…38, y=0…12. The entrance opening is x=29…41 on y=0. The diagram's gold loop centerline runs `(13,9) → (57,9) → (57,45) → (13,45) → (13,9)`; its corners are planning waypoints rather than claims about turning animations. The 6 m ring occupies west x=10…16, east x=54…60, north y=42…48 and south y=6…12, within their shared outer rectangle x=10…60, y=6…48. The southmost S11/S17 approaches continue from the loop into the arrival area; they do not require crossing another store. The map and guest service can be approached from the north and do not overlap the entrance centerline or ring. Their interiors and actual interactions are not specified yet.

Do not place tables, queued visitors, seasonal displays, door leaves or other colliders in the designated ring. The stage 1 checker tests the centerline and each arrival branch against the entire reserved public-zone rectangles; it does **not** simulate queues, door motion or actual storefront contents. Sightlines, interactive signs, local wayfinding, seasonal height/camera occlusion, physical movement and seating approach need runtime visual review. A future decorative element may occupy only its allowed block, with a documented accessible detour if any real clearance test fails.

## Lift, upper landing and service access

- **Ground lift reservation:** 8 × 8 m at `(16,34)–(24,42)`, connected on its west to the west loop. A 4 × 4 m shaft occupies `(20,36)–(24,40)` and the lobby occupies `(16,34)–(20,42)`. The shaft doorway is the west-facing segment `(20,37)–(20,39)`.
- **Cabin and threshold:** proposed 3.2 × 3.2 m cabin envelope `(20.4,36.4)–(23.6,39.6)` with a west opening `(20.4,37)–(20.4,39)`. The 0.4 m shaft-to-cabin gap is covered at a stopped landing by the aligned `(20,37)–(20.4,39)` threshold; it must be blocked when the cabin is absent. Door and barrier behavior is an implementation requirement, not modelled in the current demo.
- **Upper landing:** a conceptual 12 × 12 m slab `(16,32)–(28,44)` at +7.2 m, with the identical shaft footprint and west-facing opening; `(16,34)–(20,42)` is the landing/approach. Create a real shaft void, guard the slab perimeter and provide a continuous safe path around the shaft. The upper floor is a small viewing/rest area, not a second 17-store floor; its furniture and exits remain future work.
- **Runtime compatibility:** the existing V2 lift sits at `(worldX=0, worldZ=16)` and upper +7.2 m; the proposed shaft center converts to `(worldX=-13, worldZ=-8)`. Rebuilding the upper slab, aligning entry/exit and preserving travel interruption, recovery and v1 behavior are required later. The current player rejects elevator activation while pushing a cart: this plan's lift is **visitor-only** until a separately designed and verified cart interaction exists. Do not promise cart access to the upper level.
- **R1/R2:** the two 10 × 12 m north corner blocks remain non-public service reserves. R1's proposed opening is `(3,60)–(7,60)` and R2's `(63,60)–(67,60)`, on the exterior north boundary. This resolves the diagrammatic access side only: no outside loading route, land, delivery operation, accessible service path or physical egress is established. In the virtual demo these blocks stay closed/neutral; add neither an inaccessible guest entrance nor a fake operational service corridor.
- **Facilities:** the east 8 × 8 m reservation connects through its east face `(54,36.5)–(54,39.5)` to the loop. Treat this as a placeholder for future facilities, not a claim that toilets, plumbing or an accessible restroom already operate.

## Area reconciliation

| Disjoint allocation | Calculation | Area |
| --- | --- | ---: |
| North stores | 5 × 10 × 12 | 600 m² |
| Side stores | 12 × 10 × 8 | 960 m² |
| R1 + R2 | 2 × 10 × 12 | 240 m² |
| Common area | 50 × 48 | 2,400 m² |
| **Total ground shell** | 600 + 960 + 240 + 2,400 | **4,200 m²** |

Within the 2,400 m² common area, the 6 m ring is 50 × 42 minus 38 × 30 = **960 m²**. Its inner rectangle is 38 × 30 = **1,140 m²**. The six interior reserved zones (lift, facilities, two lounges, planting and event) use 64 + 64 + 48 + 48 + 40 + 112 = **376 m²**, leaving **764 m²** of that inner rectangle unreserved. The south arrival strip x=10…60, y=0…6 is **300 m²**; its two 4 × 4 m directory/service reserves total **32 m²**, leaving **268 m²**. Thus 960 + 1,140 + 300 = 2,400 m², and no public zones are added a second time. The 12 × 12 m upper slab is **144 m² gross**, separate from ground-floor area and including its 16 m² shaft void; its gross projection is not an additional ground allocation.

## Clearances and verification boundary

The current controller defines a walking capsule radius **0.3 m** and pushing-cart cylindrical collider radius **1.4 m**. For this plan only, the checker adds **0.25 m** to the relevant radius: a proposed 1.65 m cart envelope requires 3.3 m diameter, leaving 0.7 m nominal total width in a 4 m side doorway before walls, frames, steering and tolerances; the 6 m ring leaves 2.7 m. These are simple center-point/circular-envelope arithmetic checks, not claimed accessibility standards, construction clear widths, two-way traffic performance or proof the cart can turn at every actual doorway. The checker tests reserved rectangles and portal centers, not the future 3D navmesh or interactive door.

Reproduce using Python 3 and Pillow, with the local paths adjusted for other machines:

```sh
python docs/references/gjh-mall-spatial-check.py
python docs/references/gjh-mall-floorplan-stage1.py
```

The checker verifies 17 distinct non-overlapping store blocks, gross area arithmetic, zone/ring separation, 17 proposed approach branches, opening widths, a 1.65 m cart envelope against reserved blocks, equal lift shaft/landing alignment and the two reserve boundary openings. It does not independently prove continuous 3D connectivity through future walls, all fixtures, camera visibility, animation, performance, a real controller, real-world egress or regulatory compliance. Later stages must verify actual visitor and cart movement both directions, each entrance, inside-store clearance, lift transitions and recovery, and desktop/mobile views in the running application. Real-world use would need separately qualified design and approvals.

## Remaining decisions and phase boundary

The owner can review the resulting spatial direction and candidate placement. The proposal does not establish a final tenant lineup, approved external service access, restroom contents, exact wall thickness, physical building compliance or production assets. Stage 2 should pilot a shared spatial definition and map/directory projection without losing existing IDs and journeys; stage 3 must test a reversible actual shell. Seasonal installation assets and controls remain stages 9–10. No 3D runtime behavior changes in stage 1.
