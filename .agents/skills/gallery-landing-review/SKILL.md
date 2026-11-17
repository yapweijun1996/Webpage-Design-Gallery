---
name: gallery-landing-review
description: Improve or review multiple company landing demos in Webpage-Design-Gallery. Use when a portfolio change needs a distinct visitor action for each edition and comparable desktop, tablet and mobile captures.
---

# Gallery landing review

1. Record the base Git commit. Read the company registry and each target edition’s metadata. Open the current collection and a representative live demo on desktop and phone. Note what a visitor can discover, compare, choose or take away.
2. For every edition in scope, write down one visitor question, the page element that answers it, the action it enables and the observable result. For example, a packaging guide can compare two drink formats, while a kiln guide can explain what happens in a selected part of a diagram. Attribute company facts to the operator.
3. Edit the edition’s authored sources. The collection’s featured version, artwork, primary action and secondary destination belong in the company registry. Keep existing demo URLs, source attribution, keyboard entry, no-script content and offline behavior usable.
4. Use the company’s browser runner to perform the changed task. Navigate at the intended viewport before capturing. Wait for fonts and the visible artwork. Capture the ordinary first screen at 1440, 768 and 390 CSS pixels. An interaction below the fold also needs a separate behavior check.
5. Generate the visual review with the project QA Python environment and Pillow. For example, run `python scripts/review_landings.py --base HEAD --company yeos --output /tmp/yeos-review.html` before committing. After committing, specify the original base revision. The report reads versioned PNGs and compares the common visible height, accounting for device scale and full-page captures.
6. Inspect the report, then open the real pages at normal size. Check which element first draws attention, whether the primary action names its destination, and whether it remains readable and keyboard-operable on a phone. Record specific defects and recheck any fix. An unchanged first screen can be correct for a secondary workflow.
7. Update the per-company design notes with the decision and its evidence. Rebuild the gallery, run its required checks and review a nested Pages-style URL. For an authorized publication, verify the pushed SHA, public build ID and a representative real interaction for every affected company.


## Working from visual anchors

Use the project's style atlas when the brief calls for image references. Give each edition one primary composition and classify additional directions as alternatives. Record the designer's layout choice, the visitor action and the source artwork in the company directions file. Compare the reference with the working page at desktop and phone sizes. Apply the hierarchy and interaction where useful, then recapture the changed edition. Keep product sizes, package facsimiles, dates and logistics grounded in the company's sources. If an illustrative reference invents a material detail, typeset a fresh reference with verified local artwork. Verify the full-size image, its provenance, the link to the actual demo and the link from the demo footer. [Project atlas procedure](../../../docs/landing-atlas/README.md)
