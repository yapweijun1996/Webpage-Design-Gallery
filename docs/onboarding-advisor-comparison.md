# Shared onboarding: advisor comparison and fixes

## Reference and evidence boundary

The independent advisor inspected the owner's two original references, `GJH Virtual Mall Onboarding UI.png` and `GJH Virtual Mall Welcome Atrium.png`, alongside actual desktop, phone and in-scene tutorial screenshots. The comparison covers onboarding UI, not the reference's illustrated people, logos, photoreal architecture or unimplemented navigation features.

## Comparison

| Reference intent | Confirmed gap before this revision | Implemented result |
| --- | --- | --- |
| Visible language and input control | Passive mode label; language behind general settings | Always-visible labeled language/input selects, immediate localized bindings, saved choices; theme remains in Appearance |
| Show the guide next time | No automatic-welcome preference | Namespaced persisted checkbox and `shouldAutoShow`; V11 checks it before automatic welcome; manual Help works even when unchecked |
| Welcome → Learn controls → Ready | Welcome stage stayed static; HUD showed only control-tip progress | Shared stage overview with current/completed markers in welcome and HUD; distinct phase and tip labels; explicit ready state |
| Quickly understood controls | Text-only actions and generic tip | Shared authored SVG icons for movement/look/inspection; mouse arrows, touch and highlighted left/right stick diagrams, retaining text and exact bindings |
| Clear primary/secondary hierarchy | Generic control styles unintentionally outlined text/close actions | Scoped variant selectors restore icon/text buttons; Start and directory are the main pair, map is tertiary |
| Small-screen welcome remains approachable | Full control table competed with entry actions | Compact welcome with expandable Quick controls, visible language/input, main actions and preference; sticky close and internal scrolling remain |
| Tutorial remains beside the scene | Existing side placement already matched | Retained placement; Previous tip and Next preserve keyboard focus, including when Previous disappears at the first tip |

The 560px width limit, 24px desktop / 20px mobile padding, 16px radius, safe-area margins, natural height bound and 48px primary minimum remain. Tab retains native focus navigation. Illustrations are decorative and do not replace text labels. No blur, animation loop or renderer dependency was added.

## Verification

- Independent advisor re-review of fresh screenshots: no blocking remaining design/usability issue. A nonblocking suggestion to highlight the right stick was also implemented in the shared icon module.
- Shared component browser suite: five viewport/input combinations, six application profiles, localized mode/theme settings, preference persistence, stage completion, consecutive Enter, Previous focus fallback, Help return focus and gamepad select navigation passed.
- Actual V11 adapter: movement/camera/inspection and event-driven progress, modal isolation, gamepad Menu/Back/disconnect, disabled automatic welcome after refresh and manual replay passed using synthetic standard-controller snapshots.
- First-use suite: five sizes, map/directory focus, Escape/reopen, optional session storage and WASM/no-JavaScript fallback passed.
- Compact suite: seven sizes from 320×480 to 1440×900, internal reflow, close access, input isolation, focus ring and 44/48px targets passed.
- Gallery generation, 11 gallery unit tests, Gallery browser flows, 28 legacy demo browser cases, four no-JavaScript journeys and PWA lifecycle checks passed. Existing SSOT and final diff checks are recorded with this revision's evidence.

An initial browser navigation timed out waiting for the full load event under concurrent software WebGL runs. Targeted guide runners now accept the existing native Metal backend option and wait for DOM readiness followed by the unchanged actual mall/scene readiness assertions. No product assertion was removed or relaxed.

Physical controllers, physical touch devices, Safari and actual screen-reader sessions were not run. Semantic names, keyboard behavior and focus were checked in Chrome; this is not a full WCAG certification. The worktree contains other ongoing gallery and scene changes which are outside this comparison.
