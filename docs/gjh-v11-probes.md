# GJH v11 performance and visual probes

Run in foreground headed Chrome on the measurement machine. Use Python 3.10+ with Playwright, NumPy and Pillow. Set `GALLERY_CHROME` to the local Chrome executable or install Playwright Chromium with `python -m playwright install chromium`. Use the same Chrome, display refresh, power mode and viewport for comparisons.

## One-command suite

On the reference revision, record the lighting reference, inspect its PNGs and retain the JSON. The runner serves the worktree on an unused loopback port and closes it on exit.

```sh
python scripts/run_perf_suite.py --update-baseline --out output/reference
python scripts/run_perf_suite.py --out output/candidate
```

The first command explicitly replaces `output/lighting-baseline.json`. The second compares against it. Both run phone/Low, tablet/Balanced and desktop/Detailed laps, followed by three default video segments, all 17 shop segments, the upper-deck segment and 48 lighting views. Each stage keeps its own artifacts and exit status in `summary.json`. Any failed stage gives the suite a nonzero exit. Use a fresh output directory per revision. Reserve disk space for all captured JPEGs.

## Individual measurements

From the repo root, serve once with `python -m http.server 8830 --bind 127.0.0.1`. Individual probes accept `--url` for a different served mall. Keep one probe in the foreground at a time.

```sh
python docs/mall_lap_probe.py --device phone --refresh-hz 120 --dsf 3 --laps 1 --json phone.json
python docs/mall_lap_probe.py --device tablet --tier balanced --cpu-throttle 4 --json tablet.json
python docs/mall_lap_probe.py --device desktop --tier detailed --dsf 2 --json desktop.json
python docs/mall_video_probe.py --route shops --device phone --out output/shops-phone
python docs/mall_video_probe.py --route upper --out output/upper
python docs/mall_video_probe.py --route character
python tests/browser_lighting.py --update-baseline
python tests/browser_lighting.py --out output/lighting-candidate
```

### Lap

Phone uses Low unless a tier is supplied. The phone gate requires the 30 FPS cap, p95 ≤36 ms and mean ≥29 FPS. Tablet and desktop require p95 ≤20 ms and mean ≥57 FPS. Below 60 Hz the non-phone allowance is 1.2 native frame periods and 95% of native FPS. A foreground blank page measures the reference refresh before loading the scene. Supply the known native rate via `--refresh-hz` when possible. It changes the reference used to grade samples. JSON retains the application's observed refresh rate and actual target. Each stop checks peak triangles/draw calls against Low 220,000/70, Balanced 300,000/90 or Detailed 420,000/110.

The per-stop JSON includes p95, p99, ≥50 ms count, mean frame interval, renderScale, buffer size, renderer name when exposed, linked Three.js program count, visible point-light count and mean GPU elapsed time. A probe-only Three.js observer starts a WebGL2 elapsed query at the first draw and ends it after the animation callback's last pass. Results are polled asynchronously. Unsupported timers, disjoint queries and unavailable results yield zero valid samples and null GPU time when none remain. A privacy-restricted renderer name can also be null.

`--dsf 2` or `--dsf 3` repeats matched stops at DSF 1 and the selected DSF, printing the change in mean rendered-frame interval per unit DSF. Inspect buffer dimensions, renderScale and GPU time alongside the slope. A frame cap, pixel-ratio cap or dynamic resolution can mask fill-rate cost. `--cpu-throttle N` applies Chrome's CDP slowdown to each page before navigation. Desktop touch emulation and CPU throttling are proxies. Confirm acceptance on the actual phone, tablet and desktop.

Cold early entry uses its own workload. Serve on port 8815 and run the repository's `docs/early_entry_probe.py --tier low` with Python, then repeat with `balanced` and `detailed`. The acceptance limit is zero frames ≥50 ms and zero busy callbacks ≥50 ms. This existing probe expects `GALLERY_CHROME` and the Metal backend.

### Video and character detail

The shops route records the entrance, walks forward, moves inside and checks the visited zone. A blocked entrance fails the segment. The upper route boards the lift and verifies the upper floor. Each segment saves all CDP JPEGs with their original timestamps in `timeline.json`. Review the contact sheet, heat-map and numbered region PNGs with `summary.json`. Areas count hot analysis pixels, with 8-way connectivity at 320 px analysis width. Region boxes have exclusive right and bottom edges. Crops come from the original middle screencast frame. A 0.001 hot share and zero ≥50 ms screencast gaps are the default limits. Confirm suspected flicker visually and compare stutter against a separate lap without recording.

The character route writes eight PNGs and four unscaled crops per pose to `output/character-baseline`. Desktop uses Detailed at 1920×900 and phone uses Low at 393×700. The probe stages the live player and the Tripo NPC in a bind pose on the same atrium mark under the Everyday theme. A front camera sits 5.2 or 2.5 m from the upper torso. The NPC is included in the base pass for this portrait. Each image captures the viewport at DSF 1, with bone-projected face, hair and individual hand crops from that image. The manifest records model, camera, crop boxes, renderScale and actual drawing buffer size. Review framing and character identity in the full PNG before comparing detail. Use `--device` to capture a single preset.

### Lighting

Eight fixed views cover the entry, atrium, three original storefronts and north/west/east planned storefronts. Each runs at widths 390 and 1440 on all three tiers. The test fixes the Everyday theme, freezes simulation at each pose, removes NPCs and captures the visible canvas without the HUD. It measures mean and population standard deviation of 8-bit image luma and the ratio of mean red to mean blue. Each pose compares to its own reference. Initial tolerances allow mean brightness from 90% to 115%, contrast ≥95% and R/B ≥97% of reference. A missing baseline fails comparison. Baseline creation is only a recording step. Keep its JSON with the reviewed PNGs and compare on the same graphics configuration.

Offline checks use synthetic frames and mocked GPU queries:

```sh
node --test tests/gjh_probe_gpu.test.mjs
python -m unittest discover -s tests -p test_mall_probes.py -v
```
