---
baseline_commit: 5765f193403d46127904989006da349632eac6d0
---

# Story 2.1: Repeat and gate on pass rate

Status: review

## Story

As a developer,
I want `crucible.it(name, { runs, threshold }, body)` to execute the body N times in parallel and gate on the pass rate,
so that I measure reliability, not single-shot luck.

## Acceptance Criteria

1. **One test, N concurrent runs.** Given `{ runs: 20, threshold: 0.95 }`, when the suite runs, then exactly one Jest test registers, and when it executes the body runs 20 times concurrently (`Promise.all`), each run inside its own `state.enterRun` scope. Records from one run are never visible in another run. [FR1, FR2, AD-3, AD-5]
2. **Three-zone verdict.** With `need = ⌈threshold × runs − 1e-9⌉`:
   - `passed ≥ need` → the test resolves (green) and nothing is thrown.
   - `passed + errored < need` → the test throws `CrucibleVerdictError` with `outcome: 'failed'`.
   - Otherwise → it throws `CrucibleVerdictError` with `outcome: 'errored'` (errored, not failed), naming each errored run's infrastructure cause. [AD-4, AR4]
3. **Integer-safe `need`.** `{runs: 20, threshold: 0.35}` needs exactly **7**, not 8: 7 passed → pass, 6 passed → not pass. `{runs: 20, threshold: 0.95}` needs 19. `{runs: 1, threshold: 1}` needs 1. The pass rate is never compared as a float ratio. [FR1, AD-4]
4. **Run-status classification** (per run, unchanged from Story 1.5):
   - The body resolves → `passed`.
   - A rejection whose cause chain contains `CrucibleError` kind `infra` → `errored`.
   - Any other rejection → `failed`. [AD-4]
5. **Declaration validation.** These options are rejected with `CrucibleError` kind `usage` at declaration (registration), before any execution:
   - `threshold` of `0`, `> 1`, negative, `NaN`, or non-number.
   - `runs` that is not an integer `≥ 1` (`0`, `-1`, `2.5`, `NaN`, non-number).
   - Unknown option keys are still rejected (existing behaviour).
6. **Per-test timeout from the runner.** The framework per-test timeout is set from the run count and the provider budget, and is computed by core, never hard-coded in the binding. `runs: 1` keeps today's 30 000 ms smoke budget, and the timeout never decreases as `runs` grows. [AR3, AD-3]
7. **Parallel wall-clock.** Wall-clock for 20 runs ≈ the slowest run plus overhead, not the sum of all runs. This is proven structurally by a concurrency test in which all N bodies are in flight at once. No clocks or timers are used. [FR2]
8. **Smoke mode unchanged.** Omitting options (or passing `{}`) still runs the body once with `threshold 1.0`. A failing or erroring smoke run still surfaces as `CrucibleVerdictError` with the same `outcome` and the original rejection as `cause`. `config`/`usage` errors and already-wrapped `CrucibleVerdictError`s are still rethrown untouched. [FR1, Story 1.5 behaviour]
9. **Report rendered by core/report only.** On a fail or errored verdict, the message is rendered by `Reporter` exclusively from run records collected at verdict time. It shows the pass rate against the threshold (`passed/runs`, need, threshold), then one section per non-passed run that reuses the existing per-run failed/errored rendering. No `console.*` anywhere in `src/`. [AD-10, AD-13, AR12]
10. **Full suite stays green.** `npm run lint && npm run format:check && npm run typecheck && npm test && npm run build` all pass with zero network and zero real timers in unit tests.

## Tasks / Subtasks

TDD for every task: write a failing test, make it pass, refactor. Each new `src/` behaviour is preceded by a red test.

- [x] **Task 1 — Shared run-options types and validation in core** (AC: 5, 8)
  - [x] 1.1 Create `src/core/run-options.ts` with types only: `RunOptions { readonly runs?: number; readonly threshold?: number }` and `ResolvedRunOptions { readonly runs: number; readonly threshold: number }`. Moving `RunOptions` out of `bindings/jest.ts` keeps AD-2 intact: core must never import a binding.
  - [x] 1.2 Create `src/core/run-options-resolver.util.ts` with class `RunOptionsResolver`:
    - `validate(opts: RunOptions): void` throws `usage` for an invalid `runs` or `threshold` and for unknown keys.
    - `resolve(opts: RunOptions): ResolvedRunOptions` applies the built-ins `runs: 1` and `threshold: 1.0`, per field.
    - Keep built-ins as `private static` members, not loose module constants.
  - [x] 1.3 Create `src/core/run-options-resolver.util.test.ts`. Cover the valid and invalid tables from AC 5, plus per-field defaulting (`{runs: 5}` → threshold 1.0; `{threshold: 0.9}` → runs 1; `{}` → 1/1.0). Assert the error **kind** only, never message text.
- [x] **Task 2 — Three-zone aggregator (AD-4)** (AC: 2, 3)
  - [x] 2.1 Create `src/core/aggregator.util.ts` with class `Aggregator`, a pure function of run statuses plus options:
    - `zone(statuses: RunStatus[], opts: ResolvedRunOptions)` returns `'pass' | 'fail' | 'errored'`.
    - Also expose `need` / `passed` / `errored` counts, because the reporter needs them for the headline.
    - Compute `need = Math.ceil(threshold * runs - 1e-9)` as a named private static epsilon.
  - [x] 2.2 Put `RunStatus = 'passed' | 'failed' | 'errored'` in the shared types module (or `run-options.ts`, if that stays cohesive). Do **not** add `'discarded'`: that status arrives in Story 2.3, and stubs are forbidden.
  - [x] 2.3 Create `src/core/aggregator.util.test.ts` with a table of zone outcomes:
    - 20/0.35: 7 passed → pass, 6 → fail.
    - 20/0.95: 19 → pass, 18 passed + 1 errored → errored, 18 passed + 2 failed → fail.
    - 1/1.0: passed → pass, failed → fail, errored → errored.
    - 3/0.5: 1 passed + 1 errored + 1 failed → errored (need 2: passed < 2 ≤ passed + errored).
    - Test through outcomes only.
- [x] **Task 3 — Multi-run runner** (AC: 1, 2, 4, 7, 8)
  - [x] 3.1 Change `Runner.execute(body, opts: RunOptions = {})` to return `Promise<void>`. It must resolve the options, then start every run concurrently. Each run is `scope.enterRun(...)`, which awaits the body, classifies the outcome **inside** the scope (records are only reachable there), and returns a run result: `{ status, cause?, context }`. `Promise.all` must receive promises that never reject.
  - [x] 3.2 After all runs settle, check in this order:
    1. If any run rejected with a `CrucibleVerdictError` or a non-infra `CrucibleError` (`config`/`usage`), rethrow the first such rejection by run index untouched. This keeps Story 1.5's fail-fast rule for misconfiguration. Sibling abort is Story 2.3, so siblings simply finish.
    2. Otherwise, aggregate. On `pass`, resolve.
    3. On `fail` or `errored`, throw `CrucibleVerdictError(outcome, reporter.renderVerdict(...), cause)`. `cause` is the rejection of the lowest-index run whose status matches the outcome: the first failed run for `'failed'`, the first errored run for `'errored'`. With `runs: 1`, this keeps `cause === the body's rejection`, as the existing tests require.
  - [x] 3.3 Keep `firstCrucibleInChain` cause-chain walking for classification.
  - [x] 3.4 Add `timeoutFor(runs: number): number` on `Runner` (AC 6, see Dev Notes "Timeout policy"). The binding calls it at registration, so the runner owns the budget per AD-3 while registration stays inert.
  - [x] 3.5 Update `src/core/runner.test.ts`. Rewrite "resolves with the body value" as "resolves when the run passes", because `execute` no longer returns the body value. Add:
    - Concurrency: all N bodies are in flight at once (see Dev Notes "Concurrency test").
    - Per-run isolation: each concurrently running body sees only its own records.
    - 7-of-20 at 0.35 passes; 6-of-20 fails with `outcome: 'failed'`.
    - Mixed infra errors that make the result inconclusive → `outcome: 'errored'`.
    - `cause` = the first matching run's rejection.
    - A `usage` error in one of several runs is rethrown untouched.
    - `timeoutFor(1) === 30000`, and `timeoutFor` is non-decreasing (e.g. `timeoutFor(20) >= timeoutFor(1)`).
    - Keep all existing smoke tests passing unchanged in intent.
- [x] **Task 4 — Aggregate report** (AC: 2, 9)
  - [x] 4.1 Add `renderVerdict(summary)` to `Reporter`. Its input is the per-run results (status, cause, context), the counts, and the resolved options. Output:
    - A headline with passed/runs, need, and threshold, plus the zone (failed vs *errored, not failed*).
    - Then, for each non-passed run in run-index order, a `Run #i` section whose body is the existing `renderFailed(context, cause)` or `renderErrored(context, cause)`.
    - Reuse the existing methods; do not duplicate their logic.
  - [x] 4.2 Extend `src/core/reporter.util.test.ts` and `src/core/test/report-harness.util.ts`:
    - The headline contains the passed count, run count, need, and threshold.
    - The errored zone names every errored run's infra cause.
    - A failed run's claim and reasoning appear in its section.
    - Passed runs contribute no section.
    - These tests check rendered content, which is the formatter's contract, the same way the 1.5 reporter tests do.
- [x] **Task 5 — Binding: accept and validate gating options** (AC: 1, 5, 6)
  - [x] 5.1 In `src/bindings/jest.ts`:
    - Delete `rejectUnsupportedOptions`, `GATING_OPTION_KEYS`, and `SMOKE_TEST_TIMEOUT_MS`.
    - `register` calls `RunOptionsResolver.validate(opts)` at registration, then registers ONE test with timeout `runner.timeoutFor(runs to resolve)` and callback `runner.execute(body, opts)`.
    - Keep the binding free of result inspection and formatting (AD-3).
  - [x] 5.2 Pass the **raw** options to `execute`, which resolves defaults at execution time. Story 2.5 needs this seam (AD-9: resolution happens at execution, not registration).
  - [x] 5.3 Re-export `RunOptions` from core in the binding, or have `src/api/crucible.ts` import the type from `core/run-options.ts`. The public type name `RunOptions` must be unchanged.
  - [x] 5.4 Update `src/bindings/jest.test.ts`:
    - Replace the `it.each(['runs','threshold'])` "rejects until 2.1" test with "registers once and executes `runs` times when invoked" and "invalid threshold/runs → usage at registration with no registration made".
    - Keep the unknown-key, non-function body, and double-body tests.
    - Update the registration test to assert the timeout equals the runner's budget for the declared runs (30 000 for smoke).
- [x] **Task 6 — Composition root and surface** (AC: 8)
  - [x] 6.1 `src/api/crucible.ts`: the `crucible.it(name, optsOrBody, maybeBody)` signature is unchanged. The `load` usage throw stays as-is (Story 2.2). Keep import side-effect-free (inert).
  - [x] 6.2 Run the full verification commands (AC 10) and grep `src/` for `console.` (no hits).

## Dev Notes

### Current state of files this story touches (read before editing)

- **`src/core/runner.ts`** — `Runner(scope = runScope, reporter = new Reporter())`. `execute<T>(body)` runs ONE `scope.enterRun`, catches a rejection inside the scope, and converts it to a `CrucibleVerdictError` through `verdictError(cause)`, which works like this:
  - It rethrows an already-wrapped `CrucibleVerdictError` untouched.
  - It walks the cause chain. A non-infra `CrucibleError` (`config`/`usage`) is rethrown untouched.
  - A chain containing an infra error becomes `outcome: 'errored'`, rendered by `reporter.renderErrored(context, cause)`.
  - Anything else becomes `'failed'`, rendered by `renderFailed`.
  - **Preserve all of this per run.** What changes: N runs, collect-then-aggregate, the void return, and `timeoutFor`.
- **`src/bindings/jest.ts`** — `JestBinding(runner, registrar = lazy global it)`:
  - `register` normalizes `(name, optsOrBody, maybeBody)` and rejects ANY key in opts (`runs`/`threshold` with a "Story 2.1" usage error; others as unknown).
  - It registers with the hard-coded `SMOKE_TEST_TIMEOUT_MS = 30000`.
  - **Preserve:** the lazy-global-`it` check with its usage error, the two-bodies error, the non-function-body error, the unknown-key rejection, and the inert registration.
  - It currently exports `RunOptions`/`TestBody`/`Registrar` types; `src/api/crucible.ts` imports `RunOptions`/`TestBody` from here.
- **`src/core/reporter.util.ts`** — `Reporter.renderFailed(context, cause)` and `renderErrored(context, cause)`:
  - Both pick the first failure by lowest `seq` across false verdicts and error records (AD-13).
  - The response excerpt is capped at 500 chars, surrogate-safe, with a `…` marker.
  - `describe(cause)` handles non-`Error` causes.
  - **Preserve both methods unchanged**; compose them in the new aggregate render.
- **`src/core/state.ts`** — `RunScope` owns the single ALS. `enterRun` creates a fresh `{state: [], verdicts: [], errors: []}` and seq counter **per call**, which is exactly the per-run isolation AC 1 needs. No changes expected. `context()` throws `usage` outside a scope, so the runner must capture `context()` **inside** each run's scope before it exits.
- **`src/core/judge.ts`** — `JUDGE_CALL_TIMEOUT_MS = 30000` is exported, and `MAX_REPLY_ATTEMPTS = 2` (one re-ask on an unparseable reply). The retrier makes ≤3 attempts per completion inside a single 30 s abort signal. No changes in this story.
- **`src/core/verdict-error.ts`** — `CrucibleVerdictError(outcome: 'failed'|'errored', message, cause)`. No change: `discarded` is Story 2.3 and does not belong in `outcome`.
- **`src/api/crucible.ts`** — The lazy `CompositionRoot` wires `new Runner(runScope, new Reporter())`. The `Aggregator`/`RunOptionsResolver` are pure, so construct them as defaults inside `Runner` (real collaborators, no injection needed). The composition root may stay untouched apart from type imports.

### Timeout policy (AC 6) — decision taken, flag in review if you disagree

Jest needs the timeout **at registration**, and config is not loaded then (AD-9 inertness), so the budget must be a pure function of the declared `runs`:

```
timeoutFor(runs) = RUN_BUDGET_MS + (runs - 1) × PER_EXTRA_RUN_MS
RUN_BUDGET_MS    = JUDGE_CALL_TIMEOUT_MS (30000)
PER_EXTRA_RUN_MS = 1000
```

- `runs: 1` → 30 000 ms, so smoke behaviour and the existing test are preserved.
- `runs: 20` → 49 000 ms.
- Runs are concurrent, so the budget grows sub-linearly. The per-extra-run slack absorbs 429 backoff under rate limiting (AD-8 retry, OQ-3).
- Keep the constants as private statics on `Runner`.
- Import `JUDGE_CALL_TIMEOUT_MS` from `core/judge.ts`; that is a core→core import, allowed.
- **Forward risk (Story 2.5):** when `testDefaults` supplies `runs` from config, registration only sees the declared options. A test that omits `runs` therefore gets the 1-run budget while executing 20 runs. Leave the seam clean (`timeoutFor` takes a number), and record a note in Completion Notes for 2.5 to resolve.

### Concurrency test (AC 1, 7) — no clocks, no timers

Use a gate in a test util class (e.g. `src/core/test/start-gate.util.ts`, class `StartGate`):
- Each body calls `await gate.arrive()`.
- `arrive()` increments the count and returns a shared promise that resolves only when the count reaches N.
- A serial runner would park run 1 forever, so the test fails by Jest timeout. A concurrent runner passes immediately.

This proves "wall-clock ≈ slowest run, not sum" structurally. Do NOT use `Date.now`, fake timers, or `setTimeout`.

For per-run isolation, inside the gated bodies:
1. Each run records one verdict through the scope.
2. After the gate opens, each run asserts that `scope.context().verdicts` contains only its own record.
3. Have the body throw on violation, so isolation failure → failed runs → the test sees a rejection.

### Architecture compliance (must follow)

- **AD-3:** the binding stays a one-liner over core: no counting, no classification, no formatting. Never use `it.each`/`it.concurrent` for runs.
- **AD-4:** use the exact formula `⌈threshold × runs − 1e-9⌉`, never a float ratio. `threshold: 0` is rejected.
- **AD-5:** per-run context comes only from `scope.enterRun`; never pass a context handle into the user body.
- **AD-10/AD-13:** the message is rendered once, at verdict time, from records. There are no mid-run prints.
- **AD-2:** core must not import `bindings/`; hence the `RunOptions` type moves to core.
- **AD-9:** defaults are resolved at execution (inside `execute`), validation happens at declaration. Do not load config in this story; config `testDefaults` are Story 2.5.
- **No `discarded` status, no `AbortController`/sibling abort.** That is Story 2.3. Here, siblings of a fatal run just run to completion (one fatal run is classified errored, per the existing infra chain rule).

### Out of scope

| Out of scope | Belongs to |
| --- | --- |
| `crucible.load`/`append` (the `load` usage throw stays) | Story 2.2 |
| Sibling abort, discarded runs | Story 2.3 |
| Headroom docs | Story 2.4 |
| Config `testDefaults` | Story 2.5 |
| Full output contract, bounding total message size, configurable excerpt | Story 3.1 |
| Verbosity | Story 3.2 |
| Concurrency caps / serial mode | Deferred (non-goal) |

Twenty failing runs will render twenty sections. That is acceptable for now, and Story 3.1 refines it.

### Testing standards (CLAUDE.md — binding)

- Tests sit beside their files (`aggregator.util.test.ts` next to `aggregator.util.ts`). No `__tests__` folders.
- Assert outcomes only:
  - error **kind** / `instanceof CrucibleVerdictError` + `outcome` + `cause` identity, as the existing runner tests do;
  - never message text, except in the Reporter, whose rendered string IS its contract;
  - no call counters or captured-arg inspection, except counting body executions, which is the observable behaviour under test ("runs N times").
- Helpers live in classes:
  - `RunnerHarness` (extend `src/core/test/runner-harness.util.ts`), `ReportHarness`, `JestBindingHarness`;
  - new helpers go in `<name>-harness.util.ts` / `<name>.util.ts` under the area's `test/` folder, and fakes in `.fake.ts`, one per file;
  - no `readonly` in test helpers; no loose module functions.
- No magic values. Repeated literals (run counts, thresholds such as 20/0.35/0.95) go in a named constant or enum file under `src/core/test/` (e.g. `gate-scenario.enum.ts`). `EXCERPT_LIMIT`-style local constants in tests are the existing precedent.
- No code comments. Use `type`, not `interface`. Named exports grouped at the end of the file. One class per file, kebab-case, `.util.ts` for pure classes.
- No real `process`/env, no files, no network, no timers. `RetryingCompleter` already takes an injected `Sleep`, but this story should not need it.

### Previous story intelligence (1.4 / 1.5 / harness refactor 71b489b)

- In 1.5's review, the high finding was that config/usage errors had been rebranded as verdicts. Keep the rethrow-untouched path, now across N runs.
- The cause-chain walk covers user code that wraps infra errors. Keep it.
- Double-wrap guard: a body rethrowing a `CrucibleVerdictError` must not be re-wrapped.
- Harness refactor commit 71b489b moved every test helper into `test/*-harness.util.ts` classes and renamed pure formatters to `.util.ts` (`reporter.util.ts`, `payload-assembler.util.ts`). Follow the same pattern; reviewers enforce it.
- In 1.4, the implementing subagent deviated from AD-7 (schema sent as the user prompt). Re-read the AD rules before coding, not after.
- Prettier runs in pre-commit (`format:check`); keep 2-space formatting.

### Library / framework

There are no new dependencies. The stack is unchanged: TS ~6.0, Jest 30 (`@jest/globals` imports in tests), ts-jest ESM via `NODE_OPTIONS=--experimental-vm-modules`, tsdown. `AsyncLocalStorage` with `Promise.all` over N `storage.run` calls isolates correctly; Story 1.4 already verified ALS under Jest 30 ESM. No web research was needed: nothing new is introduced.

### Project Structure Notes

New files:
- `src/core/run-options.ts` (types)
- `src/core/run-options-resolver.util.ts` + test
- `src/core/aggregator.util.ts` + test
- `src/core/test/start-gate.util.ts`
- possibly `src/core/test/*.enum.ts`

Edited files:
- `src/core/runner.ts` + test
- `src/core/reporter.util.ts` + test
- `src/core/test/runner-harness.util.ts`
- `src/core/test/report-harness.util.ts`
- `src/bindings/jest.ts` + test
- `src/bindings/test/jest-harness.util.ts`
- `src/api/crucible.ts` (type import only)

The spine seed names `core/aggregate.ts`, but the project convention since 71b489b is a class-named `.util.ts` file for pure classes, so use `aggregator.util.ts` (class `Aggregator`). This is an intentional variance.

### References

- [Source: _bmad-output/planning-artifacts/epics.md#Story 2.1]
- [Source: _bmad-output/planning-artifacts/architecture/architecture-crucible-ai-2026-08-10/ARCHITECTURE-SPINE.md#AD-3, #AD-4, #AD-5, #AD-9, #AD-10, #AD-13]
- [Source: _bmad-output/planning-artifacts/prds/prd-crucible-ai-2026-08-10/prd.md#FR-1, #FR-2]
- [Source: _bmad-output/implementation-artifacts/spec-1-5-see-why-it-failed.md — review triage (classification rules)]
- [Source: _bmad-output/implementation-artifacts/spec-1-4-first-semantic-verdict-smoke-mode.md — rejected "30s timeout sizing → Story 2.1"]
- [Source: _bmad-output/implementation-artifacts/deferred-work.md — per-attempt timeout note (judge already arms 30 s AbortSignal.timeout)]
- [Source: CLAUDE.md — development, testing, collaboration rules]

## Dev Agent Record

### Agent Model Used

Claude Opus 5.5 (claude-opus-5-5) via bmad-dev-story (unattended)

### Debug Log References

### Completion Notes List

- Ultimate context engine analysis completed - comprehensive developer guide created.
- Implemented red-green per task: resolver (21 tests), aggregator (13), reporter.renderVerdict (+5), runner multi-run (+12), binding (+6 net). Suite 137 → 192 tests; lint, format:check, typecheck, test, build green; no `console.` in `src/`.
- Task order: Task 4 (`Reporter.renderVerdict`) was built before Task 3's runner code, because the runner depends on it. Each piece still had a red test before its implementation.
- `RunOptionsResolver.resolve` calls `validate` first, so `execute` stays safe when called directly; it also rejects non-object options (`null`, arrays) as `usage` instead of letting a `TypeError` escape.
- Aggregator API: `tally(statuses, opts): RunTally` returns `{ zone, need, passed, failed, errored }` in one call, rather than a separate `zone()` method plus counters.
- Shared result types (`RunStatus`, `RunResult`, `VerdictZone`, `RunTally`, `VerdictSummary`) live in the types-only `src/core/run-result.ts`; `run-options.ts` holds only the option types.
- Smoke-mode message change: a failing or erroring single run is now rendered by `renderVerdict` (pass-rate headline + `Run #1` section, which embeds the unchanged `renderFailed`/`renderErrored` body). Outcome and `cause` are unchanged (AC 8).
- Fatal runs (`CrucibleVerdictError`, `config`/`usage` anywhere first in the cause chain) are rethrown untouched by lowest run index after all siblings settle.
- Binding computes the registration timeout as `runner.timeoutFor(resolver.resolve(opts).runs)` and passes the RAW options to `execute` (AD-9 seam kept).
- Test constants: `@typescript-eslint/no-duplicate-enum-values` forbids one enum holding both `1` run and threshold `1`, so they are split into `test/run-count.enum.ts` and `test/threshold.enum.ts`, plus `test/timeout-budget.enum.ts` (30 000 ms smoke budget).
- **Forward note for Story 2.5:** the timeout is fixed at registration from the *declared* `runs`. Once config `testDefaults` can supply `runs`, a test that omits `runs` gets the 1-run budget (30 s) while executing N runs. Resolve by having registration see config-derived runs, or by sizing the budget from config at execution.

### File List

New:
- src/core/run-options.ts
- src/core/run-result.ts
- src/core/run-options-resolver.util.ts
- src/core/run-options-resolver.util.test.ts
- src/core/aggregator.util.ts
- src/core/aggregator.util.test.ts
- src/core/test/start-gate.util.ts
- src/core/test/status-mix.util.ts
- src/core/test/run-count.enum.ts
- src/core/test/threshold.enum.ts
- src/core/test/timeout-budget.enum.ts

Modified:
- src/core/runner.ts
- src/core/runner.test.ts
- src/core/reporter.util.ts
- src/core/reporter.util.test.ts
- src/core/test/runner-harness.util.ts
- src/core/test/report-harness.util.ts
- src/bindings/jest.ts
- src/bindings/jest.test.ts
- src/api/crucible.ts
- _bmad-output/implementation-artifacts/2-1-repeat-and-gate-on-pass-rate.md

### Change Log

- 2026-11-13: Story 2.1 implemented — multi-run concurrent execution, three-zone gating, aggregate report, declaration validation, run-count timeout budget.
