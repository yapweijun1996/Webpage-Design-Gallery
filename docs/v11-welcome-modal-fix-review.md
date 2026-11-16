# V11 welcome modal fix review

## Scope

Bounded fix for the V11 welcome modal at desktop and short mobile/landscape viewports. The shared onboarding DOM and lifecycle remain unchanged; the V11 integration owns the contextual navigation footer presentation.

## DOM/CSS root cause evidence

- `assets/onboarding/onboarding.js` renders the preference checkbox as the final onboarding control, then appends the host-supplied `footer` after it.
- `demos/corporate/gjh/v11/assets/ui.js` supplies `#context-navigation-guide` as that footer and moves the shared contextual navigation into it while the guide is open.
- `demos/corporate/gjh/v11/style.css` previously made `.ob-dialog > .context-navigation-footer` `position: sticky` with a negative bottom offset. Because the native dialog itself is the scroll container, the footer painted over the final preference row instead of reserving space in the scroll flow.
- The shared dialog already has bounded `dvh` height and `overflow:auto`; the missing piece was preventing the V11 footer from overlaying content inside that scroll container.
- V11 applied `--ob-action: var(--green)` and `--ob-on-action: var(--paper)` after the shared onboarding theme aliases. That kept dark onboarding primary controls on the dark green brand pair, which is not the design-system dark action pair.

## Fix

- Keep the V11 navigation footer in normal flow with safe-area padding, so the checkbox and CTAs can be reached by scrolling and the nav cannot cover them.
- Use modal text color for the preference label.
- Add canonical `color-3d-dark-action` and `color-3d-dark-on-action` tokens and apply them only to V11 dark onboarding surfaces.

## Browser evidence

VM Chrome (software WebGL), dark system theme, at 1440×900, 390×664, 320×568 and 844×390. Before CSS was served from pinned 2f70d69 without changing application JavaScript. After screenshots and DOM records are in `docs/screenshots/v11-welcome-modal-fix/`.

At 390×664, before footer started at y=531.84 while the preference occupied y=514.94–558.94. After the footer starts at y=574.94. This confirms overlap rather than assuming z-index failure from a screenshot. Short screens intentionally scroll within the bounded native dialog.

All four after cases verified checkbox scroll-into-view and actual hit target, preference toggle, Close, manual reopen, retained preference, and Start exploring. No page errors. SSOT check and 11 gallery unit tests passed. Light-theme screenshot inspection was performed before dark-theme captures. Physical iPhone/Safari and browser-toolbar transitions are not claimed tested.

## Pixel review and follow-up

Independent screenshot advisor confirmed the overlap fix but found the nested footer still used light-page colors inside dark onboarding. This was repaired with scoped onboarding theme aliases and a three-column mobile navigation grid; all navigation destinations and disabled explanatory text are preserved. Four viewport interaction checks were rerun after this correction.
