---
baseline_commit: 7a5d43a
---

# Story 4.2: Extract a value and assert it with Jest

Status: done

## Story

As a developer testing what my system's reply says,
I want to pull a typed value out of free-form prose with `crucible.extract()`,
so that I can check exact values (counts, names, yes/no answers) with ordinary Jest matchers, while crucible handles phrasing and the run gating.

Jack's decisions (2026-11-13): build `extract()` before a C# port. A single hedged value ("probably two") returns `null`.

## Acceptance Criteria

1. **Typed value.** `await crucible.extract(text, 'the number of apples', { as: 'number' })` resolves to the single final value the text commits to, typed as requested (`number`, `string` or `boolean`; default `string`), so `expect(...).toBe(2)` works. TypeScript types the result from `as` (`number | null` for `'number'`, `string | null` by default).
2. **Final answer.** When the speaker revises ("At first I thought 3, but the answer is two") the final committed answer (2) is extracted, not the first mention.
3. **Null, never a guess.** Negation ("It's not two"), hedging ("Probably two", "Probably two, maybe three") and no answer resolve to `null`.
4. **State as context.** State from `crucible.load()`/`append()` is sent as context, as for `coherent()`; the value must come from what the response commits to.
5. **Reply validation.** A judge reply whose value is not `null` or of the requested type (numbers finite), or is malformed, is re-asked once and then becomes a retryable `infra` error. Non-string text/description, an invalid `as`, or a call outside a run → `usage`.
6. **Recorded, reported, traced.** Each extraction is recorded per run (description, requested type, value or null, reasoning, response, seq). A failed run's report lists the run's extractions so a failing `toBe(2)` shows why the judge returned `null`; `full` verbosity lists them among the judge calls; `debug` trace shows each extraction. AD-13 coherent attribution unchanged.
7. **Schema + conformance + e2e.** `schemas/extract.md` (language-agnostic, mirrors `coherent.md`) with explicit rules for final answers, normalisation, negation, hedging, no answer and state; ships in the tarball (verify-pack). Conformance harness (3.4) covers extract cases (revision, number words, negation, single hedge, alternatives hedge, no answer, boolean, string); real-provider e2e per rule.
8. **Docs.** `docs/api.md`, `docs/getting-started.md`, `docs/gotchas.md`, `docs/instruction-schema.md`, README cover `extract()`, incl. `null` = "no single committed value" and always `await`. TS examples compile against `dist`.
9. **(PO addition)** `crucible.coherent` public parameters renamed `(response, claim)` → `(actual, expectation)`; docs updated (`actual` is sent as RESPONSE, `expectation` as CLAIM). Type-signature rename only.

## Tasks / Subtasks

- [x] Task 1: Payload assembler takes named sections (AC 4) — STATE omitted when empty, then caller sections in order.
- [x] Task 2: Shared judge exchange (AC 5) — extract the re-ask / per-attempt inference timeout / run-abort / error-recording loop out of `Judge` into `JudgeExchange`; `Judge` keeps behaviour.
- [x] Task 3: Records (AC 6) — `ExtractionRecord` + `RunScope.recordExtraction`, sharing the run seq with verdicts and errors.
- [x] Task 4: `Extractor` (AC 1–5) — usage validation, payload with TARGET/TYPE, typed reply validation, record + trace.
- [x] Task 5: Report + trace (AC 6).
- [x] Task 6: Public API (AC 1, 9) — `crucible.extract`, exported `ExtractType`, `ExtractOptions`, `ExtractedValue`; coherent param rename.
- [x] Task 7: `schemas/extract.md` + verify-pack required list (AC 7).
- [x] Task 8: Conformance harness generalised to suites (coherent, extract) + extract cases; e2e extract tests + failure-report extraction scenario (AC 7).
- [x] Task 9: Docs + README + example compile check (AC 8, 9).
- [x] Task 10: Full gate.

## Dev Notes

### Current state (read before touching)

- `src/core/judge.ts` — `Judge.judgeCoherent(response, claim)`: `requireStrings` → usage; reads run state; builds `{model, system, prompt, meta}`; counts attempts via wrapped adapter; `judgedReply` loops `MAX_REPLY_ATTEMPTS = 2` with `completeBeforeDeadline` (deadline = `scope.inferenceTimeout()`, `AbortSignal.any([runSignal, deadline])`, deadline-only abort → retryable infra); `parseReply` strips code fences, JSON-parses, requires boolean verdict + string reasoning; success → `scope.recordVerdict` + `trace.judgeRecorded`; failure → `scope.recordError({cause, attempts})` + trace, rethrow.
- `src/core/payload-assembler.util.ts` — fixed STATE/RESPONSE/CLAIM; fence neutralising.
- `src/core/state.ts` — `RunContext { state, verdicts, errors }`, shared `seq`.
- `src/core/reporter.util.ts` — `firstFailure` = lowest-seq false verdict vs lowest-seq error (AD-13); full verbosity lists judge calls per run sorted by seq.
- `src/core/trace-reporter.ts` — `judgeRecorded(VerdictRecord | ErrorRecord)`.
- `src/api/crucible.ts` — `CompositionRoot` builds `Judge` lazily with `SchemaSource.load('coherent')`.
- `e2e/ext/conformance/` — POSIX sh + jq + curl in Docker; one schema, one cases file, one jq module.
- `scripts/verify-pack.mjs` — allowlist already admits `schemas/*.md`; required list names `schemas/coherent.md` only.

### Design

- Records: separate `extractions` list in `RunContext` (mirrors `verdicts`/`errors`), shared base type `JudgedRecord` (assertion, reasoning, response, seq). AD-13 reads `verdicts` only, so attribution is untouched by construction.
- Schema sections: `STATE` (optional), `RESPONSE`, `TARGET` (description), `TYPE` (`string`/`number`/`boolean`).
- State-only values: **not extracted**. STATE may resolve a reference the response makes ("the blue room" → room 4), but a value that only STATE holds, which the response does not commit to, is `null`.
- Public typing via a generic over the options, `extract<O extends ExtractOptions | undefined = undefined>(…, options?: O): Promise<ExtractedValueFor<O>>` (changed in code review from `T extends ExtractType`, which was unsound for an optional or `undefined` `as`).

### Must preserve

- `coherent()` behaviour, reports, traces, AD-13 attribution.
- Registration never reads config.
- Testing rules in CLAUDE.md (fakes one per file, enums, harness classes, no message-text asserts except rendered reports).

## Dev Agent Record

### Agent Model Used

Claude Opus 5.5 (claude-opus-5-5)

### Completion Notes List

- **TDD.** Each src behaviour landed red → green: payload sections (4 tests), extraction records (2), `Extractor` (25), report extraction lines (6). `JudgeExchange` was a pure refactor under the existing `Judge` suite (all green throughout). The public `crucible.extract` wiring was driven by the e2e files (red at `tsc -p e2e` against `dist`, then green). Unit tests: 411 → 445, 17 suites.
- **Shared exchange.** `src/core/judge-exchange.ts` owns what `coherent` and `extract` share: attempt counting, the one re-ask on an unusable reply, per-attempt `inferenceTimeout` from `RunScope`, run-abort signal, fence-tolerant JSON parse, and `recordError` + trace on failure. `Judge` and `Extractor` each supply system text, sections, a contract string and a reader that returns the parsed value or `undefined` (→ retryable `infra`). `Judge` behaviour unchanged.
- **Records.** `RunContext` gains `extractions: ExtractionRecord[]`, sharing the run `seq` with verdicts and errors; `VerdictRecord` and `ExtractionRecord` share a `JudgedRecord` base (assertion, reasoning, response, seq). AD-13 reads `verdicts` only, so "First failed assertion" is unchanged by construction (tested).
- **Report.** Default verbosity: a `[FAILED]` block ends with `Extraction N of M: "<description>" as <type> → <JSON value>` plus nested `Judge reasoning` and bounded `Response excerpt`, in seq order. `full`: extractions appear among the judge calls (`Judge call i of n: extract "…" as number → 2`) and the Extraction lines are not repeated. Errored runs unchanged. Trace: `judge value <v> for extract "<description>" as <type>` + reasoning payload.
- **Schema rules (`schemas/extract.md`).** Sections STATE (optional), RESPONSE, TARGET, TYPE. Rules: final committed answer wins over revisions; normalise to TYPE (number words, yes/no → boolean); negation → null, except a committed "no" to a boolean target is `false`; any hedge (single or alternatives) → null; no answer → null, never guess; STATE is context not a source — it may resolve a reference the response makes ("the blue room" → 4), but a value only STATE holds is null; value null or finite JSON of TYPE; reasoning names the deciding words in 1–3 sentences.
- **Validation.** Reply must be an object with a `value` key (null or `typeof` = requested type; numbers finite, so `1e999` is rejected) and a string `reasoning`; otherwise re-ask once → retryable `infra`. `usage` for non-string text/description, options not a plain object (incl. `null`), unknown `as`, or a call outside a run.
- **Public API.** `crucible.extract<T extends ExtractType = 'string'>(text, description, options?: ExtractOptions<T>): Promise<ExtractedValueOf<T> | null>` — a generic instead of overload signatures (the frozen object literal cannot carry overloads); it types `{ as: 'number' }` → `number | null`, no options → `string | null`, and rejects unknown `as` at compile time (checked in the scratch harness with `@ts-expect-error`). Exported types: `ExtractType`, `ExtractOptions`, `ExtractedValue`. `CompositionRoot` now shares one lazily created `SchemaSource` for both schemas.
- **PO addition: coherent rename.** `crucible.coherent(actual, expectation)` (was `(response, claim)`); type-signature rename only, order unchanged. Docs updated in api.md, getting-started.md, instruction-schema.md (`actual` → RESPONSE, `expectation` → CLAIM) and README; gotchas.md never named the parameters. Internal `Judge` names kept; the `usage` message text now says actual/expectation.
- **Conformance.** Harness generalised to suites (`CONFORMANCE_SUITES`, default `coherent extract`; also passed through `make conformance`): shared `payload-sections.jq`, `coherent-payload.jq`, new `extract-payload.jq` (`<suite>_payload/_request/_strict_reply/_outcome`); cases compared as compact JSON. Image now copies both schemas and both case files. 11 extract cases: revision, number word, negation, single hedge, alternatives hedge, no answer, boolean yes, boolean no, string, state-resolves-reference, state-only-value. Verified offline: `payloads` output is byte-identical to the TS `PayloadAssembler` for all 15 cases; strict-reply probe accepts 2/null and rejects `"2"`, `1e999`, missing value, non-JSON; unknown suite → exit 2.
- **e2e (written, not run).** `e2e/ext/extract-conformance.test.ts` runs the 11 cases through the public API; the failure-report child project gains a deliberately failing hedged extraction and asserts the report's `Extraction 1 of 1: "the number of apples" as number → null` line; the debug-trace child project adds one extraction and asserts its trace line. `OPENROUTER_API_KEY` was not present in the shell, so neither `make e2e-ext` nor `make conformance` was run.
- **Docs.** api.md (new `crucible.extract()` section, five functions, exported types, inferenceTimeout wording), getting-started.md (rung 2 is now `extract()`; replaces the planned `exact()/range()` note), gotchas.md (null = no single committed value; always await), instruction-schema.md (new "The extract schema" section; conformance suites), runs-and-threshold.md (Extraction lines in the failure report, full/debug output), configuration.md + docs/README.md (mentions), README ("Extract a value" subsection, feature bullet). Example compile check (scratchpad, not committed): 23 ts blocks + an inference-typing file compiled with `tsc` against `dist/index.d.ts`, exit 0; negative control (wrong result type, unknown `as`) → 2 errors; 5 signature-reference blocks skipped.
- **Gate:** `npm run lint && npm run format:check && npm run typecheck && npm test && npm run build && npm run verify:pack && npx tsc --noEmit -p e2e` → exit 0 (445 tests; tarball has 9 files incl. `schemas/extract.md`, now in the required list).

### File List

- Makefile
- README.md
- docs/README.md
- docs/api.md
- docs/configuration.md
- docs/getting-started.md
- docs/gotchas.md
- docs/instruction-schema.md
- docs/runs-and-threshold.md
- schemas/extract.md (new)
- scripts/verify-pack.mjs
- src/api/crucible.ts
- src/index.ts
- src/core/extract-type.ts (new)
- src/core/extractor.ts (new)
- src/core/extractor.test.ts (new)
- src/core/judge-exchange.ts (new)
- src/core/judge.ts
- src/core/payload-assembler.util.ts
- src/core/payload-assembler.util.test.ts
- src/core/reporter.util.ts
- src/core/reporter.util.test.ts
- src/core/state.ts
- src/core/state.test.ts
- src/core/trace-reporter.ts
- src/core/test/assertion-name.enum.ts
- src/core/test/extract-reply.enum.ts (new)
- src/core/test/extract-target.enum.ts (new)
- src/core/test/extract-text.enum.ts (new)
- src/core/test/extract-value.enum.ts (new)
- src/core/test/extractor-harness.util.ts (new)
- src/core/test/judge-harness.util.ts
- src/core/test/report-harness.util.ts
- src/core/test/state-harness.util.ts
- e2e/ext/conformance/Dockerfile
- e2e/ext/conformance/Dockerfile.dockerignore
- e2e/ext/conformance/conformance.sh
- e2e/ext/conformance/coherent-payload.jq
- e2e/ext/conformance/extract-payload.jq (new)
- e2e/ext/conformance/payload-sections.jq (new)
- e2e/ext/extract-conformance.test.ts (new)
- e2e/ext/fixtures/extract-conformance.json (new)
- e2e/ext/debug-trace.test.ts
- e2e/ext/failure-report.test.ts
- e2e/ext/fixtures/projects/debug-trace/debug-trace.scenario.ts
- e2e/ext/fixtures/projects/debug-trace/scenario.json
- e2e/ext/fixtures/projects/failure-report/deliberate-extraction.scenario.ts (new)
- e2e/ext/fixtures/projects/failure-report/extraction.json (new)
- e2e/test/report-line.enum.ts
- e2e/test/report-pattern.util.ts (new, review)
- e2e/test/extract-result-typing.util.ts (new, review)
- src/core/test/extract-reasoning.enum.ts (new, review)
- e2e/test/trace-line.enum.ts
- _bmad-output/implementation-artifacts/4-2-extract-a-value.md (new)
- _bmad-output/implementation-artifacts/sprint-status.yaml

### Review Findings

Code review 2026-11-13 used three layers: Blind Hunter, Edge Case Hunter and Acceptance Auditor. Fixes applied test-first:

- [x] [Review][Patch] The `extract` result type was unsound when `as` might be absent: `{ as: undefined }` widened to the full union, and an `{ as?: 'number' }` options value or an explicit `extract<'number'>(t, d)` typed `number | null` but returned a string. The signature is now generic over the options type (`ExtractedValueFor<O>`). A compile-time spec, `e2e/test/extract-result-typing.util.ts`, checked by `tsc -p e2e` against `dist`, covers these cases:
  - no options, `undefined` options, `{}` and `{ as: undefined }`;
  - `'number'` and `'boolean'`;
  - a widened `ExtractType`;
  - widened `ExtractOptions`;
  - an optional `as`;
  - an unknown `as`.
  [src/api/crucible.ts, src/core/extract-type.ts]
- [x] [Review][Patch] `{ as: null }` silently fell back to `'string'`. It is now a `usage` error. [src/core/extractor.ts]
- [x] [Review][Patch] Schema ambiguities in `schemas/extract.md`, fixed:
  - Rule 6 now draws the STATE line: STATE may only restate a value the response commits to; a mere mention gives `null`.
  - Rule 4 checks hedging only on the final answer, so the revision example in rule 1 no longer reads as a hedge.
  - Rule 2 now covers units, currency and percentages.
  - Rule 3 now says "TYPE is `boolean`".
  - Rule 8 lets the reasoning cite STATE.
  - The fenced-data wording no longer contradicts TARGET and TYPE.
  Docs summaries were updated to match.
- [x] [Review][Patch] The conformance harness compared numbers as jq text, so `2.0` read as a FAIL against `2`. `extract_outcome` now normalises numbers. [e2e/ext/conformance/extract-payload.jq]
- [x] [Review][Patch] `SchemaTextSupplier` is shared by `Judge` and `Extractor`, so it moved to `judge-exchange.ts`; `extractor` no longer imports `judge`.
- [x] [Review][Patch] Test hygiene:
  - the extraction record test no longer asserts the `assertion`/`seq` identity fields or a magic reasoning string (new `ExtractReasoning` enum);
  - the reporter test uses `ExtractText.City`;
  - the failure-report e2e now checks that `Judge reasoning:` follows the extraction line, as its name claims (new `ReportPattern`).
- [x] [Review][Patch] `docs/api.md` signature note updated.
- [x] [Review][Defer] Moved to deferred-work.md:
  - live e2e and conformance not yet run;
  - string canonical form and multi-value schema rules;
  - extraction report gaps (errored runs, tally, bounds, quoting);
  - `JudgeExchange` drift that is unreachable in practice;
  - unsafe integers;
  - architecture spine amendments;
  - the conformance interface change;
  - docs polish.
- Dismissed: the claim that `isinfinite` misses `1e999` (jq 1.7.1 returns `true`).

## Change Log

- 2026-11-13: Story created (ready-for-dev).
- 2026-11-13: Implemented `crucible.extract()` with `schemas/extract.md`, shared `JudgeExchange`, extraction records, report/trace output, conformance suites, e2e, docs. PO addition folded in: `crucible.coherent(response, claim)` public parameters renamed to `(actual, expectation)` (type signature and docs only). Status → review.
- 2026-11-13: Code review. Patches applied (sound `extract` typing, `{ as: null }` → usage, schema rule clarifications, numeric conformance outcome, shared type move, test hygiene); minor items deferred. Gate green (446 tests). Status → done.
