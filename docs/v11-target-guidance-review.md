# V11 selected-target guidance review

Scope: Phase 7 interaction target cue and approximate distance only, based on
`a88fd1ccb7430e124732373ec40476085c2364f5` (application 1.1.39,
build 276a97a8850f6aaf). This engineering review does not approve release.
Parent owns task acceptance, the independent visual grade, generated outputs,
application/version metadata, Git, CI/Pages and production verification.

## Runtime ownership

`script.js:updateHUD` remains the only proximity selector. Its existing horizontal
XZ calculation now retains both the winning interaction record and its distance.
The action ID, radii, floor filter, bench approach-side filter and all gameplay
rules are unchanged. Both elevator floors share an action ID, so presentation
receives the actual winning record, including floor Y, rather than finding an
anchor by ID. A read-only snapshot exposes these values for acceptance.

`dom-projection.js` serves only the existing Shelf controller and the new guidance
controller. Shelf still frames and outlines its owner-provided complete bounds;
there is no second shelf outline. Other targets use a DOM caption explicitly
labelled **Interaction point**, with its ring centred on the selected action
anchor. These captions are not mesh silhouettes. They are decorative and
pointer-safe. Invalid depth, offscreen extents and native HUD collisions hide the
caption. Camera direction affects only presentation, never action eligibility.
No geometry, material, texture, icon, external dependency or scene effect was added.

The UI owns names, action controls and availability explanations. An inline
`≈x.x m` text node consumes the selected distance, with no live region and no
write when the rounded value is stable. Target selection is announced once with
the full target name; elevator announcements include the floor. Existing Help
and the accessible action description explain that these are approximate
horizontal distances to fictional demo interaction points, not physical store
measurements. Physical products and Demo bag quantities retain their owners.

Modes remain the sole gameplay pause authority. Mode cleanup hides guidance
synchronously. Window blur suppression persists until an actual focus event;
document visibility is independent and cannot clear blur suppression. Menu,
Inspect, Shop, Shelf, Seated, List, hidden state and graphics fallback clear the
cue/distance without waiting for a walking tick. Resume and resize project the
current owner. Seated retains its original Stand identity layout.

## Layout and actual scene contrast

The four New Moon identities retain full accessible country/name/weight, the
26px identity row, two 44px actions, visible physical-product/Demo bag notice and
approximately 121.59375px combined prompt at 320/390px. Distance stays inline.
Other walking/Cart prompts now use the existing 12px token and a full-width 44px
native action above the visitor. The baseline already had a two-row generic
prompt; this task did not introduce that structure. Parent's pinned public
baseline measured 79px at 320/390/667 and 103px desktop.

Actual raster checks found weak point/Shelf edge bands against some 3D pixels
and an inherited large Shelf action focus ring crossing the physical-product
notice. Cues now use existing paper/green bands; the point caption has a 4px
paper border with a 2px green outline. Compact Shelf action buttons use the
existing focus color with a 2px outline and 2px offset, fitting the existing row
gaps without increasing the prompt height.

Contrast evidence compares paired real PNGs of the same frozen 3D view, with
DOM-only cue/outline suppression for the underlay. It samples the full visible
label/shelf edge bands and native action focus band, rather than assuming CSS
paper is the scene background. The existing shelf outline can pass behind the
opaque authoritative prompt. Covered samples are counted separately and never
reported as visible contrast passes. These scoped measurements are not a claim
of universal contrast against every possible scene view or of WCAG conformance.

At 320px, the existing post-travel elevator action camera can place the upper
floor point under the joystick. That caption correctly hides: selected Y is 7.2,
distance is approximately 0, and the original observed NDC projection was
`[0, -0.5849482924, 0.9503382605]` (screen point approximately `[160,465.07]`).
Actual walking restores the normal owner camera and a visible current upper
floor cue. Camera behavior was not changed to force a caption onto controls.

## Verification and evidence

Final source-matched results, exact commands/exits, resource/GPU comparisons and
actually viewed frame hashes are recorded in
[bounded evidence](evidence/v11-target-guidance.json). Detailed outputs and raw
frames remain under `/private/tmp/gallery-target-guidance-worker/`; parent can
copy a bounded final frame selection without modifying historical captures.
The portable focused command is:

```sh
GALLERY_WEBGL_BACKEND=metal /private/tmp/gallery-task-qa-venv/bin/python tests/browser_gjh_target_guidance.py --output /private/tmp/gallery-target-guidance-worker/final-focused6
```

Final engineering results: 14 guidance viewports / 140 target cases, 20 software-inset
target cases, 13 Node tests, 165 mode snapshots, 15 mode-review scenarios,
11 navigation viewports, 70 axe scans and 12 strict Shelf viewports passed.
The source-prefix smoke and actual physical pickup/return, Sit/Stand and Cart
regression also passed. All final runtime hashes match the evidence fingerprint.

One concurrent Shelf held-touch attempt differed by `9.5367431640625e-7` metres
in X after resumed physics and failed the original exact equality assertion.
The isolated rerun passed all 12 viewports with that assertion unchanged. The
original failure and final command are both retained. Player/physics sources
are byte-identical to the pinned base; this is not a claim of deterministic
physics under arbitrary browser scheduling.

The 28 paired raster views measured a minimum visible whole-cue band ratio of
3.16:1 and native action focus ratio of 11.855:1. New Moon prompts measured
121.59375px at both 320/390px, with 26px identity rows. Twelve final source-matched
frames covering all categories, both elevator floors and all four SKUs were
actually opened and inspected; their paths/hashes are in the bounded evidence.

The acceptance matrix uses 320x568, 390x844, 667x375, 844x390, 768x1024,
1440x900, 599/600, 650/651, 1000/1001 and 844x560/561, plus the existing portrait
and landscape CDP safe-area profiles. It walks to kiosk, bench, MILI, GOGO,
both elevator floors and all four SKUs; verifies exact XZ distance/rounding,
stable writes, range exit, camera turns, depth fixtures, rapid complete-anchor
changes, disabled Cart/bench, held physical can, native modal/Shelf/List paths,
live reflow, actual blur and actual context loss. Visibility/near-plane logical
fixtures are labelled separately from actual browser events.

Optional kiosk model failure retains 3D guidance and its Map action. Shelf/can
model failures are covered by the existing Shelf suite. A required world image
failure retains the existing initializer's directory fallback: guidance clears
and native directory Inspect remains functional. This task adds no graphics
recovery or alternate quality tier.

The V11 regression's HUD fixture now checks painted controls: a compact Map
intentionally suppresses the prompt with `visibility:hidden`, which retains a
layout box. Every painted open-map/control overlap assertion remains. The new
focus fixture enters through the actual scene tab stop, avoiding assumptions
about native browser-chrome traversal after the final desktop control. The Cart
fixture activates in clear space before walking its wider existing collider
back into bench range; blocked activation is never treated as a missing native
close event.

## Budgets and limits

Resource comparison serves the pinned revision's runtime bytes without changing
the checkout and records their SHA-256 hashes. The actual baseline is 53 ready
resources and 8,916,759 decoded bytes. The candidate adds two local JavaScript
modules and no assets: 55 resources / 8,925,094 decoded bytes, a delta of
+2 requests / +8,335 bytes. Paired zone draw maxima were 145 at 390px and 180 at
1440px on both revisions; the broader candidate target matrix reached 181. The
earlier 181 baseline observation is not substituted for the pinned pair’s
measured 180. Exact final byte/draw deltas and renderer/GL object
balances are in the evidence; both candidate and baseline must stay within
10 MiB decoded and 200 draw calls. The historical 45-resource assertion in
`browser_gjh_budget.py` is incompatible with the measured pinned base and is
**not reported as passing**.

Physical devices, Safari, real screen-reader sessions, device FPS, packaging
fidelity and actual OS document-hidden transitions remain unverified. Real
window blur was observed while `document.hidden` remained false. The separate
hidden/visible sequence is fixture-backed. Parent retains Gallery/legacy/PWA,
47 Python/generator/production-prefix verification and the independent visual
score >=85 before any task/release/Git changes.

## Verification-contract follow-up — 2026-11-15

The historical Shelf failure and strict isolated retry above remain historical
evidence; retrying was not a fix for the required gate. Only the two resumed
held-touch comparison loops now require finite X/Z within absolute `1e-5 m`
of the same original stopped snapshot, after 120 ms live time and after
`__mall.step(120)`. Yaw/pitch, paused isolation, synchronous close pose/camera/
posture, trusted movement/capture/release/reset/cancel and all other assertions
remain strict and unchanged. Results say no-residual-control-movement within
bound, not bit-exact position after physics resumes.

The corrected complete Shelf suite passed 12 viewports / 48 SKU cases and all
five asset-failure scenarios in Chrome 157.0.8103.51 with Metal and pinned axe,
exit 0. Its two trusted held-touch paths at 390x844 each moved
`0.288576602935791 m` before entry and restored synchronously exactly. Both
post-resume samples had maximum absolute X/Z/yaw/pitch deltas of zero. Observed
Y deltas, diagnostic only for these loops, reached `8.881092071533203e-5 m`
after live frames and `4.172325134277344e-6 m` after explicit stepping. Raw
coordinates, deltas, frames, commands and hashes are retained in the new
[bounded physics evidence](evidence/v11-target-guidance-physics.json).

The parent's eight paired baseline/current diagnostic trials also preserved
exact synchronous restoration and zero horizontal/angular deltas, with matching
vertical grounding. They did not reproduce the historical X ULP failure.
[Project prevention notes](v11-physics-check-contract.md) explain the exact
restoration versus resumed-physics boundary and detection procedure. All runtime
bytes remain unchanged at fingerprint
`232b2e35df8ca4ba2976fe4753152dab50996f38df5fc8a18d26999653de20bc`;
unchanged target/Node/UI/visual suites were not rerun. This verification-only
follow-up does not update task/version/generated files or approve release;
parent retains all remaining acceptance and release gates.

## Parent release acceptance

Application 1.1.40 / build `ef8b5d74f9d47986`: generator, SSOT, all 47 Python
tests and required Gallery/legacy/PWA checks pass. The generated artifact served
under `/gallery/` passes all ten category checks at 390 and 1440px. Both new
modules match source; docs and tests are excluded. Independent review approves
86/100, including the isolated upper-floor suppression and bounded physics check.
See `evidence/v11-target-guidance-acceptance.json` and
`evidence/v11-target-guidance-build.json`. Publication and live checks follow this
local acceptance receipt. Representative final frames:

- [kiosk-320x568.png](screenshots/v11-target-guidance/kiosk-320x568.png)
- [bench-390x844.png](screenshots/v11-target-guidance/bench-390x844.png)
- [mili-390x844.png](screenshots/v11-target-guidance/mili-390x844.png)
- [gogo-667x375.png](screenshots/v11-target-guidance/gogo-667x375.png)
- [elevator-ground-390x844.png](screenshots/v11-target-guidance/elevator-ground-390x844.png)
- [elevator-upper-320x568.png](screenshots/v11-target-guidance/elevator-upper-320x568.png)
- [shelf-sa-425g-320x568.png](screenshots/v11-target-guidance/shelf-sa-425g-320x568.png)
- [shelf-nz-425g-1440x900.png](screenshots/v11-target-guidance/shelf-nz-425g-1440x900.png)
