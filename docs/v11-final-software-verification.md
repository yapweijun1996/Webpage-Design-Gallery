# V11 final software verification

Date: 2026-11-15. Runtime: application **1.1.41**, build
`8756a8b3f0c73835`, implementation commit
`32287f1fe116ad810337bd79ac25c1ac4b0511bc`. Documentation baseline:
`0eaf2300469eb26fdc2da6cbbfab0d735bba3a69`. This closes the checklist's bounded
software keyboard/name/reduced-motion/fallback gate. It is not an all-device,
packaging, assistive-technology or blanket WCAG certificate.

## Current-source acceptance

The final audit rechecks all 32 runtime file hashes against the frozen focused
proof, its before/after test hash and the final regression manifest. The same
runtime passed the subsequent generated-artifact and live Pages checks. The
commerce scope commit changes documentation only. Earlier reports retain their
original versions and coverage; the historical 1.1.14 evidence table is not a
claim about the current runtime.

| Boundary | Current evidence and result |
| --- | --- |
| Keyboard and focus | Real W/turn/F journeys, modal Tab/Shift+Tab, Close/Escape, visible focus, Bag/cart entry, Shelf and contextual navigation pass. Live 390/1440 recovery also resumes actual keyboard movement. |
| Accessible names and DOM contrast | 70 axe states across five viewport sizes, native named controls, conservative DOM contrast checks and focused target/hit tests pass. The graphics suite adds two changed-surface scans and 15 layout cases. Scene artwork is not a solid-background contrast certificate. |
| Quality selection | Actual trusted native `d` typeahead selects Detailed; Tab/Shift+Tab retain normal focus behavior. Selection-event tests also exercise every profile. OS popup Home/End/arrows are separately NOT VERIFIED on this host. |
| Reduced motion | Full V11 reduced-motion/hidden-pause checks pass. Graphics acceptance covers reduced and normal motion, including actual in-flight elevator interruption; exact suspended state and the localized post-resume physics contract remain intact. |
| Fallbacks | Full V11 verifies no JavaScript, missing WebGL and failed WASM. Six graphics failure cases retain working directory/products. Native main-context loss/restoration, failed validation, startup interruption and healthy product-preview independence pass. |
| Integration | 13 mode units, 165 mode snapshots, 15 review groups, navigation/insets, 12-viewport Shelf, target functional, V11, Bag and preview regressions pass on one frozen runtime family. Quality policy adds three unit tests. |
| Gallery and PWA | Required Gallery, 28 legacy cases, four legacy no-JS journeys and PWA checks pass. All 47 Python tests, SSOT and generation pass; Pages CI repeats the Python/design-system/build checks. |
| Artifact and live delivery | Generated `/gallery/` artifact: 13 cases/35 frames pass. Full graphics proof: 73 cases/100 frames. Pages: 34 hashes match, 390/1440 at DPR2 pass two real context-loss/recovery flows, all four textured SKUs, Bag(4), Cart availability, manual Detailed and directory-modal focus. |

Frozen proof and limitations are in [graphics review](v11-graphics-recovery-review.md),
[graphics acceptance](evidence/v11-graphics-recovery-acceptance.json),
[independent review and supplement](evidence/v11-graphics-recovery-independent-review.json),
[target guidance review](v11-target-guidance-review.md),
[DOM accessibility scope](v11-accessibility-review.md) and
[final audit receipt](evidence/v11-final-software-verification.json).
Independent visual acceptance is 86/100 with no remaining functional P2/P0/P1.
This final audit does not invent another visual score or repeat unchanged suites.

## Failed historical oracles, explicitly retained

The optional old 45-request ceiling fails before this task as well: the pinned
baseline has 55 requests, current 56. It was not raised. Current paired payload is
8,933,625 decoded bytes and broad maximum 181 draw calls, within the separately
measured 10MiB/200 limits. The earlier target-only exact cold-GPU equality also
fails against its old revision because the current wide cold upload is smaller.
That assertion is unchanged; target functional coverage passes with the explicit
supported empty comparison option. Current graphics profile/epoch checks provide
separate resource proof. These failed historical oracles are not reported as
passing tests, device memory measurements or FPS certification.

The first parent live attempt matched 34 files but stopped because its monitoring
function expression was registered without invocation. The retained failure log
is followed by a corrected full pass. When reusing a browser probe, preserve its
actual invocation contract; an injected function expression alone does not execute.
Raw failures, source/test hashes and terminal exits remain distinct from summaries.

## Two incomplete checklist items remain

1. **Complete model/label/product-source matching.** Record/packshot/SKU mapping
   and the four unofficial flat-label candidates exist. Full panel order, physical
   dimensions and missing Mexico wrap artwork remain unverified. The owner stated
   that complete label masters or real-package references are unavailable.
   Generated comparison images cannot supply this missing provenance.
2. **Physical iPhone Safari / Android Chrome, actual insets and screen readers.**
   Current read-only tooling check finds zero ADB devices (ready/unauthorized/
   offline/emulator all 0); no usable iOS device runner is available. This does not
   assert that the owner possesses no phones. No actual-device or screen-reader
   session was run. CDP insets, hardware hints and hidden-state fixtures retain
   their laboratory labels. Physical contrast/thumb reach and device FPS are not
   certified by these results.

These are missing acceptance prerequisites, not inferred failures of the shipped
software. Both checkboxes stay open; all-task completion must not be claimed.
No further repeated desktop mock tests can supply the missing references/devices.
No real-commerce work is authorized by this audit; see the
[separate future scope](v11-future-commerce-scope.md).

Independent final audit approved closing this bounded software gate after checking
all 32 current runtime hashes, raw-evidence hashes and the frozen test guard. The
review explicitly retained the two external acceptance prerequisites and both
historical failed oracles. No new visual score is assigned by this documentation
audit. Final documentation publication and its remote check follow separately.
