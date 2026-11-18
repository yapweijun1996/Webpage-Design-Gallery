# GJH v11 late asset uploads

The Low-tier iPhone log showed 109–137 ms render submissions when new WebGL geometries and textures appeared in the atrium, then again at the MILI entrance. Decoding and adding a model to the scene can leave buffer upload, texture upload and shader initialization for its first draw. Assets decoded during startup can incur the same work when they first enter the camera view.

## Scene entry points

| Source | When it can first draw | Preparation |
| --- | --- | --- |
| Expanded interiors and secondary gallery furnishings | Idle prefetch picks the nearest remaining shop. Each asset mounts after its existing load and validation. | The existing preparation hook now runs a sliced GPU job before mounting. Hero fallback stays eligible until release. |
| MILI, New Moon and GOGO detail furniture | The existing shop-detail queue fetches static GLBs. | The final instanced batches go through the same hook before joining the LOD list. |
| Concourse and atrium architecture | The paving map, lift-directory standee and chandelier complete independently of the first scene frame. | The mapped paving material and detached GLB meshes warm before replacing their stand-ins. |
| Upper-deck plaques | The brand-wall module and its images load on the first upper-floor visit. | Its canvas atlas and mesh warm before attachment. The existing deck visibility rule owns later reveals. |
| Visitor and ambient NPCs | Visitor LOD1 completes in the background. The Tripo cart and crowd load separately. NPCs can spawn or replace a rig during exploration. | Visitor LOD1 stays ineligible until its geometry and material are ready. The cart remains unavailable until prepared. NPC admission waits for the concrete rig, and the boy replacement warms both geometries before swapping. |
| Seasonal decoration | The selected seasonal module prepares its stage. | Changes after the first scene frame warm the detached stage before commit. A saved theme restored during initialization is part of the first scene frame. |
| New Moon products and the three original shop interiors | The GLBs, covers and other art are prepared during startup. Their first draw can still occur later because of the camera and shop LOD. | The final New Moon shelf and product batches, original-store art and shop-scoped imported furniture warm in visitor-relative order. A temporary render-layer gate leaves the existing shop and product visibility rules in control. |
| Amenities, initial static furniture outside shops, classic shell, deck railings and storefront art | World initialization awaits the loaders and creates their placements before the first scene frame. | They use the startup scene path. The shared static GLB reader validates and parses; the caller owns the timing of the actual mesh placement. |
| Picked-up cans and product preview dialogs | Picking up a can reuses startup product geometry and materials. Preview dialogs may load on demand. | The pickup flow reuses the world assets. Each preview dialog uses its own renderer and does not add objects to the mall scene. |

The main animation callback shares a 4 ms scheduling budget and a cap of two steps across all producers. A step initializes one texture, compiles one mesh's materials, or submits one mesh for upload. At least one frame separates compile from draw. When parallel shader compilation is available, the draw waits for the prepared program to link. The draw uses the actual instance buffers and skin bindings. An empty scissor protects the visible framebuffer while keeping the screen shader settings. Detailed mode also prepares the linear render-target variant when applicable. The budget is checked between steps and can be exceeded by an individual driver call. The foreground gate pauses during elevator travel, seat alignment/sitting/standing, and collection or product transfers. Hidden tabs do not advance the queue. Pending work restarts against a restored graphics context.

## Headed acceptance

Walk from entry through the atrium into MILI and New Moon with Low selected, collecting a fresh performance report for the walk. Use `window.__mall.performanceReport()` or **Download report (JSON)**.

- `uploads.lateAdditions` counts completed late-asset batches released for placement, admission or LOD use. Startup-only prewarm batches are excluded.
- `uploads.maxFrameUploadMs` is the maximum synchronous time spent in one upload slice since page load. `uploads.pendingUploads` is the current queue depth.
- Frame records include `uploadMs` separately from `renderMs`. The upload slice contributes to `callbackMs`. `geometries` and `textures` can increase during a background slice, including before the corresponding asset is visible.

The acceptance target is no frame over 50 ms attributable to an asset appearing along the walk. The timings measure CPU submission, and the headed Chrome walk and physical iPhone result require live verification.

## First visits to already resident geometry

The owner observed a 130–180 ms frame gap on first visiting the Floor 01 atrium, with about 2 ms spent submitting that frame. The existing late-asset queue did not change the isolated gap in the supplied comparison. The GPU stage addresses first draws of objects already in the scene. Attribution of the original gap to a particular driver operation remains unverified.

After the first frame and the existing optional model wait, the loader enters its fifth milestone, **Preparing the mall details…**. First view and Details share the fourth stepper column. The startup scene uses the same mesh and texture inventory on Low, Balanced and Detailed. Their foreground slice budgets are 8, 10 and 12 ms respectively. A single synchronous driver call can overrun a slice. The loader's six-second foreground watchdog also runs while waiting for shader linking or GPU completion. Hiding the tab suspends work and the deadline. A loss discards the old work, and validated restoration starts a fresh sweep if startup is still pending. Enter now and directory dismissal release the wait.

Probe cameras use the layout's atrium and store arrivals, plus the expanded entry and the upper deck when present. The expanded route has 20 required poses. The probes do not teleport the visitor or trigger shop downloads. Batches compile with the pose's active lights, including shader variants for different numbers of point lights. The renderer initializes unique textures, submits the actual objects with culling disabled, and polls a WebGL2 fence. The real framebuffer receives only a one-pixel viewport under the opaque overlay. Detailed desktop also prepares its linear target and selective glow variants. Visibility, layer masks, child arrays, instance counts, shadow updates, viewport, scissor and render target are restored between batches.

`window.__mall.performanceReport().warm` contains foreground elapsed `ms`, completed camera `probes`, distinct Three.js `programs` encountered during compilation, unique scene `textures` prepared (including previously initialized textures), and `skipped`. The `reason` field distinguishes completion, timeout, early entry, directory dismissal and interrupted work. First-frame readiness can precede the loader closing while optional models and GPU work are in progress.

### Manager's three-run acceptance on macOS

From this worktree's root in one terminal, serve the actual rebuilt site.

```sh
python3 -m http.server 8811 --bind 127.0.0.1
```

In a second terminal at the same root, activate the manager's existing Python environment with Playwright. Keep headed Chrome in the foreground and leave the loader to finish. Each invocation launches a fresh process and browser context with ANGLE Metal, 393 × 612 CSS pixels, DPR 3 and mobile touch emulation.

```sh
export GALLERY_CHROME="/Applications/Google Chrome.app/Contents/MacOS/Google Chrome"
python3 -c 'from playwright.sync_api import sync_playwright'
result=0
for run in 1 2 3; do
  python3 docs/walk_probe.py "cold-$run" || result=1
done
test "$result" -eq 0
```

The probe timestamps the loader's actual hide, samples the first 1.5 seconds and walks entry → atrium → MILI → New Moon → GOGO → atrium. It uses normal W-key input because the `setInput()` hook switches to manual simulation. It verifies movement, foreground sampling and overlap between successive five-second histories. Each output line includes the entire run's nearest-rank p99 in milliseconds, maximum interval, slow frames and warm telemetry. Keep all three lines. Every run must report Low, at least 20 completed poses, completed GPU work and zero intervals ≥ 50 ms. A missing sample window, interrupted warm-up or timeout fails the probe. Physical iPhone timing requires a separate device walk.
