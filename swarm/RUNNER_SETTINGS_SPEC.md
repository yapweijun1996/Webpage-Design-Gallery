# Runner and settings spec (binding)

Owner decision 2026-11-21: agent workers may ONLY run through two CLIs, `codex` (OpenAI) and `pi` (pi.dev). Allowed models: GPT 6.2 Sol and GPT 6.1 Terra, each with reasoning effort `medium` or `xhigh` only (no `low`, no other models, no other runners). A Settings page configures this. Node 23, zero dependencies, CommonJS for Node files, plain browser scripts for UI.

## 1. Allowlist (single source in lib/settings.js, exported as `ALLOWLIST`)
```
runners: codex -> binary "codex" ; pi -> binary "pi"
models : "gpt-6.2-sol" label "GPT 6.2 Sol" ; "gpt-6.1-terra" label "GPT 6.1 Terra"
efforts: ["medium","xhigh"]  (for both models)
```
Mapping to CLI flags (lib/runners.js):
- codex: `codex exec --json -m <model> -c model_reasoning_effort=<effort> -s workspace-write --skip-git-repo-check -C <projectDir> -` (prompt on stdin)
- pi: `pi -p --mode json --model openai-codex/<model> --thinking <effort> --no-session --no-extensions --no-skills --no-context-files` run with cwd = projectDir (prompt on stdin; verified to work)
Nothing outside the allowlist may ever reach a spawn call. Environment variables SWARM_MODEL, SWARM_EFFORT, SWARM_CODEX, SWARM_PI are IGNORED unless `SWARM_TEST=1` (tests use a fake binary through SWARM_CODEX/SWARM_PI).

## 2. Settings file (`swarm/.run/settings.json`, git-ignored; defaults in code)
```json
{ "version": 1,
  "defaults": { "runner": "codex", "model": "gpt-6.2-sol", "effort": "medium" },
  "roles": { "manager": {}, "workers": {} },
  "concurrency": { "maxParallel": 12 },
  "timeouts": { "turnMinutes": 20 },
  "channel": { "language": "zh-Hans", "standingRules": "" } }
```
`roles.manager` and `roles.workers` hold optional partial overrides `{runner?, model?, effort?}`. `concurrency.maxParallel` integer 1..16. `timeouts.turnMinutes` integer 1..60. `channel.language` is `zh-Hans` or `en` (language agents use in the channel; code and page copy stay English); `standingRules` free text <= 1000 chars (control characters stripped). Unknown keys are dropped; invalid values are NEVER silently accepted: `validate()` returns errors with the JSON path, `load()` falls back to defaults for invalid fields and returns warnings.

## 3. lib/settings.js (owner R1)
```js
const S = require('./settings');
S.ALLOWLIST; S.DEFAULTS;
S.validate(input)            // -> { ok, errors:[{path,message}], value }   value = normalized full settings (defaults filled in)
S.load(filePath)             // -> { settings, warnings:[] }  missing file => defaults; corrupt JSON => defaults + warning; never throws
S.save(filePath, input)      // -> { ok, errors, settings }  validates, writes atomically (temp + rename), mkdir -p, mode 0600
S.resolve(settings, role)    // role 'manager' | 'worker' | agent id -> { runner, model, effort } always inside the allowlist (role override, else defaults)
S.preamble(settings)         // -> string for agent prompts: standing rules + channel language instruction, e.g. "Channel language: Mandarin Chinese (普通话)... Keep code, file names and page copy in English."
S.publicView(settings)       // -> object for the UI: settings + allowlist + labels
```

## 4. lib/runners.js and lib/guard.js (owner R2)
```js
const R = require('./runners');
R.get('codex'|'pi')           // throws for any other name
runner = { name, binary(env), buildCommand({ model, effort, projectDir }) -> { command, args, cwd, input:'stdin' },
           createParser() -> { push(chunk) -> normalizedEvents[], end() -> normalizedEvents[] },
           readiness({ model }) -> Promise<{ ok, version, login, detail, ms }> }   // NO model call: codex: `codex --version` + `codex login status`; pi: `pi --version` + `pi auth check --model openai-codex/<model> --json` (parse {"status":"ready"})
```
Normalized events (what the server turns into cursor moves and thought bubbles):
- `{ kind:'thought', text }`: codex `item.completed` with `item.type:"agent_message"`; pi: accumulate `message_update` with `assistantMessageEvent.type:"text_delta"` and emit ONE thought on the assistant `message_end` (role "assistant", content parts of type "text").
- `{ kind:'action', verb:'reading'|'editing'|'running', target: <path or command>, sections:[ "NN", ...] }`: codex `item.started` `command_execution` (verb by the same heuristics as server.js `digest`; sections parsed from `sections|notes|discussion/NN`); pi `tool_execution_start` with toolName read -> reading, write/edit -> editing, bash -> running (parse paths from args.path or the command).
- `{ kind:'done', ok:true, usage? }`: codex `turn.completed`; pi `agent_settled` with `aborted:false`.
- `{ kind:'error', text }`: codex `item.completed` type "error" that is NOT the known "ignoring unrecognized configuration settings" warning, `turn.failed`; pi `tool_execution_end` with `isError:true` is an action result, not a fatal error; pi `agent_settled` with `aborted:true` is an error.
The parser handles chunk boundaries (partial lines), blank lines and non-JSON lines. Real recorded samples: `swarm/test/fixtures/codex-json-sample.jsonl` and `swarm/test/fixtures/pi-json-tool-sample.jsonl`; use them as test inputs (replay line by line and in random chunk splits).
Guard (`lib/guard.js`): pi has NO filesystem sandbox, so after each pi turn the server compares the project tree to a snapshot taken before the turn: `guard.snapshot(projectDir)` -> Map(path -> {size, mtimeMs, hash for files <= 1 MB}) ignoring `chat/`, `channel.*`, `.checkpoint`, `dist/`; `guard.violations(before, after, ownedGlobs)` -> relative paths that changed but are not owned. Owned globs for an agent: `sections/NN-*.html`, `sections/NN-*.css`, `notes/NN.md`, `discussion/NN.md`, `chat/NN.jsonl` (the manager: `direction.md`, `decisions.md`, `review*.md`, `chat/00.jsonl`). Include glob matching without dependencies.

## 5. HTTP API (server wiring by the manager)
`GET /api/settings` -> `{ settings, allowlist, resolved:{manager,worker}, status:{codex,pi} }`. `PUT /api/settings` (full settings) -> 200 `{settings}` or 400 `{errors}`; it is allowed at any time and changes apply from the NEXT agent process (running processes are not touched). `POST /api/settings/test` body `{runner, model}` -> readiness result (section 4). The server never accepts runner/model/effort values outside the allowlist.

## 6. UI contract (owner R3): `window.SwarmSettings`
`SwarmSettings.init({ root, load, save, test })` where `load() -> Promise<{settings, allowlist, resolved, status}>`, `save(settings) -> Promise<{ok, errors?, settings?}>`, `test({runner, model}) -> Promise<readiness>`; `SwarmSettings.open()`, `.close()`, `.refresh()`.
A settings panel (it is shown inside a dialog the manager opens from a gear button; the module renders its own `<section>` into `root`): runner choice (two radio cards "Codex CLI (OpenAI)" and "pi (pi.dev)" each with a status dot and a Test button showing version and login), default model (two cards GPT 6.2 Sol, GPT 6.1 Terra), effort (segmented control Medium | xhigh), role overrides (collapsed "Advanced": manager and workers each with runner/model/effort or "Same as default"), concurrency (stepper 1-16), turn timeout (minutes), channel language (Mandarin | English) and standing rules (textarea with counter). A live summary line "Workers: codex, GPT 6.2 Sol, medium". Unsaved-changes bar with Save and Reset, inline errors from the server mapped to fields, a note that changes apply from the next agent turn, keyboard accessible, safe DOM building (no innerHTML with user text), dark theme (#13161c, #e8eaf0, #262b36, #171a21), works at 329px (sidebar) and 393px phone width, reduced motion honoured. SVG icons only (inline), never emoji.

## 7. Ownership
R1: `swarm/lib/settings.js`, `swarm/test/settings.test.js`. R2: `swarm/lib/runners.js`, `swarm/lib/guard.js`, `swarm/test/runners.test.js`, `swarm/test/guard.test.js`. R3: `swarm/ui/settings.js`, `swarm/ui/settings.css`, `swarm/ui/settings-demo.html`. The manager owns `server.js`, `cli.js`, `ui/index.html` and wires the three together.
