# V11 graphics recovery and quality review

Worker scope: WebGL context-loss recovery and low-end quality tiers, based on `36d56c49283a4e1a794ba0ec15650aea85bdc615` / application 1.1.40 on `codex/task-graphics-recovery`. Task, version, generated outputs, Git and release remain parent-owned. This is source-tree acceptance, not a release certificate.

## Result and ownership

One renderer, world, physics world and input owner survive restoration. The existing modes controller remains the sole pause owner. Loss exposes the complete directory, clears transient input/collection, closes Shelf, retains the established scene-Inspect auto-close, preserves directory Inspect/Bag and keeps static bag quantities separate from physical reservations. The player owns interrupted elevator settlement: rider and cabin move to the nearest floor, capsule enabled, previous action camera restored, old journey cancelled. Actual normal-motion interruptions in both halves of the trip and subsequent walking pass.

The pinned Three r170 constructor installs `webglcontextrestored` after the app listener. Its `At` handler calls `St` synchronously, replacing renderer internals including info/shadows. A microtask proved too early in real Chrome: native listener checkpoints could run it before Three. Recovery now uses a later task, a loss epoch and an explicit pending barrier; initialization completion and visibility are additional prerequisites. No initialize rerun, second scene, duplicate input listeners or production loss-extension call is introduced. Khronos documents resource invalidation at context loss/restoration; invalidated handles must not be counted as ordinary deletes. [Context event semantics](https://registry.khronos.org/webgl/specs/latest/1.0/#5.15.3) were consulted as an editor draft; the actual vendored implementation and native measurements govern this patch.

Validation submits a real scene frame without physics advancement and checks draw calls, GL errors and a nonempty framebuffer sample. Only then does the UI publish availability. The directory, native modal and focus stay where the user left them. Explicit Return to 3D, Home or Cart entry uses existing owners. Independent startup/asset/WASM or validation failure cannot become recoverable 3D; reload remains available. Startup while lost cannot publish ready. A hidden document delays validation. Second native loss invalidates pending work.

The same resize owner retains the last valid hidden-canvas dimensions and updates the camera only when dimensions actually change. One initial call through the existing compact-map projection removes the accidental dependency on the first Guide; recovered startup enters Explore at 390 and 1440, while the wide default map remains open and nonmodal.

## Quality policy

`assets/graphics-quality.js` owns profile selection and optional validated storage. Help contains the native Auto / Low / Balanced / Detailed control, with the visible rendering consequence and unchanged download/product content explained. No permanent graphics HUD was added.

| Effective profile | DPR cap | Real-time main-light shadows |
| --- | --- | --- |
| Low | 1 | Off |
| Balanced | 1.25 below 600px; 2 otherwise | Off |
| Detailed | 2 | Existing 1024px map only at widths >=1000px |

Auto chooses Low if a positive finite CPU or memory hint is <=2; Detailed requires width >=1000 and both hints >=4; otherwise Balanced, including missing hints. Recovery visibly selects Low for this page without overwriting the prior stored preference. The same native control can directly choose Detailed again. World/furniture shadow eligibility is constructed once; renderer profile switching actually changes shadow work without rebuilding the scene. Same-DPR central-scene Detailed/Balanced pixels differ by 3.723294 mean RGB units in the measured frame. Quality changes no physics, labels, collisions, models or downloads. This is deterministic policy, not FPS certification.

## Verification on frozen sources

The final focused command passed **73 cases / 100 actual frames** under `/gallery/`, with equal runtime and test SHA before/after. Runtime fingerprint: `0a79ccf1be2284b177f3fd3b6bfdac54e281c020ad0e7ea3c5663cdc9b815077`. All final regression commands used that same runtime fingerprint, and every command recorded before/after source hashes. Exact commands, environment, exits, test hashes, matrices and raw path/hash receipts are in [bounded evidence](evidence/v11-graphics-recovery.json).

```
GALLERY_CHROME='/Applications/Google Chrome.app/Contents/MacOS/Google Chrome' GALLERY_WEBGL_BACKEND=metal /private/tmp/gallery-task-qa-venv/bin/python tests/browser_gjh_graphics_recovery.py --root /private/tmp/gallery-task-lod --prefix gallery --axe /private/tmp/gallery-a11y-tools/package/axe.min.js --output /private/tmp/gallery-graphics-worker/qa/focused9
```

Chrome 157.0.8103.51 reported native ANGLE Metal / Apple M4. Reported hints were 10 CPU threads and 32 device-memory units; these are browser hints, not device/FPS certification. Hardware overrides, DPR/viewport emulation, software insets and hidden-state simulation are explicitly labelled fixtures. Native context loss/restore uses the test extension, not a physical GPU fault.

| Check | Terminal result |
| --- | --- |
| Focused recovery/profiles | 0; 73 cases, 100 frames, no unexpected page/console errors |
| Quality unit cases | 0; 3 tests including width/hint/DPR/invalid-value matrices |
| Mode node cases / browser snapshots | 0 / 0; 13 tests / 165 snapshots, plus existing v1 compatibility case |
| Mode review | 0; 15 scenarios |
| Context navigation / software insets | 0 / 0; 11 viewports plus ancillary states / 2 inset profiles |
| Existing accessibility | 0; 70 axe scans across 5 viewports |
| Shelf | 0; 12 viewports and existing strict restore/held-touch contract |
| Target guidance functional regression | 0; supported explicit `--compare-ref ''`, original fixture unchanged |
| Full V11 / Bag / preview | 0 / 0 / 0; current v2 main coverage retained |
| Changed JS syntax | 0 for all five changed JS modules |
| Historical resource-count gate | **1; retained FAIL**, stale 45 ceiling |

Focused coverage includes Explore/Shelf/Inspect/Shop/Cart/Seated at 390/1440; three repeated cycles at each width; all four SKU/M056 rendered Shelf frames; actual keyboard movement; initialization delayed at Three/world/primary visitor GLB; completed initialization while still lost; second native loss before pending recovery; Bag/cart availability without reentry; product Close race; main loss while a loaded product preview retains focus and disposes on close; normal-motion elevator settlement; trusted held touch; failures and live directory use; storage reload/invalid/blocked cases; all quality choices and DPR 1/1.5/2/3; reduced and normal motion; 320/390/667/844/768/1440 plus affected edges and two software inset profiles.

Paused and synchronous restoration remain exact. The localized post-resume held-touch check uses the existing [physics contract](v11-physics-check-contract.md): XZ <=1e-5m against the original stopped snapshot and exact angles. Measured maximum XZ delta was 4.76837158203125e-7m. No runtime physics or existing epsilon was widened.

## Resources and pixel proof

| Revision / widths | Resources | Decoded bytes | Four-zone maximum draws |
| --- | --- | --- | --- |
| Pinned 36d / 390, 1440 | 55 | 8,925,094 | 145 / 180 |
| Current / 390, 1440 | 56 | 8,933,625 | 145 / 180 |

Delta is **+1 request / +8,531 decoded bytes**. Both remain below 10MiB / 200 draws. Draws are sampled measurements, not worst-case FPS or physical-device promises. Four-zone calls match the pinned base exactly. The separate full V11 walking sample reaches 181 draws at 1440, below 200. All eight SKU/viewport restored RGB comparisons measured **0.0** difference against matched Low frames. Actual restored M056/can/sign/environment images were inspected, not inferred from readiness.

After matched four-zone/four-Shelf warmup in every epoch, Three GPU counts remain 91 geometries/23 textures at 390 and 94/24 at 1440 across three cycles. One context and one actual Three constructor write, stable scene/camera identities and children, unchanged listeners/asset requests, and exact current-epoch GL live counts pass. Raw epochs retain created/deleted/invalidated counts separately; this is not VRAM measurement or a universal leak-free claim.

Two old gates remain visibly failed. The 45-resource ceiling already conflicts with the pinned baseline's 55; it was not raised. The earlier target-only a88 exact cold-GPU equality also failed: current wide cold upload uses 94 geometries/428 buffers/257 VAOs versus 95/432/258; both have 25 Three textures, 29 GL textures, 18 programs and one framebuffer/renderbuffer. Positioning spawn before the first render removes the baseline's possible default-camera render, consistent with this smaller cold footprint. That specific object cause is a supported source inference, not isolated mesh attribution. The original equality assertion is unchanged and is not labelled PASS. Its full functional/inset/cue regression passed separately with the supported empty comparison option; this task's own pinned36/profile/budget/epoch proof is independent.

## Failure accountability and visual review

Original focused attempts and diagnostic logs remain under `/private/tmp/gallery-graphics-worker/qa/`. Bounded evidence records every known failure and correction: early microtask, hidden resize, expanded loss-time Inspect semantics, mismatched warmup, Close-focus oracle, skipped Guide/map dependency, wrong lazy-LOD route and unsupported Home/End option choice. Earlier growing test files produced cached traceback line text that cannot certify final source; final runs reject source/test drift. An early parallel orchestration ledger reused a stdout name; only its immutable batch terminal status is claimed for that interrupted attempt. Final evidence uses a single-writer ledger in `qa/final/`.

Native macOS popup arrow/Home/End choice remains **NOT VERIFIED**, also reproducible with a standalone select. Trusted native typeahead `d`, real Tab/Shift+Tab, visible focus and 44px controls passed. Programmatic `select_option` checks are identified as the native change-event path, not proof of OS popup navigation. No custom keyboard replacement was added. A supplemental contact sheet initially used system Python without PIL; it was generated successfully using the required QA venv and is not an acceptance test.

The parent reported independent visual **86/100**, no remaining functional P2 and no P0/P1, after viewing 320/390/667/844/768/1440, recovery directory/Inspect and Low/Detailed frames against this same runtime. The full independent receipt was read and its runtime hashes match the final sources; its exact raw path/hash and rubric are included in bounded evidence. It reviews focused8 test SHA separately from the final supplemental focused9 test. Copying that receipt and bounded screenshots into release artifacts remains parent-owned. The worker also inspected real quality-focus/recovery frames and a 12-frame contact sheet; primary files remain the 100 hashed full-resolution frames, not contact-sheet thumbnails.

Physical devices, Safari, real safe areas, OS-hidden behavior, native popup choice, screen readers, field performance/FPS, full branded packaging fidelity and live deployment remain unverified. Parent owns task/version/generated/47 Python/generator/SSOT/final release gates and Git; no generated files, versions or task entries were edited, and no Git staging, commits or pushes were performed by this worker.

## Parent artifact acceptance

Application 1.1.41 / build `8756a8b3f0c73835`: required Gallery, legacy/no-JS and
PWA checks, all 47 Python tests, SSOT and generation pass. The generated artifact
served under `/gallery/` passes 13 cases/35 frames; the new module matches source
and docs/tests are excluded. Parent rechecked all runtime source hashes against
the frozen proof. Independent 86/100 and supplemental approval are retained in
`evidence/v11-graphics-recovery-independent-review.json`; local gate details are
in `evidence/v11-graphics-recovery-acceptance.json`. Git/CI/live gates follow.

Representative exact final frames:

- [1440-mx-454g-after.png](screenshots/v11-graphics-recovery/1440-mx-454g-after.png)
- [layout-1440x900-quality-focus.png](screenshots/v11-graphics-recovery/layout-1440x900-quality-focus.png)
- [layout-320x568-quality-focus.png](screenshots/v11-graphics-recovery/layout-320x568-quality-focus.png)
- [layout-320x568-recovery.png](screenshots/v11-graphics-recovery/layout-320x568-recovery.png)
- [layout-390x844-recovery.png](screenshots/v11-graphics-recovery/layout-390x844-recovery.png)
- [layout-667x375-quality-focus.png](screenshots/v11-graphics-recovery/layout-667x375-quality-focus.png)
- [profile-detailed-1440.png](screenshots/v11-graphics-recovery/profile-detailed-1440.png)
- [profile-low-1440.png](screenshots/v11-graphics-recovery/profile-low-1440.png)
