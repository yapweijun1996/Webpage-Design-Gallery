# Live landing page contract: HOME PAGE, 10 agents, one page

The viewer (`index.html`) stacks 10 section fragments into ONE page and hot-swaps each one whenever its files change. Read `brief.md` for the business. Tokens: `../design-canvas/tokens.css` (read only, `--dc-*`). Never hard-code colors, sizes, spacing, radii or durations.

## Ownership (strict)
- You own exactly: `sections/NN-name.html`, `sections/NN-name.css`, and `notes/NN.md`. Touch nothing else. Never edit another worker's files.
- `NN-name.html` is a FRAGMENT: one root `<section class="s-NN" id="NN-name">` (the header may use `<header>`). No html/head/body, no scripts, no external requests, no web fonts.
- All CSS must be scoped under `.s-NN`. Assume `*{box-sizing:border-box}` and page background `var(--dc-bg)` are already set. Sections are full width; center content with `max-width: var(--dc-container)`.
- Anchors: nav links point to `#02-hero`, `#05-features`, `#08-pricing`, `#09-faq`, `#10-cta` (section ids).
- Placeholder imagery: inline SVG or CSS shapes only. Mark all sample data as "sample".

## Quality
Semantic HTML, one h1 on the whole page (only in hero), then h2 per section, visible focus (`--dc-focus`), tap targets >= `--dc-tap`, AA contrast in light and dark, reduced motion respected, works at 320px (mobile first), no horizontal scroll.

## Rounds
- Round 1 (build): design your section from the brief. Write `notes/NN.md` (max 6 lines): what you built, the visual rhythm you chose.
- Round 2 (improve together): READ every `sections/*.html`, `sections/*.css` and `notes/*.md`. Improve YOUR section so the whole page flows: consistent spacing rhythm, no repeated copy, wording that follows the section above and sets up the one below, no clashing styles. Then append to `notes/NN.md` under `## Round 2`: what you changed and up to 2 concrete suggestions for named other sections (the owner will read them in round 3).
- Round 3 (apply suggestions): read the `notes/*.md` suggestions addressed to your section and apply the ones you agree with; list which you accepted/declined in `notes/NN.md` under `## Round 3`.

Final message (max 80 words): files written and one risk.

## Lanes
01 header: sticky top bar, logo wordmark, nav links, primary CTA, mobile-friendly (CSS-only menu via details/summary).
02 hero: the only h1, promise, sub, two CTAs, a sample dashboard illustration in inline SVG/CSS.
03 proof: trust strip: sample stats and "as used by" placeholder wordmarks (invented, generic).
04 problem: the pain and the Harbor Ledger answer, short and emotional-but-calm.
05 features: 6 feature cards with inline SVG icons, outcomes not buttons.
06 how: how it works in 3 steps with a clear visual flow.
07 stories: 3 sample testimonials / mini case study with sample figures.
08 pricing: 3 tiers (Starter, Growth, Scale), monthly/annual note, highlighted middle tier.
09 faq: 6 questions using details/summary, accessible.
10 cta: final CTA band plus footer (links columns, legal line, language note).
