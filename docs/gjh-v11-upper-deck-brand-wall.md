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
