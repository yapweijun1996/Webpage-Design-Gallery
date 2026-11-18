# GJH v11 mall HUD

The HUD uses the existing GJH deep green, brass and cream tokens with SVGs from the mall icon registry. The header sits above the scene, Objectives and Tools occupy its upper corners, and the bottom context slot shares the movement-control area. Tools contains Help, language, graphics quality, cart, theme, mini-map, Performance and camera controls.

## Layout and interaction

- The header has a 52 CSS px row at the four review viewport sizes when the browser supplies no top safe-area inset. The row absorbs up to 8 CSS px of inset. Larger system insets extend the occupied height by the excess so controls retain a 44 CSS px touch target below the notch. Map, Bag and Store Directory use icons and accessible names below the registered 1000 CSS px desktop breakpoint. The header fits below 360 CSS px through location truncation and compact icons. The location pill and the separate Map button both open the same map and receive focus back when it closes.
- The context queue prioritizes the held-product message and actions, then the current interaction, a nearby store and the next unfinished objective. **Add to bag** works anywhere in exploration while carrying a product. **Return to shelf** is enabled within reach of its original New Moon shelf. At another product shelf it remains visible but disabled, and away from the shelving it is hidden. Confirmation briefly occupies the same context slot after a successful add.
- The slot stays in one row above the thumb controls in portrait and alongside Run at short landscape heights. Nearby and objective hints use one line. Long item and interaction copy clips after two lines, with the full copy available to assistive technology. The largest default action determines a 56 CSS px row plus the border.
- The existing inspect and physical pickup handlers own their actions and availability. In reach of a physical shelf with empty hands, the primary circle offers **Pick up product** and **More actions** exposes **Inspect**. F still uses the existing scene interaction. The joystick is a visual overlay on the canvas input. Its Move label disappears after the first accepted joystick touch. The available visitor has no dedicated Jump control.
- Open **Tools** to find **First person**, **−** and **+** inside `#camera-tools`. These controls use the 56 CSS px HUD control kit. With the scene focused, press V to toggle view and use + or − to zoom. See the [exploration camera controls](gjh-v11-engine-interactions.md#exploration-camera) for wheel, pinch and temporary action views.
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

Capture 393×612, 390×844, 768×1024 and 1440×900 after dismissing the existing guide. Include idle exploration, an actionable New Moon shelf and a held product. Exercise **Return to shelf** in reach of the original shelf and **Add to bag** away from it. Check map focus return from both buttons, Store Directory and Bag, Tools and Performance, camera switching and zoom, reachable portrait and landscape controls, long location names in English, Simplified Chinese and Malay, and the complete three-goal flow. Confirm header geometry, context separation, control target sizes and contrast in the rendered browser. The token contrast values above were calculated locally. Browser captures, real safe-area behavior and assistive-technology checks are unverified.
