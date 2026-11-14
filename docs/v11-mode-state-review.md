# V11 explicit interaction mode lifecycle

## Scope and ownership

This patch implements the six existing visible modes: Explore, Menu, Inspect,
Seated, Cart and Shop. Shelf has no entry path. No navigation, shopping feature,
asset, data record, storage format or publication policy changes are introduced by
this task; the application version is advanced for the runtime release.

`assets/modes.js` owns the logical mode, legal transitions, retained layers,
lifecycle dispatch and **the UI-mode pause rule**. A player-owned gameplay base
(`explore`, `seated` or `cart`) can be covered by Menu, then Inspect or Shop.
Closing an overlay reveals its retained owner directly; Shop-to-Seated and
Inspect-to-Menu are restores, not fabricated trips through Explore.

| Owner | Contract |
| --- | --- |
| Mode coordinator | Validate complete observations before effects; retain the base and covered Menu; pause while any blocking overlay exists. |
| `ui.js` / native dialogs | Report visible UI facts, own native focus restoration and responsive panel presentation. |
| `script.js` | Join player/UI observations; connect lifecycle cleanup to player input APIs and reset simulation timing. |
| Player | Own physics, posture, action-view/camera, cart clearance, collection and physical-product inventory. |
| Renderer | Retain the existing visibility, frame scheduling and rendering guards; consume the coordinator's pause rule. |

There is no new reverse dependency from player or UI into the coordinator.
`ui.paused()` and the separate panel-pause callback were removed. Simulation,
rendering, deterministic stepping, player input and physical-product controls all
consume `modes.paused()`; document visibility remains the renderer's independent
interruption condition. The `is-panel-open` class is presentation, not a second
pause authority.

## Internal API and lifecycle

The old `sync(next)` API could count an illegal edge and then force it anyway.
It has been removed, together with the old flat transition table. Its only
production caller now uses `observe(signals)`, a complete typed snapshot of five
boolean facts: `seated`, `cartActive`, `panelOpen`, `productOpen`, `bagOpen`.
Unknown fields, missing/nonboolean facts, simultaneous seated/cart state,
simultaneous Inspect/Shop dialogs, direct seated/cart replacement, and direct
Inspect/Shop replacement reject atomically. Rejections update diagnostics only.
Player base edges are Explore↔Seated and Explore↔Cart. A successful player action
must precede its observed base transition.

`request(next)` supports opening Menu/Inspect/Shop over gameplay, opening
Inspect/Shop over Menu, or returning to the immediate retained layer. It cannot
manufacture Seated/Cart, skip a retained Menu, replace Inspect with Shop, or enter
Shelf/unknown states. Production uses owner observations rather than speculative
commands. Repeating the current command or unchanged observation is idempotent.

For a visible transition the callback order is exit → cleanup → optional suspend
→ enter → optional restore. Exit can suspend a retained owner; it does not destroy
player posture or inventory. Changing the base under an unchanged overlay (for
example deploying the cart from Bag) runs cleanup once and records an `underlay`
event without re-entering Shop. Interruption runs cleanup without enter/exit or
logical state changes. History retains at most 20 frozen events, distinguishing
`suspend`, `enter`, `restore`, `underlay`, `reject` and `interrupt`.

Runtime cleanup releases held keys, pointer capture, floating joystick/drag and
injected input through the player's APIs, exits manual stepping and resets the
simulation clock. Overlay transitions suspend an active collection/action view;
they do not cancel it or reset the camera. Blur, hidden-document, viewport resize
and fallback interruptions also invoke the existing transient collection
cancellation. The player's physical held-product reservation remains intact;
existing explicit List, teleport, Stand and Stow actions keep their cleanup.
No lifecycle hook moves focus. Ordinary Bag Close/Escape still restores
`bag-open`; cart activation still uses `bag.closeTo(scene)` and keyboard movement.

`__mall.mode`, `__mall.state.mode` and `body.dataset.mode` agree. Read-only snapshot
copies also expose `paused`, `modeLayers` and bounded `modeHistory` for verification.

## Visible behavior

- First-use/reopened Guide and the accessible directory are Menu.
- Product/brand details and the original tin viewer are Inspect, including from
  the directory. Closing returns to the actual covered Menu or gameplay base.
- Bag is Shop. Close/Escape restores directory Menu or the retained Seated/Cart/
  Explore base, preserving its camera and Bag selections.
- Compact map/help block as Menu. Wide persistent map/nonmodal help leave gameplay
  running as Explore/Seated/Cart; native focused-control input guards still apply.
- Media-query changes publish an observation even if `details.open` is unchanged.
  Existing behavior is retained: wide map opens persistently; returning compact
  collapses the map. Help remains open across resizing and changes blocking status.
  UI recovers focus only when the previous map/header control becomes hidden.
- Guide's blocking lifetime includes its native close action, so Guide→compact
  Map or Guide→List handoff does not briefly resume Explore.

## Lifecycle implementation verification (1.1.36)

Application **1.1.36**, build **b375d72196543f6c**, includes the independently
published M056 shelf change from `574b742`. Review confirmed that the shelf update
adds no input, overlay, focus or pause owner. All final runtime checks below ran
against this merged candidate.

Baseline `55fb275` reproduced directory→product→Close with illegalCount 1 and
Seated→Bag→Escape with illegalCount 3 at both 390 and 1440. Its wide map was
classified Menu while rendering continued. The baseline command pins that revision
without changing the worktree:

```sh
python tests/browser_gjh_modes.py --baseline --baseline-ref 55fb275
node --test tests/gjh_modes.test.mjs
python tests/browser_gjh_modes.py
```

The Python suite follows the repository's Playwright/Chrome settings, supports
`GALLERY_WEBGL_BACKEND=metal`, and writes screenshots under the system temporary
directory by default (`--output` overrides it). The Node compatibility entrypoint
forwards arguments and exit status; `GALLERY_PYTHON` selects a dedicated interpreter.
It has no machine-specific Playwright import.

| Check | Merged result |
| --- | --- |
| Mode unit contracts | 10 PASS: hook order, idempotence, restore, invalid observations/commands, Shelf rejection, interruptions and bounded history |
| Focused mode browser | 162 snapshots: 80 at 390×844, 41 at 768×1024, 41 at 1440×900; legacy v1 smoke PASS |
| Observed mode correctness | Zero illegal transitions/errors; mode, state and body agree; all eight seats retain posture/camera through Bag |
| Runtime behavior | Real input/pointer cleanup, native Bag focus, frame pause/resume, four SKUs, held product, Original tin, same-page map/help resizing PASS |
| Full V11 | Three viewports PASS: movement, collision, doors, inspection, turning, hidden pause, reduced motion, context loss, WebGL/WASM failures and no-JavaScript |
| DOM accessibility | 70 state scans across five viewports PASS; default v2 cart keyboard movement resumes approximately 0.70m after Bag handoff |
| Repository | Generator, SSOT and 47 Python tests PASS |
| Gallery and legacy demos | Gallery PASS; 28 legacy demo cases and four no-JavaScript journeys PASS |
| PWA | Update, offline, cache integrity, activation recovery and manifest installability PASS |
| Additional Bag/Cart | Default v2 Bag quantity/remove/clear/session/storage fallback PASS; legacy v1 Cart deploy/stow/wall-clearance/load fallback PASS |

Native ANGLE Metal was used on Darwin arm64 / Chromium 157.0.8103.51. Existing
scripts that hard-code SwiftShader used an external host wrapper changing only
that launch argument. The legacy Cart script's carrying-bag assertions describe
v1, so that regression explicitly selected `?visitor=v1`; default v2 Cart is
covered separately by the mode and accessibility suites. The first temporary PWA
wrapper missed the tests import path; the corrected wrapper passed the full suite.
No production workaround or weakened assertion was used.

Test development exposed a native-close synchronization error: immediate focus
restoration to Bag can occur before its queued JavaScript close handler. Focusing
scene during that interval is overwritten. The test now waits for the actual
`close` event and a frame, preserving component focus ownership. Independent
browser probes then moved W 1.590m, D 1.591m and S 1.546m while focus remained on
scene. A separate resize probe now awaits the actual media-query handler result
before inspecting collapsed-map state. Failed iteration logs are retained.

Independent merged source review found no P0/P1 issue and reviewed actual Explore,
Seated, Cart and compact Map screenshots. Visual preservation scored **85/100**
(hierarchy 17/20, spacing 17/20, typography 12/15, colour 14/15, consistency 14/15,
responsive 11/15). This is scoped preservation acceptance, not a redesign or a
physical-device certification.

## Focused mode-state review — 2026-11-15

Application **1.1.37**, build **44d064158404a3a2**, completes this review and the
bounded Cart fallback repair described below.

The separate Phase 7 mode-state review ran against the source-root application in
Google Chrome 157.0.8103.51 on Darwin arm64, using native ANGLE Metal. The repeatable
focused command is:

```sh
GALLERY_CHROME='/Applications/Google Chrome.app/Contents/MacOS/Google Chrome' \
GALLERY_WEBGL_BACKEND=metal \
/private/tmp/gallery-task-qa-venv/bin/python tests/browser_gjh_mode_review.py
```

The original seven narrow scenario groups passed, but did not cover Cart action
availability after main-context loss. Independent QA then reproduced a P2 defect:
with Bag open and focus on `cart-toggle`, real graphics loss left Use cart enabled.
Clicking it deployed the cart, closed Bag and reported success despite `ready=false`.
The new regression reproduced stale controls on the unchanged runtime with a real
Add selection (`Bag (1)`); its failing assertion, snapshot and screenshot are
retained in `/private/tmp/gallery-mode-review-fix/baseline.log` and `baseline/`.
The independent activation reports are retained there as
`independent-inactive-before.log` and `independent-active-before.log`.

The bounded runtime repair changes only `script.js` and `assets/ui.js`. The script's Cart
availability getter combines runtime readiness with the optional model's own
availability, and its mutation callback independently rejects calls while not
ready before touching the player. UI uses one Cart-control refresh helper in both
the ordinary HUD and fallback, including directory fallback where `setView(false)`
returns early. It hides and disables unavailable Cart controls, removes stale
success status, and focuses Bag Close only when focus was inside those disappearing
controls. Quantity and Close focus are preserved. The click handler re-reads
availability before requesting mutation or closing Bag. Mode, player, Bag, preview
and renderer owners are unchanged. This is fallback action/focus repair; main
context restoration and quality tiers remain separate work.

The expanded review passes **15 scenario groups**, with zero illegal transitions
and browser page errors:

- The original compact Map/Help, Guide handoffs, List cleanup, Cart product
  inspection and real nonreduced sit pause/resume checks are retained. Resizing
  compact→wide→compact while Bag covers Map/Help restores the current valid
  underlay. List finishes in **Menu, paused true, Explore base**, standing with
  cart stowed.
- Real main-context loss under inactive and active Cart with `cart-toggle` focus
  keeps Bag open as Shop over directory Menu, stows Cart, hides/disables its
  controls, and focuses visible Bag Close. A nonempty real Add selection and its
  session representation are retained.
- Loss while directory+Bag are already open covers the early-return path, both
  with Cart focus and with focus on quantity or Close. Unrelated focus stays put.
- An explicitly synthetic queued-click probe uses DOM event dispatch to bypass
  hidden/disabled hit testing after **actual** context loss. It cannot deploy,
  close Bag, change mode, or report success. No app mode/readiness flags or fake
  context-loss events are injected.
- Initial optional `shopping-cart.glb` request failure keeps Cart unavailable
  and Bag quantity editing usable. A ready directory→Use cart handoff still
  reaches Cart with scene focus and actual keyboard movement greater than 0.2m;
  ordinary Bag Close/Escape returns to the visible shared-header `bag-open`.
- Product details are reachable from the actual 3D scene via nearby SKU and
  `#inspect`, including Cart→New Moon AU Inspect→Cart. Real context loss from a
  3D product closes it safely to directory Menu and visible `list-title`. An
  already-directory product stays Inspect over Menu until normal native close,
  retaining Close focus and then returning to its visible product button.
  Bag instead stays Shop over Menu. A hidden experience does not imply that the
  shared-header Bag button is hidden; no hidden-`bag-open` defect was found.

Tests use real controls and player transitions. Existing `__mall` APIs steer
movement and advance the real deterministic simulation; they do not manufacture
mode, posture or renderer state. Native close checks await the actual close event
plus a frame. Responsive checks await the actual media-query handler result.
Selected screenshots and raw output are in
`/private/tmp/gallery-mode-review-fix/screenshots/` and `review-final.log`.
Machine-readable results and browser/platform provenance are in
[`docs/evidence/v11-mode-review.json`](evidence/v11-mode-review.json).

Additional candidate checks passed: all 10 Node mode contracts, 162 browser mode
snapshots plus legacy v1 smoke, full V11 at three viewports and fallback journeys,
default v2 Bag selection/session/storage regressions, and 70 axe/DOM scans across
five viewports. Default v2 Cart keyboard movement after handoff measured
0.68–0.71m. The separate old Cart collision/load regression passed with
`GALLERY_LEGACY_VISITOR=1`; it proves that v1 contract only. Its host wrapper only
selects ANGLE Metal and the explicit legacy query. Actual command logs are in
`/private/tmp/gallery-mode-review-fix/summary.md`. The native select fixture did
not change its choice, so native popup keyboard selection remains NOT_VERIFIED.

Parent acceptance passed the 15 groups independently on application 1.1.37,
47 Python tests, generator/SSOT checks, Gallery, 28 legacy cases, four no-JavaScript
journeys and PWA update/offline/installability. The final runtime/test hashes match
the worker's full-regression manifest; those runtime checks preceded only the
release metadata bump. Independent source review has no P0/P1 finding and closes
the P2. Rendered fallback review scored 86/100: hierarchy 17, spacing 17, typography
12, colour 14, consistency 14, responsive 12. It confirms unobstructed controls;
focus assertions confirm the recovered/preserved active element. Mouse-triggered
frames alone do not establish a keyboard focus ring.

See the [review acceptance receipt](evidence/v11-mode-review/acceptance.json),
[15 scenario results](evidence/v11-mode-review.json) and before/after images,
full-runtime snapshots, accessibility report and compressed raw logs in
`docs/evidence/v11-mode-review/`. Physical devices, Safari, screen readers,
real safe-area insets and native select popup keyboard choice remain unverified.

Evidence: [acceptance receipt](evidence/v11-modes/acceptance.json),
[baseline](evidence/v11-modes-baseline.json),
[162 state observations](evidence/v11-modes-lifecycle.json),
[accessibility](evidence/v11-modes/accessibility.json), and screenshots/raw log
archives in `docs/evidence/v11-modes/`. The lifecycle implementation evidence remains historical; the focused review
above completes its separate checklist item with the bounded Cart repair.

## Limits and rollback

Physical iPhone/Android, Safari, real safe-area insets, screen-reader sessions,
physical-device FPS and native OS select popup behavior remain unverified. Local
browser/Python evidence does not certify those environments. Context-loss recovery,
quality tiers and Shelf implementation remain separate tasks; the existing
fallback behavior is retained.

Rollback uses a normal revert of the lifecycle release followed by regeneration
of gallery/PWA outputs. No storage/data migration is needed.
