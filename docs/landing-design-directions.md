# Landing design directions

The gallery contains 46 independent editions. Each collection opens with two useful starting points, one visual subject and a separate link to the official company. The edition notes below explain what a visitor can do on each page.

| Company | First-screen idea | A second reason to explore | Edition notes |
| --- | --- | --- | --- |
| Goh Joo Hin | A family meal gives the food portfolio a human scale. From the collection, jump to the brand index and choose a business sector. | For a trade visitor, open the Partner Desk and prepare a specific enquiry. | [16 GJH decisions](gjh-landing-improvements.md) |
| Yeo Hiap Seng | Put a glass beside a packaging decision. Let the visitor select two drinks and share the comparison. | Start with a flavour, follow it to a drink, then explore its format or record a tasting note. | [15 Yeo’s decisions](yeos-landing-improvements.md) |
| Thow Kwang Pottery Jungle | Give the kiln the first screen. Visitors can select the firebox, chamber or chimney and read the explanation in context. | A separate visit planner leads individual visitors, tour groups and workshop participants to the appropriate official information. | [15 Thow Kwang decisions](thow-kwang-landing-improvements.md) |

## Visual references for every edition

The [live landing style atlas](https://yapweijun1996.github.io/Webpage-Design-Gallery/style-atlas/) and [GitHub image index](../style-atlas/README.md) contain 20 distinct directions per company. GJH has 16 primary and four alternate references. Yeo’s and Thow Kwang each have 15 primary and five alternate references. The primary is the visual design brief for the linked edition. An alternate is a second proposal for the same visitor task. Every live footer links to its own reference.

The atlas shows the art director’s adaptation note and a separate captured preview of the working demo. Mockups express composition and hierarchy. The operator’s sources and verified artwork control the details on the live page. Review dimensions, packaging, historical scenes and visitor logistics before implementing them. [Authoring and verification](landing-atlas/README.md)

## Why these directions fit

- **Goh Joo Hin** lists brands spanning groceries, health and electronics. A sector index helps a visitor recognise a name, while the trade brief serves a different audience. The family dining scene is concept artwork. [Official brand directory](https://www.gjh.com.sg/explore-our-brand/)
- **Yeo’s** lists package size and container type for its Singapore drinks. Showing both in aligned rows helps visitors distinguish a 1 L carton from a 1.5 L bottle. The drink cards link to the official product information. [Soy Bean Milk](https://yeos.com.sg/product/soy-bean-milk/) · [Chrysanthemum Tea](https://yeos.com.sg/product/chrysanthemum-tea/)
- **Thow Kwang** operates a dragon kiln and offers group tours. The diagram interprets its structure, while visit and workshop actions send readers to the operator for current arrangements. [Official kiln tours](https://www.potteryjungle.com/dragonkiln-tour) · [Official workshops](https://www.potteryjungle.com/pottery-workshop)

## Compare the designs

The [review tool](../scripts/review_landings.py) creates an offline HTML report from the checked-in captures. Use a Python environment with Pillow. The example compares all current editions with the previous portfolio release.

```sh
python scripts/review_landings.py --base 249cf11 --output /tmp/landing-comparisons.html
```

Add `--company thow-kwang` to select a collection. Repeat `--width` to select any of 390, 768 and 1440 CSS pixels. The report pairs editions by stable design ID and uses the same visible height for each pair. It reads saved screenshots. Use the [project review skill](../.agents/skills/gallery-landing-review/SKILL.md) and the company browser runners to capture and exercise new work.

The KB-MCP Agent Skills registry uses the project-specific identifier `webpage-design-gallery:landing-edition-review` for the review skill. The repository file is the source for the registered procedure.

## Editorial review

On a 390 px wide phone, both collection actions fit in the first screen for each company. Each opened its intended demo or in-page section from the keyboard. At desktop size the image and the actions share one row. The Thow Kwang phone layout gives its schematic its natural proportions so the firebox and chimney stay in the same frame.

The family dining illustration gives GJH an immediate point of recognition, though the portfolio link carries more of the work for electronics and wellness visitors. Yeo’s makes a factual pack-size comparison visible alongside a softer, flavour-led route. Thow Kwang’s diagram shows visitors what they will explore before they enter the tour. These are editorial judgments. No visitor conversion or sales outcome was measured.
