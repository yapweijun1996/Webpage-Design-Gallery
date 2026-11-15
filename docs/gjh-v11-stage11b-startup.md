# V11 stage 11b — startup budget work

Status: **in progress**. The 10 MiB decoded-resource assertion now passes in the
measured default-layout laboratory profile; the existing 45-request assertion
still fails, so the budget suite stops before its subsequent checks. The limits
have not been raised or removed. Measurements do not certify production speed,
compressed wire bytes, physical devices, Safari or accessibility technology.

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
