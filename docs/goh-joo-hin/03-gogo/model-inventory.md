# S03 GOGO model inventory

Upstream paths were checked against [Blender-3D-Gallery main `0b71ed7e`](https://github.com/yapweijun1996/Blender-3D-Gallery/tree/0b71ed7ec0f79d9d938cf6edcd19d2fa74f7a4b3). Coordinates are local XYZ metres. A catalogue candidate requires a fit and rights check before replacing a shipped asset. [Shop brief](README.md) · [Floor plan](floor-plan.webp)

| Fixture | Placement | Web runtime | Blender Gallery |
| --- | --- | --- | --- |
| Potong parasol cart on a citrus sunburst | -2.35, 0.025, 2.05 | [Low GLB](../../../demos/corporate/gjh/v11/assets/interiors/s03-ice-cream-cart-potong-low.glb) · [Balanced GLB](../../../demos/corporate/gjh/v11/assets/interiors/s03-ice-cream-cart-potong-balanced.glb) | [Low](https://github.com/yapweijun1996/Blender-3D-Gallery/blob/0b71ed7ec0f79d9d938cf6edcd19d2fa74f7a4b3/exports/gjh-v11-interiors/s03-ice-cream-cart-potong-low.glb) · [Balanced](https://github.com/yapweijun1996/Blender-3D-Gallery/blob/0b71ed7ec0f79d9d938cf6edcd19d2fa74f7a4b3/exports/gjh-v11-interiors/s03-ice-cream-cart-potong-balanced.glb) |
| Twin dispenser on the right bar | 3.15, 1.26, 3.53 | Room programme placement. See the room detail and source notes for its shipped representation. | [Existing export](https://github.com/yapweijun1996/Blender-3D-Gallery/blob/0b71ed7ec0f79d9d938cf6edcd19d2fa74f7a4b3/models/drink-dispenser/exports/optimized.glb). Reuse candidate. |
| Lagoon-tiled bar carcass | 3.15, 0.025, 3.6 | Room programme placement. See the room detail and source notes for its shipped representation. | [Existing export](https://github.com/yapweijun1996/Blender-3D-Gallery/blob/0b71ed7ec0f79d9d938cf6edcd19d2fa74f7a4b3/models/mall-coffee-counter/exports/optimized.glb). Reuse candidate. |
| Three stools facing the counter | 1.93, 0.025, 2.6; 1.93, 0.025, 3.6; 1.93, 0.025, 4.6 | Room programme placement. See the room detail and source notes for its shipped representation. | [Existing export](https://github.com/yapweijun1996/Blender-3D-Gallery/blob/0b71ed7ec0f79d9d938cf6edcd19d2fa74f7a4b3/models/mall-bar-stool/exports/optimized.glb). Reuse candidate. |
| Twin lounge benches with existing sit actions | -3, 0, -0.8; 3, 0, -0.8 | [Matching runtime export](../../../demos/corporate/gjh/v11/assets/gjh-lounge-bench.glb). Verify this socket uses the intended variant. | [Existing export](https://github.com/yapweijun1996/Blender-3D-Gallery/blob/0b71ed7ec0f79d9d938cf6edcd19d2fa74f7a4b3/models/gjh-mall-furniture/exports/gjh-lounge-bench.glb). Reuse candidate. |
| Coconut globe above the bar | 2.7, 3.4, 2.3 | Room programme placement. See the room detail and source notes for its shipped representation. | [Existing export](https://github.com/yapweijun1996/Blender-3D-Gallery/blob/0b71ed7ec0f79d9d938cf6edcd19d2fa74f7a4b3/models/mall-globe-pendant/exports/optimized.glb). Reuse candidate. |
| White cold chest in the rear-left bay | -2.8, 0.025, -3.19 | Room programme placement. See the room detail and source notes for its shipped representation. | [Existing export](https://github.com/yapweijun1996/Blender-3D-Gallery/blob/0b71ed7ec0f79d9d938cf6edcd19d2fa74f7a4b3/models/freezer-cabinet/exports/optimized.glb). Reuse candidate. |
| Ferns in the rear planter bed | 3.78, 0.025, -3.1 | Room programme placement. See the room detail and source notes for its shipped representation. | [Existing export](https://github.com/yapweijun1996/Blender-3D-Gallery/blob/0b71ed7ec0f79d9d938cf6edcd19d2fa74f7a4b3/models/tropical-fern-cluster/exports/optimized.glb). Reuse candidate. |
| Citrus tray at counter end | 3.16, 1.26, 4.58 | Room programme placement. See the room detail and source notes for its shipped representation. | [Existing export](https://github.com/yapweijun1996/Blender-3D-Gallery/blob/0b71ed7ec0f79d9d938cf6edcd19d2fa74f7a4b3/models/food-tray/exports/food-tray.glb). Reuse candidate. |
| Room detail pack | Slot origin | [Installed detail GLB](../../../demos/corporate/gjh/v11/assets/interiors/s03-gogo-details.glb) | Room detail generated using the [web repository source](../../../scripts/gjh_interiors/rooms.py). |

The [installed bar stools](../../../demos/corporate/gjh/v11/assets/gogo-bar-stool.glb) reuse the original Blender Gallery model with the web runtime’s brass and upholstery variant. See the [source and transform record](../../gjh-gogo-bar-stool.md). Historical Red Bean and Assorted Real Fruit Potong have planned left-cart placements. The unwrapped studies in the [shop brief](README.md) have no corresponding verified SKU GLBs. Fixture GLBs and generic shelf stock are exhibit assets.


## Installed cart treatment

| Object | Local placement | Runtime source |
| --- | --- | --- |
| GOGO header panel | XYZ (−2.22, 1.60, 2.64), yaw 12° | [Room-detail geometry](../../../scripts/gjh_interiors/rooms.py) and [existing sourced graphic](../../../demos/corporate/gjh/v11/assets/gogo-logo.jpg) |
| Red bean and fruit samples | XZ (−2.94, 2.38) and (−2.76, 2.38), above the counter | [Original unwrapped geometry](../../../scripts/gjh_interiors/rooms.py) |
| Story action | Authored cart standing point XZ (−2.3, 3.3) | [Unified programme](../../gjh-v11-interior-program.json) and [exhibit text](../../../demos/corporate/gjh/v11/assets/gogo-exhibit.js) |

## Production reference recheck, 2026-11-20

Page 51 of the [dated Singapore HPB list](https://www.healthhub.sg/sites/assets/Assets/PDFs/HPB/Food/HCS%20products%20list%20for%20website%20updated%20till%2031%20July%2016.pdf#page=51) establishes two historical 6 × 65 g references, Premium Potong Assorted Real Fruit and Premium Potong Red Bean. The [current GOGO brand page](https://gjh.com.sg/gogo/) does not show usable current packs or measurements for those two exact items. The displayed unwrapped red-bean and fruit-colour pieces remain original studies of the category.

For each exact model, obtain a dated specimen or source that identifies the corresponding bar shape, wrapper and outer carton. The retail print version, current availability, individual geometry and packaging usage scope remain pending. [Production checklist](../production-model-checklist.md#s03-gogo)

On Pages build `8140834cc8e13632`, desktop keyboard and 390 px Chrome touch emulation reached the cart story, crossed the open centre to the rear display and returned to the concourse. Each route loaded the existing detail GLB and preserved the historical date and two product entries.
