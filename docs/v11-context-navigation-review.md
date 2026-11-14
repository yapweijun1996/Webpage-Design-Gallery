# V11 contextual navigation implementation review

Base: `6a1f31c39a17e5ecd367dfd9608182c083b329ee` (application 1.1.37).
Scope: the single Phase 7 contextual-navigation task in
[v11-context-navigation-plan.md](v11-context-navigation-plan.md). Release metadata,
task checkboxes, repository-generated Gallery/PWA outputs, Git and publication
remain with the parent. Independent visual acceptance remains a parent gate.

## Ownership and behavior

`assets/context-navigation.js` builds one physical native navigation landmark and
one five-column button list with DOM creation/textContent. The component owns its
DOM, disabled explanations, measured viewport reservation and only its own focus
recovery. `script.js` projects `modes.current()` into UI after canonical observation;
the mode manager remains the sole mode/pause owner. The same node moves between
Guide, Bag and the bounded viewport host. A stable mode/readiness/host/destination projection
returns without DOM mutations, node moves, focus calls or new observers.
UI projects its existing showing3D state separately from canonical mode. Exactly
Home or Shops has aria-current="page" and the filled treatment; the other enabled
destination uses the existing paper/green secondary treatment. Unsupported items
never receive current state, including fallback.

Home uses the existing view/Guide/Bag close owners and retains the actual 3D
position, camera, Seated/Cart base and selections. It does not teleport, stand or
stow. Shops uses the existing explicit List stand/stow policy and returns the
heading and masthead into view even when the directory is already active. Bag
closeTo owns final focus during its Shops/Home handoffs; no competing generic
close restoration was added. Guide's trap discovers the current enabled controls,
including Home/Shops, rather than ending at guide-list.

The unavailable Events, Rewards and Profile buttons are natively disabled, with
visible demo-unavailability copy. Home has separate readiness copy, disabled state
and activation guards. Fallback explicitly republishes UI state after readiness
changes, covering the already-directory early return. A focused Home recovers to
Shops after real context loss; unrelated focus stays with its owner. The
650-to-651 disappearing-navigation case recovers its own focus to Scene without
interrupting native inspection entry. Compact Map Home explicitly focuses Scene
after its no-transition setView(true) path, including touch activation.

Guide and Bag keep their native dialogs, content, names and sticky Close headers.
Only their new content wrappers scroll; the footer is a separate flex row. Bag
retains its existing ResizeObserver/header variable and return-focus ownership in
unchanged demo-bag.js. The variable is inherited by the actual bag-scroll region.
Header top padding belongs to the opaque sticky header, avoiding both clipped
Close controls and content showing through the scroller's former top padding.
Directory bottom/scroll padding and compact Map/Help bounds consume measured bar
height; the scene disclosure keeps its wording and typography and clears the bar.
Map opening publishes the reservation before scrolling the focused destination
into view, including the short-landscape case.

All new presentation consumes existing semantic palette/type/spacing/layer tokens.
The navigation's focus outline is explicitly scoped to its paper surface, including
body.is-3d. No theme source, registry, generated theme, icons, models, textures,
fonts, framework or npm dependency changed. The supplied advisory SSOT/theming
skills were interpreted through ds.md's local Python/static/native-dialog rules.
Routed instruction-modules are absent in this isolated checkout; the supplied core,
parent-completed workflows and concrete plan governed the bounded implementation.

## Browser evidence

Environment: macOS arm64, real Google Chrome 157.0.8103.51, ANGLE Metal,
reduced-motion browser contexts and touch emulation where specified. Local HTTP
servers shut down after each suite. Source-root navigation coverage uses
320x568, 390x844, 667x375, 768x1024, 1440x900, both 650/651x844 boundary sides,
359x740, 361x740, 844x560 and 844x561.
The portable suite also accepts a separate generated build root and path prefix.

The navigation evidence covers one node/host, actual labels, disabled states,
keyboard/pointer destinations, 44px targets, equal columns, text and focus contrast,
no horizontal overflow, modal/footer/header hit testing, complete sticky-header
bounds, Guide PageDown content access, Bag top/middle/bottom scrolling, directory
last-content clearance, same-directory heading focus, native Close/Escape,
Inspect/Original tin exclusion, retained Seated/Cart, stale-input cleanup, nested
Map/Bag host restoration, resizing and actual WEBGL_lose_context under directory
plus Bag with focused Home. Optional shopping-cart.glb failure keeps ready Home
enabled. State is driven through real controls and existing player test APIs;
no mode, readiness or DOM-visibility flags are fabricated.

Observed text contrast is at least 5.6185:1; the computed 3px paper-surface outline
is 4.2579:1. Screenshot inspection is separate from those computed checks. Final
Guide, Bag (including middle/bottom), short-landscape Map/Help, directory and
fallback images were actually opened and reviewed. The parent owns the independent
subjective taste score, including the required 85 gate.

Machine evidence:

- [Navigation](evidence/v11-context-navigation.json)
- [Generated build / path-prefix smoke](evidence/v11-context-navigation-build.json)
- [162 mode snapshots and v1 smoke](evidence/v11-context-navigation-modes.json)
- [Focused mode review](evidence/v11-context-navigation-mode-review.json)
- [Verification, hashes, payload and screenshots](evidence/v11-context-navigation-fix.json)

## Fixture synchronization and rejected iterations

The existing Guide ShiftTab endpoint now expects context-shops, the actual final
enabled control. The existing accessibility Bag fixture scrolls bag-scroll, the
actual content owner. No previous target, contrast, pause, visibility or focus
assertion was removed. The new suite adds complete header/Close bounds because
center hit testing alone missed a visually clipped header.

Raw failed/passing iteration logs and screenshots are retained under
`/private/tmp/gallery-context-nav-worker/`. Initial test snapshots incorrectly
expected vertical physics settling to remain frozen after resume, and injected an
absolute yaw before checking an older snapshot; those were fixture issues, not
product defects. Horizontal position and actual camera/posture remain strict.
Guide PageDown waits for the real resulting scroll bounds rather than one RAF.
Product defects found during iteration were cramped 320px label spacing,
short-landscape Map focus outside its new scrollport, and Bag sticky-header
clipping/top-padding bleed. They were corrected and the same scenarios rerun.

## Performance and limits

The baseline/candidate network comparison is pinned to 6a1f31c and uses the same
current assets/browser/viewport. Exactly one request is added: the new DOM module.
The report records raw and gzip file sizes separately from observed decoded
resource bytes. No new GLB/texture/font path or GPU object is introduced; draw-call
observations remain identical for the compared store viewpoints. The existing
10 MiB decoded-resource and 200 draw-call limits are retained.

The old browser_gjh_budget.py count ceiling of 45 predates the current default v2
runtime: the pinned base itself measures 51 resources, while this task adds exactly
one. That old whole-suite budget is not claimed as passing, and no budget was
raised or unrelated performance change made. The parent can reconcile that
pre-existing gate separately using the pinned measurements.

No physical device, real safe-area inset, Safari, screen-reader or native OS select
popup choice is certified. Parent final Gallery/legacy/PWA/generation checks,
release metadata, independent visual acceptance and publication are outside this
worker's completion authority.

## Bounded follow-up: destination and inspection return

Parent independent review found two gaps after the first passing suite: missing
current-destination state and an actual offscreen inspection opener after a
667x375 to 320x568 reflow. The exact parent reproduction was run before the fix
and failed with original-tin-open at y=1400.656..1444.656, footer top 463.625,
scrollY 1627 and center hit false. Native focus identity alone was insufficient.

The component now schedules at most one frame after its footer layout/show,
resize/height change or focusin, reads document.activeElement fresh at execution,
and scrolls only a connected, rendered directory target outside the safe root
scroll area. It requires the visible global host, directory destination and no
open native modal, and excludes navigation controls. It uses immediate nearest
scrollIntoView and the actual root scroll-padding, preserving ring clearance and
focus identity. It does nothing for an already clear target. Product, Original
tin and Bag native close/focus owners are unchanged. An initial follow-up guard
captured focus before the queued frame and missed a later native brand-return
handoff; the expanded test caught this and the final guard reads current focus
at execution. Both failed logs are retained.

Permanent coverage includes Original tin and the lowest directory brand Inspect
(GOGO), keyboard opening and Close/Escape at 320x568, 390x844 and 667x375, plus
667x375 to 320x568 while Original tin is open. It checks exact opener identity,
center hit, complete focus/ring bounds above the footer and horizontal overflow,
and records before/open/after scroll positions and rectangles. Separate checks
keep an already clear target stationary and move focus before the queued guard
to prove the old opener is not pulled back.

The Bag title concern did not reproduce. At 320x568 the title bounds are y=49..115
inside the y=17..446.625 scroller and y=17..131 sticky header; Close is y=60..104.
At 667x375 the title is y=54.5..87.5 inside the y=17..272.8125 scroller and
y=17..109 header; Close is y=49..93. These values remain stable at scroll fractions
0, 0.5 and 1. No speculative Bag CSS was added in this follow-up. The separate
three-viewport real-context-loss probe also preserves the last Remove identity
and center hit after Home-note expansion; no extra dialog focus guard was added.

Final follow-up command results, source hashes, raw logs, screenshots and limits
are recorded in `/private/tmp/gallery-context-nav-fix/summary.md` and the focused
verification JSON. The provisional independent visual score was 82/100 before
these fixes; this worker does not replace the parent's required >=85 review.

Final follow-up verification passed: 10 mode unit tests, 7 navigation viewports /
14 groups, the exact six-case parent inspection probe, three unrelated-focus loss
probes, 162 canonical mode snapshots plus v1 smoke, 15 mode-review scenarios,
Guide/Bag, 70 axe scans, full V11, and two generated-build subpath viewports.
SSOT reports no new debt. Actual screenshots listed in the focused follow-up
evidence were opened; this records inspection, not independent taste acceptance.

## Bounded software safe-area regression

The parent's actual Chrome inset probe exposed a separate CSS reservation defect.
The later shared interaction stylesheet already includes the top inset in the
header/experience origin and the bottom inset in the experience bounds. V11's
compact panel limits omitted those insets, and its Nav disclosure offset added
the bottom inset a second time. At 667x375 with top/bottom/left/right insets
20/24/30/30, Map ended at y=278 over a disclosure starting at y=212; Nav started
at y=265.8125. The permanent asserting test failed before the CSS repair.

V11 now owns one footer bottom extent (measured bar plus shared safe bottom),
used by root scroll padding, directory body padding and compact Map/Help limits.
Those limits also deduct the shared safe top. The experience-local disclosure
reserves only bar height plus its existing gap. The same stress Map now ends at
y=234, disclosure occupies y=236..257 and Nav remains y=265.8125..351.
Help ends at y=213. Disclosure text, type, colors and layers are unchanged.

The stress test also caught Bag's Nav extending 5.5px beyond each 30px safe edge;
only a V11 Bag hosting visible navigation now consumes the existing symmetric
safe-edge width rule. A 320px reflow retaining these side insets exposed Rewards
text spilling into the next column. Button labels can now wrap when needed,
retaining their existing type and minimum 44px targets. The measured reservation
continues to follow the resulting height; no navigation logic or native focus
owner changed.

[The focused portable test](../tests/browser_gjh_context_navigation_insets.py)
sets the experimental `Emulation.setSafeAreaInsetsOverride` command before load,
using only the [primary CDP schema](https://raw.githubusercontent.com/ChromeDevTools/devtools-protocol/master/json/browser_protocol.json)
as the method reference. It separately reports `NOT_VERIFIED` for a missing
method; supported-command geometry/assertion failures remain failures. It proves
the override reached CSS through actual header, experience and footer bounds.
Coverage includes Guide, Map, nested and populated Bag, Help, directory,
three Map targets, seven Help fields and the guide button through actual Tab
scrolling, deep native inspection returns, and a modal-open 667-to-320 reflow.
It checks safe-edge bounds, 44px enabled Nav targets/hits, label bounds,
panel/disclosure/Nav separation, root/footer reservation and horizontal overflow.

The earlier inset worker's passing command records are retained in
`/private/tmp/gallery-context-nav-insets/verified/check-results.json`. Its
conditional full-ring check admitted a 97.44px target inside a 79px scrollport;
that result was insufficient for complete target/focus visibility and is
superseded by the strict regression below. These are software CSS env stress
profiles, not physical-device, notch, Safari or screen-reader proof.

## Bounded follow-up: complete Map targets and rings

Independent review confirmed P2 at exactly 667x375 with top/bottom/left/right
20/24/30/30. Before the repair, the unconditional regression failed: New Moon
occupied y=167.421875..264.859375 with an 8px ring while the Map scrollport was
y=155..234. Its center was hit-testable, concealing the clipped target and ring.
The strict red report is `/private/tmp/gallery-context-nav-ring/red-strict/report.json`;
its portrait profile passed. The first test iteration also attempted DOM Range
bounds for a native select, which has no DOM-painted option text; label bounds
are correctly limited to Map buttons while complete target/ring bounds remain
unconditional for every requested Map/Help control.

Only the V11 Nav-visible Map button rule inside the existing short-landscape
media query changed: height is the existing 44px control token plus 8px spacing,
and its two-line internal gap is 4px. It retains the three absolute spatial
store targets, the floorplan SVG/location marker, complete numbered store labels,
accessible names, native buttons and actual destination actions. No shared CSS,
new CSS layer, typography/color token, navigation logic or focus owner changed.
At the required landscape profile all three targets are 52px high; their full
8px rings occupy y=160.421875..228.421875 inside y=155..234. Portrait keeps the
97.44px targets in its larger scrollport.

The permanent inset test has no oversized-target escape. Every keyboard-reached
Map and Help target must be at least 44px, hit-testable and completely contained
with its actual computed ring on all four edges. Map label ranges must fit each
button. Both required profiles also activate all three actual storefront journeys
using Tab and Enter, checking x=-10/0/10, Scene focus, Explore mode, Map closure
and hidden contextual navigation. The SVG's complete accessible description and
all three storefront action names are asserted. Existing Guide/Bag/Help,
directory, inspection return and modal-open reflow coverage remains.

Navigation SIZES now includes all 11 requested viewports, including 359x740,
361x740, 844x560 and 844x561. Final viewport screenshots include both width and
height so the two 844px media-boundary runs remain independently reviewable.
Final source-matched commands, hashes, strict geometry, screenshot hashes and
explicit limits are in [ring follow-up evidence](evidence/v11-context-navigation-ring.json)
and `/private/tmp/gallery-context-nav-ring/summary.md`. Parent independent
visual acceptance >=85, full V11 plus Gallery/legacy/PWA final gates and release
remain pending and are not replaced by these focused results.

## Parent acceptance — application 1.1.38

Final source-matched verification and release metadata are recorded in
[acceptance](evidence/v11-context-navigation-acceptance.json). Independent
source/actual-frame review accepts 85/100, with no P0/P1 or unresolved functional
P2. The earlier Bag title concern was disproved and withdrawn. Narrow 320px
modal navigation can wrap Rewards over two lines; it remains readable, contained,
natively disabled and explained. The independent review is
[recorded separately](evidence/v11-context-navigation-independent-review.json).

Parent checks pass: 47 Python tests, full V11 Metal, Gallery, 28 legacy cases
with axe and four no-JavaScript journeys, PWA update/offline, generator and SSOT.
The final 1.1.38 artifact passes navigation and strict inset checks under a
project prefix; its new module matches source and docs/tests are excluded.
Remote SHA, Actions and live output are checked after the task-specific push.

Reviewable final frames: [390px Guide](screenshots/v11-context-navigation/guide-390.png),
[320px Bag](screenshots/v11-context-navigation/bag-320.png),
[desktop directory](screenshots/v11-context-navigation/directory-1440.png),
and [667px Map with software insets](screenshots/v11-context-navigation/map-insets-667.png).
Software insets do not certify a real notched device. Remaining physical, Safari,
screen-reader, native popup and packaging limits are preserved.
