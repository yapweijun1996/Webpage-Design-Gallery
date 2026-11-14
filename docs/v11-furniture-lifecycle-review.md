# Optional furniture lifecycle repair

Application 1.1.9 fixes cleanup after optional bench/planter loading has already fallen back. The eight-second loading deadline, models, asset placement, collisions, materials on successful loads and visual design are unchanged. No new asset rights are introduced.

## Reproduction and correction

The previous loader at main `d68e716afe8947105e782b4c170a67922b6e699c` returned a fallback after its timeout but did not release resources when GLTF parsing resolved later. A real bench GLB with parser resolution delayed to 9.5 seconds reproduced five geometries and five materials with zero disposal events after the deadline.

The repaired loader marks a timed-out load as abandoned. If its parsed scene arrives later, or primitive validation rejects the parsed scene, unique geometries and materials are disposed once. Valid loaded geometry remains owned by the existing instancing pipeline.

## Verification

`tests/browser_gjh_furniture_disposal.py` wraps the real local GLTFLoader at its resolution boundary in the test browser. It does not substitute a fake loaded model. Delayed parsing, invalid position attributes and normal loading are checked independently. Both failure modes release all five geometry/material instances, retain zero accepted primitives and permit normal mall walking; the normal path releases none prematurely. The before-fix assertion failure is retained in local evidence. An optional `--baseline-source` path makes the reproduction repeatable.

39 unit tests, SSOT and generated-output checks, existing real/fallback furnishings tests, five-viewport resource/lifecycle budgets, the complete V11 movement/doors/inspection/failure/reduced-motion suite and PWA offline/update tests passed. Source GLB bytes did not change.

These disposal-event observations are not a GPU-driver heap measurement. Physical phones, Safari and screen readers remain unverified; the rest of task.md and branded-model rights are not declared complete.

Rollback is a normal revert followed by the established Pages workflow; prior main is `d68e716afe8947105e782b4c170a67922b6e699c`.
