# Gu Long window stock

The foreground window uses the bottom two courses of the original six-course [gallery fixture](../../demos/corporate/gjh/v11/assets/gallery-assets/stacked-can-pyramid.glb). It retains the original plinth, blank jade bands, tinplate and rolled rims. The 36 base tins and the 25 above them occupy the source footprint of 1.20 × 1.20 m. Their top is 0.68 m above the plinth base. The mall places the display at local (−1.56, 0.081, 2.65) with scale 0.88. The central sample action belongs to the separate six-course display on its jade serving drum.

The imported source is the owner's [stacked-can-pyramid](https://github.com/yapweijun1996/Blender-3D-Gallery/tree/a87117622ed25efc5f804c9ee6ed0171e4946cf7/models/stacked-can-pyramid). Its SHA-256 is pinned in the generator. The generic tins carry no SKU, label or weight. The [catalogue studies](../gjh-gulong-tins/README.md) identify the two 256 g products separately.

Regenerate the [runtime GLB](../../demos/corporate/gjh/v11/assets/gallery-assets/gulong-window-stock.glb) from the repository root with Blender 5.1.2.

```sh
blender --background --python models/gjh-gulong-window-stock/generate.py
```
