# Pomelo STEM Product Showcase V5

This independent gallery concept provides five pages (Home, Showcase, Story, Services and Contact) in English, Simplified Chinese and Malay. Its store dashboard and order journey are illustrative. The Contact page links to the official site; the concept does not collect or send messages.

The visual primitive source of truth is `design-system/pomelo-showcase-tokens.json`. Run `python scripts/build_design_system.py` to generate `assets/tokens.css`; `assets/site.css` maps those primitives to semantic light/dark variables. Theme preference uses localStorage when available and otherwise follows the operating system. The head bootstrap applies the theme before paint. The full-screen loader releases on the window load event, has a three-second fail-open timer, and stays hidden without JavaScript.

The localized HTML pages are generated from `scripts/build_pomelo_showcase.py`. After editing the content or templates, run:

```sh
python scripts/build_pomelo_showcase.py
python scripts/build_design_system.py
python scripts/build_gallery.py
python scripts/check_ssot.py
python scripts/build_pomelo_showcase.py --check
python scripts/build_gallery.py --check
```

V5 reuses the existing V2 product image and V3 brand and story artwork, which the gallery publishes with those editions. The Showcase page uses buttons to switch examples; with JavaScript unavailable, all example panels remain readable. All other navigation uses ordinary links and retains the selected page's locale. The Story chapter links work as standard anchors, including when reduced motion is enabled.
