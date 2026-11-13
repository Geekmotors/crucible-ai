---
baseline_commit: d4b09db286e67030b22a2df14e514175b3fd1042
---

# Story 4.1: Tune timeouts per test

Status: done

## Story

As a developer whose test bodies call my own model and then `coherent()` several times,
I want to raise or lower crucible's time budgets per test and per project,
so that slow but healthy runs aren't cut off at 30 s and reported ERRORED.

Jack's decision (2026-11-13): keep 30 s as the default and allow overrides the way Jest does, through a trailing number or through named options.

## Acceptance Criteria

1. **Trailing number (Jest semantics).** `crucible.it(name, body, ms)` and `crucible.it(name, { runs, threshold }, body, ms)`: the trailing number is the test timeout in ms — the runner deadline for the whole multi-run test — and the Jest ceiling registered is that deadline plus the existing 5000 ms margin.
2. **Named options.** `crucible.it(name, { inferenceTimeout, testTimeout }, body)`: each `coherent()` judge call aborts after `inferenceTimeout` ms (retryable `infra` error, as today) and the whole test expires after `testTimeout` ms (ERRORED expiry report, as today).
3. **Project defaults.** `testDefaults: { inferenceTimeout, testTimeout }` in `crucible.config.json` apply when a test does not declare them; per-field precedence declared > testDefaults > built-in.
4. **Unchanged defaults.** With no overrides: inference 30000 ms, test `30000 + (runs − 1) × 1000` ms (capped at the timer maximum).
5. **Validation, never clamp.** A timeout that is not a positive integer, or exceeds 2147483647, is a `usage` error at declaration (trailing number or option) or a `config` error in `testDefaults`. A trailing number together with `opts.testTimeout` is a `usage` error.
6. **Docs.** `docs/configuration.md`, `docs/api.md`, `docs/gotchas.md`, `docs/runs-and-threshold.md` (and README if it shows the signature) document both knobs and note that `testTimeout` caps everything — an `inferenceTimeout` above it is effectively bounded by it. Doc TS examples type-check against `dist`.

## Tasks / Subtasks

- [x] Task 1: Shared time budget module (AC 4)
  - [x] `src/core/time-budget.util.ts` — `TimeBudget` class: built-in inference ms (30000), timer max (2147483647), `testTimeoutFor(runs)` = min(max, 30000 + (runs−1)×1000). Replaces `JUDGE_CALL_TIMEOUT_MS` and Runner's private constants (one source of truth; `Runner.timeoutFor` delegates).
- [x] Task 2: Options + validation (AC 2, 3, 5)
  - [x] `RunOptions` gains `inferenceTimeout?`, `testTimeout?`; `ResolvedRunOptions` gains both (required).
  - [x] `RunOptionsValidator`: known keys + positive-integer ≤ timer-max rule for both. Same validator serves declaration (`usage`) and config `testDefaults` (`config`).
  - [x] `RunOptionsResolver.resolve`: per-field precedence; built-in test timeout from resolved `runs`.
- [x] Task 3: Inference timeout reaches the judge (AC 2, 3)
  - [x] `RunScope.enterRun(body, signal, run, inferenceTimeout = built-in)`; `scope.inferenceTimeout()`.
  - [x] `Judge` arms its per-call deadline with `scope.inferenceTimeout()`; error names the actual ms.
  - [x] `Runner` passes `options.inferenceTimeout` into each run scope and uses `options.testTimeout` as the deadline.
- [x] Task 4: Trailing number + Jest ceiling (AC 1, 5)
  - [x] `JestBinding.register(name, optsOrBody, bodyOrTimeout?, timeout?)`: normalize both forms; trailing number merges into `testTimeout`; conflict with `opts.testTimeout` → `usage`; validated like any option.
  - [x] `Runner.ceilingFor(declared)`: `testTimeout + 5000` (capped) when `testTimeout` is declared; otherwise timer max (see Dev Notes — declared runs alone no longer fix the effective timeout because `testDefaults.testTimeout` may override it).
  - [x] `src/api/crucible.ts`: `crucible.it` accepts the trailing number.
- [x] Task 5: Docs (AC 6)
- [x] Task 6: Full gate + docs example type-check

### Review Findings

- [x] [Review][Patch] The binding had no tests for wrong-type trailing values (numeric string, NaN, Infinity, null) or for `(name, body, undefined, n)`. Added tests asserting `usage` with nothing registered. [src/bindings/jest.test.ts]
- [x] [Review][Patch] The runner deadline from a trailing number was tested only in the body-first form. It is now tested in both forms. [src/bindings/jest.test.ts]
- [x] [Review][Patch] The built-in test-timeout base reused `INFERENCE_MS`, so changing the judge default would have silently moved every test deadline. It now has its own `TEST_BASE_MS`. [src/core/time-budget.util.ts]
- [x] [Review][Patch] `runBatch`/`collect` received `deadlineMs` alongside `options.testTimeout`, the same value twice. The duplicate parameter is dropped. [src/core/runner.ts]
- [x] [Review][Patch] Docs: the run-status table still said "30 s deadline"; it now names the inference timeout. [docs/runs-and-threshold.md]
- [x] [Review][Patch] Docs: "only the trailing argument changes the budgets" was wrong. The options and `testDefaults` change them too. [docs/runs-and-threshold.md]
- [x] [Review][Patch] Docs: the timer-maximum cap on the built-in test timeout and on the Jest ceiling was undocumented (AC 4). Added to api.md, runs-and-threshold.md and gotchas.md. [docs/*.md]
- [x] [Review][Patch] Docs: did not say that `testDefaults.testTimeout` is a fixed budget that does not grow with `runs`. Added a note. [docs/runs-and-threshold.md]
- [x] [Review][Patch] Docs: "both options" wording dated from when there were two fields; reworded. Removed "Since Story 4.1" from user-facing docs. [docs/runs-and-threshold.md, docs/configuration.md, docs/judge-models.md]
- [x] [Review][Defer] A `testTimeout` within 5 s of 2147483647 squeezes the Jest ceiling margin to 0, so Jest and the runner race. [src/core/runner.ts ceilingFor] — deferred, exotic values
- [x] [Review][Defer] The inference deadline applies per reply attempt, so one `coherent()` call with a re-ask can take up to 2× `inferenceTimeout`. The AC 2 wording is broader than the code; the docs say "attempt" correctly. [src/core/judge.ts] — deferred, behaviour unchanged from before
- [x] [Review][Defer] The public `crucible.it` forwards only four arguments, so a fifth in the options form is silently dropped (JS callers only). Overloads would reject it at compile time (extends the 3.6 overload item). [src/api/crucible.ts] — deferred
- [x] [Review][Defer] Misleading usage messages: `(name, body, undefined, n)` says "argument after the timeout", and `(name, opts, body, fn)` blames `testTimeout`. The error kind is correct. [src/bindings/jest.ts] — deferred, message only
- [x] [Review][Defer] The debug trace does not show the resolved `inferenceTimeout`. [src/core/trace-reporter.ts] — deferred
- [x] [Review][Defer] Test hygiene: tests compute expected deadlines with `TimeBudget.testTimeoutFor` from `src` (pre-existing `timeoutFor` pattern), and harness helpers repeat the `'the response'`/`'the claim'` literals (pre-existing pattern). [src/core/runner.test.ts, src/core/test/*-harness.util.ts] — deferred, pre-existing
- [x] [Review][Defer] `RunScope.enterRun` keeps adding optional positional parameters (and its own inference default); consider an options object. [src/core/state.ts] — deferred

## Dev Notes

### Current state (read before touching)

- `src/core/runner.ts` — `timeoutFor(runs)` = min(TIMER_MAX, 30000 + (runs−1)×1000) using `RUN_BUDGET_MS = JUDGE_CALL_TIMEOUT_MS`; `ceilingFor(declared)` = timeoutFor+5000 when `runs` declared else TIMER_MAX; `execute` resolves options against lazily supplied `testDefaults()`, arms the injected `DeadlineTimer` (`ManualTimer` fake in tests), on expiry aborts the shared controller and renders `renderExpired`.
- `src/core/judge.ts` — `JUDGE_CALL_TIMEOUT_MS = 30000`; injected `Deadline = (ms) => AbortSignal` (default `AbortSignal.timeout`; fake `ExpiredDeadline`). Deadline abort while run signal is live → `CrucibleError('infra', …, {retryable:true})`.
- `src/core/state.ts` — `RunScope` AsyncLocalStorage store `{context, signal, run, seq}`; `abortSignal()` reads it. Inference timeout rides the same store.
- `src/core/run-options-validator.util.ts` — returns a violation string; resolver wraps as `usage`, `ConfigStore.requireTestDefaults` wraps as `config`. Adding keys/rules here covers both.
- `src/bindings/jest.ts` — `register(name, optsOrBody, maybeBody?)`; registration is inert (never reads config — AD-9, tested).
- `src/api/crucible.ts` — public `crucible.it`; `RunOptions` exported via `src/index.ts`.

### Must preserve

- Registration never loads config (test "registration never reads the project defaults").
- Expiry/abort/fatal semantics and reports unchanged; only the numbers become tunable.
- Built-in numbers unchanged (AC 4).

### Ceiling decision

Config is lazy (loaded at first `execute`), so at declaration the effective test timeout is known only when `testTimeout` is declared (trailing number or option). Keeping the old `runs`-declared ceiling would let Jest kill a test before a larger `testDefaults.testTimeout` fires. So: declared `testTimeout` → `testTimeout + 5000`; otherwise timer max. Document the fake-timers consequence in gotchas.

### Testing standards (CLAUDE.md)

Tests beside code; fakes one per file `src/core/test/*.fake.ts`; enums `*.enum.ts`; helpers in harness classes; assert outcomes (rejection kind/outcome, resolution) not interactions; no real timers — drive deadlines with `ManualTimer` (+ a deadline fake built on it).

### References

- [Source: _bmad-output/planning-artifacts/epics.md#Story 4.1]
- [Source: _bmad-output/implementation-artifacts/deferred-work.md — 3.3 e2e deadline item]
- [Source: docs/runs-and-threshold.md#timeout, docs/gotchas.md]
- Docs examples check method: [Source: 3-6-learn-it-from-the-docs-alone.md — Debug Log, "Example type-check (AC 8)"] (scratch harness, not committed).

## Dev Agent Record

### Agent Model Used

Claude Opus 5.5 (claude-opus-5-5)

### Debug Log References

- Red runs: resolver/config (8 failing), judge/runner timeout tests (8 failing), binding timeout tests (7 failing) — each before the matching `src/` change.
- Full gate: `npm run lint && npm run format:check && npm run typecheck && npm test && npm run build` green — 16 suites, 405 tests. Also `npx tsc --noEmit -p e2e` and `npm run verify:pack` green.
- Docs examples type-check (method from Story 3.6, scratch harness, not committed): every ```` ```ts ```` block in `README.md` + `docs/*.md` extracted to its own module, `crucible-ai` → freshly built `dist/index.d.ts`, placeholders (`sut`, `createAssistant`, …) declared ambient. 14 blocks, `tsc` exit 0. Negative control (`testTimout` typo, string trailing timeout) → 2 errors. Signature-reference blocks (runs-and-threshold signature, api.md signature lines) checked by hand against `dist/index.d.ts`.

### Completion Notes List

- Ultimate context engine analysis completed - comprehensive developer guide created
- `TimeBudget` (`time-budget.util.ts`) is the single source for the built-in 30000 ms inference budget, the timer maximum, the built-in test-timeout formula and the timeout validity rule. `JUDGE_CALL_TIMEOUT_MS` and `Runner.timeoutFor` removed (`timeoutFor` had become test-only; its tests moved to `time-budget.util.test.ts`).
- `RunOptions` gains `inferenceTimeout`/`testTimeout`; `ResolvedRunOptions` = `RunGate` (`runs`, `threshold`) + both timeouts. Aggregator, reporter, run results and trace take the narrower `RunGate` — they only judge the gate.
- `RunOptionsValidator` validates both timeouts (integer 1..2147483647, never clamped); the same rule yields `usage` at declaration and `config` in `testDefaults`. Resolver: per-field declared > testDefaults > built-in; built-in test timeout from the resolved run count.
- Inference timeout flows to the judge through `RunScope` (new `enterRun` 4th param, `inferenceTimeout()`), like the abort signal. Judge error names the actual ms. Runner uses `options.testTimeout` as the deadline.
- `JestBinding.register(name, optsOrBody, bodyOrTimeout?, timeout?)` — both Jest forms; trailing number merges into `testTimeout`; trailing number + `testTimeout`, an invalid trailing number, or a surplus argument → `usage`, nothing registered. Public `crucible.it` signature extended (still one permissive signature).
- **Judgment call — Jest ceiling:** `ceilingFor` = declared `testTimeout` + 5000 (capped) when a test timeout is declared, otherwise the timer maximum. Previously declared `runs` alone produced `timeoutFor(runs)+5000`; that would now let Jest kill a test before a larger `testDefaults.testTimeout`, and config is loaded lazily (registration must stay inert), so declared `runs` without a declared test timeout now gets the timer-max backstop. Consequence (documented in gotchas): under fake timers, only tests with a declared test timeout get the Jest backstop.
- No relation enforced between `inferenceTimeout` and `testTimeout`; docs state `testTimeout` caps everything.
- New test doubles: `TimedDeadline` (deadline fake on `ManualTimer`), `DelayedReplyAdapter` (replies after N ms of manual time); enums `CustomTimeout`, `InvalidTimeout`; `TimeoutBudget` enum gains `PerExtraRunMs`, `CeilingMarginMs`.
- Docs: runs-and-threshold (signature, options table, validation, testDefaults precedence, rewritten Timeout section with examples), api.md, configuration.md, gotchas.md (deadline + fake-timers), judge-models.md (pointer to the new knobs). README shows no signature; unchanged.

### File List

- `src/core/time-budget.util.ts` (new)
- `src/core/time-budget.util.test.ts` (new)
- `src/core/run-options.ts`
- `src/core/run-options-validator.util.ts`
- `src/core/run-options-resolver.util.ts`
- `src/core/run-options-resolver.util.test.ts`
- `src/core/config.test.ts`
- `src/core/state.ts`
- `src/core/judge.ts`
- `src/core/judge.test.ts`
- `src/core/runner.ts`
- `src/core/runner.test.ts`
- `src/core/aggregator.util.ts`
- `src/core/reporter.util.ts`
- `src/core/run-result.ts`
- `src/core/trace-reporter.ts`
- `src/core/test/custom-timeout.enum.ts` (new)
- `src/core/test/invalid-timeout.enum.ts` (new)
- `src/core/test/timeout-budget.enum.ts`
- `src/core/test/timed-deadline.fake.ts` (new)
- `src/core/test/delayed-reply-adapter.fake.ts` (new)
- `src/core/test/judge-harness.util.ts`
- `src/core/test/runner-harness.util.ts`
- `src/core/test/report-harness.util.ts`
- `src/bindings/jest.ts`
- `src/bindings/jest.test.ts`
- `src/bindings/test/jest-harness.util.ts`
- `src/api/crucible.ts`
- `docs/runs-and-threshold.md`
- `docs/api.md`
- `docs/configuration.md`
- `docs/gotchas.md`
- `docs/judge-models.md`
- `_bmad-output/implementation-artifacts/4-1-tune-timeouts-per-test.md` (new)
- `_bmad-output/implementation-artifacts/sprint-status.yaml`
- `_bmad-output/implementation-artifacts/deferred-work.md`
- `_bmad-output/planning-artifacts/epics.md`

## Change Log

- 2026-11-13: Story 4.1 — per-test and project-wide `inferenceTimeout`/`testTimeout`, Jest-style trailing timeout, validation (usage/config, never clamp), Jest ceiling from declared test timeout; docs updated. Status → review.
- 2026-11-13: Code review: 9 patches applied (tests, TimeBudget base constant, Runner deadline threading, doc accuracy), 7 deferred. Gate green, 411 tests. Status → done.
