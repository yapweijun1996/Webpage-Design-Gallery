# V11 compact seated mobile HUD

Release 1.1.26; baseline 99a9323. A CSS-only, portrait-width <=650px change addresses the observed seated close-up obstruction. The previous 95px stacked name/button panel covered shoes and the front seat edge. A two-column name/action bar measures 62px at the tested 320px and 390px widths, revealing more of the existing scene without moving the camera.

Text remains complete and can wrap; no fixed height, font reduction or ellipsis is used. The action remains at least 44px tall and 100px wide. Safe-area bottom positioning and the independent-demo disclaimer are unchanged. Landscape retains its existing left-side panel. Walking, cart, first-touch-anywhere movement, second-touch look, shopping and animation code are untouched.

## Evidence
Before advisor inspected the existing close-up and confirmed a useful visibility improvement. The 390px comparison uses one actual browser scene and camera state: temporarily replace the CSS with the pinned 99a9323 stylesheet, capture, then restore the candidate stylesheet and capture. This is a controlled stylesheet comparison, not two different camera views or an edited screenshot.

`tests/browser_gjh_seat_hud.py` covers 320x680, 390x680 and 844x390 simulated Chromium: intermediate Cancel and Standing labels, unclipped text, screen/disclaimer bounds, minimum target sizes, keyboard focus and Enter-to-stand, and restoration of the ordinary walking layout. The 844px panel remains 95px high in its original side location. Initial fixture execution started stepping before the guide close event restored scene focus, leaving the player paused at the kiosk. The fixture now explicitly waits for scene focus and verifies the nearby bench; no runtime logic or acceptance assertion was weakened.

Final advisor actually inspected six comparison/long-label/focus/landscape screenshots: shoes and seat edge are visible, text and focus ring remain complete, and the landscape layout is unchanged. No screenshot-level blocker remained.

[Before/after, long-label, focus and landscape screenshots with reports](evidence/v11-seat-hud/). This is scoped layout evidence, not a repeat of the eight-seat physics suite or a claim of physical-device, Safari or actual notch testing.

## Rollback
Revert this CSS slice and generated release metadata to 99a9323. No model or stored-state migration. A local backup and reverse-patch check are prepared before publication.

## 1.1.28 touch seat label

A rendered 390×844 touch baseline still displayed `Press F / tap Sit`, unlike the touch-specific product and kiosk actions. The seat branch now uses `Tap Sit` on coarse-pointer devices and preserves `Press F / tap Sit` for keyboard/mouse. The accessible name, event handlers, seated Cancel/Stand labels and layout are unchanged. Screenshot advisor reviewed the baseline and after images. Chromium simulated touch verified the button remains at least 44px high and tap sit/stand still works; desktop 1440×900 verified the keyboard label and F sitting. This is a small clarity fix, not a critical functionality failure or real-device certification. Rollback: revert this label/version commit and regenerate the gallery.
