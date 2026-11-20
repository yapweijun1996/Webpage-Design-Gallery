# GJH v11 session summary (2026-11-19 to 2026-11-20)

Owner brief: no lag on phone, tablet and PC; better lighting, layouts, interactions, characters, physics, a mall tram, and fewer visual bugs. Work was done by Codex workers (GPT 6.2 Sol and Astra) in parallel git worktrees, each verified by the manager in headed Chrome before pushing to main.

## Measured end state (real Chrome, Apple Silicon, quiet machine)

| Check | Result |
| --- | --- |
| Lap probe phone Low 393x700 | 20/20 stops, all within 220k triangles and 70 draws, 30 FPS |
| Lap probe Balanced 1920x893 | 20/20 stops, within 300k and 90 draws, 60 FPS |
| Lap probe Detailed 1920x893 | 20/20 stops, within 420k and 110 draws |
| Early enter (press 'Enter 3D mall now' at once, then walk 7 zones) | 0 frames of 50 ms or more on Low and Balanced; Detailed 0 in most runs, occasional single frames under heavy machine load |
| Shop interactions (`docs/verify_interactions.py`) | 65/65 reachable and triggered |
| Upper level (`docs/verify_upper_level.py`, 390x844 touch) | lift round trips, objective and 20/20 points of interest |
| Tram (`docs/verify_tram.py`) | boards at the south entrance, 17 captions in order, worst frame 17.8 ms |
| Physics props (`docs/verify_physics_props.py`) | can drops and sleeps, ball and basket pushed, physics 0.1-0.3 ms |
| Lighting (`scripts/lighting_score.py`) | atrium and MILI within the concept tolerance; a few shops slightly outside (see `task.md`) |

## What changed, by lane

- **Performance**: product LOD and compaction (MILI 992k to 291k triangles at Balanced), frustum-packed batches, merged draws, per-tier budgets, dynamic resolution then tier downgrade, phone 30 FPS cap, cap only at 100 Hz or above, early-enter smoothness (background warm, sliced uploads), Low-tier stock culling.
- **Lighting**: warm theme, three-zone IBL, fewer per-pixel lights (shader programs 196 to about 90), baked AO planes, ivory marble with sun patches, skylight, cove glow, per-shop colour temperature, avatar fill and rim light, scoring script against the concept image.
- **Movement and physics**: walk 3.4 m/s, run 5.2 m/s (phone joystick 3.1 / 4.5), one physics step per tick, cart passes shop doors, droppable can, ball and basket.
- **Shops**: one layout JSON for 17 shops with validators, capsule route sweep, layout audit and fixes, 65 interactions with a shared state machine, 11 Tripo props mounted.
- **Upper level**: floor selector, lift hint and objective, camera clear of foliage, finished lift shaft faces, aligned brand panels, directory sign facing the exit, lounge corner.
- **Tram**: grey-box route report, ride MVP, Blender carriage, default on.
- **Character**: fill and rim light, hair crack fix, face redraw for the player.
- **Probes and tests**: lap probe per device class, video probe with flicker heat-maps, verification scripts, lighting baseline.
- **PWA**: network fallback on cache miss, atomic verified update, reload-once guard, recovery card, shared by all demos through the generator template.

## Lessons recorded

1. Run the mall in headed Chrome after every merge: two start-up failures (a bad bundle import path, a changed layout shape) were caught only by a browser.
2. Another session pushes to the same main: merge `origin/main` before every push, take its content as truth for files it owns, never use `git checkout --theirs` on source conflicts.
3. Manual `__mall.step()` loops can blank the canvas; use the `?test=1` hooks (`testWalkTo`, `testPress`) that drive the real loop.
4. Machine load from other sessions makes FPS numbers unreliable; judge by slow-frame counts, budgets and screenshots.
5. Score lighting numerically against the concept image, but also look at the screenshot: a pass can match the numbers and still look wrong.
