# Gouache Pantry

## 1. Concept and one-line pitch

Start with what you remember: a few letters open a brand finder, while a painted ingredient leads to a pack you can recognise.

## 2. Visitor and job-to-be-done

A returning shopper remembers “Moon” or the shape of an abalone, but may have forgotten the full name [assumption]. Success means recognising the brand and reaching its official page without guessing which business category to open. The pineapple on the cover is a visual invitation. Only documented ingredient associations produce matches.

## 3. External benchmarks

- **Diaspora Co.** gives Pragati turmeric a precise colour vocabulary. Borrow its use of marigold to describe a particular yellow when directing the painter. Skip the purchase controls at this stage of recall. [Pragati Turmeric](https://www.diasporaco.com/products/pragati-turmeric)
- **Fireclay Tile** pairs glaze colours with named finishes. Borrow the distinction between matte pigment and reflective ceramic to signal that the finder is open. Avoid filling the phone with sample swatches. [Mosaic Sample Kits](https://www.fireclaytile.com/collections/mosaic-sample-kits)
- **FoodPrint** lists ingredients under familiar grocery names. Borrow its plain nouns for ingredient shortcuts. Skip the category-selection step before typing. [Real Food Encyclopedia](https://foodprint.org/eating-sustainably/real-food-encyclopedia/)
- **King Arthur Baking** distinguishes closely related ingredients with qualifiers such as sliced or whole. Borrow that specificity for the result caption so the visitor can confirm a memory. Avoid a multi-column table at phone width. [Ingredient Weight Chart](https://www.kingarthurbaking.com/learn/ingredient-weight-chart)

## 4. Five screens at 393 × 844

| Screen and live headline | Dominant image and composition | Actions |
|---|---|---|
| 1 · **What do you remember?** | A single cut pineapple catches the light halfway down an indigo cover. Set the question high and the controls above the bottom safe area. | Find a brand · Browse ingredients |
| 2 · **Type what you remember** | One celadon tile corner fills the upper half. Its quiet lower edge backs the labelled input and first suggestion, both above the keyboard. | Edit query · Select match |
| 3 · **Abalone** | In the ingredient route, a pale abalone shell replaces the pineapple at the same scale. The lip glows where the fruit’s cut edge was. | See matching brand · Next ingredient |
| 4 · **New Moon** | A tighter crop of the same shell sits above the brand name and the printed cue “Canned abalone.” [verified: docs/gjh-multibrand-directory.md] | See the pack · Official brand page |
| 5 · **Recognise this pack?** | The real tin stands alone at native proportions against indigo, with its exact product name below. [verified: demos/corporate/gjh/v22/index.html] | Open official product · Back to finder |

## 5. Signature interaction

Both cover actions work independently. Browse opens the abalone painting. Next cycles to another supported ingredient, replacing the still in place with a 140 ms fade through indigo. The finder opens directly onto the tile. Static HTML supplies a linked alphabetical index. Vanilla JS enhances it with a labelled combobox backed by the same entries. Trim whitespace, fold case, match name fragments and documented aliases. Rank exact names first. Give ingredient associations their own evidence field. Non-food names remain searchable and keep the neutral tile.

Typing “moon” suggests New Moon [verified: docs/gjh-multibrand-directory.md]. Announce match count politely. Arrows move through suggestions, Enter selects, Escape closes and restores trigger focus. An empty query shows a hint. An unmatched query keeps the text editable and offers the index. Back restores query and selection. With reduced motion, swap instantly. Without JS, cover links jump to the index or illustrated ingredient entries.

## 6. Palette and type

Indigo **#1F3350** holds the shadows. Paper **#F5ECD8** carries text, pineapple **#E4B74D** marks focus, and celadon **#91B6A6** belongs to the tile. Use Fraunces Medium at 44 px for questions and DM Sans at 18 px for controls. Both use the SIL Open Font License. Bundle licence notices with self-hosted fonts and fall back to Georgia and system sans.

## 7. Asset plan

Generate the cover, tile and individual ingredient paintings. Caption each “AI concept illustration.” Reuse the real front photograph at `demos/corporate/gjh/v22/assets/new-moon-nz-425g-front.webp` and its product link [verified: demos/corporate/gjh/v22/index.html]. Preserve the label and aspect ratio. For another ingredient, source its association before commissioning art. Preload only the cover. Export mobile WebP crops and lazy-load later stills.

## 8. Image anchors

**A · First screen**

Portrait 2:3. Paint one lengthwise half of a pineapple in opaque gouache on rough indigo paper. Tilt the plane just enough for the cut face to catch a narrow band of afternoon light. Keep the gold flesh and broken olive crown inside the central half of the frame. Leave the upper left quiet and the bottom quarter dark. Let one dry brushstroke describe the rind. No text, logos, packaging, faces or additional objects.

**B · Finder open**

Portrait 2:3. Study one celadon glazed tile corner close enough to see glaze pooling at its rounded lip. A single sharp window reflection crosses the upper third, with a shallow indigo grout shadow beneath the edge. Match the cover painting’s diagonal and light from upper left. Leave the lower half an uninterrupted warm ivory plane for live controls. Restrained gouache, broad flat strokes, visible paper tooth. No text, logos, packaging, faces or repeated tiles.

## 9. Risks, effort and acceptance

**M.** The main risks are a keyboard that hides the first suggestion and an illustration mistaken for merchandise. On a 393 × 844 iPhone, verify “moon” reaches the official destination, a non-food name resolves, and an unmatched query recovers. Check the first suggestion with the keyboard open, 44 px targets, visible AI captions, 4.5:1 text contrast, single-image crops, reduced motion and the complete no-JS route.

## 10. Self-score

**Taste 9/10** for the dry-to-glazed material change. **Distinctness 9/10** for two recall routes sharing one composition. **Feasibility 8/10** because each ingredient pairing needs source review and a convincing portrait crop.
