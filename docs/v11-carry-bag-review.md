# V11 visible carrying feedback

Release 1.1.21; baseline 8dad08d. The session-only demo bag now drives one original, unbranded shopping-bag prop on the visitor when the selection is nonempty. Clearing the selection hides it; restored session selection initializes it. Quantity does not inflate the prop.

## Authored structure and limits
The existing visitor GLB contains no skinned skeleton. It uses articulated shoulder/elbow/hip/knee transform nodes and idle/walk/sprint clips. A generic paper bag attaches near the right elbow's hand end; a deliberate carrying presentation pose is overlaid after the animation mixer. The previous mixed rotations are restored before the next mix and immediately on empty selection, including static/reduced-motion idle. The source GLB and clips are unchanged.

This is visible carrying feedback, NOT a shelf-pickup animation, finger grasp/IK, simulated bag contents, physical bag collider or shopping trolley. No real order or payment. The bag dialog explicitly explains the limitation. Rendering failure must not change the selection state.

## Evidence
Before advisor review inspected the actual GLB hierarchy and previous gameplay screenshot. After review identified floating-looking separated handles in the side render. Both handle curves were changed to meet at the hand-end grip point, retaining their separate bag-rim endpoints; refreshed side-angle screenshots were reviewed and passed. Final 390px gameplay idle/walk/run screenshots also passed advisor review: the bag is visible in movement; natural partial side-view occlusion at idle is not a missing prop.

[Angle evidence](evidence/v11-carry-bag/) renders the actual character module with neutral test lighting and camera, not a changed gameplay camera. `tests/browser_gjh_carry_angles.py` records idle/walk/run from three angles and samples 120 frames of each state for >5cm floor clearance. It also checks arm rotation restoration after emptying. An initial 4.9cm sample failed; the bag height was reduced from 26 to 24cm, then the unchanged clearance assertion passed. The first screenshot harness accidentally retained the native guide overlay; final evidence uses an isolated test page, not those obscured images.

`tests/browser_gjh_carry_bag.py` passed selection-to-character synchronization, empty/add/clear, restored session and idle/walk/run in 390x680, 844x390 and 1440x900 simulated Chromium with reduced motion. No unrelated full regression rerun. Real iPhone/Safari performance, physical grip realism and all possible collisions are not certified.

## Provenance and rollback
The prop is original procedural Three.js geometry authored for this owner-authorized demo; it has no brand textures or external assets. Existing character provenance remains in character-sources.json. No independent third-party license grant is made here.

Rollback to baseline 8dad08d by reverting this release and rebuilding generated artifacts. Selection storage and source model do not need migration. Reverse patch applicability checked before push.
