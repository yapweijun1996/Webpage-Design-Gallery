# V11 interior D1: Help and Map ownership

Date: 2026-11-15 (Asia/Singapore). Release baseline: main
`32bdc3134ce96a554040c75f4795a39eecaee020`, application 1.1.46.
Candidate: application **1.1.47 / build `84f6c25a0d9e6e45`**.
Local checks are recorded in the [bounded receipt](evidence/v11-interior-hud-ownership.json).
Final independent acceptance and main/CI/Pages delivery belong to the primary
release owner.

The owner authorized the four remaining interior tasks. This change implements
D1 only; D3, D4 and D5 retain separate acceptance and delivery. The imported
200-row candidate reference is unchanged. No remaining asset production is
claimed by this HUD work.

## Observable behavior and owners

Compact viewports have one permanent header Map entry. The redundant native map
summary icon is hidden. The panel offers Close, header retoggle, Escape and
controller Back, with focus returned to the visible header entry. Kiosk and quick
guide actions use the same guarded map-opening function. The body stays below
the Help row, including short landscape with a mouse.

The existing Help disclosure owns permanent help. Tutorial Help, H/? and
controller Menu open the same panel. “Show quick guide” remains its explicit
nested welcome/settings/tutorial action. The old idle onboarding Help button
was already suppressed by CSS; this is not a claim that two idle Help buttons
were visibly present on the baseline. The explicit shared API replaces that
suppression and unifies the callbacks.

The compact directory toggle says “Stores” while retaining its complete
accessible name. Baseline “Store directory” extended 21.86px past a 320px
viewport. One label helper updates entry and breakpoint changes. Directory/3D
round trips retain full controls and focus rings; the directory's existing
“Enter 3D Mall” label still fits.

Graphics quality, seven Visitor v2 appearance fields, all touch instructions,
disclosures, component appearance/language/input settings, welcome preferences,
tutorial progress and the v1 path remain available. Standalone onboarding keeps
its default idle Help entry. The optional host API is documented in
[shared onboarding](3d-onboarding-components.md#embedded-help-ownership).

`assets/ui.js` owns host entry/focus policy. Shared onboarding owns welcome,
preferences and tutorial state. `modes.js` remains the gameplay mode/pause owner:
compact Help/Map pause, while wide panels retain their nonblocking policy.
Tutorial suspension is published synchronously with mode signals, including
manual fixtures. Stale Help/Map/quick-guide triggers cannot open behind Bag or
another modal.

## Upstream native welcome repair retained

Main `32bdc31` independently repaired the original sticky-footer overlap. Its
normal-flow relative footer, safe-area padding, dark navigation colors and
tokens, shared preference text color and three-column mobile navigation are
retained. **D1 adds no footer wrapper, shared layout CSS or five-column override.**
The shared onboarding stylesheet is byte-identical to this main revision.

An earlier uncommitted D1 candidate used a scroll wrapper. That candidate is
superseded; its captures and checks are historical evidence, not the final DOM.
The final implementation reuses the already delivered native dialog scroll
owner. See the unchanged [upstream welcome review](v11-welcome-modal-fix-review.md).

Paired baseline/current checks at 320x568 reach 14 real Tab targets with all
center hits passing, including Start, preference checkbox, Home and Shops.
Both baseline and final candidate pass, confirming that the upstream fix was
preserved. All five mobile navigation targets measure 76x44px in three columns.
The original four-size dark welcome suite passes unchanged assertions, including
checkbox scroll/hit/toggle, close/reopen, preference retention and Start; only
its evidence destination is redirected to preserve published captures.

## Directory imagery preservation and fallback

Concurrent hybrid/hero, native front-facing shelf density, nine AI brand images,
disclosures, official artwork associations and design-token changes are preserved.
D1 changes no geometry, model/texture bytes, product records, collision, physics,
store count or transport implementation.

The imagery revision introduced a 667px Directory overflow: document width
671px and a 322.94px minimum GOGO card exceeded the nested grid track. Brand
cards now use one column through the existing 800px breakpoint. Copy, images
and actions remain intact; overflow is not hidden. The imagery-specific bridge
passes 25 semantic/contrast scans at 320/390/667/768/1440px, with nine images
decoded against their actual source-file pixels and official MILI artwork/focus
preserved. The initial instrument incorrectly assumed a 1600x900 HTML layout
slot was the native pixel size; its failed log and correction are retained.

The current welcome integration leaves that Directory component unchanged.
Current 800/801px closed/open checks verify four states and all 43 painted
Directory controls per state: at least 44px, horizontal viewport containment,
actual center hits and unclipped content. These current checks bridge the
protected image-specific proof without claiming it was all rerun.

## Verification and measurement boundaries

Exact-current focused verification passes 13 HUD groups and 50 frames with
runtime/test hash guards. Exact-current DOM verification passes 70 accessibility
scans across five viewports, all immediate Hair hit tests, real associated-label
edge clicks and source/test stability guards. Shared defaults pass five viewports
and all six standalone profiles on the current Help API and stylesheet.

The native checkbox has a 20px visual input inside its associated pointer label.
A real visible edge click toggles/restores the preference before measuring that
label against the unchanged 44px target requirement. Unpainted descendants of
closed native `details` are excluded from visible-target measurement; Chrome
still gives them layout boxes. Direct Inspect and permanent Map entry expectations
are reconciled with their existing production contracts. No thresholds are lowered.

A historical 667px immediate Hair hit failure remains unreproduced. Its raw
failure is retained without an invented cause; paired probes and subsequent full
runs use the same immediate-hit assertion. Native OS popup keyboard choice
remains NOT VERIFIED where the isolated host fixture also does not change.

The prior 162 mode snapshots remain scoped to their recorded phase; the mode
engine is unchanged, and current lifecycle/breakpoint checks bridge the UI
integration. Earlier Gallery/legacy/PWA and generated V11 checks retain their
source identities, with current generation/static and independent smoke bridges.
Physical iPhone/Android, actual insets, OS screen readers, physical controllers,
Safari and device frame-rate certification are not claimed. No new visual score
is assigned. The local D1 gate is independently approved. Primary post-push CI, Pages and
actual public flows remain the release gate before D3.

Representative unchanged copies:

- [Historical compact HUD](screenshots/v11-interior-hud/before-compact-320.png) and [current compact HUD](screenshots/v11-interior-hud/after-compact-320.png).
- [Current native dark welcome at 320px](screenshots/v11-interior-hud/current-guide-320-dark.png) and [desktop](screenshots/v11-interior-hud/current-guide-desktop-dark.png).
- [Compact Map](screenshots/v11-interior-hud/after-map-390.png) and [landscape Map](screenshots/v11-interior-hud/after-map-landscape.png).
- [Help after internal scrolling](screenshots/v11-interior-hud/after-help-scroll-320.png) and [wide Help](screenshots/v11-interior-hud/after-help-wide.png).
