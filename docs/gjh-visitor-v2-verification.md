# Visitor v2 local verification

## Implemented

- A physical product uses an exclusive reservation on instance 4 of its original SKU shelf. Animated transfer attaches its prop to RightHand. Return restores exactly the original instance matrices. A second reservation is refused. Pickup cancellation restores stock; return cancellation resumes holding; map teleport resets stock. Blur pauses an in-flight action through cancellation, while a completed held item stays held. Physical carrying is independent from the existing session-only demo bag.
- Sitting, cart use and elevator travel require the held product to be returned first. The physical action is offered only near a loaded shelf and on the ground floor.
- V2 uses world-space CCD for hands and an analytic two-bone solve with a forward knee pole for seated legs. Foot targets apply throughout sit/stand progress. V2 benches and fallback benches use 0.8 vertical scale; the seated avatar lowers by 0.13 m. Foot orientation stays flat. V1 furniture and poses keep their existing dimensions.
- Cart hands follow the authored handle's two grip positions. Wheels rotate by travelled distance / 0.07 m radius. This is visual rolling with the existing conservative cart collision controller, not independent caster rigid-body simulation.
- Geometry LOD switches beyond 11 m and returns inside 9 m. It remaps skin indices by bone name and reuses the current skeleton, mixer and customization materials. Load failure keeps high detail. LOD1 is fetched lazily and retains high geometry for returning to close view; it adds 372684 transfer bytes when activated and does not reduce peak geometry memory. This optimization targets rendered triangles, not a claim of lower memory. Mobile v2 DPR is capped at 1.25; the existing mobile shadow policy remains. The character is texture-free, so there are no character texture maps to compress.

## Evidence

`node --test tests/gjh-visitor-v2.test.mjs` in Blender-3D-Gallery: four passing tests, including both exports and customization. Both GLBs have zero glTF Validator errors/warnings. High: 577004 bytes / 13936 triangles; LOD1: 372684 bytes / 6257 triangles.

`python tests/browser_gjh_visitor_v2.py` uses actual exported assets and Chrome. It checks hand/foot residuals, actual deformed shoe vertices, exclusive reservation, exact matrix restoration, cancellation and LOD transitions with customization preserved. It also exercises reduced motion. The runner also clicks physical pickup/return controls at 390x844 and 1280x800. The runner expects a local HTTP server on port 18769 (or GJH_V2_URL) and the Playwright Python environment.

Observed full-detail contact residuals: hands 0.001813 m each, feet below 0.000001 m each. Actual minimum shoe vertex Y=0.029978 m with visual origin Y=0; the mall seated origin adds 0.015 m, placing the sole at approximately Y=0.045 m above the collision slab and on the rendered floor inlay. These contact targets and screenshots do not prove every body/outfit combination free of clipping.

A 24-frame isolated five-character render sample at 390x844, DPR 1.25, Chrome launched with SwiftShader flags on this macOS host: high 59860 visible triangles / 75 calls, low 26880 / 75 calls. Synchronous render+finish P50/P95 were 0.8/3.5 ms high and 0.5/1.9 ms low. This short isolated sample includes no mall world or physics and is not a phone FPS guarantee. Both versions retain the same visible customization and draw-call count. Triangle reduction is 55.1%; asset bytes decrease 35.4%.

The final runtime tests pass in normal and reduced-motion modes, including all ten seated-progress samples, distance-driven wheel rotation and interruption recovery. Actual pickup/return and actual approach/sit/stand pass at both 390x844 and 1280x800; console page errors are empty. The real mall mobile UI was exercised through walking to the Australia shelf, clicking Pick up product, observing held state, and clicking Return to shelf. The console reported no page errors. Screenshots are in `docs/evidence/visitor-v2/`.

## Limits and unrelated checks

Physical iPhone and Android hardware were unavailable. Real-device frame-time, thermal, memory and full-mall 1+4-visitor acceptance remain unverified. The mall currently has one controllable player; the five-character measurement is a dedicated render scenario, not new crowd gameplay.

The existing v1 character asset tests and gallery unit tests pass. The legacy `browser_gjh_seat.py` test initially timed out at the list-to-3D click with its 30 s action timeout; retrying the same assertions with a 90 s action timeout passed at 390x680 and 1440x900 (approach/sit/stand, movement lock, modal Escape, list/teleport exits and bag preservation). This retry changed only the harness timeout, not the application or assertions. `scripts/build_gallery.py --check` reports pre-existing stale generated gallery pages (index, company/design/compare/offline pages, version.json and sw.js). These belong to other dirty work and were not regenerated or overwritten. No commit, deployment or unrelated reset was performed.

## Release integration

The release is built from the latest remote main in an isolated worktree. It preserves the live interaction-mode and wayfinding changes and excludes the unrelated local onboarding/amenities redesign. Visitor v2 is the default; `?visitor=v1` retains the original character and ground-floor layout. The source GLBs are pinned in `assets/visitor-v2-source.json`. Generated gallery pages and version hashes are regenerated only in this clean release worktree.
