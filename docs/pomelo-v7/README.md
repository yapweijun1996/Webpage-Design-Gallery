# Pomelo STEM V7

V7 is a six-page static Gallery concept. The source of the localized page content, shared layout and navigation is `scripts/build_pomelo_v7.py`. Rebuild the 18 English, Chinese and Malay documents with:

```sh
python3 scripts/build_pomelo_v7.py
python3 scripts/build_gallery.py
python3 scripts/build_gallery.py --check
```

The V7 visual primitives are maintained in `design-system/pomelo-v7-tokens.json` and generated into `assets/primitives.css`; semantic aliases and components live in `assets/tokens.css` and `assets/site.css`. Run `python3 scripts/build_design_system.py` after changing the registry. The approved compact brand mark comes from the Pomelo STEM brand sources; `merchant.webp` is an AI-generated illustrative Gallery image. The generic, AI-generated ceramic studies `ceramic-study.webp` and `homeware-still.webp` are reused from the Gallery’s [Thow Kwang study](../../demos/heritage/thow-kwang/README.md); they are illustrative and do not depict the fictional shop or its products. Screenshots are captured from the actual V7 page by `tests/browser_pomelo_v7.py`.

The `release.json` version must match the generated HTML version. The update control checks the V7 release and, when controlled by the Gallery worker, checks the waiting parent worker against the published Gallery identity before activation. The result after reload verifies version, boot, app and stylesheet readiness; it does not claim a complete security or asset-integrity audit. The V7 edition has no standalone worker.

The Commerce page has an illustrative three-tab concept preview. Product buttons select a matching name, price, artwork and description, with visible selection labels and a polite status announcement; the local collection link leads to those cards. Each fictional listing has a native disclosure with a sample SKU, material, size and care information, available without JavaScript. The matching Seller Studio listing repeats those details. The product detail can open the matching fictional listing in Seller Studio; product selections remain in memory only while the page is open. Seller Studio also switches between two complete states of fictional order PS-0124 (two mugs plus delivery), with a labelled progress indicator, fictional courier delivery and state-specific preparation notes. An expandable handoff note illustrates checking the two mugs and delivery details without creating or sending a label. That mug order remains a separate example from the selected product; switching scenes changes no order. Without JavaScript, all three Seller Studio listings remain readable. AI content examples include a prewritten preparing update for that sample order. The future AI storefront design is clearly labelled as a concept. These examples make no shop or AI requests. Without JavaScript all example details remain visible and product buttons remain disabled. The samples have no cart, checkout, account or persistence.

The contact form is an interactive sample only. Its browser-side submit handler displays an explicit notice that no enquiry was sent; it does not transmit or store input. Without JavaScript the fields remain disabled. WhatsApp opens the confirmed number. Fictional interfaces are labeled as illustrations. AI website design, self-registration and self-guided demos are future features, not live product claims.

Focused static and browser checks:

```sh
python3 -m unittest discover -s tests -p test_pomelo_v7.py -v
python3 tests/browser_pomelo_v7.py
python3 tests/browser_pomelo_v7_update.py
```

The broader Gallery checks in `AGENTS.md` remain required for release. Real backend, cross-browser/physical-device verification and production deployment were not part of the static V7 implementation.

V7.10 places the merchant portrait above a compact workspace illustration and carries the merchant story into the next section. The new product specifications and handoff notes are fictional sample content, not descriptions of real goods or fulfilment operations. Browser checks cover the multilingual layouts and sample interactions, including keyboard access, dark theme and a JavaScript-disabled fallback.

V7.11 expands the Home merchant story into a two-image editorial sequence: the reused ceramic studies are explicitly labelled as illustrative, not photographs of the fictional products. Commerce adds fictional order PS-0125 alongside the existing mug journey. Customer and seller views share the same source data: three everyday bowls (PH-002) at RM 32.00 each, RM 96.00 in items, RM 0.00 for shop pickup and RM 96.00 total. The pickup date is arranged with the customer; the seller checks and wraps each bowl. Both views are static and readable without JavaScript. No order, payment or pickup is created.

V7.11 source and unit checks can be run without a browser using the build commands above, `python3 scripts/build_design_system.py --check`, `python3 scripts/check_ssot.py`, and the focused unit test command above. Chrome browser checks cover desktop and mobile viewport layouts, themes, locale navigation, sample interactions, image loading and both order views; physical-device review remains separate.

V7.12 reshapes the Home editorial image pair into a larger, layered composition and connects it to a labelled fictional merchant journey. The imagery remains illustrative and does not depict the example products. Commerce adds a keyboard-operable, local preparation exercise for PS-0125: checking the three PH-002 bowls and wrapping them changes the example status in both customer and seller views; unchecking either returns it to preparing. With JavaScript unavailable the order, tasks and disabled controls remain readable. This is temporary practice; it sends and stores nothing and creates no order or pickup.

V7.13 gives the Home portrait more prominence and reframes the ceramic image pair as a quieter editorial sequence alongside the fictional merchant journey. The existing illustrative asset provenance and four merchant audiences remain unchanged. Commerce adds an items-only quantity estimator for the three existing fictional listings (one to six units); it is separate from both fixed sample orders and excludes delivery. The PS-0125 preparation exercise now permits a reversible example collection step only after both checks are complete. Both views show the same temporary status, and removing a preparation check clears collection. Neither exercise creates, sends or saves anything. With JavaScript disabled, the initial estimate, prices, order details and disabled controls remain readable. The static and handler checks can be run without a browser:

```sh
python3 -m unittest discover -s tests -p test_pomelo_v7.py -v
node tests/pomelo_v713_interactions.cjs
```

V7.13 was reviewed in Chrome at desktop, tablet, mobile and landscape viewport sizes, including three languages, dark theme, reduced motion, keyboard interaction, the estimate and pickup flow. Physical device testing remains separate.

V7.14 frames the Home merchant story with a distinct editorial image field and a contrasting journey bridge, using the same authorised illustrative images. In Commerce, each fictional product detail can bring its own product into the existing items-only estimator, retaining the selected quantity and moving keyboard focus to the product selector. The calculation shows unit price and quantity. Both views of PS-0125 show how many preparation checks are complete; reversing a check also clears the example collection state. The fixed orders remain separate from the estimator. These are local illustrations with no transaction, notification or saved data. With JavaScript unavailable, product details, the initial calculation, order and preparation steps remain readable.

V7.14 source checks include `node tests/pomelo_v714_interactions.cjs`, the V7 unit tests, generator checks and the design-system/SSOT checks. Chrome browser and screenshot checks cover desktop, tablet, mobile and landscape viewport sizes, three languages, themes, keyboard interactions, product estimation and pickup progress. Physical device testing remains separate. The earlier Mini Street SSOT findings were fixed in the current base commit.

V7.15 gives the merchant portrait and editorial image sequence a stronger visual hierarchy using the same attributed illustrative assets. Commerce adds a two-selection product comparison of the existing fictional prices and specifications, and an index connecting the two fixed sample orders to their delivery and pickup views. The pickup status in the index follows the temporary practice; the delivery link opens the fixed new-order scene. All three comparison cards and both order links remain available without JavaScript. Comparison cards follow the first and second selections in reading order and identify their corresponding selectors. Selecting the same product twice shows one card labelled for both selections with an explanation. These examples create, send and save nothing.

V7.15 verification includes the V7 static contracts and `node tests/pomelo_v715_interactions.cjs`; browser and physical-device review are separate.

V7.15 independent Chrome QA covered 320 × 568 and 568 × 320 viewports in English, Chinese and Malay, in light and dark themes. It checked all nine comparison pairs, identical selection, order navigation and keyboard focus, pickup state synchronization and rollback, no non-GET requests, overflow, runtime errors, and a no-JavaScript fallback. Desktop, tablet and mobile layouts were also checked separately. Physical devices were not tested.

V7.16 brings the Home hero closer to the supplied brand references: the illustrative merchant portrait sits behind a fictional storefront and Seller Studio preview. Both previews remain labelled, and the existing merchant story and product links continue below. The composition uses existing local assets and responsive layouts; visual and interaction QA is separate from the source checks.

The Home value section now presents three labelled illustrative entries for the shop, Seller Studio and AI-assisted work. They lead to the sample product tour and the corresponding Home examples, with a capability qualification alongside them. At 320px the header uses two rows so the wordmark and four 44px controls remain visible. The merchant story, four audiences and existing assets are retained. Browser and independent visual QA remain separate from the focused source checks.

The Commerce hero now brings the fictional storefront, Seller Studio and AI-assisted work into one illustrative workspace over the existing homeware study. The shop's sample product cards use larger type and adapt from two columns to a single horizontal-card layout on narrow screens. Product names, prices, details and the estimator continue to use the existing sample data. The composition and responsive rendering require independent visual QA; the image remains illustrative and does not depict the fictional products.

Commerce also has a native chapter guide to the product showcase, comparison, quantity estimate and two fictional order examples. Its links work without JavaScript. On desktop, customer and seller pickup cards size independently in a two-column layout, so the longer seller exercise does not stretch the customer card. The existing fixed order data and temporary practice remain unchanged. Independent Chrome QA checked the chapter links and both pickup perspectives.

Round 5 compares the supplied Home and Commerce mobile anchors with the independent round 3 Commerce hero/product captures and round 4 guide/order captures. The anchors favour clear, compact vertical groupings. The 320px product capture showed the artwork squeezing product text; the narrow layout now gives the text more room while retaining the existing type sizes and touch targets. The desktop order capture showed unused space inside each horizontal perspective; customer and seller cards now size independently with their contents in vertical order. The round 4 guide already has clear, full-width links at 320px and remains unchanged. Independent Chrome QA reviewed the adjustments at mobile, landscape and desktop viewports; physical devices were not tested.

The seller's PS-0125 practice has a labelled reset that clears both preparation checks and the example collection state, synchronises both views and the order index, and announces the reset and initial progress. It leaves comparison and quantity selections alone. The button and checks remain disabled without JavaScript; the order remains readable. This is temporary local practice and can be repeated. Focused handler, static and independent Chrome browser checks cover reset, keyboard focus, state synchronization and isolation from comparison and estimator selections.

Independent QA completed five review cycles against the supplied Home and Commerce desktop/mobile concept anchors. Final Chrome checks covered 320, 350, 390, 568 landscape and 1440 pixel viewports across English, Chinese and Malay in light and dark themes; reset, chapter navigation, product choices, order states, keyboard focus, no-JavaScript behavior, overflow and runtime errors were checked. The comparison is directional, not a pixel-accurate claim. Physical devices were not tested.
