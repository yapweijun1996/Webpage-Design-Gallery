# S14 LG model inventory

Upstream paths were checked against [Blender-3D-Gallery main `0b71ed7e`](https://github.com/yapweijun1996/Blender-3D-Gallery/tree/0b71ed7ec0f79d9d938cf6edcd19d2fa74f7a4b3). Coordinates are local XYZ metres. A catalogue candidate requires a fit and rights check before replacing a shipped asset. [Shop brief](README.md) · [Floor plan](floor-plan.webp)

| Fixture | Placement | Web runtime | Blender Gallery |
| --- | --- | --- | --- |
| Two-scale screen wall with a gallery reveal | -0.62, 1.03, -3.99 | [Low GLB](../../../demos/corporate/gjh/v11/assets/interiors/s14-tv-wall-mounted-low.glb) · [Balanced GLB](../../../demos/corporate/gjh/v11/assets/interiors/s14-tv-wall-mounted-balanced.glb) | [Low](https://github.com/yapweijun1996/Blender-3D-Gallery/blob/0b71ed7ec0f79d9d938cf6edcd19d2fa74f7a4b3/exports/gjh-v11-interiors/s14-tv-wall-mounted-low.glb) · [Balanced](https://github.com/yapweijun1996/Blender-3D-Gallery/blob/0b71ed7ec0f79d9d938cf6edcd19d2fa74f7a4b3/exports/gjh-v11-interiors/s14-tv-wall-mounted-balanced.glb) |
| Second smaller floor screen angled toward main screen | 2.63, 0.081, -3.68 | [Matching runtime export](../../../demos/corporate/gjh/v11/assets/tv-floor-stand.glb). Verify this socket uses the intended variant. | [Existing export](https://github.com/yapweijun1996/Blender-3D-Gallery/blob/0b71ed7ec0f79d9d938cf6edcd19d2fa74f7a4b3/models/tv-floor-stand/exports/optimized.glb). Reuse candidate. |
| Ivory sofa in left browsing alcove | -3.10, 0.081, -0.55 | Procedural kit sofa at 150°. Its Sit target uses the open side, 0.95 m from the cushion centre. | [Existing export](https://github.com/yapweijun1996/Blender-3D-Gallery/blob/0b71ed7ec0f79d9d938cf6edcd19d2fa74f7a4b3/models/living-room-sofa/exports/optimized.glb). Reuse candidate. |
| Low console below the screen | -0.62, 0.081, -3.8600000000000003 | [Matching runtime export](../../../demos/corporate/gjh/v11/assets/tv-demo-table.glb). Verify this socket uses the intended variant. | [Existing export](https://github.com/yapweijun1996/Blender-3D-Gallery/blob/0b71ed7ec0f79d9d938cf6edcd19d2fa74f7a4b3/models/tv-demo-table/exports/optimized.glb). Reuse candidate. |
| Velvet ottoman by the left window | -1.90, 0.081, 3.70 | Procedural kit ottoman at 165°. Its standing point clears the window-side furniture at local XZ (−1.48, 2.72). | [Existing export](https://github.com/yapweijun1996/Blender-3D-Gallery/blob/0b71ed7ec0f79d9d938cf6edcd19d2fa74f7a4b3/models/lounge-sofa-bench/exports/optimized.glb). Reuse candidate. |
| Satin domestic appliance at back left | -2.96, 0.081, -3.58 | [Matching runtime export](../../../demos/corporate/gjh/v11/assets/gallery-assets/refrigerator.glb). Verify this socket uses the intended variant. | [Existing export](https://github.com/yapweijun1996/Blender-3D-Gallery/blob/0b71ed7ec0f79d9d938cf6edcd19d2fa74f7a4b3/models/refrigerator/exports/optimized.glb). Reuse candidate. |
| Grazing light across screen reveals | -0.62, 3.3, -3.99 | Room programme placement. See the room detail and source notes for its shipped representation. | [Existing export](https://github.com/yapweijun1996/Blender-3D-Gallery/blob/0b71ed7ec0f79d9d938cf6edcd19d2fa74f7a4b3/models/mall-track-spotlight/exports/optimized.glb). Reuse candidate. |
| Small domestic arrangement at sofa end | -2.9899999999999998, 0.081, -1.8 | Room programme placement. See the room detail and source notes for its shipped representation. | [Existing export](https://github.com/yapweijun1996/Blender-3D-Gallery/blob/0b71ed7ec0f79d9d938cf6edcd19d2fa74f7a4b3/models/orchid-planter/exports/optimized.glb). Reuse candidate. |
| Soft gallery wall light | 3.19, 2.74, 0.3 | Room programme placement. See the room detail and source notes for its shipped representation. | [Existing export](https://github.com/yapweijun1996/Blender-3D-Gallery/blob/0b71ed7ec0f79d9d938cf6edcd19d2fa74f7a4b3/models/mall-wall-sconce/exports/optimized.glb). Reuse candidate. |
| Room detail pack | Slot origin | [Installed detail GLB](../../../demos/corporate/gjh/v11/assets/interiors/s14-living-details.glb) | Room detail generated using the [web repository source](../../../scripts/gjh_interiors/rooms.py). |

Product-specific models and pending source work are listed in the [shop brief](README.md). Fixture GLBs and generic shelf stock are exhibit assets.

## Product-specific inventory

| Product | Placement | Runtime and proposed model |
| --- | --- | --- |
| LG OLED55C5PSA | Scaled product display against the rear screen wall | Stand-free case matches the manufacturer outer envelope. Stepped rear housing, VESA mounts and visible recesses are modeled. Exact Singapore jack placement remains open. |

The ATC support page's C5 quick setup guide shows cable routing for the 55-, 65- and 77-inch family and lists compatible connector types separately from the rear illustration. The Singapore product page confirms the connector counts and HDMI 2 eARC for the displayed model. A readable ATC-specific jack layout remains needed before adding sockets. [LG ATC support](https://www.lg.com/sg/support/product-support/cs-OLED55C5PSA.ATC/) · [Singapore specifications](https://www.lg.com/sg/tvs-soundbars/oled-evo/oled55c5psa/)

[Editable Blender sources and QA receipt](../../../models/gjh-lg-oled/README.md)
