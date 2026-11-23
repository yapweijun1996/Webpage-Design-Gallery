# GJH v11 mall HUD

The HUD uses the existing GJH deep green, brass and cream tokens with SVGs from the mall icon registry. The header sits above the scene, Objectives and Tools occupy its upper corners, and the bottom context slot shares the movement-control area. Tools contains Help, language, graphics quality, cart, theme, mini-map, Performance and camera controls.

## Roaming disclosure

“Unofficial concept” stays beside the scene readouts while walking. The language control also offers “非官方概念” and “Konsep tidak rasmi”. Open the menu or About for the full statement. On short landscape screens the caption sits beside Objectives. In narrow portrait first person, held-item controls follow the readouts vertically.

Chrome covered 320, 390, 667, 768 and 1440 CSS px, with real pickup and return at the two narrowest widths. At 390 px the observed touch targets measured 44 × 44 px for More, 56 × 56 for Inspect, 95 × 56 for Pickup, 46 × 44 for Drop, 104 × 44 for Bag and 117 × 44 for Return. All six centers were reachable and clear of the caption. [Roaming and held-product views](evidence/gjh-v11-roaming-disclosure.webp)

## Identifying a held product on a narrow phone

In narrow portrait view, the status gives the product its own line above Drop, Add to bag and Return. Chrome compared the same held Australia Abalone 425g in English, Simplified Chinese and Malay with the shelf, expanded Objectives and open aisle. The full name was visible in all nine cases at 320 CSS px and all nine at 390 px. Previously it was fully visible in two and five cases respectively. At 320 px, the instructions after the name may still truncate. All three actions remained at least 44 px high and reachable. [320 px comparison](evidence/gjh-v11-held-product-320.webp) · [390 px comparison](evidence/gjh-v11-held-product-390.webp)

## Layout and interaction

In the classic mall below 600 CSS px, a projected room plaque clears the Tools button by at least 8 CSS px. The plaque hides while it crosses that boundary and returns as the visitor walks back into the arcade. In a 390 × 844 Chrome viewport, the header ended at y=48 and the separate Tools target extended from y=60 to 104. The New Moon, MILI and GOGO plaques previously reached y=93, 90 and 83 at their respective entrances. [New Moon before](evidence/gjh-classic-room-plaque/newmoon-before.png) · [New Moon after](evidence/gjh-classic-room-plaque/newmoon-after.png)

- The header is 48 CSS px high plus the top safe-area inset. The header actions and corner chips have 36 CSS px painted faces inside targets at least 44 CSS px across. The Objectives and Tools targets start 12 CSS px below the header. The Tools pill places the icon and label side by side. Map, Bag and Store Directory use icons and accessible names below the 1000 CSS px desktop breakpoint. The location pill keeps its dot, name and chevron on one row and ellipsizes the name when space runs out. The location pill and the separate Map button both open the map and receive focus back when it closes. The closed map has no layout box.
- The context queue prioritizes the held-product message and actions, then the current interaction, a nearby store and the next unfinished objective. Interaction and held-product cards share a flex row with 12 CSS px padding and a 12 CSS px gap between their copy and actions. The held-product message uses at most two lines, and action labels stay on one line. **Add to bag** is the primary action during exploration while carrying a product. **Return to shelf** appears within reach of the product's original New Moon shelf while return is available. Both actions are at least 44 CSS px high. Confirmation briefly occupies the same context slot after a successful add.
- On compact and touch layouts, Run sits 8 CSS px above the resting joystick on the same horizontal centre. The joystick sits 20 CSS px above its safe-area gutter. The context and tutorial stack clears the controls by at least 8 CSS px. The stack sits above Run and moves beside the controls in short landscape viewports up to 560 CSS px tall. The tutorial stacks above the current context and scrolls internally on short screens. Nearby hints, objective hints and item names use a single line with ellipsis. The full text remains available to assistive technology.
- The existing inspect and physical pickup handlers own their actions and availability. In reach of a physical shelf with empty hands, the primary button reads **Pick up product** on one line. **More actions** exposes **Inspect**. F still uses the existing scene interaction. The joystick is a visual overlay on the canvas input and retains its accessible movement label.
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

The compact sizing pass checks the rendered HUD template and generated CSS in Chrome touch emulation at 393×600, 393×852, 360×640 and 852×393. The fixture checks target corners, icon centres, the resting joystick, and the padding, text truncation and action labels for interaction and held-product cards. Live 3D journeys and physical iPhone rendering remain unverified for this pass.

For the held-item regression in [the original 393×612 capture](evidence/hud-add-to-bag-clipped.png), repeat the journey at 320, 360, 375, 390, 393 and 430 CSS px in portrait and at 844×390 in landscape. At each size, check the held state at the original shelf, at a different shelf and away from the shelves. Confirm both actions fit at the original shelf and only **Add to bag** is shown elsewhere. Check the interaction prompt with **More actions** expanded, a nearby-store hint, an objective hint and the tutorial. Compare their rendered rectangles with Run, Move, Objectives and Tools, and check that tutorial actions remain reachable when scrolling. `node --test tests/gjh_v11_hud_layout.test.mjs tests/gjh_held_product.test.mjs` covers the CSS bounds contract and return-action availability.

The broader HUD review uses 393×612, 390×844, 768×1024 and 1440×900 after dismissing the guide. Check map focus return from both buttons, Store Directory and Bag, Tools and Performance, camera switching and zoom, long location names in English, Simplified Chinese and Malay, and the complete three-goal flow. The token contrast values above were calculated locally. Real safe-area behavior and assistive-technology checks are unverified.
