---
baseline_commit: dbeeb5d
---

# Story 2.2: Arrange state per run

Status: review

## Story

As a developer,
I want `crucible.load()` and `crucible.append()` to scope state to the current run,
so that assertions are judged against the state each run actually arranged — even with 20 runs in flight.

## Acceptance Criteria

1. **Per-run state reaches the judge.** Given a body calling `crucible.load("Bob is at the casino; Jane is at home")` then `crucible.coherent(...)`, every judge call in that run assembles its payload from that run's accumulated state. [FR3, AD-5, AD-7]
2. **Concurrent runs never observe each other's state.** Proven by a unit test that interleaves runs writing distinct state (runs park on a `StartGate` after arranging, so all writes land before any read). No timers, no clocks. [FR3, AD-5]
3. **Append accumulates.** `crucible.append()` after an act adds to the run's state; every subsequent judge call in the same run sees the accumulated state (loaded + appended, in call order). Verdicts already returned are unaffected — both the resolved boolean and the recorded `VerdictRecord`. [FR4]
4. **Input contract.** `load` and `append` accept `string | string[]`. Hand-authored and SUT-harvested strings are treated identically (stored verbatim, no parsing, trimming, or splitting). Any other input (number, `undefined`, `null`, object, an array containing a non-string) is rejected with `CrucibleError` kind `usage`, and the run's state is left unchanged (no partial append). [FR3]
5. **Outside a run scope fails fast.** Calling `load` or `append` outside a running `crucible.it` body throws `CrucibleError` kind `usage`. [AD-5]
6. **Stateless mode.** With no state loaded (or only empty arrays loaded), the judge payload contains no `STATE` section. [FR5, schemas/coherent.md]
7. **Surface.** `crucible.load` and `crucible.append` exist on the frozen `crucible` namespace; the Story-2.1 placeholder `load` usage throw is removed. Import stays inert (no config load, no Jest global access). [AR, AD-9]
8. **Full suite stays green.** `npm run lint && npm run format:check && npm run typecheck && npm test && npm run build` pass; zero network, zero real timers; `grep -rn 'console\.' src --include='*.ts'` empty.

## Tasks / Subtasks

TDD for every task: failing test first, then make it pass, then refactor.

- [x] **Task 1 — `RunScope.appendState` in core/state** (AC: 2, 3, 4, 5)
  - [x] 1.1 Red tests in `src/core/state.test.ts`:
    - a string is appended verbatim; an array appends each element in order; successive calls accumulate in call order;
    - empty array is a no-op (state stays `[]`); empty string is stored verbatim (state is not interpreted);
    - non-string inputs (`it.each` table: number, `undefined`, `null`, object, array containing a number) → `usage`, and state unchanged afterwards;
    - outside a run scope → `usage`;
    - interleaved isolation: N runs each append a distinct fact, `await gate.arrive()`, then read `scope.context().state` → each run sees exactly its own fact.
  - [x] 1.2 Implement `appendState(entries: unknown): void` on `RunScope`. Validate the whole input before mutating (no partial append). Resolve the store first, so outside-scope is reported even with valid input.
- [x] **Task 2 — Judge judges against run state** (AC: 1, 2, 3, 6)
  - [x] 2.1 Add fake `src/core/test/fact-aware-adapter.fake.ts` (class `FactAwareAdapter`): a simulated judge that replies `{"verdict": true}` iff the completion prompt mentions the fact it was built with, else `false`. Assertions stay on outcomes (the resolved verdict), not on captured requests.
  - [x] 2.2 Red tests in `src/core/judge.test.ts`:
    - loaded fact → verdict true; no state → false (stateless judge does not see the fact);
    - append-after-act: first judgment false; `appendState(fact)`; second judgment true; first returned boolean and first `VerdictRecord` unchanged;
    - interleaved isolation through the judge: N runs gated by `StartGate`, run 0 loads the recognised fact, the others load distinct facts; only run 0 judges true.
  - [x] 2.3 The judge already reads `scope.context().state` and assembles the payload synchronously before the first `await`, so the payload is a string snapshot — later appends cannot reach an in-flight or resolved call. Expect these tests to pass with no `judge.ts` change; if any is green on first run, record it (it locks existing behaviour in place for FR4).
- [x] **Task 3 — Public surface** (AC: 7)
  - [x] 3.1 `src/api/crucible.ts`: replace the `load(): never` placeholder with `load(state: string | string[]): void` and `append(state: string | string[]): void`, both delegating to `runScope.appendState(state)`. Remove the now-unused `CrucibleError` import only if unused (it is still re-exported — keep it).
  - [x] 3.2 No wiring test (CLAUDE.md forbids testing module wiring); behaviour is covered at `RunScope`/`Judge`.
- [x] **Task 4 — Verify** (AC: 8): run the full command chain and the `console.` grep.

## Dev Notes

### Decision: `load` and `append` are the same operation (both append)

- Spine AD-5 / Consistency table: "User state = `string[]` field of `RunContext`, **append-only within a run**". A replacing `load` would violate that invariant.
- PRD FR3 frames `load` as the *arrange* verb and FR4 frames `append` as the *after-act* verb; the difference is intent/readability, not semantics. Every run starts with fresh empty state (`enterRun`), so "load" at arrange time on an empty run is indistinguishable from append.
- Consequence: calling `load` twice accumulates. Calling `load` after an act behaves like `append`. Documented here; Story 3.6 docs should present `load` = arrange, `append` = after act.
- Not done: ordering enforcement (e.g. "load after append is an error"). It adds a state machine for no observable benefit and the PRD does not ask for it.

### Decision: input validation

- Accept `string` or `string[]` only. Anything else → `usage`. Reject the whole call when any array element is not a string (atomic: no partial append).
- Strings stored verbatim: no trim, no split on `;`/newline, no empty-string filtering. Crucible does not interpret state (PRD §4.2; schema: "exactly as supplied"). An empty string therefore produces a `STATE` section with a blank line; an empty array appends nothing.
- No size cap (PRD review L-3: large state is provider-error passthrough; out of scope).

### Decision: snapshot semantics

- `Judge.judgeCoherent` computes `prompt` via `PayloadAssembler.assemble(state, …)` synchronously before any `await`; the payload is an immutable string. So an `append` racing an in-flight call never alters it, and resolved verdicts are unaffected. `VerdictRecord` does not hold state.
- `RunContext.state` stays the live `string[]` (spine shape). The reporter does not render state today (Story 3.1 may).

### Current state of files this story touches (read before editing)

- **`src/core/state.ts`** — `RunScope` owns the single ALS (`enterRun`, `context`, `recordVerdict`, `recordError`, private `store()` throwing `usage` outside a scope). `enterRun` creates fresh `{state: [], verdicts: [], errors: []}` per call. Preserve all; add `appendState`.
- **`src/core/judge.ts`** — reads `this.scope.context().state`, assembles via `PayloadAssembler`, records verdict/error. No change expected.
- **`src/core/payload-assembler.util.ts`** — already omits `STATE` when `state.length === 0` (tested). No change.
- **`src/api/crucible.ts`** — frozen `crucible` with `it`, `coherent`, and `load(): never` placeholder throwing `usage` "coming in Story 2.2". Replace the placeholder; keep lazy `CompositionRoot` and inertness.
- **`src/core/test/start-gate.util.ts`** — `StartGate(expected).arrive()` resolves once all expected arrivals happen; reuse for interleaving.
- **`src/core/test/scripted-adapter.fake.ts`, `judge-harness.util.ts`** — `JudgeHarness.judge(adapter, scope)` builds a Judge with a no-sleep retrier; reuse with the new fake (widen its parameter type to `ProviderAdapter` if needed).

### Architecture compliance

- **AD-5:** one ALS, in `core/state`; `crucible.load/append` reach the context only through `RunScope` accessors; no context handle passed to user code.
- **AD-7 / schema:** payload order STATE → RESPONSE → CLAIM, STATE omitted when empty — already implemented; do not touch.
- **AD-2:** api → core only; core imports no binding.
- Terminology: "state" only — never "world state"/"chat history" in code or names.

### Out of scope

| Out of scope | Belongs to |
| --- | --- |
| Rendering state in failure reports | Story 3.1 |
| State size limits / truncation | Accepted limitation (PRD review L-3) |
| Docs for load-vs-append, `beforeEach` arrange gotcha | Story 3.6 |
| Sibling abort / discarded runs | Story 2.3 |
| Typed state, custom parsing | Post-MVP non-goal |

### Testing standards (CLAUDE.md — binding)

- Colocated tests; fakes one per file under `src/core/test/*.fake.ts`; helpers in classes; no `readonly` in test helpers; no loose functions.
- Assert outcomes and error **kind** only, never message text; no call counters; no captured-request inspection.
- No magic values: repeated facts/run counts go in an enum file (e.g. `src/core/test/state-fact.enum.ts`); reuse `RunCount`.
- No comments, `type` over `interface`, named exports at the end, one class per file.

### Previous story intelligence (2.1)

- `StartGate` is the timer-free concurrency proof; reuse it.
- Reviewers enforce test constants in enums with correct meaning (2.1 review flagged misused enum members), explicit return types on harness methods, `unknown`-typed validation inputs with `asserts` where useful.
- `@typescript-eslint/no-duplicate-enum-values` forbids duplicate values in one enum.
- Prettier pre-commit; 2-space.

### Library / framework

No new dependencies. Jest 30 ESM via ts-jest, `@jest/globals` imports. No web research needed.

### References

- [Source: _bmad-output/planning-artifacts/epics.md#Story 2.2]
- [Source: _bmad-output/planning-artifacts/architecture/architecture-crucible-ai-2026-08-10/ARCHITECTURE-SPINE.md#AD-5, #AD-7, Consistency table]
- [Source: _bmad-output/planning-artifacts/prds/prd-crucible-ai-2026-08-10/prd.md#FR-3, #FR-4, #FR-5]
- [Source: schemas/coherent.md#Payload assembly]
- [Source: _bmad-output/implementation-artifacts/2-1-repeat-and-gate-on-pass-rate.md]
- [Source: CLAUDE.md]

## Dev Agent Record

### Agent Model Used

Claude Opus 5.5 (claude-opus-5-5) via bmad-dev-story (unattended)
### Debug Log References

### Completion Notes List

- Ultimate context engine analysis completed - comprehensive developer guide created.
- Task 1 red→green: 11 new `RunScope` tests (verbatim string, array accumulation in call order, empty array no-op, empty string verbatim, 5-row non-string `usage` table with state unchanged, outside-scope `usage`, 20-run `StartGate` interleave). Implemented `RunScope.appendState(entries: unknown)`: resolves the store first (outside-scope wins), validates the whole input before mutating (atomic), stores verbatim. Refactor: push in a loop instead of `push(...entries)` so very large SUT-harvested arrays cannot hit the spread argument limit.
- Task 2: 4 new `Judge` tests using the new `FactAwareAdapter` fake (a simulated judge whose verdict is true iff the prompt mentions its fact; tests assert only the resolved verdict). As predicted in Task 2.3 they were green once `appendState` existed — `judge.ts` already reads run state and assembles the payload synchronously before any `await`. To prove they discriminate, a temporary mutation (judge assembling with `[]`) made 3 of the 4 fail; reverted. `judge.ts` unchanged.
- Task 3: `crucible.load(state)` and `crucible.append(state)` both delegate to `runScope.appendState`; placeholder `load` throw removed. `CrucibleError` import stays (re-exported). No wiring test (CLAUDE.md).
- Decisions (unattended, see Dev Notes): `load` ≡ `append` (spine: state append-only within a run; each run starts empty, so arrange-time load = append); `string | string[]` only, any non-string (incl. inside an array) → `usage`, atomic; strings verbatim, empty string kept, empty array no-op → stateless payload; no size cap; no load/append ordering enforcement.
- `JudgeHarness.judge` parameter widened from `ScriptedAdapter` to `ProviderAdapter` so it accepts the new fake.
- Interleaved-run facts are `run <i> fact` (no fact is a substring of another, e.g. run 1 vs run 10), generated by `StateIsolationHarness.facts`.
- Suite 195 → 210 tests / 14 suites; lint, format:check, typecheck, test, build green; no `console.` in `src/`.
- sprint-status left at `ready-for-dev` per orchestrator instruction (only the ready-for-dev update was permitted).
- Forward notes: Story 3.6 docs should present `load` = arrange / `append` = after act, and warn that arranging in `beforeEach` runs once per test, not per run (PRD review H-2). Story 3.1 may render run state in failure reports.

### File List

New:
- src/core/test/fact-aware-adapter.fake.ts
- src/core/test/state-fact.enum.ts
- src/core/test/state-isolation-harness.util.ts
- _bmad-output/implementation-artifacts/2-2-arrange-state-per-run.md

Modified:
- src/core/state.ts
- src/core/state.test.ts
- src/core/judge.test.ts
- src/core/test/judge-harness.util.ts
- src/api/crucible.ts
- _bmad-output/implementation-artifacts/sprint-status.yaml

### Change Log

- 2026-11-13: Story 2.2 implemented — `crucible.load`/`crucible.append` append per-run state through `RunScope.appendState`; judge payload carries the run's accumulated state; stateless mode unchanged.
