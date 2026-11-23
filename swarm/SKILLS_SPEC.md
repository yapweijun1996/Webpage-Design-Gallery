# Standalone Skills architecture (binding): project-local CLI Skills, no KB-MCP at runtime

Owner request 2026-11-21: Swarm must run with no KB-MCP dependency; locally managed, versioned Skills guide specialised CLI workers; Skills are guidance only, permissions and integration safety are enforced by the Orchestrator.

## Audit (evidence)
- Runtime code (`server.js`, `cli.js`, `lib/`, `tools/`, `ui/`) contains NO reference to KB-MCP. KB was only used by the controlling agent (Claude) for retrieval and reflection, outside the product. Nothing to remove from the runtime; the work is to give Swarm its own Skills and lessons store and to document that KB is optional for the human-side manager.
- Existing local guidance: `staff/staff.json` (21 positions, each lists `skills` packs), `staff/handbook/*.md` (10 packs), `staff/playbooks/*.md` (one per position), injected as a preamble by `lib/staff.js` (max 1400 chars).
- pi 1.4.0: `--skill <path>` (file or directory, repeatable). Verified 2026-11-21: with `--no-skills`, an explicit `--skill <dir>` IS loaded and used (secret-word test), and without it the skill is unknown. So pi can receive exactly the role's skills.
- codex: discovers global skills in `~/.codex/skills` (many unrelated skills) and has no per-run skill flag. Therefore for codex workers Skills are INJECTED as text into the prompt (role based, capped), never by path.

## Skills library
`swarm/skills/<id>/SKILL.md` (built-in, versioned in git) and `<project>/skills/<id>/SKILL.md` (project override or custom). Format = pi/Anthropic skill: YAML frontmatter `name` (= id, `[a-z0-9-]{2,40}`), `description` (when to use, <=300 chars), optional `version` (semver), `roles` (position ids or `*`), `enabled` (default true), `tags`; body markdown <=8000 chars. History: every edit keeps the previous text in `<dir>/.history/<version>.md`.
`lib/skills.js`:
```js
const K = require('./skills');
K.list({ projectDir }) -> [{ id, name, description, version, source:'builtin'|'project', enabled, roles, bytes }]
K.get(id, { projectDir }) -> { meta, body }
K.save({ projectDir, id, description, body, roles, enabled, version? }) -> { ok, errors? }   // project scope, validates, bumps patch version, writes history
K.setEnabled({ projectDir, id, enabled }) ; K.remove({ projectDir, id })                      // remove only project skills; builtin can only be disabled
K.assignments({ projectDir }) -> { byPosition:{pos:[ids]}, byWorker:{id:[ids]} }  // stored in <project>/skills.json; defaults derived from staff.json `skills`
K.assign({ projectDir, target:{position|worker}, ids }) ; 
K.resolve({ projectDir, workerId, position, runner, budget }) -> { dirs:[abs skill dirs] (for pi), text:'compact injected text' (for codex and fallback), ids }   // only enabled skills assigned to this worker; never all skills
K.migrate()   // converts the 10 staff handbook packs into builtin skills (idempotent)
```
Security: ids are validated, no path traversal, symlinks rejected, bodies treated as untrusted text (no execution), size caps, prototype keys dropped. Skills never grant permissions.

## Orchestrator integration (manager side)
The server resolves the enabled skills once per runner attempt using its staff position and worker assignments. Pi receives repeated `--skill <dir>` flags while automatic discovery stays off. Codex receives up to 3,000 characters of skill text in its preamble. Ownership, merge, rollback and visual QA stay in the Orchestrator (MODULAR_SPEC).

The **Skills** section in Settings reads and edits the active project's library. API mutations send a JSON object with the `projectId` returned by the catalog, and require an idle project.

| Request | Purpose |
| --- | --- |
| `GET /api/skills` | List skills, positions, workers and effective assignments. |
| `GET /api/skills/:id` | Read metadata and Markdown. |
| `PUT /api/skills/:id` | Save `description`, `body`, `roles` and optional `enabled` as a project skill or override. |
| `PATCH /api/skills/:id` | Change `enabled`. |
| `DELETE /api/skills/:id` | Remove a project skill or override. |
| `PUT /api/skill-assignments` | Save `ids` for exactly one `target.position` or `target.worker`. |

## Local lessons and task history (`lib/lessons.js`)
`<project>/lessons/lessons.jsonl` entries `{ id, ts, title, text, evidence:[...required, non-empty], tags, status:'verified'|'proposed', supersedes? }`. `add` REQUIRES evidence and refuses empty or secret-looking text (api keys, tokens); `list`, `search(keywords)` (simple ranking), `forPrompt({tags, budget})` for injection; a verified lesson is never overwritten, a correction is a new entry that `supersedes` it. Task history = existing channel.jsonl, anchors/log.jsonl, integration/log.jsonl (no new store).

## Worker rules
Own only your files; node:test with exact counts; `node --check`; no git state changes, no installs, English, no em dashes.
