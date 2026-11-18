# V11 stage 11b — startup budget work

Status: **historical local startup-budget acceptance passed** in the then-default classic layout, now available only with `?layout=classic`. The expanded mall became the default on 2026-11-16; the request, decoded-resource and draw-call limits are unchanged. The measurements below describe the tested snapshot and do not certify production speed, compressed wire bytes, physical devices, Safari or accessibility technology. Current-default measurements belong to the owner-decision acceptance record, not this historical report.

## Changes

- The pinned Rapier module formerly embedded its WebAssembly as base64 inside
  JavaScript. A Python-only generation step extracts the exact original WASM
  bytes into a local file and changes the loader expression to request them. The
  [archived source and hashes](../third_party/rapier/README.md) make that split
  reproducible and checked. The extra WASM request offsets one request saved
  elsewhere. If it cannot load, the existing accessible directory fallback is
  retained; the [runtime check](evidence/gjh-stage11b-20261115/runtime.log)
  covers a blocked binary and both visitor versions.
- The gallery builder combines six existing stylesheet resources, preserving
  their cascade order, into one generated V11 stylesheet. Original source
  styles remain authoritative; the normal gallery `--check` rejects a stale
  bundle, and the SSOT ratchet continues to inspect the source styles.
- At this stage V2 was the default. The three V1 presentation modules load
  only when V1 is selected. See the [current visitor options](../demos/corporate/gjh/v11/README.md#default-tripo-visitor).

## Matched measurements

Fresh Chrome 157 contexts on macOS, SwiftShader, reduced motion, 320 × 740,
service workers blocked and local uncompressed HTTP were sampled when the
guide had paused the ready default scene. The baseline was taken after merging
main at `099069d`; the final measurement also includes the later upstream
stage 8 merge at `b6aef2a` and the three startup changes. That upstream merge
changes expanded-only finish behavior and slightly changes the default scene's
loaded JavaScript, so the total delta is not attributed solely to the startup
changes. Resource entries
exclude the HTML navigation and represent decoded resources rather than GPU
memory or compressed transfer.

| Ready-stage observation | Before | After | Existing limit |
| --- | ---: | ---: | ---: |
| Decoded resources | 10,915,858 bytes | 9,884,761 bytes | 10,485,760 bytes |
| Resource requests | 89 | 82 | 45 |

The [before](evidence/gjh-stage11b-20261115/baseline.json) and
[after](evidence/gjh-stage11b-20261115/after.json) records include per-resource
observations. The unchanged budget test's [request-count failure](evidence/gjh-stage11b-20261115/budget-count-failure.log)
is a failure, not a pass for the whole test. Further request reduction needs a
separately verified loading strategy that preserves module identity, asset
integrity, fallbacks, offline behavior and individual visitor journeys.

## Integration boundary

This work reconciles the earlier stage 8–11 theme and material work with the
newer main branch's expanded shell, planned-space records and lift. The main
branch's physical cabin, call/ride states and interruption handling remain the
lift authority; the lift's batched surfaces now also accept theme colors. The
duplicate planned-space directory was removed in favor of the shared, static
and JavaScript-capable directory on main. The expanded courtyard map arrival
uses the existing main-branch safe point. Historical stage reports describe the
source snapshots that were tested at the time, not this later merge.

## Verification

The final [published-artifact and PWA checks](evidence/gjh-stage11b-20261115/publish-and-pwa.log) open both layouts from a generated project-prefix deployment, exercise V1/V2 and a blocked WASM request, and verify offline fallback, bag retention, update identity and hash rejection. The final [expanded accessibility run](evidence/gjh-stage11b-20261115/accessibility.log) covers all four themes and five viewports. [Material checks](evidence/gjh-stage11b-20261115/materials.log) cover the later upstream merge, five viewports, four graphics-quality settings, missing/late modules, canvas failures and graphics restoration. The broader [theme and shell journeys](evidence/gjh-stage11b-20261115/themes-and-shell.log) and [five-viewport lift suite](evidence/gjh-stage11b-20261115/lift.log) ran before the later stage 8 merge; that merge's material suite also rechecks lift travel and its failure paths. The [Python tests](evidence/gjh-stage11b-20261115/unit.log), [Node tests](evidence/gjh-stage11b-20261115/node.log), generator and SSOT checks passed. [Source hashes](evidence/gjh-stage11b-20261115/source-sha256.txt) pin the final runtime and relevant tests.

## Request reduction and current acceptance

The startup entry and its world, visitor and optional character boundaries are
now delivered as four reproducible local JavaScript bundles. Optional and
failure-sensitive modules remain independently loaded. The checked-in bundle
manifest records source and output hashes: ordinary clean builds still need
only Python; regenerating changed JavaScript requires the pinned standalone
Bun 1.3.11 compiler, with no npm installation or network dependency.

Nineteen original startup models are also delivered in a single local pack.
Each extracted model still receives its original size, identity, geometry and
SHA-256 checks. A missing, malformed, truncated or slow pack falls back to the
individual original files; a four-second pack timeout starts that fallback and
the existing overall model deadlines remain in force. Individual caller
cancellation remains isolated, and the shared raw pack is released after world
startup. The individual files remain available for fallback and existing
consumers.

The unchanged budget test measured a fresh Chrome 157 context on macOS arm64
using SwiftShader, reduced motion, local uncompressed HTTP and blocked service
workers. It excludes the HTML navigation and measures decoded resources, not
compressed transfer or GPU memory. The previous 320 × 740 result was 82
requests and 9,884,761 decoded bytes; the comparable current result is 40
requests and 9,923,772 bytes. Request count improves by 42 while decoded bytes
increase by 39,011.

| Viewport | Requests | Decoded bytes | Non-cart draw calls |
| --- | ---: | ---: | ---: |
| 320 × 740 | 40 | 9,923,772 | 158 |
| 390 × 844 | 40 | 9,923,772 | 159 |
| 768 × 1024 | 40 | 9,923,772 | 175 |
| 1440 × 900 | 42 | 10,274,856 | 197 |
| 844 × 390 | 40 | 9,923,772 | 198 |
| Limit | 45 | 10,485,760 | 200 |

The tightest observed headroom is three requests, 210,904 decoded bytes and two
non-cart draw calls; each comes from the worst case for that metric, not
necessarily the same viewport. Future changes should rerun the unchanged gate.
The earlier failed request check remains historical evidence of the earlier
implementation, not the result of this acceptance run. The current
[budget report](evidence/gjh-stage11b-request-20261115/budget-report.json) and
[log](evidence/gjh-stage11b-request-20261115/budget.log) include all five
viewports and the subsequent interaction checks.

A separate expanded-preview observation at network idle measured 42 startup
requests at 390 × 844 and 44 at 1440 × 900, using the Everyday theme and a
Metal backend. Loading all four themes subsequently increased cumulative
requests to 46 and 48 respectively; those later on-demand theme requests are
not startup requests. The [expanded theme observations](evidence/gjh-stage11b-request-20261115/expanded-theme-performance.json)
also record theme and cart draw calls; they are not the default-layout budget
gate or a field performance benchmark.

## Current regression checks

The real browser [store integration](evidence/gjh-stage11b-request-20261115/store-integration.log)
checks all three stores, four SKU details, bag, physical pickup and return,
plus V1/V2, fallback and five viewports. The expanded [lift](evidence/gjh-stage11b-request-20261115/lift.log)
and four-theme switching and recovery checks pass. The earlier shelf
compatibility test assumed Inspect opened an intermediate shelf view; the
current product contract opens details directly. Its retained-component
[fixture](evidence/gjh-stage11b-request-20261115/shelf-compatibility.log)
explicitly restores the old entry only within that test, while the store
integration test verifies the actual user action. The [navigation smoke test](evidence/gjh-stage11b-request-20261115/navigation-smoke.json) passes at phone and desktop widths after updating stale guide-focus and in-flow directory assumptions; it verifies visible targets, contrast, keyboard focus and bag state.

[Pack fault tests](evidence/gjh-stage11b-request-20261115/asset-failures.log)
cover absent, truncated, slow and individually corrupted resources, as well as
individual-file and world-module failure. The final
[accessibility run](evidence/gjh-stage11b-request-20261115/accessibility.log)
covers five expanded viewports and 55 axe states. The [generated deployment and
PWA checks](evidence/gjh-stage11b-request-20261115/publish-and-pwa.log) pass for
both layouts, offline reconnection and bag retention. The
[Python](evidence/gjh-stage11b-request-20261115/unit.log)
and [Node](evidence/gjh-stage11b-request-20261115/node.log) suites, the
generator, SSOT and clean Python-only build checks pass. Independent
regeneration with pinned Bun produced byte-identical bundles and manifest.
[Source hashes](evidence/gjh-stage11b-request-20261115/source-sha256.txt)
pin the checked runtime and relevant tests. Browser emulation and automated
accessibility checks do not certify physical devices or screen readers.

## Main-branch integration

The performance work was merged with main commit `372295c`, which added bounded
optional-theme loading and cancellation before a pending theme can commit. The
JavaScript bundles were regenerated from both changes, and the application
version was advanced to 1.1.55 so existing service workers can identify the
new build. The earlier measurements and source hashes above describe the
pre-merge snapshot; the [main integration budget](evidence/gjh-stage11b-main-merge-20261115/budget-report.json)
is the acceptance evidence for the combined runtime.

The combined build passed the [theme timeout, late-result and gamepad-cancel
cases](evidence/gjh-stage11b-main-merge-20261115/theme.log), [model pack fault
cases](evidence/gjh-stage11b-main-merge-20261115/asset-failures.log),
[generated-artifact and PWA checks](evidence/gjh-stage11b-main-merge-20261115/publish-and-pwa.log),
59 [Python](evidence/gjh-stage11b-main-merge-20261115/unit.log) and 48
[Node](evidence/gjh-stage11b-main-merge-20261115/node.log) tests. A clean
Python-only generated build includes the checked-in bundles and model pack.
The retained theme QA fixture explicitly targets the bundled entry point.

The combined runtime passed the unchanged budget in all five viewports:
40, 40, 40, 42 and 40 startup requests respectively; the largest decoded
resource total was 10,275,478 bytes and the highest non-cart draw count was
198. At 320 × 740 the combined result was 40 requests and 9,924,394 decoded
bytes. The [budget log](evidence/gjh-stage11b-main-merge-20261115/budget.log)
and [source hashes](evidence/gjh-stage11b-main-merge-20261115/source-sha256.txt)
record the final combined measurement and runtime.

## Independent main-runtime confirmation

The follow-up preserves the published `b1021decfcf472238690939e0cc62de29e098c86`
implementation and application 1.1.55 / build `64d329d4457e912a`; no alternative
bundling pipeline or production code is added. All 162 runtime files remain
byte-identical. Every one of the 19 packed model slices independently matches
its original individual GLB and the exact `372295c` Git object.

The [main-runtime receipt](evidence/gjh-startup-main-acceptance.json) records
fresh Chrome 157/ANGLE Metal checks: 59 Python tests, 48 Node tests, generation,
SSOT, and nine browser suites covering budget, eight pack fault cases, the three
actual-bundle theme regressions, generated project-prefix publication, standalone
and expanded PWA, Gallery, older demos and global PWA. The existing Bun version
and source/output fingerprints are checked; executable-binary hash pinning is
not claimed. The independently tested alternative was archived locally and is
not the source of this runtime's acceptance evidence.

| Viewport | Requests | Decoded bytes | Highest sampled non-cart calls | Compact Map checks |
| --- | ---: | ---: | ---: | --- |
| 320 × 740 | 40 | 9,924,394 | 158 | PASS |
| 390 × 844 | 40 | 9,924,394 | 159 | PASS |
| 768 × 1024 | 41 | 10,125,620 | 175 | N/A |
| 1440 × 900 | 42 | 10,275,478 | 197 | N/A |
| 844 × 390 | 40 | 9,924,394 | 198 | PASS |

All five retain the original 45-request, 10 MiB decoded-resource and 200-call
non-cart assertions, guide/list pause and 25 modal open/close cycles. The compact
Map assertions now use the actual Header Map and Close controls, preserving
bounds, hit testing, Run hiding/return and 44 px targets. Wide entries explicitly
mark these compact-only checks N/A. This repairs an obsolete selector that
silently skipped the compact branch; it does not require desktop Map to open
automatically after Guide Start. The different 768 px request sample is a fresh
Metal observation, not a promise of identical image scheduling on every backend.

The new eighth pack case holds the actual response while native WebGL is lost
and restored before initialization finishes. It verifies the returned pack body
hash, forbids early readiness, waits for actual rendered-frame validation, and
checks the native return action, active collision capsule, four loaded SKUs and
one pack request without individual-model fallback. The first draft incorrectly
used the temporary unavailable flag as a terminal failure; that rejected fixture
and diagnostic remain recorded. The final assertion waits for positive validated
readiness or an explicit terminal graphics status. Production recovery code and
ready flags are not modified.

The matched `372295c` 320 px baseline is 82 requests / 9,885,537 decoded bytes;
the confirmed current result is 40 / 9,924,394, a 38,857-byte increase. This is
request reduction, not a payload-size or FPS improvement claim. Physical-device,
Safari, real safe-area and assistive-technology acceptance and candidate brand
rights remain separate. Exact committed-head CI/Pages and normal public-response
verification are the final release gate for this test/documentation follow-up.
