# Image-First Anchor spec (binding)

Owner request 2026-11-21: the Manager approves a high-fidelity design IMAGE before any implementation; every worker follows the same approved anchor. Builds on `FASTPATH_SPEC.md` (contracts, versions, metrics) and the squad layers (`SQUAD_SPEC.md`). No backend behaviour is replaced; the anchor flow is a new, optional gate in front of the existing flow.

## State machine (one per project, `<project>/anchors/flow.json`)
`goals -> generating -> advisor_review -> awaiting_approval -> locked -> implementing -> qa -> final_review -> done`
Side transitions: `advisor_review -> generating` (advisor asks for revision, max 3 rounds), `awaiting_approval -> generating` (Manager requests revision, any number), `qa -> implementing` (verified deviations, max 3 rounds), any state -> `failed` (with reason, recoverable by `retry`), `locked` can only be left towards `generating` through an explicit Manager `unlock` (design direction changes need Manager authorisation, recorded).
Hard rules: implementation (squad, fast path composition, workers) is refused unless state >= `locked`; anchors are immutable once locked (files made read-only 0444, sha256 recorded, any mismatch aborts the run); only an actor `manager` (the owner or `claude`) may approve, revise, unlock; the advisor may only review.

An operator can rerun visual QA from final review or after sign-off. The
server's `check_again` transition opens QA for the same locked anchor.
Final approval requires a passing comparison for the current design revision.

## Anchor store (`<project>/anchors/vNNN/`)
`anchor.desktop.png`, `anchor.tablet.png`, `anchor.mobile.png` (1440, 768, 393 wide; mobile and tablet optional), `meta.json` {id, createdAt, goals, prompt, model, files:{name:{sha256,bytes,width,height}}, status:'draft|approved|locked|superseded', advisor:{verdict,score,findings[]}, approvedBy, approvedAt}, `contract.json` (versioned Design Contract from FASTPATH_SPEC plus `anchorId` and `anchorSha256` map and `rules` per breakpoint: layout columns, type scale, spacing scale, palette, imagery). Version numbers only grow; superseded anchors are kept.

## lib/anchors.js (worker A1)
```js
const A = require('./anchors');
A.create(projectDir, { goals, prompt, model, files:{desktop:Buffer|path,...} }) -> {id, dir}       // draft, immutable per version
A.list(projectDir) / A.get(projectDir, id) / A.current(projectDir)   // current = latest locked or approved
A.setAdvisor(projectDir, id, { verdict:'pass|revise', score, findings }) 
A.approve(projectDir, id, { by }) ; A.lock(projectDir, id, contract) ; A.supersede(projectDir, id, { by, reason })
A.verify(projectDir, id) -> { ok, mismatches:[] }      // sha256 + size check, read-only bits
```
`lib/anchorflow.js`: `createFlow(projectDir) -> { state(), dispatch(event, { actor, ...payload }) -> {ok, state, error?}, canImplement() }` with events `set_goals, anchor_ready, advisor_pass, advisor_revise, approve, request_revision, lock, start_implementation, qa_pass, qa_fail, finish, fail, retry, unlock`. Pure transitions, persisted atomically, every transition appended to `anchors/log.jsonl` {ts, from, to, event, actor}. Illegal transitions and wrong actors return `{ok:false}` and change nothing; counters enforce the revision limits.

## tools/anchor-qa.js (worker A2)
`node swarm/tools/anchor-qa.js anchor.png screenshot.png [--out report.md] [--json report.json] [--grid 12x16]`; also `require` API `compare(anchorBuf, shotBuf, opts)`. Honest scope: an AI-generated anchor and a real render never match pixel by pixel, so the report is STRUCTURAL: (1) dominant palette (k-means or median cut, top 6) and palette distance; (2) layout grid: per cell mean luminance and edge density, per-row band comparison, reported as the biggest deviations with coordinates; (3) aspect and section-height profile; (4) a side-by-side image `<out>.compare.png` (anchor left, screenshot right, deviation heat overlay third) written with a minimal PNG encoder; (5) pass/fail score with documented weights and `--threshold`. Own small PNG decoder/encoder with zlib (all colour types, 8 bit) or reuse `swarm/tools/visual-compare.js` if it exists when you start (check; another worker writes it).

## Manager side (not delegated)
Server: `/api/anchor/*` (goals, generate, advisor, approve, revise, lock, unlock, state), Codex ImageGen step (existing image-gen specialist path and runner), Design Advisor agent step (an agent that reads the anchor image and the Manager goals and the KB UI skills and returns a verdict JSON), distribution of anchor path and contract into every worker and squad prompt, browser screenshot at 3 breakpoints via `tools/shot.js` and `anchor-qa`, QA to implementing loop, studio UI (anchor gallery with Approve / Request revision buttons, compare view). KB skills used for the advisor rubric: `ui:visual-design-lifecycle`, `ui:ux-quality-auditor`, `kb-mcp:ui-skills`.

## Worker rules
Own only your files; `node --check`; node:test tests with exact counts; no git state changes, no installs, English, no em dashes.
