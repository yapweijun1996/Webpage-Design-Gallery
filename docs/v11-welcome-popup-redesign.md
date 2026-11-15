# V11 welcome popup redesign

Historical first iteration. The current implementation and layout contract are documented in [Shared 3D onboarding components](3d-onboarding-components.md); that library supersedes the standalone 500px popup below.

The welcome dialog now uses a 500px maximum width, a lighter green backdrop, a low-emphasis close icon with a 44px target, semantic keyboard keycaps, and a clear action hierarchy: Start exploring, Choose a store, then the directory text entry. Shortened introductory and footer copy reduces first-use reading. Detailed running controls remain in How to explore.

The existing native dialog, input-capability selection, scene pause, focus restoration, map/directory navigation, optional session memory and fallback logic are retained. Only the V11 HTML/CSS authoring sources changed; the gallery generator refreshed its cache fingerprints and generated pages.

## Verification

- Generator consistency, diff whitespace checks and 11 gallery unit tests passed.
- First-use guide browser suite passed all five viewports, keyboard wrapping, pause, map/directory focus, Escape/reopen, session memory, storage unavailable and WASM/no-JavaScript fallback.
- Compact-guide suite passed seven sizes from 320×480 through 1440×900, including touch isolation, sticky close access and reflow at 320px height.
- Gallery browser suite passed desktop, tablet and mobile flows; legacy demo suite passed 28 browser cases and four no-JavaScript journeys.
- PWA lifecycle suite passed manifest/installability, offline launch, cache identity, update/activation and multi-tab consent checks.
- Independent advisor reviewed actual desktop/tablet/mobile screenshots and found no blocking visual concern. The built-in browser displayed the redesigned dialog at 829×826; a separate browser capture measured it at 500×494px.

Evidence is local macOS Chrome, with SwiftShader for automated mall checks. Physical touch devices, Safari and screen-reader sessions were not tested. Existing unrelated untracked `ui/` content was preserved. Test-created changes to unrelated gallery/demo preview images were restored.
