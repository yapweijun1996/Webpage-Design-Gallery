# GJH v11 late asset uploads

The Low-tier iPhone log showed 109–137 ms render submissions when new WebGL geometries and textures appeared in the atrium, then again at the MILI entrance. Decoding and adding a model to the scene can leave buffer upload, texture upload and shader initialization for its first draw. Assets decoded during startup can incur the same work when they first enter the camera view.

## Scene entry points

| Source | When it can first draw | Preparation |
| --- | --- | --- |
| Interior programme for all 17 shops | The fifth loader stage starts all selected-tier kits. On timeout or early entry, ready rooms can appear individually. | The shared uploader prepares the meshes. A sliced queue builds room layers, compiles room light variants and polls the GPU fence. Remaining requests follow the visitor. |
| Expanded interiors and secondary gallery furnishings | Idle prefetch picks the nearest remaining shop. Each asset mounts after its existing load and validation. | The existing preparation hook now runs a sliced GPU job before mounting. Hero fallback stays eligible until release. |
| MILI, New Moon and GOGO detail furniture | The existing shop-detail queue fetches static GLBs. | The final instanced batches go through the same hook before joining the LOD list. |
| Concourse and atrium architecture | The paving map, lift-directory standee and chandelier complete independently of the first scene frame. | The mapped paving material and detached GLB meshes warm before replacing their stand-ins. |
| Upper-deck plaques | The brand-wall module and its images load on the first upper-floor visit. | Its canvas atlas and mesh warm before attachment. The existing deck visibility rule owns later reveals. |
| Visitor and ambient NPCs | Visitor LOD1 completes in the background. The Tripo cart and crowd load separately. NPCs can spawn or replace a rig during exploration. | Visitor LOD1 stays ineligible until its geometry and material are ready. The cart remains unavailable until prepared. NPC admission waits for the concrete rig, and the boy replacement warms both geometries before swapping. |
| Seasonal decoration | The selected seasonal module prepares its stage. | Changes after the first scene frame warm the detached stage before commit. A saved theme restored during initialization is part of the first scene frame. |
| New Moon products and the three original shop interiors | The GLBs, covers and other art are prepared during startup. Their first draw can still occur later because of the camera and shop LOD. | The final New Moon shelf and product batches, original-store art and shop-scoped imported furniture warm in visitor-relative order. A temporary render-layer gate leaves the existing shop and product visibility rules in control. |
| Amenities, initial static furniture outside shops, classic shell, deck railings and storefront art | World initialization awaits the loaders and creates their placements before the first scene frame. | They use the startup scene path. The shared static GLB reader validates and parses; the caller owns the timing of the actual mesh placement. |
| Picked-up cans and product preview dialogs | Picking up a can reuses startup product geometry and materials. Preview dialogs may load on demand. | The pickup flow reuses the world assets. Each preview dialog uses its own renderer and does not add objects to the mall scene. |

During live rendering, the scene sweep, room installer and model uploader share a 4 ms scheduling budget. Room construction yields between fixture placements and GLB primitive transforms, with at most two rooms in flight. Room lighting compilation yields between roots. Warm draws use the real instance and skin bindings with a reduced draw range and instance count. The renderer restores live visibility, geometry ranges and frame counters after every submission. The scheduling budget is checked between calls. Texture allocation, driver work, GLB decode and individual geometry operations can exceed it. Foreground gates pause uploads during elevator travel, seat transitions and collection or product transfers. Hidden tabs suspend scheduling. Pending work restarts after graphics recovery.

## Headed acceptance

Walk from entry through the atrium into MILI and New Moon with Low selected, collecting a fresh performance report for the walk. Use `window.__mall.performanceReport()` or **Download report (JSON)**.

- `uploads.lateAdditions` counts completed late-asset batches released for placement, admission or LOD use. Startup-only prewarm batches are excluded.
- `uploads.maxFrameUploadMs` is the longest shared scheduling slice, including the scene sweep once it runs in the background. `uploads.pendingUploads` is the current queue depth.
- Frame records include `uploadMs` separately from `renderMs`. The upload slice contributes to `callbackMs`. `geometries` and `textures` can increase during a background slice, including before the corresponding asset is visible.

The acceptance target is no frame over 50 ms attributable to an asset appearing along the walk. The timings measure CPU submission, and the headed Chrome walk and physical iPhone result require live verification.

## First visits to already resident geometry

The owner observed a 130–180 ms frame gap on first visiting the Floor 01 atrium, with about 2 ms spent submitting that frame. The existing late-asset queue did not change the isolated gap in the supplied comparison. The GPU stage addresses first draws of objects already in the scene. Attribution of the original gap to a particular driver operation remains unverified.

After the first frame and the optional model wait, the loader reaches **Preparing the mall details…**. The Low, Balanced and Detailed blocking slice budgets are 8, 10 and 12 ms. The six-second watchdog releases the overlay on timeout, including during a shader or fence wait. Enter now stops the blocking sweep, submits the current view under the overlay and polls its GPU fence for up to 300 ms, measured from the start of that submission. The rest of the sweep resumes within the live 4 ms budget. Directory dismissal releases the overlay immediately. Hiding the tab suspends the sweep deadline and scheduling. Graphics loss invalidates pending GPU work.

The manager's previous three Low cold walks had zero intervals ≥50 ms. Balanced and Detailed still had 4–9 such intervals in the atrium after teleports, ranging from 100–283 ms with only 2–4 ms of CPU render submission. On the 393px probe neither higher tier enables desktop shadows or bloom. Both use the embossed material, GLB kit and additional visitors. Detailed also selects downlights and raised lettering. The former warm sweep could inventory procedural fittings before the asynchronous kit replaced them, could miss detached LOD bindings, and only exercised light counts encountered along sampled routes. Slow RAF intervals alone cannot identify the stalling GPU command.

The startup sweep prepares the live direct path while higher-tier signs and post-processing are still staged. The ground floor uses six point-light slots for the nearest accent lights. Slots without a nearby bay contribute zero light, so moving between bays keeps Three's point-light shader count stable. The upper floor still uses zero accent lights. The sweep covers both counts across screen and Detailed linear paths. The 20 expanded poses and three higher-tier chase views sample different lighting and frustum combinations. Each warm draw uses at most one instance per mesh and submits up to six indices or vertices per material group. Balanced and Detailed signage keep the initial 1024 px atlas during staging. Three reserves the full 2048 px mip chain, then uploads it smallest mip first in strips of up to 128 KiB. The selected signs become visible after the sweep's GPU fence.

Manual and Auto changes use the existing per-frame upload queue. The current profile, sign pools and shop interiors stay active until the target scene sweep and all 17 target rooms have finished. The same animation callback then activates both kits and applies the profile. A superseding request closes the old iterator and discards its provisional resources. Context loss cancels the sweep and restoration resets to Low. Individual driver calls can exceed a slice.

`window.__mall.performanceReport().warm` reports blocking `ms`, the loader exit `reason`, camera `probes`, `programs`, `textures`, `lightVariants` and `shadowCasters`. `warm.presentation` records how long the Enter now draw and fence took and why the wait ended. `warm.background` reports whether the sweep is still running or has ended. `interiors.preinstalled.ms` is elapsed installation time for the room programme. Initial physics, world loading and the optional model wait have separate timings.

For attribution, load the mall with `?traceWarm=1` and read `window.__mall.performanceReport().frameTrace`. It retains recent CPU timings for renderer compile and draw, shadow-map rendering, texture uploads, shader reflections, warm slices, room installs, crowd updates and signage. The trace includes WebGL program and resource count deltas. Compare the event timestamps against the preceding animation callback for each RAF gap. Use an ordinary URL for cadence acceptance to avoid profiling overhead.

The Detailed desktop trace on ANGLE Metal found that a live draw could wait for a program already created by the background scene sweep. A program log query took 247 ms in a warm draw with no new textures. Several live draws spent about 98 ms on the same query with no new geometry, texture or program. Bypassing the diagnostic queries in a probe moved the stall to active-uniform reflection. When the driver exposes parallel shader compilation, the scene sweep now polls each link batch to completion before submitting the next one. The live draw and warm batches still use the same renderer and program cache. The mall renderer enables Three's synchronous shader diagnostics only when requested with `?debugShaders=1`.

The supplied standalone probe could not launch Chrome under the shell sandbox. The same teleport and walking route was reproduced in fresh contexts in connected Chrome on Apple M4 with ANGLE Metal. The final runs used an animation-frame wait for the loader, as in the standalone probe, and disabled tracing. Detailed recorded 0, 0 and 0 intervals at or above 50 ms at 1189 × 893 and DPR 1. The maxima were 22.3, 47.0 and 49.6 ms. Balanced recorded 0 at the same viewport, and Low recorded 0 at 393 × 700 and DPR 2. An earlier timer-based reproduction recorded isolated gaps at loader handoff. All final Detailed runs finished installing the 17 rooms and enabled bloom and shadows.

### Desktop early-entry reproduction

The owner's Balanced report retained 20 slow events, including 17 RAF intervals at or above 50 ms. The recorded desktop viewport was 1189 × 945, with an 1189 × 893 drawing buffer at capture. The peak upload slice was 238.4 ms, room preinstall elapsed time was 23,485 ms and the atrium submission at 71.28 s took 226.9 ms. Geometry counts rose on several upload-heavy frames while texture counts held steady. The 21.33 MiB signage atlas was a separate full-upload risk. The report lacks GL call attribution for the upload and atrium spikes.

The 979,804–993,256 triangle peaks were recorded by the foreground monitor, which samples the live scene after the loader hides. Warm draws restore renderer counters. The prior Balanced scene estimate attributes up to 636,196 submitted triangles to New Moon cans, including out-of-range instances scaled to zero. All tiers now compact to visible instances. See the [historical triangle breakdown](gjh-v11-graphics-quality.md#historical-triangle-breakdown).

Run a fresh headed Chrome process for each tier on the original and updated checkouts. Serve each checkout on port 8815 for its corresponding runs. The [early-entry probe](early_entry_probe.py) targets 1.5 s from page load and waits for the Enter now button if first-scene initialization takes longer. It records both times. It walks with live W input for 60 seconds and checks that the path passes within 0.55 m of (29.3, 14.3). The JSON includes every independently observed RAF gap at or above 50 ms, busy callbacks, and correlated WebGL texture, buffer and shader calls.

```sh
python3 -m http.server 8815 --bind 127.0.0.1
```

```sh
export GALLERY_CHROME="/Applications/Google Chrome.app/Contents/MacOS/Google Chrome"
for tier in low balanced detailed; do
  python docs/early_entry_probe.py --tier "$tier" > "early-entry-$tier.json"
done
```

The before/after Chrome runs are unverified in the current sandbox. Loopback port binding and Chrome's Crashpad bootstrap were denied.

### Historical cold-entry probe on macOS

From this worktree's root in one terminal, serve the actual rebuilt site.

```sh
python3 -m http.server 8811 --bind 127.0.0.1
```

In a second terminal at the same root, activate the manager's existing Python environment with Playwright. Keep headed Chrome in the foreground and leave the loader to finish. Each invocation launches a fresh process and browser context with ANGLE Metal, 393 × 612 CSS pixels, DPR 3 and mobile touch emulation.

```sh
export GALLERY_CHROME="/Applications/Google Chrome.app/Contents/MacOS/Google Chrome"
python3 -c 'from playwright.sync_api import sync_playwright'
result=0
for tier in low balanced detailed; do
  for run in 1 2 3; do
    python3 docs/walk_probe.py "$tier-cold-$run" --tier "$tier" || result=1
  done
done
test "$result" -eq 0
```

The original cold-entry probe timestamps the loader's actual hide, samples the first 1.5 seconds and walks entry → atrium → MILI → New Moon → GOGO → atrium. It uses normal W-key input because the `setInput()` hook switches to manual simulation. It verifies movement, uninterrupted foreground focus and overlap between successive five-second histories. An independent RAF observer checks the worst frame even if the mall monitor misses an interval. Each output line includes the entire run's nearest-rank p99 in milliseconds, maximum interval, slow frames and warm telemetry. Keep all nine JSON records. Every run must complete the warm stage and hide the loader within 6000 ms of reaching Details (including the fade), have zero intervals ≥50 ms and a maximum <40 ms, including the first interval after the overlay hides. The probe also checks complete histories, the selected tier, the kit requests during warm, the model count at overlay dismissal, and the Low atlas budget. `entryToHideMs` reports the whole entry path separately. Nine post-change headed walks, desktop shadow timing and physical iPhone results remain unverified.
