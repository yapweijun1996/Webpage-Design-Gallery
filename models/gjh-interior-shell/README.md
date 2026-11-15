# GJH four-ID P0 shell

Original native-scale modular architecture for the existing three-store V11 mall. This bounded D3 kit selects four necessary families; it does not complete all79P0 candidates, the full source M1 milestone or the remaining inventory. The source inventory and its priorities remain unchanged.

`layout.json` is the sole editable definition of approved bounds, materials, native components, sockets, placements, nonoverlapping roof/wall caps and aggregate physics. `build.py` emits four editable sources, visual-only GLBs and a generated runtime registry. Runtime placements/fallbacks and original aggregate Rapier blocks consume that registry. Portal collider references resolve from the same pier/lintel components, leaving the aperture open.

| ID | Original proposed W × D × H m | Approved existing-world W × D × H m | Native triangles | Primitives | Placements |
| --- | --- | --- | ---: | ---: | ---: |
| ARC-001 |4 × .2 ×3.6 |4 × .3 ×6.6 |132 |3 |21 |
| COR-001 |4 ×4 ×.2 |4 ×4 ×.2 |220 |2 |28 |
| CEI-001 |4 ×4 ×.25 |4 ×4 ×.3 |220 |2 |8 |
| STF-002 |8 ×.5 ×3.6 |9.8 ×.59 ×5.475 |176 |3 |3 |

The root is the architectural bottom/opening-center snap at unit scale. Blender `(x,-z,y)` converts Three.js coordinates; front is Blender −Y / glTF +Z. STF bounds are asymmetrical in depth: `[-4.9,0,-.25]` to `[4.9,5.475,.34]`; its pivot is deliberately not the AABB center. Native dimensions are checked against the approved target, not silently compared to the generic proposal.

COLLISION collections contain editable wire proxies; they are excluded from GLB export. STF has three cuboids, never one solid doorway-spanning proxy. Existing scene-wide physics retains66 world colliders, with no extra per-module blockers. COR tile top is35mm above the original foundation physics surface, preserving the previous visual overlay. CEI remains visual-only. The v2 elevator shaft and central skylight stay unchanged; v1 retains continuous roof coverage through the panel/cap decomposition. This is a fictional demo, not a building-accessibility or safety certification.

Each solid component is closed with positive volume. The storefront preserves the inherited overlapping pier/lintel assembly; no boolean-union watertight-building claim is made. Manufactured bevels are visual; procedural fallback has sharp edges with matching native bounds and the same authoritative colliders.

All four exports are static, texture-free PBR. No UV/baking requirement applies. Their small native geometry qualifies for an explicit simple architectural batch exception; no fabricated LOD1/LOD2 files or D5 acceptance is implied. Fixed placements are merged into one opaque batch using the exact shared amenities PBR helper, retaining linear color, roughness and metalness per vertex. This bounds additional draw work without reducing quality or shadows. The existing strict static loader owns hash/container/root/bounds/primitive/deadline/late-disposal checks for shell and furnishings.

Reproduce in an isolated background Blender, never an open GUI scene:

```sh
/Applications/Blender.app/Contents/MacOS/Blender --background --factory-startup --python-exit-code 1 --python models/gjh-interior-shell/build.py
/Applications/Blender.app/Contents/MacOS/Blender --background --factory-startup --python-exit-code 1 --python models/gjh-interior-shell/verify_blender.py
python models/gjh-interior-shell/verify_binary.py
node models/gjh-interior-shell/validate.mjs
python -m unittest discover -s tests -p test_gjh_interior_shell.py -v
python tests/browser_gjh_interior_shell.py --evidence /private/tmp/gallery-interior-shell-qa
```

`GLTF_VALIDATOR` can point to an existing installed `gltf-validator` package; no npm runtime dependency or download is introduced. `verify_blender.py -- --no-render` repeats source/root/bounds checks against unchanged files while preserving the existing six-view PNGs. Source `.blend`, authoring scripts, reports and previews stay outside Pages; four GLBs and generated registry are published from V11 assets and remain outside the PWA core precache.

Verification is recorded separately in the final review and acceptance manifest after all runtime checks finish. Physical phones, Safari, screen readers, field FPS and real-world packaging fidelity remain unverified.
