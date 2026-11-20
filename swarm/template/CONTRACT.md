# Swarm contract: ONE page (home), 10 agents, live

A viewer stacks 10 section fragments into ONE page and hot-swaps each one whenever its files change. A manager (Claude) is watching live and may leave you instructions. Read `brief.md` for the business. Design tokens are in `tokens.css` (read only, `--dc-*` variables). Never hard-code colors, sizes, spacing, radii or durations.

## Ownership (strict)
- You own exactly: `sections/NN-name.html`, `sections/NN-name.css`, and `notes/NN.md`. Touch nothing else. Never edit another agent's files. You may READ everything, including `inbox/NN.md` (manager messages for you).
- `NN-name.html` is a FRAGMENT: one root `<section class="s-NN" id="NN-name">` (the header may use `<header>`). No html/head/body, no scripts, no external requests, no web fonts.
- All CSS must be scoped under `.s-NN`. Assume `*{box-sizing:border-box}` and page background `var(--dc-bg)` are already set. Sections are full width; center content with `max-width: var(--dc-container)`.
- Anchors: every section root has id `NN-section` (see `sections/` file names, e.g. `#02-hero`). Link to other sections only with those ids.
- Placeholder imagery: inline SVG or CSS shapes only. Mark all sample data as "sample".

## Quality
Semantic HTML, one h1 on the whole page (only in hero), then h2 per section, visible focus (`--dc-focus`), tap targets >= `--dc-tap`, AA contrast in light and dark, reduced motion respected, works at 320px (mobile first), no horizontal scroll.

## Live narration (important)
The manager sees your messages live as a thought bubble next to your cursor. Before each major step write ONE short sentence (max 20 words) stating your design intent or what you notice in a neighbour's section, e.g. "Hero text is dense, so I'll shorten the sub line and widen spacing." No long reports in between.

## Rounds
- Round 1 (build): design your section from the brief. Write `notes/NN.md` (max 6 lines): what you built, the visual rhythm you chose.
- Round 2 (improve together): READ every `sections/*.html`, `sections/*.css` and `notes/*.md`. Improve YOUR section so the whole page flows: consistent spacing rhythm, no repeated copy, wording that follows the section above and sets up the one below, no clashing styles. Then append to `notes/NN.md` under `## Round 2`: what you changed and up to 2 concrete suggestions for named other sections.
- Round 3 (apply suggestions): read the notes' suggestions addressed to your section and `inbox/NN.md`, apply what you agree with, and record accepted/declined under `## Round 3`.

Final message (max 60 words): files written and one risk.

## Lanes
{{LANES}}
