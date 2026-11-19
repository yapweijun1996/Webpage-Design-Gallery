# GJH v11 lighting pass 1

| Parameter | Before | After |
| --- | --- | --- |
| Expanded world lights | One key, one cool fill, three permanent shop point lights and six mobile accents | One key and two focus accents at 26 and 18 intensity, with an 11 m range. Both accents track one shop and fade on handoff. The upper level uses the warmed zero-point-light variant. |
| Everyday hemisphere | Sky `0xe5eef0`, ground `0x665e50`, intensity 0.72 | Sky `0xffedda`, ground `0x8c7055`, intensity 1.05 |
| Everyday directional key | `0xffe0bc`, intensity 2.60 | `0xffd4a2`, intensity 2.25 |
| Fog and ACES exposure | `0xb7ad9c` and 1.08 | Everyday `0xd9b996` and 1.03. Lunar New Year `0xe1b58f` and 1.01, Christmas `0xd7bc9f` and 1.03, Deepavali `0xdcb492` and 1.04. |
| Reflections | One brown-room PMREM at 0.40 | Three matching-size warm PMREMs. Atrium 1.00, corridor 0.90, shop 0.80. Zone changes swap textures and intensity. |
| Antialiasing and DPR | Canvas MSAA, single-sample offscreen target. Auto desktop Balanced capped at 1.50, explicit wide Balanced at 2.00. | Up to 2× MSAA on the Detailed offscreen base. Expanded canvas and glow targets are single-sample. Balanced has no FXAA and caps DPR at 1.25 before dynamic resolution. |
| Glazing | Double-sided roof. Lit shop doors. | Inward-facing skylight and unlit door glass. Upper guard glazing remains visible from both sides in the same draw. |
| Cove glow | No Low atmosphere wash. Broad wash on Balanced and Detailed. | Low uses one narrow additive cove batch at 0.22 opacity and boosts fixture emission by 12%. Broad wash is restricted to recognized discrete GPUs on Balanced and Detailed. |
| Contact shadows | Existing public props and player | Furniture footprints join the existing contact batch once the room appears. Admitted NPCs share one contact-shadow draw and reserve its cost before admission. |

## Device acceptance

Use the lap and video probes plus atrium, corridor, shop and upper-level screenshots on iPhone, Android, tablet and desktop. Compare shader program counts across entries, zone transitions and theme changes. Check highlights, lift transitions and accent flicker. Measure early entry on each tier for zero frames at or above 50 ms. Compare lap p95 to baseline within 10%, phone cadence at 30 FPS with Auto starting on Low, and tablet and PC cadence at 60 FPS. Confirm triangle and draw caps of 220k/70, 300k/90 and 420k/110.

Real Chrome and hardware results are **UNVERIFIED**.
