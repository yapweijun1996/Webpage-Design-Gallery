# Mall camera clearance

## Defect and correction

The previous spring arm tested a centre ray and clamped its boom to 0.18 m after obstruction. Approaching the service desk from behind put the camera inside the visitor's head. Benches could also enter the near plane because its edges were not covered by the centre ray. The previous solver is reproduced from commit `ba6d8d0` with `tests/browser_gjh_camera.py --baseline`; the measured failing distance was 0.18 m.

The player now casts a sphere large enough to enclose its near-plane corners, excluding the visitor's own rigid body/capsule. It first preserves the requested bearing. If the boom has less than 2 m of clearance, it tries bounded 1.1/2.2 m lifts over furniture. A second cast constrains the interpolated position, so an obstruction cannot be crossed during smoothing. Inward recovery is immediate; open-space motion retains smoothing. Reduced Motion and teleport use an immediate safe solution. In a truly enclosed corner where no third-person view fits, only the local visitor presentation is hidden with hysteresis; physical collision and ownership remain unchanged. Open clearance restores the avatar. Authoritative bench dimensions also provide camera-only bounds for the visible back and arms; they do not enlarge the seat-pan physics collider or alter seating paths. Shelf focus retains its separate camera and graphics interruption lifecycle.

The shared onboarding and facility dialogs participate in the released mode state machine through native dialog state. Their assets are copied into generated publication output while remaining outside gallery-shell precaching. The existing contextual navigation footer is retained in the shared welcome surface.

## Render budget

The combined upstream interior pilot and facilities initially produced 220 calls in the released visitor view, exceeding the existing 200-call gate. The gate was retained. Static opaque facilities now share one batch with original linear colour, roughness and metalness carried as vertex attributes; glass remains separate. The four showcase products extend the existing product instance batches, sharing geometry/textures and avoiding duplicate draws. Shelf stock/reservation indices retain their original nine shelf placements. Original GLB bytes and material parameters are preserved. No new render loop or dependency is added.

## Checks

`tests/browser_gjh_camera.py` checks the original and released visitor on desktop plus released visitor on mobile with Reduced Motion. It measures camera distance independently, checks sphere separation from authored desk/showcase/bench bounds, orbits by benches, and walks one continuous loop from service desk to showcase to ceiling sign and back. All three facilities open and close along this loop. Each case samples 178 positions. Screenshots and numeric results are in `docs/screenshots/mall-camera` and `docs/evidence/mall-camera.json`.

The legacy V11 suite names `visitor=v1` explicitly; released v2 retains separate camera, physical-product and mode coverage. Its map dismissal assertion checks the actual map-summary trigger used to open the panel. Mode fixtures walk around the current kiosk footprint rather than through its relocated collider.

References: [Rapier shape casts](https://rapier.rs/javascript3d/classes/World.html#castShape), [Three.js material hooks](https://threejs.org/docs/pages/Material.html#onBeforeCompile).

Validation below records actual completed checks; physical-device and screen-reader sessions are outside these automated scenarios.

Final targeted checks passed: 178 samples per visitor/viewport case, continuous facility loop, bench-front and rear-aisle orbit, independent clearance checks, visible avatar recovery and unchanged 200-call guard. Shared onboarding, actual mall gamepad/input isolation, all three released mode lifecycle cases (81/42/42 snapshots), 11 Gallery unit tests, Gallery browser journeys, 28 legacy demo cases, PWA lifecycle/installability and the SSOT gate passed. Native built-in-browser walking reached the desk, showcase and sign, then demonstrated the rear desk and bench orbit. Physical controllers, Safari and screen-reader sessions remain unverified.
