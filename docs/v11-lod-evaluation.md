# V11 LOD evaluation — measured decision

Task: Phase 1, evaluate distant LOD and close-up detail before adopting runtime switching.
Evaluation baseline: `47ccc80fbf2676fc557e131fa5efad52af75281e`, application 1.1.30.

## Current evidence

The four locally pinned LOD1 can assets each contain 3,044 triangles and three materials.
Their sizes are 158,528 bytes (New Zealand), 153,464 (Australia), 156,540 (South Africa),
and 119,196 (Mexico). SHA-256 values match `assets/newmoon-demo-source.json` and
the runtime definitions in `assets/products.js` under the V11 demo.

A fresh 320x740 Chromium 157.0.8103.51 / macOS / SwiftShader diagnostic observed
50 initial resource entries and 9,316,532 decoded resource bytes. The unchanged
budget check failed its 45-resource limit. Six local images appear twice in the
resource list: the New Moon and Mili covers and four product packshots. HTML uses
ordinary image requests while Three.js r170 defaults to anonymous CORS requests.

The candidate change makes the fixed local TextureLoader use the same request mode
as HTML. An independent source reviewer confirmed the vendored ImageLoader skips
setting `crossOrigin` when it is undefined. This is limited to same-origin textures;
revisit the setting before moving these assets to an external origin.

## Acceptance scope

The candidate passed the budget and rendered near/distant product checks described below. Initial runs also recorded navigation timeouts; the diagnostic rerun
extends only navigation waiting to 120 seconds, with all budget assertions retained.

Passed baseline checks: gallery generation check, SSOT check, all 46 Python unit
tests, Gallery browser suite, and PWA browser suite. These do not establish the
candidate's LOD or visual acceptance. The Phase 1 evaluation checkbox is complete within this laboratory scope.

Physical-device performance, exact packaging fidelity and independent artwork
rights remain unverified. Resource decoded bytes are not compressed wire traffic
or GPU-memory measurements. No speedup claim or dynamic LOD implementation is made.

## Measured LOD decision

Keep the existing shared LOD1 geometry for the mall and opt-in detail preview.
Do not introduce distance switching: all five tested viewports remain within the
existing budget, and the front/side/back studio renders show distinguishable
silhouettes and label colours. Higher geometry detail would not fix the estimated
artwork or Mexico's missing sector. At native scale in the mall, fine packaging
text remains too small to read; use the existing official packshot/detail route.
This decision completes the evaluation scope, not a physical-device performance
certification or a promise that LOD switching could never help.

Candidate measurement (native ANGLE Metal, reduced motion, fresh contexts):

| Viewport | Resource entries | Decoded resource bytes | Maximum draw calls |
| --- | ---: | ---: | ---: |
| 320x740 | 44 | 8,480,992 | 121 |
| 390x844 | 44 | 8,480,992 | 121 |
| 768x1024 | 44 | 8,480,992 | 137 |
| 1440x900 | 44 | 8,480,992 | 152 |
| 844x390 | 44 | 8,480,992 | 153 |

Limits remain 45 entries, 10 MiB decoded resource bytes, 200 draw calls.
Five preview open/load/close cycles per viewport returned app-tracked resources
and live contexts to zero. No external requests or page errors were recorded.
See `docs/evidence/v11-lod-budget.json`; its environment corrects the historical
script's hardcoded Linux description to the actual macOS/Metal test host.

The product integration review passed all four SKU detail mappings at 1440, 768
and 390px, including a forced shelf-load failure at 390px and shelf collisions.
The exact pinned LOD1 front, side and back renders and three interior views were
visually inspected. Evidence: `docs/evidence/v11-lod-products.json` and
`docs/screenshots/v11-lod/`. These checks do not establish packaging accuracy.

The old budget harness expected Run to be clickable under a compact open map.
Current UI deliberately pauses exploration and hides movement controls there.
The harness now verifies that hidden state and tests restored visibility, centre
hit testing, toggle functionality and 44px target size after closing the map.
Independent read-only source review found no blocking issue in either change.

## Regression reconciliation and release status

The full V11 suite also retained an old Escape-focus expectation for the map's
internal summary. Current UI explicitly restores the visible header Map button;
the test now requires that button to be visible and focused. No production focus
behavior changed in this task. Full V11 rerun passed after this reconciliation.

GJH legacy demos: 28 browser cases and four no-JavaScript journeys passed.
PWA final candidate 1.1.31: offline browse, verified update, retained selection,
and installability checks passed. Gallery browser suite passed. Full Python unit
suite passed 46 tests again after final artifact regeneration.

Original diagnostic failures remain recorded here: missing Playwright/Pillow in
the temporary QA environment (installed there), initial resource budget failure,
SwiftShader navigation/screenshot timeouts, and obsolete map Run/focus test
expectations. Metal results do not establish SwiftShader acceptance. No thresholds
were increased and no original failing result was reclassified as a pass.

The exploration-plaque check was also reconciled with compact menu overlays:
when the compact-panel state is active, require menu mode and no rendered frames;
otherwise retain every HUD/plaque nonintersection assertion. Independent review
confirmed exploration checks remain active at the atrium, store entrances, walking
samples and interiors. Final full V11 rerun passed on native Metal.


## Completion gate

Application 1.1.31. Generation check, SSOT, 46 Python tests, Gallery browser suite,
28 legacy-demo browser cases plus four no-JavaScript journeys, full V11 suite
(native Metal), five-viewport budget and four-SKU integration review passed.
PWA offline/update/installability regression passed against final build
`84e6c37688df095f`. Temporary screenshot refreshes from unrelated suites were
restored; only selected LOD review captures are included.

Independent source review covered loader semantics, fixed local asset boundaries
and test-contract reconciliation. Self-review covered generated output ownership,
accessibility/fallback preservation, performance evidence, integration and release
scope; no confirmed P0/P1 issue remains for this task. No new dependencies or
external runtime fetches were introduced. SwiftShader timeouts, physical devices,
packaging masters and rights certification remain outside the proven scope.

Git delivery and Pages acceptance are verified separately after commit; these
local results alone do not prove publication.
