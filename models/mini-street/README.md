# Mini Street visitor V10 source

This editable Blender file is the source for the static preview at `demos/corporate/gjh/mini-street/assets/visitor-candidate-v10.glb`. The model is an experimental posed visitor, not an animation-ready rig. The unmasked source body and the original posed pieces remain in the blend.

The visitor reuses Girl body, Bob hair and Boots from the owner's Blender-3D-Gallery `models/chibi-dressup` at commit `db842f2b7307c3855242e6c0049b82625e0c031e`. The raincoat, umbrella and shopping bag were adapted or built for this prototype. Gallery sources are at <https://github.com/yapweijun1996/Blender-3D-Gallery/tree/db842f2b7307c3855242e6c0049b82625e0c031e/models/chibi-dressup>. This repository's source inspection did not establish a separate asset license; confirm the underlying source rights before redistribution outside the project.

The collar and coat form one connected component in the saved pose. The bottom hem is open. BVH tests on the masked posed body found no triangle-pair intersections with the coat shell; this is not a watertightness or motion guarantee. The candidate requires additional fit, accessibility, device performance and animation work before replacing the standard visitor.
