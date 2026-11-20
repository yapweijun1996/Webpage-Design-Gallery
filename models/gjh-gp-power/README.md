# S16 GP power specimens

| Editable mesh | Blender local X × Y × Z (mm) | Slot-local origin (m) | Placed triangles |
| --- | --- | --- | ---: |
| GP Ultra+ GP15AUP AA | 14.5 × 14.5 × 50.5 | `(.978, 1.0525, -.11)` | 476 |
| GP eTag White | 32 × 32 × 8.3 | `(1.13, 1.0525, 0)` | 428 |
| GP CR2032 | 20 × 20 × 3.2 | `(1.045, 1.0525, -.008)` | 236 |
| **Combined** | | | **828** |

The origins sit on the existing plinth at the centre of each footprint. Blender local XY is the circular footprint and +Z is the axial height. Slot coordinates use +Y up and +Z forward. The AA stands on its negative contact. The tracker and coin cell lie flat, face up.

## Geometry and references

- **GP15AUP AA.** The envelope uses the datasheet's maximum Ø14.5 × 50.5 mm. The model has a flat Ø7.30 mm negative contact, a rounded shoulder and a Ø5.50 mm positive button that projects 1.10 mm above its seat. The shoulder radii, negative-contact rim and button edge bevel are visual estimates from the supplied drawing. The foil jacket uses a muted green pigment with bare silver-toned terminals. [GP Ultra+ AA product](https://international.gpbatteries.com/products/gp-ultra-plus-alkaline-aa) · [GP15AUP datasheet, rev. 02](https://gpbmnordic.com/Product/Files/Global/DataSheet_UltraPlus_GP15AUP.pdf)
- **White eTag.** The manual specifies Ø32 × 8.3 mm. The supplied white pack photo guides the rounded case and shallow concentric face contours. A shallow circumferential recess represents the removable cover seam. Its height, width and depth are visual estimates. The manual confirms a bottom cover-release pinhole and the Malaysia catalog confirms a built-in lanyard hole. The mesh leaves both apertures out pending a verified position, cut geometry and internal routing. [GP Malaysia eTag catalog](https://my.gpbatteries.com/products/gp-etag-smart-tracker) · [GP eTag manual](https://gpbmnordic.com/Product/Files/Global/Manual%20eTag.pdf)
- **CR2032.** The Malaysia catalog gives Ø20 × 3.2 mm. The supplied pack photo guides the broad silver face, which is unmarked in the model. The turned edge and shallower underside step are low-poly interpretations of the form, with a Ø16.9 mm underside per the manufacturer drawing and an estimated bevel. [GP CR2032 datasheet](https://ind.gpbatteries.com/pub/media/uploads/pdf/primary_lithium/button/datasheet/CR2032.pdf) [GP Malaysia CR2032 product](https://my.gpbatteries.com/products/gp-lithium-coin-batteries-cr2032)

## Entry points and integration

- [gp_power_models.py](../../scripts/gjh_interiors/gp_power_models.py) exposes `add_aa(room)`, `add_etag(room)` and `add_cr2032(room)`. Each appends opaque faces to the existing painted `CRAFT` (`Enamel`) batch and accepts a slot-local `origin` override. The placed specimens use vertex pigment in the existing painted draw with no textures or markings.
- [generate.py](generate.py) exposes `build()`, which links and returns three separately named editable Blender mesh objects in AA, eTag and CR2032 order. All three share one painted material.

All three specimens share the plinth.

[Editable Blender source](gp-power.blend) · [Installed room GLB](../../demos/corporate/gjh/v11/assets/interiors/s16-power-details.glb) · [QA receipt](receipt.json)
