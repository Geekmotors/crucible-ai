---
baseline_commit: aa21c09023671dabb3590afe0fcf5a10069e6e2c
---

# Story 7.1: The gate and a context for each run

Status: done

## Story

As a developer who wants test scope to be visible and runner-independent,
I want a `crucible.gate(...)` body wrapper that runs my body N times with a per-run context,
so that I can use any runner's own `it` (with every variant) and see which run my facts and judgements belong to.

## Acceptance Criteria

1. **Gate.** `it(name, crucible.gate([options,] async (t, ...args) => { ... }), timeout?)` with the runner's own `it` (incl. `it.only`, `it.each`) runs the body `runs` times concurrently, gates on `threshold`, throws the same `CrucibleVerdictError` and report as `crucible.it`, and passes the runner's own arguments (e.g. `it.each` row values) after `t`.
2. **Options.** Resolve as for `crucible.it`: built-in → config `testDefaults` (read at run time) → enclosing `crucible.describe` (captured when `crucible.gate(...)` is called) → the gate's options. Same validation as `crucible.it` options: invalid options, a missing body, two bodies or a surplus argument are a `usage` error when `crucible.gate(...)` is called.
3. **Deadline.** The gate enforces its own test deadline (errored verdict as today). It cannot set the runner's timeout; docs tell users to pass a runner timeout at least as large as the gate's `testTimeout`.
4. **Arity.** The returned function declares zero parameters (rest parameters) so Jest never treats it as a `done`-callback test, and forwards any runner-supplied arguments.
5. **Run context `t`.** `{ facts, coherent, extract }` with the same signatures and validation as `crucible.facts/coherent/extract`, bound to its own run; each concurrent run has its own `t`; `t` and the global functions inside the same run share one run state.
6. **Lifetime.** `t` keeps working from callbacks that lost the async context until its run ends (passed/failed/errored/discarded); afterwards any `t` call is a `usage` error.
7. **`crucible.it`.** Bodies receive `t` (`async (t) => ...`); zero-argument bodies keep working; behaviour otherwise unchanged. `crucible.it` is implemented on the gate. `crucible.describe` callbacks receive nothing.
8. **Types.** `gate` overloads and a public `RunContext` type with JSDoc in `src/api/`; `crucible` stays `Readonly`; type tests in `e2e/test/`.
9. **e2e.** One e2e scenario using plain Jest `it` + `crucible.gate`, including `it.each` with row args (`runs: 1`, `threshold: 1`).
10. **Docs.** `t` is the recommended style; the gate is documented for plain-runner users: `docs/api.md` (gate + run context, function count), README (`async (t) =>` example, "Use your runner's own `it`"), `docs/runs-and-threshold.md` (gate timeouts), `docs/gotchas.md` (runner timeout must cover the gate's), CHANGELOG `## Unreleased` → Added. Not breaking.

## Tasks / Subtasks

- [x] Rename internal `RunContext` record type in `src/core/state.ts` → `RunLedger` (frees the name for the public type) (AC 8)
- [x] `RunHandle` (core): holds the run store, `within(fn)` re-enters the store via `AsyncLocalStorage.run`, `close()`; closed → `usage` (AC 5, 6)
- [x] `RunScope.handle()` returns a `RunHandle` for the current run (AC 5)
- [x] `Runner.execute(body: (run: RunHandle) => unknown, opts)`: creates one handle per run, closes it when the run settles and closes every handle when the batch ends (covers discarded runs) (AC 6)
- [x] `RunAssertions` type + `ScopedAssertions` (global functions over the scope, lazy judge/extractor) + `BoundAssertions` (`t`: each call `run.within(...)` the scoped assertions) (AC 5)
- [x] `Gate` (core, runner-neutral): `wrap(optsOrBody, body?, ...surplus)` validates and captures group settings; `declare(opts, body)` → `{ test, timeout }`; `group(options, body)` (AC 1–4)
- [x] `JestBinding` keeps registration + timeout + describe only, built on the gate (AC 7)
- [x] `src/api`: `RunContext`, `TestBody`, `GateBody`, `GatedTest` types with JSDoc; `crucible.gate` overloads in `CrucibleSurface`; composition root wires gate; entry point exports the new types (AC 8)
- [x] Unit tests (TDD): gate run/threshold/verdict via direct invocation; forwarding; group capture; validation; deadline; `t` after context loss; `t` after run end (passed and discarded); concurrent isolation; `t.facts` ↔ global facts shared; `crucible.it` body receives `t` (AC 1–7)
- [x] Type tests `e2e/test/crucible-gate-typing.util.ts` (AC 8)
- [x] e2e scenario `e2e/core/plain-runner-gate.test.ts` + fixture (AC 9)
- [x] Docs + CHANGELOG (AC 10)

## Dev Notes

### Current state (read before touching)

- `src/bindings/jest.ts` — `JestBinding.register(name, optsOrBody, bodyOrTimeout?, timeout?)`: normalizes the four `it` forms (usage errors: two bodies, missing body, surplus after timeout, trailing timeout + `testTimeout`), validates via `RunOptionsResolver.validate`, inherits `GroupSettings`, registers `() => runner.execute(body, opts)` with `runner.ceilingFor(opts)`. `group(...)` → `GroupSettings.declare` + Jest `describe`. Lazy global `it`/`describe` registrars.
- `src/core/runner.ts` — `execute(body, opts)`: resolves options with `testDefaults()` at run time, runs `runs` bodies concurrently each inside `scope.enterRun(...)`, deadline timer, three-zone verdict, `CrucibleVerdictError`/report. `ceilingFor` = declared `testTimeout + 5000` (capped) else timer max.
- `src/core/state.ts` — `RunScope` over `AsyncLocalStorage<RunStore>`; `RunContext` = per-run record (state, verdicts, extractions, errors) — internal name collides with the new public type, rename to `RunLedger`.
- `src/core/group-settings.ts` — layer stack pushed during describe collection; `inherit(own)` overlays layers + own.
- `src/core/judge.ts`, `extractor.ts`, `judge-exchange.ts`, `trace-reporter.ts` read the run store via `RunScope` (ALS). Re-entering the held store with `AsyncLocalStorage.run(store, fn)` makes all of them work unchanged for `t`.
- `src/api/crucible.ts` — `CompositionRoot` lazily builds judge/extractor/binding (config read lazily); frozen `crucible` object.

### Design

- `t.coherent(...)` = `handle.within(() => scoped.coherent(...))` — the global implementation run inside the held store: same validation, same records, same trace, shared state. Async methods reject (not throw) after the run ends; `t.facts` throws synchronously like `crucible.facts`.
- Handles close when their run settles and all close when the batch ends (expired/aborted/rethrow → discarded runs too). Global functions are unchanged (no new restriction).
- Gate returned function: `(...args) => runner.execute((run) => body(new BoundAssertions(run, scoped), ...args), inherited)`.
- Group settings captured at `crucible.gate(...)` call; config at run time (unchanged runner behaviour).
- Typing: `gate<A extends unknown[] = unknown[]>(body: (t: RunContext, ...args: A) => unknown): (...args: A) => Promise<void>` (and with options) — users annotate row params (`async (t, a: number, b: string) =>`) and the returned function fits `it.each`.

### Must preserve

- Every `crucible.it` / `crucible.describe` behaviour and usage error; existing jest binding, runner and state tests (safety net). Registration stays inert (no config read).

### Testing

- Outcomes only (verdict kind, resolved/rejected, values judged); no call counters beyond existing patterns; error kind only; fakes one per file; enums for literals; harness classes; no process state / file I/O. Context loss simulated by a detached-callback fake invoked from the test's own (non-run) stack.

### References

- [Source: _bmad-output/planning-artifacts/epics.md#Epic 7, Story 7.1]
- [Source: _bmad-output/implementation-artifacts/6-3-describe-group-settings.md] (runner-neutral settings; review learnings: copy options, surplus args usage, callback checked first)
- [Source: _bmad-output/implementation-artifacts/6-5-facts-per-call-and-per-run.md] (FactAwareJudge outcome pattern, facts semantics)
- [Source: CLAUDE.md]

## Dev Agent Record

### Agent Model Used

Claude Opus 5.5 (claude-opus-5-5)

### Debug Log References

### Completion Notes List

- Ultimate context engine analysis completed - comprehensive developer guide created
- **TDD.** `src/core/gate.test.ts` written first (red: modules missing) → `RunHandle`, `RunAssertions`, `ScopedAssertions`, `BoundAssertions`, `Gate`, runner handle lifecycle → green (29). Jest binding test "passes each run its own run context t" red (binding not on the gate) → green after the refactor. Mutation checks: making `RunHandle.within` call `fn()` directly fails the context-loss test; dropping the per-run and batch-end `close()` fails 5 lifetime tests; dropping only the batch-end close fails the discarded-run test. The api `crucible.gate` usage test was added after the implementation (thin wiring over the core-tested validation).
- **Core.** `RunScope.handle()` → `RunHandle` (holds the run store; `within(fn)` re-enters it with `AsyncLocalStorage.run`, so Judge/Extractor/JudgeExchange/trace work unchanged; `close()` → later calls `usage`). `Runner.execute(body: (run: RunHandle) => unknown, opts)` creates one handle per run, closes it when the run settles, and closes every handle when the batch ends (expired/aborted/rethrown → discarded runs too). `ScopedAssertions` = the global functions over the scope (lazy judge/extractor). `BoundAssertions` = `t`: each method runs the scoped assertion inside its run's handle (arrow fields, so destructuring works); `coherent`/`extract` reject, `facts` throws. `Gate`: `wrap(optsOrBody, body?, ...surplus)` validates (subject `crucible.gate options`; missing body, two bodies, surplus → `usage`), copies options, captures group settings via `GroupSettings.inherit` at call time; `declare(opts, body)` → `{ test, timeout }` where `test = (...args) => runner.execute((run) => body(new BoundAssertions(run, scoped), ...args), opts)` and `timeout = runner.ceilingFor(opts)`; `group(options, fn)` → `GroupSettings.declare`. No Jest imports in core.
- **Jest binding.** `JestBinding(gate, registrar, groupRegistrar)`: keeps the four-form normalization/validation and registers `gate.declare(...)`'s test with its computed timeout; `describe` via `gate.group`. All prior binding tests unchanged and green.
- **Internal rename.** `RunContext` (per-run record in `state.ts`) → `RunLedger`, freeing the name for the public type.
- **API.** `crucible.gate` overloads (generic `A extends unknown[] = []`: `(t: RunContext, ...args: A) => unknown` → `(...args: A) => Promise<void>`, so annotated row params type the returned function for `it.each`); public `RunContext`, `TestBody = (t: RunContext) => unknown`, `GateBody<A>`, `GatedTest<A>` in `src/api/run-context.ts` with JSDoc, exported from the entry point; `crucible.coherent/extract/facts` now go through the same `ScopedAssertions` as `t`.
- **Type tests.** `e2e/test/crucible-gate-typing.util.ts`: gate with/without options, `it.each` with annotated and unannotated rows, `it.only`, missing body / unknown option / row params on a plain `it` as `@ts-expect-error`, `crucible.it` body receiving `t`, zero-arg `TestBody`.
- **e2e.** `e2e/core/plain-runner-gate.test.ts` + `fixtures/plain-runner-gate.json`: plain Jest `it` + `crucible.gate` (coherent with `t.facts`), and `it.each` with typed row args (extract a count); runs 1 / threshold 1, Jest timeout 60 s. Not run live (3 judge calls).
- **Docs.** api.md (`crucible.gate()` and "The run context `t`" sections, six functions, types table, verdict error), README (`async (t) =>` facts example, "Use your runner's own `it`"), runs-and-threshold (Gate timeouts), gotchas (runner timeout must cover the gate's; `t` after lost async context), CHANGELOG Unreleased → Added. Usage message for calls outside a run names `crucible.gate` too.
- **Gate:** `npm run lint && npm run format:check && npm run typecheck && npm test && npm run build && npm run verify:pack && npx tsc --noEmit -p e2e` → exit 0 (800 tests, 28 suites). No live e2e/conformance run.

### File List

- CHANGELOG.md
- README.md
- docs/api.md
- docs/gotchas.md
- docs/runs-and-threshold.md
- e2e/core/plain-runner-gate.test.ts (new)
- e2e/core/fixtures/plain-runner-gate.json (new)
- e2e/test/crucible-gate-typing.util.ts (new)
- src/index.ts
- src/api/crucible.ts
- src/api/crucible-surface.ts
- src/api/crucible.test.ts
- src/api/run-context.ts (new)
- src/api/test/invalid-run-count.enum.ts (new)
- src/bindings/jest.ts
- src/bindings/jest.test.ts
- src/bindings/test/jest-harness.util.ts
- src/core/bound-assertions.ts (new)
- src/core/gate.ts (new)
- src/core/gate.test.ts (new)
- src/core/run-assertions.ts (new)
- src/core/run-handle.ts (new)
- src/core/scoped-assertions.ts (new)
- src/core/reporter.util.ts
- src/core/run-result.ts
- src/core/runner.ts
- src/core/state.ts
- src/core/test/detached-callbacks.fake.ts (new)
- src/core/test/extractor-harness.util.ts
- src/core/test/gate-harness.util.ts (new)
- src/core/test/invalid-gate-call.enum.ts (new)
- src/core/test/report-harness.util.ts
- src/core/test/row-value.enum.ts (new)
- src/core/test/run-context-call.enum.ts (new)
- _bmad-output/implementation-artifacts/7-1-gate-and-run-context.md (new)
- _bmad-output/implementation-artifacts/sprint-status.yaml

## Change Log

- 2026-11-14: Story 7.1 implemented — `crucible.gate()`, per-run context `t` (also for `crucible.it` bodies), `crucible.it` on the gate, types, e2e scenario, docs/CHANGELOG. Gate green (800 tests). Status → review.
- 2026-11-14: Code review — gate rejects a trailing argument after an empty slot and names two bodies; unannotated gate rows default to `unknown[]` (table-typed inside `it.each`); public type JSDoc; deprecated `load`/`append` share the assertions path; failed-run `t` lifetime test; CHANGELOG notes `TestBody` callers must pass `t`. Gate green (803 tests).
