# 1. The Pantry Shelf

Pull a brass handle and one tin comes into the light, close enough to recognise the front, read the back and find the exact pack again.

## 2. Visitor and job-to-be-done

“I remember the tin from dinner. Is this the same one?” [assumption] A shopper holding a phone in one hand may recognise a label before remembering its product name. Pilot with New Moon Premium Wild Caught New Zealand Abalone 425g. Its name distinguishes origin and size, both useful checks before leaving for the shop. [verified: docs/gjh-v22/design-brief.md]

## 3. External benchmarks

- **Blum SPACE TOWER.** Each shelf pulls out independently and reveals its contents from above. Borrow that change of sightline. Avoid the fully stocked cabinet photograph, where the eye has to hunt. [Blum illustrated product sheet](https://d2.blum.com/services/BEC003/box0036-td-082_td_dok_bau_%24sen_%24aof_%24v4.pdf)
- **Diaspora Co.** The turmeric page pairs the product name with a specific tin size. Keep those identifiers together as the shelf opens. Skip the bundle selector competing for thumb space. [Pragati Turmeric](https://www.diasporaco.com/products/pragati-turmeric)
- **Fishwife.** Ingredients appear as readable text and nutrition has its own control. Borrow that separation of recognition and reading. Avoid making a nutrition image the only legible record. [Smoked Rainbow Trout](https://eatfishwife.com/products/smoked-rainbow-trout-3-pack)
- **Heinz.** The serving basis sits beside the nutrition table. Carry that unit into both languages. Avoid the long scroll from the can image to the ingredients by offering a direct label action. [Baked Beanz](https://www.heinz.com/de-DE/products/08715700131139-baked-beanz)

## 4. Five screens at 393 × 844

| Screen and headline | One dominant image and composition | Actions |
|---|---|---|
| 1 · Pull the pantry shelf | Dark walnut recess. Brass catches light two-thirds down. Set the headline in the shadow above it and print the pilot brand and size in live type. | Pull shelf · Read label |
| 2 · Recognise this tin? | Open shelf, one real front-facing tin centred in the light. Set the exact product name below its contact shadow. | Turn tin · Read label |
| 3 · Check the other side | Same tin, same scale and baseline, now showing the real reverse. Keep the surrounding wood quiet. | Show front · Read label |
| 4 · Read the label | A single rear-label detail fills the upper half. Below it, selectable text follows printed field order and grows with system text size. | Switch EN/中文 · Confirm pack |
| 5 · Take this pack name | Front portrait on charcoal, with the complete selectable name and weight directly beneath. | View exact product · Return to shelf |

## 5. Signature interaction

Make the handle a native button. At rest, tapping, Enter or Space opens the shelf. On pointer-down capture the handle. A downward pull tracks up to 72 CSS px, moving only the shelf layer. Release past 36 px to settle open in 180 ms. A shorter drag or pointer cancellation restores rest. Suppress the synthetic click after a drag. Reserve gesture capture for the handle so the surrounding image scrolls normally.

On opening, focus the front-view heading. Front/back swaps replace one photograph in place. Reduced motion switches directly between stills. Without JS, ordinary fragment links lead through stacked figures, both language transcripts and the product link.

## 6. Palette and type

Use charcoal #191713, warm ivory #F4E9D4 and brass #D8AD62. Reserve cinnabar #A53127 for a thin rule beneath the pack name. Georgia lends warmth to short headings. Use system-ui and local PingFang SC for controls and Chinese copy. These stacks use installed fonts under the device licence and distribute no font files.

## 7. Asset plan

Generate two empty cabinet plates. Composite the real tin later, masking only its background and preserving printed colours. Match its lower rim, shadow and apparent diameter across both views. Caption generated scenery “AI concept illustration.” Source the front, back and nutrition details from the matching JPEGs under `assets/companies/gjh/official/new-moon-nz-425g-{front,back,nutrition}.jpg`. [verified: assets/companies/gjh/official/README.md] Confirm reuse rights and have a bilingual reviewer check each field against the photographs. Mark translated passages as translations and omit unreadable fields pending a better original.

## 8. IMAGE ANCHORS

**A · First screen**

> Photograph a half-open walnut pantry shelf in portrait 2:3. Look slightly down into the recess from the height of someone reaching for the handle. A narrow beam from upper left catches a worn brass pull across the lower third. Let the cabinet walls fall into charcoal shadow. Leave the upper quarter quiet and the central shelf surface bare for later compositing. Keep the handle inside a narrow central crop. No text, logos, packaging, people or faces.

**B · Interaction state**

> Photograph the same walnut shelf fully extended, portrait 2:3, from the same fixed camera just above shelf height. Bring the front lip toward the viewer until the brass pull nearly leaves the bottom edge. Warm light from upper left reveals fine grain across one empty oval of light at centre, wide enough to receive a real product photograph later. Preserve dark cabinet uprights at both margins. No text, logos, packaging, people or faces.

## 9. Risks, effort and acceptance

**M.** Matching two photographic angles and proofreading small curved print are the main costs. Static HTML, CSS and vanilla pointer events suffice. On iPhone Safari at 393 × 844, verify one-thumb tap and drag reach the identical front view, cancellation restores rest, and a swipe beside the handle scrolls. Check 44 px targets, 4.5:1 text contrast, safe-area clearance, VoiceOver reading order and unclipped Chinese at 200% text size. Trace both transcripts and the outgoing product URL to the same SKU. Repeat with motion reduced and JS disabled.

## 10. Self score

Taste **9/10** for the brass highlight against dark wood. Distinctness **8/10** because pulling reveals a readable object. Feasibility **9/10** with two stills and matched pack photography.
