# Team editor spec (binding): parallel workers with job titles

Owner request 2026-11-21: the Settings page lets the owner set up the parallel workers and give each a job title. Node 23, zero dependencies, CommonJS for Node files, plain browser scripts for UI.

## Data model (stored per project in `<project>/agents.json`, already the team file)
One entry per WORKER (the Manager, id `00`, is separate and not editable here):
```json
{ "id": "02", "name": "Agent 2", "title": "Hero Designer", "section": "hero",
  "lane": "hero: the ONLY h1, ...", "color": "#f76b15",
  "runner": "pi", "model": "gpt-6.2-sol", "effort": "medium", "position": "hero-designer" }
```
- `id`: two digits `01`..`99`, unique, never `00`. New workers get the next free id above the current maximum.
- `name`: 1..40 chars. `title` (job title): 1..60 chars, free text; the UI suggests titles from the staff positions (`staff.json`, `positions[].title`). `lane`: 1..400 chars (what this worker owns and must do). `color`: `#rrggbb`.
- `section`: `[a-z][a-z0-9-]{1,24}`, unique. It names the page section file pair `sections/<id>-<section>.html|css`. It is IMMUTABLE for an existing worker (renaming files is out of scope); it is chosen when the worker is added.
- Optional per-worker `runner`, `model`, `effort`: each, when present, must be inside the allowlist of `lib/settings.js` (`ALLOWLIST`: runners codex, pi; models gpt-6.2-sol, gpt-6.1-terra; efforts medium, xhigh). Absent means "inherit the role default" (Settings roles.workers, then defaults). `position` optional string, an id from the staff roster.
- At most 16 workers.

## lib/team.js (worker R6)
```js
const T = require('./team');
T.LIMITS                          // {maxWorkers:16, name:40, title:60, lane:400}
T.validate(input, { allowlist })  // -> { ok, errors:[{path,message}], value }  value = normalized array; paths like 'agents[2].title'
T.nextId(agents)                  // -> next free two-digit id ('11'), throws when full
T.diff(oldAgents, newAgents)      // -> { added:[agent], removed:[agent], changed:[{id, fields:[...]}] }  (section change of an existing id is an ERROR in validate when called with existing: pass opts.existing)
T.palette(index)                  // -> distinct accessible colour for new workers (cycle through at least 12 colours, all #rrggbb)
T.view(agents, staffPositions)    // -> {agents, titles:[...suggested titles]}
```
`validate(input, { allowlist, existing })`: reject non-array, duplicate ids or sections, id `00`, bad formats, unknown keys are dropped, control characters stripped from text fields, overrides outside the allowlist (error at `agents[i].runner` etc.), changed `section` for an existing id, more than 16 workers, fewer than 1 worker.

## HTTP API (server wiring by the manager)
- `GET /api/team` -> `{ agents:[...], titles:[...], maxParallel, busy }`.
- `PUT /api/team` body `{ agents:[...] }` -> 200 `{ agents, diff }` or 400 `{ errors }` or 409 `{ error:'busy' }` while a request is running. Applying: new workers get section stubs, notes, inbox, discussion and outbox files; removed workers' section files move to `<project>/retired/` (nothing is deleted); CONTRACT.md lanes are regenerated; the viewer rebuilds.
- Concurrency stays in Settings (`concurrency.maxParallel`).

## UI contract (worker R5): extend `window.SwarmSettings`
`SwarmSettings.init({ root, load, save, test, team })` where `team = { load() -> Promise<{agents, titles, maxParallel, busy}>, save(agents) -> Promise<{ok, errors?, agents?}> }` (optional: without `team` the Team section is not rendered).
A new section "Team: parallel workers" (above Advanced) with:
- A header line: `<n> workers, up to <maxParallel> run at the same time` and a Save team / Reset bar that is separate from the settings bar (saving the team never saves settings and vice versa).
- One compact card per worker: colour dot, Name input, Job title input with a `datalist` of the suggested titles, section shown read-only as `NN-section`, Lane textarea (auto-grow, 400 limit with counter), a "Runner" select (Default, Codex CLI, pi), and when a runner is chosen the Model and Effort selects (only allowlisted values, no `low`); a Remove button with a confirm step ("Remove Agent 7? Its section moves to retired/, nothing is deleted.").
- "Add worker" form: name (default `Agent N`), job title, section name (lowercase letters, digits, hyphen), lane; the colour is assigned automatically; Add is disabled when 16 workers exist or the fields are invalid. New cards are marked "new, not saved".
- While `busy` is true show a notice "The team is working: changes can be saved when it finishes" and disable Save team.
- Server errors map to the exact field via the `path` (`agents[2].title`). Safe DOM building only (no innerHTML with user text), keyboard accessible, dark theme (#13161c, #e8eaf0, #262b36, #171a21), works at 329px and 393px, SVG icons only.
- The demo page gets fake `team.load/save` (including a simulated 400 with field errors and a busy state).

## Ownership
R6: `swarm/lib/team.js`, `swarm/test/team.test.js`. R5: `swarm/ui/settings.js`, `swarm/ui/settings.css`, `swarm/ui/settings-demo.html`. The manager owns `server.js`, `cli.js`, `ui/index.html`, `lib/turns.js`.
