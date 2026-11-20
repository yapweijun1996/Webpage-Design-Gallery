# S16 GP Batteries model inventory

Upstream paths were checked against [Blender-3D-Gallery main `0b71ed7e`](https://github.com/yapweijun1996/Blender-3D-Gallery/tree/0b71ed7ec0f79d9d938cf6edcd19d2fa74f7a4b3). Coordinates are local XYZ metres. A catalogue candidate requires a fit and rights check before replacing a shipped asset. [Shop brief](README.md) · [Floor plan](floor-plan.webp)

| Fixture | Placement | Web runtime | Blender Gallery |
| --- | --- | --- | --- |
| Perforated eyelet demonstration rail | -1.56, 0.081, -1.28 | [Low GLB](../../../demos/corporate/gjh/v11/assets/interiors/s16-eyelet-rail-low.glb) · [Balanced GLB](../../../demos/corporate/gjh/v11/assets/interiors/s16-eyelet-rail-balanced.glb) · [Detailed GLB](../../../demos/corporate/gjh/v11/assets/interiors/s16-eyelet-rail-detailed.glb) | [Low](https://github.com/yapweijun1996/Blender-3D-Gallery/blob/0b71ed7ec0f79d9d938cf6edcd19d2fa74f7a4b3/exports/gjh-v11-interiors/s16-eyelet-rail-low.glb) · [Balanced](https://github.com/yapweijun1996/Blender-3D-Gallery/blob/0b71ed7ec0f79d9d938cf6edcd19d2fa74f7a4b3/exports/gjh-v11-interiors/s16-eyelet-rail-balanced.glb) · [Detailed](https://github.com/yapweijun1996/Blender-3D-Gallery/blob/0b71ed7ec0f79d9d938cf6edcd19d2fa74f7a4b3/exports/gjh-v11-interiors/s16-eyelet-rail-detailed.glb) |
| Cell display in left window | -2.51, 0.081, 3.22 | [Matching runtime export](../../../demos/corporate/gjh/v11/assets/battery-display-rack.glb). Verify this socket uses the intended variant. | [Existing export](https://github.com/yapweijun1996/Blender-3D-Gallery/blob/0b71ed7ec0f79d9d938cf6edcd19d2fa74f7a4b3/models/battery-display-rack/exports/optimized.glb). Reuse candidate. |
| White modular accessories shelving | -2.9899999999999998, 0.081, -1.8 | [Matching runtime export](../../../demos/corporate/gjh/v11/assets/gallery-assets/shelf-electronics-display.glb). Verify this socket uses the intended variant. | [Existing export](https://github.com/yapweijun1996/Blender-3D-Gallery/blob/0b71ed7ec0f79d9d938cf6edcd19d2fa74f7a4b3/models/shelf-electronics-display/exports/optimized.glb). Reuse candidate. |
| Neutral rear test desk | 2.63, 0.081, -3.68 | Room programme placement. See the room detail and source notes for its shipped representation. | [Existing export](https://github.com/yapweijun1996/Blender-3D-Gallery/blob/0b71ed7ec0f79d9d938cf6edcd19d2fa74f7a4b3/models/work-desk/exports/optimized.glb). Reuse candidate. |
| Generic static display on rear desk | 2.63, 1.131, -3.68 | Room programme placement. See the room detail and source notes for its shipped representation. | [Existing export](https://github.com/yapweijun1996/Blender-3D-Gallery/blob/0b71ed7ec0f79d9d938cf6edcd19d2fa74f7a4b3/models/desktop-monitor/exports/optimized.glb). Reuse candidate. |
| Lime polymer tool bin | -3.03, 0.081, 0.4 | Room programme placement. See the room detail and source notes for its shipped representation. | [Existing export](https://github.com/yapweijun1996/Blender-3D-Gallery/blob/0b71ed7ec0f79d9d938cf6edcd19d2fa74f7a4b3/models/storage-crate/exports/optimized.glb). Reuse candidate. |
| Bench inspection strip | -1.56, 3.3, -1.28 | Room programme placement. See the room detail and source notes for its shipped representation. | [Existing export](https://github.com/yapweijun1996/Blender-3D-Gallery/blob/0b71ed7ec0f79d9d938cf6edcd19d2fa74f7a4b3/models/mall-linear-ceiling-light/exports/optimized.glb). Reuse candidate. |
| Pegboard edge light | 3.19, 2.74, 0.3 | Room programme placement. See the room detail and source notes for its shipped representation. | [Existing export](https://github.com/yapweijun1996/Blender-3D-Gallery/blob/0b71ed7ec0f79d9d938cf6edcd19d2fa74f7a4b3/models/mall-wall-sconce/exports/optimized.glb). Reuse candidate. |
| Handheld bench scanner on left shelf | -2.9899999999999998, 1.081, -1.52 | Room programme placement. See the room detail and source notes for its shipped representation. | [Existing export](https://github.com/yapweijun1996/Blender-3D-Gallery/blob/0b71ed7ec0f79d9d938cf6edcd19d2fa74f7a4b3/models/barcode-scanner/exports/optimized.glb). Reuse candidate. |
| Room detail pack | Slot origin | [Installed detail GLB](../../../demos/corporate/gjh/v11/assets/interiors/s16-power-details.glb) | Room detail generated using the [web repository source](../../../scripts/gjh_interiors/rooms.py). |

Product-specific models and pending source work are listed in the [shop brief](README.md). Fixture GLBs and generic shelf stock are exhibit assets.

## Product-specific inventory

| Product | Placement | Runtime and proposed model |
| --- | --- | --- |
| GP Ultra+ Alkaline AA | Right demo plinth | The GP15AUP maximum envelope and raised positive terminal are modeled. Paper-pack revision and artwork remain open. |
| GP eTag Smart Tracker | Right demo plinth | The white GP Malaysia tracker has a contoured face, cover seam and shallow recessed cover-release aperture based on GP's white-unit FAQ photo. Exact aperture dimensions, lanyard-hole placement and Singapore availability remain open. [GP Malaysia tracker and FAQ](https://my.gpbatteries.com/products/gp-etag-smart-tracker) |
| GP CR2032 | Right demo plinth, centre | Unmarked Ø20 × 3.2 mm disk with stepped underside. Packaging and markings remain open. |

[Editable Blender sources and QA receipt](../../../models/gjh-gp-power/README.md)
