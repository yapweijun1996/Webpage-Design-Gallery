## 1. The Receiving Bay

Step through a sunlit loading door, choose who you buy for, and leave with a sales enquiry that shows how you reached your case count.

## 2. Visitor and job-to-be-done

[assumption] A chef between services knows tomorrow’s covers. A retail buyer knows the shelf allocation. Both can describe demand before they know the supplier’s case configuration. Give each a way to ask for that missing detail without guessing it.

## 3. External benchmarks

- Gordon Food Service gives prospective customers a direct entry beside product discovery. Borrow the immediate trade invitation. Leave account setup until after the enquiry. [Gordon Food Service](https://gfs.com/en-us/)
- USDA distinguishes edible servings from purchase units. Ask the chef for usable portions per pack, especially for drained ingredients. Leave institutional yield tables out of the phone flow. [Food Buying Guide](https://foodbuyingguide.fns.usda.gov/Home/About)
- King Arthur shows the actual multiplication used to scale a batch. Put the buyer’s numbers and units beside the result. Skip specialist percentage notation. [Baker’s Percentage](https://www.kingarthurbaking.com/pro/reference/bakers-percentage)
- GOV.UK lets users review answers and return to correct them. Preserve inputs on Back and expose missing answers in the draft. Omit submission language at the external handoff. [Check answers](https://design-system.service.gov.uk/patterns/check-answers/)

## 4. Mobile storyboard · 393 × 844

| Screen and headline | Single dominant image and composition | Actions |
|---|---|---|
| 1 · Who are you buying for? | Full-height loading door. Pallet catches light above centre. Headline and two stacked sector choices sit in the dark foreground above the safe area. | Retail / Foodservice |
| 2 · What should sales know? | Retail sees a tight pallet crop, foodservice an empty prep pan. A single lower panel asks for item, required date and either shelf units or menu covers. | Estimate cases / Skip estimate |
| 3 · How many cases? | One pan rim or pallet edge fills the upper half. Labelled inputs and live arithmetic share the lower half. | Review enquiry |
| 4 · Check your buying note | One front-facing tin fills the upper field for the featured example. Other items retain the sector image. An editable plain-text note sits below. | Save text file / Continue |
| 5 · Take your note to sales | The doorway returns in a closer crop. The draft remains selectable against asphalt, with an instruction to paste it into the official contact form. | Copy note / Open official contact |

## 5. Signature interaction

Sector links lead to the relevant checklist. Foodservice asks for service date, item, covers, usable portions per pack and packs per case. Assume one portion per cover and state it beside the input. Retail asks for item, shelf quantity, replenishment date and packs per case. Both drafts ask sales to confirm case configuration and availability.

Start numeric fields empty. Show a separate worked example: 90 covers ÷ 5 portions per pack = 18 packs. 18 packs ÷ 12 packs per case = 1.5 cases → **2 whole cases**, leaving 6 packs. Retail starts at desired packs. Recalculate from current inputs, rounding up to whole packs and then whole cases. Keep the example independent of any photographed SKU.

Missing or invalid input clears the live result. Explain the affected field inline. Unknown case size becomes “Please confirm packs per case” in the draft. Switching sectors retains shared details and drops irrelevant quantities. Export the reviewed note as UTF-8 text for offline reading. With JavaScript disabled, sector anchors reveal printable checklists, the worked example and the official contact link. Reduced motion uses immediate state changes.

## 6. Palette and type

Asphalt #171B1F backs chalk #F4F1E8 copy. Amber #F1B84B marks the active choice and final case count. Set headlines in Archivo Narrow and quantities in Inter with tabular numerals. Both use the SIL Open Font License. Bundle licence files with self-hosted fonts and fall back to system sans-serif.

## 7. Asset plan

Generate only the door and pan. Caption each use “AI concept illustration.” For the New Moon 425 g example reuse the real packshot at `demos/corporate/gjh/v22/assets/new-moon-nz-425g-front.webp` [verified: docs/gjh-v22/design-brief.md]. Check provenance in `assets/companies/gjh/official/manifest.json` and clear display rights before release. Use the official contact destination [verified: https://gjhglobal.com/contact-us/].

## 8. Image anchors

**A · First screen**

Portrait 2:3 architectural photograph from inside an anonymous receiving bay at dawn. A tall open shutter frames hard morning light. One empty wooden pallet sits just above centre, its slats casting long shadows across grainy asphalt. A worn amber safety stripe enters from the right. Preserve deep charcoal shadow across the lower third for interface placement. Keep the pallet inside a narrow central phone crop. No text, logos, packaging, people or faces.

**B · Foodservice selected**

Portrait 2:3 editorial photograph of one empty stainless steel prep pan on a dark kitchen pass. View it slightly from above so its rolled rim describes a clear rectangle within the central phone crop. Hard side light reveals brushed grain and a single warm amber reflection along the lip. Let the counter disappear into charcoal across the lower half. Quiet working kitchen before service, natural imperfections, no text, logos, packaging, utensils, people or faces.

## 9. Risks, effort and acceptance

**M.** Static HTML, CSS and vanilla JavaScript. Main risks are confusing pack weight with usable yield and hiding fields behind the iPhone keyboard. On a 393 × 844 iPhone verify both paths, thumb targets ≥44 px, 4.5:1 text contrast, safe-area clearance and scrolling with keyboard open. Test exact multiples, partial cases, unknown case size, zero divisors, offline text export, denied clipboard access and no-JS contact access. Reject crops that lose the pallet or pan rim.

## 10. Self score

Taste **9/10** for restrained light and material. Distinctness **8/10** because the arithmetic gives a familiar enquiry flow a trade-specific purpose. Feasibility **9/10** because the buyer can complete the note even with an unknown case size.
