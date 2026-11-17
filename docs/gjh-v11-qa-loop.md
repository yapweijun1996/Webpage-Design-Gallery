# GJH v11 mall: design-acceptance QA loop

Status: owner-approved decisions, 2026-11-17. Independent virtual-mall concept; no tenancy claims.

## Why
Tests and draw-call budgets pass while the scene still looks flat and does not match the design. The loop makes the design itself the acceptance test.

## Decisions (owner)
- Design authority: concept images `docs/references/gjh-mall-concept-board.png` and `gjh-mall-viewing-deck.png`. Documents follow the images.
- Pass bar: overall mood close to the concept image (tone, light, materials). Fine detail is not strict.
- Step size: one shop per round (change, advisor review of real screenshots, push to main). First shop: S01 New Moon.
- Rework cap: 5 rounds per shop. After that, downgrade to a procedural stand-in, record it as a known gap, move on.
- Advisors: five independent reviewers: visual vs concept image, mobile performance (390 width, draw calls), brand facts, spatial flow, lighting. Critique only, never edit code.
- Round-2 OMP work (visibility and contrast) finishes first and is the loop's starting point; its screenshots go to the advisors.
- Release: push to main without asking when tests pass, advisors pass and the manager has looked at the screenshots.
- Progress reports: every 20 minutes (SGT) until finished.

## Loop
1. Checklist: per shop, visible acceptance items derived from the concept image (what is seen, scale, placement, light, palette). Stored in KB-MCP (project gjh-virtual-mall).
2. Change: OMP makes one small change for one shop in an isolated worktree.
3. Evidence: build `--check`, Node tests, unit tests, SSOT, browser test, draw calls <= 200, per-shop screenshots at 390 and 1440 (`~/omp-tasks/shopcheck.py`).
4. Advisor review: the five advisors score screenshots against the checklist and concept image.
5. Rework: OMP fixes only the named issues; repeat from step 3 (max 5 rounds).
6. Release: push, confirm Pages deploy and live version, record result and lessons in KB-MCP and `task.md`.

## Known gaps carried in
- Round-1 displays are small or hidden behind mullions; scene still flat beige.
- Missing models (owner's AI agent): grand piano, chilled freezer, ice-cream cart, mullion-free glazed storefront module, canned-food pyramid display.
- Physical-device acceptance deferred; new model licences have unspecified public redistribution terms.
