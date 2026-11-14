# V11 first courtyard seat

Release 1.1.23; baseline d36b725. Only the courtyard bench at (-7.8, 9.5) is interactive; seven other benches remain decorative.

## Interaction contract
Approach the front within 1.25m of its interaction point, then choose Sit. The anchored state ignores walking/running while keeping mouse/two-finger look and Q/E camera turns. Stand remains visible; Escape exits only outside a modal. Dialog Escape closes that dialog without standing. List mode exits the seat; map teleport resets the pose and collider at the selected destination. Blur clears input and leaves the seated state intact.

Both entry and standing check the full standing capsule at the fixed front exit (-7.8, 8.3) using Rapier shape queries. The player's capsule is disabled only while explicitly anchored and is re-enabled after the safe standing position is selected. This is not a physical ragdoll or dynamically occupied multi-user seat. A blocked exit is refused rather than forcing the player through geometry; arbitrary moving-obstacle scenarios have not been certified.

## Visual calibration
The loaded bench upholstery has a seat surface around 0.635m, not the static collider's 0.5m top. The existing visitor has a 1.210235 rig scale and short stylized legs. A reversible hip/knee/arm pose uses the front seat edge; feet hang naturally rather than claiming floor contact. The camera moves to a front-quarter seated view. Walking HUD controls are hidden while locked and restored on exit; the Stand action moves below the character.

The nonempty shopping bag rests beside the visitor on the seat, without changing bag contents, then returns to the hand on standing. This is an immediate simplified seated pose and bag repositioning, NOT a sit-down animation, placement animation, IK or realistic foot planting. Existing source GLBs and animation clips remain unchanged.

## Evidence
Before advisor review inspected the bench/character source and screenshots. After review actually inspected mobile seated/standing and front/side close-ups: seat contact, knee direction and bag placement accepted. Standing screenshot's lower body is partially covered by the normal Sit prompt; restoration is supported by state/pose checks, not that screenshot alone.

`tests/browser_gjh_seat.py`: 390x680 and 1440x900 simulated Chromium passed actual approach, Sit/Stand, movement lock, Q/E look, modal Escape isolation, List/teleport exit and preserved bag quantity. `tests/browser_gjh_seat_angles.py`: actual bench and character modules rendered together; empty/nonempty bag, hand reattachment and hip restoration checked. [Screenshots and reports](evidence/v11-seat/).

An initial local startup timed out because the seat record referenced the interaction array before its declaration; this implementation error was corrected before successful checks. No failed check was removed. No full interaction-report acceptance matrix, mobile hardware performance or actual iOS/Safari validation is claimed.

## Rollback
Baseline d36b725. Revert release and regenerate outputs. No data migration; bag session format unchanged. Reverse patch verified before push.
