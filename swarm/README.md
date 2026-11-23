# Swarm

Swarm runs a Manager and a team of Codex workers on a shared webpage project.
The owner and Claude Code can direct the team in a live group channel.

## Quick start

From the repository root, with Node.js 23 and Codex CLI available:

```sh
node swarm/cli.js start
```

Open the printed URL (default `http://127.0.0.1:8800/`). `start` replaces an
existing project with the selected name. Use `start --keep` to open that project
and preserve its files. The CLI rejects a port already serving a different
project or checkout. Direct initialization requests must include the `project`
and `projectId` of the intended target from `/api/state`.

## Channel

- The owner posts in the browser or CLI. Claude Code posts with `chat`.
- The Manager triages, then workers discuss, the Manager decides, and assigned workers edit their sections before the Manager summarizes.
- Participants are `owner`, `claude`, `00` (Manager), worker IDs such as `01`, and `system`.
- Mentions such as `@03`, `@Agent 3`, `@hero`, and `@all` resolve to recipient IDs.
- Messages carry a server-assigned ID and timestamp, sender, recipients, kind, and text, with optional task and reply fields.
- The kinds are `msg`, `assign`, `decision`, `done`, and `system`.
- Agents read `channel.md` and post JSON lines to their own `chat/NN.jsonl` outbox.
- The server writes the canonical `channel.jsonl` log and refreshes the transcript.
- HTTP handles posting and history. The SSE stream broadcasts live messages.
- See [CHANNEL_SPEC.md](CHANNEL_SPEC.md) for the full protocol.

## CLI commands

Run each command as `node swarm/cli.js <command>`.

| Command | Behavior |
| --- | --- |
| `start [--keep] [--brief "text" \| --brief-file file] [--agents file]` | Start the server if needed and prepare the selected project. `--keep` opens it as is. |
| `status` | Show the current phase, round, and agent status. |
| `say <id\|all> "message"` | Send a legacy inbox instruction. |
| `stop` | Stop active agents. |
| `url` | Print the browser URL. |
| `quit` | Stop the server. |
| `chat "text" [--from claude\|owner]` | Post as Claude by default and print the message ID. |
| `tail [--since N] [--limit N]` | Show up to 20 recent messages by default, with IDs greater than `--since` (default 0). |
| `watch` | Stream chat, round, and status updates until Ctrl-C. |
| `wait [--idle 20] [--timeout 600]` | Print the last 20 messages after the idle window or timeout, in seconds. Exit 0 on idle, 2 on timeout. |

`wait` considers the team idle while no agent status starts with `working`.
Command errors exit 1. Use `--port` to override the CLI port.

## Directory layout

- `cli.js`, `server.js` — command interface and local server.
- `lib/`, `ui/` — channel storage and turn orchestration, and the browser viewer.
- `template/`, `briefs/` — project defaults and example inputs.
- `projects/<name>/` — project files, agent work, and channel data.
- `.run/`, `test/` — server PID and log, and integration tests.

## Environment

| Variable | Default | Purpose |
| --- | --- | --- |
| `SWARM_PORT` | `8800` | Local server and CLI port. |
| `SWARM_PROJECT` | `home` | Project directory name. |
| `SWARM_MODEL` | `gpt-6.2-sol` | Model override when `SWARM_TEST=1`. Set the model in Settings for regular use. |
| `SWARM_EFFORT` | `medium` | Reasoning effort override when `SWARM_TEST=1`. Settings accepts `medium` or `xhigh`. |
| `SWARM_CODEX` | `codex` | Codex binary override when `SWARM_TEST=1`. |

Log in with the selected runner before starting a turn. Runner processes and
readiness probes receive an allowlist of local environment variables for paths,
locale and CLI configuration. Worker turns also receive the current Swarm port
for the local image helper. Server API keys stay out of runner processes.

## Settings workspace

Open **Settings** from the viewer to switch between Roles, Research, Autopilot,
Team, and Advanced. The Images section appears when the server supports image
generation settings.

Team shows workers' reported status, runner, and assigned section. Search by
worker or section, filter by runner or status, or select workers to change their
runner in one draft. Select a worker to edit their settings and inspect the
effective runner, model, and effort. On a phone, use **Workers** to return to
the roster.

**Save team** applies the roster draft when the team is idle. **Save settings**
applies the general settings draft separately. Saved changes apply from the
next agent turn. Switching sections keeps both drafts available.

## Session usage

The **Session usage** bar totals tokens reported by agent processes since the
Swarm server started. It updates as the runners report usage and survives a browser
refresh. **Usage by agent** shows the same totals, token breakdown, and runners
used during the session per agent.
Input excludes cache reads and includes cache writes. Cache shows tokens read
from cache. Output includes reasoning tokens. Usage reports without a complete
breakdown still count toward the total and are marked as partial in the breakdown.
Swarm uses the USD estimate reported by pi. For Codex CLI, Swarm calculates an
estimate from the model selected for each turn and the published standard
short-context API rates, with 30-minute pricing for reported cache writes.
Turn totals cannot identify individual long-context requests. The estimate
covers reported model tokens and does not represent an account bill. The
page marks the estimate as partial or unavailable when pricing data is missing.

## Verification

```sh
node swarm/test/e2e.js
```
