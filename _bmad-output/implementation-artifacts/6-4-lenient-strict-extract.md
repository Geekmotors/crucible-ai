---
baseline_commit: c2e8a5f
---

# Story 6.4: Lenient extraction by default, strict on request

Status: done

## Story

As a developer asserting values in loosely worded LLM replies,
I want extraction to take the value a reply leans to unless I ask for strictness,
so that "I think so" counts as yes while I can still demand a firm commitment where it matters.

Jack's decisions (2026-11-14), not to be re-litigated:

- `strict: boolean`, default `false` (lenient). One flat setting that applies to every assertion that supports it (today only `extract`). Resolution last-wins: built-in `false` → config `testDefaults.strict` → outer `crucible.describe` → inner → `crucible.it` options → the `extract()` call's own `{ strict }`. Joins the existing run-options chain (validation: boolean, else `usage` / `config` as for other fields; never coerced). JSON schema gains it (default false, description); `init` template gains a commented line; template/schema/runtime agreement tests keep passing.
- Lenient: take the value the text leans to. Colloquial and mildly hedged answers commit ("I think so" → true, "yeah", "I reckon so" → true, "nah" → false, "probably two" → 2, "likely Paris" → "Paris"). `null` stays for: no answer, a genuine split ("two or three", "maybe Paris, maybe Lyon"), a bare negation without a value ("it's not two"), explicit inability ("I don't know"). Final committed answer still wins; STATE is context, not a value source (unchanged).
- Strict: exactly today's rules (any hedge → null).
- ONE schema (`schemas/extract.md`) defines both modes; the mode is sent as its own payload section `MODE` (`lenient` | `strict`). Payload deterministic. `docs/instruction-schema.md` "what the judge receives" updated.
- Conformance: cases carry a `mode`; cases on both sides of the line for both modes; jq payload builder sends `MODE`. Docker/live conformance is Jack's to run; offline `payloads` mode must render every case.
- Report: "Extraction 1 of 2 (lenient)"; the recorded extraction carries the mode.
- Types: `ExtractOptions.strict?: boolean`, `RunOptions.strict?: boolean`, JSDoc with `@default` in `src/api/`. Type tests in `e2e/test/`.
- Breaking (pre-1.0): default is now lenient. CHANGELOG Unreleased → Changed (Breaking) + Added; README extract section, docs/api.md extract section, docs/runs-and-threshold.md options/precedence, docs/configuration.md testDefaults row. Existing e2e extract fixtures that test hedge→null pin `strict: true`.

## Acceptance Criteria

1. **Lenient default.** With no `strict` anywhere, `extract()` sends `MODE` `lenient`; the schema's lenient rules commit to the leaned-to value; `null` for no answer, a genuine split, a bare negation, explicit inability.
2. **Strict on request.** `strict: true` sends `MODE` `strict`; the schema's strict rules are today's (any hedge → `null`).
3. **One chain.** `strict` resolves last-wins: built-in `false` → `testDefaults.strict` → outer `crucible.describe` → inner → `crucible.it` options → the `extract()` call's `{ strict }`. Non-boolean at any level → `usage` (code) / `config` (config file); never coerced.
4. **Schema + conformance.** `schemas/extract.md` defines `MODE` and both modes; conformance cases carry a mode with cases on each side of the line in both modes; jq builder sends `MODE`; `conformance.sh payloads` renders every case.
5. **Report.** Each extraction in a failure report shows its mode (default: `Extraction i of n (mode): …`; full: among judge calls); the `ExtractionRecord` carries `mode`.
6. **Config surface.** JSON schema `testDefaults.strict` (boolean, default false, description); `init` template commented line; agreement tests pass.
7. **Types + JSDoc.** `ExtractOptions.strict?`, `RunOptions.strict?` with `@default`; e2e type tests.
8. **Docs + CHANGELOG** state the breaking default change and how to get the old behaviour (`strict: true`, e.g. in `testDefaults`).

## Tasks / Subtasks

- [x] Task 1 (AC 3): `strict` in core run options — `RunOptions.strict?`, `ResolvedRunOptions.strict` (default false) in `RunOptionsResolver`; `RunOptionsValidator` knows `strict` (boolean). Config `testDefaults.strict` validated through the same validator (`config` error). `GroupSettings` inherits it with no change (generic overlay) — prove with tests.
- [x] Task 2 (AC 1–3, 5): run scope carries resolved `strict` (`RunScope.enterRun(..., strict)` + `strict()`); `Runner` passes the resolved value. `Extractor` validates `options.strict` (boolean, else usage), resolves `options.strict ?? scope.strict()`, sends a `MODE` section after `TYPE`, records `mode` on the `ExtractionRecord`.
- [x] Task 3 (AC 5): `Reporter` shows the mode in extraction headings (default) and judge-call lines (full).
- [x] Task 4 (AC 4): `schemas/extract.md` MODE section + lenient/strict rules; `docs/instruction-schema.md`; conformance fixture `mode` per case + new cases; `extract-payload.jq` sends MODE; e2e conformance test passes `strict`; `failure-report` extraction fixture pins `strict: true`.
- [x] Task 5 (AC 6): JSON schema + `init` template + agreement tests.
- [x] Task 6 (AC 7): `src/api` JSDoc'd `ExtractOptions` + `RunOptions.strict`; type tests.
- [x] Task 7 (AC 8): README, docs/api.md, docs/runs-and-threshold.md, docs/configuration.md, CHANGELOG.
- [x] Task 8: full gate + offline `conformance.sh payloads`.

### Review Findings

- [x] [Review][Decision] Lenient edge cases unpinned — Jack: lenient approximation ("around two" → 2) and hedged negative ("I don't think so", "probably not" → false); strict lists "around two", "I don't think so" as hedges. "Probably two, maybe three" stays unpinned in lenient. Applied to `schemas/extract.md` + `docs/instruction-schema.md` + `docs/gotchas.md`.
- [x] [Review][Decision] Conformance gaps — Jack: added lenient-around-two, lenient-dont-think-so, lenient-probably-not, lenient-i-think-two, strict-around-two, strict-dont-think-so, strict-likely-paris, strict-firm-no (32 cases). Live re-run pending (Jack).
- [x] [Review][Decision] Unknown `extract()` option keys silently ignored — Jack: now a `usage` error like it/describe/testDefaults; CHANGELOG Changed (Breaking) [src/core/extractor.ts]
- [x] [Review][Decision] `ModeAwareJudge` reads MODE off the prompt tail — Jack: keep as is [src/core/test/mode-aware-judge.fake.ts]
- [x] [Review][Decision] Report/trace line format change — Jack: listed under CHANGELOG Changed for report parsers [CHANGELOG.md]
- [x] [Review][Patch] Debug trace lacked the mode [src/core/trace-reporter.ts:152]
- [x] [Review][Patch] CHANGELOG `crucible.describe` entry omitted `strict` as inheritable [CHANGELOG.md]
- [x] [Review][Patch] `RunOptions` row in docs/api.md types table lacked `strict`; untyped pseudo-signature in extract section [docs/api.md]
- [x] [Review][Patch] gotchas TOC anchor dead after heading rename; paragraph said judge "does not pick the likeliest value" (contradicts lenient) [docs/gotchas.md]
- [x] [Review][Patch] Duplicate `it.each` titles in mode-recording test [src/core/extractor.test.ts]
- [x] [Review][Patch] trace example in docs lacked mode [docs/runs-and-threshold.md]
- [x] [Review][Defer] `RunScope.enterRun` positional params growing (`undefined, undefined, undefined` at call sites) [src/core/state.ts:55] — deferred, refactor beyond story
- [x] [Review][Defer] `strict` default false duplicated in `state.ts` param default and `RunOptionsResolver.DEFAULT_STRICT` [src/core/state.ts:55] — deferred, harmless

## Dev Notes

### Current state (read before touching)

- `src/core/extractor.ts` — `Extractor.extract(text, description, options?)`: `requestedType` validates text/description/options (object, `as` ∈ string|number|boolean; `{as: null}` → usage); payload via `PayloadAssembler.assemble(state, [RESPONSE, TARGET, TYPE])`; `JudgeExchange.ask` (re-ask once, per-attempt `scope.inferenceTimeout()`); `scope.recordExtraction({assertion, description, type, value, reasoning, response})`; `trace.judgeRecorded`.
- `src/core/extract-type.ts` — `ExtractOptions<T> = { as?: T }` and the result-type machinery `ExtractedValueFor<O>` (keyed on `'as' extends keyof O`; adding `strict` must not change result typing).
- `src/core/state.ts` — `RunScope.enterRun(body, signal?, run?, inferenceTimeout?)`; `RunStore` holds per-run settings; `ExtractionRecord`.
- `src/core/runner.ts` — resolves `opts` over `testDefaults()` with `RunOptionsResolver`, `start()` enters each run with `inferenceTimeout`; add resolved `strict`.
- `src/core/run-options*.ts` — four fields today; validator `KNOWN_KEYS`; resolver per-field `opts ?? defaults ?? built-in`.
- `src/core/group-settings.ts` — overlays any defined field; nothing to change beyond validator.
- `src/core/config.ts` — `requireTestDefaults` uses the shared validator (subject `"testDefaults" in <file>`) → `config` error.
- `src/core/reporter.util.ts` — `extractionFields` (`Extraction i of n: "desc" as type → value`), `judgeCallLines` full mode (`extract "desc" as type → value`).
- `src/api/crucible.ts` re-exports core `ExtractOptions`; JSDoc may live only in `src/api/` → add an api-side `ExtractOptions` mirroring `src/api/run-options.ts`.
- Conformance: `conformance.sh` concatenates `payload-sections.jq` + `<suite>-payload.jq` (jq 1.8.2 crashes on nested `include`); `payloads` mode prints every case's payload offline with `CONFORMANCE_SCHEMA_DIR`/`CONFORMANCE_CASES_DIR` overrides.
- e2e: `e2e/ext/extract-conformance.test.ts` runs every fixture case via public API; `e2e/ext/fixtures/projects/failure-report/` deliberate extraction ("Probably two apples, maybe three") expects `null` → pin strict; `e2e/test/report-line.enum.ts` `FirstExtraction` gains the mode.

### Design

- `MODE` section after `TYPE` (always present): order STATE?, RESPONSE, TARGET, TYPE, MODE.
- Recorded `mode: 'lenient' | 'strict'` (`ExtractMode` in `extract-type.ts`).
- Unit tests prove MODE reaches the judge by outcome: a mode-aware judge fake answers like a schema-honouring judge (strict → null for a hedge, lenient → leaned value); assertions are on the resolved value, never on the captured request.

### Must preserve

- Result typing of `extract` (`as` drives the type); every existing usage error; registration never reads config; coherent payloads unchanged.

### Testing

- Outcomes only; fakes one per file; enums for literals; harness classes; no file I/O, no process state.

### References

- [Source: _bmad-output/planning-artifacts/epics.md#Story 6.4]
- [Source: _bmad-output/implementation-artifacts/4-2-extract-a-value.md]
- [Source: _bmad-output/implementation-artifacts/6-2-commented-config-and-init.md]
- [Source: _bmad-output/implementation-artifacts/6-3-describe-group-settings.md]
- [Source: CLAUDE.md]

## Dev Agent Record

### Agent Model Used

Claude Opus 5.5 (claude-opus-5-5)

### Debug Log References

### Completion Notes List

- Ultimate context engine analysis completed - comprehensive developer guide created
- **TDD.** Resolver/validator/config/group `strict` tests red (9) → green; Extractor lenient/strict tests red (10) → green; Runner strictness red (2) → green; report mode red (5) → green; template agreement red → green; e2e type test red at `tsc -p e2e` (`strict` unknown on `RunOptions`) → green after api types + build. Binding chain tests (describe → it → extract) green on arrival (chain built by the earlier red steps).
- **Core.** `RunOptions.strict?` / `ResolvedRunOptions.strict` (built-in `false`); validator knows `strict` (boolean only, never coerced) → `usage` for `it`/`describe`, `config` for `testDefaults`. `GroupSettings` unchanged (generic overlay). `RunScope.enterRun(..., strict)` + `strict()`; `Runner` enters each run with resolved `inferenceTimeout` and `strict`.
- **Extractor.** Validates `options.strict` (boolean else usage); mode = call `strict` ?? run `strict`; payload STATE?, RESPONSE, TARGET, TYPE, MODE (`lenient`|`strict`); `ExtractionRecord.mode`.
- **Tests by outcome.** `ModeAwareJudge` fake answers like a schema-honouring judge (MODE strict → null for the hedge, lenient → 2, no MODE → unusable reply); assertions are on resolved values, never on the captured request.
- **Report.** Default: `Extraction i of n (mode): …`; full: `Judge call i of n: extract (mode) "…" as type → value`. Trace unchanged.
- **Schema / conformance.** `schemas/extract.md` MODE section + rule 4 per mode; fixture cases carry `mode` (24 cases: 11 kept, 13 added); `extract-payload.jq` sends MODE (missing mode fails the jq build); e2e conformance passes `strict`; failure-report extraction scenario pinned `strict: true`, report line `Extraction 1 of 1 (strict):`. Offline `conformance.sh payloads` renders all 24 extract + 4 coherent payloads (exit 0). Live conformance/Docker not run (Jack).
- **Config surface.** JSON schema `testDefaults.strict` (boolean, default false); `init` template commented `"strict": false` line; template/schema/runtime agreement tests pass.
- **API.** `src/api/extract-options.ts` (JSDoc'd `as`/`strict`, `@default`); `RunOptions.strict` JSDoc; surface JSDoc updated; type tests in `e2e/test/extract-result-typing.util.ts` and `crucible-describe-typing.util.ts`.
- **Docs.** README, api.md, runs-and-threshold.md, configuration.md, getting-started.md, gotchas.md, instruction-schema.md, CHANGELOG (Changed **Breaking** + schema MODE note; Added).
- **Gate:** `npm run lint && npm run format:check && npm run typecheck && npm test && npm run build && npm run verify:pack && npx tsc --noEmit -p e2e` → exit 0 (716 tests, 26 suites).

### File List

- CHANGELOG.md
- README.md
- docs/api.md
- docs/configuration.md
- docs/getting-started.md
- docs/gotchas.md
- docs/instruction-schema.md
- docs/runs-and-threshold.md
- schemas/extract.md
- schemas/crucible.config.schema.json
- e2e/ext/conformance/extract-payload.jq
- e2e/ext/extract-conformance.test.ts
- e2e/ext/failure-report.test.ts
- e2e/ext/fixtures/extract-conformance.json
- e2e/ext/fixtures/projects/failure-report/deliberate-extraction.scenario.ts
- e2e/ext/fixtures/projects/failure-report/extraction.json
- e2e/test/crucible-describe-typing.util.ts
- e2e/test/extract-mode.enum.ts (new)
- e2e/test/extract-result-typing.util.ts
- e2e/test/report-line.enum.ts
- e2e/test/report-pattern.util.ts
- src/api/crucible-surface.ts
- src/api/crucible.ts
- src/api/extract-options.ts (new)
- src/api/run-options.ts
- src/bindings/jest.test.ts
- src/bindings/test/jest-harness.util.ts
- src/cli/config-template.util.ts
- src/cli/config-template.util.test.ts
- src/core/config.test.ts
- src/core/extract-type.ts
- src/core/extractor.ts
- src/core/extractor.test.ts
- src/core/group-settings.test.ts
- src/core/reporter.util.ts
- src/core/reporter.util.test.ts
- src/core/run-options.ts
- src/core/run-options-resolver.util.ts
- src/core/run-options-resolver.util.test.ts
- src/core/run-options-validator.util.ts
- src/core/runner.ts
- src/core/runner.test.ts
- src/core/state.ts
- src/core/test/extract-mode-name.enum.ts (new)
- src/core/test/extractor-harness.util.ts
- src/core/test/mode-aware-judge.fake.ts (new)
- src/core/test/report-harness.util.ts
- src/core/test/runner-harness.util.ts
- src/core/test/state-harness.util.ts
- _bmad-output/implementation-artifacts/6-4-lenient-strict-extract.md (new)
- _bmad-output/implementation-artifacts/sprint-status.yaml

## Change Log

- 2026-11-14: Story 6.4 implemented — `strict` run/extract option (lenient default, breaking), MODE payload section, schema both modes, conformance cases per mode, report mode, config schema/template, types, docs. Gate green (716 tests). Status → review.
- 2026-11-14: Code review — trace shows mode; extract() rejects unknown option keys (usage); lenient approximation/hedged-negative rules + 8 conformance cases (32 total, live re-run pending); docs/CHANGELOG fixes. Gate green (718 tests). Status stays review.
