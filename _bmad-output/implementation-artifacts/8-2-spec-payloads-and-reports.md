---
baseline_commit: 354ec19
---

# Story 8.2: Exact text — judge payloads and failure reports

Status: done

## Story

As a maintainer porting Crucible,
I want the exact judge request payloads and the exact failure report text as fixtures,
so that every port sends byte-identical prompts and prints identical reports.

## Acceptance Criteria

1. **Payload area.** `spec/payload/` holds operations `coherent` and `extract`: neutral inputs (run `facts`, per-call `callFacts`, `response`, `claim` / `target`, `type`, `mode`) map to the exact user-message text (outcome `text`). Cases cover section order, the STATE section (absent when no facts, run facts then call facts), fence neutralisation and injection attempts (fence markers, forged headers, instructions in the response), lines that only look like fences, empty strings, CRLF / lone CR, unicode (astral, combining, RTL, NUL-free control characters), and very long text. The README names the system prompt of each operation (`schemas/coherent.md`, `schemas/extract.md`, sent verbatim).
2. **Conformance parity.** For every case of `e2e/ext/fixtures/coherent-conformance.json` and `extract-conformance.json`, a golden payload produced by the conformance harness's own jq builder is committed under `spec/payload/` (`coherent-conformance.json`, `extract-conformance.json`) and run by the TS payload runner, so TS output = jq output for every conformance case. `make spec-payloads` regenerates them; `make spec-payloads-check` fails when they are stale and also runs the jq builder over the hand-written payload fixtures (jq = fixture text). A TS test (no process spawning, no file I/O) checks that the goldens' inputs match the current conformance cases one for one. CI runs the check. If parity does not hold today, stop and report the diff.
3. **Report area.** `spec/report/` holds operations `render` (failure / passing report text for run records + settings + ending: verdict, aborted, expired) and `trace` (the debug trace text for a sequence of events). Cases cover the headline (pass / failed / errored zones, smoke run, pass-rate flooring), the counts line, failed / errored / discarded / passed sections, the default three-run bound with hidden-run ranges and the failing-claims tally, first-failure selection by order, judge reasoning, extractions with mode and typed value, facts (one per line, absent when none), errors with attempts, causes, multi-line indentation and blank lines, `excerptChars` truncation including surrogate pairs and the facts-line rules, and verbosity default vs full (debug renders like full). Wall-clock, stack traces, object identity and non-error thrown values stay in TS unit tests; the README says so.
4. **Per-operation input schemas.** `spec/fixture.schema.json` checks each operation's input shape (8.1's three operations and the four new ones) and rejects unknown input keys; `SchemaCheck` extended only as needed; README "Known limits" updated; a malformed-fixture case proves an unknown input key is refused.
5. **Shed duplicates.** Unit tests fully covered by fixtures are removed (payload-assembler, reporter, trace-reporter deterministic cases, judge/extractor fact-order cases); tests fixtures cannot express stay. Before/after line counts recorded.
6. **README.** Operation contracts complete enough for a C# implementer: fencing algorithm, section order, separators, line endings (`\n`), no trailing newline, how "chars" are counted (UTF-16 code units), truncation, indentation, number and JSON value formatting, run-number ranges.
7. **No `src/` behaviour change.** A fixture that reveals a bug or mismatch is reported, not fixed.
8. **Gate.** `npm run lint && npm run format:check && npm run typecheck && npm test && npm run build && npm run verify:pack && npx tsc --noEmit -p e2e` passes.

## Tasks / Subtasks

- [x] Parity probe: run `conformance.sh payloads` locally (jq, `CONFORMANCE_CASES_DIR` with `coherent.json`/`extract.json` copies, `CONFORMANCE_SCHEMA_DIR=schemas`, `CONFORMANCE_JUDGE_CONFIG=e2e/crucible.config.json`; no network) and compare with TS output (AC 2)
- [x] Per-operation input schemas + SchemaCheck extension if needed + malformed case (AC 4)
- [x] Payload harness (`EchoJudge` fake replying with the prompt as reasoning, real `Judge` / `Extractor`), runner, `spec/payload/coherent.json`, `extract.json` (AC 1)
- [x] jq golden generator script + make targets + CI step, goldens, TS currency test (AC 2)
- [x] Report harness (neutral run records → `RunResult`s, real `Aggregator` + `Reporter`), runner, `spec/report/render.json` (AC 3)
- [x] Trace harness (events → real `TraceReporter` with an output recorder), runner, `spec/report/trace.json` (AC 3)
- [x] Remove duplicated unit tests; record line counts (AC 5)
- [x] README contracts, known limits, layout (AC 6)
- [x] Gate (AC 8)

### Review Findings

- [x] [Review][Patch] Meta-values-never-written and full-verbosity-silent unit tests restored (story "Must preserve") [src/core/trace-reporter.test.ts]
- [x] [Review][Patch] Out-of-seq-order record cases restored as unit tests (lowest-seq false verdict, extraction numbering, earliest error attempts, full judge-call order); fixtures cannot express them [src/core/reporter.util.test.ts]
- [x] [Review][Patch] Thrown-string and cause-less failed run now have TS unit tests, as the README's "out of scope" list claims [src/core/reporter.util.test.ts]
- [x] [Review][Patch] Schema: `delayMs` required with `next: retry` and refused otherwise; `minimum` (SchemaCheck extended) on excerptChars, runs, fatalRun, attempts, run numbers, counts; extracted value limited to scalars/null; outcome kind tied to the operation (text for payload/report, value/error for 8.1 ops); three malformed cases prove it [spec/fixture.schema.json]
- [x] [Review][Patch] README: lone surrogates (JSON escaping, none in fixtures), member order of input objects + integer-like keys, explicit blank-line code-unit list (no Zs version dependence, Python built-ins warned), C# / Java / Python JSON escaper warning corrected, rate evaluation order, Math.round semantics (ties toward +inf), fence promise scoped to `\n` lines and one-way, whole-fact marker also fires on in-fact breaks, sole-astral truncation quirk, tally grouping by rendered label, quoted values unescaped, empty system prompt, empty events, provider-request meta default, testDefaults plain JSON, `make spec-payloads` needs node_modules [spec/README.md]
- [x] [Review][Patch] Fixtures `report-render-truncation-sole-astral-character` and `report-render-characters-that-are-not-breaks` (U+000B/U+0085/U+001C not breaks, U+00A0/U+FEFF blank lines, U+180E not white space, `\u001b` escape, raw astral in JSON) [spec/report/render.json]
- [x] [Review][Patch] `make spec-payloads-check` fails on a fixture file not registered with the TS runner [e2e/ext/conformance/spec-payloads.sh]
- [x] [Review][Patch] Magic `threshold: 1` in trace harness → `Threshold.Certain` [src/core/test/trace-fixture-harness.util.ts]
- [x] [Review][Defer] Fencing gap: `>>>\r`, U+2028/U+2029-separated and whitespace-padded fence lines are not neutralised — deferred, behaviour change for every port + jq + conformance run
- [x] [Review][Defer] Sole-astral truncation marks an uncut value as cut (`first 2 of 2 chars: 😀…`) — deferred, src behaviour (AC 7)
- [x] [Review][Defer] System prompt and request envelope parity TS vs jq `chat_request` unproven once 8.5 deletes the TS conformance e2e — deferred to Story 8.3/8.5

## Dev Notes

### Current state (read before touching)

- `PayloadAssembler.assemble(state, sections)` (`src/core/payload-assembler.util.ts`): optional `STATE` section (facts joined by `\n`) first, then each section `HEADER\n<<<\n<content>\n>>>`, joined by `\n\n`; a content line exactly equal to `<<<` or `>>>` (after splitting on `\n` only) gets one leading space. `\r` is not a line break for fencing.
- `Judge.judgeCoherent` sections: RESPONSE, CLAIM; `Extractor.extract`: RESPONSE, TARGET, TYPE, MODE. Facts = run state (`RunScope.appendState`) followed by per-call `facts`. System prompt = schema file text verbatim (`SchemaSource.load`, wired in `composition-root.ts`).
- jq builder (`e2e/ext/conformance/payload-sections.jq` + `<suite>-payload.jq`) mirrors this with `state` only (no per-call facts). `conformance.sh payloads` prints `=== <suite>/<id>\n<payload>`; it reads cases from `$CASES_DIR/<suite>.json` and needs jq only.
- `Reporter` (`reporter.util.ts`) renders `VerdictSummary`/`FatalSummary`/`ExpirySummary`; failure report is the `CrucibleVerdictError` message; the passing report is written by `TraceReporter.reportPassed` with a trailing `\n` only at full/debug verbosity (`runner.ts`).
- `TraceReporter` writes debug lines prefixed `[crucible:debug]`, header once, run tag from the scope, payload bodies capped at 2000 UTF-16 units.
- `TextFormat`: `describe` (`Name: message` for errors), `cut` (UTF-16 slice, holds back a dangling high surrogate), `indented` (splits on CRLF/CR/LF/U+2028/U+2029; non-blank continuation lines get the prefix).

### Design decisions (owner-approved)

- Payload runner drives the real `Judge`/`Extractor` with an `EchoJudge` fake (one per file) that replies `{ verdict|value, reasoning: <prompt> }`; the outcome read is the recorded judge reasoning. No `PayloadAssembler` re-implementation in the harness.
- Report inputs are neutral JSON: causes are `{ name, message }` errors; the fatal cause of an aborted test is named by run number; seq order = call order in the array.
- Golden parity files are generated by jq, never hand-edited; TS reads them through JSON imports.

### Must preserve

- Unit tests for fact scoping (later calls, mutation, concurrency, per-call facts never entering run facts), non-Error / unstringifiable causes, trace stream failures, quiet-level writes, meta values never written (also a fixture), judge/extractor reply parsing.

### Testing

- CLAUDE.md test rules in full; fakes `.fake.ts` one per file, harness classes `*-harness.util.ts`, enums `.enum.ts`, `type`, named exports at end, no comments, no real fs/process in tests.
- Fixtures load via JSON module imports registered in `src/core/test/spec-fixtures.util.ts`.

### References

- [Source: _bmad-output/planning-artifacts/epics.md#Epic 8, Story 8.2, Story 8.5]
- [Source: _bmad-output/implementation-artifacts/8-1-spec-run-options-and-verdicts.md]
- [Source: _bmad-output/implementation-artifacts/deferred-work.md#Deferred from: code review of 8-1]
- [Source: spec/README.md]

## Dev Agent Record

### Agent Model Used

Claude Opus 5.5 (claude-opus-5-5)

### Debug Log References

- Parity probe: `CONFORMANCE_CASES_DIR=<scratch copy with coherent.json/extract.json> CONFORMANCE_SCHEMA_DIR=schemas CONFORMANCE_JUDGE_CONFIG=e2e/crucible.config.json sh e2e/ext/conformance/conformance.sh payloads` (jq 1.7.1, no network) printed 36 payloads; the generated goldens equal them byte for byte, and the TS runner reproduces all 36. Parity holds; no mismatch.
- `make spec-payloads-check`: goldens current; jq builder agrees with all 45 hand-written payload fixtures.
- Runner sanity: editing one golden text and one hand-written payload text failed exactly those cases (runner and jq check); rewriting `excerptChars 500` in trace expectations and `Response excerpt:` in render expectations failed exactly the 56 cases that contain them.
- `npm test`: 35 suites, 1159 tests (8.1 end: 33 suites, 1075).

### Completion Notes List

- Ultimate context engine analysis completed - comprehensive developer guide created
- Areas/operations: `payload/coherent` (30 hand-written + 4 generated), `payload/extract` (15 + 32 generated), `report/render` (56), `report/trace` (24). Outcome kind `text`.
- Payload runner drives the real `Judge` / `Extractor` with `EchoJudge` (replies with the prompt as its reasoning); the outcome is the recorded judge reasoning. Report runner maps neutral run records to `RunResult`s and uses the real `Aggregator` + `Reporter`; trace runner replays events into a real `TraceReporter` writing to `OutputRecorder`.
- Parity approach: `e2e/ext/conformance/spec-payloads.sh` (`make spec-payloads` / `make spec-payloads-check`, CI step in the unit job) builds `spec/payload/*-conformance.json` with the harness's own jq builder; the TS runner runs them with no process spawning or file I/O; `ConformanceGoldens` (TS, JSON imports) fails when the goldens no longer hold exactly the current conformance cases. The check mode also runs the jq builder over the hand-written payload fixtures. Covers Story 8.5's golden-test requirement.
- Per-operation input schemas for all seven operations via a root `oneOf` keyed on `area`/`operation` enums; no SchemaCheck change needed. Five malformed cases added (unknown input key, missing key, mistyped value, unknown operation, operation under another area).
- Removed duplicates: `payload-assembler.util.test.ts` deleted; `reporter.util.test.ts` 874→20 (keeps non-Error / unstringifiable causes); `trace-reporter.test.ts` 213→37 (keeps passing-report writes and broken stream); judge 365→349 and extractor 281→268 (run-then-call fact order). Touched unit tests 1793→674 (−1119). Helpers: `report-harness.util.ts` 181→43, 5 enum files deleted, unused enum members dropped. Added: 39 lines of runners, ~436 lines of harness/util/fake, fixtures (render 2421, trace 835, payload 981 lines), schema +406.
- Expected texts were produced by running the current implementation through the harnesses and reviewed line by line against the README contract; payload texts are independently confirmed by jq.
- No `src/` change. No bug found. Observation (not changed): payload fencing splits on `\n` only, so a `>>>\r` line (CRLF content) or a `>>>` between U+2028/U+2029 is not neutralised; both TS and jq agree. Recorded in fixtures `payload-coherent-crlf-response`, `-lone-cr-response`, `-unicode-separators`, `payload-extract-crlf-response`.

### File List

- spec/README.md
- spec/fixture.schema.json
- spec/payload/coherent.json (new)
- spec/payload/coherent-conformance.json (new, generated)
- spec/payload/extract.json (new)
- spec/payload/extract-conformance.json (new, generated)
- spec/report/render.json (new)
- spec/report/trace.json (new)
- e2e/ext/conformance/spec-payloads.sh (new)
- Makefile
- .github/workflows/ci.yml
- src/core/payload-assembler.util.spec-fixtures.test.ts (new)
- src/core/reporter.util.spec-fixtures.test.ts (new)
- src/core/trace-reporter.spec-fixtures.test.ts (new)
- src/core/spec-fixtures.test.ts
- src/core/test/conformance-goldens.util.ts (new)
- src/core/test/echo-judge.fake.ts (new)
- src/core/test/neutral-run.util.ts (new)
- src/core/test/payload-fixture-harness.util.ts (new)
- src/core/test/report-fixture-harness.util.ts (new)
- src/core/test/trace-fixture-harness.util.ts (new)
- src/core/test/fixture-outcome.util.ts
- src/core/test/spec-fixtures.util.ts
- src/core/test/malformed-fixture.util.ts
- src/core/test/malformed-fixture-name.enum.ts
- src/core/test/report-harness.util.ts
- src/core/test/trace-harness.util.ts
- src/core/test/trace-text.enum.ts
- src/core/test/report-text.enum.ts
- src/core/test/excerpt-chars.enum.ts
- src/core/payload-assembler.util.test.ts (deleted)
- src/core/test/blank-value.enum.ts (deleted)
- src/core/test/multiline-text.enum.ts (deleted)
- src/core/test/near-miss.enum.ts (deleted)
- src/core/test/report-bound.enum.ts (deleted)
- src/core/test/trace-bound.enum.ts (deleted)
- src/core/reporter.util.test.ts
- src/core/trace-reporter.test.ts
- src/core/judge.test.ts
- src/core/extractor.test.ts
- _bmad-output/implementation-artifacts/sprint-status.yaml

## Change Log

- 2026-11-14: Code review: 8 patches applied (tests restored, schema tightened, README clarified, 2 fixtures, registration check), 3 deferred. Status → done.
- 2026-11-14: Story 8.2 implemented — payload and report areas, per-operation input schemas, jq parity goldens and check, duplicated unit tests removed. Status → review.
