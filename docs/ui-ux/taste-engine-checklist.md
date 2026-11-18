# Taste Engine checklist (UI/UX)

Owner rule: **taste matters most**. Machine checks prove a page is not broken; they never prove it is good.
Sources: KB-MCP skills `kb-mcp:ui-skills`, `ui:ux-quality-auditor` v1.0.5, `ui:design-taste-engine` v1.0.1, `ui:taste-gate-before-merge`, and the GJH v20-v25 / v11 outcomes (2026-11-18).

## 0. Core rules
1. Look at the real running UI first. Reading code comes after evidence.
2. Read-only first. No push/merge/deploy without permission.
3. Never claim a test, score, fix or measurement without evidence. Report **OBSERVED** (seen in a screenshot or measured), **RECOMMENDATION** (taste, subjective) and **TEST_CANDIDATE** (needs reproduction) separately.
4. Judge from real browser screenshots. Mockups, collages and agent summaries are not evidence.
5. One governing skill per phase; state what was and was not verified (devices, states, browsers).

## 1. Before designing (Phase 0)
- [ ] Asset audit: list every usable image, logo and official source in the repo. View the contact sheets. The best imagery decides the layout.
- [ ] Measure one real reference (hero height vs viewport, headline size/weight, section count, words per viewport). Write numbers into the brief.
- [ ] Name the approved bar (for GJH: v22, dark, cinematic, one dominant image per screen). New work is distinct from **rejected** work, not from the approved bar.
- [ ] Settle direction with 3-4 questions and 2-3 reference images the owner can pick from. Do not decide style from research alone.
- [ ] Early acceptance sample: view one real desktop and one real mobile screenshot right after the first build, before polish or slow suites.

## 2. Design for impact (Phase 1)
- [ ] One dominant idea per first screen; hero fills about one viewport; headline <= ~8 words; at most two actions.
- [ ] One idea per viewport or chapter. Few words. One accent colour reserved for actions.
- [ ] No uniform grid of equal cards as the main structure; no tiny hero; no generic gradient blobs; no collage of the same shared stock set across variants.
- [ ] Forms and tools look finished: prefilled, previewed, one obvious primary action.
- [ ] Brand marks are official assets only; never AI-generated.

## 3. Vetoes and score (before merge or push)
Render 390x844, 768x1024, 1440x900 (plus 320x720 and 430x932 for audits) and LOOK at them, scrolled so lazy content shows.
- [ ] **Impact veto**: no dominant image/idea, or hero < ~80% of viewport.
- [ ] **Distinctness veto**: differs from siblings in section sequence, focal element and grid, not only colour or radius.
- [ ] **Asset veto**: strong imagery exists but is unused or smaller than about half the viewport width.
- [ ] **Claim veto**: a claimed style (immersive, editorial, Apple-like, premium) is not visibly delivered.
- [ ] Rubric (100): hierarchy 20, spacing/alignment 20, typography 15, colour/contrast 15, consistency 15, responsive 15. Bar >= 85, no weak dimension. Impact and originality noted separately, >= 8/10.
- [ ] A reviewer other than the patch author scores it from screenshots only.

## 4. Browser audit (read-only, `ui:ux-quality-auditor`)
Run `python tests/ui_audit.py <url> <out-dir>`. It covers deterministic candidates only.
- [ ] Viewports 320x720, 390x844, 430x932, 768x1024, 1024x768, 1440x900.
- [ ] No horizontal document overflow; no clipped controls or text; no offscreen fixed overlays.
- [ ] Every visible control has an accessible name; images have `alt`; no broken images; exactly one H1; no heading jumps; `lang` and viewport meta present.
- [ ] Interactive targets measure at least 36 × 36 CSS px with a fine pointer and at least 44 × 44 CSS px whenever a coarse pointer is available, including on hybrid laptops. Record the measured threshold for each context. Use `(any-pointer: coarse)` and the Gallery `--size-control` token for coarse-pointer sizing.
- [ ] Keyboard: visible focus ring on every stop, logical order, skip link, no trap. Never remove a valid focus ring for looks.
- [ ] Contrast >= 4.5:1 (text) measured, including text over imagery (scrim).
- [ ] States: loading, empty, error, long content, offline, reduced motion, no JS.
- [ ] Console errors and failed requests recorded.
- [ ] Axe-core and 200% zoom are separate steps; say when skipped. A clean scan is not WCAG compliance.
- [ ] Geometry findings are candidates until reproduced; subjective issues are recommendations, not bugs.

## 5. Interactive and 3D apps (learned on GJH Virtual Mall v11)
- [ ] **Phone first.** Test on the owner's real device class (iPhone, 393 wide). Desktop headless GPU numbers do not transfer.
- [ ] HUD has three layers only: location (top-left), one Tools button (top-right), one bottom context card. Never cover the central 60 percent of the view.
- [ ] Top bar fits 393 px in one slim row; icons with labels only when width allows.
- [ ] One control kit: identical size, shape, colour and states for Run, Action, Zoom, Joystick; >= 44 px targets.
- [ ] Held or selected items can always be resolved from where the visitor stands (no dead ends such as "return to a shelf you walked away from").
- [ ] Performance: measure p95 and p99, not only average FPS. Record slow frames >= 50 ms with their zone. Compare Low vs Balanced before blaming throttling.
- [ ] First-use costs (shader compile, texture and buffer upload) belong in the loading screen; walk the whole mall right after load and expect zero frames >= 50 ms.
- [ ] Coplanar surfaces (z-fighting) scanned by a geometry test; fix by removing duplicate faces, not by offsets.
- [ ] Legibility beats 3D detail: shop names must stay readable on a 393 px screen; lettering contrast >= 4.5:1.
- [ ] Signage and interiors read as real brands (logo lockup, material, backlight), not text on a plaque.
- [ ] Tutorial, loader and error states are designed, not default.

## 6. Machine checks (only after sections 3-5)
- [ ] Generators and `--check`, SSOT check, unit tests, browser suites on the final candidate only, console clean.

## 7. Report format
Per finding: id, viewport, region, evidence path, OBSERVED/RECOMMENDATION/TEST_CANDIDATE, severity, expected vs actual, narrow fix, acceptance criterion. Finish with what was **not** verified.
