# Goh Joo Hin v1 — Corporate Clarity Design System & Component Reference

This document records the scoped P0/P1/P2 design tokens, component states, responsive contracts, localization review gate, derived media rules, and single-identity PWA architecture for `demos/corporate/gjh/v1/`.

## 1. Scoped Semantic Palette (`design-system/themes.json` -> `v1`)

All v1 colors are authored in `design-system/themes.json` and compiled into `assets/gjh-themes.css` via `python scripts/build_design_system.py`. Neighboring editions (`v5`–`v24`) are unaffected.

| Role | Token | Value | Contrast Verification |
| --- | --- | --- | --- |
| Main surface | `--paper` | `#FFFFFF` | Base surface for cards and primary sections |
| Canvas wash | `--wash` | `#FAF9F6` | Alternating section surface |
| Entry tint | `--entry-paper` | `#EFF2E8` | Sage-tinted hero entry background |
| Entry editorial green | `--entry-green` | `#214337` | 9.64:1 on `#EFF2E8`; 10.92:1 on `#FFFFFF` |
| Primary ink | `--ink` | `#272326` | 15.50:1 on `#FFFFFF`; 13.68:1 on `#EFF2E8` |
| Secondary text | `--muted` | `#595157` | 7.67:1 on `#FFFFFF`; 6.77:1 on `#EFF2E8` |
| Primary action | `--accent-dark` | `#A20C3B` | 7.92:1 white-on-berry; 6.99:1 berry-on-sage |
| Primary action hover | `--accent-hover` | `#80092E` | 10.52:1 white-on-berry |
| Brand accent bar | `--accent` | `#D31B47` | Preserved for decorative top rules and timeline dots |
| Hairline border | `--line` | `#DAD4D6` | Subtle section and card dividers |
| Strong control boundary | `--line-strong` | `#777076` | 4.81:1 on `#FFFFFF`; 4.25:1 on `#EFF2E8` (>= 3:1 UI contrast) |
| Light focus ring | `--gjh-color-focus-visible` | `#2854C5` | 6.64:1 on `#FFFFFF`; 5.86:1 on `#EFF2E8` |
| Reverse focus ring | `--gjh-color-focus-reverse` | `#FFD801` | 11.53:1 on `#3A1426` |
| Contact surface & ink | `--contact-bg` / `--contact-ink` | `#3A1426` / `#FFF7F9` | 15.23:1 normal text; 11.13:1 `#272326` on `#FFD801` CTA |
| Media placeholder | `--media-placeholder` | `#E7E4DE` | Neutral solid surface reserving aspect ratio before decode |

## 2. Typography & Script Adaptation

- **Latin (`en`, `ms`)**: Self-hosted `Manrope` (`400–700`, `font-display: swap`), body `17px/1.62`, fluid hero `clamp(2.25rem, 4.2vw, 4.15rem)`, section headings `clamp(1.75rem, 3vw, 2.875rem)`.
- **Simplified Chinese (`zh-Hans`)**: System CJK stack (`--sans-zh`: PingFang SC, Hiragino Sans GB, Microsoft YaHei, Noto Sans CJK SC) for immediate first paint with `line-height: 1.7`, `letter-spacing: 0` on headings, and `text-transform: none` on eyebrows.
- Mandatory `<br>` line breaks were removed from headings to allow natural wrapping across viewports, translations, and 200% zoom.

## 3. Responsive Layout & Breakpoint Contract

- **Shared menu breakpoint**: `900px` (`max-width: 900px` disclosure panel; `min-width: 901px` horizontal desktop bar), synchronized with `demos/corporate/gjh/shared/navigation.js`.
- **Desktop (`>= 1200px`)**: Sticky header (`scroll-padding-top: 96px`), unified 3-column hero (`copy | art | 3-row division rail`), 3-column division/brand grids, 4-column timeline.
- **Tablet (`768px–1199px`)**: Compact 2-column hero top (`copy | art`) + 3-column horizontal division bar beneath (`56–80px` cell height, targeting 768×1024 hero height <= 667 CSS px). At `601px–960px`, division and brand grids use 2 columns with an intentional full-span placement for the 3rd card.
- **Mobile (`<= 767px`)**: Normal-flow single-row header, natural reading order (`copy + CTA` -> `3 division links` -> shallow `2:1` art-directed hero image with `object-position: 62% 22%`) so all three divisions appear above the fold at `390×844` with the start of Businesses visible near the fold. `<= 360px` uses `16px` gutters for clean `320px` reflow.

## 4. Component State Reference

| Component | Default | Hover (pointer-only) | Focus-Visible | Active / Current | Edge / Fallback States |
| --- | --- | --- | --- | --- | --- |
| **Header & Nav links** | `44px` min-height, `#272326` on `#FFFFFF` | Color shifts to `#A20C3B` (`140ms ease-out`) | Immediate `3px solid #2854C5`, `3px` offset | `aria-current="location"` shows `#A20C3B` text + `2px` underline (desktop) | Mobile disclosure scrolls in short landscape (`max-height: calc(100dvh - 80px)`); remains visible without JS |
| **Locale switcher** | Inline group at end of `#navigation` (bottom of mobile disclosure) | Active links shift to `#FAF9F6` / `#A20C3B` | `3px solid #2854C5` | `aria-current="page"` sage pill (`#EFF2E8` / `#214337`) | Pending translations render as non-link `aria-disabled="true"` dashed badges on EN until fluent review approval |
| **Primary CTA (`.entry-action`, `.button`)** | Filled `#A20C3B`, `#FFFFFF` ink, `48px` min-height | Darkens to `#80092E`; decorative arrow nudges `3px` (hit target stays fixed) | Immediate `#2854C5` ring | Standard native navigation | Long labels wrap cleanly without horizontal overflow |
| **Division index links** | White cells with `#214337` tag, `#272326` title, `#A20C3B` arrow | `#EFF2E8` sage tint + `4px` berry left accent sweep (`140ms`) + `4px` arrow glide | Immediate `#2854C5` ring + sage tint & left accent | Navigates directly to `#business-food`, `#business-electronics`, `#business-health`; destination card highlights via `:target` | Stacks compactly on phone (`48px` min-height), 3-col row on tablet (`67px`) |
| **Division & Brand cards** | `#FFFFFF` card, `1px solid #DAD4D6`, equal-height flex column | Border strengthens to `#A20C3B`; brand photo zooms subtly (`1.03x`, `180ms`, clipped inside frame) | Immediate `#2854C5` ring on card link | External links announce new tab & language; `:target` division card receives `#EFF2E8` surface & berry border | Missing brand image switches frame to calm `#EFF2E8` fallback caption with zero CLS |
| **Hero artwork** | `<picture>` WebP (`480/768/1200/1920w`) + JPEG fallback, height-aware `sizes` (`100vw` / `92vw` / `85vw`), `#E7E4DE` frame | Static (non-interactive) | N/A | Eager load, `fetchpriority="high"`; yields `>= 1.77` effective DPR at 1440/2×, `2.84` at 768/2×, and `2.72` at 390/3× | On error, hides broken icon and renders localized calm fallback notice |
| **Timeline** | `2px` top rule + berry marker, Georgia serif year | Static | N/A | 4-col desktop, 2×2 tablet, 1-col mobile | Keeps 1940s GJH and 1959 New Moon milestones distinct |
| **Contact panel** | `#3A1426` reverse surface, `#FFF7F9` copy, `#FFD801` button | Yellow deepens to `#F3C900` + diagonal arrow nudge | Reverse `#FFD801` ring | Opens official GJH contact page in new tab | Explicit external destination note (with language note on non-EN routes) |
| **Footer PWA status & Back-to-top** | Mounted inside `#offline-controls` footer utility; back-to-top hidden until scroll > 100vh and clear of footer | Border/text highlight to `#FFD801` | Reverse `#FFD801` ring | Polite `role="status"` live region deduplicates retries; localized via `#demo-pwa-copy` | No-JS / non-SW contexts display calm static note in `#offline-controls` |

## 5. Motion, Localization & PWA Ownership

- **Motion**: `140ms` control transitions, `180ms` disclosure fade, hover-only arrow nudges under `@media (hover: hover) and (pointer: fine)`, zero hit-target translation, and complete suppression under `@media (prefers-reduced-motion: reduce)`.
- **Independent generation**: `scripts/build_gjh_v1.py` (invoked by `scripts/build_gallery.py`) compiles `demos/corporate/gjh/v1/locales/{shared,en,zh-Hans,ms}.json` into `v1/index.html`, `v1/zh-Hans/index.html`, and `v1/ms/index.html`.
- **Single PWA identity**: All three routes reference the same `manifest.webmanifest` and version-scoped `sw.js`, which precaches all three locale documents plus the responsive hero derivatives and resolves subdirectory trailing slashes offline.
