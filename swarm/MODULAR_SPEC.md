# Modular-First spec (binding): ownership, isolated workspaces, controlled integration

Owner request 2026-11-21. Compatible with SQUAD_SPEC (layer files), FASTPATH_SPEC (contract, versions), ANCHOR_SPEC (approved anchor). Swarm projects are git-ignored data folders, so Git worktrees do not apply; the EQUIVALENT is an isolated workspace copy per worker plus a controlled integrator.

## Ownership manifest (`<project>/ownership.json`, generated, deterministic)
Each module = one page section (`NN-name`). Classes of path:
- `owned`: files a given worker may change (its section html/css, its layer files, `notes/ID.md`, `chat/ID.jsonl`, `assets/generated/NN-name-*`).
- `shared`: needs cross-module coordination (`tokens.css`, `design-system/*`, `contract.json`, `CONTRACT.md`, direction/decisions docs, other sections' files): changed only through an APPROVED change request (Manager or Claude), never by a worker's own turn.
- `forbidden`: anchors (immutable), `agents.json`, `ownership.json`, `.run/`, anything outside the project.
`lib/ownership.js`: `build({ agents, squad, sections }) -> manifest`, `classify(manifest, workerId, relPath) -> 'owned'|'shared'|'forbidden'|'foreign'`, `approvalRequired(manifest, workerId, changes) -> { required, reasons[] }`.

## Isolated workspaces + controlled integrator (`lib/integrator.js`)
```js
const I = require('./integrator');
I.open(projectDir, workerId, manifest) -> { id, dir, base:{ path:{sha256} } }     // copies only what the worker may read (whole sections/, tokens, docs) into <project>/.run/ws/<id>/, records base hashes
I.diff(ws) -> { added:[], changed:[], removed:[] }                                    // by hash vs base
I.validate(ws, manifest, opts) -> { ok, violations:[{code,path,message}] }            // codes: foreign|shared|forbidden|scope|stale|overlap|size|invalid-css
I.merge(projectDir, ws, manifest, opts) -> { ok, merged:[], rejected:[], snapshotId } // atomic, per file, only owned paths; STALE if the live file changed since base (hash differs) unless identical; OVERLAP if two open workspaces touched the same path (first merged wins, the other is rejected with code overlap); takes a component snapshot first
await I.publish(projectDir, ws, { accept, anchorId })                          // validate, stage the exact preview, await the gate, then recheck inputs and commit under the project lock
I.rollback(projectDir, snapshotId, { paths? })                                        // component-level: restore only the given module's files, unrelated later changes stay
I.close(ws)
```
Scope validation of CSS reuses `tools/check-sections.js` (`checkProject`, rule `layer-scope`/unscoped selectors) on the merged candidate, in a temp copy, before touching the live project. Size caps per file. Nothing is deleted without a snapshot.

To prepare a runner workspace, opt into `build({ agents, squad, sections, launchContext: true })` with the Manager in `agents`. `I.open` freezes that launch's ownership and copies the channel transcript, staff guidance, roster notes and discussion, and the runner's own inbox. Only the Manager can publish its planning documents outside a squad's delegated research lane. A worker's own `discussion/ID.md` remains writable. The Manager has no workspace outbox.

For a worker launch, `I.workerOutbox(ws)` reads up to 64 KiB from its fresh JSONL outbox. The server validates these posts before accepting the turn and appends them to the canonical channel under the launched identity after acceptance. Existing project outboxes stay archived. Workspace copies enforce publication ownership. Same-user Pi processes still need an operating-system boundary for filesystem isolation.

## Indirect impact detection (`tools/impact-check.js`)
`node swarm/tools/impact-check.js --before dir --after dir [--widths 393,768,1440] [--json out.json]`: exports both project states (`tools/export-page.js`), renders each in headless Chrome at each width, measures every section's bounding box via DevTools and screenshots, and reports per section: moved/resized (box delta), pixel difference (reuse `tools/visual-compare.js` if present), JS console errors, horizontal overflow. API `impact(before, after, { owner })` returns `{ ok, perSection:[{id, owned, boxDelta, diffRatio}], unexpected:[ids] }` where `unexpected` = changed sections that the author does not own (cascade leaks, layout shifts below, overflow). A worker's merge is only accepted when `unexpected` is empty or explicitly approved.

Runtime publication allows normal vertical flow when adding content to a blank section created by initialization. A blank peer can shift vertically, and a populated peer below can move down if it occupies the same position with the owner hidden. The gate still checks peer pixels, size, x-position, overflow and browser errors. The standalone checker reports all moves by default. It renders the generated export at three widths. Studio language and theme parity still needs verification.

## Manager side (not delegated)
The server launches all turns in workspaces. It serializes publication, checks ownership and visual impact, and posts rejection reasons to the channel. Accepted file changes record the snapshot and any locked anchor or design contract hash in `<project>/integration/log.jsonl`.

Pending manager work includes the change-request API (`POST /api/change-request`) for approval of shared changes, a pending-request viewer and component rollback API.

## Acceptance (from the owner)
A Header worker can change the Header without touching Hero, Brands or Footer files; indirect impact is detected before approval; shared design-system changes need explicit approval; workers cannot overwrite each other; rollback of one component keeps unrelated changes.

## Worker rules
Own only your files; `node --check`; node:test tests with exact counts; no git state changes, no installs, English, no em dashes.
