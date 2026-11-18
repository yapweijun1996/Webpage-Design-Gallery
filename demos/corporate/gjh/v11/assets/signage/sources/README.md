# Editable signage sources

[kit.json](kit.json) is the authoring contract for mesh identity, budgets, dimensions, materials and provenance. [signage-kit.blend](signage-kit.blend) is an editable contact sheet in Blender coordinates. Object positions on the contact sheet make the parts easy to select. Each object's local origin sits on the rear plane at its bottom centre.

Encode durable geometry changes in [build_signage_kit.py](../../../../../../../scripts/build_signage_kit.py) and rebuild the GLBs and the Blender scene together. The build reads the official New Moon SVG directly. Its yellow path beginning `M99.269,10.642` supplies the crescent silhouette. The relief has a uniform height of 310 mm, a 17 mm depth and a 1.5 mm front bevel. The preview uses a separate typeset store name. The original logo retains its complete artwork in the existing repository assets.
