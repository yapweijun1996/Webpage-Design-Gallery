# V11 simplified collection action

Release 1.1.22; baseline ba92299. This bounded slice adds an explicit **Add + collect in 3D** alternative to the existing non-animated Add action. Either adds exactly one item. It closes the product detail, returns focus to the scene without teleporting, and shows a 1.35-second left-arm presentation of the selected demo can. The right arm retains the carried bag.

## Limits and state
This is not inverse kinematics, finger grasp, a reach from the shelf, stock removal or put-back. The source shelf instances remain unchanged. The can reuses the selected SKU's already loaded, hash-verified primitives/materials, with no new fetch, new artwork or geometry disposal on completion. Existing unverified-packaging disclosures remain.

The animation is presentation only. Bag state changes once at explicit activation, not at an animation milestone. Duplicate activation after the detail closes is ignored; the nine-item cap is shared. Opening a modal, changing to List, hiding or blurring cancels presentation without appending or undoing chosen quantity. Reduced motion performs the selection and returns to the scene without the gesture. Missing validated model data hides the collection alternative while normal Add remains available.

## Relevant checks
`tests/browser_gjh_collect.py` verifies all four SKUs, duplicate synchronous activation, shared quantity cap, focus return, completion/modal/blur cancellation and reduced-motion skip at simulated 390x680. An initial run found that starting before modal/view focus transition immediately cancelled the gesture; implementation now starts after that transition and the unchanged active-state assertion passes.

`tests/browser_gjh_collect_angles.py` renders the actual character and selected can from three angles at peak gesture. Test lighting and camera are isolated, not gameplay changes. Initial visual inspection found the can above the hand; its attachment offset was corrected and screenshots regenerated. Advisor also found the normal Inspect overlay hiding the gesture in gameplay; it is now hidden only during active collection and restored from the current nearby state afterward. The targeted test asserts hiding and restoration. The lift pose opens slightly outward to reduce body occlusion in the normal follow camera; the metre-scale can remains small, and label readability is not a gameplay claim. Final action-area, front close-up and mobile gameplay screenshot review passed. Character heading differs between gameplay captures, so these are not a controlled same-angle comparison and do not prove every rear view is unobstructed. Four additional side samples cover 0.017, 0.2, 0.7 and 1.1 seconds; advisor checked visible contact. [Evidence](evidence/v11-collect/).

No unrelated full regression suite or real-device certification is claimed. The larger character-interaction report is a roadmap, not a completed acceptance checklist. Sitting, put-back and push-cart are not included here.

## Rollback
Baseline ba92299; revert this release and rebuild generated outputs. No storage migration or backend operations. Reverse patch checked before push.
