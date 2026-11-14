# V11 mode state review

- `assets/modes.js` defines the seven derived modes; `shelf` remains reserved and unreachable through `request()`.
- Derivation priority: product dialog, bag, map/help/directory panel, seated, cart, exploration.
- `request()` preserves the transition table contract and rejects illegal moves without changing state.
- `sync()` treats observed UI/player state as authoritative, increments `illegalCount()` for a rejected edge, and keeps the reason in bounded history.
- The v11 UI publishes current dialog/panel signals; `script.js` derives state during HUD updates and UI dialog/panel changes.
- `document.body.dataset.mode` mirrors mode; `window.__mall.state.mode` is a read-only snapshot field.
- No player movement, CSS, visual design, focus policy, or bottom navigation changes are intended.
- Verification: `node --test tests/gjh_modes.test.mjs` (4 tests) and `tests/browser_gjh_modes.mjs` at 390x844 (menu while the first-run guide is open, explore, inspect, shop, seated, cart, explore; List view counts as menu).
- Pixel check against the base commit 091ec7f at 390x844 with reduced motion: explore and product-dialog screenshots are byte-identical (sha256, stable over two runs). Seated screenshot comparison was not run.
- Not run: physical devices, real safe-area insets, WebGL context loss, device FPS.
- Rollback: revert the release commit and rebuild generated files; no storage or data migration.
