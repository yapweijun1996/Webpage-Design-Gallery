# GJH Story Manga: animation ideas for review

Three Codex workers (gpt-6.2-sol, read-only) each proposed eight ideas from a different angle: page and panel choreography, manga micro-animation, and cinematic polish. This file merges the 24 ideas into one ranked shortlist. Status: Pack A and Pack B items B1, B2 and B3 are built (20 November 2026); B4 to B6 and the optional items are not. Source files: `demos/corporate/gjh/v25/`.

## Ground rules every idea must keep

- Plain HTML, CSS and JS. No dependencies, no new raster or audio files unless stated, at most 10 KB gzip added in total.
- Plays by itself while scrolling (no click). Each effect plays once per read and pauses off-screen.
- `prefers-reduced-motion` and `?lines=all` show static art and every line at once.
- Animate only `transform`, `opacity` and `clip-path` on an art-only wrapper with reserved size, so dialogue stays in flow at 390 px and layout never shifts.
- Works in English, Mandarin and Malay (no effect may depend on English word length).
- Honest history: effects never imply a documented event. The Dramatised labels stay visible.
- Smoothness target on a mid-range Android at 390 px: p95 frame interval ≤ 20 ms, no motion-related long tasks, zero layout shift. Measure with a Chrome performance trace, cold load and installed offline.

## Where the three workers agreed

| Theme | Workers | Merged into |
| --- | --- | --- |
| The red crescent returns from the tin (ch. 2) to the family table (ch. 6) | 2 and 3 | A1 |
| A slow push-in toward the focal point (tin, clipboard) | 1 and 3 | A3 |
| Dialogue timing needs per-line control and locale-safe wrapping | 2 and 3 | B4 |
| Offline gap: `i18n.js` was missing from the PWA cache | 2 and 3 | Fixed |

## Recommended Pack A (small, low risk, build first)

| # | Idea | What the reader feels | How to build | Chapters | Effort |
| --- | --- | --- | --- | --- | --- |
| A1 | **The red crescent thread** | One red mark ties a 1959 tin to today's table. | A CSS four-point sparkle beside the tin in ch. 2, played once. In ch. 6 a small `aria-hidden` crescent (two masked circles in `--red`) settles in the gutter beside the family panel. Keep it out of the art. | 2, 6 | S |
| A2 | **Paper ages across eras** | The 1940s page feels handled, the modern page crisp. | Six CSS presets on the panel margin and page background: worn gray, coarse halftone, newsprint, clean matte, smooth, crisp white. Static grain and edge wear, faded in once. | 1 to 6 | S |
| A3 | **Push-in on the focal point** | Your eye is led to the tin, then to the clipboard. | Store a percentage focal point per chapter (tin about 42% 28%). Clip the image in its wrapper and ease only the art from scale 1 to 1.06 as it enters, then hold. Keep faces in frame at 390 px. | 2, 3, 5 | S to M |
| A4 | **Timeline thread on the rail** | You always know which era you are in. | Fill a thin ink line along the rail from the active chapter index (`scaleX`), set `aria-current="location"`, commit one winner per observer batch to avoid flicker. | all | S |
| A5 | **SFX that lands** | CLACK, SPARKLE, HEAVE feel like sounds you can almost hear. | Scale 1.18 to 1 with one small shake on reveal. Use a thinner outline for Mandarin so Han strokes stay legible. Same timing in all three languages. | 1 to 6 | S |
| A6 | **Bubbles with character** | Laughter bounces, the child's call arrives in two beats. | Ch. 5 reply: scale 0.96, 1.03, 1 and ±1° once, plus two laugh ticks. Ch. 6 "Pass the abalone, Ah Gong!": fade two phrase spans per locale with the full line's space reserved and a total cap of about 300 ms. | 5, 6 | S to M |

Estimated total for Pack A: roughly 6 to 8 KB gzip, no new image files.

## Pack B (stronger moments, more care)

| # | Idea | Note |
| --- | --- | --- |
| B1 | **Shutter lift** (ch. 1) | Merge of "paper shutter lift" and "ink opens the shop". Pick one: a plain paper edge lifts via `clip-path` in 280 ms. The ink-bloom version is richer but a dark wash can hide faces. Recommend the paper edge. |
| B2 | **Page-turn fold plus quiet gutter** (ch. 3 to 4, 4 to 5) | A shallow diagonal paper edge crosses the gutter into the port scene, then a short blank gutter lets the dense scene settle. Keep it clear of the sticky rail. |
| B3 | **The table opens wide** (ch. 6) | The family panel expands from a 12 px inset to full bleed as it enters. Keep text below the stage so motion and dialogue never compete. |
| B4 | **Dialogue beat control** | Per-line `data-delay-ms` (default 1100), reserved bubble space, resume from the next unread line, one live-region announcement per line. |
| B5 | **Speed lines on the lift** (ch. 3) | Three tapered strokes sweep a few pixels on HEAVE. Confine them to the carton so the lorry does not seem to move. |
| B6 | **Archive tab underline** | Opening a fact drawer draws one underline under the summary. Do not add a verification stamp, it would overstate certainty. |

## Optional or cut

| Idea | Verdict |
| --- | --- |
| Quiet Foley sound (shutter, carton thud, bowl tap; synthesised, off by default) | Optional later. Needs a localised sound toggle and autoplay-safe opt-in. |
| Parallax carton in the godown (L) | Cut for now. Needs a cut-out layer, background patching and about 60 KB of extra assets. Halftone seams likely on phones. |
| Two-frame shelves crop (ch. 5) | Cut. Two quick crops could imply two separately dated events. |
| Ink frame corners (ch. 3) | Cut. Predictable once repeated. |
| Harbour screentone drift (ch. 4) | Cut. Fine dots shimmer, and motion near the map may imply a documented route. |
| Focus rays around the tin (ch. 2) | Merge into A1 at low opacity, or drop. The panel already has printed rays. |

## Risks to watch

1. Faces cropped by push-in on phones: test every chapter at 390 and 320 px.
2. Grain muddying fine ink: keep it on margins, not on the art.
3. Effects implying history: no animated map routes, no signing or opening-day scenes.
4. Han strokes swallowed by heavy outlines on SFX.
5. Over-repetition: each effect plays once and each motif appears in at most two chapters.

## Decision for you

- **Option 1 (recommended):** build Pack A only, test on a phone, then decide on Pack B.
- **Option 2:** Pack A plus B1, B2 and B3 in one pass.
- **Option 3:** Pack A plus optional sound.

## Already fixed during this review

`i18n.js` was not in the generated PWA precache, so Mandarin and Malay would fail offline. `scripts/build_gallery.py` now includes it, and the v25 worker lists it with a SHA-256.
