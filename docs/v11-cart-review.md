# V11 pushable demo cart

Release 1.1.24; baseline bd0a134. This is an optional pushing mode, not a stationary cart presented as a completed feature.

## Interaction
Open Bag and choose **Use cart in 3D** in an open area. Selection quantities stay in the same session-only bag store. An original shopping-cart model travels and turns with the visitor, with a fixed two-arm pushing pose and slower 1.8m/s walk. Running and automatic step climbing are disabled. **Stow cart** remains reachable from Bag and restores the hand-carried bag when nonempty. List mode, map teleport and starting a collection gesture stow the cart without clearing quantities. Modal/blur input cancellation retains the existing controls. Sitting requires stowing first; no simultaneous seated/pushing mode.

This is a simplified pushing demonstration, not a push-grip transition, finger rig, IK, freely simulated wheeled vehicle or realistic steering. The wheels do not rotate. The basket's generic parcel only indicates that the selection is nonempty; it is not a representation of selected SKUs or quantity. No orders, payments, prices or stock claims are added.

## Collision contract
A cylinder centred on the existing player axis (radius 1.4m, half-height 0.85m) conservatively encloses the visitor and the cart's entire turning sweep. The actual transformed cart bounds are recorded by the angle test and their farthest horizontal corner lies inside that radius. The controller moves this same collider, rather than leaving an uncollidable cart attached in front of a narrow person-only capsule. Expansion is refused if the larger shape intersects a world obstacle, excluding the player's own collider. Stowing restores the original capsule and autostep settings. Narrow passages may require stowing; this deliberately conservative demo clearance is not real cart handling or certification of every dynamic obstacle case.

## Asset provenance
[cart-source.json](../demos/corporate/gjh/v11/assets/cart-source.json) pins the owner repository source and unchanged binary hash. Original procedural geometry/materials, no external artwork or texture requests. Source remains static and independently editable in Blender-3D-Gallery. Owner's public-demo reuse authorization does not create a general redistribution licence. Optional load failure hides cart controls but leaves the mall operational.

## Necessary checks and visual review
- `browser_gjh_cart.py`: simulated Chromium 390x680, 844x390 and 1440x900; deploy/stow, preserved selection, hidden carried bag, walk speed/no sprint, wall stop, refusal to expand close to the wall, List/teleport stow, optional GLB failure. Cart controls and prompt have relevant bounds/44px assertions. This is not a repeat of all unrelated regression suites.
- `browser_gjh_cart_angles.py`: actual character/cart modules, three rendered angles, empty marker and restored hand bag. Measured transformed bounds and hand points are included.
- Before advisor reviewed existing gameplay and bag screenshots. Initial arm pose put hands below the handle; calibrated before final angle screenshots. Advisor then identified the normal mobile Inspect prompt covering the cart. Pushing-only layout moves that prompt below the subject and hides only the docked joystick hint, preserving the touch-origin floating joystick and interactive prompt. The original walking layout is unchanged. The subsequent 844px landscape review still found central obstruction; a landscape-only left-side prompt was then checked at x18/y237 with 220x95 bounds, without rerunning unrelated tests.
- Initial SSOT check rejected two new raw design values. They were replaced with existing tokens; generator, SSOT and diff checks subsequently passed.
- Final advisor inspected corrected 390 portrait, moving-view, bag controls and 844 landscape screenshots; no remaining screenshot-level publication blocker. This is not a whole-device or every-angle certification.
- [Screenshots and reports](evidence/v11-cart/). No physical iPhone, Safari, notched-screen or real-device performance certification. The full character-interaction roadmap is not marked complete.

## Rollback
Revert this release to bd0a134 and regenerate outputs. No session-data migration or changed bag schema. A local backup branch and reverse-patch check are prepared before publication.
