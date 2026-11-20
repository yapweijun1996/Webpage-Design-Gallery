# S11 HORMEL Chili 15 oz tin studies

The supplied official No Beans and With Beans front views show the same apparent height-to-diameter ratio of about 1.56, straight walls, a thin projecting gold top seam and a silver bottom seam. Both editable specimens use the same approximate Ø75 × 117 mm display envelope with a plain lid and unprinted red sides. The two slightly different reds are interpretive display coding for variants that share a red field in the photos. Absolute dimensions, the exact rolled seam sections, the lid loop and other top tooling are unverified.

- [Official HORMEL Chili No Beans](https://www.hormel.com/brands/hormel-chili/product/chili-no-beans/)
- [Official HORMEL Chili With Beans](https://www.hormel.com/brands/hormel-chili/product/chili-with-beans/)

No Beans takes the left placeholder at `(-2.420, 2.1125, -4.070)` and With Beans takes the right at `(-1.240, 2.1125, -4.070)` in slot-local XYZ metres, as derived from `window-studios.js`. The editable objects use those exact origins. The room batch seats the bases flush with the shelf at Y = 2.1125 m, 0.5 mm lower. The pair spans 1.18 m. The former `shelf_facings` stock used four centres 0.23 m apart within that interval.

[`generate.py`](generate.py) provides `build()`, which links and returns two named mesh objects in the current Blender scene. Each has a simple underside and separate enamel, gold and silver finishes. The source script can also be run from Blender with `--python`.

[`hormel_chili_tins.py`](../../scripts/gjh_interiors/hormel_chili_tins.py) provides `add_hormel_chili_tins(room)` for appending to `room.batches[CRAFT]`, with no new batch or instances. Pass its returned face indices to `smooth_hormel_chili_tins(obj, first_bands)` after creating the CRAFT object. The built-in shelf conceals the omitted underside faces. The room pair uses 428 triangles with 16 sides per tin.

[Editable Blender source](hormel-chili.blend) · [Installed room GLB](../../demos/corporate/gjh/v11/assets/interiors/s11-deli-details.glb) · [QA receipt](receipt.json)
