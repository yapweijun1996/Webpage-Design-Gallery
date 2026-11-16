# V11 stage 10a — Lunar New Year

Status: implemented locally in the expanded mall, now the default. [Christmas](gjh-v11-stage10-christmas.md) and [Deepavali](gjh-v11-stage10-deepavali.md) were added subsequently. Choose **Classic 3-store view** or `?layout=classic` for the original layout.

## Experience and spatial placement

Open **Theme** in the 3D scene or **Mall theme settings** in the expanded directory, select **Lunar New Year**, and apply it. **Everyday** restores the existing green, ivory, gold and natural finishes. The selected theme is stored on this browser when storage is available; it is not a shared operator setting. The accessible directory remains available if 3D or the theme module is unavailable. The current interface is English.

The red-and-gold palette updates the existing named material, lighting and lift roles. Original, locally generated, brand-neutral decoration adds nine suspended red lanterns, a greeting banner, two kumquat trees and small blossom sprays. The lanterns and banner are above the event reservation; the lowest declared lantern clearance is 4.82 m. The two trees remain within the existing collidable planter footprint. No new ground collision bodies or upright central ring are introduced, and the reserved event floor and circulation loop remain open. These are virtual-scene dimensions, not a real-world safety or compliance certification.

The scene renders in [desktop](evidence/gjh-stage10-20261115/lunar-1440.png), [tablet](evidence/gjh-stage10-20261115/lunar-768.png), [phone](evidence/gjh-stage10-20261115/lunar-390.png), [small phone](evidence/gjh-stage10-20261115/lunar-320.png) and [landscape](evidence/gjh-stage10-20261115/lunar-844.png) screenshots from Chrome. These are actual runtime captures, not concept images. Source and placement live in [lunar-new-year.js](../demos/corporate/gjh/v11/assets/lunar-new-year.js); [mall-themes.js](../demos/corporate/gjh/v11/assets/mall-themes.js) remains the theme-definition and coordinator owner.

## Switching and recovery

The seasonal module is loaded only when selected or restored. It builds its own detached, instanced decoration group before the coordinator commits the palette and mounts the group. When preparation or commit fails, the partial stage is disposed and the previous theme remains active. A failed module import receives a fresh retry URL on a later attempt, allowing recovery without reloading the page. Closing the dialog, hiding the page or losing WebGL cancels a pending operation; late results cannot mount. Reapplying an active theme is idempotent. Switching back removes and disposes the seasonal geometry, materials and banner texture after Everyday is applied.

The existing graphics recovery revalidates and reapplies the active palette and retains the mounted seasonal group. A saved Lunar New Year preference that cannot load starts in Everyday and can be retried in the same page. A failed application does not promise offline availability: the seasonal module and its dependencies follow the existing network-only demo boundary. The optional settings module failing entirely leaves the earlier Everyday scene and directory available.

## Verification and limits

The [seasonal and theme tests](evidence/gjh-stage10-20261115/group-2.log) cover five viewport sizes, visible rendering, local preference and reload, repeated replacement and resource cleanup, Visitor V1, a blocked seasonal module and same-page retry, a saved preference with unavailable module, injected banner allocation failure, cancelled pending loads, real WebGL loss both during loading and after activation, and returning to Everyday. They also drive a real Rapier cart around the loop and through the event floor, use the lift, inspect a New Moon product and retain the bag. Synthetic failure injection tests those specific failures only. The same log ends with a materials-test invocation missing its required `--screens` argument; that invocation was corrected and its separate result is recorded in [materials.log](evidence/gjh-stage10-20261115/materials.log).

The [repository checks and general browser suites](evidence/gjh-stage10-20261115/group-1.log) and [expanded lift, stores, atrium, shell and PWA regression suites](evidence/gjh-stage10-20261115/group-3.log) were run in an isolated copy of the candidate. The broader checks exercise the existing three stores and prior behavior, while the seasonal test specifically exercises the changed theme. The [source hashes](evidence/gjh-stage10-20261115/source-sha256.txt) identify the theme candidate.

Matched courtyard measurements at the same position, Chrome 157 / Metal, DPR 2, auto quality and reduced motion show the following draw calls (idle / cart), from [performance.log](evidence/gjh-stage10-20261115/performance.log):

| Viewport | Everyday | Lunar New Year | Everyday restored |
| --- | --- | --- | --- |
| 390 × 844, balanced | 153 / 176 | 164 / 187 | 153 idle |
| 1440 × 900, detailed | 182 / 205 | 193 / 216 | 182 idle |

The seasonal scene adds 11 draw calls and about 42,722 triangles in these matched samples; switching back restores the measured idle draw count and texture count. The cart itself has previously cached geometry, so a first idle resource count is not a comparable post-cart baseline. Desktop cart rendering was already above the existing 200-call reference in Everyday and reaches 216 in this seasonal sample; that reference is not silently raised. The separate pre-existing [10 MiB startup-payload budget failure](gjh-v11-stage8-materials-lighting.md#verification-and-limitations) also remains open. These are local measurements, not physical-device frame-rate or thermal guarantees.

Chrome viewport emulation and programmatic touch/graphics failure tests are not physical iOS/Android, Safari, screen-reader or regulatory validation. The remaining 14 storefronts stay neutral pending independently verified brand rights and content.
