# S12 Zeria shelf specimens

The [Chondro Max photo](https://www.gjheshop.com/wp-content/uploads/2024/03/Chondro-Max-300T-Box-Bottle-white.jpg) shows the tall Chondro Max 300 carton next to a pale, clear-looking shoulder bottle with a narrower pale yellow-green ribbed cap. The [Lively & Healthy photo](https://www.gjheshop.com/wp-content/uploads/2024/03/Lively-Healthy-Glucosamine-Chondroitin-180T-Bottle.jpg) shows the broader Lively & Healthy 180 amber bottle with a wider yellow ribbed cap. The Lively & Healthy bottle is the third specimen.

- [GJH Chondro Max 300 product page](https://www.gjheshop.com/product/zeria-chondro-max-300-tablets/)
- [GJH Lively & Healthy 180 product page](https://www.gjheshop.com/product/zeria-lively-healthy-glucosamine-chondroitin-180-tablets/)

The photos support relative heights, widths, silhouettes and colour cues. All dimensions below are display estimates. Carton depth, heel curves, neck transitions and rib spacing are inferred from the visible views. The geometry is original and unprinted. It omits logos, label art, claims and bottle contents.

| Blender mesh object | Display envelope | Slot-local XYZ in metres |
| --- | --- | --- |
| `Chondro Max 300 Carton` | 104 W × 204 H × 60 D mm | `(-2.78, 2.1125, -4.04)` |
| `Chondro Max 300 Bottle` | Ø86 × 173 H mm, Ø63 mm cap | `(-2.68, 2.1125, -4.04)` |
| `Lively & Healthy 180 Bottle` | Ø90 × 175 H mm, Ø78 mm cap | `(-1.65, 2.1125, -4.04)` |

The runtime geometry adds 960 placed triangles to the existing opaque `Enamel` Pigment batch and uses the same draw. The pale neutral Chondro body suggests the clear pack through colour and shading. It has no transparency or refraction. The editable finish uses a glossier opaque shader on both bottle bodies and includes the bottle undersides concealed by the shelf.

The 1.43 m bay spans X `[-2.915, -1.485]`. The Chondro carton and bottle leave 5 mm between them. They and the Lively bottle clear all four instanced facings at X `-2.545`, `-2.315`, `-2.085` and `-1.855`. The shifted pair clears the left upright and the first generic facing.

## Blender entry points

- [`generate.py`](generate.py) → `build()` links and returns the three individually named mesh objects in table order.
- [`zeria_packs.py`](../../scripts/gjh_interiors/zeria_packs.py) → `add_zeria_packs(room)` appends the shelf specimens to the existing `CRAFT` batch and returns the body face ranges. `smooth_zeria_bottles(obj, body_ranges)` applies circumferential normals after the batch becomes a Blender object. The same source generates the installed room GLB.

[Editable Blender source](zeria-packs.blend) · [Installed room GLB](../../demos/corporate/gjh/v11/assets/interiors/s12-herbarium-details.glb) · [QA receipt](receipt.json)
