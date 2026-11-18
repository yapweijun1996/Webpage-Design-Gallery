# Apple iPhone page - design study (measured 2026-11-18, apple.com/sg/iphone, 1440x900)

This records design PRINCIPLES to learn from. It is not a template to copy: no Apple copy, imagery, icons, logos or fonts may be reused. GJH keeps its own brand, copy and products.

## Measured facts
- Page rhythm: ~7,167 px tall; sections alternate white (#ffffff) and pale grey (#f5f5f7 / #fafafc) bands; heavy vertical whitespace (sections 400-1,000 px tall, one idea each).
- Type: system-first stack ("SF Pro Display/Text", Helvetica Neue, Helvetica, Arial). H1 80 px / 84 px line-height, weight 600, letter-spacing -1.2 px, colour #1d1d1f. Body 17 px / 25 px, weight 400, letter-spacing -0.374 px. Large type, tight tracking, few weights.
- Chrome: global nav only 44 px tall, near-transparent, tiny type; a local "product strip" under the H1 with an icon + label per model acts as the primary chooser; sticky behaviour with translucent blur.
- Cards: large rounded tiles (radius ~28 px) on a grey band, each = product image (cropped, edge-to-edge), short title, one-line tagline, two pill actions (outlined "Buy", filled accent-blue "Learn more"). Some tiles are black with white text for contrast. Horizontal scrolling rail of tiles with a peek of the next tile.
- Links: quiet text links with a chevron (">") instead of heavy buttons; accent blue (#0071e3 family) is the only chromatic UI colour; all other colour comes from the product photography.
- Motion: staggered fade/translate reveal as sections enter the viewport (content is invisible until scrolled in); subtle, never blocking.
- Footer: dense, small grey legal text, many columns, generous top border.

## Principles to apply to GJH (original expression)
1. Product is the hero: one large calm image per section, lots of empty space, short headlines (max ~6 words) plus one quiet tagline.
2. A brand strip under the page title (logo + name per brand) is the primary chooser, like the model strip.
3. Alternating light / pale-grey bands; one dark "contrast" tile for the Virtual Mall Concept.
4. Rounded tiles (24-28 px), two pill actions per tile: outlined secondary and filled primary; text links with chevrons for tertiary.
5. One accent colour for actions; the brands' real packaging supplies the rest of the colour.
6. Tight, large display type on a system font stack (no webfont downloads); body 17/25.
7. Subtle scroll reveal (opacity/translate, 400-600 ms, disabled for prefers-reduced-motion; content must be fully visible without JS).
8. Mobile: single column tiles, brand strip becomes a horizontal scroll chips row with snap, 44 px targets.
