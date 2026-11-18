# GJH v11 mall HUD

The HUD uses the existing GJH deep green, brass and cream tokens with SVGs from the mall icon registry. The header sits above the scene, Objectives and Tools occupy its upper corners, and the bottom context slot shares the movement-control area. Tools contains the full disclosure, Help, language, graphics quality, cart, theme, mini-map and Performance.

## Layout and interaction

- The header has a 52 CSS px row at the four review viewport sizes when the browser supplies no top safe-area inset. The row absorbs up to 8 CSS px of inset. Larger system insets extend the occupied height by the excess so controls retain a 44 CSS px touch target below the notch. Map, Bag and Store Directory use icons and accessible names below the registered 1000 CSS px desktop breakpoint. The header fits below 360 CSS px through location truncation and compact icons. The location pill and the separate Map button both open the same map and receive focus back when it closes.
- The context queue gives held-product copy first priority, followed by the current interaction, a nearby store and the next unfinished objective. The slot is one row. Nearby and objective hints use one line. Long item and interaction copy clips after two lines while the full copy remains available to assistive technology. The slot sits above the thumb controls in portrait and alongside Run at short landscape heights. Its largest default action determines a 56 CSS px row plus the border.
- The existing inspect and physical pickup handlers own their actions and availability. In reach of a physical shelf, the primary circle offers pickup or return and **More actions** exposes Inspect. F still uses the existing scene interaction. The joystick is a visual overlay on the canvas input. Its Move label disappears after the first accepted joystick touch. The camera job can append controls to `#camera-tools` inside `#mall-tools-content`. Camera buttons inherit the 56 CSS px control kit. The available visitor has no dedicated Jump control.
- The tracker counts three distinct available store interiors, one successful product detail opening, and one actual increase in a demo bag item's quantity. Map arrival is outside the store interior. Items already in the bag when the page opens do not award progress. Progress resets on reload and survives switching to the directory within the page. All three objectives trigger a brief toast with animation disabled under reduced motion.
- Nearby distance is the rounded horizontal distance to the closest available store arrival within 20 m, excluding the current store. The arrow uses eight camera-relative directions. A vertical camera or an arrival within 0.15 m suppresses the arrow. The direction uses the same destination anchors as the map and samples at most every 100 ms. Low graphics also caps the exploration shelf outline and world interaction marker projection at 10 Hz. The focused shelf presentation retains its own animation. Context text changes use the existing polite `#mall-status` region. Distance and FPS telemetry stay off the live region.

## Contrast measurements

Ratios use the sRGB relative-luminance calculation `(Llighter + 0.05) / (Ldarker + 0.05)` on the values in the v11 section of `assets/gjh-themes.css`. For the optional wide-screen header glass, the table composites its background over white, the brightest possible backdrop. Narrow and coarse-pointer layouts use solid green.

| HUD use | Foreground and background | Ratio |
| --- | --- | --- |
| Labels, status, context, Tools and FPS | Paper `#fffcf5` on green `#102d26` | 14.38:1 |
| Progress, arrow, and brass keylines | Gold `#d9ba77` on green `#102d26` | 7.89:1 |
| Bag count and pressed control | Green `#102d26` on gold `#d9ba77` | 7.89:1 |
| Focus outline on dark controls | Focus `#ffe0a2` on green `#102d26` | 11.53:1 |
| Header labels with optional blur | Paper `#fffcf5` on 96% dark green over white | 14.44:1 |
| Header brass with optional blur | Gold `#d9ba77` on 96% dark green over white | 7.92:1 |

## Browser acceptance

Capture 393×612, 390×844, 768×1024 and 1440×900 after dismissing the existing guide. Include idle exploration, an actionable New Moon shelf and a held product. Check map focus return from both buttons, Store Directory and Bag, Tools and Performance, reachable portrait and landscape controls, long location names in English, Simplified Chinese and Malay, and the complete three-goal flow. Confirm header geometry, context separation, control target sizes and contrast in the rendered browser. The token contrast values above were calculated locally. Browser captures, real safe-area behavior and assistive-technology checks are unverified.
