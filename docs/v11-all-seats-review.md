# V11 eight-bench sitting and standing

Release 1.1.25; baseline 534f19a. This replaces the single immediate-pose interaction described in the historical 1.1.23 report.

## Actual scene inventory
The `bench()` placements are the source of the interaction registry, not a second manually maintained list. There are eight physical benches: four in the courtyard, two in MILI and two in GOGO. Each now has one reviewed centre sitting position and its own front approach/exit. The two rear courtyard benches face the opposite direction. No additional chair or stool objects were found in this scene. This does not claim multiple simultaneous occupants, every cushion as an independent seat, or chairs in other demo versions.

## Visible motion and state
Normal motion has a 0.35-second alignment/turn phase followed by a 0.85-second root and joint interpolation into the seated pose. Standing blends back from the current root and pose over 0.85 seconds. Hip, knee, shoulder and elbow quaternions visibly change; this is no longer a single endpoint swap. Escape during entry reverses from the current position/progress; repeated cancellation during exit does not restart it. Walking is ignored throughout the interaction, while camera look remains available. Reduced-motion preference retains an immediate pose.

These are procedural, stylized transitions, not authored mocap, inverse kinematics, foot planting or anatomical realism. The tall bench and short character legs leave feet naturally hanging in the final pose. Initial alignment can slide/turn the character to its fixed interaction anchor. The bag still changes between hand and bench presentation at the pose boundary, without a separate placement or grasp animation. Quantities never change.

## Close-up action camera
Sitting, standing and the existing collection gesture now use a 3m target distance. A 0.35-second angle blend and existing position spring bring the action into view. The previous yaw/pitch are restored on completion or cancellation, and distance eases back to the ordinary walking view. Manual look or Q/E takes over from the automatic angle blend; walking cancels a collection gesture without removing its already-added bag item. Reduced-motion uses an immediate seat view and retains the nonanimated collection alternative.

The existing camera-to-target obstruction ray remains active on desired and interpolated positions. It uses physical colliders, not all decorative foliage meshes, so this is not a universal no-occlusion or no-wall-crossing certification. Store-specific aisle-facing angles were visually checked. The original model geometry, branding limitations and input roles are unchanged.

## Collision and interruption
Entry checks the standing-capsule path to the approach anchor, then the seat-contact path, sampled at no more than 0.08m intervals. Only the selected bench collider is excluded during its permitted contact segment; neighbouring furniture is not excluded. Standing checks the exit and path before commencing; blocked paths are refused with visible feedback. The player collider is disabled during this bounded anchored interaction and restored at the checked exit. This is sufficient for the current static seating arrangement, not a certification against arbitrary new moving obstacles during a transition.

Open modals pause progress without cancelling or moving the character. List view safely resets offscreen; map teleport clears the seat identity, pose and collision state at its destination. Cart mode prevents sitting, and using a cart while in any seat phase is disabled. The collection gesture is unavailable while seated, avoiding competing arm overlays. Bag contents remain editable and unchanged by the seating action.

## Evidence
- `tests/browser_gjh_all_seats.py`: actual movement from existing map destinations to all eight fronts, correct unique seat/facing, intermediate pose weight, final seat and safe stand, preserved bag count. Normal-motion Chromium at simulated 390x680.
- After the close-up addition, a combined eight-seat foreground run reached its 60-second execution limit and is NOT reported as a completed pass; new background workers were temporarily unavailable due to resource quota. Necessary camera checks were completed in bounded groups: courtyard 1/3, courtyard 2/4, and shop seats 5–8, preserving the earlier all-eight behavior evidence. Assertions cover focus mode, close-up distance and restored yaw/pitch; the 2/4 and 844-wide cases restore a nonzero 0.3 yaw / 0.2 pitch.
- `browser_gjh_action_camera.py` verifies normal/reduced-motion collection, close-up activation/distance, completion/modal/blur restoration and unchanged selection. [Collection close-up evidence](evidence/v11-action-camera/).
- The same focused capture mode verifies intermediate Escape reversal, modal pause and Escape isolation, repeated exit, List/teleport resets and disabled cart controls while sitting. No test-only teleport to an unverified arbitrary seat coordinate is used.
- Existing reduced-motion `browser_gjh_seat.py` passed at 390x680 and 1440x900 after the registry/transition implementation.
- [Phase screenshots, endpoint screenshots and reports](evidence/v11-all-seats/). Advisor reviewed existing seat reference before changes and actual intermediate frames afterward. Visual review is separate from collision assertions. Final advisor reviewed close-up collection, both courtyard orientations, all four shop endpoints and the 844-wide seat view. The short-landscape Stand prompt moves to the side. Portrait prompt still covers part of the shoes in some frames; full foot trajectories are not claimed.
- Initial store-seat screenshots revealed foreground bamboo/topiary occlusion despite valid collision checks. Store seats now choose a centre-aisle side camera independently of their sitting orientation; furniture and player anchors remain unchanged. All four shop-seat screenshots were recaptured and inspected, separately from courtyard sit/stand phase frames.
- Generator/SSOT/diff checks passed. No unrelated full-suite rerun, physical iPhone/Safari, accessibility-assistive-device or hardware performance claim is made. The user's broader character interaction matrix remains incomplete.

## Rollback
Baseline 534f19a; revert this slice and regenerate. No model replacement or session-state schema change. A backup branch and reverse-patch check are prepared before push.
