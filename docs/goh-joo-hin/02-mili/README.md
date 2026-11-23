# S02 · MILI

**Status: the sauce comparison and two unprinted bottle forms are implemented.** The four concept drawings show the wider proposal. The 280 g Mock Duck counter now also includes an unprinted tall-tin study. Retail packaging art remains source-linked.

[MILI brand research and primary product references](brand-research.md)

## Interior design

Use the copper hood and moss-tile pass to tell the story of a pantry ingredient becoming part of a meal. Existing MILI art establishes the identity, and the concept room uses its darker lacquer, moss tile, bone ceramic and copper palette. Take the plant off the centre pass so it no longer interrupts the work surface in the 393 px first-person view. Keep greenery where it frames the back wall without covering the branded cookline.

| Element | Shop-local position | Plan |
| --- | --- | --- |
| Threshold | XZ (0, 6.0) | From the entrance, approach XZ (0, 2.55) and follow either side aisle. |
| Copper hood and cookline | Hood XYZ (0, 2.38, 0.5) | Retain the suspended main fixture and the serving plate; keep the cookline reachable visually from the browse points. |
| Pantry wall | Approx. X −4.43, Z 3.25 | Keep the wall stock shallow. Proposed eye-height stock positions organize the two verified 510 g sauces, followed separately by the 280 g mock-duck can. |
| Aisles and benches | Aisle X −1.32 and 1.32, bench centres XZ (−2.55, −0.8) and (3.4, −1.97) | Retain both Sit anchors. Leave the bench exits at local Z 0.4 and −0.77 open, and use the side routes to reach the rear brand artwork. |

The world origin is XYZ (0, 0, −6), with +Z toward the entrance. Route and fixture positions come from the [interior programme](../../gjh-v11-interior-program.json). The 393 px baseline was inspected in first person and the 1440 px baseline includes the whole hood from the entry.

## Visitor story

The Inspect point at the front of the cookline introduces MILI as a Goh Joo Hin house brand launched in 1981 and shows how its packaged pantry products cover fruits, vegetables, vegetarian food, meat, seafood and sauces. At the cookline, visitors can compare the two officially listed 510 g sauces. GJH lists oyster extract in the regular sauce and mushroom extract in the vegetarian version. The story mentions the vegetarian mock-duck tin and links to the official sauce catalogue. The display copy uses the official catalogue and recognises each distinct product without depicting MILI as a noodle manufacturer. [GJH history](https://gjh.com.sg/about-us/) · [MILI Oyster Sauce](https://www.gjheshop.com/product/mili-oyster-sauce-510g/) · [MILI Vegetarian Oyster Sauce](https://www.gjheshop.com/product/mili-vegetarian-oyster-sauce-510g/)

## Display and model plan

| Product selection | Source | Model deliverable |
| --- | --- | --- |
| MILI Vegetarian Oyster Sauce 510g | [Official GJH eShop imagery](https://www.gjheshop.com/product/mili-vegetarian-oyster-sauce-510g/) | Installed unprinted silhouette at the cookline. Uses the nominal 55 × 55 × 245 mm listing envelope and the shoulder and cap from the catalog view. |
| MILI Oyster Sauce 510g | [Official GJH eShop imagery](https://www.gjheshop.com/product/mili-oyster-sauce-510g/) | Installed companion form. Both catalog photos support the shared shoulder profile and red-orange closure. The exact regional labels remain source links. |
| MILI Vegetarian Mock Duck 280g | [Official GJH eShop listing](https://www.gjheshop.com/product/mili-vegetarian-mock-duck-280g/) | The [official photo](https://www.gjheshop.com/wp-content/uploads/2024/04/a08ee787192ce59100d8378c5118b4a8.jpg) shows a tall tin with gold-toned rims. The [unprinted runtime study](../../../models/gjh-mili-mock-duck/README.md) uses an estimated 76 × 113 mm diameter and height. Measured dimensions and retail artwork remain open. |

Installed display assets are the [copper hood](../../../demos/corporate/gjh/v11/assets/interiors/s02-hawker-stall-exhaust-hood-balanced.glb) and [MILI detail pack](../../../demos/corporate/gjh/v11/assets/interiors/s02-mili-details.glb). The [editable Blender bottle study](../../../models/gjh-mili-sauce-bottles/README.md) records the measured envelope and inferred shoulder model. The models carry no retail label art.

[Interior concept](interior-concept.webp) · [Top-down floor plan](floor-plan.webp) · [Model inventory](model-inventory.md) · [Product form study](product-model-reference.webp) · [Player view after changes](browser-walkthrough.webp)

The built-in image generator produced the concept and unprinted geometry studies. The board proposes backless bench styling and tall side glazing. The runtime keeps the glass shell and relocates the two working benches to the clearances in the unified room plan. The form study is for silhouette exploration. The cookline models use the official product listings for physical dimensions. The tin shape and pack art remain under research.

The centre pass is clear of its decorative plant. Motion into the store passed with a keyboard in 1440 × 900 Chrome and a touch joystick in 393 × 700 emulation. MILI’s rear brand artwork opened through Inspect and returned to Explore. Both existing bench seats were checked during baseline. An entrance sample recorded one interval of at least 50 ms on desktop; the phone-emulated sample recorded none. These short measurements cover the entry only.

## Catalog images at the cookline

Use the existing [MILI brand cover](../../../demos/corporate/gjh/v11/assets/mili-brand-cover.jpg) as cooking context. Pair it with distinct links to the [vegetarian sauce front](https://www.gjheshop.com/wp-content/uploads/2023/07/ML20Veg20Oyster20Sauce_01.jpg), [regular sauce front](https://www.gjheshop.com/wp-content/uploads/2023/07/ML20Oyster20Sauce_01.jpg) and [mock duck listing and photo](https://www.gjheshop.com/product/mili-vegetarian-mock-duck-280g/). The jars in the generated views are placement studies. The guide on the front of the cookline names the three unprinted studies in their order as you face the hood.

## Interior viewpoints

Four generated views describe one proposed room and its visitor circulation. Compare placements with the separately annotated floor plan.

[1. Entrance](interior-concept.webp) · [2. Signature display](signature-display.webp) · [3. Furniture and aisle](furniture-angle.webp) · [4. Back toward the entrance](reverse-to-entry.webp)

Chrome verified the cookline action on published build `f161060cbd89bbc0` at 1440 × 900 and 390 × 844. Keyboard and touch joystick routes used the existing entrance. The story opened without starting a 3D preview and linked to the official sauce catalogue. The desktop run verified Simplified Chinese and Malay, then returned to English. Opening a New Moon product afterward restored the standard eShop destination. The revised detail GLB loaded in both runs. [Runtime Chrome captures](cookline-runtime.webp) · [Pages deployment](https://github.com/yapweijun1996/Webpage-Design-Gallery/actions/runs/44548809401)

### Reading the three cookline studies

From the visitor side of the island, the regular Oyster Sauce 510 g is on the left, Vegetarian Oyster Sauce 510 g is in the centre, and Vegetarian Mock Duck 280 g is on the right. The framed guide states this order directly on the green-tiled counter. Inspect opens the existing sauce comparison and its official catalogue link. [Product listing sources](brand-research.md)

The cookline Story opens on the sauce comparison. Open **Choose a cookline sample** to inspect either bottle or the tin. Each choice shows the product name, weight, the context for its unprinted form and a link to its own GJH eShop listing. The cover photograph shows a prepared dish. **Cookline overview** returns to the comparison and sauce catalogue. The selector and product copy support English, Simplified Chinese and Malay. [Keyboard, touch and cross-tab regression](../../../tests/browser_gjh_mili_catalogue.py)

The earlier plaque projected to 996 CSS px across a 390 px viewport at the first-person standing point. The replacement spans x = 12–378 px at that point, so the entire product key fits next to the Story action. The same counter route at 1440 px places the guide at x = 524–916 px. Both visits began at the Map and continued through the automatic door, the comparison story and the exit. The six sampled draw counts matched before and after at each width, as did the 163 phone and 198 desktop HTTP asset paths. These are Chrome Low and Detailed measurements on the desktop test host. [390 px comparison](cookline-label-390.webp) · [1440 px comparison](cookline-label-1440.webp)


Five advisers passed the revised plaque for the front approach and counter.

| Review | Observation |
| --- | --- |
| Visual | The cream lettering, fine brass edge and green face fit the tile grid. The two bottle bodies, tin and serving plate remain visible above the plaque. |
| Mobile | All three names and weights fit on the 390 px counter frame. Story, Next, Run and the joystick remain reachable. |
| Brand | The two 510 g sauces and 280 g mock duck tin match the supplier records. The two unprinted bottle studies depend on the label for identification. |
| Spatial flow | From the visitor side, the two bottles and the tin line up left, centre and right. The aisle and Story anchor stayed in place. |
| Lighting | No glare crossed a text row in either counter frame. Representative cream-to-green pixel contrast measured 10.04:1 at 390 px and 9.75:1 at 1440 px. |

The plaque is intended for close reading. Its text is too small to read across the room. [Official references and packaging limits](brand-research.md)

### Whole-shop review

| Area | Assessment | Finding |
| --- | --- | --- |
| Visual composition | Partial | Both entrances frame the suspended copper hood, tile island, stocked wings and side passages. On the central axis the hood overlaps the rear food artwork. Framed side windows narrow the view across the storefront. |
| Counter and mobile controls | Partial | The approach shows both capped bottles, the tin and the three-line guide. At the closest 390 px first-person stop, Objectives crosses the bottle bodies and the caps extend above the visible frame. The entire plaque remains readable. Story and Next stay reachable. |
| Draw budget | Pass | Six phone stops used 43, 50, 45, 24, 22 and 25 draws. The matched desktop counts were 76, 73, 71, 49, 43 and 70. |
| Network and frame time | Partial | The phone requested the same 163 local paths and desktop the same 198. The counter sign now uses 126,720 texels. Matched host frame timing covers the arrival, entrance and cookline. Timing on a physical handset remains open. [Frame samples](../../evidence/gjh-v11-shop-frame-timing/README.md) |

| Additional area | Assessment | Finding |
| --- | --- | --- |
| Spatial plan and entry | Pass on the exercised routes | Both side aisles and the centre approach at the 4.7 m entrance remained clear. The finished lot is 10.5 m deep. Each bench route returned through the door to the atrium and observed it shut. |
| Product actions | Individual catalogue Inspect passes. Product rotation and MILI Bag support remain open. | The physical Story opens its shared comparison. Its selector exposes separate read-only details and an official product link for each of the three form studies. Chrome verified the counter and exit routes at 390 px with touch and at 1440 px with the keyboard. |
| Seating and other actions | Pass for both benches and all ten registered fixtures | On revision `22d7c788`, the 390 px touch and 1440 px keyboard routes each exercised both benches, all ten fixtures, the cookline Story and rear artwork. On desktop both benches were occupied at arrival. Each NPC yielded when its own seat was taken. Escape restored walking. [Bench views](side-bench-routes.webp) · [Action results](../../evidence/gjh-v11-s02-s03-interactions.json) |
| Lighting | Tiering passes. Whole-room tone remains partial. | At the phone and desktop counter, the cream lettering, brass edges, dark-green face and pale worktop remain distinguishable. A historical Everyday measurement met the highlight limit but missed other tone targets. The current paired plaque captures did not record the active theme. [Earlier lighting measurements](../../gjh-v11-lighting-pass-4.md) |
| Brand facts and disclosure | Pass for the verified exhibit. | The directory and the artwork dialog distinguish the official brand cover from the two unprinted 510 g sauce models and the 280 g mock duck tin. Both surfaces share the same narrative in English, Simplified Chinese and Malay. The roaming scene and menu retain their unofficial-concept disclosures. [Brand and packaging sources](brand-research.md) |

Chrome exercised the same cookline at 390, 768 and 1440 px in English, Simplified Chinese and Malay. Each visit opened all three individual listings, returned to the overview and left the shop. Changing language in a second tab retained the selected sample and its official link in the open dialog. Tab and Enter retained the physical Story button as the keyboard return target. Opening the Story with E restored focus to the scene. [Catalogue controls at three widths](catalogue-controls.webp)
