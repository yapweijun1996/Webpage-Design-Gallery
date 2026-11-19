# GJH v11 interior layout audit

All 150 authored standing positions in S02–S17 pass the 1.5 m turning-circle and 1.2 m approach checks. All 65 playable routes, including S01, pass the offline check using the headed interaction probe’s threshold, waypoints and final stance. S01 was included in regression testing only.

## Findings by shop

The baseline is worktree revision `752bfddf`, using its original studio colliders. Counts are failed checks before the changes. A fixture can fail several checks. “Gap” counts separate pairs, including nearby studio fixtures. “Grid” includes fixed mounts subsequently documented as intentional. Every row has zero final violations. The final radius is the smallest obstacle clearance at any authored stance in that shop, rounded to millimetres.

| Shop | Turning | Gap | Wall fit | Grid / yaw | Seat aim | Plant | Floor axis | Aisle | Final radius (m) | Placement changes |
| --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | --- |
| S02 MILI | 9 | 0 | 0 | 7 | 2 | 0 | 0 | 0 | 0.751 | Rotated both kitchen benches toward the pass, moved their exits with them and separated the two plates on the counter. |
| S03 GOGO | 10 | 1 | 0 | 8 | 4 | 0 | 1 | 0 | 0.760 | Turned the benches and stools toward the cart. Brought the dispenser and tray toward the serving edge and moved the chest behind the cross aisle. |
| S04 Borsch Med | 9 | 1 | 2 | 9 | 0 | 1 | 1 | 0 | 0.750 | Kept the folio registered to its baked samples. Fitted the counter and cabinet to the side runs and moved the orchid into the rear corner. |
| S05 Pien Tze Huang | 9 | 7 | 2 | 8 | 0 | 1 | 0 | 0 | 0.750 | Pulled the specimen drawers clear of the rear bays and separated both flanking pieces. Fitted the display case to the left lining. |
| S06 Flying Wheel | 9 | 2 | 2 | 9 | 0 | 0 | 1 | 0 | 0.750 | Kept the loom on the island. Grouped tray and chopsticks on the left counter and set the window rack against the same wall. |
| S07 Gu Long | 8 | 3 | 1 | 8 | 0 | 0 | 1 | 0 | 0.750 | Kept the pyramid on its drum. Set the sampling shelf against the left wall and tucked the planter behind it, clear of the rear bays. |
| S08 Skippy | 9 | 1 | 1 | 9 | 1 | 0 | 1 | 0 | 0.750 | Aimed the picnic chair at the jar display. Fitted the toast counter to the left lining and registered the window jar to its actual GLB. |
| S09 SPAM | 9 | 1 | 2 | 9 | 0 | 0 | 1 | 0 | 0.750 | Kept the conveyor diagonal. Moved the scanning bench aft so the belt and bench have separate footprints. |
| S10 California Mexico | 9 | 2 | 1 | 8 | 0 | 0 | 1 | 0 | 0.762 | Kept the shell cradle in view between the entrance baskets. Moved the gift-box GLB with the display case and placed the orchid in the rear-right corner. |
| S11 Hormel | 9 | 4 | 2 | 9 | 0 | 0 | 1 | 0 | 0.750 | Separated the pallet, crate and wall racks. The scale shares the counter transform and the rear rack has a reachable operating side. |
| S12 Zeria | 9 | 3 | 1 | 9 | 0 | 0 | 1 | 0 | 0.750 | Separated the easel from the rear cabinetry and placed the herb planter in the rear-left corner opposite the approach. |
| S13 Sony | 9 | 2 | 1 | 9 | 1 | 0 | 1 | 0 | 0.750 | Aimed the listening chair at the headphone stand. The soundbar desk sits against the left wall and the baffle returns along the right side. |
| S14 LG | 9 | 3 | 1 | 9 | 2 | 1 | 1 | 0 | 0.765 | Aimed both lounge seats at the TV, set the refrigerator against the wall and moved the orchid to the rear-right corner. |
| S15 Casio | 9 | 2 | 1 | 9 | 1 | 0 | 1 | 1 | 0.750 | Aimed the recital chair at the piano. Separated the glass case from the acoustic panel and moved the pendant with the keyboard. |
| S16 GP | 9 | 1 | 2 | 9 | 0 | 0 | 1 | 0 | 0.750 | Fitted the electronics shelf to the left wall. Moved the battery test target to the actual right-window rack and measured its scaled GLB. |
| S17 Gigaset | 9 | 4 | 2 | 8 | 1 | 0 | 0 | 0 | 0.775 | Turned the original sofa toward the handset. Moved the desk and telephone to the right wall, separated the filing cabinet and placed the planter on the entrance side. |

## Measurement and intentional placements

- The doorway camera looks down local −Z with its eye 1.6 m above the finished floor. The audit uses the 58° vertical field of view and each shop’s authored capture aspect. At least one ray to the upper focal silhouette must fall inside the view and hit the focal envelope before another fixture. GOGO’s cart enters the frame from the left. All 16 entrance checks passed before and after.
- Routes use the existing 0.28 m capsule, the 0.60 m aisle radius and the shipped studio collision boxes. The arrival-to-browse segments are checked as well as connected walking space. Every authored stance must have 0.75 m radial clearance. The offline probe test walks each authored straight segment through these envelopes.
- A large item has at least one envelope dimension of 0.80 m. The validator measures the shortest Euclidean distance between rotated rectangular footprints when their height intervals overlap. Minimum separation is 0.15 m. Mounted items can meet their support. A studio island collider retained for a replacement display represents that same display.
- Both ends of a rack, display case, cabinet or perimeter counter back must meet the wall finish or built-in lining within 0.02 m. The wall-normal coordinate can be off-grid to achieve this fit. Other movable positions use the 0.05 m floor grid and 15° yaw steps. Vertical coordinates follow the actual support surface. The MILI kitchen mounts, GOGO cart and Borsch folio/sample keep their registered artwork transforms.
- Seats face the focal item to the nearest 15°. Native benches and stools open toward local −Z. The procedural chairs and acquired lounge sofa use +Z. A plant occupies a corner when its footprint is within 1.5 m of both a side and an end of the room. The main floor field is centred on the longitudinal axis.

## Verification

Run `node scripts/gjh_interiors/sweep.mjs` for per-shop findings and `node --test tests/gjh_interiors_layout.test.mjs tests/gjh_interiors.test.mjs tests/gjh_shop_interactions.test.mjs` for the probe routes, live target selection rules, seat exits, GLB envelopes and per-shop tier budgets. Runtime projections are checked with `python3 scripts/gjh_interiors/build_layout.py --check`.

The largest measured individual kits were 2,766 triangles on Low (S04), 4,508 on Balanced (S07) and 7,232 on Detailed (S10). Peak individual kit draws were 7, 8 and 10 respectively. Mesh files were unchanged. These are individual kit measurements. Full-scene lap budgets, device FPS, visual contacts and cold-entry frame timing require the foreground browser probes.

Gallery and layout generation checks passed. The Node suite passed 338 tests with one optional external icon-catalogue check skipped. All 15 Python gallery tests passed.

The three gallery browser suites stopped at the sandbox’s loopback bind restriction. The headed interaction run stopped at Chrome launch when the sandbox denied its Crashpad Mach handshake. Gameplay dispatch and rendered views remain unverified on this revision.
