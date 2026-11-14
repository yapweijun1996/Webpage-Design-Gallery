# V11 Shelf focus source review

Source validation completed on `codex/task-shelf-focus`, based on
`27414203881ba54d0a30231493699ad7bc4e11c7`. Source validation and independent visual review passed. This is a source
handoff, not a release certification. The parent owns release acceptance,
`task.md`, versioning, generated outputs, Git and publication.

[Bounded evidence](evidence/v11-shelf-focus.json) records exact commands, exits,
final runtime/fixture hashes, raw logs, rejected iterations and 25 actually viewed
frames. Accepted browser artifacts are outside the repository under
`/private/tmp/gallery-shelf-focus-fix/accepted/`.

## Behavior and ownership

Nearby New Moon shelves open Shelf through F, Inspect or touch. A native modeless
dialog owns the reachable whole-shelf button; all nine projected can centers map
to that shelf's existing SKU. The existing header remains reachable. The inert
scene overlay cannot compete for input. Contextual navigation remains hidden in
Shelf, and the canonical mode manager is the only gameplay pause authority.

`products.js` supplies the same frozen bounds to collisions and Shelf framing.
Shelf clones only the presentation camera, fits the complete depth-inclusive
shelf, and uses the already loaded scene. `player.renderShelf` temporarily hides
visitor presentation with `try/finally`; no shared geometry, material or GPU
resource is cloned or disposed. Presentation animation never advances gameplay.
No icon, artwork, geometry, texture, SKU, price, order or checkout was added.

Close, Back, Escape and backdrop restore the original owner and exact synchronous
player/camera pose at the same viewport. Resize retains logical orientation and
action ownership while updating valid responsive projection. Details explicitly
closes Shelf before the existing product dialog opens. Bag, List, Map, other
native dialogs, blur, hidden-document handling and actual graphics context loss
clean up the presentation before the next owner takes over. The disappearing
header Map control now recovers to Shelf Close when Shelf is active; unrelated
focus owners retain their existing behavior.

Demo Add calls the existing shared quantity store and respects its per-SKU limit
of nine. It never calls physical reservation or changes shelf matrices. Three
tiers by three cans across four SKUs means 36 configured placements. The existing
physical reservation hides one instance while held, giving 35 visible shelf cans;
that count is a source-derived contract, not a screenshot count. Actual held-token
retention, Return and subsequent re-pick are checked. Cart Shelf entry/return and
existing Seated/Cart lifecycle coverage remain intact.

## HUD and actual visual inspection

The rejected prototype moved physical pickup into a second 44px row and expanded
the full prompt to about 155px. The final layout has a noninteractive 26px
packshot/identity row, concise country/type/weight derived from the existing
product name, full accessible name, Inspect and physical Pick up/Return on one
44px row, and the existing visible physical-versus-demo-bag notice below.
New Shelf rules are consolidated; unrelated legacy CSS was not refactored.

All four SKUs measure 121.59375px for the full prompt at 320x568 and 390x844,
compared with the measured published 120.59375px baseline: a practical 1px
increase. Identity height is separately 26px. No combined-HUD 12% pass is claimed;
the historical percentage remains advisory. Portrait positioning below Map/Help
and tablet positioning above the joystick preserve the avatar-critical view.
Short-landscape placement also preserves movement/disclosure clearance. Physical
return animation retains its existing temporary prompt suppression.

Actual final-source frames were viewed for every tested viewport, including
keyboard focus on the transparent shelf target against the 3D wood, all four SKU
identities across primary sizes, the longest concise label, held/returning states
at 320/390 and landscape, resize focus recovery, fallback cans and software
insets. The pre-existing New Zealand foreground plant obstruction is unchanged.
The 667x375 software-inset case initially clipped status text; smaller Shelf-only
landscape spacing now fits all text and full targets without reducing font size.

## Executed verification

All commands below used the pinned Python environment, installed Chrome
157.0.8103.51, native ANGLE Metal and pinned axe 4.10.3. Exact arguments and logs
are in the evidence JSON. Every accepted run retained the same runtime hashes.

| Check | Result |
|---|---|
| Mode unit tests | 13 passed |
| Shelf full matrix and stricter ground check | 12 viewports, four SKUs each; all nine projected can hits; complete targets, focus rings and visible text bounds passed |
| Shelf failures | M056 shelf and each of four can asset failures passed |
| Lifecycle | 165 snapshots: 81/42/42 across 390/768/1440 |
| Independent mode regression harness | 15 scenarios passed |
| Context navigation | 18 result groups passed |
| Accessibility | 70 existing scans passed; nearby/Shelf-specific scans had zero violations |
| Guide and compact Guide | Existing flow coverage plus seven compact sizes passed |
| Bag, product preview and New Moon integration | Quantity, roundtrip, failure/retry, four mappings and shelf collision checks passed |
| Full V11 | Passed; maximum observed draw calls 181 |
| Asset unit tests and SSOT | Passed |

Trusted CDP touch moved the visitor approximately 0.289m before entry and proved
trusted pointer capture. Shelf released capture and reset the joystick. One path
moved and ended the old finger after exit; another delivered native trusted
`pointercancel` to `shelf-target` after capture release. Neither resumed movement.
Both preserve exact immediate restore and visible keyboard focus. Keyboard close
is checked synchronously and separately from post-resume ground settling; only
post-resume Y has a 10-micrometre tolerance. The final strict run observed zero Y
delta, while earlier runs observed sub-micrometre floating-point correction.
No x/z/orientation tolerance was introduced for these Shelf exit checks.

The source-matched resource comparison at 390/1440 is 52 resources and 8,898,891
decoded bytes at the exact base versus 53 and 8,916,759 now: +17,868 bytes.
`assets/shelf-focus.js` is the only added resource path. No runtime artwork fetch
was added. Twelve repeated entries preserved observed GL object balances,
renderer memory counters and request count; these are not device-memory or FPS
measurements. The earlier worker baseline file had incorrect hash metadata; it
was preserved. A new baseline run has all 28 hashes verified against `git show`.

## Fixture reconciliation and rejected evidence

Historical/intermediate passes were not relabelled as final proof. Raw failures
and the interrupted Cart test are indexed in the evidence JSON. The Cart harness
had incorrectly awaited Bag close when stowing; the existing action intentionally
leaves Bag open. It now explicitly closes through the existing owner.

Two extra compact Guide assertions were stale at the published base: ShiftTab
ended at the pre-navigation `guide-list`, and the old combined height budget
included a newly separate navigation footer. The current navigation review owns
`.guide-scroll` and the independent footer. The fixture now expects
`context-shops`, retains the original 75% **content** budget, and checks complete
dialog/footer/Close bounds and the actual scroll owner. No Guide runtime changed.
Both historical failures were reproduced against the exact base before the
fixture reconciliation.

Current Chrome can retain layout rectangles for closed native `<details>`
content. Diagnostic JSON and an actually viewed failure frame confirmed the Map
was closed behind product inspection. Full V11 overlap checks now exclude only
that closed Map content; open-Map and all other overlap/target assertions remain.
Text ink is checked inside its actual owning surface, not a smaller unclipped
line box. This stricter surface check exposed and verified the real inset fix.

## Remaining acceptance boundaries

Actual window blur was observed and canceled Shelf. `document.hidden` remained
false in that browser experiment. Hidden-document handling passed an explicit
fixture and the documented full-V11 harness; no OS/browser-hidden event is
claimed. Physical iPhone/Android, Safari, real hardware safe areas, screen readers,
device FPS and full packaging fidelity remain unverified. Existing Mexico
placeholder-sector disclosure remains unchanged.

Independent read-only review accepted the source-matched primary frames at
86/100, with no blocking findings or unresolved functional P2. The rubric and
verified source prefixes are recorded in the evidence JSON; its raw report is
`/private/tmp/gallery-shelf-focus-release/independent-review.json`. Parent
Gallery/legacy/PWA checks have also passed, as recorded in
`/private/tmp/gallery-shelf-focus-release/results.json`. Version/generation,
production-prefix smoke, Git, CI and live publication remain parent-owned. This writer did not edit task,
version or generated files and did not stage, commit, push or publish.

## Parent release acceptance — application 1.1.39

[Acceptance receipt](evidence/v11-shelf-focus-acceptance.json) records 47 Python
tests, generator/SSOT, Gallery, 28 legacy cases with axe, four no-JavaScript paths
and PWA checks. The generated 1.1.39 artifact passes real four-SKU Shelf/Add/exact
camera-player-return and Bag/Shops-directory journeys at 390/1440 under a project
prefix. Its module matches source; docs/tests are excluded from publication.
[Independent review](evidence/v11-shelf-focus-independent-review.json) is 86/100.
Git remote SHA, Actions/Pages and live source/flows are verified after pushing.

Final frames: [nearby 320](screenshots/v11-shelf-focus/nearby-320.png),
[nearby 390](screenshots/v11-shelf-focus/nearby-390.png),
[Shelf 320](screenshots/v11-shelf-focus/shelf-320.png),
[Shelf 390](screenshots/v11-shelf-focus/shelf-390.png),
[software-inset landscape](screenshots/v11-shelf-focus/shelf-insets-667.png),
[desktop Shelf](screenshots/v11-shelf-focus/shelf-1440.png),
[stage keyboard focus](screenshots/v11-shelf-focus/target-focus-320.png),
and [held physical product](screenshots/v11-shelf-focus/held-390.png).
These images and laboratory checks do not certify physical devices or packaging.
