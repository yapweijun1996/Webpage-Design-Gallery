# S02 MILI model inventory

Upstream paths were checked against [Blender-3D-Gallery main `0b71ed7e`](https://github.com/yapweijun1996/Blender-3D-Gallery/tree/0b71ed7ec0f79d9d938cf6edcd19d2fa74f7a4b3). Coordinates are local XYZ metres. A catalogue candidate requires a fit and rights check before replacing a shipped asset. [Shop brief](README.md) · [Floor plan](floor-plan.webp)

| Fixture | Placement | Web runtime | Blender Gallery |
| --- | --- | --- | --- |
| Hammered-metal hood over the lacquer pass | 0, 2.38, 0.5 | [Low GLB](../../../demos/corporate/gjh/v11/assets/interiors/s02-hawker-stall-exhaust-hood-low.glb) · [Balanced GLB](../../../demos/corporate/gjh/v11/assets/interiors/s02-hawker-stall-exhaust-hood-balanced.glb) | [Low](https://github.com/yapweijun1996/Blender-3D-Gallery/blob/0b71ed7ec0f79d9d938cf6edcd19d2fa74f7a4b3/exports/gjh-v11-interiors/s02-hawker-stall-exhaust-hood-low.glb) · [Balanced](https://github.com/yapweijun1996/Blender-3D-Gallery/blob/0b71ed7ec0f79d9d938cf6edcd19d2fa74f7a4b3/exports/gjh-v11-interiors/s02-hawker-stall-exhaust-hood-balanced.glb) |
| Lacquer island base with counter | 0, 0.025, 0.5 | Room programme placement. See the room detail and source notes for its shipped representation. | [Existing export](https://github.com/yapweijun1996/Blender-3D-Gallery/blob/0b71ed7ec0f79d9d938cf6edcd19d2fa74f7a4b3/models/kitchen-cabinet/exports/optimized.glb). Reuse candidate. |
| Recessed noodle boiler | 0, 1.165, 0.3 | Room programme placement. See the room detail and source notes for its shipped representation. | [Existing export](https://github.com/yapweijun1996/Blender-3D-Gallery/blob/0b71ed7ec0f79d9d938cf6edcd19d2fa74f7a4b3/models/noodle-boiler/exports/optimized.glb). Reuse candidate. |
| Condiments on oak pantry shelf | -4.43, 3.0425, 3.25 | [Matching runtime export](../../../demos/corporate/gjh/v11/assets/condiment-bottle-jar-set.glb). Verify this socket uses the intended variant. | [Existing export](https://github.com/yapweijun1996/Blender-3D-Gallery/blob/0b71ed7ec0f79d9d938cf6edcd19d2fa74f7a4b3/models/condiment-bottle-jar-set/exports/optimized.glb). Reuse candidate. |
| Chopsticks on the opposite pass corner | -0.53, 1.165, 1.31 | Room programme placement. See the room detail and source notes for its shipped representation. | [Existing export](https://github.com/yapweijun1996/Blender-3D-Gallery/blob/0b71ed7ec0f79d9d938cf6edcd19d2fa74f7a4b3/models/chopstick-holder/exports/chopstick-holder.glb). Reuse candidate. |
| Serving plate on the counter | 0.45, 1.165, 0.98 | Room programme placement. See the room detail and source notes for its shipped representation. | [Existing export](https://github.com/yapweijun1996/Blender-3D-Gallery/blob/0b71ed7ec0f79d9d938cf6edcd19d2fa74f7a4b3/models/mamak-stainless-steel-plate/exports/mamak-stainless-steel-plate.glb). Reuse candidate. |
| Two bench seat and stand points | -2.55, 0, -0.8; 3.4, 0, -1.97 | [Matching runtime export](../../../demos/corporate/gjh/v11/assets/gjh-lounge-bench.glb). Verify this socket uses the intended variant. | [Existing export](https://github.com/yapweijun1996/Blender-3D-Gallery/blob/0b71ed7ec0f79d9d938cf6edcd19d2fa74f7a4b3/models/gjh-mall-furniture/exports/gjh-lounge-bench.glb). Reuse candidate. |
| Warm ceramic wall lights | -3.08, 3.32, -4.04; 3.08, 3.32, -4.04 | Room programme placement. See the room detail and source notes for its shipped representation. | [Existing export](https://github.com/yapweijun1996/Blender-3D-Gallery/blob/0b71ed7ec0f79d9d938cf6edcd19d2fa74f7a4b3/models/mall-wall-sconce/exports/optimized.glb). Reuse candidate. |
| Rear kitchen herb-garden planter | -3.8, 0.025, -2.8 | Room programme placement. See the room detail and source notes for its shipped representation. | [Existing export](https://github.com/yapweijun1996/Blender-3D-Gallery/blob/0b71ed7ec0f79d9d938cf6edcd19d2fa74f7a4b3/models/orchid-planter/exports/optimized.glb). Reuse candidate. |
| Room detail pack | Slot origin | [Installed detail GLB](../../../demos/corporate/gjh/v11/assets/interiors/s02-mili-details.glb) | Room detail generated using the [web repository source](../../../scripts/gjh_interiors/rooms.py). |

Product-specific models and pending source work are listed in the [shop brief](README.md). Fixture GLBs and generic shelf stock are exhibit assets.


## Cookline product forms

| Object | Local placement | Runtime source |
| --- | --- | --- |
| Regular and vegetarian 510 g bottle forms | XZ (−0.39, 0.89) and (−0.16, 0.89), bottom Y 1.22 | [Room-detail generator](../../../scripts/gjh_interiors/rooms.py) and [Blender study](../../../models/gjh-mili-sauce-bottles/README.md) |
| MILI Vegetarian Mock Duck 280 g unprinted tall tin | XZ (0.12, 0.89), bottom Y 1.22 | [Editable model, official photo and release asset](../../../models/gjh-mili-mock-duck/README.md) |
| Sauce comparison sign and Inspect point | Sign on the front of the cookline. The standing point is XZ (0, 2.5). | [Cookline placement record](../../gjh-v11-interior-program.json) |

The sample plate placement in the [room programme](../../gjh-v11-interior-program.json) now selects its own 540 exported vertices. This prevents the placement transform from moving portions of the sauce bottles.
