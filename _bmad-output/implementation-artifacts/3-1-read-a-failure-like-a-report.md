---
baseline_commit: 7982321
---

# Story 3.1: Read a failure like a report

Status: review

## Story

As a developer,
I want failing inference tests to print the full diagnostic contract,
so that I can diagnose a red CI run from terminal output alone.

## Acceptance Criteria

1. **Headline: pass rate vs threshold, with counts.** Given a test failing `{ runs: 20, threshold: 0.95 }` with mixed run outcomes, when the verdict renders, the first line states the outcome marker (`FAILED` or `ERRORED, not failed`), `passed/runs`, the pass rate as a decimal, the threshold and `need`; the second line counts every status: `Runs: P passed, F failed, E errored, D discarded.` [FR-8, AD-4, AD-10; closes the 2.1 deferred "headline omits failed count"]
2. **Per failing run: first failure only.** Each failed run's section shows, from its lowest-`seq` false verdict: the assertion name, which assertion of the run it was (`#k of n` judged in that run), the claim, the judge reasoning, and a bounded response excerpt; it also names the thrown failure. When the lowest-`seq` record is an `ErrorRecord`, the section names that judge error instead. [FR-8, AD-13]
3. **Bounded, configurable excerpt.** The excerpt is cut at `excerptChars` (default 500) with a `…` marker and the full length stated; never splits a surrogate pair. `excerptChars` is a new optional `crucible.config.json` field — an integer ≥ 1 — validated at config load (`CrucibleError` kind `config`). [FR-8 assumption "~500 chars, configurable", AD-9]
4. **Distinct markers.** Failed runs render under `[FAILED] Run #n`; errored runs under `[ERRORED] Run #n (infrastructure, not a semantic failure)` naming the cause and judge attempts; discarded runs on one `[DISCARDED]` line, counted in no zone. Plain-text markers only — no ANSI colour. [AD-10]
5. **Multiple assertions attribute correctly.** A run with several `coherent` calls where the second is false names the second claim (and `#2 of n`), never the first passing claim or a later false one. [AD-13]
6. **Bounded output when many runs fail.** At most 3 failed and 3 errored runs (lowest run number first) render in full; the rest are listed by run number on one `+ k more … not shown in full` line per status, and — when failed runs are hidden — a `Failing claims` tally groups every failed run by its first failing assertion + claim (de-duplication). Run-number lists compress contiguous ranges (`#4-#20`). [deferred from 2.1]
7. **Consistent headlines across outcomes.** Smoke (`runs: 1`) fail / errored / fatal / expired, multi-run fail / errored, fatal abort, and deadline expiry all lead with the same `FAILED:` or `ERRORED, not failed:` marker; smoke headlines say "the smoke run" and omit the counts line; a smoke fatal no longer prints "0 in-flight run(s) discarded". [deferred from 2.3]
8. **Records at verdict time only.** All rendering comes from run results/records at verdict time; nothing prints mid-run (`grep console. src` empty). The runner's settled/discarded snapshot is observable on the thrown `CrucibleVerdictError` as `runStatuses` (run order), so the runner-side discard snapshot is locked by runner tests without asserting message text. [AD-10, deferred from 2.3]
9. **Docs.** `docs/runs-and-threshold.md` output examples match the new layout; `excerptChars` documented.
10. **Quality gates.** `npm run lint && npm run format:check && npm run typecheck && npm test && npm run build` green; no `console.` in `src/`.

## Tasks / Subtasks

- [x] Task 1: Config `excerptChars` (AC 3)
  - [x] 1.1 RED config tests: absent → 500; valid integer resolves; `0`, negative, fractional, non-number → kind `config`.
  - [x] 1.2 GREEN: `KNOWN_FIELDS` + `CrucibleConfig.excerptChars`; shared default in `src/core/report-settings.ts` (`ReportSettings`, `DEFAULT_REPORT_SETTINGS`).
- [x] Task 2: Reporter layout (AC 1, 2, 4, 5, 7)
  - [x] 2.1 RED reporter tests per AC (content assertions on the rendered string are the reporter's contract).
  - [x] 2.2 GREEN: rewrite `Reporter` rendering; inject `ReportSettingsSupplier` (default `DEFAULT_REPORT_SETTINGS`), read at render time.
- [x] Task 3: Bounding + tally + range compression (AC 6) — RED then GREEN.
- [x] Task 4: `CrucibleVerdictError.runStatuses` + runner wiring (AC 8) — RED runner tests (fatal: settled keep status, unsettled discarded; expiry likewise).
- [x] Task 5: Composition root wires `() => ({ excerptChars: config.get().excerptChars })`; export `RunStatus` type from `src/api/`.
- [x] Task 6: Docs (AC 9).
- [x] Task 7: Gates (AC 10).

## Dev Notes

### Report layout (settled)

Multi-run fail (`runs: 20, threshold: 0.95`, 16 passed / 3 failed / 1 errored):

```text
FAILED: 16/20 runs passed (pass rate 0.8) against threshold 0.95 (need 19).
Runs: 16 passed, 3 failed, 1 errored, 0 discarded.

[FAILED] Run #2
  First failed assertion: coherent #2 of 3 in this run
  Claim: the reply never reveals the meeting location
  Judge reasoning: The reply names the cafe where they meet.
  Response excerpt (first 500 of 812 chars): …
  Thrown: Error: expect(received).toBe(expected) …

[ERRORED] Run #5 (infrastructure, not a semantic failure)
  Cause: CrucibleError: provider unreachable
  Judge attempts: 3
```

Headlines:

| Outcome | runs > 1 | runs = 1 (smoke) |
| --- | --- | --- |
| fail zone | `FAILED: P/N runs passed (pass rate r) against threshold t (need k).` | `FAILED: the smoke run (runs: 1) did not pass.` |
| errored zone | `ERRORED, not failed: P/N runs passed (pass rate r) against threshold t (need k); E errored run(s) left the result inconclusive.` | `ERRORED, not failed: the smoke run (runs: 1) hit an infrastructure problem, so there is no verdict.` |
| fatal abort | `ERRORED, not failed: aborted on a fatal error after S/N runs settled; D in-flight run(s) discarded to stop spend. Fix the provider setup (API key, model) or configuration and rerun.` (discard clause only when D > 0) | `ERRORED, not failed: the smoke run (runs: 1) aborted on a fatal error. Fix …` |
| deadline expiry | `ERRORED, not failed: the test did not finish within its X ms deadline; S/N runs settled, D in-flight run(s) discarded to stop spend. Check for a slow system under test or a throttled judge provider.` | `ERRORED, not failed: the smoke run (runs: 1) did not finish within its X ms deadline. Check …` |

- Pass rate = `passed / runs` floored to 3 decimals (never displays ≥ threshold for a failing rate; `need` is the exact criterion).
- Counts line on multi-run outcomes only; counts are taken from the results (single source).
- Multi-line values (reasoning, excerpt, thrown messages) have continuation lines indented under their section so the `[MARKER]` lines stay scannable.
- `N = 3` full sections per status (failed, errored separately — an outage never hides the semantic failures and vice versa). Justification: Jest prints the message per test; 3 sections ≈ 2–3 KB fit one screen; pass^k failures usually share a cause, so three samples show the pattern and the claim tally shows the distribution; Story 3.2 `full` is the escape hatch for everything.

### Designed for Story 3.2 (do NOT implement the ladder)

Per-run rendering selects its findings through one private seam (default level = the first failure by `seq`); the bound `N` and the tally are default-level policy. 3.2 adds `effectiveVerbosity` to `ReportSettings` and switches that selection/bound — no new layout. `ReportSettings` is read through a supplier at render time, so config never loads at registration (AD-9 inertness).

### Current state (files touched)

- `src/core/reporter.util.ts` — renderVerdict/renderAborted/renderExpired + public renderFailed/renderErrored; fixed 500 limit; `--- Run #n (status) ---` sections; unbounded. All replaced; keep: lowest-seq selection across verdict+error records, `describe` (Error, JSON, hostile toString), surrogate-safe cut.
- `src/core/runner.ts` — builds reporter messages for verdict/fatal/expired; preserve all halt semantics; add `runStatuses` to each `CrucibleVerdictError`.
- `src/core/verdict-error.ts` — `(outcome, message, cause)`; add optional 4th `runStatuses` (default `[]`).
- `src/core/config.ts` — strict `KNOWN_FIELDS`; add `excerptChars`.
- `src/api/crucible.ts` — composition root.

### Testing rules (CLAUDE.md — reviewers enforce hard)

Reporter string IS its contract (content assertions OK there, precedent). Runner tests assert `outcome`/`runStatuses`, never message text. No real timers (ManualTimer), fakes `.fake.ts`, enums `.enum.ts`, helpers in harness classes, no magic values, no comments, `type` not `interface`, named exports at end.

### Previous story intelligence

- 2.1: report unbounded / headline missing failed count → this story.
- 2.3: smoke fatal headline "0 in-flight run(s) discarded"; runner discard snapshot only lockable through a report surface → `runStatuses`.
- 2.2: never inspect fake requests.
- 2.5: Reporter built at composition (binding creation) — must not load config there.

### References

- [Source: _bmad-output/planning-artifacts/epics.md#Story 3.1, #Story 3.2]
- [Source: ARCHITECTURE-SPINE.md#AD-4, #AD-10, #AD-13]
- [Source: prd.md#FR-8]
- [Source: _bmad-output/implementation-artifacts/deferred-work.md]
- [Source: CLAUDE.md]

## Dev Agent Record

### Agent Model Used

Claude Opus 5.5 (claude-opus-5-5) via bmad-dev-story (unattended)
### Debug Log References

### Completion Notes List

- Ultimate context engine analysis completed - comprehensive developer guide created.
- Task 1 (red→green): 2 of 7 new config tests red (absent → 500, configured value); the 5 invalid rows were already `config` via unknown-field rejection and now pass through the dedicated `requireExcerptChars` rule. Shared default lives in `src/core/report-settings.ts` (`ReportSettings`, `ReportSettingsSupplier`, `DEFAULT_REPORT_SETTINGS`) so config and reporter share it without a cycle.
- Decision: config field named `excerptChars` (top-level, sibling of `verbosity`), integer ≥ 1, no upper bound (user's choice; counts UTF-16 code units, the same unit as the previous fixed cap).
- Task 2/3 (red→green): reporter tests rewritten around the new layout; 26 of 41 red before the rewrite. `renderFailed`/`renderErrored` are no longer public — every path renders through `renderVerdict`/`renderAborted`/`renderExpired` (the harness renders a single-run verdict for per-run cases). Preserved behaviour: lowest-seq selection across verdict and error records, thrown failure always named, `describe` for non-Error / hostile causes, surrogate-safe cut.
- Decision: N = 3 full sections per status, failed and errored budgeted separately (an outage never hides semantic failures, and vice versa). Rationale in Dev Notes. Hidden runs listed by number with contiguous ranges compressed (`#4-#20`); a `Failing claims` tally (count desc, stable) appears only when failed runs are hidden, so it never repeats what is already shown.
- Decision: multi-assertion attribution shows `assertion k of n judged in this run` (position among the run's verdicts sorted by seq) in addition to the claim, so identical claim text in one body is still distinguishable.
- Decision: plain-text markers `[FAILED]` / `[ERRORED]` / `[DISCARDED]`, no ANSI colour (CI logs, Jest error output, and copy/paste stay legible; no colour dependency to configure).
- Decision: headline markers `FAILED:` / `ERRORED, not failed:` shared by every outcome; smoke (`runs: 1`) headlines say `the smoke run (runs: 1)` and omit the counts line; the abort/expiry discard clause is dropped when nothing was discarded (fixes the 2.3 deferred "0 in-flight run(s) discarded" smoke wording). Pass rate is floored to 3 decimals so it never displays as meeting a missed threshold.
- Refactor found during sampling (red→green): blank lines inside multi-line values carried trailing indentation; continuation lines are indented only when non-empty.
- Task 4 (red→green, 3 red): `CrucibleVerdictError.runStatuses` (frozen, run order, default `[]`) set on verdict, fatal, and expiry rejections. This closes the 2.3 deferred item: runner tests now lock "settled keep status, unsettled → discarded" through an outcome field instead of message text. Public surface change: `RunStatus` type exported from `src/api/` and the entry point.
- Task 5: composition root passes `() => ({ excerptChars: config.get().excerptChars })` to the Reporter — read at render time only, so registration stays config-free (AD-9). Wiring is not unit-tested (needs real config; precedent 2.5, belongs to Story 3.3 e2e).
- 3.2 seam: `ReportSettings` is the place `effectiveVerbosity` joins; `firstFailure`/`shown`/`claimTally` are the default-level policy a `full` level would swap. No ladder implemented.
- AC8: all rendering happens inside `Reporter` at verdict time; `grep console. src` empty.
- Deferred-work items tagged for 3.1 (unbounded sections / missing failed count; smoke fatal headline; runner discard snapshot) are resolved by this story; entries left in deferred-work.md for the reviewer to prune.
- Suite 266 → 293 tests / 14 suites. lint, format:check, typecheck, test, build green; no `console.` in `src/`.

### File List

New:
- src/core/report-settings.ts
- src/core/test/assertion-name.enum.ts
- src/core/test/excerpt-chars.enum.ts
- src/core/test/invalid-excerpt-chars.enum.ts
- src/core/test/report-bound.enum.ts
- src/core/test/report-text.enum.ts
- _bmad-output/implementation-artifacts/3-1-read-a-failure-like-a-report.md

Modified:
- src/api/crucible.ts
- src/index.ts
- src/core/config.ts
- src/core/config.test.ts
- src/core/reporter.util.ts
- src/core/reporter.util.test.ts
- src/core/runner.ts
- src/core/runner.test.ts
- src/core/verdict-error.ts
- src/core/test/report-harness.util.ts
- docs/runs-and-threshold.md
- _bmad-output/implementation-artifacts/sprint-status.yaml

### Change Log

- 2026-11-13: Story 3.1 implemented. Full FR-8 failure report (headline with pass rate, threshold, need and per-status counts; first failure per failed run with assertion position, claim, reasoning, bounded excerpt, thrown error; distinct [FAILED]/[ERRORED]/[DISCARDED] markers; 3-per-status bound with run-number ranges and a failing-claim tally; consistent smoke/multi/fatal/expiry headlines), configurable `excerptChars`, `CrucibleVerdictError.runStatuses`, docs.
