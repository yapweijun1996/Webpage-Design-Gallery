# 1. Rochor Threshold

Step through a Singapore five-foot-way into an imagined provision shop. At each step, a museum-style caption lets the reader check what the historical record supports.

## 2. Visitor and job-to-be-done

A heritage reader arriving on a phone wants to cite the shop’s origin accurately and explain what the New Moon date means. Success is finding either original source within two taps of the relevant scene.

## 3. External benchmarks

- **Anne Frank House.** Its tour gives the entrance and bookcase landing their own stops. Borrow the spatial grammar of crossing one recognisable boundary. Avoid a floor plan on a narrow screen. [The Secret Annex](https://www.annefrank.org/en/anne-frank/secret-annex/)
- **Tenement Museum.** Its restored apartments carry the stories of specific occupants. Borrow the practice of identifying a recreated space as such. Avoid assigning a family or incident to an imagined interior. [97 Orchard Street](https://www.tenement.org/explore/97-orchard-street/)
- **Rijksmuseum.** Its Vermeer exploration lets a visitor move from a whole painting to a telling detail. Borrow one deliberate change of framing. Avoid a zoom interface that requires two hands. [Closer to Johannes Vermeer](https://www.rijksmuseum.nl/en/story/closer-to-johannes-vermeer)
- **National Gallery Singapore.** Named artwork stops make its audio guide easy to enter midway. Borrow descriptive stop titles and direct entry. Avoid requiring audio to understand a caption. [Siapa Nama Kamu?](https://www.nationalgallery.sg/sg/en/visit/tours/audio-guide.tour.html/siapa-nama-kamu.html)

## 4. Mobile storyboard · 393 × 844

Each screen uses one edge-to-edge still. Keep the sightline in the upper two-thirds and set the headline, open caption and actions against a charcoal footer. Every still carries “AI concept illustration.”

| Screen and headline | Dominant frame | Open source caption | Actions |
|---|---|---|---|
| 1 · Along Rochor Road | A wide view down the arcade. One sunlit jamb interrupts the shade. | Goh Joo Hin traces its beginnings to a provision shop on Rochor Road. [verified: docs/gjh-story/01-origins.md] | Approach doorway · Read company account |
| 2 · At the sill | Crop A to the junction of glazed tile and timber. | The company places the shop here in the 1940s. [verified: docs/gjh-story/01-origins.md] | Step inside · Read company account |
| 3 · Inside the provision shop | B opens wide. A stripe of light continues from the sill across the counter. | The company account identifies a provision shop. Its precise layout remains undocumented in the reviewed sources. [verified: docs/gjh-story/01-origins.md] | Look closer · Read company account |
| 4 · What does 1959 date? | Crop B to the lit counter edge. Leave its surface bare. | New Moon dates its brand history to 1959. [verified: docs/gjh-story/02-house-brands.md] | Check the record · Read brand history |
| 5 · A date you can cite | Hold B still as the caption expands beneath the counter. | The Singapore New Moon canned-abalone mark was filed on 23 April 1959. The filing establishes a brand milestone only. [verified: docs/gjh-multibrand-directory.md] | Open trademark record · Return outside |

## 5. Signature interaction

“Step inside” briefly darkens the sill, cuts to the matching interior and reveals its caption within 240 ms. Each stop is a semantic section with a fragment ID. Native links advance, preserve browser Back and land focus on the heading. Ordinary scrolling also works. With JavaScript off, all five figures and citations appear in order. Reduced motion uses immediate cuts and native anchor jumps.

## 6. Palette and type

Charcoal #171A16 grounds ivory #F1E6CC captions. Glaze green #426254 echoes the tiles on action fills. Use Cormorant Garamond Semibold at 42 px for headlines and Instrument Sans at 17 px for reading. Both families use the SIL Open Font License. Bundle their licence files if self-hosting. Georgia and Arial provide fallbacks.

## 7. Asset plan

Generate only A and B. Reuse each WebP through CSS cropping and preload A alone. Use the links in [origins](../gjh-story/01-origins.md), [brand history](../gjh-story/02-house-brands.md) and the [trademark register](../gjh-multibrand-directory.md) for the caption actions. Keep the official photo composite as a research reference pending individual frame identification and reuse rights. [verified: assets/companies/gjh/official/gjh-history-composite.jpg]

## 8. Image anchors

**A · First screen**

Portrait 2:3 cinematic architectural photograph of an imagined Singapore shophouse five-foot-way, seen at standing eye level. Follow a narrow seam of worn green glazed tile toward one open timber doorway in the central third. Afternoon sun catches the right jamb and slips across the sill. Keep the lower wall and foreground in deep charcoal shade. Straight verticals, restrained grain, natural humidity, one continuous view. Exclude people, faces, text, logos, signs and packaging.

**B · Interaction state**

Portrait 2:3 cinematic architectural photograph from one pace inside an imagined Singapore provision shop, facing a bare dark timber counter at standing eye level. A sliver of green glazed floor remains at the sill. Late afternoon light enters from the right and grazes the worn counter edge at mid-height. Let the wood grain emerge gradually from shadow, with a quiet dark lower third. Single continuous room, no people, faces, lettering, logos, packaging or documents.

## 9. Risks, effort and acceptance

**M.** Matching the light and camera height across two images is the main production risk. At 393 × 844, verify the jamb survives both crops, the illustration label stays visible and both actions clear Safari’s safe area. Test 44 px targets, 4.5:1 text contrast, VoiceOver heading order, Back, reduced motion and no-JS reading. Follow the final citation to record T5924841J. Ask a reader what 1959 dates and which image is documentary.

## 10. Self score

**Taste 9/10** for the cut on the shaft of light. **Distinctness 8/10** because opening the source is part of crossing the shop. **Feasibility 9/10** with two stills, five HTML sections, CSS and optional vanilla JavaScript.
