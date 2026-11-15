# GJH V11 interior pilot release

Date: 15 November 2026. Application 1.1.42. Base: `ba6d8d0` (latest origin/main at release preparation). The owner explicitly requested committing and pushing the eight-asset pilot, documentation and task.md.

## Reconciliation

The original local implementation was based on application 1.1.30. Meanwhile, main added Visitor v2, M056 premium shelves, Shelf focus, interaction modes, context navigation and graphics recovery. Release preparation uses a separate worktree rooted at current main; it transplants only pilot geometry/loader changes and read-only resource telemetry. It does not replace the newer player, UI, interaction, graphics or release documentation with older local files. Unrelated local amenities/onboarding and Gallery work are not included.

The complete pilot route is `demos/corporate/gjh/v11/index.html?interior=pilot`. The default retains the released M056 model and its support heights, can positions, front orientation and shelf bounds. The query selects the DSP-001 model and its measured native dimensions, original shelf orientation, support heights, can positions and matching collision/focus bounds together. Both routes keep the same four SKU identities, 36 physical can instances, pickup/return implementation, product preview, Bag/cart and Shelf focus ownership. Seven other pilot assets are shared. This explicit selection resolves the two independently delivered shelf choices without removing either asset.

The [original implementation review](gjh-v11-interior-pilot-review.md) and [manifest](../models/gjh-interior-pilot/manifest.json) retain provenance, G01–G12 applicability, editable sources, 40 model renders and historical local E2E. They are not claims that the later main had the same runtime or draw-call counts. The current release evidence below supersedes historical runtime measurements.

## Release verification

Verification runs in the isolated release worktree. Current source hashes, command results and limitations are recorded in the [release verification receipt](evidence/interior-pilot-release-verification.json). The eight original exports and editable sources remain byte-identical to the implemented pilot.

Current checks include the complete pilot's three viewport journeys and individual asset/corruption/delayed-parse/no-WebGL faults, default V11 regression, graphics recovery smoke, default/pilot shelf compatibility, all Python unit tests, required Gallery/GJH/PWA suites, generated artifact checks and binary validation. Screenshots and reports use `interior-pilot-release` names to preserve historical evidence.

Physical devices, Safari, screen readers, field performance and all 192 remaining backlog candidates remain unverified. The earlier source-bound graphics acceptance remains historical; this pilot does not relabel it as a full new graphics certification.

Verified release results: 49 Python tests and 16 Node policy/mode tests pass. The [14-case pilot E2E](evidence/interior-pilot-release-e2e.json), [four shelf compatibility cases](evidence/interior-pilot-release-compatibility.json) (both models at 390/1440, all four SKUs, two pickup/return cycles per SKU), [default V11 regression](evidence/interior-pilot-release-v11.json), [13-case/35-frame graphics smoke](evidence/interior-pilot-release-graphics.json), [Gallery](evidence/interior-pilot-release-gallery.json), [28 legacy demo cases](evidence/interior-pilot-release-demos.json) and [PWA](evidence/interior-pilot-release-pwa.json) pass. [Seventeen furniture normal/missing/aborted cases](evidence/interior-pilot-release-furnishings.json) also pass. Eight GLBs again produce zero Khronos errors/warnings. Generation and SSOT checks pass.

[After-only local measurements](evidence/interior-pilot-release-performance.json) report 127/148/166 startup draw calls at 390/639/1440px. These use the reconciled main runtime and differ from the earlier local worktree that contained unrelated amenities. They are not an isolated before/after performance comparison or device FPS claim. [Release captures](screenshots/interior-pilot-release/integrated-639.png) and both shelf-focus variants in that folder show the current integrated runtime.
