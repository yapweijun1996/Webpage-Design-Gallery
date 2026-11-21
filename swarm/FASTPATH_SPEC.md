# Fast Path spec (binding): template-first preview in seconds, quality path in the background

Owner request 2026-11-21: usable interactive preview within 10 seconds for supported template requests, quality work continues asynchronously. Evidence rule: nothing is claimed as achieved without a repeatable benchmark.

## Inspection summary (existing architecture, kept)
Projects are folders with `sections/NN-name.html|css` (+ layer files), `agents.json`, `tokens.css`; `tools/export-page.js` assembles `dist/index.html` (about 0.5 s); `tools/check-sections.js` lints; SDS tokens and `.sds-*` components exist in `design-system/`; the squad (CLI agents, 60 to 140 s per turn) is the slow quality path. KB-MCP skills consulted: `kb-mcp:ui-skills` (entry), `ui:visual-design-lifecycle` (anchors, taste QA, approval), `ui:ux-quality-auditor` (screenshot audits). Their rules are baked into cached recipes and blocks, not re-researched at run time.

## Smallest compatible design
```
owner command "/fast <request>" or API POST /api/fast
  -> router (rules, no LLM, <5 ms)  -> recipe + brand kit (cache hit) 
  -> snapshot version (rollback point)
  -> composer (pure function: recipe + brand + overrides -> sections/*.html/css + contract.json)   ~ms
  -> export (existing tool) -> preview refresh                                                    ~0.5 s
  -> async quality path: existing squad turns, now emitting validated patches/layers, plus screenshot compare
```
No LLM runs on the critical path. Unsupported requests (no recipe, low confidence) fall back to the existing flow unchanged.

## Modules (all CommonJS, zero dependencies)
- `lib/router.js`: `route(text, { recipes, brands }) -> { recipe, brand, confidence, reason } | null`. Deterministic keyword and brand-name rules, p99 < 5 ms. `null` means "not a supported template".
- `lib/recipes.js` + `swarm/recipes/*.json` + `swarm/blocks/<id>/{block.html,block.css,block.json}` + `swarm/brands/<id>.json`: `loadAll() -> { recipes, blocks, brands }` with schema validation and in-memory cache (report `hits`). Blocks are slot-based HTML using SDS tokens and `data-i18n`; recipe = ordered block ids with slot bindings. First recipe `corporate-landing` (header, hero, brand cards, about, enquiry, footer) and brand `gjh` (colours, copy, image URLs under `/gjh/`).
- `lib/composer.js`: `compose({ recipe, brand, overrides, outDir }) -> { files, contract, timings }`. Deterministic (same input, same bytes), escapes all slot text, writes `sections/NN-name.html|css` plus `contract.json`. Never writes outside `outDir/sections` and `outDir/contract.json`.
- `lib/contract.js`: versioned design contract `{ version, recipe, brand, tokens, sections:[{id,block,slots}], owners }`. `validate(contract)`, `applyPatch(contract, patch)` where `patch = { baseVersion, owner, ops:[{op:'set'|'remove', path, value}] }`. Rejects: stale (`baseVersion !== version`), conflicting (a path already changed by another owner at this version), invalid (bad path, schema, size). Returns `{ ok, contract?, errors:[{code,message}] }` with codes `stale|conflict|invalid`.
- `lib/versions.js`: `snapshot(projectDir, label) -> id`, `list(projectDir)`, `rollback(projectDir, id)` (copies `sections/` and `contract.json`; atomic via temp dir; keeps last 20; nothing outside those two paths is touched).
- `lib/metrics.js`: `span(name)`/`end()`, `record(runId, {total, route, compose, build, render, modelTime, cacheHits})` to `<project>/.run/metrics.jsonl` (create dir), `summarize(file) -> { n, p50, p95, max, byStage }`.
- `tools/bench-fastpath.js`: `node swarm/tools/bench-fastpath.js [--runs 30] [--cold] [--render]` composes into a temp copy of the template project, exports, optionally renders with headless Chrome and measures time to first paint; prints p50/p95 per stage and total and writes `swarm/bench/last.json`. Cold run clears caches.
- `tools/visual-compare.js`: `node swarm/tools/visual-compare.js a.png b.png [--out diff.png] [--threshold 0.02]` decodes PNG with `zlib`, same-size pixel diff, prints `{ differentRatio, pass }`; exit code 1 on fail. Also exports `compare(bufA, bufB)`.

## Manager side (not delegated)
Server: `POST /api/fast`, `/fast` chat command, versions API (`GET /api/versions`, `POST /api/rollback`), metrics endpoint, preview refresh, fallback and timeout (hard 8 s guard, cancel on new request), viewer button. Human approval: fast path never pushes or deploys; production changes stay behind the owner.

## Worker rules
Own only your files; `node --check`; node:test tests with exact counts reported; no git state changes, no installs, English, no em dashes.
