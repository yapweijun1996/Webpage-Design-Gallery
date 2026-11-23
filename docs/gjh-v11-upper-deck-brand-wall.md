# GJH V11 upper-deck brand wall

## Intent and boundaries

Add a quiet viewing deck at the existing upper level (+7.2 m), with a 12 × 12 m floor overlooking the central atrium. It is a shared gallery for the 17 supplied brand-kit slots, not a claim of tenancy, distribution, stock or brand authorization. Keep the existing independent-concept footer. Do not add prices or medical claims. S03, S05 and S11 use only neutral category wording because their specific brand/product relationship is unverified.

The deck has a glazed atrium edge, restrained seating and planters, and one wall of 17 small plaques. Each plaque pairs its supplied logo with that slot’s tagline and short story from `demos/corporate/gjh/v11/assets/brand-kit/brand-kit.json`. Story text is available on approach and by tap; provide keyboard access through the existing interaction conventions. Use forest green, ivory, champagne gold, warm wood and light stone, with no competing display clutter.

## Implementation constraints

- Reuse the existing lift, upper-level placement, controls and generated spatial data; do not alter existing shop designs.
- Reuse the validated local `mall-glass-railing-1m`, `mall-glass-railing-2m`, `mall-glass-railing-post`, `gjh-lounge-bench` and `gjh-areca-planter` models when present and validated in the read-only Blender gallery. No new Blender models.
- Pack plaque artwork into one texture atlas and draw the wall as a batched surface; avoid one material/texture/draw call per plaque.
- Cull or LOD the deck furnishings and plaque details from the default view. At default expanded-layout view and at the deck, draw calls must each remain <=190. Reduce decorative items before compromising the core gallery.
- Keep startup budget unchanged. No zoom, viewport, PWA, GitHub Actions, or generated-output hand edits.

## Delivery stages

1. This design brief and the checklist in `task.md`.
2. Deck floor/geometry, glass railing, benches and planters.
3. Single-atlas 17-plaque wall, proximity/tap story presentation and keyboard access.
4. Expanded-layout copy correction, focused browser regression coverage, README update, generated-output regeneration, and verification.

Stage commits are required. The browser acceptance must establish that the deck is reachable, all 17 plaques are represented, and both measured views stay at or below 190 draw calls.

## Story languages

All 17 plaques use the visitor's chosen language for the nearby prompt, Story title and body, action label, and logo alternative text. English comes from the [installed kit](../demos/corporate/gjh/v11/assets/brand-kit/brand-kit.json). The language selector also offers Simplified Chinese and Malay. The physical signs retain their original artwork. The wall loads its additional text on arrival at the upper deck.

The browser language matrix recorded 102 selector changes across two same-origin tabs and every supplied slot. Separate Chrome/Metal routes used the Map and lift at 390 × 844 (Low), 768 × 1024 (Balanced) and 1440 × 900 (Detailed). At Sony and Borsch Med each route opened the Story, observed a language change from the other tab, restored the original English copy, then checked the nearby prompt again. Each route matched six served files to the release and recorded zero page errors. The three routes requested the upper-floor translations after the lift. An additional service-worker check on the author checkout preserved Malay on returning from the offline reconnect page. Physical devices and native-speaker editorial review remain open.

[Three-viewport captures](evidence/gjh-v11-upper-plaque-languages/stories.webp) · [Lift-route measurements](evidence/gjh-v11-upper-plaque-languages/lift-routes.json) · [Rendered text for all 17 plaques](evidence/gjh-v11-upper-plaque-languages/rendered-stories.json)
