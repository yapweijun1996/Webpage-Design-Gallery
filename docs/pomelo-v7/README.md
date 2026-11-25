# Pomelo STEM V7

V7 is a six-page static Gallery concept. The source of the localized page content, shared layout and navigation is `scripts/build_pomelo_v7.py`. Rebuild the 18 English, Chinese and Malay documents with:

```sh
python3 scripts/build_pomelo_v7.py
python3 scripts/build_gallery.py
python3 scripts/build_gallery.py --check
```

The V7 visual primitives are maintained in `design-system/pomelo-v7-tokens.json` and generated into `assets/primitives.css`; semantic aliases and components live in `assets/tokens.css` and `assets/site.css`. Run `python3 scripts/build_design_system.py` after changing the registry. The approved compact brand mark comes from the Pomelo STEM brand sources; `merchant.webp` is an AI-generated illustrative Gallery image. The generic, AI-generated ceramic studies `ceramic-study.webp` and `homeware-still.webp` are reused from the Gallery’s [Thow Kwang study](../../demos/heritage/thow-kwang/README.md); they are illustrative and do not depict the fictional shop or its products. Screenshots are captured from the actual V7 page by `tests/browser_pomelo_v7.py`.

The `release.json` version must match the generated HTML version. The update control checks the V7 release and, when controlled by the Gallery worker, checks the waiting parent worker against the published Gallery identity before activation. The result after reload verifies version, boot, app and stylesheet readiness; it does not claim a complete security or asset-integrity audit. The V7 edition has no standalone worker.

The Commerce page has an illustrative three-tab concept preview. Product buttons select a matching name, price, artwork and description, with visible selection labels and a polite status announcement; the local collection link leads to those cards. Each fictional listing has a native disclosure with a sample SKU and material, available without JavaScript. The product detail can open the matching fictional listing in Seller Studio; product selections remain in memory only while the page is open. Seller Studio also switches between two complete states of fictional order PS-0124 (two mugs plus delivery), with a labelled progress indicator, fictional courier delivery and state-specific preparation notes. That mug order remains a separate example from the selected product; switching scenes changes no order. Without JavaScript, all three Seller Studio listings remain readable. AI content examples include a prewritten preparing update for that sample order. The future AI storefront design is clearly labelled as a concept. These examples make no shop or AI requests. Without JavaScript all example details remain visible and product buttons remain disabled. The samples have no cart, checkout, account or persistence.

The contact form is an interactive sample only. Its browser-side submit handler displays an explicit notice that no enquiry was sent; it does not transmit or store input. Without JavaScript the fields remain disabled. WhatsApp opens the confirmed number. Fictional interfaces are labeled as illustrations. AI website design, self-registration and self-guided demos are future features, not live product claims.

Focused static and browser checks:

```sh
python3 -m unittest discover -s tests -p test_pomelo_v7.py -v
python3 tests/browser_pomelo_v7.py
python3 tests/browser_pomelo_v7_update.py
```

The broader Gallery checks in `AGENTS.md` remain required for release. Real backend, cross-browser/physical-device verification and production deployment were not part of the static V7 implementation.
