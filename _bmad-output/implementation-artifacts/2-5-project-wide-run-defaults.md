---
baseline_commit: a5602ffe4f080318c737759f2ec4c38a510be314
---

# Story 2.5: Project-wide run defaults

Status: review

## Story

As a developer,
I want to set default `runs`/`threshold` in `crucible.config.json`,
so that my team's reliability bar applies to every inference test without repeating it, while individual tests can still override.

## Acceptance Criteria

1. **Config defaults apply.** Given `crucible.config.json` containing `{ "testDefaults": { "runs": 20, "threshold": 0.95 } }`, a `crucible.it()` test that omits `runs`/`threshold` executes 20 runs gated at 0.95. [FR-1, AD-9]
2. **Per-field override.** A test passing `{ runs: 5 }` uses 5 runs with the config's 0.95 threshold — per field, not all-or-nothing. A test passing both uses its own values entirely. [AD-9 precedence: `crucible.it()` param > config `testDefaults` (per field) > built-in]
3. **Built-ins without testDefaults.** With no `testDefaults` in config (or an empty `{}`), built-ins apply: `runs: 1`, `threshold: 1.0`. [AD-3]
4. **Validated at config load.** Invalid `testDefaults` — `threshold` outside (0, 1], `runs` not an integer ≥ 1, a non-number value, an unknown key inside `testDefaults`, or `testDefaults` that is not a plain object (`null`, array, scalar) — fails at config load as a `CrucibleError` of kind `config`, the same fail-fast as provider validation. [AD-9 as amended]
5. **Execution-time resolution; inert registration.** Defaults are resolved when the test executes (first `config.get()` happens inside `Runner.execute`), never at registration: registering a `crucible.it()` test never loads config. A config failure surfaces as the test's rejection (kind `config`) and no body run starts. [AD-9]
6. **Timeout follows the resolved run count (design decision, see Dev Notes).** The runner owns the per-test deadline at execution time: it arms `timeoutFor(resolvedRuns)` via an injected timer boundary. On expiry it aborts every in-flight run (no further judge spend) and rejects with a reporter-rendered `CrucibleVerdictError` of outcome `errored` (infra, never semantic); settled runs keep their status, unsettled runs are `discarded`. The timer is disarmed when the batch settles. A test inheriting `runs: 20` from config is never cut off at the 1-run budget. [AD-3, AD-4, AD-10]
7. **Jest timeout is a ceiling that never undercuts the runner.** The binding registers the Jest timeout from the runner: declared `runs` → `timeoutFor(declared) + margin`; omitted `runs` → a fixed ceiling no config-derived budget can exceed (and no larger than the `setTimeout` maximum, which Jest would otherwise overflow to ~1 ms). Registration stays inert. [AD-3]
8. **Docs.** `docs/runs-and-threshold.md` documents `testDefaults`, the precedence, the validation, and the new timeout behaviour.
9. **Quality gates.** `npm run lint && npm run format:check && npm run typecheck && npm test && npm run build` green; no `console.` in `src/`; no open handles.

## Tasks / Subtasks

- [x] Task 1: Config `testDefaults` (AC 3, 4)
  - [x] 1.1 RED config tests: valid full/partial `testDefaults` resolve; absent → `{}`; invalid table → kind `config`. Replace the existing `'unknown field'` row (it used `testDefaults` as its example) with a genuinely unknown field.
  - [x] 1.2 GREEN: add `testDefaults` to `KNOWN_FIELDS`, `CrucibleConfig.testDefaults: RunOptions` (always present, frozen `{}` when absent).
  - [x] 1.3 REFACTOR: extract the shared rules from `RunOptionsResolver` into a pure `RunOptionsValidator` (`run-options-validator.util.ts`) returning a violation description; resolver wraps it as `usage`, config as `config`. No duplicated rule logic.
- [x] Task 2: Per-field precedence in the resolver (AC 1, 2, 3)
  - [x] 2.1 RED: `resolve(opts, defaults)` — omitted fields from defaults, declared fields win, no defaults → built-ins.
  - [x] 2.2 GREEN: `opts.x ?? defaults.x ?? BUILT_IN`.
- [x] Task 3: Runner reads defaults at execution (AC 1, 2, 5)
  - [x] 3.1 RED runner tests: defaults' runs drive executions; defaults' threshold gates; config failure from the supplier rejects as `config` and runs no body.
  - [x] 3.2 GREEN: inject `TestDefaultsSupplier = () => RunOptions` (default: none); call it inside `execute`.
- [x] Task 4: Runner-owned deadline (AC 6)
  - [x] 4.1 New fake `src/core/test/manual-timer.fake.ts` (arm/disarm/advance — no real timers). All runner/binding tests inject it.
  - [x] 4.2 RED: expiry → `CrucibleVerdictError('errored')`; expiry aborts in-flight runs; inherited 20-run deadline survives the 1-run budget.
  - [x] 4.3 GREEN: `DeadlineTimer = (ms, onExpire) => disarm`; default arms `setTimeout`/`clearTimeout`; batch halts `expired`; disarm in `finally`.
  - [x] 4.4 Reporter `renderExpired` (RED reporter test first): headline names the deadline, settled count, discarded count.
- [x] Task 5: Binding ceiling (AC 7)
  - [x] 5.1 RED binding tests: omitted runs → registered timeout exceeds the runner budget for 100 runs and stays ≤ the timer maximum; declared runs → registered timeout exceeds the runner deadline for those runs.
  - [x] 5.2 GREEN: `Runner.ceilingFor(declared: RunOptions)`; binding no longer resolves options.
- [x] Task 6: Composition root wires `() => config.get().testDefaults`.
- [x] Task 7: Docs (AC 8).
- [x] Task 8: Gates (AC 9).

## Dev Notes

### Current state (files touched)

- `src/core/config.ts` — `ConfigStore.get()` memoized; strict `KNOWN_FIELDS = provider, model, meta, verbosity`; every failure is `CrucibleError('config')`. Preserve: key-like rejection, BOM handling, verbosity override, registry resolution.
- `src/core/run-options-resolver.util.ts` — `validate(candidate: unknown): asserts candidate is RunOptions` (kind `usage`) and `resolve(opts)` with built-ins 1 / 1.0. Preserve all `usage` cases (non-object, `null`, array, unknown key, invalid runs/threshold incl. NaN/Infinity/strings).
- `src/core/runner.ts` — `timeoutFor(runs) = 30000 + (runs−1)×1000`; one `AbortController` per `execute` passed to every run via `RunScope.enterRun(body, signal)`; batch halts `rethrow` / `fatal` / `none`; fatal → `CrucibleVerdictError('errored', reporter.renderAborted(...))`. Preserve: 2.3 abort semantics, settle-never-rejects, `signal.aborted` guard against late settlements.
- `src/bindings/jest.ts` — registers one test with `runner.timeoutFor(resolver.resolve(opts).runs)` and passes RAW options to `execute` (the 2.1 seam for this story).
- `src/api/crucible.ts` — composition root; `config` singleton; `completionTarget` already calls `config.get()` lazily.

### Timeout design (the key problem)

Jest's timeout is fixed at registration; with `testDefaults`, the effective `runs` is only known at execution (config cannot load at registration — AD-9 inertness). Adopted design:

- **Runner owns the real deadline.** After resolving options, `execute` arms `timeoutFor(resolved.runs)` through an injected `DeadlineTimer` boundary on the per-test `AbortController`. Expiry = abort in-flight runs + errored verdict (infra; the cause is a retryable `CrucibleError('infra')`, mirroring the judge's per-call deadline from AD-4 amendment c13e0d7). Disarmed on settle.
- **Jest timeout is a backstop ceiling.** Declared runs: `timeoutFor(declared) + CEILING_MARGIN_MS` so the runner's reporter-rendered verdict wins the race. Omitted runs: the `setTimeout` maximum (2 147 483 647 ms) — the only fixed value no config-derived budget can exceed, and the cap Jest needs to avoid overflow. The runner's own deadline arms synchronously at the start of `execute`, so the ceiling is unreachable in practice.

### Testing rules (CLAUDE.md — reviewers enforce hard)

- No real timers: inject `ManualTimer` fake everywhere a `Runner` is built in tests.
- Assert outcomes and error KIND, never message text (reporter tests are the exception — the reporter's output IS its behaviour, per precedent).
- No call counters / captured arguments: prove the deadline size by advancing the fake clock past the 1-run budget and observing the test still passes.
- Fakes one per file `.fake.ts`; enums `.enum.ts`; helpers in harness classes; no `readonly` in test helpers; no magic values.

### Previous story intelligence

- 2.1: forward note — this exact timeout problem; `RunCount`/`Threshold`/`TimeoutBudget` test enums exist (split to avoid duplicate enum values).
- 2.2: payload-inspecting fakes were removed in review — never inspect requests.
- 2.3: per-test `AbortController`; `StartGate` timer-free concurrency proof; `awaitingAbort` harness behaviour proves cancellation.
- 2.4: docs page `docs/runs-and-threshold.md` already says "Story 2.5 content not pre-empted"; its Timeout section must now be rewritten.

### References

- [Source: _bmad-output/planning-artifacts/epics.md#Story 2.5]
- [Source: ARCHITECTURE-SPINE.md#AD-3, #AD-4, #AD-9, #AD-10]
- [Source: _bmad-output/implementation-artifacts/2-1-repeat-and-gate-on-pass-rate.md#Timeout policy]
- [Source: _bmad-output/implementation-artifacts/deferred-work.md]
- [Source: CLAUDE.md]

## Dev Agent Record

### Agent Model Used

Claude Opus 5.5 (claude-opus-5-5) via bmad-dev-story (unattended)

### Debug Log References

### Completion Notes List

- Ultimate context engine analysis completed - comprehensive developer guide created.
- Task 1 red→green→refactor: 3 of the new config tests red (valid `testDefaults` was rejected as an unknown field); the existing `'unknown field'` row used `testDefaults` as its example and now uses `defaults`. `CrucibleConfig.testDefaults: RunOptions` is always present (frozen `{}` when absent). The shared rules moved into a pure `RunOptionsValidator` (`run-options-validator.util.ts`) that returns a violation description; `RunOptionsResolver.validate` wraps it as `usage`, `ConfigStore` wraps it as `config`. No rule logic is duplicated. Covered through both consumers (resolver `usage` table unchanged and green; new config table) and not tested directly, so its tests are not a third copy of the same table.
- Decision: unknown keys inside `testDefaults` are rejected (`config`). This matches the strict top-level config and strict `crucible.it` options, and a typo such as `run` would otherwise silently fall back to 1 run.
- Task 2: `resolve(opts, defaults = {})` resolves per field: `opts.x ?? defaults.x ?? built-in`. 3 red→green tests (plus 1 covering a partial defaults fallback).
- Task 3: `Runner` takes an injected `TestDefaultsSupplier` (default: no defaults, as a private static) and calls it inside `execute`, never at registration. The composition root wires `() => config.get().testDefaults`, so `config.get()` is first invoked when a test executes (AD-9). A config failure rejects the test as kind `config` before any run starts.
- **Behaviour change (AD-9 as written):** every `crucible.it()` execution now loads config, including a test with no `coherent()` call. Before this story such a test ran without a `crucible.config.json`. This is accepted, because crucible requires the config anyway (FR-7) and AD-9 says first `get()` happens at first run execution.
- **Timeout design (Task 4/5): adopted the recommended design.** The runner owns the real deadline. After resolving options, `execute` arms `timeoutFor(resolvedRuns)` through an injected `DeadlineTimer = (ms, onExpire) => disarm`; the default is a private static `setTimeout`/`clearTimeout`. On expiry it aborts the per-test `AbortController` (in-flight judge calls are cancelled through the 2.3 ambient signal, so there is no further spend). It then resolves the batch as `expired`: settled runs keep their status and unsettled runs become `discarded`. Finally it throws `CrucibleVerdictError('errored', reporter.renderExpired(...), CrucibleError('infra', retryable: true))`. The cause mirrors the judge per-call deadline (c13e0d7: deadline = retryable infra). `runBatch` disarms in `finally`, on every halt path. Reasoning: only the runner knows the resolved run count, and owning the deadline also improves on 2.1 for declared runs. A slow gate now ends in a reporter-rendered verdict instead of a bare Jest timeout (this addresses part of the 2.1 deferred "Jest may kill a large gate before a verdict report is rendered").
- Binding ceiling: `Runner.ceilingFor(declared)`. With `runs` declared it is `timeoutFor(declared) + 5000 ms` (`CEILING_MARGIN_MS`), so the runner's verdict wins the race. The margin absorbs config load, synchronous body prologues and event-loop lag before the deadline is armed. With `runs` omitted it is `2147483647 ms` (the setTimeout maximum, ≈24.8 days). That is the only fixed value no config-derived budget can exceed, and Jest overflows larger values to ~1 ms. It is unreachable in practice, because the runner arms its own deadline synchronously at the start of `execute`. Every ceiling is clamped to the timer maximum. The binding no longer resolves options at registration; it validates only, so registration stays inert.
- Tests use the new `ManualTimer` fake (`arm`/`advance`, no real timers). Every `Runner` built in tests now goes through `RunnerHarness.runner(...)` with it, and the binding harness uses it too. The deadline size is proven by outcome, without inspecting the armed value: a test inheriting `runs: 20` from defaults survives `advance(30000)` and passes (it would expire under a 1-run budget). Expiry tests: rejects as errored, and cancels every in-flight run (`awaitingAbort` gate).
- Reporter `renderExpired`: the headline names the deadline in ms and the settled/discarded counts, and is never the pass-rate headline. Run sections are shared (settled runs keep their section; discarded runs are listed on one line). 2 red→green reporter tests.
- Binding tests: the old "30 s smoke budget" assertion was replaced by ceiling-contract tests: omitted runs exceed the 100-run runner budget; declared runs exceed the runner deadline; omitted runs and absurd declared runs (`BeyondTimerMax`) both stay ≤ the timer maximum (the clamp was red-tested by removing it). Registration never reads defaults (a runner whose defaults supplier throws registers fine). An omitted-runs declaration executes the configured 20 runs.
- Docs: `docs/runs-and-threshold.md` gains a "Project-wide defaults: `testDefaults`" section (example, per-field precedence table, validation as `config`, execution-time resolution). The Options table defaults now name `testDefaults`. The Timeout section is rewritten (deadline from the resolved run count, enforced by Crucible: in-flight runs aborted, discarded, errored verdict; the Jest backstop policy). The halt list grows from two outcomes to three, and the cost and headroom wording now says "deadline".
- Known limits / deferred unchanged: runs above ~2.1M overflow `timeoutFor` past the setTimeout maximum, so the runner deadline would fire at ~1 ms (pre-existing no-upper-bound item in deferred-work.md; Array.from fails before that anyway). User SUT calls in discarded runs are not cancelled (2.3 deferred item).
- Suite 231 → 264 tests / 14 suites. lint, format:check, typecheck, test (`--detectOpenHandles` clean apart from the pre-existing VM-modules ExperimentalWarning), and build are all green, and there is no `console.` in `src/`.

### File List

New:
- src/core/run-options-validator.util.ts
- src/core/test/manual-timer.fake.ts
- src/core/test/project-defaults.util.ts
- src/core/test/invalid-test-default.enum.ts
- _bmad-output/implementation-artifacts/2-5-project-wide-run-defaults.md

Modified:
- src/api/crucible.ts
- src/bindings/jest.ts
- src/bindings/jest.test.ts
- src/bindings/test/jest-harness.util.ts
- src/core/config.ts
- src/core/config.test.ts
- src/core/reporter.util.ts
- src/core/reporter.util.test.ts
- src/core/run-options-resolver.util.ts
- src/core/run-options-resolver.util.test.ts
- src/core/run-result.ts
- src/core/runner.ts
- src/core/runner.test.ts
- src/core/test/report-harness.util.ts
- src/core/test/run-count.enum.ts
- src/core/test/runner-harness.util.ts
- src/core/test/timeout-budget.enum.ts
- docs/runs-and-threshold.md
- _bmad-output/implementation-artifacts/sprint-status.yaml

### Change Log

- 2026-11-13: Story 2.5 implemented. Adds config `testDefaults` (validated at load as `config`; shared validator with `crucible.it` options), per-field precedence resolved at execution, a runner-owned per-test deadline from the resolved run count (abort, discard, errored verdict), a Jest timeout ceiling that never undercuts the runner, and updated docs.
