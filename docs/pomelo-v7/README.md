# Pomelo STEM V7

V7 is a six-page static Gallery concept. The source of the localized page content, shared layout and navigation is `scripts/build_pomelo_v7.py`. Rebuild the 18 English, Chinese and Malay documents with:

```sh
python3 scripts/build_pomelo_v7.py
python3 scripts/build_gallery.py
python3 scripts/build_gallery.py --check
```

Shared tokens and components live in `demos/corporate/pomelo-stem/v7/assets/tokens.css` and `site.css`. The approved compact brand mark comes from the Pomelo STEM brand sources; `merchant.webp` is an AI-generated illustrative Gallery image. Screenshots are captured from the actual V7 page by `tests/browser_pomelo_v7.py`.

The `release.json` version must match the generated HTML version. The update control checks the V7 release and, when controlled by the Gallery worker, checks the waiting parent worker against the published Gallery identity before activation. The result after reload verifies version, boot, app and stylesheet readiness; it does not claim a complete security or asset-integrity audit. The V7 edition has no standalone worker.

The contact form is an interactive sample only. Its browser-side submit handler displays an explicit notice that no enquiry was sent; it does not transmit or store input. Without JavaScript the fields remain disabled. WhatsApp opens the confirmed number. Fictional interfaces are labeled as illustrations. AI website design, self-registration and self-guided demos are future features, not live product claims.

Focused browser checks:

```sh
python3 tests/browser_pomelo_v7.py
python3 tests/browser_pomelo_v7_update.py
```

The broader Gallery checks in `AGENTS.md` remain required for release. Real backend, cross-browser/physical-device verification and production deployment were not part of the static V7 implementation.
