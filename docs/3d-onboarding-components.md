# Shared 3D onboarding components

## Scope and ownership

`assets/onboarding/` is a framework-neutral, dependency-free UI library for Virtual Mall, 3D Gallery, Hotel, Parking, Product Showroom and other applications. Virtual Mall V11 is the first production integration in this repository. The other profiles in `design-system/onboarding/` are integration sandboxes, not completed 3D applications.

The library owns welcome presentation, keyboard keys, capability-specific control rows, the help entry, focus management, localized settings, tutorial tips and progress. The application owns movement/physics, camera, inspection, directory data, scene pause and when a tutorial action has actually happened. Imports point toward the shared library; the library never imports mall code or a 3D engine.

## Files and components

| Module | Responsibility |
| --- | --- |
| `index.js` | Public exports for consumers |
| `icons.js` | Shared original line icons and input-specific gesture diagrams |
| `components.js` | `keyboardKey`, `controlList`, `stepProgress`, `helpButton` and safe text-based DOM builders |
| `onboarding.js` | Welcome dialog, settings, tutorial state, lifecycle and focus |
| `locales.js` | English and Simplified Chinese component text |
| `profiles.js` | Six example app configurations; replace example bindings with actual app capabilities |
| `gamepad.js` | Standard-mapping controller snapshots and dead-zone conversion; no scheduler |
| `onboarding.tokens.css` | Aliases to canonical Design System tokens |
| `onboarding.css` | Scoped component styles and responsive layout |

## Layout and tokens

Desktop: width `min(560px, viewport − safe margins)`, natural height bounded by `100dvh − safe margins`, 24px padding, 16px radius. Mobile: 20px padding and bottom sheet placement. The larger safe-area inset and 16px minimum margin are respected symmetrically. Short viewports scroll internally; the close header stays sticky. Primary controls are at least 48px high; other interactive controls are at least 44px. Long content and open settings may require scrolling.

`design-system/tokens.json` remains authoritative for colors, typography, spacing, radii, duration, dimensions and layers. Run `python3 scripts/build_design_system.py` after editing it. The component aliases include the requested `--ob-radius`, `--ob-space-1/2/3/4/6`, `--ob-control-min`, `--ob-modal-max`, `--ob-duration-fast/normal`, and `--ob-z-dialog`. The native dialog top layer supplies modal stacking; the z-index token is also available to adapters.

Set component-local `--ob-action`, `--ob-on-action`, `--ob-font` and related aliases for application branding. Light, Dark and System appearance are independent of the scene. The dark surface uses semantic tokens; no per-component color copies are maintained. The references supplied by the owner guide hierarchy and the welcome → learn controls → ready flow. Their illustrated people, logos and architecture are not represented as implemented assets.

## Integration

Load `assets/tokens.css` followed by `assets/onboarding/onboarding.css`. Use relative URLs suitable for the application's deployment prefix.

```js
import {createOnboarding, createExperienceProfile} from './assets/onboarding/index.js';

const ui = createOnboarding({
  ...createExperienceProfile('hotel'),
  id: 'hotel-guide',
  storageKey: 'hotel',
  scene: document.querySelector('canvas'),
  modes: ['keyboard', 'touch'],
  actions: ['list'],
  canOpen: () => !application.hasOtherModal(),
  onOpen: () => application.pause(),
  onClose: () => application.resume(),
  onAction: action => {
    if (action === 'list') application.openDirectory();
  },
});
ui.setVisible(true);
ui.openWelcome();
// Report successful changes, not merely a key press against a wall.
application.onMoved(() => ui.report('move'));
application.onCameraChanged(() => ui.report('look'));
application.onInspected(() => ui.report('inspect'));
// Hide tips under other overlays without losing tutorial progress.
application.onOtherOverlay(value => ui.setSuspended(value));
// Call once when the application unmounts.
application.onDestroy(() => ui.destroy());
```

`appName`, localized `copy`, localized `steps` and each supported mode's bindings are configuration. `actions` controls domain callbacks (`map`, `list`). Hosts may supply application-specific labels via `copy` and bindings; profile examples are starting points, not claims about a host's control support. Every declared mode requires English and Chinese step text. Missing required copy fails at construction rather than displaying incorrect instructions.

`openWelcome()` returns false when hidden, already open or `canOpen()` rejects it. Opening focuses the title. Tab/Shift+Tab wrap among visible enabled controls. Dismissal returns focus to the invoking control, with the scene as fallback; Start returns focus to the scene. Native Escape closes the dismissible dialog. Domain-specific focus destinations (directory title, map store) remain the host's responsibility. `setVisible(false)` closes with `view-change`; `destroy()` removes listeners and DOM. Preference storage is optional and namespaced per application; failures fall back to memory.

## Tutorial and input contract

Start dismisses the welcome modal and begins lightweight tips. The tutorial is an `aside`, not a modal; it does not make the scene inert or move focus when tips advance. Its non-interactive area lets scene pointers pass through. Buttons retain their own hit areas. `report(id)` advances the current matching tip after the host observes an action. Next tip permits reading the next instruction without claiming the action was performed; progress labels say **Tip**, not tasks completed. Ready ends the three-tip sequence. Skip and Help are always available. H or ? opens Help when the scene/body has focus, excluding editable controls and modifiers. Tab keeps its native focus meaning.

Auto input follows initial pointer capability, actual scene touch/keyboard input and active gamepad snapshots. Users can explicitly choose a mode in settings. Desktop/mobile viewport controls layout, not input capability. Virtual Mall uses its existing floating touch movement gesture (one finger moves, a second looks), not an invented fixed joystick/swipe mapping.

V11 standard gamepad adapter: left stick moves, right stick changes camera, A inspects a nearby display, left-stick press runs, Menu opens Help. D-pad/stick navigates visible focusable panel controls; A activates, B dismisses a native dialog. Selects can cycle choices. Other applications call `handleGamepad(pad, navigationRoot)` with their own active directory/panel and poll only in their existing application loop. Unknown non-standard controller mappings are not silently guessed. Disconnect resets the input on the next host frame. Native OS controller behavior and physical controllers still require device validation.

## Accessibility and performance

Welcome uses a native named/described dialog, semantic heading/list/key elements, visible focus outlines and 44/48px targets. Each icon-only button has a localized name. Settings use visible labels. Tip progress has a labeled native progress element and polite announcements only at transitions. `lang` changes on the components; this does not translate unrelated host content. Reduced Motion disables component transitions and animations. The UI owns no frame loop, interval, WebGL resources or blur layer. System-theme and pointer changes use events; the host supplies gamepad snapshots. This reduces integration work but is not a measured frame-rate guarantee.

## Validation and rollback

Run `tests/browser_gjh_onboarding.py` for actual gamepad movement/camera/inspection and event-driven tip progression (synthetic standard-controller snapshots). Run `tests/browser_onboarding.py` for all six configurations, layout, settings, focus, input modes, tutorial progression, lifecycle and absence of a component-owned frame loop. Run `tests/browser_gjh_guide.py` and `tests/browser_gjh_compact_guide.py` for the actual mall adapter. The repository's Gallery/PWA checks cover publication paths and generated cache identity. No-JavaScript and failed WebGL retain the existing directory.

Actual screen-reader sessions, physical touch/controller testing and Safari remain distinct from automated semantic and keyboard verification. Restore the prior V11 adapter and remove its shared imports for rollback, then regenerate the gallery. Do not delete unrelated gallery preference or design work.

Local verification passed: shared component suite across five viewport/input cases and all six profiles; seven-size compact layout/input-isolation suite; five-size mall guide/session/fallback suite; full V11 movement/collision/doors/inspection suite on native ANGLE Metal; Gallery unit/browser checks, 28 legacy demo browser cases, PWA lifecycle checks and the existing SSOT gate. These checks cover the features named by their suites, not complete accessibility certification or physical controller support. The independent advisor review found a HUD focus-loss issue on Next; matching-action focus restoration was implemented and the continuous-Enter/help-return regression passed. Opening a compact map now restores its actual trigger on Escape and refreshes sign occlusion in one paused scene frame.

## Advisor refinement

See [reference comparison and verification](onboarding-advisor-comparison.md). Language and input selectors are directly visible; Appearance controls the theme. The persisted `shouldAutoShow` getter gates only automatic entry, leaving manual Help available. V11 still applies its once-per-tab session rule when the preference is enabled. Mobile starts with Quick controls collapsed; its accessible disclosure can expand the complete input guide. The shared stage overview distinguishes Welcome, Learn controls and Ready, while per-control tip progress remains separately labeled. Previous/Next and controller select changes preserve focus. Text/button variants have dedicated selectors so host/base control styles cannot turn them into unintended outlined buttons. Short landscape tutorial cards allow internal scrolling; the open scene outside the card stays interactive.

## Shared scene-object action dialog

`createActionDialog({id, scene, getPreferences, onOpen, onClose})` is exported from the shared entry point. Call `open({title, description, actions})`, with each action providing `id`, localized `label`, and `onSelect`. Peer actions have equal weight by default; set `primary: true` only for an intentional primary action. Optional localized `title` and `description` plus `image` support compact visual choices; the accessible name includes the visible title and complete `label` and decorative thumbnails have empty alt text. Each open resets internal scrolling. Copy accepts a string or an English/zh-CN dictionary. `getPreferences` supplies `locale` and `resolvedTheme` from the existing preference authority. The native dialog owns focus trapping, Escape, accessible labels and focus restoration. Action callbacks run after native close. Hosts derive suspension from `dialog.open`, close with `view-change` or `fallback` when changing surfaces, and call `destroy()` on teardown. See [mall integration](gjh-amenities-review.md).
