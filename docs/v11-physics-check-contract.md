# V11 resumed-physics verification contract

Scope: project-specific verification correction for the current target-guidance
task at `a88fd1ccb7430e124732373ec40476085c2364f5`. No runtime change or release
approval. See [bounded evidence](evidence/v11-target-guidance-physics.json).

- **Bug pattern / context:** Context Navigation already separated exact modal
  restoration from resumed vertical grounding. Shelf also separated synchronous
  restore from keyboard Y settling, but its held-touch regression still required
  bit equality in XZ after physics resumed. The current retained stale-move-end
  failure was X `-11.192170143127441` to `-11.192169189453125`: absolute delta
  `9.5367431640625e-7 m`, one Float32 ULP. The parent's corrected diagnostic
  metadata identifies `-11.192327499389648` to `-11.192328453063965` as an
  earlier Shelf Cart coordinate example with the same absolute one-ULP delta,
  rather than the current stale-touch failure. Both sources remain distinct;
  neither historical failure is relabelled PASS.
- **Cause boundary:** The test conflated frozen state restoration with a live
  collision/grounding tick. `player.js` calls `computeColliderMovement` even
  with zero requested horizontal input. Player, character, contact and world
  owners are byte-identical to the pinned base. The parent's paired diagnostic
  passed four trials per revision (idle control and stale old finger, twice):
  all eight exact synchronous restores passed, X/Z/yaw/pitch deltas and forced
  idle-step horizontal deltas were zero, and both revisions settled vertically
  by about `8.88e-5..9.65e-5 m`. It did **not** reproduce the historical X ULP
  failure or establish its exact numerical path; it corroborates the boundary.
- **Failed approach:** Bit equality across resumed physics, followed by an
  isolated passing retry, leaves a required gate sensitive to physics rounding.
  A retry is historical evidence, not the contract fix.
- **Correct fix:** Only the two post-resume loops in `held_touch_paths` use
  finite X/Z values with absolute `1e-5 m` (10 micrometres) per-axis bounds,
  after 120 ms live time and after explicit `__mall.step(120)`. Both compare to
  the **same original stopped snapshot**; no refreshed reference or accumulated
  allowance. Yaw/pitch remain exact. Report no-residual-control-movement within
  bound, never bit-exact position after resumed physics. A walking frame is
  about `0.044 m` at 60 Hz, over 4,000 times the bound.
- **Strict regression retained:** Real CDP trusted touch must move more than
  `0.1 m` before entry and hold actual capture. Shelf must release capture and
  reset the floating joystick/thumb. Paused isolation and synchronous close
  player/camera/posture restoration remain exact through `retained()`.
  Old-finger move/end and native trusted cancel still run; capture/release,
  visible focus, other fixtures and all production owners are unchanged.
- **Verification:** The complete existing 12-viewport Shelf suite is the gate;
  its returned held-touch rows log raw stopped/afterLive/afterStep coordinates,
  angles, frame counts, deltas and the explicit bound. Exact commands, exits,
  measured maxima, final test hash and unchanged runtime proof are in the
  bounded evidence. Raw logs remain under `/private/tmp/`.
- **Detect next time:** Capture the original stopped state and synchronous
  close event before allowing any live tick. Record elapsed frames and raw
  deltas. Separate trusted-input reset failures from idle collision correction
  using a paired pinned/current idle control. Any nonfinite XZ, XZ delta over
  `1e-5 m`, or angular change fails; investigate rather than widening a global
  helper or repeatedly retrying. Keep paused/exact restoration failures strict.
- **Knowledge decision / do not repeat:** The prior local skill search found no
  specific post-resume/Float32/physics-tolerance procedure. This belongs in
  project docs, not a global skill. Do not change runtime physics to satisfy a
  test, relax `retained()`, use per-frame accumulating tolerance, or infer
  deterministic physics, physical-device or device-FPS certification.

Reproduce the corrected gate from the repository root:

```sh
GALLERY_CHROME='/Applications/Google Chrome.app/Contents/MacOS/Google Chrome' GALLERY_WEBGL_BACKEND=metal /private/tmp/gallery-task-qa-venv/bin/python tests/browser_gjh_shelf_focus.py --axe /private/tmp/gallery-a11y-tools/package/axe.min.js --output /private/tmp/gallery-target-physics-fix/shelf
```

The parent's diagnostic command was
`/private/tmp/gallery-task-qa-venv/bin/python /private/tmp/gallery-target-guidance-release/physics-probe.py`
(exit 0, parent-run); its report/log/script hashes are recorded separately.
