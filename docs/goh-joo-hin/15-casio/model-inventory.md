# S15 Casio model inventory

Upstream paths were checked against [Blender-3D-Gallery main `0b71ed7e`](https://github.com/yapweijun1996/Blender-3D-Gallery/tree/0b71ed7ec0f79d9d938cf6edcd19d2fa74f7a4b3). Coordinates are local XYZ metres. A catalogue candidate requires a fit and rights check before replacing a shipped asset. [Shop brief](README.md) · [Floor plan](floor-plan.webp)

| Fixture | Placement | Web runtime | Blender Gallery |
| --- | --- | --- | --- |
| Open baby grand and bench on recital oval | -1.05, 0.081, -1.02 | [Low GLB](../../../demos/corporate/gjh/v11/assets/interiors/s15-grand-piano-low.glb) · [Balanced GLB](../../../demos/corporate/gjh/v11/assets/interiors/s15-grand-piano-balanced.glb) | [Low](https://github.com/yapweijun1996/Blender-3D-Gallery/blob/0b71ed7ec0f79d9d938cf6edcd19d2fa74f7a4b3/exports/gjh-v11-interiors/s15-grand-piano-low.glb) · [Balanced](https://github.com/yapweijun1996/Blender-3D-Gallery/blob/0b71ed7ec0f79d9d938cf6edcd19d2fa74f7a4b3/exports/gjh-v11-interiors/s15-grand-piano-balanced.glb) |
| Black storefront grand and four-legged bench | -2.30, 0.081, 2.47 | [Installed gallery GLB](../../../demos/corporate/gjh/v11/assets/gallery-assets/grand-piano.glb), yaw 12.61°, scale 0.93. The black bench has its own Sit anchor. | [Runtime placement](../../../demos/corporate/gjh/v11/assets/gallery-east-shops.js) |
| Practice keyboard at left window | -2.51, 0.081, 3.22 | [Matching runtime export](../../../demos/corporate/gjh/v11/assets/electronic-keyboard.glb). Verify this socket uses the intended variant. | [Existing export](https://github.com/yapweijun1996/Blender-3D-Gallery/blob/0b71ed7ec0f79d9d938cf6edcd19d2fa74f7a4b3/models/electronic-keyboard/exports/optimized.glb). Reuse candidate. |
| Warm stage special above lid | -1.05, 3.3, -1.02 | Room programme placement. See the room detail and source notes for its shipped representation. | [Existing export](https://github.com/yapweijun1996/Blender-3D-Gallery/blob/0b71ed7ec0f79d9d938cf6edcd19d2fa74f7a4b3/models/mall-track-spotlight/exports/optimized.glb). Reuse candidate. |
| Walnut acoustic screen behind instrument | -0.64, 0.081, -3.76 | Room programme placement. See the room detail and source notes for its shipped representation. | [Existing export](https://github.com/yapweijun1996/Blender-3D-Gallery/blob/0b71ed7ec0f79d9d938cf6edcd19d2fa74f7a4b3/models/office-partition/exports/optimized.glb). Reuse candidate. |
| Small amber lamp over practice area | -2.5, 3.15, 2.88 | Room programme placement. See the room detail and source notes for its shipped representation. | [Existing export](https://github.com/yapweijun1996/Blender-3D-Gallery/blob/0b71ed7ec0f79d9d938cf6edcd19d2fa74f7a4b3/models/mall-cylinder-pendant/exports/optimized.glb). Reuse candidate. |
| Empty glass object case with ivory stage samples | -2.9899999999999998, 0.081, -1.8 | [Matching runtime export](../../../demos/corporate/gjh/v11/assets/mall-glass-showcase.glb). Verify this socket uses the intended variant. | [Existing export](https://github.com/yapweijun1996/Blender-3D-Gallery/blob/0b71ed7ec0f79d9d938cf6edcd19d2fa74f7a4b3/models/mall-glass-showcase/exports/optimized.glb). Reuse candidate. |
| Keybed side light | 3.19, 2.74, 0.3 | Room programme placement. See the room detail and source notes for its shipped representation. | [Existing export](https://github.com/yapweijun1996/Blender-3D-Gallery/blob/0b71ed7ec0f79d9d938cf6edcd19d2fa74f7a4b3/models/mall-wall-sconce/exports/optimized.glb). Reuse candidate. |
| Small recital flower arrangement | 2.63, 0.081, -3.68 | Room programme placement. See the room detail and source notes for its shipped representation. | [Existing export](https://github.com/yapweijun1996/Blender-3D-Gallery/blob/0b71ed7ec0f79d9d938cf6edcd19d2fa74f7a4b3/models/orchid-planter/exports/optimized.glb). Reuse candidate. |
| Audience chair beside the piano | -2.55, 0.081, 0.55 | Procedural room-kit chair at 135°. Its clear return point is at local XZ (−2.85, −0.80). | [Existing export](https://github.com/yapweijun1996/Blender-3D-Gallery/blob/0b71ed7ec0f79d9d938cf6edcd19d2fa74f7a4b3/models/meeting-chair/exports/optimized.glb). Reuse candidate. |
| Room detail pack | Slot origin | [Installed detail GLB](../../../demos/corporate/gjh/v11/assets/interiors/s15-recital-details.glb) | Room detail generated using the [web repository source](../../../scripts/gjh_interiors/rooms.py). |

Product-specific models and pending source work are listed in the [shop brief](README.md). Fixture GLBs and generic shelf stock are exhibit assets.

## Product-specific inventory

| Product | Placement | Runtime and proposed model |
| --- | --- | --- |
| Casiotone CT-S1BK | Right-side instrument stand | Installed 930 × 258 × 83 mm study with 61 keys, top controls and a dark textile speaker deck. |
| CELVIANO Grand Hybrid GP-510BP | Cabinet-form sample beyond the recital anchor | Installed straight cabinet at (1.55, 0.081, -4.00). The covered instrument uses the published envelope and three visible pedals. |

[Editable Blender sources and QA receipt](../../../models/gjh-casio-instruments/README.md)
