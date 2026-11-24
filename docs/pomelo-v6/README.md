# Pomelo STEM Product Showcase V6

V6 is a ten-page, three-language gallery concept. It preserves V1–V5 and does not modify the official Pomelo site. The Showcase contains four non-transactional interactive examples: store basket, order review, an illustrative AI draft and team handoff. Example state lives in the current page; refreshing or resetting clears it. No demo sends messages, stores orders, contacts an AI service or handles customer data. The contact page links to the official site.

The localized pages are generated from `scripts/build_pomelo_v6.py`, which reuses established V5 copy and adds V6 copy. The Gallery build checks the generated HTML for drift. The design primitive source of truth is `design-system/pomelo-v6-tokens.json`; `scripts/build_design_system.py` generates `v6/assets/tokens.css`. Styles map the primitives to semantic light/dark roles. The theme is applied before paint, remembered when storage is available, and falls back safely when storage is unavailable. The full-screen loader releases at the window load event with a three-second fail-open timer; it remains hidden without JavaScript.

V6 uses the existing V2 product image and V3 logo and editorial photographs, published by the existing Gallery resource rules. Gallery thumbnails are actual local screenshots. Mission and vision wording in About is explicitly proposed, not presented as approved company policy.

```sh
python scripts/build_pomelo_v6.py
python scripts/build_design_system.py
python scripts/build_gallery.py
python scripts/check_ssot.py
python scripts/build_pomelo_v6.py --check
python scripts/build_gallery.py --check
python -m unittest discover -s tests -p test_gallery.py -v
python tests/browser_pomelo_v6.py
```

The browser test needs Playwright Python and a Chromium binary; `GALLERY_CHROME` selects the executable. Actual screen-reader and physical-device testing are not implied by the automated checks.
