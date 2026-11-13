---
baseline_commit: 8ae930e
---

# Story 3.2: Turn up the volume when needed

Status: done

## Story

As a developer,
I want a verbosity ladder set in config and overridable per invocation,
so that I get terse CI output and deep local traces from the same suite.

## Acceptance Criteria

1. **Env wins over config.** With `"verbosity": "default"` in `crucible.config.json`, `CRUCIBLE_VERBOSE=debug` makes the effective verbosity `debug` (env > config > built-in `default`; an empty env value falls back to config). Resolved once, at config load (first execution), as `effectiveVerbosity`. [FR-9, AD-9]
2. **Validation.** An invalid `verbosity` in config fails at config load as `CrucibleError` kind `config`; an invalid `CRUCIBLE_VERBOSE` value fails at config load as kind `usage`, the message naming the valid levels (`default, full, debug`). Both surface as the first executing test's rejection — registration stays inert (never loads config). [Epic 3.2 AC, AD-9]
3. **`default` is unchanged.** At `default` the thrown `CrucibleVerdictError` message is exactly the Story 3.1 report (first failure per failed run, 3-per-status bound, tally) and nothing is written to stdout — before, during, or after the runs, pass or fail. [AD-10]
4. **`full` = all judge output per run.** At `full` the verdict/abort/expiry message renders every run in its own section — `[FAILED]`, `[ERRORED]`, `[PASSED]`, `[DISCARDED]` (in that status order, run-number order within a status; the fatal run first among errored) — with no 3-per-status bound, no `+ k more` line and no tally. Each section lists every judge record of that run in `seq` order: verdict records (assertion, verdict true/false, claim, judge reasoning, bounded response excerpt — passing verdicts included) and error records (attempts, cause). Failed sections keep the default-level first-failure fields. A passing test at `full` writes the same full report under a `PASSED:` headline to stdout once, at verdict time. Nothing is written mid-run. [FR-9, AD-10]
5. **`debug` = full + live trace.** At `debug` the report is the `full` report, and a trace is written to stdout as it happens: engine init + config resolution (once, on first trace event), test start (runs, threshold, deadline), per-run settle (status + cause), halt (fatal abort / deadline expiry), verdict tally, provider request (adapter, model, system-prompt length, bounded prompt, meta key names) and response (bounded) per attempt, retry attempts (classification, backoff delay, give-up), judge re-asks on unparseable replies, and each recorded verdict / judge error. Lines tagged `[crucible:debug]` and with `run #n` when inside a run. [Epic 3.2 AC, AD-10]
6. **Secrets never traced.** The trace is taken at the provider port (`CompletionRequest`/reply), so no HTTP headers — and therefore no API key — ever reach it; `meta` is traced as key names only (its values may hold secrets — see deferred-work 1.1 note). Logged payloads are bounded (prompt/reply cut at a fixed trace bound with the full length stated). [NFR1]
7. **Output channel.** All output goes through one core/report-owned writer boundary (stdout); no file writes at any level; no `console.*` anywhere in `src/`; `process.stdout` referenced only by the trace reporter's default writer. [AD-10, conventions]
8. **Docs.** `docs/runs-and-threshold.md` gains a "Verbosity" section: levels, precedence, validation, sample `full` section and `debug` trace, stdout/Jest note.
9. **Quality gates.** `npm run lint && npm run format:check && npm run typecheck && npm test && npm run build` green; `grep -rn 'console\.' src --include='*.ts'` empty.

## Tasks / Subtasks

- [x] Task 1: Verbosity module + config validation kinds (AC 1, 2)
  - [x] 1.1 Move `VERBOSITY_LEVELS`/`Verbosity` to `src/core/verbosity.ts` (shared by config, reporter, trace).
  - [x] 1.2 RED: invalid `CRUCIBLE_VERBOSE` → kind `usage` (was `config`); config invalid → `config` kept. GREEN.
- [x] Task 2: Shared text formatting (refactor under green) — extract `describe(cause)`, surrogate-safe cut, continuation indent from `Reporter` into `src/core/text-format.util.ts` (`TextFormat`).
- [x] Task 3: `full` report (AC 3, 4)
  - [x] 3.1 `ReportSettings.verbosity` (default `default`).
  - [x] 3.2 RED reporter tests: all failed runs in full beyond 3, no tally/`+ k more`, passed + discarded sections, passing verdict records, error records, seq order, default untouched. GREEN.
  - [x] 3.3 `renderPassed` (PASSED headline). RED/GREEN.
- [x] Task 4: `TraceReporter` sink (AC 4, 5, 6, 7)
  - [x] 4.1 `src/core/trace-reporter.ts`: injected settings supplier, `RunScope`, writer (default `process.stdout.write`). RED tests per event with a fake writer (`src/core/test/output-recorder.fake.ts`): silent at default/full; header once; run tags; bounds; meta keys only. GREEN.
  - [x] 4.2 `RunScope` carries the run number (`enterRun(body, signal, run)`, `runNumber()`).
- [x] Task 5: Wire events (AC 4, 5)
  - [x] 5.1 Runner: test start, run settle, halts, verdict, pass report at ≥ full. RED/GREEN.
  - [x] 5.2 RetryingCompleter: request/response/failure/backoff/give-up. RED/GREEN.
  - [x] 5.3 Judge: re-ask, verdict, judge error. RED/GREEN.
  - [x] 5.4 Composition root: one `TraceReporter` shared by runner/judge/completer; settings from `config.get()`.
- [x] Task 6: Docs (AC 8).
- [x] Task 7: Gates (AC 9).

## Dev Notes

### Current state

- `src/core/config.ts` already resolves `effectiveVerbosity` (env via `ConfigBoundary.readVerbosityOverride()` → config → `default`) since Story 1.1, but nothing consumes it, and an invalid env value is kind `config` (AC wants `usage`).
- `src/core/reporter.util.ts` (Story 3.1) renders default only; `ReportSettings = { excerptChars }` supplied lazily from `config.get()` by the composition root (`src/api/crucible.ts`).
- Runner/Judge/RetryingCompleter print nothing; `grep console. src` is empty.
- Config loads at the first `Runner.execute` (testDefaults supplier) — registration is inert; preserve.

### Design decisions (settled — user away)

- **Ladder is cumulative**: debug ⊇ full ⊇ default. Report rendering only distinguishes `default` vs not-`default`; the trace only speaks at `debug`.
- **Debug sink = `TraceReporter`** (core/report area, one class, `src/core/trace-reporter.ts`). Typed event methods (`testStarted`, `runSettled`, `testHalted…`, `verdictReached`, `providerRequest`, `providerResponse`, `providerFailure`, `judgeReplyRejected`, `judgeRecorded`, `passed`) — formatting stays in core/report (AD-10), callers pass raw data. Every method checks the level first → at default/full nothing is formatted or written (one memoized `config.get()` read per call).
- **Writer boundary**: `type OutputWriter = (text: string) => void`, default `process.stdout.write` (private static). Chosen over `console.log`: Jest intercepts and buffers `console.*`, decorates every call with a source-location block, and prints it only after the test finishes (useless for a hung test) and drops it under `--silent`; `process.stdout.write` is unbuffered by Jest and immediately visible. Cost: lines may interleave with Jest's interactive progress line in a TTY — documented.
- **Trace at the provider port, not inside the OpenRouter adapter**: provider-agnostic (works for user-registered adapters), no change to `src/providers/`, and no Authorization header can leak by construction. HTTP status appears via the failure cause (`OpenRouterHttpError`).
- **Engine init + config resolution** are emitted lazily as a header before the first debug event (config is only known at first execution); header shows provider name, model, meta key names, testDefaults, excerptChars, verbosity.
- **Run tags**: `RunScope` store carries the run number so judge/provider events inside a run are tagged `run #n` (essential with concurrent runs).
- **Payload bound**: prompt/reply traced up to a fixed 2000 chars + `…` and full length; the system prompt (constant schema) is traced by length only.
- **`full` response excerpt** keeps the `excerptChars` bound (user-configurable) — "all judge output" = every verdict/reasoning, not unbounded SUT text.
- **Pass report at ≥ full** is written by the trace reporter's writer at verdict time (once); this is the only stdout write outside `debug`.

### Testing rules (CLAUDE.md — reviewers enforce hard)

Fakes one per file `.fake.ts`; helpers in harness classes; enums for repeated literals; assert rendered output (the reporter/trace contract) and error kinds only; no call counters; no real `process.stdout`; no test-induced public API (3.1 review removed `runStatuses` for exactly this).

### Previous story intelligence

- 3.1 review: fatal run ordered first among errored; field lines right-trimmed; continuation indent rules; magic literals into enums.
- Deferred: ranges uncapped ("3.2 full is the escape hatch"), tally lumps judge errors/bare throws ("3.2 full is the escape hatch") — `full` resolves these by rendering every run.

### References

- [Source: _bmad-output/planning-artifacts/epics.md#Story 3.2]
- [Source: ARCHITECTURE-SPINE.md AD-9, AD-10, conventions table]
- [Source: _bmad-output/implementation-artifacts/3-1-read-a-failure-like-a-report.md#Review Triage Log]

## Dev Agent Record

### Agent Model Used

Claude Opus 5.5 (claude-opus-5-5), unattended (user away — decisions recorded below).

### Debug Log References

- RED confirmed per task: config (2 failing → kind `usage`), reporter full/pass (10 failing), trace reporter (compile-red: module absent), runner (5 failing), retry (3 failing), judge (2 failing). GREEN after each implementation step.
- Suite 300 → 344 tests / 15 suites. All gates green; `grep -rn 'console\.' src --include='*.ts'` empty; `process.stdout` appears only in `TraceReporter.stdout` (src/core/trace-reporter.ts).

### Completion Notes List

- Ultimate context engine analysis completed - comprehensive developer guide created.
- **Config (AC 1, 2):** `effectiveVerbosity` already existed (Story 1.1). Change: an invalid `CRUCIBLE_VERBOSE` is now kind `usage` (invalid config `verbosity` stays `config`); both messages list the valid levels. `VERBOSITY_LEVELS`/`Verbosity` moved to `src/core/verbosity.ts` (shared by config, report settings, trace). Surfaces at config load = first test execution (registration remains inert).
- **`full` report (AC 3, 4):** `ReportSettings` gains `verbosity`. At any non-default level `Reporter` renders every run, grouped `[FAILED]` → `[ERRORED]` (fatal first) → `[PASSED]` → `[DISCARDED]`, run-number order within each; no bound, no `+ k more`, no tally; every section ends with `Judge call k of n` blocks (verdict records incl. passing ones: assertion, verdict, claim, reasoning, bounded excerpt; error records: attempts + cause) in `seq` order, or `Judge calls: none recorded`. Failed sections keep the default first-failure fields. New `renderPassed` (`PASSED:` headline). Default rendering is byte-for-byte unchanged (all 3.1 tests untouched and green).
- **Debug sink (AC 5, 6, 7):** `TraceReporter` (src/core/trace-reporter.ts) owns all live output. Typed events; formatting stays inside it; each event first checks `verbosity === 'debug'` so default/full format and write nothing. Writer boundary `OutputWriter = (text) => void`, default `process.stdout.write` — chosen over `console.log` because Jest buffers console output until the test ends (useless for a hung test), decorates each call with a source-location block and `--silent` drops it. Engine init + config resolution are a lazy one-time header (config is only known at first execution); `RunScope` now carries the run number so in-run events are tagged `run #n`. One instance is shared by runner, judge and retrying completer via the composition root.
- **Traffic at the port, not the adapter:** request/response/retry are traced in `RetryingCompleter` around `adapter.complete` — provider-agnostic, `src/providers/` untouched, and HTTP headers (the API key) never reach the trace by construction. `meta` traced as key names only; system prompt by length only; prompt/reply cut at 2000 chars with full length stated.
- **Decision — passing test at ≥ full prints its full report** once at verdict time via the trace reporter's writer (the AC says `full` *prints* all judge output per run; a passing test has no error message to carry it). This is the only stdout write outside `debug`, never mid-run.
- **Decision — `full` keeps the `excerptChars` bound on responses** ("all judge output" = every verdict/reasoning; the response is SUT text and stays user-configurable).
- **Decision — no package version / test name in the trace header.** The runner does not know the Jest test name; adding it would change `Runner.execute`'s signature. Candidate follow-up if traces from many tests in one file prove hard to attribute.
- Refactor: `describe(cause)`, surrogate-safe cut and continuation indent extracted from `Reporter` into `TextFormat` (src/core/text-format.util.ts) so report and trace share them (under green reporter tests).
- Docs: `docs/runs-and-threshold.md` — new "Verbosity" section (levels table, precedence, validation kinds, sample `full` section and `debug` trace, what is never traced, stdout/Jest behaviour).

### File List

- `_bmad-output/implementation-artifacts/3-2-turn-up-the-volume-when-needed.md` (new)
- `_bmad-output/implementation-artifacts/sprint-status.yaml`
- `docs/runs-and-threshold.md`
- `src/api/crucible.ts`
- `src/core/config.ts`, `src/core/config.test.ts`
- `src/core/verbosity.ts` (new)
- `src/core/report-settings.ts`
- `src/core/reporter.util.ts`, `src/core/reporter.util.test.ts`
- `src/core/text-format.util.ts` (new)
- `src/core/trace-reporter.ts` (new), `src/core/trace-reporter.test.ts` (new)
- `src/core/runner.ts`, `src/core/runner.test.ts`
- `src/core/retry.ts`, `src/core/retry.test.ts`
- `src/core/judge.ts`, `src/core/judge.test.ts`
- `src/core/state.ts`
- `src/core/test/claim-text.enum.ts`, `src/core/test/report-text.enum.ts`
- `src/core/test/judge-harness.util.ts`, `src/core/test/report-harness.util.ts`, `src/core/test/retry-harness.util.ts`, `src/core/test/runner-harness.util.ts`
- `src/core/test/output-recorder.fake.ts` (new), `src/core/test/trace-harness.util.ts` (new), `src/core/test/trace-text.enum.ts` (new), `src/core/test/trace-bound.enum.ts` (new), `src/core/test/verbosity-level.enum.ts` (new)

### Change Log

- 2026-11-13: Story 3.2 implemented — verbosity ladder (`default`/`full`/`debug`), env-invalid = `usage`, full report, `TraceReporter` debug sink, docs. Status → review.

### Review Triage Log

Code review 2026-11-13 (bmad-code-review, unattended: Blind Hunter + Edge Case Hunter + Acceptance Auditor + manual security hunt). Diff: `story-3-1-read-a-failure-like-a-report...HEAD`.

**Security verdict: no key leak path.** The trace is taken at the provider port (`CompletionRequest`/reply) in `RetryingCompleter`; headers are built inside `OpenRouterAdapter.complete` and never leave it. `OpenRouterHttpError` / `OpenRouterEnvelopeError` messages carry only the HTTP status / a fixed sentence; `TextFormat.describe` prints `name: message` of the top-level error only (no cause chain, no request config). `meta` is traced as key names only (header + request lines; test asserts the secret value is absent). Config rejects key-like fields. Residual: a custom adapter that embeds a secret in its own error message would surface it (same as the 3.1 failure report) — documented.

**Fixed (test-first where behavioural):**
- [high] Valid `CRUCIBLE_VERBOSE` masked an invalid config `verbosity` (AC 2 / AD-9: config validated at load). Config value is now always validated; env still wins. RED test `an invalid configured verbosity fails even when a valid override is set` → kind `config`.
- [medium] A throwing output stream (e.g. EPIPE) propagated out of trace calls — inside `RetryingCompleter`'s try it would reclassify a good reply as a provider failure; inside the runner's settle callback it would hang the batch; at `full` it would fail a passing test. `TraceReporter` now delivers through a guarded `deliver`. RED test with `BrokenWriter` fake.
- [low] Multi-line causes/claims in a trace headline produced untagged lines. Headline continuation lines are now indented under the tagged line. RED test.
- [low] Design smell: positional `undefined` placeholders in the composition root. `trace` now precedes the clock boundary (`timer`/`deadline`/`sleep`) in `Runner`, `Judge`, `RetryingCompleter`; root wiring is `new RetryingCompleter(this.trace)` etc. Harnesses updated.
- [low] Abort label "the run was aborted" was wrong for a judge-call timeout → neutral "the call was aborted" (distinction deferred).
- [low] Docs: debug sample char counts (reasoning 26, reply 57) and missing `provider request attempt 2` line; API-key claim scoped to adapter error messages; `full`/`debug` PASSED report also bypasses Jest capture; config validated even with env set.
- [low] Tests: expiry trace assertion was satisfied by "test started … deadline" → asserts `deadline of`; loose `'pass'`/`'false'` → `verdict pass` / `judge verdict false`; system-prompt test now asserts the length line and uses its own constant; new reply-bound test; new `full` expiry and judge-error-attempts tests; repeated literals (`'fake'`, `'not json at all'`, `'flake'`, in-flight fragment, `'judge schema text'`) moved to enums / harness static; `claimedRuns` no longer gives passed runs a cause.

**Rejected:**
- Passing test printing at `full` = AD-10 noise — rejected: AC 4 / epic "full prints all judge output per run"; a passing test has no error message to carry it; written once at verdict time, never mid-run. Upheld.
- Full report repeats the failing verdict under first-failure fields and judge calls — by spec (AC 4 "Failed sections keep the default-level first-failure fields").
- Full report not in run-number order — by spec (status grouping, run order within).
- `TraceSettings.excerptChars` only for header — rejected: it is part of the resolved config the AC 5 header must show.
- Quiet-default `TraceReporter` with placeholder settings — rejected: same default-collaborator pattern as `Reporter`; placeholders are never rendered (header only emits at `debug`).
- `failure()` bypassed in config — `failure()` is just `new CrucibleError('config', …)`; identical.
- Settings rebuilt per event — `config.get()` is memoized; negligible.
- Header once per instance — one shared instance per module load (per Jest file), as documented.
- `reportPassed` lines unprefixed at debug — it is the report, not trace.
- Non-infra `CrucibleError` traced "fatal, not retried" — accurate.
- `runSettled` tag from outer scope — `execute` never runs inside a run scope.
- `[PASSED]`/`[DISCARDED]` inline section labels — matches existing `[FAILED]`/`[ERRORED]` style in `Reporter`.

**Deferred** (→ deferred-work.md): abort during backoff untraced; post-halt trace lines from discarded runs; unbounded causes in trace headlines; judge-timeout vs run-abort label; `CRUCIBLE_VERBOSE` case/whitespace.

Gates: lint, format:check, typecheck, test (350/350, 15 suites), build green; `grep -rn 'console\.' src --include='*.ts'` empty; `process.stdout` only in `TraceReporter.stdout`.
