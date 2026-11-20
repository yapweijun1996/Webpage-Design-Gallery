# GJH v11 slow 3G startup

The acceptance gate is a cold navigation to a visible **Enter now** button within 30 seconds in headed Chrome at 393 × 700, with gzip, 400 ms RTT and 1.6 Mbps download. The manager measured baseline `a1575a66` with a fresh context and service workers blocked.

| Chrome waterfall | Baseline | Candidate |
|---|---:|---:|
| Enter now | 33.4 s | Pending headed Chrome |
| Completed transfer | 5,417 KiB | ≈4,715 KiB projected |
| Completed requests | 124 | Pending headed Chrome |
| Startup pack completed | 26 s | Pending headed Chrome |
| Rapier WASM completed | 20 s | Pending headed Chrome |
| Separate Low elevator GLB | Started at ≈28 s | Served from startup pack on the normal Low path |

The projection subtracts the changed asset payloads from the manager's rounded baseline. It assumes that all four small illustrations finish before the button, as all four originals did in the baseline. It excludes request headers, scheduling, speculative and optional loads, and small changes in compressed HTML, CSS and JavaScript. The static entry dependency test reports 4,722,447 gzip wire bytes for phone and 4,799,317 for desktop. Its declared graph excludes lazy artwork and optional network traffic, so these totals use a different scope from the browser waterfall.

## Changes by expected impact

| Change | Baseline bytes | Candidate bytes | Transfer time saved at 204,800 B/s |
|---|---:|---:|---:|
| Four concept illustrations on viewports up to 600 px | 692,328 | 81,612 | 2.98 s |
| Startup pack with gzip plus initial Low elevator GLB | 2,607,699 | 2,499,110 | 0.53 s |
| Both groups | 3,300,027 | 2,580,722 | 3.51 s |

The four mobile WebP variants use `cwebp -resize 480 0 -q 60 -m 6`. The original sources remain available on wider screens. The arrival illustration loads eagerly with low priority, and directory and menu copies use lazy loading and asynchronous decoding.

The pack holds the original Low lift GLB byte for byte, including its west-door appearance. Its internally compressed size grows from 2,394,116 to 2,545,064 bytes. The table applies the supplied gzip helper's level-6 outer encoding to both packs and the helper's uncompressed response to a standalone GLB. The normal Low path eliminates one late request and its RTT. The procedural stand-in, mount after GPU warmup, door and ride state, and individual fetch fallback stay in the same code path. Balanced and Detailed still load their own unchanged kits as required.

Both the startup pack and Rapier transfer start at high priority when the visitor chooses 3D. The shared promises keep the loader's progress and world initialization on the same transfers. Projection, guidance, shelf focus, the product modules and the three brand-cover textures are now discovered at walk entry. Directory-only visits leave the walk hints inert. The time saved by earlier discovery requires a browser waterfall.

Rapier remains a prerequisite because world and player initialization construct live colliders, joints and a rigid-body world before drawing. The startup gate, loader audio gesture and PWA cache policy are unchanged. Splitting or lowering the fidelity of the scene pack and modifying the Three.js vendor build would need new visual and timing evidence.

## Verification

The generated gallery check, 15 Python gallery tests and five probe unit tests passed. The Node suite passed 419 tests with zero failures and one optional Studio checkout test skipped.

The local sandbox denied both HTTP server binding and Chrome's Crashpad bootstrap. The headed waterfall, early-entry walk, all-tier laps, 65 actions, physics props, tram, lift appearance and upper ride, and browser PWA update checks require the manager's Chrome session.

Use the supplied `docs/gzip_static_server.py 8903 .` and `docs/load_waterfall.py` in separate terminals with the reference `GALLERY_CHROME` and Python environment. Check that the visible button branch was observed, since the helper also accepts the automatically completed loader. Run the phone early-entry probe with a server on port 8815 and the lap and gameplay probes with a server on port 8830.

```sh
python docs/early_entry_probe.py --tier low --device phone
python docs/mall_lap_probe.py --tier all
python docs/verify_interactions.py
python docs/verify_physics_props.py
python docs/verify_tram.py
python docs/verify_upper_level.py
python tests/browser_gjh_ground_lift.py
python tests/browser_gjh_expanded_lift.py
python tests/browser_gjh_pwa.py
python tests/browser_pwa.py
```
