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

- [x] **Original and Vegetarian Oyster Sauce 510 g, unprinted profiles.** The separate front and rear galleries show the same long tapered shoulder and short red-orange cap at the scale of the installed studies. Both keep the 55 × 55 × 245 mm nominal listing envelope. [Original gallery](https://www.gjheshop.com/product/mili-oyster-sauce-510g/) · [Vegetarian gallery](https://www.gjheshop.com/product/mili-vegetarian-oyster-sauce-510g/)
- [ ] **Exact sauce-bottle closure and retail print.** Confirm the cap and the narrow glass lip below it from measured samples. Verify each current print edition and artwork before texturing.
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
- [x] **Manufacturer ten-unit intermediate carton, unprinted form study.** The 2023 front and back photos show a closed carton approximately twice as wide as tall and an offset film tear strip. The [editable companion study](../../models/gjh-pzh-ten-carton/README.md) uses these visible proportions.
- [ ] **Single 3 g unit, exact retail carton.** Confirm physical dimensions, closure and current packaging art independently of the enlarged display study.
- [ ] **GJH 10-piece format.** The GJH listing uses a photo marked as a one-unit carton. The manufacturer documents a ten-unit intermediate carton with an outer film tear strip from batch 2208129. Obtain Singapore-edition outer-pack and open-carton views and dimensions to confirm that version and how it holds the 3 g units. [GJH listing](https://www.gjheshop.com/product/zhang-zhou-pien-tze-huang-10-pcs/) · [Manufacturer packaging notice](https://www.pzhchina.com/gsdt/info_139.aspx?itemid=28536)

S05 passed on Pages build `ef5f8f14a4d09bd5`. Both Chrome routes entered the shop, opened the carton story, continued behind the counter and returned to the atrium. The published room GLB matched the Blender export. The 40-triangle model is part of the existing room mesh, and the parsed Low shop total is 2,350 triangles. [Deployment](https://github.com/yapweijun1996/Webpage-Design-Gallery/actions/runs/44638720871)

## S06 Flying Wheel

[Design and runtime](06-flying-wheel/README.md) · [Inventory](06-flying-wheel/model-inventory.md)

- [ ] **Air-Dried Singapore Ban Mee 70 g.** Goh Joo Hin's 5 × 70 g catalogue photos show five wrapped portions under a flexible seal. Obtain exact dimensions, single-sleeve views and current retailer artwork. [Front](https://www.gjheshop.com/wp-content/uploads/2025/03/8888140500107_01.jpg) · [Back](https://www.gjheshop.com/wp-content/uploads/2025/03/8888140500107_02.jpg) · [Angled view](https://www.gjheshop.com/wp-content/uploads/2025/03/8888140500107_03.jpg)
- [ ] **Shanghai LaMian 70 g.** Goh Joo Hin's separate 5 × 70 g catalogue photos confirm the analogous assembly. Verify regional edition, physical package and sleeve dimensions, and print independently. [Front](https://www.gjheshop.com/wp-content/uploads/2025/03/8888140500114_01-600x600.jpg) · [Back](https://www.gjheshop.com/wp-content/uploads/2025/03/8888140500114_02-600x600.jpg) · [Angled view](https://www.gjheshop.com/wp-content/uploads/2025/03/8888140500114_03-600x600.jpg)

Two new Blender candidates tested a closed envelope with a continuous shoulder and crimp ridge, followed by a resampled crown and an independently shaped oval window. The latest review passed the pack proportions, oval windows and wide-fold versus fine-curl noodle distinction. Both packs still read as a single stiff shell in three-quarter view. Five separate rounded sleeve crowns under the common film, the shoulder-to-end transition, and a visibly thin crimp in end view remain unaccepted. Obtain top and end close-ups of both exact SKUs with the film edge and each sleeve shoulder visible, plus a physical width, height and depth reading. The installed room retains the loom and catalogue story.

The retained room passed Desktop and 390 px touch-emulated Chrome on Pages build `101413f9fe9fecb4`. The room GLB matched the local baseline. [Deployment](https://github.com/yapweijun1996/Webpage-Design-Gallery/actions/runs/44641223105)

## S07 Gu Long

[Design and runtime](07-gu-long/README.md) · [Inventory](07-gu-long/model-inventory.md)

- [x] **Stewed Pork Chops and Stewed Pork 256 g, unprinted form studies.** Each official photo shows rolled rims and a recessed pull-tab lid. The [editable shelf specimens](../../models/gjh-gulong-tins/README.md) share a short 90 × 75 mm display estimate.
- [ ] **Stewed Pork Chops 256 g.** Measure can and roll seam, then verify label position on a single specimen.
- [ ] **Stewed Pork 256 g.** Verify same-edition references and own can profile and artwork. Keep the stepped pyramid distinct.

S07 passed on Pages build `81963db3c3709f95`. Both Chrome routes reached the story and left comparison shelf and returned to the atrium. The room GLB matched the Blender export and Low totals 2,798 triangles. [Deployment](https://github.com/yapweijun1996/Webpage-Design-Gallery/actions/runs/44643286042)

## S08 SKIPPY

[Design and runtime](08-skippy/README.md) · [Inventory](08-skippy/model-inventory.md)

- [x] **Creamy and Chunky Peanut Butter 500 g, unprinted form studies.** The [editable pair](../../models/gjh-skippy-jars/README.md) uses the 73 × 73 × 124 mm nominal envelope, narrowed shoulders, rounded heels and separate ribbed lids from distinct catalogue photos.
- [ ] **Creamy Peanut Butter 500 g.** Confirm physical lid dimensions and source-backed current print details.
- [ ] **Chunky Peanut Butter 500 g.** Verify physical closure and current edition and obtain permission for its own front and back artwork. Product viewer and breakfast-chair Sit are separate interaction work.

S08 passed on Pages build `3b578e6230629f54`. Desktop and touch-emulated Chrome reached the story and upper comparison shelf, viewed both jars and returned to the atrium. The room GLB matched the Blender export and Low totals 2,796 triangles. [Deployment](https://github.com/yapweijun1996/Webpage-Design-Gallery/actions/runs/44644961545)

## S09 SPAM

[Design and runtime](09-spam/README.md) · [Inventory](09-spam/model-inventory.md)

- [x] **Classic, Lite and Less Sodium 340 g, unprinted form studies.** Three [editable nominal-envelope specimens](../../models/gjh-spam-tins/README.md) share the observed rounded rectangle, projecting rolls, recessed lid and elongated offset ring.
- [ ] **Classic Luncheon Meat 340 g.** Verify the rounded corners and seams against a measured sample. The 100 × 56 × 83 mm study uses a listing proxy.
- [ ] **Lite Luncheon Meat 340 g.** Match measured packaging and current Lite artwork.
- [ ] **Less Sodium Luncheon Meat 340 g.** Match measured packaging and current Less Sodium artwork separately.

## S10 California Mexico

[Design and runtime](10-california-mexico/README.md) · [Inventory](10-california-mexico/model-inventory.md)

- [x] **Red and Black 454 g unprinted form studies.** The [editable pair](../../models/gjh-california-mexico-tins/README.md) uses a photo-estimated Ø75 × 120 mm display envelope. Both specimens were viewed in desktop and touch-emulated Chrome.
- [ ] **Red California Mexico Abalone 454 g retail pack.** Verify the measured can, closure and current authorized artwork for the [Red catalogue product](https://www.gjheshop.com/product/red-california-mexico-abalone-454g/).
- [ ] **Black California Mexico Abalone 454 g retail pack.** Verify the measured can, closure and current authorized artwork for the [Black catalogue product](https://www.gjheshop.com/product/black-california-mexico-abalone-454g/).

The S10 release passed both Chrome routes on Pages build `ef9bbe527835efd9`. The public GLB matched the local export SHA-256. [Pages deployment](https://github.com/yapweijun1996/Webpage-Design-Gallery/actions/runs/44650655253)

## S11 Hormel

[Design and runtime](11-hormel/README.md) · [Inventory](11-hormel/model-inventory.md)

- [x] **Chili No Beans and With Beans 15 oz, unprinted form studies.** Each [editable tin](../../models/gjh-hormel-chili/README.md) pairs a straight wall with a projecting gold top rim and silver base. Both manufacturer front photos identify 15 oz retail references.
- [ ] **Chili No Beans 15 oz retail match.** Obtain a measured physical sample, closure views and current authorized artwork.
- [ ] **Chili With Beans 15 oz retail match.** Confirm the intended GJH pack and edition. Obtain a measured sample, closure views and current authorized artwork.

S11 passed both Chrome routes with matching live asset bytes across Pages builds `931948f65ba9f026` and `9eaeb36d80cfe04e`. [Pages deployment](https://github.com/yapweijun1996/Webpage-Design-Gallery/actions/runs/44651827173)

## S12 Zeria

[Design and runtime](12-zeria/README.md) · [Inventory](12-zeria/model-inventory.md)

- [x] **Chondro Max 300 and Lively & Healthy 180 unprinted form studies.** Three [editable specimens](../../models/gjh-zeria-packs/README.md) distinguish the individual bottles, closures and Chondro outer carton.
- [ ] **Lively & Healthy 180 Tablets retail match.** Verify the physical bottle dimensions, exact closure tooling and authorized packaging.
- [ ] **Chondro Max 300 Tablets retail match.** Verify physical bottle and carton dimensions, exact closure tooling, clear material and authorized packaging.

S12 passed both Chrome routes with matching live asset bytes across the same Pages builds.

## S13 Sony

[Design and runtime](13-sony/README.md) · [Inventory](13-sony/model-inventory.md)

- [x] **WH-1000XM6 Sand Pink form study.** The [editable headset](../../models/gjh-sony-audio/README.md) has separate pads, sliders and folding-hinge forms. The headphone display stand remains a separate exhibit fixture.
- [x] **NW-A306 exterior study.** Nominal 56.5 × 98.4 × 11.8 mm envelope with the four bottom openings, rear mic and seven right-side controls in the documented order.
- [ ] **Precision headset details.** Obtain measured exterior and hinge dimensions plus port and microphone close-ups for a dimensioned retail match.
- [ ] **Precision Walkman details.** Confirm control spacing, edge radii, rear groove count and surface finish against a measured unit.

## S14 LG

[Design and runtime](14-lg/README.md) · [Inventory](14-lg/model-inventory.md)

- [x] **OLED55C5PSA stand-free cabinet.** The [editable model](../../models/gjh-lg-oled/README.md) uses the 1,222 × 703 × 45.1 mm envelope, stepped rear housing, vent and four VESA mounts. The enlarged gallery screen retains its own content.
- [ ] **Exact OLED55C5PSA.ATC jack panel.** LG Singapore specifies four HDMI inputs, with eARC on HDMI 2, three USB ports, Ethernet, optical out and RF. Its support page supplies a C5 family setup guide that shows the rear cable routing and individual plug types. It leaves the exact Singapore jack order, orientation and placement open. Obtain a sharp connector photo or labeled jack diagram for the ATC unit. [Singapore specifications](https://www.lg.com/sg/tvs-soundbars/oled-evo/oled55c5psa/) · [ATC support and setup guide](https://www.lg.com/sg/support/product-support/cs-OLED55C5PSA.ATC/)

S13 and S14 passed both Chrome routes on Pages build `e41e09428bb8f71f` with matching live GLB hashes. [Pages deployment](https://github.com/yapweijun1996/Webpage-Design-Gallery/actions/runs/44653176777)

## S15 Casio

[Design and runtime](15-casio/README.md) · [Inventory](15-casio/model-inventory.md)

- [x] **Casiotone CT-S1BK.** Published envelope, 61-key arrangement, dark speaker deck and top controls in the [editable model](../../models/gjh-casio-instruments/README.md).
- [x] **CT-S1BK control layout, unprinted exhibit detail.** The power button, offset volume knob, four utility buttons, seven main tone buttons and separately spaced tone variation button follow the manufacturer manual and AR reference. [CT-S1 guide, EN-4](https://www.casio.com/content/dam/casio/global/support/manuals/electronic-musical-instruments/pdf/008-en/c/CTS1_usersguide_EN.pdf#page=5) · [Casio AR references](https://www.casio.com/us/electronic-musical-instruments/web-ar/)
- [x] **CELVIANO Grand Hybrid GP-510BP.** Separate closed-lid, closed-cover cabinet with three pedals on the rear wall. The recital grand stays in the centre.
- [ ] **Detailed controls and finishes.** Obtain measured views for exact cap and switch dimensions, materials, indicators and key detail. Casio's AR references are simulations. The GP-510BP's open control panel is documented in the catalogue for a separate open-state study. Instrument audio and Sit are separate interaction work. [Casio AR references](https://www.casio.com/us/electronic-musical-instruments/web-ar/) · [Grand Hybrid catalogue](https://www.casio.com/content/dam/casio/global/emi/catalog/pdf/ja/celviano-grand-hybrid.pdf)

## S16 GP Batteries

[Design and runtime](16-gp-batteries/README.md) · [Inventory](16-gp-batteries/model-inventory.md)

- [x] **GP Ultra+ AA, white eTag and CR2032.** Three [editable models](../../models/gjh-gp-power/README.md) use manufacturer envelopes. The AA shows its stepped terminal and the eTag shows the cover seam.
- [ ] **GP Ultra+ AA and GP CR2032 packaging.** Confirm the intended sales revision and obtain authorized art before applying pack or cell markings.
- [x] **GP eTag cover-release aperture, exhibit detail.** GP Malaysia's white-unit FAQ photo supports a rounded recess on the sidewall below the cover seam. The [editable model](../../models/gjh-gp-power/README.md) retains the Malaysia-listed envelope and uses an estimated recessed opening. [Official close-up](https://cdn.shopify.com/s/files/1/0728/4939/1936/files/FAQ_eTag_location_not_updating_img_8_v2.png?v=1750657965)
- [ ] **GP eTag precise apertures.** Measure the pinhole, seam and lanyard opening on an identified white unit. Confirm the lanyard routing and the Singapore market variant. GP's Nordic TAGA drawing specifies a different envelope. [TAGA specification](https://www.gpbmnordic.com/Product/Files/Global/Product%20Specification%20eTag.pdf)

## S17 Gigaset

[Design and runtime](17-gigaset/README.md) · [Inventory](17-gigaset/model-inventory.md)

- [x] **A170 and COMFORT 550A black.** Two [editable handset and base sets](../../models/gjh-gigaset-handsets/README.md) distinguish the amber A170 face from the 550A display and answering base controls. The handset envelopes and the 550A base use manufacturer dimensions.
- [ ] **A170 base dimensions.** Compare the H, W and D axes against a measured black A170 cradle. The shallower base orientation is inferred from the photo and nominal dimensions.
- [ ] **Precision retail detail.** Confirm the A170 cradle curvature, both key legends and display appearance against measured parts and authorized artwork. Sofa Sit is separate interaction work.

S15 through S17 passed the map, store entry, story, model view and exit checks in desktop and touch-emulated Chrome. Their model receipts record build `2a5c452460ef78fd` and the installed GLB checksums. [Casio receipt](../../models/gjh-casio-instruments/receipt.json) · [GP Batteries receipt](../../models/gjh-gp-power/receipt.json) · [Gigaset receipt](../../models/gjh-gigaset-handsets/receipt.json)
