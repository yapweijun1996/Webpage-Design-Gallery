# GJH v11 upper-deck layout audit

Baseline `d7756af1`. Units are metres. X increases east and Z south. Heights below are relative to the +7.20 m slab unless marked world. Sizes are width × height × depth in local axes. Yaw rotates a +Z face toward +X. A rectangular assembly is listed once with its repeated children specified by count or placement rule.

## Diagnosis from the supplied phone views

- At the west landing the old oak bench was only 2.55 m south of the exit centre. Its near corner visually overlapped the portal planting. The oak bench and neighbouring areca had about **0.52 m** of clear space along Z. The sofa and side table had about **0.33 m** along X. Both missed 0.90 m.
- All original brand faces already lay in one Z plane, parallel to the south guard. Perspective made the alignment look diagonal. The artwork actually occupied five different heights with four plaques per tier, and the story anchors had further artificial X and Z offsets. The opaque 2.46 m backing hid the space beyond.
- The old directory was more than 1.5 m from the exit. Its front normal was due north, while the arriving visitor was northwest of it. Its base and the neighbouring planting competed with the approach. The new directory ends the westbound exit axis. Its nearest face is **2.295 m** from the exit centre and the normal points directly back to the visitor.
- Two different floor details appear in the report. The bright, angular lines belong to the kit's **rectangular MarbleInlay** with a baked vein pattern. The dark round surface in the supplied west views sits inside a circular pot below the areca leaves. The only separate planter-floor graphic is a thin luminous annulus with an empty centre. A precise identification of the owner's separate, relayed image is unavailable. Upper portal planters and marble apron are removed. The physical docked threshold remains.
- In the supplied east shots the oversized near-field “Elevator” face extends beyond the phone viewport. The atlas text fits its original quad. The west-facing portal and the roof of the opaque moving cabin could occupy the chase camera foreground. This is separate from the south brand backing. The upper sign is inset, portal jamb/header dimensions inform camera clearance, and an outside visitor's upper chase arm stays on the deck side of the shaft.
- The fixed slab and shaft guards were axis aligned. Rotating them to make their perspective projection horizontal would open collision gaps at the slab edges.

## Deck and interaction inventory

| Object | Baseline centre (X,Z), local height or support | Size and yaw | Revised placement |
| --- | --- | --- | --- |
| West/east slab panels | (−7,10), (1,10), top 0 | 4 × .40 × 12 each, 0° | Retained |
| North/south infill panels | (−3,6), (−3,14), top 0 | 4 × .40 × 4 each, 0° | Retained |
| Stone tile finish | 8 × 8 grid from (−9,4), +.008 | 1.5 m pitch, .018 joints, clipped to the four slabs, flat | Retained |
| Outer guards | X −9 and 3 at Z 10, Z 4 and 16 at X −3 | Four 12 m runs. Glass 1.06 high, .10 thick. Brass caps 1.158 high, amber strips at .115. Yaw 0° or 90° along edge | Retained |
| Shaft guards | X −5 and −1, Z 8 and 12 around (−3,10) | Four 4 m runs, 1.1 high, .10 thick, west run split at Z 9 and 11. Brass posts per run at equal bay centres, maximum bay 1.95 m | Retained |
| Gate, threshold and side returns | (−5,10), (−4.8,10), (−4.8,9/11) | Gate .10 × 1.10 × 2. Threshold .40 × .08 × 2. Two .40 × 1.10 × .055 returns, yaw 0° | Retained, including docking and away-state collision |
| Moving cabin and rear mark | (−3,10), 0 to +7.2 world travel | 3.2 × 3.2 footprint. Physical rear panel .10 × 2.20 × 3.20. Mark 2.12 × 1.52 faces west | Retained |
| Fixed rear screen, trim and logo | (−.90,10), centre 1.29 | .14 × 1.72 × 3.05. Two 2.16 m posts, two 3.09 m cross strips. Mark 2.06 × 1.48 at X −.975, yaw −90° | Retained |
| Directory and pedestal | (−2.96,13.52), graphic centre 1.43 | 2.46 × 2.56 print, .15 thick backing, yaw 180° | (−8.78,10), print 1.48 × 1.72 at 1.16, yaw 90°, two light edges and brass pedestal |
| Oak bench, seat 1 | (−6.65,12.55) | 2.128 × .495 × .651 at +.024, yaw 0° | (2.52,5.98), yaw 90°, west-facing open side |
| Slatted bench, seat 2 | (.10,8.80) | 2.12 × .505 × .583, five boards and two brass supports, yaw 0° | (2.52,12), yaw 90°, same east rail |
| Upholstered sofa, seat 3 | (−3,6) | 2.064 × 1.054 × .738, yaw 180°. Fallback width 2.34 | (−5.66,4.72), yaw 180°, opens south |
| Lounge rug | (−3.05,6.27), +.022 | 4.87 × 2.23 flat, yaw 0° | (−5.10,5.84), 6.60 × 3.12 |
| Side table, floor lamp | (−4.79,6.05), (−1.38,5.75) | .858 × .689 × .552 and .60 × 1.70 × .60 at +.024, yaw 0° | (−1.50,4.72), (−3.25,4.72) |
| Two footstools | Absent | Round .66 diameter, .385 high, yaw 0° | (−7.38,6.40), (−3.56,6.40), shared opaque batch |
| Areca pots, soil, foliage and accent rings | (−6.25,13.80), (.45,13.80), (−7,8), (.45,6.15) | .836 × 1.596 × .810 canopy, .68 × .50 × .68 collision, yaw 0°. Ring radii .408/.447, +.031 | Northwest (−8.40,4.65) and southeast (2.45,15.28) corners |
| Brand backing and two brass trims | (−3,15.78), centre 1.23 | 9.40 × 2.46 × .16, yaw 0° | 10.30 × .66 × .16 timber band at 1.42, brass edges |
| S01…S17 plaque quads | X = −6.25 + 2.15(column), Z ≈ 15.69. Height 2.16 − .455(row), numbered row-major | 2 × .40 each, yaw 180°. Old story offsets X + .13(row−2), Z = 14.50 + .05(column) | One .55 × .48 face per slot, yaw 180°, Y 1.42. For one-based slot s, X = −3 + (9−s) × .59 and Z ≈ 15.70. Every story approach shares its face X at Z 14.76 |
| Opposite four shop windows and fascias | X ≈ 10, Z = .25, 6.75, 13.25, 19.75 | Windows 6.18 × 2.32, fascias 4.81 × .60, yaw −90°, fascia centre +4.20. Two lower return windows, eight shelves, four plinths | Retained across the permanent lightwell |
| Roof and sky | Barrel centred X −3, spans Z −2.94…23.13 | Radius in X 13.18, arch rise 3.91 above world 13.14, 24 glazing bays. Sky radius 66, 12 equal vertical faces and one cap | Retained. Clerestory, ribs and outer arcade greenery in public-architecture.js are outside the walking deck |

The fitted lift kit's upper root is at (−5,7.2,10), yaw −90°. Local points (u,v,w) map to (−5−w,7.2+v,10+u). The following node envelopes are local Low GLB bounds, in metres. A range specifies both size and position; decorative components share their parent yaw.

| Kit object | Local X range | Local Y range | Local Z range | Upper change |
| --- | --- | --- | --- | --- |
| Portal | −2.075…2.075 | 0…3.763 | −.279….242 | Camera clearance |
| GoldTrim | −2.10…2.10 | 0…3.792 | −.282….258 | Retained |
| Pilasters | −1.835…1.835 | .070…3.590 | .050….197 | Retained |
| Sconces | −1.785…1.785 | 2.040…2.473 | .158….385 | Retained |
| Paired Planters | −2.256…2.317 | .007…1.259 | .078….903 | Omitted from upper landing |
| ElevatorSign | −1.25…1.25 | 3.097…3.573 | .104 | Inset upper sign |
| MarbleInlay | −2.18…2.18 | .002….024 | −.266…1.646 | Omitted from upper landing |
| FloorIndicator | 1.228…1.452 | 1.755…1.905 | .246 | Retained |
| Moving Cabin | −1.59…1.59 | −.022…2.92 | −3.54…−.34 | Travels with physical floor |
| DoorLeft / DoorRight | ±.505 centres, .5015 half-width | 0…2.88 | −.042….042 | Two leaves slide 1.02 m each |

The 11 mounted Tripo additions use the ground-floor interior-additions registry, including the suspended arcade pendant. None is mounted on the deck. The standing/seated visitor is dynamic. The upper POI set consists of the three published seat exits (1.20 m out from the seat centre) and the 17 brand-story approaches in the table. Directory and lightwell are extra walking stops.

## Verification

The placement test checks the rendered plaque vertices and story anchors, the directory normal and stand-off, the 1.50 m turning circle, furniture envelope separation and connected 1.20 m circulation strips. The no-browser smoke test builds the shipped meshes and runs a Rapier capsule through the itinerary with the real slab, gates, furniture and void colliders. The upper-only Low batches submit **6 draws / 5,633 triangles** without frustum credit. Whole-scene counts are recorded separately per phone view.

Use two worktrees served in turn with the same browser configuration. Run `python docs/upper_layout_shots.py before --url URL` against the baseline and `python docs/upper_layout_shots.py after --url URL` against the revision. The probe requires a docked upper arrival and all 20 POIs. It uses the same five world-space player targets and view angles; chase-camera clearance can legitimately change the final lens position.

## Phone comparison

390 × 844 CSS pixels, DPR 3, touch, Low, test hooks enabled. Both runs used the worktree HTTP server. Screenshots and renderer counters come from the same stepped player pose. The camera moved to avoid the lift on three views. These counts include the environment behind the deck. Each after view is below both the 70-draw limit and its baseline triangle count.

| View | Before | After | Draws | Triangles before → after |
| --- | --- | --- | --- | --- |
| Lift exit facing directory | [Before](evidence/gjh-v11-upper-layout/before/landing.webp) | [After](evidence/gjh-v11-upper-layout/after/landing.webp) | 38 → 38 | 72,263 → 56,021 |
| West aisle | [Before](evidence/gjh-v11-upper-layout/before/west-aisle.webp) | [After](evidence/gjh-v11-upper-layout/after/west-aisle.webp) | 51 → 52 | 161,051 → 154,169 |
| South brand gallery | [Before](evidence/gjh-v11-upper-layout/before/brand-gallery.webp) | [After](evidence/gjh-v11-upper-layout/after/brand-gallery.webp) | 48 → 47 | 109,933 → 95,203 |
| East rail facing lightwell | [Before](evidence/gjh-v11-upper-layout/before/east-rail.webp) | [After](evidence/gjh-v11-upper-layout/after/east-rail.webp) | 53 → 44 | 129,389 → 120,271 |
| Lounge from east | [Before](evidence/gjh-v11-upper-layout/before/lounge.webp) | [After](evidence/gjh-v11-upper-layout/after/lounge.webp) | 44 → 44 | 76,170 → 71,666 |

Chrome walked the published route to all three seats and all 17 plaques, reached the directory and lightwell, and returned by lift. Map trips, including calling the upstairs car from the ground, passed separately. The recorded itinerary is in [reachability.json](evidence/gjh-v11-upper-layout/reachability.json).

The full `verify_upper_level.verify(page, args)` Python assertion body also passed at its default Balanced tier in connected Chrome, including its image-content checks, HUD ride, map rides and automatic cabin call. A temporary transport adapter evaluated its locators and movement steps in that browser. The shell's Playwright launch failed at the macOS Chrome Mach bootstrap permission check. Chrome DevTools used the existing server on port 8870, the script's five pose definitions and the real mall renderer instead. The supplied four images and fifth sibling image informed the diagnosis. They are separate from the paired measurement images. The project router's investigation and verification module files were absent in this checkout, so verification used the repository tests, shipped models and browser scene directly.

The new totem uses the circulation plan for its arrows. At its printed face, the north aisle is to the visitor's right and the south aisle to the left. These paths lead toward the respective windows across the lightwell.

Two Low phone laps used the existing lap probe's 393 × 700 viewport at DPR 2, zone order, dwell/walk intervals, renderer-history extraction and budgets in the connected browser. All 40 stops met the 30 FPS target, p95 ≤ 36 ms, mean ≥ 29 FPS, 70 draws and 220,000 triangles. Both upper stops peaked at 68 draws on the S10–S12 integrated scene. The later PWA integration preserved the renderer and walking route. Upper p95 was 34.9 and 35.3 ms. The complete stop measurements are in [low-laps.json](evidence/gjh-v11-upper-layout/low-laps.json).

The generator check passed for 51 designs. The Node suite passed 374 tests with one optional external-source comparison skipped, and all 15 gallery Python tests passed. The repository-wide gallery, demo and PWA browser launchers could not bind their local servers in this shell. While verification was running, main advanced through `659a4969` (S10 comparison tins) to the measured lap build `18f145c6` (S11/S12 package studies). The model files, manifests, sources and documentation from both revisions were incorporated byte-for-byte into the worktree and the combined gallery regenerated. The linked Git directory is read-only in this environment, so the branch pointer stays at the photographed baseline `d7756af1`. Changes remain uncommitted.

For the 60-second desktop Low early-entry walk, the final combined worktree recorded **0 of 3,595 frame intervals ≥ 50 ms**, a maximum interval of 47.9 ms and zero application callbacks ≥ 50 ms. The earlier fresh-context runs also passed (33.7 ms maximum on the S10 integration and 33.3 ms on the S11/S12 integration). Two earlier runs in reused contexts each had one slow interval, 50.1 and 66.7 ms. The unmodified photographic baseline recorded zero slow intervals and a 48.4 ms maximum. These measurements show run-to-run variation. All runs reached the probe's target position. [Candidate runs](evidence/gjh-v11-upper-layout/early-entry.json) · [Baseline run](evidence/gjh-v11-upper-layout/early-entry-baseline.json)

The final generation includes the subsequent main merge `898266f9`, which added PWA update recovery. All 44 upstream source and asset files changed since the photographic baseline were verified byte-for-byte against that commit. The gallery generator produced the combined output from those files and the upper-deck edits.

## Upper lift exterior

The fixed shaft skin sits outside the existing guards. It leaves the west door opening clear and carries a satin brass plinth, vertical reveals, a capped cornice and a recessed amber strip. The south panel carries a second directory facing the brand walkway. The west landing retains the exit-facing directory. The fitted portal keeps its animated floor indicator, moved forward to clear the new lacquer panel.

The deck uses one additional opaque lacquer draw in every tier. Brass profiles, atlas graphics and the cove use existing batches. The lacquer's minimum linear RGB channel exceeds 0.06. Without frustum credit, Low upper batches rose from 6 draws and 5,633 triangles to 7 draws and 5,863 triangles. Camera sweeps use the outside finish envelope on the deck and the docked car's inner walls and ceiling inside the shaft.

Run `python docs/upper_layout_shots.py after-v2 --url URL` for the [five original viewpoints and measured poses](evidence/gjh-v11-upper-layout/after-v2/poses.json). The no-browser regression in `tests/gjh_upper_level.test.mjs` raycasts all elevations and the roof, checks the open doorway, linear albedo and draw budget, and exercises the chase sweep at the reported cabin position.

The five Low phone views measured 35, 53, 46, 44 and 45 draws respectively. The [walkway view](evidence/gjh-v11-upper-layout/after-v2/details/walkway.webp) shows the door plate, indicator, cove and south directory together. The [cabin corner](evidence/gjh-v11-upper-layout/after-v2/details/cabin-corner.webp) reproduces the approach to (−1.8, 11.2). Eight chase headings were checked there.

The phone captures use connected Chrome at 390 × 844 CSS pixels and DPR 3. A temporary transport adapter ran the two Python probes against that browser because the shell could not start Chrome. It sampled transient call and travel states on animation frames. The Balanced route completed the manual and map round trips, including the empty-cabin call, and reached all 20 upper POIs. The separate repository-wide Gallery, GJH demos and PWA launchers could not bind their local server in this sandbox.
