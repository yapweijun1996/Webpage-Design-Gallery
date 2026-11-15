# V11 stage 11b — startup budget work

Status: **local startup-budget acceptance passed** in the existing default-layout
laboratory profile. All five measured viewports meet the unchanged 45-request,
10 MiB decoded-resource and 200 non-cart draw-call limits. Measurements do not
certify production speed, compressed wire bytes, physical devices, Safari or
accessibility technology. See the current request-reduction results below.

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
- The default V2 visitor no longer requests the three presentation modules used
  only by the explicitly selected V1 visitor. V1 still loads them on demand.

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
