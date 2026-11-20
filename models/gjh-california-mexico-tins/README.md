# S10 California Mexico Abalone 454 g tin studies

The two editable, unprinted form studies use the supplied official front, back and side photos. Both have straight walls, projecting rolled rims and a plain recessed lid. The Red body uses a saturated red pigment and the Black body uses a nearly black pigment. The Ø75 × 120 mm display envelope comes from the photo proportions. Physical measurements, closure details and current authorized artwork remain open.

- [Official Red California Mexico Abalone 454 g](https://www.gjheshop.com/product/red-california-mexico-abalone-454g/)
- [Official Black California Mexico Abalone 454 g](https://www.gjheshop.com/product/black-california-mexico-abalone-454g/)

The room places Red at `(-2.69, 2.1125, -4.070)` and Black at `(-1.51, 2.1125, -4.070)` in slot-local XYZ metres. The tins share the room's painted mesh batch and use 284 triangles together. The room omits the underside faces concealed by the shelf. The editable Blender specimens include the simple underside and a separate metal material.

[Editable Blender file](california-mexico-tins.blend) · [Installed room GLB](../../demos/corporate/gjh/v11/assets/interiors/s10-coast-details.glb) · [QA receipt](receipt.json)

## Blender entry points

- [`generate.py`](generate.py) → `build()` links and returns the two named objects. Run it in the scene intended for the editable study, then save the scene.
- [`build_rooms.py`](../../scripts/gjh_interiors/build_rooms.py) → `export(10, gallery, output)` builds only S10 and writes `s10-coast-details.glb`. Pass `Path` values and stage `showroom-atlas.png` in `output` first. The exporter resets the Blender scene, so run it after saving the study or in a separate invocation.
- [`california_mexico_tins.py`](../../scripts/gjh_interiors/california_mexico_tins.py) → `add_california_mexico_tin(...)` supplies both builds with the same profile.
