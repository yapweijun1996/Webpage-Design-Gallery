# Swarm lessons (source for the KB skill `agent:live-multi-agent-design-swarm`)

Verified 2026-11-20/21 while building the tool. Keep in sync with the KB skill.

## What it is
`swarm/` is a zero-dependency Node 23 tool. One Manager (id 00) plus 10 workers (01..10) run as Codex CLI processes (`codex exec --json -m gpt-6.2-sol`). Each worker owns one section fragment (`sections/NN-name.html|css`) of one page. The browser viewer at `http://127.0.0.1:8800/` stitches the fragments live and shows named colored cursors, thought bubbles, a Slack-like Channel tab, a Team tab and a Docs tab. The owner or Claude talks in the channel; the Manager triages and assigns; workers discuss; assigned workers edit in parallel; the Manager reviews; workers improve; the Manager summarises.

## Operate (Claude drives it by CLI)
- `node swarm/cli.js start --brief-file swarm/briefs/gjh-home.md --agents swarm/briefs/gjh-agents.json --say "Kickoff: ..."` (env `SWARM_EFFORT=low|medium`, `SWARM_CODEX=<binary>` for tests). Channel mode is the default; `--legacy` runs the fixed-phase pipeline.
- `chat`, `tail [--since N]`, `watch`, `wait [--idle 20] [--timeout 600]`, `status`, `say <id|all>`, `stop`, `quit`.
- Open it in the built-in browser with a `.claude/launch.json` entry `{name:"swarm", url:"http://localhost:8800"}` and `preview_start name`; a direct `navigate` to a new localhost port is often denied.
- Tools: `swarm/tools/check-sections.js` (contract linter), `swarm/tools/export-page.js` (standalone `index.html` export).
- Tests: `node --test swarm/test/*.test.js` and `node swarm/test/e2e.js` (uses `test/fake-codex.js`, no cost).

## Protocol
See `CHANNEL_SPEC.md`. Workers append JSON lines to `chat/NN.jsonl`. The Manager returns a final `swarmChannel` envelope via the launched runner. Only the server writes `channel.jsonl` and `channel.md`. The first prompt line is `STEP: <Label> | AGENT: <id>`.

## Method that worked for building it with parallel Codex workers
1. Write the interface spec first, then split into modules with disjoint files; add more workers on new independent modules at any time (linter, exporter, tests were added mid-run).
2. The manager owns integration files (`server.js`, `ui/index.html`) and wires them against the spec while the workers run.
3. Build a zero-cost test double (`fake-codex.js` via `SWARM_CODEX`) plus an e2e test; the manager runs it because the workers' sandbox cannot bind ports.
4. Verify yourself: syntax, unit tests, e2e, real browser screenshot. Worker summaries are not evidence.

## Pitfalls hit (all fixed)
- Pushing the full `state` event into `state.feed` made the JSON circular and crashed the server.
- Race: an agent exited before the file watcher ingested its outbox, so the next step saw no assignments. Fix: `chat.sync()` right after each agent process exits.
- `turns.js` needed the Manager inside its `agents` list; the spec was ambiguous. Put such details in the spec.
- zsh does not word-split `set -- $p`; launch each worker with explicit arguments.
- `curl localhost` may hit an unrelated IPv6 server; use `127.0.0.1` in tests.
- `pkill -f swarm/server.js` kills the main server too; `/api/init` and `start` wipe the project dir, so back up finished work first.
- The permission classifier blocks compound Bash that starts servers; use `preview_start` with `.claude/launch.json`.
- Medium-effort workers took roughly 15-25 minutes for the six core modules.

## First real run: GJH home page (2026-11-21)
- Brief `briefs/gjh-home.md`, team `briefs/gjh-agents.json`, started with `SWARM_EFFORT=medium`. The Manager plus 10 workers took about 20 minutes for Triage, Discuss, Decide, Work, Review, Improve and Summary (channel messages #1-#80). Snapshot of the result: `archive/gjh-home-run1/` (sections, notes, direction/decisions/review, channel log). Regenerate the standalone page with `node swarm/tools/export-page.js <projectDir>`.
- Result checked at 393px and 1440px: one h1, real library images, no horizontal overflow, linter 0 errors and 0 warnings.
- A follow-up request through the channel (`chat "@Agent 8 ..."`) took about 5 minutes end to end and worked as designed.

## More pitfalls found in that run
- A worker inlined a 190 KB image as a `data:` URI because the server did not serve the V11 mall images. Mount asset routes (`/gjh/`, `/gjh-v11/`) before the run; the linter now warns on inline data URIs over 20 KB.
- The exporter only knew `/gjh/` and still reported "Images missing: 0" for an unresolved `/gjh-v11/` path. It now has a prefix table and reports unresolved root-relative references.
- A server restarted with `--keep` loaded the default template team instead of the project's team. The project now stores `agents.json` and the server reloads it.

## UI workers and the live viewer (2026-11-21)
- The viewer serves `swarm/ui/*` straight from disk, so a worker that rewrites `channel.js` before `channel.css` leaves the owner looking at a half-updated panel (an unsized SVG became a 329px black circle). Have UI workers build in a staging directory (for example `swarm/ui/staging/<name>/`) and let the manager copy the files into place after verification.
- Pi (pi.dev) accepts the prompt on stdin (`pi -p --mode json ...`), so both runners can share one spawn path; pi has no filesystem sandbox, so the server compares the project tree before and after each pi turn (`lib/guard.js`).
- Agent effort `low` is no longer allowed by the owner; the allowlist is GPT 6.2 Sol and GPT 6.1 Terra with `medium` or `xhigh`.

## 2026-11-21 late (squad, security, speed)
- Inlining page context into specialist prompts must never crowd out the owner request: reserve the request first, truncate context, test with a huge context.
- A control server on loopback needs a Host and Origin guard and JSON-only bodies; generated HTML must be sanitized before it enters the operator document (a sandboxed preview origin is the real fix).
- The viewer must render the same CSS the exporter ships (legacy css plus layer files); otherwise reviewers judge a different page.
- Libraries are not features: anchors, integrator, fast path and versions exist but are not wired into server.js yet. Do not report them as available.
- Worker sandboxes block Chrome and localhost; the manager verifies in a real browser. Worker reports are not evidence.
- Speed: one wave of pi specialists is 60 to 85 s, three waves about 100 to 140 s, Codex specialists set the pace. Fast path compose+export p95 69 ms, browser time unmeasured.

## Anchored export captures (2026-11-23)

Headless Chrome intermittently left an export at an intermediate scroll position with the document complete and the expected hash present. Disabling smooth scrolling alone did not fix it. Align the fragment inside the opaque capture frame on load and when the iframe viewport changes. Keep smooth scrolling in the interactive export. The Chrome fixture checks the fragment, target position, viewport size and scrolling mode, and reports the geometry if it fails.
