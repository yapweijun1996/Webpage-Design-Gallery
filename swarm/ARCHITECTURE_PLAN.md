# Modular Swarm architecture: gap analysis and implementation plan (2026-11-21)

Scope: the owner's PRDs "Modular Swarm Architecture", "Modular-First", "Image-First Anchor", "10-Second Swarm" and "Design Studio UI" are ONE programme. Binding detail lives in `MODULAR_SPEC.md`, `ANCHOR_SPEC.md`, `FASTPATH_SPEC.md`, `STUDIO_SPEC.md`, `SQUAD_SPEC.md`, `TEAM_SPEC.md`. This file maps requirements to what exists and what is missing. Status values are evidence based: DONE = merged and tested, WIP = a worker is building it, TODO = nothing yet.

## Reusable infrastructure (inspected)
Node server with SSE and CLI; chat protocol with per-agent outboxes; turn orchestrator (`lib/turns.js`: triage, waves, squad, fast lane); runners for codex and pi (`lib/runners.js`); settings with allowlist; ownership guard (`lib/guard.js` snapshots, used for non-squad agents); layer files (`lib/layers.js`) and squad roster (`lib/squad.js`); linter and exporter (`tools/check-sections.js`, `export-page.js`); screenshot tool (`tools/shot.js`); SDS tokens and components; scope guard that reverts out-of-scope layer CSS (server.js `scopeGuard`); secret store and OpenAI image client; team editor.

## Gap analysis
| PRD requirement | Status | Existing / in progress | Gap |
|---|---|---|---|
| 1 Ownership: writable paths, read-only deps, shared policy, tooling enforcement | WIP | layer files, `guard.js`, `scopeGuard`; M1 builds `lib/ownership.js` | read-only dependency declarations; shared-resource change requests; enforcement at merge time instead of after the fact |
| 2 Isolated environment per worker, base commit, branch, lifecycle, cleanup | WIP | M1 `integrator.open/close` (workspace copy + base hashes) | projects are git-ignored data, so "worktree" = workspace copy with base hash set (equivalent); lifecycle table (opened, running, submitted, merged, rejected, cleaned) and cleanup sweeper |
| 3 Single-writer integration controller: ownership, contract, dependency, stale, overlap, semantic failures, rollback, history | WIP | M1 integrator, F2 contract and versions | queue (ordering, serialisation), dependency checks between modules, semantic checks (impact-check, lint, export success), integration log |
| 4 Anchor authority, same anchor to all workers, authorisation to change | WIP | A1 anchor store and flow state machine | anchor generation step (Codex ImageGen or OpenAI API), advisor review agent, distribution into every worker prompt, unlock authorisation UI |
| 5 Visual QA: screenshots at breakpoints, compare to anchor, overflow/overlap/missing, defect routing, bounded loops, evidence | WIP | A2 `anchor-qa`, M2 `impact-check`, F3 `visual-compare`, `shot.js` | defect to module-owner routing, bounded repair loop (max 3), evidence store (`integration/evidence/`), missing-element detection |
| 6 KB-MCP: retrieve rules before planning, record verified lessons, never overwrite canon | PARTIAL | manager already searches skills and records reflections (verified lessons only) | automatic "retrieve project rules" step at turn start (cached per session), explicit write policy: new memory only, no canonical edits |
| 7 Swarm UI: Module Ownership, Worktree Manager, Integration Queue, Visual QA views | WIP | S1/S2/S3 studio shell, activity, compare | four new views fed by the integrator and QA data; real task dependencies and conflicts display |
| Exec rules: no direct writes to stable branch, no validation bypass for speed | TODO | none | squad turns must run inside workspaces and merge only through the integrator |
| Fast path 10 s | WIP | F1 composer, F3 bench: compose plus export p95 69 ms measured | browser first paint, HTTP, snapshot cost not yet measured; no claim of 10 s yet |

## Implementation plan (phases, with dependencies)
P0 done: specs, gap analysis (this file).
P1 foundations, parallel, disjoint files (RUNNING): F1 composer, A1 anchors, A2 anchor QA, M1 ownership+integrator, M2 impact check, S1 S2 studio UI, R8 settings for OpenAI images. F2, F3, S3 done.
P2 manager integration (after P1, sequential, I own server.js): (a) fast path API and versions API; (b) squad turns run in integrator workspaces with merge gate: validate, impact-check, merge or reject with a channel notice; (c) change-request API for shared/global changes; (d) component rollback API; (e) integration log and lifecycle table; (f) anchor API, ImageGen step, advisor agent, anchor distribution; (g) QA loop with defect routing and the 3-round cap.
P3 UI: Module Ownership, Worktree Manager, Integration Queue, Visual QA views on the studio shell (worker S4, after P2 APIs exist).
P4 acceptance demo with reproducible evidence: parallel module edits, ownership violation rejected, overlap conflict handled, stale merge rejected, planted visual regression caught by impact-check, failure recovery (kill a worker mid-turn), rollback of one module; evidence in `swarm/evidence/<date>/` and a QA summary for the Manager.
P5 KB: auto rules retrieval step; record verified lessons after P4.

## Risks and honest limits
- AI-generated anchors never match renders pixel by pixel: QA is structural (palette, grid, section profile) plus agent judgment, not pixel equality.
- Worker sandboxes block localhost and Chrome in some runs, so browser verification is done by the manager, not claimed from worker reports.
- The 10 s target is unproven until browser time is measured; model time is excluded by design on the fast path.
- Parallel CLI agents cost 60 to 140 s per turn; faster quality work needs fewer, smaller turns.
