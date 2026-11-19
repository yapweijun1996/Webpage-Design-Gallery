# V11 numbered production model checklist

The production sequence is S01 to S17 in the default expanded mall. The [shop index](README.md) links the published room concepts, inventories and browser verification. This checklist tracks product-model gaps separately from the already installed room anchors and detail GLBs. The initial reconciliation uses the [17-shop report source snapshot](https://github.com/yapweijun1996/Webpage-Design-Gallery/tree/612f0395f70e95627d4090b82ba47c28f0645bb9/docs/goh-joo-hin) and newer source evidence where noted.

A checked item requires evidence for the stated scope, editable source if changed, and acceptance of the exact runtime artifact. Catalogue dimensions are nominal unless a measured sample or engineering drawing supports them. A neutral model based on a product photograph can close an explicitly scoped form study while the measured geometry, current retail label or licensed texture remains open. Keep unverified retail photos as references in their source context.

## S01 New Moon

[Shop design and runtime](01-new-moon/README.md) · [Model inventory](01-new-moon/model-inventory.md) · [Four source sets and deployed GLB hashes](../evidence/v11-product-source-consistency.json) · [Pinned editable upstream demo sources](https://github.com/yapweijun1996/Blender-3D-Gallery/tree/1abda0ff96a4b787877a32ff8915555873a0b686/models/gjh-abalone-cans)

- [ ] **NZ Wild Caught 425 g.** Measure diameter, can height and closures. Match a current batch to the [official front, back and nutrition views](https://www.gjheshop.com/product/new-moon-premium-wild-caught-new-zealand-abalone-425g/), then verify artwork positioning and usage scope.
- [ ] **AU Wild Caught 425 g.** Measure the exact Wild Caught tin and match the red and white edition to the [three official views](https://www.gjheshop.com/product/new-moon-premium-wild-caught-australia-abalone-425g/), then verify usage scope.
- [ ] **SA Premium 4–5 pcs 425 g.** Obtain the exact 4–5 pcs sample and measure it. The [official front, back and nutrition views](https://www.gjheshop.com/product/new-moon-premium-south-africa-abalone-4-5pcs-425g/) remain source references. Verify current edition and usage scope.
- [ ] **MX Premium 454 g.** Measure the exact New Moon tin and obtain a flat label or overlapping photos of the whole circumference, including the 121° sector absent from the [official front and information photos](https://www.gjheshop.com/product/new-moon-premium-mexico-abalone-454g/). Verify edition and usage scope.

The four listings show a nominal 75 × 75 × 120 mm while the current GLBs are about 77.5 mm across and 123.99 mm high. All 11 official photos and the four published GLBs matched the existing SHA-256 receipts when checked on 2026-11-20 SGT. Those checks identify the artwork sources and deployed geometry. Physical dimensions, current print revision, and rights for new retail textures remain open. [Existing demo approval](../v11-newmoon-demo-review.md)

## S02 MILI

[Design and runtime](02-mili/README.md) · [Inventory](02-mili/model-inventory.md) · [Editable sauce study](../../models/gjh-mili-sauce-bottles/README.md)

- [ ] **Original Oyster Sauce 510 g.** Compare cap and shoulder against its exact [catalogue photographs](https://www.gjheshop.com/product/mili-oyster-sauce-510g/). Retain the 55 × 55 × 245 mm nominal envelope and track print artwork separately.
- [ ] **Vegetarian Oyster Sauce 510 g.** Check the companion bottle and cap against the [separate source](https://www.gjheshop.com/product/mili-vegetarian-oyster-sauce-510g/). Confirm the current print edition before texture work.
- [x] **Vegetarian Mock Duck 280 g, unprinted form study.** The official photo shows a tall straight-sided can with rolled rims. The 76 × 113 mm display estimate is a [316-triangle editable study](../../models/gjh-mili-mock-duck/README.md) in the room craft batch. [Official product and photo](https://www.gjheshop.com/product/mili-vegetarian-mock-duck-280g/)
- [ ] **Vegetarian Mock Duck 280 g, exact retail pack.** Confirm measured can dimensions, detailed ends and current print edition against a matching sample or supplier data.

S02 passed on Pages build `8140834cc8e13632` in desktop and 390 px Chrome touch emulation. Both routes reached the cookline story and returned to the concourse. The deployed detail GLB contains 1,742 triangles in three draws, including the can; the parsed Low shop total is 2,762 triangles. The corrected baked plate range leaves both sauce bottles on their authored positions. [Deployment](https://github.com/yapweijun1996/Webpage-Design-Gallery/actions/runs/44634045382)

## S03 GOGO

[Design and runtime](03-gogo/README.md) · [Inventory](03-gogo/model-inventory.md)

- [ ] **Premium Potong Red Bean, historical 6 × 65 g.** Verify contemporary availability and collect a measured product and individual/outer wrappers if available.
- [ ] **Premium Potong Assorted Real Fruit, historical 6 × 65 g.** Verify the fruit format and packaging revision independently of Red Bean. The dated HPB listing and unwrapped cart studies are the historical evidence.

The [dated HPB list](https://www.healthhub.sg/sites/assets/Assets/PDFs/HPB/Food/HCS%20products%20list%20for%20website%20updated%20till%2031%20July%2016.pdf#page=51) confirms both historical records. The current brand page lacks identified pack images and item dimensions for these two records. Retain the cart and its two existing unwrapped forms pending stronger evidence.

## S04 Borsch Med

[Design and runtime](04-borsch-med/README.md) · [Inventory](04-borsch-med/model-inventory.md)

- [x] **Mosquito Repellent Patch, 18 patches, unprinted form study.** The official views support a thin carton with a hanger, a sealed pouch and six rounded-square patches arranged in two columns and three rows. [Editable studies and official views](../../models/gjh-borsch-packs/README.md)
- [ ] **Mosquito Repellent Patch, 18 patches, exact retail pack.** Measure each component, confirm the current print edition and verify the intended artwork use.
- [x] **Lingzhi Cracked Spores Powder 200 mg × 60 twin pack, unprinted form study.** Two cartons follow the nominal single and twin dimensions and sit on the right library shelf. [Editable studies and official views](../../models/gjh-borsch-packs/README.md)
- [ ] **Lingzhi Cracked Spores Powder 200 mg × 60 twin pack, exact retail pack.** Verify with physical samples, including any outer wrap, current label and artwork use.

S04 passed on Pages build `deaf0fd98cc414b0`. Desktop and 390 px touch-emulated Chrome entered the shop, opened both product stories and returned to the atrium. The published room GLB matched the staged Blender export and Low totals 2,798 triangles against the 2,800 per-shop cap. [Deployment](https://github.com/yapweijun1996/Webpage-Design-Gallery/actions/runs/44637538307)

## S05 Pien Tze Huang

[Design and runtime](05-pien-tze-huang/README.md) · [Inventory](05-pien-tze-huang/model-inventory.md)

- [x] **Single 3 g unit, unprinted form study.** The smaller carton in the manufacturer photo supports a nearly square front and narrower side. The [editable 220 × 216 × 100 mm study](../../models/gjh-pzh-single-carton/README.md) preserves the exhibit position and uses photo-estimated proportions.
- [ ] **Single 3 g unit, exact retail carton.** Confirm physical dimensions, closure and current packaging art independently of the enlarged display study.
- [ ] **GJH 10-piece format.** Verify the outer pack shape, size and relationship to the 3 g carton before modeling.

S05 passed on Pages build `ef5f8f14a4d09bd5`. Both Chrome routes entered the shop, opened the carton story, continued behind the counter and returned to the atrium. The published room GLB matched the Blender export. The 40-triangle model is part of the existing room mesh, and the parsed Low shop total is 2,350 triangles. [Deployment](https://github.com/yapweijun1996/Webpage-Design-Gallery/actions/runs/44638720871)

## S06 Flying Wheel

[Design and runtime](06-flying-wheel/README.md) · [Inventory](06-flying-wheel/model-inventory.md)

- [ ] **Air-Dried Singapore Ban Mee 70 g.** The [5 × 70 g outer-pack front, back and side gallery](https://www.gjheshop.com/product/bundle-of-6-flying-wheel-all-natural-air-dried-singapore-ban-mee-noodles-5-x-70g/) shows five wrapped portions under a flexible seal. Obtain exact dimensions, single-sleeve views and current retailer artwork.
- [ ] **Shanghai LaMian 70 g.** The [separate 5 × 70 g outer-pack gallery](https://www.gjheshop.com/product/flying-wheel-all-natural-air-dried-shanghai-lamian-noodles-5-x-70g/) confirms the analogous assembly. Verify regional edition, physical package and sleeve dimensions, and print independently.

The unprinted Blender studies reached the visual review stage. The rendered sleeves and seal still read as stiff parts because the transparent film's continuous wrap did not carry through the side views. The production room retains the loom and catalogue story. Revisit the soft outer-film representation within the existing opaque-room rendering contract.

## S07 Gu Long

[Design and runtime](07-gu-long/README.md) · [Inventory](07-gu-long/model-inventory.md)

- [ ] **Stewed Pork Chops 256 g.** Measure can and roll seam, then verify label position on a single specimen.
- [ ] **Stewed Pork 256 g.** Verify same-edition references and own can profile and artwork. Keep the stepped pyramid distinct.

## S08 SKIPPY

[Design and runtime](08-skippy/README.md) · [Inventory](08-skippy/model-inventory.md)

- [ ] **Creamy Peanut Butter 500 g.** Verify lid and source-backed print details for the nominal 73 × 73 × 124 mm study.
- [ ] **Chunky Peanut Butter 500 g.** Verify its own cap, texture and authorized front and back references. Product viewer and breakfast-chair Sit are separate interaction work.

## S09 SPAM

[Design and runtime](09-spam/README.md) · [Inventory](09-spam/model-inventory.md)

- [ ] **Classic Luncheon Meat 340 g.** Verify the rounded corners and seams against a measured sample. The 100 × 56 × 83 mm study uses a listing proxy.
- [ ] **Lite Luncheon Meat 340 g.** Match measured packaging and current Lite artwork.
- [ ] **Less Sodium Luncheon Meat 340 g.** Match measured packaging and current Less Sodium artwork separately.

## S10 California Mexico

[Design and runtime](10-california-mexico/README.md) · [Inventory](10-california-mexico/model-inventory.md)

- [ ] **Red California Mexico Abalone 454 g.** Verify measured can, lid and current authorized Red artwork.
- [ ] **Black California Mexico Abalone 454 g.** Verify the corresponding separate Black pack. The New Moon Mexico tin has a different product identity.

## S11 Hormel

[Design and runtime](11-hormel/README.md) · [Inventory](11-hormel/model-inventory.md)

- [ ] **Chili No Beans 15 oz.** Confirm actual tin dimensions and current packaging.
- [ ] **Chili With Beans.** Lock pack size and edition before building its separate specimen. Manufacturer resources identify references while current GJH range remains open.

## S12 Zeria

[Design and runtime](12-zeria/README.md) · [Inventory](12-zeria/model-inventory.md)

- [ ] **Lively & Healthy 180 Tablets.** Verify bottle profile, closure and exact retail packaging.
- [ ] **Chondro Max 300 Tablets.** Verify the bottle and outer carton as two pieces, using the current GJH product gallery as a reference.

## S13 Sony

[Design and runtime](13-sony/README.md) · [Inventory](13-sony/model-inventory.md)

- [ ] **WH-1000XM6.** Match earcup, hinge and band shapes to the Sony Singapore model, preserving the separate architectural stand.
- [ ] **NW-A306 Walkman.** Refine the 56.5 × 98.4 × 11.8 mm outer-body study with correct ports, buttons and surfaces.

## S14 LG

[Design and runtime](14-lg/README.md) · [Inventory](14-lg/model-inventory.md)

- [ ] **OLED55C5PSA.** Match cabinet, rear housing, ports and materials within the specified 1,222 × 703 × 45.1 mm body envelope without stand. Keep the separate enlarged architectural screen and verify any new display content in the runtime.

## S15 Casio

[Design and runtime](15-casio/README.md) · [Inventory](15-casio/model-inventory.md)

- [ ] **Casiotone CT-S1BK.** Refine the nominal 930 × 258 × 83 mm, 61-key study with source-backed control and speaker details.
- [ ] **CELVIANO Grand Hybrid GP-510BP.** Build the straight cabinet and three pedals rather than adapting the curved stage grand. Audio and Sit are separate interaction work.

## S16 GP Batteries

[Design and runtime](16-gp-batteries/README.md) · [Inventory](16-gp-batteries/model-inventory.md)

- [ ] **GP Ultra+ AA.** Verify the 14.5 × 50.5 mm cell, terminal shoulders and packaging revision.
- [ ] **GP eTag.** Match the exact case and seam to the manufacturer example. Singapore market availability remains separate.
- [ ] **GP CR2032.** Build a distinct coin-cell specimen and verify package identity before applying markings.

## S17 Gigaset

[Design and runtime](17-gigaset/README.md) · [Inventory](17-gigaset/model-inventory.md)

- [ ] **A170.** Verify the 159 × 48 × 30 mm handset, amber display and cradle geometry from the manufacturer.
- [ ] **COMFORT 550A.** Verify the exact 161 × 52 × 26 mm handset, keypad and 43 × 123 × 99 mm answering base for the black variant. Sofa Sit is separate interaction work.
