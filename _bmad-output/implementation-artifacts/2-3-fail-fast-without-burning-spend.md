---
baseline_commit: d68cac0
---

# Story 2.3: Fail fast without burning spend

Status: done

## Story

As a developer,
I want a fatal provider error (bad key, unknown model) to abort the whole test immediately,
so that one misconfiguration doesn't burn 20 runs of judge spend.

## Acceptance Criteria

1. **Sibling abort.** Given 20 parallel runs and a judge call failing with a fatal classification (401, unknown model), when the first fatal lands, the runner's per-test `AbortController` aborts, and every sibling's in-flight judge call is cancelled through the port's `AbortSignal`. [AD-8, AR7]
2. **Discarded runs.** Runs still in flight when the abort fires are *discarded*: run status `discarded`, counted in no zone (neither failed nor errored), and rendered as discarded in the report. Runs that already settled before the abort keep their status. [AD-8, AD-4, conventions]
3. **Throw immediately with its cause.** The test rejects as soon as the first fatal lands — it does not wait for siblings to settle — with a `CrucibleVerdictError` of outcome `errored` whose `cause` is the fatal run's rejection. No unhandled rejections from siblings that settle afterwards. [AD-8, AD-4, AD-10]
4. **Retryable exhaustion stays local.** An infra error that exhausted its retries (`retryable: true`) errors only its own run; siblings keep running and the verdict is computed by the three-zone gate as before. [AD-8, AD-4]
5. **Misconfiguration also stops spend.** A `config`/`usage` `CrucibleError` (or a nested `CrucibleVerdictError`) from any run also aborts siblings and is rethrown untouched, immediately (Story 1.5 contract preserved, now without waiting). [AD-8, Story 1.5]
6. **Ambient signal, no public handle.** The per-test signal reaches the judge only through the ambient run scope (`RunScope`), combined with the existing per-call `JUDGE_CALL_TIMEOUT_MS` timeout. No public API parameter changes. [AD-5]
7. **Full suite stays green.** `npm run lint && npm run format:check && npm run typecheck && npm test && npm run build` pass; zero network, zero real timers in tests; `grep -rn 'console\.' src --include='*.ts'` empty; no open-handle or unhandled-rejection warnings.

## Tasks / Subtasks

TDD for every task: failing test first, then make it pass, then refactor.

- [x] **Task 1 — Run-scoped abort signal in `core/state`** (AC: 6)
  - [x] 1.1 Red tests in `src/core/state.test.ts`: a run entered with a signal sees that signal abort when its controller aborts; a run entered without a signal is never aborted; `abortSignal()` outside a run → `usage`.
  - [x] 1.2 `RunScope.enterRun(body, signal?)` stores the signal on the private `RunStore` (not on `RunContext` — spine shape unchanged); accessor `abortSignal(): AbortSignal`. Default: a fresh never-aborted signal.
- [x] **Task 2 — Judge honours the run's signal** (AC: 1, 6)
  - [x] 2.1 New fake `src/core/test/blocking-adapter.fake.ts` (`BlockingAdapter`): optional leading scripted failures, then every call blocks until its signal aborts, arrives at an injected `StartGate`, and rejects with the abort reason.
  - [x] 2.2 Red test in `src/core/judge.test.ts`: a judge call in flight rejects when the run's controller aborts (without the change it hangs on the 30 s timeout → test fails).
  - [x] 2.3 `Judge` reads `scope.abortSignal()` and passes `AbortSignal.any([runSignal, AbortSignal.timeout(JUDGE_CALL_TIMEOUT_MS)])` to each completer call.
- [x] **Task 3 — Discarded status + rendering** (AC: 2)
  - [x] 3.1 `RunStatus` gains `'discarded'`. Aggregator test row(s): discarded runs count in no zone (expected green on first run — the aggregator counts only passed/failed/errored; lock it in).
  - [x] 3.2 Red tests in `src/core/reporter.util.test.ts` for `Reporter.renderAborted({ results, options })`: names the fatal cause and that the test was aborted; renders discarded runs as discarded (by run number), never as failed sections.
  - [x] 3.3 `renderVerdict` must not render a discarded run as a failed section either (shared run-sections body).
- [x] **Task 4 — Runner aborts siblings and throws immediately** (AC: 1–5)
  - [x] 4.1 Red tests in `src/core/runner.test.ts` (no timers; never-settling and abort-awaiting behaviours via `RunnerHarness`):
    - fatal (raw and wrapped in the cause chain) with 19 never-settling siblings → rejects with `CrucibleVerdictError` outcome `errored`, cause = the fatal run's rejection;
    - fatal with 19 abort-awaiting siblings → every sibling's run signal aborts (siblings arrive at a `StartGate` the test also awaits);
    - retryable-exhausted infra on one run, siblings pass → test resolves at threshold 0.5;
    - usage error + abort-awaiting siblings → rethrown untouched and siblings aborted;
    - end-to-end through a real `Judge`: 20 runs, `BlockingAdapter` whose first call fails fatally → errored verdict with fatal infra cause; all 19 blocked sibling calls cancelled.
  - [x] 4.2 Implement: one `AbortController` per `execute`; each run entered with its signal; first halting settlement (fatal infra or rethrow-class) aborts the controller and resolves the batch immediately; unsettled runs become `discarded` with the context captured at run start; later settlements ignored.
  - [x] 4.3 Update the 2.1 test "carries the rejection of the first run matching the outcome as the cause": its infra run must be `retryable: true` (a default-`retryable:false` infra is now fatal and would abort).
- [x] **Task 5 — Verify** (AC: 7): full chain + `console.` grep; check jest output for open handles / unhandled rejections.

## Dev Notes

### Decision: what is "fatal"

- A run rejection whose cause chain's first `CrucibleError` is `kind: 'infra'` with `retryable !== true`. `RetryingCompleter` produces exactly this on `classifyFailure === 'fatal'` (`retryable: false`). `CrucibleError('infra', …)` without options defaults `retryable: false`, so it is fatal too — consistent with `retry.ts`, which also rethrows such errors immediately without retrying.
- Exhausted retries (`retry.ts` "kept failing after 3 attempts") and unparseable replies (`judge.ts` `notAVerdict`) carry `retryable: true` → `errored` run only, siblings continue (AC4).
- Detection is at the run's rejection (same place AD-4 classifies runs). A user body that swallows the fatal leaves its run to settle by its own outcome (AD-4: "User code that swallows an infra error leaves the run to settle by its body's outcome") — no abort.

### Decision: what is thrown

- Fatal infra → `CrucibleVerdictError('errored', reporter.renderAborted(...), cause)` where `cause` is the fatal run's rejection. Reasons: AD-4 says infra is never semantic, the smoke-mode (1-run) path already reports a fatal infra as an errored verdict with the cause attached (Story 1.5 test "turns an infra rejection into an errored CrucibleVerdictError" stays valid), and AD-10 says the reporter renders all user-facing output — the discarded runs need a renderer. "Throws the fatal error immediately with its cause" = immediate rejection carrying the fatal as `cause`.
- `config`/`usage`/nested `CrucibleVerdictError` → rethrown untouched (Story 1.5 contract), but now immediately and with siblings aborted. A bad config fails identically in every run, so continuing would only burn spend.
- The abort is a halt of the whole test: even if enough runs already passed to meet the threshold, a fatal still throws (AD-8 "throws immediately"). The tally is not consulted on the abort path.

### Decision: signal flow (AD-5)

- `RunScope.enterRun(body, signal)` stores the per-test signal on the private `RunStore`; `RunScope.abortSignal()` exposes it ambiently. `RunContext` (spine shape `{ state, verdicts, errors }`) is unchanged.
- `Judge` combines it per reply attempt: `AbortSignal.any([scope.abortSignal(), AbortSignal.timeout(JUDGE_CALL_TIMEOUT_MS)])` (Node ≥ 22 per `engines`, so `AbortSignal.any` is available). `RetryingCompleter` is already abort-aware: an aborted signal rethrows the adapter's rejection without retrying and makes no further attempt.
- The controller aborts with no explicit reason (default `AbortError` DOMException), so sibling error records don't misattribute the trigger's cause.

### Decision: discarded runs & rendering (minimal; full rendering is Story 3.1)

- At abort time the runner snapshots: settled runs keep their status, the trigger run is `errored`, every unsettled run becomes `{ status: 'discarded', context }` (context captured synchronously at run start). Anything a discarded run does afterwards is ignored.
- `Reporter.renderAborted` headline: the test was aborted on a fatal provider error and N in-flight runs were discarded; then the non-passed run sections (the trigger renders as errored with its cause), then one compact line listing discarded run numbers — no per-run section for discarded runs.
- `Aggregator` counts discarded in no zone (already true structurally; locked by a test row).

### Non-goals / known limits

- A sibling sleeping in retry backoff is not woken by the abort; `retry.ts` re-checks the signal after the sleep and makes no further attempt (no spend). Abortable sleep is not required by the AC.
- Sibling user code keeps running after its judge call rejects (JS cannot cancel arbitrary async code); its outcome is discarded.
- No concurrency cap (explicit non-goal).

### Current state of files this story touches

- **`src/core/runner.ts`** — 2.1 multi-run runner. `Promise.all` over `runOnce`; `classify` maps `CrucibleVerdictError` and non-infra `CrucibleError` to `{ fatal: true }` (rethrown after all settle), infra → `errored`, anything else → `failed`. Preserve: resolver/aggregator/reporter flow, `timeoutFor`, cause-chain walk, sync start of bodies in index order (harness relies on it). Rename the existing `fatal` marker (it means "rethrow untouched") to avoid confusion with fatal infra.
- **`src/core/state.ts`** — single ALS; `enterRun`, `context`, `appendState`, `recordVerdict`, `recordError`. Add the signal.
- **`src/core/judge.ts`** — `judgedReply` uses `AbortSignal.timeout(JUDGE_CALL_TIMEOUT_MS)` per attempt; combine with the run signal.
- **`src/core/retry.ts`** — no change expected (already abort-aware, fatal → `infra`/`retryable:false`).
- **`src/core/run-result.ts`** — add `'discarded'` to `RunStatus`.
- **`src/core/reporter.util.ts`** — add `renderAborted`; keep discarded out of failed sections.
- **`src/core/aggregator.util.ts`** — no change expected.
- **`src/core/verdict-error.ts`** — no change (`errored` outcome reused).

### Testing standards (CLAUDE.md — binding)

- Colocated tests; fakes one per file in `src/core/test/*.fake.ts`; helpers as static class members in `*-harness.util.ts` / `*.util.ts`; no `readonly` in test helpers; no loose functions; no comments; `type` over `interface`; named exports at file end.
- Assert outcomes and error kind/outcome only — never message text of errors. Reporter output is the reporter's functional product (precedent: existing reporter tests assert rendered content).
- No call counters / captured requests. Cancellation is proven by outcome: blocked siblings arrive at a `StartGate` the test awaits; without the abort they never arrive and the test fails by hanging (the 2.1-accepted timer-free pattern).
- No real timers. `AbortSignal.timeout` inside the judge is production code (unref'd timer, pre-existing).
- No magic values: reuse `RunCount`, `Threshold`.

### Previous story intelligence (2.1, 2.2)

- 2.2 review removed a fake whose behaviour depended on the request payload — fakes must not inspect requests. `BlockingAdapter` only reacts to the signal.
- 2.1 review: explicit return types on harness methods; enum members used with their real meaning; `@typescript-eslint/no-duplicate-enum-values`.
- `StartGate(expected).arrive()` resolves once `expected` arrivals happen.
- 2.1 dismissed "fatal runs wait for siblings" as Story 2.3 work — this story closes it.

### References

- [Source: _bmad-output/planning-artifacts/epics.md#Story 2.3]
- [Source: _bmad-output/planning-artifacts/architecture/architecture-crucible-ai-2026-08-10/ARCHITECTURE-SPINE.md#AD-4, #AD-5, #AD-8, #AD-10, #AD-13, Consistency table (run status `passed | failed | errored | discarded`)]
- [Source: _bmad-output/implementation-artifacts/2-1-repeat-and-gate-on-pass-rate.md#Review Triage Log]
- [Source: _bmad-output/implementation-artifacts/2-2-arrange-state-per-run.md#Review Triage Log]
- [Source: _bmad-output/implementation-artifacts/spec-1-5-see-why-it-failed.md]
- [Source: CLAUDE.md]

## Dev Agent Record

### Agent Model Used

Claude Opus 5.5 (claude-opus-5-5) via bmad-dev-story (unattended)

### Debug Log References

### Completion Notes List

- Ultimate context engine analysis completed - comprehensive developer guide created.
- Task 1 red→green: 3 `RunScope` tests. `enterRun(body, signal?)` stores the per-test signal on the private `RunStore` (default: a fresh never-aborted signal); `abortSignal()` accessor, `usage` outside a run. `RunContext` shape unchanged.
- Task 2 red→green: new `BlockingAdapter` fake (reacts only to its signal — no request inspection). Judge test hung on the 30 s per-call timeout before the change (red = jest 5 s timeout); now `Judge` passes `AbortSignal.any([scope.abortSignal(), AbortSignal.timeout(JUDGE_CALL_TIMEOUT_MS)])` per reply attempt. The judge test asserts only that the call rejects (`toBeDefined` on the captured rejection — `toBeInstanceOf(Error)` fails across Jest's VM realm for `DOMException`). `JudgeHarness.judge` widened to `ProviderAdapter` (now needed for the new fake).
- Task 3: `RunStatus` gains `discarded`. Aggregator rows (discarded beside failed → fail; beside errored → errored) were green on first run, as predicted — they lock "counted in no zone". Reporter: new `renderAborted({ results, options })` (abort headline: settled count, discarded count, fix provider setup/config) and a shared run-sections body used by `renderVerdict` too: failed/errored runs get sections, discarded runs are listed on one compact line ("Discarded (aborted in flight, counted in no zone): Run #2, Run #3"), never rendered as failed. 4 red→green reporter tests. New type `AbortSummary` in `run-result.ts`.
- Task 4 red→green: 7 runner tests (6 red; the retryable-exhaustion test was green on first run because 2.1 already erred only that run — a mutation treating every infra as fatal turns it and the 2.1 cause test red, so it discriminates). Runner now holds one `AbortController` per `execute`, enters each run with its signal, captures each run's context synchronously at start, and settles a batch: the first fatal infra (`retryable !== true` in the cause chain) or rethrow-class rejection (`config`/`usage`/nested `CrucibleVerdictError`) aborts the controller and resolves immediately; unsettled runs become `discarded`; later settlements are ignored (run promises never reject → no unhandled rejections). Fatal infra → `CrucibleVerdictError('errored', reporter.renderAborted(...), fatalRunRejection)`; rethrow-class → rethrown untouched. The abort halts the test even if the threshold was already met.
- Task 4.3: 2.1 test "carries the rejection of the first run matching the outcome as the cause" now uses `retryable: true` for its infra run — a default `CrucibleError('infra', …)` is `retryable: false`, i.e. fatal, and would now abort.
- Decisions (unattended): fatal = infra with `retryable !== true` (matches `retry.ts`, which also never retries those); thrown as an errored verdict error with the fatal as `cause` (AD-4 infra never semantic, AD-10 reporter owns output, keeps 1.4/1.5 smoke-mode behaviour); config/usage also abort siblings (same misconfig would hit every run); controller aborts with the default `AbortError` reason so sibling records don't misattribute the trigger; a fatal swallowed by user code does not abort (AD-4). Known limits: a sibling sleeping in retry backoff is not woken (retry re-checks the signal after the sleep, makes no further attempt); sibling user code continues after its judge rejects, its outcome discarded.
- Suite 209 → 226 tests / 14 suites; lint, format:check, typecheck, test, build green; `--detectOpenHandles` clean (only the pre-existing VM-modules ExperimentalWarning); no `console.` in `src/`.

### File List

New:
- src/core/test/blocking-adapter.fake.ts
- _bmad-output/implementation-artifacts/2-3-fail-fast-without-burning-spend.md

Modified:
- src/core/runner.ts
- src/core/runner.test.ts
- src/core/state.ts
- src/core/state.test.ts
- src/core/judge.ts
- src/core/judge.test.ts
- src/core/run-result.ts
- src/core/reporter.util.ts
- src/core/reporter.util.test.ts
- src/core/aggregator.util.test.ts
- src/core/test/judge-harness.util.ts
- src/core/test/report-harness.util.ts
- src/core/test/runner-harness.util.ts
- _bmad-output/implementation-artifacts/sprint-status.yaml

### Change Log

- 2026-11-13: Story 2.3 implemented — per-test `AbortController`; first fatal provider error (or config/usage error) aborts sibling runs via the ambient run signal reaching the judge's port calls; in-flight runs discarded (no zone, rendered as discarded); test rejects immediately.

### Review Triage Log

Code review 2026-11-13 (bmad-code-review, unattended; Blind Hunter, Edge Case Hunter, Acceptance Auditor + orchestrator pass) on `git diff story-2-2-arrange-state-per-run...HEAD`.

**Fixed (test-first):**
- [Medium] Cyclic `cause` chain (`e.cause` loop) hung the runner synchronously in `firstCrucibleInChain` (now hit by both `classify` and `isFatal`). Red: new runner test hung; fix: visited-set in the walk → run settles `failed`.
- [Low] AC5 coverage: only `usage` was proven to abort siblings and rethrow immediately; test now `it.each` over usage / config / nested `CrucibleVerdictError` (green on first run — shared `rethrow` path; locks the AC).
- [Low] End-to-end judged-cancellation test asserted four things (outcome, cause kind, retryable, gate); trimmed to its single purpose (sibling judge calls cancelled). Outcome/cause already covered by the `it.each` fatal test.
- [Low] Repeated `'invalid API key'` literal (reporter tests ×4, runner harness, runner test) → `src/core/test/provider-fault.enum.ts` `ProviderFault.InvalidKey`.
- [Low] `BlockingAdapter` had an unused `classification` constructor parameter (speculative fake surface) → removed; always `'fatal'`.
- [Nit] Missing blank lines before new `it(` blocks in judge/state tests.

**Deferred** (deferred-work.md): per-call judge timeout classified `failed` not `errored` (pre-existing since 1.4, needs injectable timeout to test); user SUT calls not cancelled (AC6 forbids public signal); smoke-mode abort headline wording + runner-side discard snapshot only lockable via report surface (Story 3.1).

**Rejected:**
- Two fatals at once / rethrow vs fatal race — first settlement wins under `signal.aborted` guard; whichever halts first is deterministic per settlement order and both are halting outcomes.
- Fatal after all others settled — fatal branch precedes `pending` decrement; resolves `fatal` with 0 discarded. Correct.
- Abort between judge calls / between parse attempts / during backoff — `RetryingCompleter.throwIfAborted` precedes every adapter call; no spend.
- Aborted siblings' AbortError misclassified — post-abort settlements are ignored (`signal.aborted` guard); never tallied.
- Unhandled rejections — `settle` catches everything; run promises never reject. A throwing `cause` getter is pathological.
- `AbortSignal.any` listener leak — Node holds dependants weakly, timeout timers are unref'd; per-test scale.
- Infra without explicit `retryable` is fatal — spec decision, mirrors `retry.ts` which never retries `retryable:false`.
- `runs: 0` hang — resolver rejects `runs < 1`.
- Aggregator/reporter discarded tests green-first — spec-declared lock-in rows; shared run-sections body.
- `toBeInstanceOf(CrucibleVerdictError)` / `cause` `toBe` — asserting error TYPE and AC3's required cause is the outcome, not shape testing.
- Judge abort test `resolves.toBeDefined()` — proves rejection vs hang; DOMException cross-realm prevents a kind check.
- `RunCount.Single + n` gate sizes, `BlockingAdapter` array `shift` — readable derivation; arrays are per-test literals.
- Discarded run's context is live — discarded runs render by number only; no reader of their context.
- Discarded label for runs finishing in the abort tick — snapshot semantics per spec.
- `AbortSignal.any` Node version — `engines: node >=22`.

Result: 229 tests / 14 suites green; lint, format:check, typecheck, build green; no `console.` in `src/`.

