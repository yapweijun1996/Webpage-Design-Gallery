# V11 stage 10b — Christmas

Status: implemented locally in the expanded mall, now the default. [Deepavali](gjh-v11-stage10-deepavali.md) was added after this Christmas slice. Choose **Classic 3-store view** or `?layout=classic` for the original three-store layout; the expanded mall and its theme controls are available without a layout query.

## Visitor experience and placement

Open **Theme** in the 3D mall or **Mall theme settings** in the expanded directory, choose **Christmas**, and apply. The same control switches directly to **Everyday** or **Lunar New Year** without a page reload. The choice is stored in this browser when available; there is no shared operator configuration or automatic scheduling.

The locally generated, brand-neutral Christmas scene includes an evergreen tree with a star, baubles and steady warm lights, wrapped presents, three overhead strings of lights and a greeting banner. The existing material and light roles provide a warm green, ivory and gold setting. The steady decorative bulbs do not flash or introduce animation. The tree and presents sit inside the existing collidable planting bed, offset so the tree is visible from the entrance. The strings and banner hang above the event reservation; the minimum declared lamp clearance is 5.65 m. No new ground collider is introduced, and the event floor and circulation loop remain open. These are virtual scene clearances, not a real-world safety certification.

View the actual Chrome captures at [the entrance, 1440 px](evidence/gjh-stage10-christmas-20261115/christmas-1440.png), [the tree and presents](evidence/gjh-stage10-christmas-20261115/christmas-garden-1440.png), [390 px](evidence/gjh-stage10-christmas-20261115/christmas-390.png), [320 px](evidence/gjh-stage10-christmas-20261115/christmas-320.png), [768 px](evidence/gjh-stage10-christmas-20261115/christmas-768.png) and [844 px landscape](evidence/gjh-stage10-christmas-20261115/christmas-844.png). These are runtime screenshots, not concept art. [christmas.js](../demos/corporate/gjh/v11/assets/christmas.js) owns the decoration geometry and placement; [mall-themes.js](../demos/corporate/gjh/v11/assets/mall-themes.js) remains the theme registry and coordinator.

## Lifecycle and recovery

Each seasonal pack has its own local, on-demand import and retry state. An unsuccessful import can be retried in the same page with a fresh module URL, without affecting the other seasonal pack. The coordinator prepares a detached decoration group before committing the new material roles; failed preparation retains the current theme, including an active Lunar New Year group. When a new theme commits, the previous stage is removed and its owned resources are disposed. Reapplying the current theme does not duplicate the group. A generation token and cancellation prevent an interrupted load from mounting after a dialog closes or WebGL is lost.

Graphics restoration retains the active theme and existing bag. If a saved Christmas pack fails at startup, the mall starts in Everyday and permits a same-page retry. These packs follow the existing network-only demo boundary; they do not provide offline 3D support. Theme settings fail independently of the accessible store directory. Decorative objects introduce no commerce or brand claims.

## Verification and limits

The [theme test log](evidence/gjh-stage10-christmas-20261115/group-2.log) covers five viewport sizes; Christmas → Lunar New Year → Christmas → Everyday transitions; local preference, reload and Visitor V1; repeated three-theme transitions and resource cleanup; a missing module, saved-theme startup failure and same-page retry; a banner allocation failure while Lunar New Year remains active; cancellation and real graphics loss during preparation; and graphics restoration with the bag retained. A Christmas run also drives the Rapier cart around the loop and through the event floor, uses the lift, opens product details and adds an item to the bag. The previous Lunar New Year and theme settings tests are rerun as regressions. Failure injection verifies the specific simulated cases, not every possible device failure.

The [repository checks and gallery browser suites](evidence/gjh-stage10-christmas-20261115/group-1.log), [expanded lift, store, seating, shell and PWA suites](evidence/gjh-stage10-christmas-20261115/group-3.log), and [source hashes](evidence/gjh-stage10-christmas-20261115/source-sha256.txt) record the candidate and evidence. Tests were run in an isolated copy to protect the working tree. Chrome viewport emulation is not a physical iOS/Android, Safari, screen-reader or regulatory audit.

Matched courtyard samples in Chrome 157 / Metal, DPR 2, auto quality and reduced motion show the following draw calls (idle / cart), from [performance.log](evidence/gjh-stage10-christmas-20261115/performance.log):

| Viewport | Everyday | Christmas | Everyday restored |
| --- | --- | --- | --- |
| 390 × 844, balanced | 153 / 176 | 167 / 190 | 153 idle |
| 1440 × 900, detailed | 182 / 205 | 196 / 219 | 182 idle |

Christmas adds 14 draw calls and approximately 64,714 triangles in these matched samples. The texture count returns to the prior value after switching back; the cart retains cached geometry, so the first idle resource count is not the comparable post-cart baseline. The desktop cart was already above the 200-call reference in Everyday and reaches 219 with Christmas; this reference has not been raised. The existing [10 MiB ready-stage payload failure](gjh-v11-stage8-materials-lighting.md#verification-and-limitations) remains open. The numbers are local observations, not physical-device frame-rate or thermal guarantees.
