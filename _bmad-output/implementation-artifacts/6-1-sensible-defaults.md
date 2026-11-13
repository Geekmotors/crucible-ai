---
baseline_commit: c5f654a
---

# Story 6.1: Sensible defaults with IDE hints

Status: done

## Story

As a developer writing my first Crucible test,
I want useful run and threshold defaults that my editor shows me,
so that a test with no options is already a meaningful reliability gate and I never have to look the defaults up.

Jack's decisions (2026-11-14), not to be re-litigated: built-in defaults become `runs: 10`, `threshold: 0.9`; precedence unchanged (built-in → config `testDefaults` → `crucible.it` options); `testTimeout` formula unchanged; JSDoc with `@default` on the public surface in `src/api/` only (the sole exception to "no code comments"); `crucible.it` typed as four overloads, runtime validation kept for JS callers; `CHANGELOG.md` shipped in the tarball.

## Acceptance Criteria

1. **New built-ins.** A `crucible.it()` with no `runs`/`threshold` and no `testDefaults` executes 10 runs and passes when at least 9 pass (`threshold` 0.9). Breaking, pre-1.0.
2. **Timeout formula unchanged.** Default `testTimeout` stays `30000 + 1000 × (runs − 1)` → 39000 for 10 runs.
3. **Precedence unchanged.** Per field: `crucible.it` option → `testDefaults` → built-in.
4. **IDE hints.** JSDoc on every `RunOptions` field (meaning + `@default`), and on `crucible.it`, `crucible.coherent`, `crucible.extract` (plus `load`/`append`, `ExtractOptions.as` where it helps).
5. **Overloads.** `crucible.it` has exactly four forms: `(name, body)`, `(name, body, timeout)`, `(name, options, body)`, `(name, options, body, timeout)`. `crucible.it(name, options)` is a type error (checked by a `// @ts-expect-error` in the e2e type-test project, compiled by `npx tsc --noEmit -p e2e`). Runtime `usage` validation stays.
6. **Docs.** README, docs/api.md, docs/runs-and-threshold.md, docs/getting-started.md, docs/configuration.md state the new defaults, the cost (10 judge calls per assertion and 10 runs of the system under test per unconfigured test) and how to get the old behaviour (`{ runs: 1, threshold: 1 }` per test or in `testDefaults`). docs/api.md no longer describes a single permissive signature.
7. **CHANGELOG.** `## Unreleased` with the breaking default change and the overloads; `CHANGELOG.md` included in the published package (`package.json` `files`, `scripts/verify-pack.mjs` allowed + required lists, RELEASING.md tarball list).
8. **e2e kept cheap.** e2e fixtures that relied on the old 1-run default and mean a single run declare `{ runs: 1 }` explicitly.

## Tasks / Subtasks

- [x] Task 1 (AC 1–3): TDD in `src/core/run-options-resolver.util.test.ts` — change the built-in expectations to 10 / 0.9 (red), then `DEFAULT_RUNS = 10`, `DEFAULT_THRESHOLD = 0.9` (green). Add test: built-in `testTimeout` for an unconfigured test is 39000. Fix any other unit test that leaned on the old built-in (pin its options explicitly instead of weakening it).
- [x] Task 2 (AC 4, 5): `src/api/` — JSDoc'd public `RunOptions` in `src/api/run-options.ts` (fields typed by indexed access on core's `RunOptions`, so core stays the single runtime source and never imports api); `CrucibleSurface` type in `src/api/crucible-surface.ts` with the four `it` overloads and JSDoc on every member; `crucible` annotated with it.
- [x] Task 3 (AC 5): e2e type check — new `e2e/test/crucible-it-typing.util.ts` (class, like `extract-result-typing.util.ts`) with the four accepted forms and `// @ts-expect-error` on the body-less form.
- [x] Task 4 (AC 8): pin `debug-trace` and `openai-compatible` fixture scenarios to one run via a `runs` field in their `scenario.json` (fixtures are separate projects; no magic literal in the `.ts`).
- [x] Task 5 (AC 6): docs.
- [x] Task 6 (AC 7): CHANGELOG, package.json `files`, verify-pack, RELEASING.md.
- [x] Task 7: full gate `npm run lint && npm run format:check && npm run typecheck && npm test && npm run build && npm run verify:pack && npx tsc --noEmit -p e2e`.

### Review Findings

Code review 2026-11-14 (Blind Hunter, Edge Case Hunter, Acceptance Auditor).

- [ ] [Review][Decision] Union forwarding rejected by overloads — a wrapper passing `optsOrBody: RunOptions | TestBody` (the 0.3 signature) no longer compiles; runtime accepts it. Options: keep four overloads (AC5 "exactly four"; now called out in CHANGELOG) or add a fifth permissive overload.
- [ ] [Review][Decision] Trailing timeout plus `options.testTimeout` type-checks but throws `usage` — overload 4 could take `RunOptions & { testTimeout?: undefined }`, which would also reject any `RunOptions`-typed variable. Currently documented as a registration-time check.
- [ ] [Review][Decision] Overload type tests run only in the main-only e2e lane — `npx tsc --noEmit -p e2e` sits behind `make e2e-build` (needs the judge key); needs only `npm run build`, so it could join the PR `lint-typecheck-unit` job (CI yaml change). Same gap for `extract-result-typing.util.ts`.
- [ ] [Review][Decision] `ExtractOptions.as` has no `@default` hover — needs an api-level JSDoc'd `ExtractOptions` like `RunOptions` (AC4 "where it helps"); `extract`'s `@param` already states the default.
- [x] [Review][Patch] Trailing `timeout` of `undefined` (forwarded optional timeout) rejected by types but valid at runtime [src/api/crucible-surface.ts] — now `number | undefined`; type test added
- [x] [Review][Patch] `it(name, body)` / `it(name, body, timeout)` JSDoc stated 10/9 as fact, ignoring `testDefaults` [src/api/crucible-surface.ts]
- [x] [Review][Patch] Annotating `crucible` as `CrucibleSurface` dropped `Object.freeze`'s readonly typing [src/api/crucible.ts] — `Readonly<CrucibleSurface>`; type test added
- [x] [Review][Patch] CHANGELOG missed partial declarations (`{ runs: 20 }` now needs 18; `{ threshold: 1 }` now 10 runs), rate limits, and the optional-timeout / union-forwarding type changes [CHANGELOG.md]
- [x] [Review][Patch] 0.9 needs every run below 10 runs — undocumented [src/api/run-options.ts, docs/runs-and-threshold.md]
- [x] [Review][Patch] Docs claimed types and runtime do "the same checks" — types check shape only [docs/api.md, docs/runs-and-threshold.md]
- [x] [Review][Patch] docs/README.md still said "first smoke test → multi-run gate" [docs/README.md:8]
- [x] [Review][Patch] configuration.md lacked cost and 39 s figures (AC6) [docs/configuration.md]
- [x] [Review][Patch] "as up to 0.3" ambiguous [README.md, docs/getting-started.md, docs/runs-and-threshold.md]
- [x] [Review][Patch] Runner tests silently went from 1 to 10 runs (`rejection`, `judgedExpiry`, short-test-timeout table) [src/core/test/runner-harness.util.ts, src/core/runner.test.ts] — pinned `runs: RunCount.Single`
- [x] [Review][Patch] e2e fixtures relied on `ceil(0.9 × 1)`; now declare `threshold: 1` too [e2e/ext/fixtures/projects/*/scenario.json]
- [x] [Review][Patch] Typing util literals → `Gate.Smoke` [e2e/test/crucible-it-typing.util.ts]
- [x] [Review][Defer] Nothing enforces renaming `## Unreleased` before release [scripts/verify-pack.mjs] — deferred
- [x] [Review][Defer] `Parameters<typeof crucible.it>` sees only the last overload; `CrucibleSurface` not exported [src/api/crucible-surface.ts] — deferred
- [x] [Review][Defer] Public `RunOptions` mirrors core by hand; a new core field would not appear publicly [src/api/run-options.ts] — deferred
- [x] [Review][Defer] No live e2e exercises the 10-run default; failure-report fixtures rely on their `testDefaults` — deferred (live cost)

## Dev Notes

### Current state (read before touching)

- `src/core/run-options-resolver.util.ts` — `RunOptionsResolver` with `private static readonly DEFAULT_RUNS = 1; DEFAULT_THRESHOLD = 1`; `resolve(opts, defaults)` per-field `opts ?? defaults ?? built-in`; `testTimeout` built-in from `TimeBudget.testTimeoutFor(runs)` (resolved runs). Only these two constants change.
- `src/core/run-options.ts` — `RunOptions`, `RunGate`, `ResolvedRunOptions` types (runner-neutral). Config `testDefaults` is validated against the same keys by `RunOptionsValidator`.
- `src/bindings/jest.ts` — `JestBinding.register(name, optsOrBody, bodyOrTimeout?, timeout?)` normalizes the four forms and throws `usage` for bad shapes (missing body, two bodies, surplus arg, both timeouts). This is the Jest layer; keep runtime checks unchanged.
- `src/api/crucible.ts` — `crucible` is `Object.freeze({ it(...), coherent, extract, load, append })` with the single permissive `it` signature. Public types re-exported from here; `src/index.ts` re-exports only from `src/api/`.
- `src/core/reporter.util.ts` — `SMOKE_RUNS = 1` / "the smoke run (runs: 1)" wording is about a declared 1-run test; unaffected by defaults.
- `src/core/trace-reporter.ts` prints resolved runs/threshold; no default literal there.

### Design

- Overloads: a `CrucibleSurface` type in `src/api/` declares `it` as four method overloads (plus `coherent`, `extract`, `load`, `append`); `const crucible: CrucibleSurface = Object.freeze({...})`. The single permissive implementation is assignable to every overload, so no cast. Public `TestBody` stays the binding's type.
- JSDoc: allowed only in `src/api/` (Jack's exception). Core can't import api, so the public, JSDoc'd `RunOptions` lives in `src/api/run-options.ts` with each field typed `CoreRunOptions['field']`; core's `RunOptions` stays the runtime type. Hover over `crucible.it(name, { runs })` shows the api docs.
- Default constants are runner-neutral (core); nothing Jest-specific added to settings code.

### Must preserve

- Runtime `usage` errors for every bad call shape (JS callers).
- testTimeout formula; `testDefaults` precedence; reporter "smoke" wording for declared `runs: 1`.
- CLAUDE.md test rules: enums for literals (`RunCount`, `Threshold` gain the new built-ins), outcome assertions only, error kind not message.

### Cost note for docs

Unconfigured test = 10 executions of the body (10 runs of the system under test) and 10 judge calls per `coherent`/`extract` assertion; testTimeout 39 s.

### e2e impact

- `debug-trace` and `openai-compatible` fixture scenarios used the old default (1 run): pin to 1 run (intent: one traced call / one provider check).
- `failure-report` uses `testDefaults` (2 runs) — unaffected. `core/*`, `ext/*conformance*`, `knowledge-boundary` declare runs explicitly — unaffected.

### References

- [Source: _bmad-output/planning-artifacts/epics.md#Epic 6, Story 6.1]
- [Source: _bmad-output/implementation-artifacts/5-2-judge-key-source.md]
- [Source: _bmad-output/implementation-artifacts/4-1-tune-timeouts-per-test.md]
- [Source: CLAUDE.md]

## Dev Agent Record

### Agent Model Used

Claude Opus 5.5 (claude-opus-5-5)

### Debug Log References

### Completion Notes List

- Ultimate context engine analysis completed - comprehensive developer guide created
- **TDD.** Resolver tests changed to the new built-ins first (5 red), then `DEFAULT_RUNS = 10`, `DEFAULT_THRESHOLD = 0.9` (green). New test: unconfigured `testTimeout` is 39000. Type test `e2e/test/crucible-it-typing.util.ts` written first: `tsc -p e2e` failed with 2 unused `@ts-expect-error` (options-only, two bodies) before the overloads, passes after.
- **Tests that leaned on the old built-in** (pinned, not weakened): runner "smoke mode" now declares `runs: 1` and a new runner test asserts 10 executions with no options; the two "outlast 30 s under a longer test timeout" cases and `RunnerHarness.tracedExpiryOutput` declare `runs: 1`; binding test now asserts an unconfigured test runs the body 10 times. New enum members `RunCount.BuiltIn`, `Threshold.BuiltIn`, `TimeoutBudget.BuiltInTestMs`. Unit tests 555 → 556 (one renamed, two added, one runner case split).
- **Overloads + JSDoc** in `src/api/crucible-surface.ts` and `src/api/run-options.ts`; JSDoc (with `@default`) survives into `dist/index.d.ts`/`.d.cts`. Runtime `usage` validation in `JestBinding` unchanged.
- **e2e pinned to 1 run:** `debug-trace` and `openai-compatible` fixture scenarios (both are single-call provider/trace checks that relied on the old default). Others already declare runs or use `testDefaults` (`failure-report`: 2). Not run live.
- **Docs:** README, api.md (single permissive signature paragraph replaced), runs-and-threshold.md (signature, options table, smoke mode → opt-in, precedence, timeout, cost), getting-started.md (step 5 "Write a first test", step 6 "Tune the gate"; anchors updated), configuration.md (`testDefaults` row), gotchas.md (re-entrancy + deadline). CHANGELOG `## Unreleased`; `CHANGELOG.md` in `files`, verify-pack allowed+required, RELEASING tarball list + rename-Unreleased step.
- **Not mine:** working tree also has uncommitted pass^k wording edits (docs/inspiration.md, docs/judge-models.md, 3-1 story, PRD files) that appeared during this session — left untouched.
- **Gate:** `npm run lint && npm run format:check && npm run typecheck && npm test && npm run build && npm run verify:pack && npx tsc --noEmit -p e2e` → exit 0 (556 tests, 20 suites; tarball 10 files incl. CHANGELOG.md).

### File List

- CHANGELOG.md
- README.md
- RELEASING.md
- package.json
- scripts/verify-pack.mjs
- docs/api.md
- docs/configuration.md
- docs/getting-started.md
- docs/gotchas.md
- docs/README.md
- docs/runs-and-threshold.md
- e2e/test/crucible-it-typing.util.ts (new)
- e2e/ext/fixtures/projects/debug-trace/debug-trace.scenario.ts
- e2e/ext/fixtures/projects/debug-trace/scenario.json
- e2e/ext/fixtures/projects/openai-compatible/openai-compatible.scenario.ts
- e2e/ext/fixtures/projects/openai-compatible/scenario.json
- src/api/crucible.ts
- src/api/crucible-surface.ts (new)
- src/api/run-options.ts (new)
- src/bindings/jest.test.ts
- src/core/run-options-resolver.util.ts
- src/core/run-options-resolver.util.test.ts
- src/core/runner.test.ts
- src/core/test/run-count.enum.ts
- src/core/test/runner-harness.util.ts
- src/core/test/threshold.enum.ts
- src/core/test/timeout-budget.enum.ts
- _bmad-output/implementation-artifacts/6-1-sensible-defaults.md (new)
- _bmad-output/implementation-artifacts/sprint-status.yaml

## Change Log

- 2026-11-14: Code review — 12 patches applied (see Review Findings), 4 decisions open, 4 deferred.
- 2026-11-14: Story 6.1 implemented — built-ins 10 runs / 0.9, `crucible.it` overloads, public-API JSDoc, docs, CHANGELOG shipped.
