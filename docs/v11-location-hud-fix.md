# V11 zone HUD ReferenceError repair

Release 1.1.29. Live store-entry reproduction raised `ReferenceError: locationName is not defined` from `ui.update`, reached through `updateHUD` and `tick`. Commit `2b3c6f9` removed the DOM binding while preserving the location element and update use. The failure occurs on a zone change, not at initial courtyard loading. Restore the single DOM reference; do not suppress errors or remove HUD updates.

`tests/browser_gjh_location_hud.py` verifies entering all three stores and returning to the courtyard, correct location text and map aria-current, real requestAnimationFrame progress and zero uncaught page errors at simulated 390×844 touch and 1440×900 desktop. Earlier narrow checks did not cover store-entry zone changes; the first reproduction attempt also waited only for dialog closure, not its asynchronous scene-focus/resume handler, so it did not move and was not evidence of absence. The corrected reproduction waits for scene focus and crosses the zone boundary.

No layout, commerce or interaction behavior redesign. Screenshot advisor checks the existing mobile/desktop HUD; no real-device certification. Gallery generation, SSOT and diff checks accompany release. Rollback is the saved parent revision, though reverting this fix would restore the known error; prefer a forward repair.
