---
baseline_commit: e80256d
---

# Story 6.5: Facts — one name for state, per call or per run

Status: done

## Story

As a developer giving the judge the ground truth my system worked from,
I want one clearly named function for it, and the option to pass facts with a single assertion,
so that the common case reads naturally and multi-step tests stay possible.

Jack's decisions (2026-11-14), not to be re-litigated:

- `crucible.facts(fact: string | readonly string[])` adds to the run's state exactly as `load`/`append` do today (append-only, per run, snapshot when an assertion is called, same scope/validation rules). `load` and `append` stay as aliases with identical behaviour, `@deprecated` in JSDoc (removal planned for 1.0); no runtime warning.
- Per-call facts: `crucible.coherent(actual, expectation, { facts })` (new optional third parameter, an options object; unknown keys → `usage`, same strictness as extract options) and `crucible.extract(text, description, { as, strict, facts })`. Sent with that call only, appended AFTER the run's facts in the same `STATE` section; never enter the run state. Validation as `crucible.facts()` (string or array of strings, else `usage`). Only inside a running `crucible.it()` body.
- Wire format unchanged: section stays `STATE`; `schemas/*.md` and conformance untouched. Docs call the concept "facts" and explain once that it travels as `STATE`.
- Report: each judged call in the failure report shows the facts it used (run + per-call), labelled `Facts`.
- Docs: README/guides use `crucible.facts()` everywhere; example `crucible.facts(assistant.getLogs())` (`getLogs()` returns `string[]`, never wrapped). Quick start stays without facts. `docs/api.md`: new `crucible.facts()` section, load/append reduced to "deprecated aliases", per-call `{ facts }` on coherent and extract, function count updated. CHANGELOG Unreleased: Added (facts, per-call facts), Deprecated (load, append), Changed (coherent non-object third argument → `usage`).
- e2e fixtures use `crucible.facts`; one unit test keeps proving the aliases behave identically. Any new live e2e pinned to `runs: 1, threshold: 1`.

## Acceptance Criteria

1. **`crucible.facts()`** inside a running `crucible.it()` body appends to the run's state exactly like `load`/`append` (string or array of strings, append-only, per run, copied, read when an assertion is called); anything else → `usage`; outside a run → `usage`.
2. **Aliases.** `crucible.load()` / `crucible.append()` behave identically, carry `@deprecated` JSDoc, and no longer appear in README or guides (only in the api.md deprecated-aliases section and CHANGELOG).
3. **Per-call facts.** `coherent(actual, expectation, { facts })` and `extract(text, description, { as, strict, facts })` send the facts with that call only, after the run's facts, inside the one `STATE` section; the run's state is unchanged and later calls do not see them.
4. **Validation.** Per-call `facts` validated like `crucible.facts()` → `usage`. `coherent` third argument: `undefined` or a plain object with only `facts` → else `usage`. Extract option keys gain `facts`.
5. **Report.** Each verdict/extraction record carries the facts the call used; the failure report shows them as `Facts:` (default: under the first failed assertion and each extraction; full: under each judge call). Omitted when a call used no facts.
6. **Wire unchanged.** `STATE` header, schemas, conformance untouched.
7. **Types + JSDoc.** `crucible.facts` on the surface; `CoherentOptions` (api, JSDoc'd) exported; `ExtractOptions.facts`; extract result typing unchanged with `facts`; e2e type tests.
8. **Docs + CHANGELOG** as decided above.

## Tasks / Subtasks

- [x] Task 1 (AC 1, 4): shared fact validation (`FactList` util in `src/core/fact-list.util.ts`), used by `RunScope.appendState`; `usage` message names `crucible.facts`.
- [x] Task 2 (AC 3, 4, 5): `Judge.judgeCoherent(response, claim, options?)` validates options, sends `[...runFacts, ...callFacts]`, records `facts` on `VerdictRecord`.
- [x] Task 3 (AC 3, 4, 5): `Extractor` accepts `facts` option, same assembly, records `facts` on `ExtractionRecord`.
- [x] Task 4 (AC 5): `Reporter` `Facts:` field (default + full), bounded like the response excerpt.
- [x] Task 5 (AC 1, 2, 7): `src/api` — `crucible.facts`, `coherent` options, `CoherentOptions`, `ExtractOptions.facts`, deprecated JSDoc; e2e type tests.
- [x] Task 6 (AC 2): e2e fixtures/tests switch to `crucible.facts`.
- [x] Task 7 (AC 8): README, docs, CHANGELOG.
- [x] Task 8: full gate.

### Review Findings

- [x] [Review][Decision] (Decided 2026-11-14, delegated: keep wire order — the report mirrors what the judge received) Report cut drops per-call facts first — `Facts:` joins run facts then call facts and bounds the whole at `excerptChars`, so with long run facts (e.g. `getLogs()`) the call's own facts are the first to disappear. Options: keep wire order (current, spec wording); show call facts first in the report; or bound run and call facts separately.
- [x] [Review][Decision] (Decided: accept for now — matches the wire; revisit if users hit it) A fact containing a line break reads as two facts in the report (and on the wire, where `PayloadAssembler` also joins with `\n`). Options: accept (spec says "one per line"); number/bullet each fact in the report only.
- [x] [Review][Decision] (Decided: keep — pre-existing behaviour, no breaking change in this story; logged in deferred-work) Empty / whitespace-only facts (`crucible.facts('')`, `{ facts: [''] }`) are accepted (pre-existing for `load`/`append`) and show as a blank `Facts:` line. Options: keep; reject as `usage`; drop silently.
- [x] [Review][Patch] `coherent`/`extract` options accepted a `Map`, `Date` or an object inheriting an option (AC 4 says plain object); shared `OptionBag` util now requires a plain object with only known own keys [src/core/option-bag.util.ts]
- [x] [Review][Patch] Snapshot test mutated the caller's array only after the call resolved; now mutates mid-call (judge + extractor), plus a concurrent-call isolation test [src/core/judge.test.ts, src/core/extractor.test.ts]
- [x] [Review][Patch] `Facts:` cut ending exactly on a whole fact glued `…` to a complete fact; the marker now sits on its own line [src/core/reporter.util.ts]
- [x] [Review][Patch] `usage` message did not name `crucible.facts` (Task 1) [src/core/fact-list.util.ts]
- [x] [Review][Patch] CHANGELOG: coherent third-argument rejection marked **Breaking**; extract plain-object rule added; "did" → "do" for the live aliases [CHANGELOG.md]
- [x] [Review][Patch] `RunFactsHarness.invalid` hand-rolled try/catch with a magic `42`; uses `Capture.thrown` and a named constant [src/api/test/run-facts-harness.util.ts]
- [x] [Review][Patch] Magic literals in new tests (`'the response'`, `'f'`, `'boom'`) replaced by enums/derived values [src/core/judge.test.ts, src/core/reporter.util.test.ts]
- [x] [Review][Patch] `excerptChars` schema description and `init` template comment now say it also bounds `Facts` [schemas/crucible.config.schema.json, src/cli/config-template.util.ts, docs/configuration.md]
- [x] [Review][Defer] Errored judge calls (`ErrorRecord`) carry no facts, so the report shows no `Facts:` for them [src/core/state.ts] — deferred, outside AC 5 (verdict/extraction records only)
- [x] [Review][Defer] Surplus arguments to `facts`/`load`/`append`/`coherent` are silently ignored, unlike `describe` [src/api/crucible.ts] — deferred, pre-existing for load/append; TS types already block it

## Dev Notes

### Current state (read before touching)

- `src/core/state.ts` — `RunScope.appendState(entries: unknown)` validates via private `stateEntries` (string or array of strings; `Array.from` copies, holes → undefined → rejected; `String` objects rejected) and pushes into `context.state`. `VerdictRecord` / `ExtractionRecord` types live here. Usage message currently names `crucible.load and crucible.append`.
- `src/core/judge.ts` — `judgeCoherent(response, claim)`: `requireStrings`, reads `scope.context().state` (throws usage outside a run), assembles `[STATE?] RESPONSE CLAIM`, records `VerdictRecord`.
- `src/core/extractor.ts` — `OPTION_KEYS` = `as`, `strict`; payload `[STATE?] RESPONSE TARGET TYPE MODE`; records `ExtractionRecord` with `mode`.
- `src/core/payload-assembler.util.ts` — `assemble(state, sections)` adds `STATE` (joined by `\n`) only when non-empty. Unchanged.
- `src/core/reporter.util.ts` — default mode: `failureFields` (First failed assertion, Claim, Judge reasoning, Response excerpt, Thrown) + `extractionFields`; full mode: `judgeCallLines`. Facts never shown today; debug trace shows the full prompt (incl. `STATE`) — leave trace as is.
- `src/api/crucible.ts` — `load`/`append` call `runScope.appendState`; `coherent(actual, expectation)`.
- `src/api/crucible-surface.ts` — JSDoc'd surface; `src/api/extract-options.ts` mirrors core options with JSDoc.

### Design

- Assertion facts = `[...scope.context().state, ...callFacts]` built synchronously at call time (snapshot + copy) → passed to `assemble` and recorded as `facts` on the record.
- Per-call facts validated by the same `FactList` before any judge call; never pushed into `context.state`.
- Unit proof by outcome: a `FactAwareJudge` fake answers a "seen" reply only when the prompt's `STATE` section is exactly the expected facts in order, else an "unseen" reply (as `ModeAwareJudge` reads `MODE`). Assertions are on verdicts/values, recorded facts and run state — never on captured requests.

### Must preserve

- `load`/`append` behaviour and existing state tests; extract result typing; every existing usage error; payload bytes for calls without per-call facts.

### Testing

- Outcomes only; fakes one per file under `src/core/test/`; enums for literals; harness classes; no file I/O or process state; error kind only.

### References

- [Source: _bmad-output/planning-artifacts/epics.md#Story 6.5]
- [Source: _bmad-output/implementation-artifacts/6-4-lenient-strict-extract.md]
- [Source: _bmad-output/implementation-artifacts/2-2-arrange-state-per-run.md]
- [Source: CLAUDE.md]

## Dev Agent Record

### Agent Model Used

Claude Opus 5.5 (claude-opus-5-5)

### Debug Log References

### Completion Notes List

- Ultimate context engine analysis completed - comprehensive developer guide created
- **TDD.** Judge facts tests red (15) → green; Extractor facts tests red (5) → green (the invalid-`facts` usage cases passed vacuously before `facts` became a known key, and stay meaningful after); api `crucible.facts`/alias tests red (6) → green; Reporter `Facts:` tests red (4) → green; e2e type tests compile under `tsc -p e2e`.
- **Core.** `FactList` (`src/core/fact-list.util.ts`) is the one validator for run and per-call facts (string or array of strings, copied; holes and `String` objects rejected) → `usage`. `RunScope.appendState` uses it. `Judge.judgeCoherent(response, claim, options?)` validates options (`undefined` or a plain object with only `facts`), builds `[...run facts, ...call facts]` synchronously at call time, sends it as the one `STATE` section, records it as `VerdictRecord.facts`. `Extractor` knows `facts` (option keys `as`, `strict`, `facts`) and does the same (`ExtractionRecord.facts`). Run state never receives per-call facts. `PayloadAssembler`, schemas, conformance unchanged.
- **Isolation tests by outcome.** `FactAwareJudge` fake answers the "seen" reply only when the prompt's `STATE` section is exactly the expected facts in order (else "unseen"). Tests assert verdicts/values (run then call facts in order; single string; later call sees run facts only), run state after a per-call call, recorded facts per call, copy-on-call, and usage errors (bad facts, bad coherent options, outside a run).
- **Report.** `Facts:` field (facts one per line, bounded by `excerptChars` like the response excerpt, `Facts (first N of M chars)` when cut), omitted when a call used none: default — under the first failed assertion (after `Claim`) and under each extraction; full — under each verdict/extraction judge call. Debug trace unchanged (it already prints the assembled prompt with `STATE`).
- **API.** `crucible.facts()`; `load`/`append` `@deprecated` (removal 1.0), same behaviour; `coherent(actual, expectation, options?: CoherentOptions)`; `ExtractOptions.facts`; `CoherentOptions` exported from the entry point. Unit test `src/api/crucible.test.ts` proves the aliases add exactly what `facts` adds.
- **e2e.** Fixtures/tests use `crucible.facts`; failure-report scenario passes one per-call fact and asserts the `Facts:` line (existing project, runs 2 / threshold 1 via its testDefaults; not run live). Type tests: `e2e/test/crucible-facts-typing.util.ts` (new) and `extract-result-typing.util.ts` (narrowing with `facts`).
- **Docs.** README (hero, features, "Give the judge facts" incl. per-run scoping, `getLogs()` example, per-call example, report sample), api.md (`crucible.facts()` section with scope + wire name, deprecated aliases, per-call facts on coherent/extract, five functions + aliases, types table), getting-started, gotchas (new "Facts are per run, never global" incl. lost async context), instruction-schema (wire name `STATE` explained), runs-and-threshold (report `Facts:`), configuration (`excerptChars` bounds `Facts`), inspiration examples, CHANGELOG (Added, Deprecated, Changed).
- **Gate:** `npm run lint && npm run format:check && npm run typecheck && npm test && npm run build && npm run verify:pack && npx tsc --noEmit -p e2e` → exit 0 (760 tests, 27 suites). No live e2e/conformance run.

### File List

- CHANGELOG.md
- README.md
- docs/api.md
- docs/configuration.md
- docs/getting-started.md
- docs/gotchas.md
- docs/inspiration.md
- docs/instruction-schema.md
- docs/runs-and-threshold.md
- e2e/core/stateful-coherence.test.ts
- e2e/ext/coherent-conformance.test.ts
- e2e/ext/debug-trace.test.ts
- e2e/ext/extract-conformance.test.ts
- e2e/ext/failure-report.test.ts
- e2e/ext/knowledge-boundary.test.ts
- e2e/ext/fixtures/projects/debug-trace/debug-trace.scenario.ts
- e2e/ext/fixtures/projects/failure-report/deliberate-failure.scenario.ts
- e2e/ext/fixtures/projects/failure-report/scenario.json
- e2e/ext/fixtures/projects/openai-compatible/openai-compatible.scenario.ts
- e2e/test/crucible-facts-typing.util.ts (new)
- e2e/test/extract-result-typing.util.ts
- e2e/test/report-line.enum.ts
- src/index.ts
- src/api/coherent-options.ts (new)
- src/api/crucible-surface.ts
- src/api/crucible.ts
- src/api/crucible.test.ts (new)
- src/api/extract-options.ts
- src/api/test/fact-adder.enum.ts (new)
- src/api/test/run-fact.enum.ts (new)
- src/api/test/run-facts-harness.util.ts (new)
- src/core/assertion-options.ts (new)
- src/core/extract-type.ts
- src/core/extractor.ts
- src/core/extractor.test.ts
- src/core/fact-list.util.ts (new)
- src/core/option-bag.util.ts (new)
- src/cli/config-template.util.ts
- schemas/crucible.config.schema.json
- src/core/judge.ts
- src/core/judge.test.ts
- src/core/reporter.util.ts
- src/core/reporter.util.test.ts
- src/core/state.ts
- src/core/test/extractor-harness.util.ts
- src/core/test/fact-aware-judge.fake.ts (new)
- src/core/test/facts-harness.util.ts (new)
- src/core/test/invalid-facts.enum.ts (new)
- src/core/test/judged-response.enum.ts (new)
- src/core/test/non-plain-options.enum.ts (new)
- src/core/test/options-harness.util.ts (new)
- src/core/test/judge-harness.util.ts
- src/core/test/report-harness.util.ts
- src/core/test/report-text.enum.ts
- src/core/test/runner-harness.util.ts
- src/core/test/state-harness.util.ts
- src/core/test/verdict-reply.enum.ts (new)
- _bmad-output/implementation-artifacts/6-5-facts-per-call-and-per-run.md (new)
- _bmad-output/implementation-artifacts/sprint-status.yaml

## Change Log

- 2026-11-14: Story 6.5 implemented — `crucible.facts()`, deprecated `load`/`append` aliases, per-call `{ facts }` on coherent/extract, `Facts:` in the failure report, docs/CHANGELOG. Gate green (760 tests). Status → review.
- 2026-11-14: Code review (bmad-code-review) — 8 patches applied (plain-object options, mid-call snapshot + concurrency tests, `Facts:` boundary marker, usage message, CHANGELOG Breaking, test hygiene, `excerptChars` schema/template text); 3 decisions open, 2 deferred. Gate green (769 tests).
