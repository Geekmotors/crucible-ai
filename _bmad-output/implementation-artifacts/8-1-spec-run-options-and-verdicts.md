---
baseline_commit: 5bf317c6916c1103d9c02e72cb824e1dafb28930
---

# Story 8.1: Fixture format, runner and the first area — run options and verdicts

Status: done

## Story

As a maintainer porting Crucible to another language,
I want the rules for resolving and validating run options and for computing verdicts written as shared fixtures,
so that a port proves it matches by running the same cases.

## Acceptance Criteria

1. **Spec folder.** `spec/` at the repository root holds `README.md` (purpose, fixture format, special values, how a port implements a runner, the contract of every operation, versioning), `fixture.schema.json` (JSON Schema draft-07 for fixture files) and fixture files grouped by area (`spec/run-options/*.json`, `spec/verdict/*.json`).
2. **Fixture format.** A file is `{ "area", "operation", "description", "cases": [...] }`. A case is `{ "id", "description", "input", "expect" }`; ids are unique across the spec, stable and kebab-case. `expect` holds exactly one outcome: `{ "value": ... }`, `{ "text": "..." }` or `{ "error": { "kind": "usage" | "config" | "infra", "retryable"?: boolean } }` — never message text, never internal structure. Inputs are neutral JSON; values JSON cannot hold use a minimal tagged vocabulary `{ "$special": "NaN" | "Infinity" | "-Infinity" | "undefined" }` documented in the README.
3. **Run options area.** Fixtures cover precedence (built-in → config `testDefaults` → outer → inner group → test → call), per-field merging, the default `testTimeout` formula (30 000 ms + 1 000 ms per extra run, capped at 2 147 483 647) and the nearest-declared rule, `strict` (including the per-call extract override), and every validation rule with its error kind (`usage` for test and group options, `config` for `testDefaults`).
4. **Verdict area.** Fixtures cover run statuses → outcome (passed / failed / errored), the three-zone verdict, discarded runs, required pass counts (`need = max(1, ceil(threshold × runs − 1e-9))`) and rounding (e.g. 0.9 of fewer than 10 runs, float products just above an integer).
5. **TypeScript runner.** One fixture test file per area beside the code it drives, loading fixtures with JSON module imports (`with { type: 'json' }`) — no runtime fs reads. A test validates every fixture file against `spec/fixture.schema.json` with a small in-house checker (no new dependencies). All fixtures run in `npm test`.
6. **Shed duplicates.** Unit tests whose cases are fully covered by fixtures are removed; tests of things fixtures cannot express (wiring, scoping, async callbacks, deferred runners, copy semantics) stay. Before/after line counts recorded.
7. **Packaging and docs.** `spec/` is not in the npm tarball (`verify:pack` unchanged and passing). README Documentation list points to `spec/README.md`. No `src/` behaviour change; a fixture that exposes a bug is reported, not silently fixed.
8. **Gate.** `npm run lint && npm run format:check && npm run typecheck && npm test && npm run build && npm run verify:pack && npx tsc --noEmit -p e2e` passes.

## Tasks / Subtasks

- [x] `spec/fixture.schema.json` + in-house schema checker (test util) + schema test over every fixture file (AC 1, 2, 5)
- [x] Special-value decoder (test util) (AC 2)
- [x] `spec/run-options/resolve.json` from resolver, group-settings, time-budget and extractor-strict tests + gaps (AC 3)
- [x] `spec/run-options/validate.json` from resolver, config testDefaults, declaration-forms group options and time-budget validity tests, for every source (AC 3)
- [x] `spec/verdict/compute.json` from aggregator tests + gaps (AC 4)
- [x] TS runners: `src/core/run-options.spec-fixtures.test.ts`, `src/core/aggregator.util.spec-fixtures.test.ts`, harnesses in `src/core/test/` (AC 5)
- [x] Remove duplicated unit tests; record line counts (AC 6)
- [x] `spec/README.md`, README pointer (AC 1, 7)
- [x] Gate (AC 8)

## Dev Notes

### Current state (read before touching)

- `RunOptionsResolver.resolve(opts, defaults)` (`src/core/run-options-resolver.util.ts`) validates `opts` (usage) then picks each field `opts ?? defaults ?? built-in`; `testTimeout` falls back to `TimeBudget.testTimeoutFor(resolvedRuns)` — so the formula uses the resolved runs, and any declared `testTimeout` (nearest wins) beats it.
- `GroupSettings.inherit(own)` (`group-settings.ts`) overlays group layers outer → inner then the test's own options, skipping keys whose value is `undefined`. Without a group path it uses a stack pushed by `declare(...)()`.
- `RunOptionsValidator.violation` (`run-options-validator.util.ts`): non-object/null/array → violation; unknown key; `runs` integer ≥ 1; `threshold` number in (0, 1]; `inferenceTimeout`/`testTimeout` integer 1..2147483647 (`TimeBudget.isValidTimeout`); `strict` boolean. Callers pick the kind: `DeclarationForms` (test/gate/group) and `RunOptionsResolver` → `usage`; `ConfigStore.requireTestDefaults` → `config` (absent → `{}`).
- Per-call strict: `Extractor.extract` uses `options.strict ?? scope.strict()`; the run scope's strict is the resolved `strict`.
- `Aggregator.tally(statuses, { runs, threshold })` → `{ zone: 'pass'|'fail'|'errored', need, passed, failed, errored }`; the runner maps `fail` → `failed`, `errored` → `errored` (`CrucibleVerdictError.outcome`), `pass` → no error. `discarded` counts toward `runs` only.

### Operations (TS mapping for the runner)

- `run-options/resolve`: layers `{ testDefaults?, groups?: [outer..inner], test?, call? }` → `{ runs, threshold, inferenceTimeout, testTimeout, strict }`; with `call`, `strict` is the call's effective mode. TS: nest `GroupSettings.declare(...)()` per group, `RunOptionsResolver.resolve(groups.inherit(test), testDefaults)`; call layer through `Extractor` with `ModeAwareJudge` and the recorded extraction mode.
- `run-options/validate`: `{ source: 'test'|'group'|'config', options }` → accepted options (value) or error kind. TS: `DeclarationForms.test` / `DeclarationForms.group` / `ConfigStore` via `ConfigHarness.store`.
- `verdict/compute`: `{ threshold, statuses: [...] }` (runs = list length) → `{ outcome, need, passed, failed, errored }`.

### Must preserve

- Unit tests for: group scoping (sibling/after-group), error propagation, settings cleanup on throw, options copied at declaration, row args, async/thenable/value-returning callbacks, deferred-collection runners, lost group path, declaration argument shapes, one validation wiring case per entry point, mode → extracted value behaviour, schema-defaults agreement in `config.test.ts`.

### Testing

- CLAUDE.md test rules apply in full: harness classes in `src/core/test/*-harness.util.ts`, utils `.util.ts`, enums `.enum.ts`, no loose functions, no `readonly` in test helpers, `type` not `interface`, named exports at end, no comments, assert outcomes only (error kind, never message).
- JSON imports already work in Jest/ts (`config-schema-harness.util.ts` imports `schemas/crucible.config.schema.json`); `resolveJsonModule` is on.
- Prettier checks `spec/**/*.json` (not `*.md`).

### References

- [Source: _bmad-output/planning-artifacts/epics.md#Epic 8, Story 8.1]
- [Source: docs/runs-and-threshold.md] (verdict zones, timeouts, group precedence)
- [Source: CLAUDE.md] (test and code rules)

## Dev Agent Record

### Agent Model Used

Claude Opus 5.5 (claude-opus-5-5)

### Debug Log References

- Baseline `npm test`: 32 suites, 955 tests. After: 33 suites, 1026 tests (199 fixture cases + 13 schema/id tests added; duplicated unit cases removed).
- Runner sanity: flipping the expected `strict` of the 5 call cases and every expected error kind made exactly those 116 cases fail; restored files pass.

### Completion Notes List

- Fixture format as specified, plus a top-level `operation` field (an area has more than one operation: `run-options` has `resolve` and `validate`).
- Operations: `run-options/resolve` (36 cases), `run-options/validate` (142 cases: 10 valid + 37 invalid rules for `test` and `group`, the same minus the 6 NaN/Infinity rules for `config`, plus one absent-options case per source), `verdict/compute` (21 cases).
- "call" layer = the per-call `strict` of `crucible.extract`; the TS runner drives it through `Extractor` with `ModeAwareJudge` and reads the recorded extraction mode.
- Schema validation: in-house `SchemaCheck` (draft-07 subset: `$ref` to definitions, `type`, `required`, `properties`, `additionalProperties: false`, `items`, `minItems`, `minLength`, `pattern`, `enum`, `oneOf`; throws on any unsupported keyword). No new dependencies.
- Removed duplicates: `aggregator.util.test.ts`, `time-budget.util.test.ts`, `status-mix.util.ts` deleted; resolver test reduced to the resolve-refuses-invalid wiring case; group-settings inheritance/timeout cases, config `testDefaults` describe, declaration-forms group-options table and the two option-validation rows of `invalidTests`, and 4 extractor strict-precedence tests removed; unused enum members dropped.
- Line counts (touched unit test files): resolver 167→14, aggregator 88→0, time-budget 44→0, group-settings 320→168, config 520→444, declaration-forms 86→75, extractor 297→273 (1522→974, −548); helpers −39. Added: 53 lines of runner tests, 459 lines of harness/util/enum, 1890 lines of fixture JSON + schema, 226-line `spec/README.md`.
- Dropped without fixture equivalent: `TimeBudget` "never shrinks as runs grow" property (formula fully pinned by fixture points).
- No `src/` change; no bug found.
- Code review (2026-11-14): verdict input became per-status counts (`{ "passed": 7, "failed": 13 }`) so fixtures stay one line each (compute.json 366→237 lines with 28 cases); error outcome schema split per kind (`retryable` required for `infra`, forbidden otherwise); README contracts tightened (need evaluation order/no FMA, 64-bit formula arithmetic, integer/boolean, unset unknown keys, `$special` reserved, out-of-contract input, `call` shape); added -Infinity, boolean, threshold just above 1, empty-array, unset-field and unset-unknown-key validate cases, two resolve undefined cases, and verdict cases for threshold 1, epsilon other side, all discarded, 1e6 runs, 0.07×100 (restored); restored 2 extractor value tests (run strict/lenient → extracted value); 8 more malformed-schema cases; SchemaCheck refuses unsupported forms. Ids now carry an `<area>-<operation>-` prefix, checked by the runner; README states ports accept `runs` up to at least 2147483647 and leaves behaviour above 2^53 unspecified; per-operation input schemas deferred to 8.2. Fixtures: resolve 38, validate 172, compute 28. `npm test`: 33 suites, 1075 tests.

### File List

- spec/README.md (new)
- spec/fixture.schema.json (new)
- spec/run-options/resolve.json (new)
- spec/run-options/validate.json (new)
- spec/verdict/compute.json (new)
- src/core/run-options.spec-fixtures.test.ts (new)
- src/core/aggregator.util.spec-fixtures.test.ts (new)
- src/core/spec-fixtures.test.ts (new)
- src/core/test/spec-fixtures.util.ts (new)
- src/core/test/schema-check.util.ts (new)
- src/core/test/special-value.util.ts (new)
- src/core/test/special-token.enum.ts (new)
- src/core/test/fixture-outcome.util.ts (new)
- src/core/test/run-options-fixture-harness.util.ts (new)
- src/core/test/verdict-fixture-harness.util.ts (new)
- src/core/test/malformed-fixture.util.ts (new)
- src/core/test/malformed-fixture-name.enum.ts (new)
- src/core/aggregator.util.test.ts (deleted)
- src/core/time-budget.util.test.ts (deleted)
- src/core/test/status-mix.util.ts (deleted)
- src/core/run-options-resolver.util.test.ts
- src/core/group-settings.test.ts
- src/core/config.test.ts
- src/core/declaration-forms.util.test.ts
- src/core/extractor.test.ts
- src/core/test/declaration-forms-harness.util.ts
- src/core/test/invalid-declaration.enum.ts
- src/core/test/invalid-test-default.enum.ts
- src/core/test/threshold.enum.ts
- src/core/test/timeout-budget.enum.ts
- README.md
- _bmad-output/implementation-artifacts/sprint-status.yaml

## Change Log

- 2026-11-14: Code review fixes applied (see Completion Notes).
- 2026-11-14: Story 8.1 implemented — `spec/` with fixture format, schema, run-options and verdict fixtures; TS fixture runners; duplicated unit tests removed. Status → review.
