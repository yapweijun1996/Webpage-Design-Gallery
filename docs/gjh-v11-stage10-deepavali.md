# V11 stage 10c — Deepavali

Status: implemented locally in the expanded mall, now the default. Visitors can select Everyday, Lunar New Year, Christmas or Deepavali. Choose **Classic 3-store view** or `?layout=classic` for the original three-store scene.

## Design and placement

Open **Theme** in the 3D mall or **Mall theme settings** in the expanded directory, select **Deepavali**, and apply. The other three themes remain selectable without a page reload. The choice persists in this browser when storage is available; the demo does not provide shared operator settings or automatic scheduling.

The original, locally generated decoration uses jewel-toned violet, pink, teal and gold, two diya-inspired lamp displays, suspended floral garlands, steady warm lights, a greeting banner and a flat rangoli-inspired floral graphic. The lights are simulated and do not flash. The interpretation is a decorative concept rather than a reproduction of any specific religious design. Singapore's [National Heritage Board heritage booklet](https://www.roots.gov.sg/-/media/Roots/ich/ich-booklet/ich-booklet.pdf) describes diyas and rangoli among Deepavali preparations; communities and traditions are diverse.

The two lamp displays remain inside the existing collidable planter. The floor graphic lies flat in the reserved event area and has no collision body, so visitors and carts can cross it; it is not the removed upright central ring. Garlands and the banner are suspended above the event area with a declared minimum clearance of 5.15 m. No new ground collider is added. These are virtual-scene clearances, not a real-world safety certification.

Actual Chrome captures show the [event area and floor graphic](evidence/gjh-stage10-deepavali-20261115/deepavali-event-1440.png), [desktop entrance](evidence/gjh-stage10-deepavali-20261115/deepavali-1440.png), [phone](evidence/gjh-stage10-deepavali-20261115/deepavali-390.png), [small phone](evidence/gjh-stage10-deepavali-20261115/deepavali-320.png), [tablet](evidence/gjh-stage10-deepavali-20261115/deepavali-768.png) and [landscape](evidence/gjh-stage10-deepavali-20261115/deepavali-844.png). [deepavali.js](../demos/corporate/gjh/v11/assets/deepavali.js) owns the placement and generated props; [mall-themes.js](../demos/corporate/gjh/v11/assets/mall-themes.js) owns the registry and lifecycle.

## Switching and recovery

The seasonal module loads on demand with independent retry state. The coordinator prepares a detached decoration group before applying the new palette and mounting it. A failed import or canvas allocation retains the previous theme, disposes partial resources and permits a same-page retry. Closing the dialog or losing WebGL cancels an in-flight preparation; a late completion cannot replace the active scene. Switching themes releases the outgoing stage, and reapplying an active theme does not duplicate it. Real graphics recovery retains the active theme and the bag.

If a saved Deepavali pack fails at startup, the mall starts in Everyday and allows retry without reloading. The seasonal packs follow the existing network-only demo boundary and do not provide offline 3D. The generated floor and banner canvases contain 4.5 MiB of RGBA source pixels together before browser/GPU overhead; this is not a measurement of GPU allocation. The non-JavaScript and graphics-failure directory paths remain available.

## Verification and limits

The [theme test log](evidence/gjh-stage10-deepavali-20261115/group-2.log) covers five viewport sizes, direct switching between all four themes, local preference and reload, repeated four-theme transitions and resource cleanup, Visitor V1, module failure and same-page retry, saved-theme startup failure, motif and banner canvas failures while Christmas remains active, cancelled loads, real graphics loss during preparation and after activation, and retained bag state. A Deepavali run drives a Rapier cart around the loop and across the event-floor motif, uses the lift, opens a product and adds it to the bag. The Christmas, Lunar New Year, theme settings and material-fallback suites are rerun as regressions. Synthetic failures prove only the simulated cases.

The [repository and gallery test log](evidence/gjh-stage10-deepavali-20261115/group-1.log), [expanded lift, stores, atrium, shell and PWA test log](evidence/gjh-stage10-deepavali-20261115/group-3.log), and [source hashes](evidence/gjh-stage10-deepavali-20261115/source-sha256.txt) record the candidate and evidence. Tests ran in an isolated copy to protect the working tree. Browser emulation is not a physical iOS/Android, Safari, screen-reader or regulatory audit.

Matched courtyard samples in Chrome 157 / Metal, DPR 2, auto quality and reduced motion show the following draw calls (idle / cart), from [performance.log](evidence/gjh-stage10-deepavali-20261115/performance.log):

| Viewport | Everyday | Deepavali | Everyday restored |
| --- | --- | --- | --- |
| 390 × 844, balanced | 153 / 176 | 161 / 184 | 153 idle |
| 1440 × 900, detailed | 182 / 205 | 190 / 213 | 182 idle |

Deepavali adds 8 draw calls and approximately 26,182 triangles in these matched samples. After switching back, the texture count and idle draw count return to the post-cart Everyday baseline; the cart retains cached geometry. The desktop cart was already above the 200-call reference in Everyday and reaches 213 with Deepavali. The existing [10 MiB ready-stage payload failure](gjh-v11-stage8-materials-lighting.md#verification-and-limitations) remains open. These are local observations, not physical-device frame-rate or thermal guarantees.
