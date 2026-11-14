# V11 anywhere-origin touch movement

Release 1.1.19. Baseline: 4e846d4. User requested movement without precisely finding the old small bottom-left circle.

## Behavior
- First touch on the open 3D canvas starts movement at its actual origin, with an 8px deadzone. A second touch looks; a third is ignored while both roles are occupied.
- Roles do not change when the other finger lifts. Movement stops on release, cancel, lost capture, resize, hidden document or blur. HUD and dialogs retain their own actions.
- The floating visual is 76px and clamped inside the canvas with safe-area offsets. Its visual adjustment does not change the gesture's real origin. The idle hint returns after release.
- Touch guidance explains both roles. Mouse drag and keyboard movement remain supported. No asset or unofficial-brand disclosure changes.

## Evidence and review
Before review examined the owner's actual iPhone screenshot and existing source; after review inspected all four images in [evidence](evidence/v11-floating-stick/). Independent UI advisor found no blocking visual issue in these samples. Screenshots do not prove all possible overlapping positions or actual iPhone ergonomics.

`tests/browser_gjh_floating_stick.py`: Chromium CDP touch at 390x680 and 844x390 passed left/centre/right origins, stationary deadzone, two roles, ignored third touch, independent release, cancel/lost capture/resize reset, Run and modal isolation. `tests/browser_gjh_floating_desktop.py`: mouse drag/release and keyboard movement/turn/release passed at 1440x900. No unrelated full suite rerun.

Initial test attempts exposed harness event-delivery races and incorrect CDP touchEnd payloads. The corrected harness awaits delivered frames, sends the ended touch to touchEnd, and observes resize reset rather than relying on 100ms. No runtime changes were made to hide these test failures. Position checks allow 0.00001m ground-rounding drift, not movement; yaw remains exact when expected stationary.

Physical iPhone/Safari, OS edge gestures, real hardware safe-area behavior and performance remain unverified. These are simulated viewports, not device certification.

## PWA scope
KB `pwa:product-standard` 1.0.1 was read. Existing gallery update discovery requires explicit user acceptance and verified worker/version before reload. V11 is an independent network-only demo and has no dedicated update prompt in this release. This touch change does not add offline GLBs or silent reload.

## Rollback
Baseline backup branch `backup/pre-floating-stick-1.1.19`. Before pushing, verify reverse application of the staged patch; revert the release commit and rebuild generated outputs if rollback is needed. No data migration.
