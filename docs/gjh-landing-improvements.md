# Goh Joo Hin landing ideas and visitor journeys

The gallery contains 16 Goh Joo Hin demos. Each edition gives its primary visitor a different way to enter the same portfolio. Open an edition below and try the action in the last column.

| Edition | Landing idea and visitor | Implemented first choice | How to try it |
| --- | --- | --- | --- |
| [V1 · Corporate clarity](../demos/corporate/gjh/v1/index.html) | Help a first-time corporate visitor identify the right division. | Three names under the introduction lead directly to food, electronics, and health and nutrition. | Choose Food and read the food division panel. |
| [V5 · Heritage editorial](../demos/corporate/gjh/v5/index.html) | Let food shoppers recognize a brand by its cover. | Each of the three cover photographs now names its range and opens the corresponding official brand page. | Tab to the New Moon photograph and press Enter. |
| [V6 · Portfolio modern](../demos/corporate/gjh/v6/index.html) | Show how pack identity changes across New Moon origins. | A bento tile pairs actual New Zealand and Mexico pack photographs and opens the four-origin range. | Select the paired tins, then compare the other two origins. |
| [V7 · Signature dark](../demos/corporate/gjh/v7/index.html) | Give prospective trade partners a shorter path to the right conversation. | The cover offers distinct routes to business divisions, partnership information and the contact section. | Follow the partnership route to its section. |
| [V8 · Generations of goodness](../demos/corporate/gjh/v8/index.html) | Invite a heritage reader to choose the era that interests them. | Four visible historical waypoints connect Rochor Road in the 1940s, New Moon in 1959, MILI in 1981, and Borsch Med in 2004 to the matching timeline item and era image. | Choose 2004, check its description, then reload the same URL. |
| [V9 · Illustrated virtual stores](../demos/corporate/gjh/v9/index.html) | Help a shopper predict what each illustrated storefront contains. | Each street sign pairs a brand with a short description of what can be explored inside. | Enter MILI from its Pantry sign and check the active room. |
| [V10 · Evening arcade](../demos/corporate/gjh/v10/index.html) | Help a 3D visitor find a particular exhibit across the arcade. | The map pairs destination names with their exhibits, including New Moon’s pack gallery. | Select New Moon on the map to open the room and its product display. |
| [V11 · Virtual mall](../demos/corporate/gjh/v11/index.html) | Let a first-time shopper reach the products before learning walking controls. | The first guide step offers Featured products beside the tour controls. It opens the directory, clears previous filters, focuses the product heading and reveals the four New Moon packs. The directory’s illustrated wayfinding panel links to the store amenities. | On a first visit select Featured products, inspect the packs, then follow Store wayfinding. |
| [V12 · Shared table](../demos/corporate/gjh/v12/index.html) | Let a family shopper enter through a scene they recognize. | The illustration caption gives two choices that lead to the corresponding New Moon and MILI spreads. | Select the New Moon meal beneath the table illustration. |
| [V13 · Connections that matter](../demos/corporate/gjh/v13/index.html) | Show a business visitor a representative brand for each sector. | The cover strip pairs each of three divisions with a direct link to a relevant official brand page. | Follow the electronics desk to the Sony brand listing. |
| [V14 · Provision counter](../demos/corporate/gjh/v14/index.html) | Give a heritage reader control over which evidence they see. | A two-position switch changes the counter illustration into GJH’s historical composite. Each position has its own source caption. | Focus the counter switch, press the right arrow to see the archive and the left arrow to return. |
| [V15 · Portfolio field guide](../demos/corporate/gjh/v15/index.html) | Help a range buyer understand brands before opening their websites. | Each portfolio row reveals examples from its brand’s product range in place. | Open the range note on MILI and read its canned-food categories. |
| [V16 · The everyday collection](../demos/corporate/gjh/v16/index.html) | Let a packaging researcher inspect one real object. | The New Moon New Zealand 425 g specimen flips between the front and back label. The caption links to that exact official SKU. | Choose View back label, return to the front, then open the official product. |
| [V17 · Pantry notes](../demos/corporate/gjh/v17/index.html) | Organize discovery around a meal occasion. | Three cover bookmarks open the corresponding weeknight supper, Sunday lunch or afternoon break entry. | Select Sunday lunch and read the matching entry. |
| [V18 · Everyday frequencies](../demos/corporate/gjh/v18/index.html) | Make an electronics catalogue feel like tuning a receiver. | Four presets on the cover select Listen, Watch, Play or Connect and update the channel guide and address together. | Choose Play, switch channels and use the browser Back button. |
| [V19 · Partner desk](../demos/corporate/gjh/v19/index.html) | Help a buyer prepare a more specific first enquiry. | An optional retail setting changes the prepared brief for an independent shop, grocery retailer or online retailer. Editing the setting clears the previous draft. | Pick a topic, add a retail setting, prepare the brief and inspect its wording. |

The date for New Moon marks its brand origin. V14 identifies the archive image as the historical composite GJH publishes on its site. V16’s back label has a receipt in its local asset inventory. [Historical fact notes](gjh-v8-facts.md) · [GJH history](https://www.gjhglobal.com/about-us/) · [Official 425 g New Zealand pack](https://www.gjheshop.com/product/new-moon-premium-wild-caught-new-zealand-abalone-425g/)

## Browser verification

The [edition journey check](../demos/corporate/gjh/landing_checks.py) serves the repository locally, opens each selected edition in Chrome and exercises a representative action by keyboard. It checks horizontal overflow and uncaught JavaScript errors at 320, 390, 768 and 1440 CSS pixels. It also checks responsive image decoding when flipping the V16 pack. External navigation is intercepted in this test so the exercise is repeatable without live brand websites.

V11’s current desktop, tablet and phone previews show the visitor arrivals board. Featured products opens the lightweight directory, while Enter 3D mall starts the spatial guide. The [primary-reference audit](landing-atlas/gjh/anchor-audit.md) records the later visual changes across all 16 editions.

Run the following commands from the repository with Playwright, Pillow and Chrome installed. The first command verifies the journeys. The second refreshes the editions’ tracked previews and gallery thumbnails. Real-device performance and visitor conversion require separate measurements.

```sh
python demos/corporate/gjh/landing_checks.py
python demos/corporate/gjh/landing_checks.py --capture
```

## Style atlas

The [GJH atlas directions](landing-atlas/gjh/directions.json) pair each published edition with a primary visual reference and add four alternative compositions. Thirteen references use [locally rendered layouts](landing-atlas/gjh/render_verified.py) to preserve pack artwork, source captions, historical milestones, product descriptions and selectable options. The [verified render list](landing-atlas/gjh/verified-renders.json) identifies these by key. The other seven are generated concept illustrations.

Run `python docs/landing-atlas/gjh/render_verified.py` from the repository with the same browser dependencies as the journey checks. Pass `--keys pack-label-proof` to regenerate only the actual New Zealand 425 g back-label study.
