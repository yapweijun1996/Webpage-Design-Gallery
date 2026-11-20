# Design Canvas worker contract

A pan/zoom board (`index.html`) shows 10 frames. Each frame is one standalone HTML page in `frames/`, designed by one worker. Frames share only `tokens.css`.

## Rules for every worker
- You own exactly TWO files: `frames/NN-name.html` and `frames/NN-name.css` (names are in `frames.json`). Touch nothing else.
- Exception: worker 01 also owns `tokens.css`. It may refine values and add new `--dc-*` names, but must never rename or remove an existing name.
- Every other worker only READS tokens: use `var(--dc-*)`; no hard-coded colors, font sizes, spacing, radii or durations. If a token you need is missing, use the nearest existing one and note it in your report.
- Frame page: `<link rel="stylesheet" href="../tokens.css">` then your own css. Plain HTML/CSS, vanilla JS only when the component needs it (motion, modal, tabs). No dependencies, no network, no fonts to download.
- Frame viewport is 680 x 520 and scrolls vertically inside the iframe. It must also work at 320px width.
- Show for each component: anatomy label, variants, states (default, hover, focus-visible, active, disabled, error where relevant), a short usage rule (do / don't), and the token names it uses.
- Accessibility: semantic HTML, visible focus ring using `--dc-focus`, tap targets >= `--dc-tap`, contrast AA in light and dark (`prefers-color-scheme`), honor `prefers-reduced-motion`.
- English only. Do not run git commands that change state; the manager commits.
- Final message (max 120 words): files written, tokens you wished existed, any known issue.

## Frame lanes
01 foundations: color palette, semantic roles, contrast pairs, shape, elevation. Owns tokens.css.
02 typography: scale, weights, line heights, headings, body, code, truncation, long-text rules.
03 layout: 4px spacing scale, container, 12-column grid, breakpoints, stack/cluster patterns.
04 buttons: primary/secondary/ghost/danger, icon button, loading, button group, link.
05 forms: text, textarea, select, checkbox, radio, switch, helper and error text, validation.
06 navigation: header, tabs, breadcrumbs, pagination, sidebar, mobile menu.
07 cards: content card, list rows, media/figure, tags and badges, avatar, table.
08 feedback: alert, toast, modal dialog, tooltip, empty state, skeleton, progress.
09 motion: duration/easing tokens in action, transitions, hover/press, reduced-motion behavior.
10 patterns: hero, feature grid, pricing/CTA, footer assembled from tokens; a11y checklist and do/don't summary.
