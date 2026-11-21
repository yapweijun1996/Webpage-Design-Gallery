# Astra review (C): quality-tests-performance-product-fit

Reviewer: Codex gpt-6.2-astra (xhigh), read-only, 2026-11-21. Raw report, unedited.

## 1) Verdict

Hold the release until `start` verifies the target project and squad workers receive the owner’s complete request. The latest unit run passed 446 tests with two browser checks skipped, but the production squad planner, live preview, and anchor approval workflow have gaps those tests do not exercise. Archived turns put the largest latency opportunity in specialist selection and serial review waves, with three-wave turns taking 100 seconds at the median.

## 2) Top 5 risks

1. **Starting one project can erase another.** With an idle server for a different project on the selected port, the CLI proceeds to initialization. I confirmed the request sequence with an in-memory transport. **Q1**
2. **A specialist can receive zero characters of the owner’s instruction.** Replaying the archived hero through the production prompt builders dropped the entire request for both Color and Layout. **Q2**
3. **Agents judge a materially different rendering.** The archived live preview references 69 distinct SDS variables and defines none. **Q3**
4. **Squad completion gives no assurance of anchor fidelity or isolation.** Workers edit the live project, and the orchestrator announces completion even after specialist failures. **Q4–Q5**
5. **The fast-preview and squad-speed targets remain unproven.** The composer benchmark excludes the owner-facing interaction, and even archived one-wave turns took 58 seconds at the median. **Q6–Q7**

## 3) Issues table

Evidence paths are relative to `swarm/` unless indicated otherwise.

| ID | Sev | Area | Evidence (file:line) | Impact | Recommended fix |
|---|---|---|---|---|---|
| Q1 | P0 | CLI project selection | `cli.js:74,192–208`, `server.js:14,77,365–368,611–616` | `alive()` discards the server’s project identity. With a different idle project in the mocked state response, `start` issued `POST /api/init` without a target. The handler recursively removes the running server’s project. | Compare requested and active project IDs in the CLI and require the expected ID at the destructive endpoint. Test two projects sharing a port. |
| Q2 | P1 | Owner intent | `server.js:321–326`, `lib/turns.js:59–64`, `test/turns.test.js:374–380` | HTML and CSS consume the prompt budget before the request is appended. In the archived hero replay, QA received only 15 characters. The squad test substitutes four-character role prompts. | Reserve space for the full request first. Trim excerpts and test the production planner with a populated hero. |
| Q3 | P1 | Preview fidelity | `server.js:403,421`, `tools/export-page.js:247,356–375`, `archive/gjh-home-manga-v2/dist/index.html:107–114` | Agents inspect `--no-pwa` output, which omits SDS stylesheets. Its archived header uses missing variables for typography, color, borders, and blur. Visual feedback can steer a correct section away from the anchor. | Share the production stylesheet assembly with the agent preview. Compare computed styles for the same section in both outputs. |
| Q4 | P1 | Squad integration | `server.js:197–201,229–233,338–353`, `lib/integrator.js:363–374` | Squad processes run in the live project. Pi’s pre-turn snapshot goes unused for squad workers, and the post-turn guard checks only the designated layer’s selector scope. Foreign file changes bypass the tested merge controller. | Run each worker in an integrator workspace. Publish only after ownership, stale-write, and impact checks pass. |
| Q5 | P1 | Anchor acceptance | `ANCHOR_SPEC.md:7–11,28`, `server.js:322–328`, `lib/turns.js:119–128`, `tools/anchor-qa.js:338–350` | Squad prompts carry no locked anchor. Autopilot omits the QA wave (`server.js:315–318`). In a synthetic 393×844 comparison, removing a 144×44 button-shaped region still scored **95.19/100**, above the 80 threshold. | Pass the approved anchor and contract to each worker. Require a rendered comparison and explicit checks for required content, CTA, and imagery before acceptance. |
| Q6 | P1 | Fast path | `FASTPATH_SPEC.md:10–17,30`, `server.js:534–555,654–655`, `tools/bench-fastpath.js:185–203` | `/fast` chat enters ordinary orchestration. The specified `/api/fast` handler is absent. The benchmark excludes HTTP, snapshots, preview refresh, and interactivity. | Wire the recipe through snapshot, compose, export, and refresh. Time a successful preview interaction from the owner’s submission. |
| Q7 | P1 | Scheduling and coverage | `lib/squad.js:89–111`, `server.js:309–318`, `test/squad.test.js:100–124`, `test/turns.test.js:369–384` | The tested selector caps membership and orders waves. The server selects every Pi specialist and rebuilds the waves independently. The orchestration test supplies its own plan and would also pass if its first-wave workers ran serially. | Use one planner. Assert production membership, actual overlap, and dependencies with synchronization barriers. |
| Q8 | P2 | Browser evidence | `test/impact-check.test.js:143–156`, `.gitignore:1`, `test/e2e.js:125–135,215–223` | Both Chrome impact tests are opt-in and copy mutable `projects/home`. The fake-runner E2E verifies messages, documents, and HTML markers. Neither gives a fresh checkout repeatable visual acceptance. | Commit a small deterministic project fixture. Exercise one owner request through export, browser interaction, and a planted visual regression. |
| Q9 | P2 | Skills and lessons | `SKILLS_SPEC.md:27–31`, `lib/skills.js:420–449`, `lib/lessons.js:159–180`, `server.js:157–162`, `lib/runners.js:165–170` | Project skills and verified lessons have resolvers, but live prompts use the staff preamble and Pi gets `--no-skills` without explicit skill directories. Project guidance never reaches the worker through these paths. | Resolve guidance once per turn and verify the actual runner arguments and prompt. |
| Q10 | P2 | Image generation | `lib/imagegen.js:26–34`, `test/imagegen.test.js:11,28–35` | The passing test saves 200 repeated bytes as a PNG. The URL-download path also ignores HTTP status. An error document can be reported as a successful generated image. | Check download status and decode the image before saving. Cover a valid image, corrupt bytes, and an HTTP error. |

## 4) Improvements

**Quick wins (under 1 day).** Fix the project identity check and prompt budgeting first. Update onboarding to show `start --keep`, the actual `medium` default, and the unit-suite command. The README still lists `low` and only the fake E2E command. The lessons document contradicts its own earlier effort guidance, and the task list still marks implemented runner settings as pending. (`README.md:64–66,100–104`, `LESSONS.md:9,47`, `../task.md:21`, `cli.js:202`, `lib/settings.js:15`)

**Strategic.** Across 26 archived three-wave turns, median wave durations were **33.9 seconds for specialists, 30.3 for Layout, and 35.9 for QA**. Seventeen one-wave turns had a 58-second median. These were different requests. For a credible 3× target of roughly 33 seconds, benchmark the same focused edit: dispatch only the affected specialist, reuse approved assets, and automate unchanged-layout and CTA checks. Measure through accepted output at 393, 768, and 1440 pixels, including repairs. (`archive/gjh-home-manga-v2/channel.jsonl:478–1241`, `ANCHOR_SPEC.md:11,28`)

## 5) Verified vs UNVERIFIED

- **Verified.** On Node 23.10.0 the final run had **446 passed, zero failed, two skipped**. The SDS token check passed. The checkout changed during review: an earlier run had 13 CNY-related failures, and the final builder and token tests both enumerate only two brands despite the CNY brief requesting a third. (`design-system/build.js:8`, `test/sds-tokens.test.js:23`, `briefs/gjh-cny.md:17`)
- **Verified.** CLI dispatch and prompt truncation were reproduced in memory. Preview variable counts came from saved HTML, wave durations from channel timestamps, and the missing-control score from the actual comparator.
- **UNVERIFIED.** Live browser appearance, real provider output, the 10-second interactive preview, and a 3× accepted-turn speedup. `swarm/bench/last.json` was absent. The documented 69 ms p95 covers compose plus export. No server or network was used, and I made no repository edits. (`ARCHITECTURE_PLAN.md:19`, `tools/bench-fastpath.js:193–203`)