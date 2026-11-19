# T1 ground tram route survey

The nominal car crosses all 17 legs of the expanded NPC circuit. Moving the loop outward clears the tested envelopes while keeping the entrance station between the arch rows. The east stop still has no clear boarding side. Use the entrance for the first ride prototype.

Open the expanded v11 mall with `?tram=debug`. The thin orange line and grey box follow the candidate below at 1.5 m/s. Distance zero is the entrance, heading west. Timing begins when the world mounts. A lap takes about 111 seconds.

| Route (world metres) | Entry (x, z) | West x | North z | East x | South z | Corner radius | Arc length |
|---|---|---:|---:|---:|---:|---:|---:|
| Nominal brass line | 10, 39 | -12 | 3 | 32 | 39 | 2 | 156.57 |
| Adjusted debug line | 10, 40.5 | -13.5 | 2.25 | 33.5 | 40.5 | 2 | 167.07 |

## Sweep

Run `node --test tests/gjh_tram.test.mjs` for the current conflict sets, minimum gaps, station probes and sign poses. It samples exact tangent lines and quarter circles every 0.25 m (627 nominal poses and 669 adjusted poses). Envelope lengths remain aligned with the local tangent on bends.

| Envelope | Width × length | Height interval | Centre |
|---|---|---|---|
| Car | 1.40 × 3.00 m | 0.06–1.10 m | Route pose |
| Seated passenger | 0.60 × 0.60 m | 0.50–1.65 m | Car centre |
| Chase camera | 0.50 × 0.50 m | 2.15–2.65 m | 5.2 m behind by track distance, following the bend |

Five-axis box separation includes vertical clearance. Values below are minimum sampled separating-axis gaps, conservative lower bounds for disjoint boxes. The sweep uses ground and elevated layout reservations, seat footprints, public architecture box placements including arch plinths, upper gallery collider callbacks, the lift shaft/slab, closed storefront instance bounds (including handles), and all 17 shop parcels and sliding door pockets. Each consecutive NPC leg, including loop closure, has a conservative 0.35 m square-ended buffer on each side and end, extending to 1.8 m high.

| Obstacle or conflict | Nominal | Adjusted |
|---|---:|---:|
| Static boxes hit, car / passenger / camera | 0 / 0 / 0 | 0 / 0 / 0 |
| NPC legs hit, car / passenger / camera | 17 / 12 / 0 | 0 / 0 / 0 |
| Minimum static envelope gap | 1.56 m | 0.17 m |
| NPC minimum envelope gap | overlap | 0.26 m |
| Arch row at z = 36.30, both piers | 1.56 m | 3.06 m |
| Arch row at z = 42.05, both piers | 1.91 m | 0.41 m |
| Shop door sweep, all bays | 1.78 m | 0.31 m |

The nominal passenger overlaps waypoint legs 0 and 5–16 (zero-based, in source order). The high camera passes above the NPC box. NPCs can choose a different reachable waypoint or move toward the player. The runtime still needs a forward occupancy check before any passenger service. Decorative mesh silhouettes, seasonal overlays, camera framing/occlusion and continuous swept contact between samples require visual or live physics checks.

## Station clearances

A landing probe reserves 1.20 × 1.20 m up to 1.80 m high, beside the centre of the stopped car. Left and right are relative to travel. The western measurement is the ground projection of the proposed upper stop.

| Candidate | Stopped car minimum gap | Left landing | Right landing |
|---|---:|---|---|
| Entrance (10, 40.5) | 0.45 m | South side clear, minimum 1.85 m | NPC legs 10–11 |
| East (33.5, 22) | 0.43 m | S14 frontage and sliding pocket | NPC leg 7 |
| West (-13.5, 10), ground | 0.43 m | S07 frontage and sliding pocket | NPC leg 16 |

Use the south landing at entry for T2. T4 needs a different east landing or segregated pedestrian access. The proposed upper rail axis is 4.50 m west of the slab edge at x = -9. Its bridge, gates, upper platform, vertical travel and egress remain unverified.

## Nearest passenger views

Each row uses the nearest centreline point to the actual fascia centre from the signage builder. The search refines the closest 0.25 m interval. Eye height is 1.48 m at the car centre. Skew is the horizontal angle off the sign's outward normal. Incidence includes the vertical difference; 0° is face-on. Seat yaw is relative to a forward-facing passenger (positive toward the outside of the loop); pitch is degrees above the horizon. Distance is measured along the adjusted line from the entrance.

| Shop | Distance (m) | Seat x | Seat z | Seat yaw | Seat pitch | Horizontal skew | 3D incidence |
|---|---:|---:|---:|---:|---:|---:|---:|
| S01 | 63.53 | -10.00 | 2.25 | 90° | 62° | 0° | 62° |
| S02 | 73.53 | 0.00 | 2.25 | 90° | 62° | 0° | 62° |
| S03 | 83.53 | 10.00 | 2.25 | 90° | 62° | 0° | 62° |
| S04 | 93.53 | 20.00 | 2.25 | 90° | 58.8° | 0° | 58.8° |
| S05 | 103.53 | 30.00 | 2.25 | 90° | 58.8° | 0° | 58.8° |
| S06 | 59.05 | -13.49 | 4.10 | 90° | 69.2° | 4.4° | 69.3° |
| S07 | 51.14 | -13.50 | 12.00 | 90° | 69.4° | 0° | 69.4° |
| S08 | 43.14 | -13.50 | 20.00 | 90° | 69.4° | 0° | 69.4° |
| S09 | 35.14 | -13.50 | 28.00 | 90° | 69.4° | 0° | 69.4° |
| S10 | 27.14 | -13.50 | 36.00 | 90° | 69.4° | 0° | 69.4° |
| S11 | 22.56 | -12.51 | 40.22 | 90° | 36.8° | 59.6° | 66.1° |
| S12 | 108.02 | 33.49 | 4.10 | 90° | 69.2° | 4.4° | 69.3° |
| S13 | 115.92 | 33.50 | 12.00 | 90° | 69.4° | 0° | 69.4° |
| S14 | 123.92 | 33.50 | 20.00 | 90° | 69.4° | 0° | 69.4° |
| S15 | 131.92 | 33.50 | 28.00 | 90° | 69.4° | 0° | 69.4° |
| S16 | 139.92 | 33.50 | 36.00 | 90° | 69.4° | 0° | 69.4° |
| S17 | 144.50 | 32.51 | 40.22 | 90° | 36.8° | 59.6° | 66.1° |

S11 and S17 exceed the T1 horizontal review threshold of 45°. Both fascia centres are at z = 44; capture them on the southwest and southeast arcs. A second screening threshold of 60° in 3D also flags S01–S03 and S06–S17. Many nearby signs sit steeply above the passenger. For T3, compare an earlier approach view and the projecting blade signs before choosing each card trigger. Take one seat-eye image per row on phone and desktop. These geometric angles alone cannot establish legibility.
