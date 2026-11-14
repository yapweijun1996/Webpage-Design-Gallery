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

## Verification and evidence

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

Evidence: [acceptance receipt](evidence/v11-modes/acceptance.json),
[baseline](evidence/v11-modes-baseline.json),
[162 state observations](evidence/v11-modes-lifecycle.json),
[accessibility](evidence/v11-modes/accessibility.json), and screenshots/raw log
archives in `docs/evidence/v11-modes/`. The separate mode-state review checklist
item remains pending its own task; this release completes the implementation item.

## Limits and rollback

Physical iPhone/Android, Safari, real safe-area insets, screen-reader sessions,
physical-device FPS and native OS select popup behavior remain unverified. Local
browser/Python evidence does not certify those environments. Context-loss recovery,
quality tiers and Shelf implementation remain separate tasks; the existing
fallback behavior is retained.

Rollback uses a normal revert of the lifecycle release followed by regeneration
of gallery/PWA outputs. No storage/data migration is needed.
