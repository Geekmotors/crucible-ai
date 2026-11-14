---
baseline_commit: e493d4c
---

# Story 8.4: Porting guide and fixture coverage check

Status: done

## Story

As a maintainer starting a new port,
I want a guide that says exactly what a port must implement and how to prove it,
so that the C# port starts from a checklist, not from reading TypeScript.

## Acceptance Criteria

1. **Porting guide.** `spec/PORTING.md`, linked from `spec/README.md` and from the root README's Documentation section, is a checklist a C# developer can follow without reading TypeScript:
   1. **Public API** a port provides: every function (`crucible.it`, `describe`, `gate`, `coherent`, `extract`, `facts`, deprecated `load` / `append`, run context `t`), every run option and call option with default and valid range, every config field and provider, the environment variables, every error kind (with `retryable`), the verdict outcomes and the report text — sourced from `docs/api.md` and cross-referenced to the fixture operation(s) that pin each.
   2. **Runner-neutral engine vs runner adapter.** What the gate/run loop does (concurrent runs, test deadline, fatal-error abort, discarded runs, per-run context and the async-context mechanism per language: Node `AsyncLocalStorage`, .NET `AsyncLocal<T>`, Python `contextvars`, Java `ScopedValue` / `ThreadLocal`), what an adapter does (registration, variants, runner timeout, group settings via the runner's suite tree or a stack), the blocked variants and why.
   3. **What the fixtures cover vs what each port tests itself** (runner adapter, timing/async, one live smoke, the conformance harness).
   4. **Shared assets** a port embeds or reads (`schemas/coherent.md` / `extract.md` verbatim, `schemas/crucible.config.schema.json`, the conformance cases, `spec/`), and **versioning** (spec version vs package version; how a port declares the spec version it implements).
   5. **Language notes** in one place (JSON string escaping incl. `System.Text.Json`, UTF-16 vs code points, `Math.round` ties, 64-bit timeout arithmetic, locale-independent lower-casing, ECMAScript `trim` set, WHATWG URL parsing, …) with links into the README sections.
   6. **First week order**: fixture runner → run-options / verdict → payload → judge reply → provider → config/jsonc → report → gate → adapter → live smoke → conformance.
2. **`spec/README.md`** links the guide, lists `surface.json` / `surface.schema.json` in Layout, and the README's public-API / runner-specific / what-ports-test items are present (via the guide).
3. **Surface manifest.** `spec/surface.json` (validated by `spec/surface.schema.json`, same in-house schema subset) lists the public surface — operations, functions, run options (default, valid range), call options, config fields, providers, environment variables, error kinds (with `retryable`), verdict outcomes, report and trace text items (headline variants, sections, fields) — each with the fixture case ids that cover it.
4. **Coverage check** (`npm test`, so CI) fails when:
   - an item lists no fixture id, or a listed id does not exist;
   - a listed case does not exercise the item (option / field / provider not mentioned in the case input; error kind / `retryable` not the case's expected error; outcome not the case's expected outcome; report marker text not in the case's expected text);
   - the operations in `spec/` and in the manifest differ;
   - the TypeScript public surface has a function, run option, call option, config field, provider or error kind not in the manifest, or the manifest lists one TypeScript does not have (derived from real sources: `CrucibleSurface` / `RunContext` / `RunOptions` / `CoherentOptions` / `ExtractOptions` / `CrucibleErrorKind` via type-checked key records, and `schemas/crucible.config.schema.json` for config fields, `testDefaults` keys and defaults, and providers).
   - No network, no file I/O at test time (JSON module imports).
5. **Gaps found are closed or listed.** Each gap the check finds gets fixtures (new cases, or a new operation where none exists) or is listed in the story/deferred work with the reason.
6. **No `src/` behaviour change.** `make spec-goldens-check` keeps working (the manifest and its schema are not fixture files).
7. **Gate.** `npm run lint && npm run format:check && npm run typecheck && npm test && npm run build && npm run verify:pack && npx tsc --noEmit -p e2e && make spec-goldens-check` pass.

## Tasks / Subtasks

- [x] Coverage check first (red): `surface.schema.json`, `SpecSurface` harness, `spec-surface.test.ts`; run it on an initial manifest and record the gaps (AC 3, 4)
- [x] Close gaps: new fixture cases / operation, manifest entries (AC 5)
- [x] `spec-goldens.sh`: exclude `*.schema.json`; register `surface.json` (AC 6)
- [x] `spec/PORTING.md` (AC 1), `spec/README.md` + root README links (AC 2)
- [x] Gate (AC 7)

### Review Findings

- [x] [Review][Patch] PORTING §2 halt rule: a `usage`/`config` error anywhere down the cause chain halts, not only a direct throw [spec/PORTING.md]
- [x] [Review][Patch] PORTING §2 `inferenceTimeout` is per reply (provider attempts included), the re-ask gets a fresh budget [spec/PORTING.md]
- [x] [Review][Patch] PORTING §2 runner timeout capped at 2147483647 [spec/PORTING.md]
- [x] [Review][Patch] PORTING §1 missing api.md rules: validation timing, gate arity/validation, facts read at call time, `t` sync vs async errors and shared state, unusable extract reply → retryable infra, missing key → config, testTimeout caps inferenceTimeout, group + trailing timeout, `meta` model/messages replaced, exported types, Jest/Vitest-only details pointer [spec/PORTING.md]
- [x] [Review][Patch] Done-when checklist contradicted "a new port may omit load/append" [spec/PORTING.md, spec/README.md]
- [x] [Review][Patch] xUnit/NUnit/MSTest adapter guidance (attributes or a gate inside `[Fact]`); C# integration notes inlined, `_bmad-output` link removed [spec/PORTING.md]
- [x] [Review][Patch] §5 language facts corrected: Python utf-16 `surrogatepass`, C# `EnumerateRunes` lone surrogates, `System.Text.Json` relaxed escaping, number formatting thresholds (C#/Python/Java), `Math.Floor(x + 0.5)` edge, `ToLowerInvariant` simple mapping, Python `strip` U+FEFF, Java `trim`/`strip`, `AsyncLocal` no flow-back, `asyncio.to_thread` vs executors, `ScopedValue` JEP 506; uncertain claims marked *verify* [spec/PORTING.md, spec/README.md]
- [x] [Review][Patch] callOptions coverage ignored the owning assertion and accepted run-level facts/test strict [src/core/test/surface-check.util.ts]
- [x] [Review][Patch] errorKinds drift collapsed the two infra `retryable` entries [src/core/test/surface-check.util.ts, public-surface.util.ts]
- [x] [Review][Patch] Duplicate manifest names undetected [src/core/test/surface-check.util.ts]
- [x] [Review][Patch] Malformed-manifest tests accepted any finding; now each asserts its own detector, with variants for function, config field, provider, enum values, duplicate, infra retryable and call-option mis-citations; case ids moved to `spec-case-id.enum.ts` [src/core/test/malformed-surface.util.ts]
- [x] [Review][Patch] reportText: failed headline marker also matched the passed headline; settled passed/errored, verdict pass/errored and false-verdict tally markers missing [spec/surface.json]
- [x] [Review][Patch] Lost cases restored: extract `facts` option null and object (were in `FactsHarness.invalid` for the extractor path) [spec/assertion/call.json]
- [x] [Review][Patch] `spec-goldens.sh` excluded `surface.json`/`*.schema.json` by basename at any depth; now exact root paths [e2e/ext/conformance/spec-goldens.sh]
- [x] [Review][Patch] Extra argument after `options` unspecified; listed as port's business [spec/README.md]
- [x] [Review][Defer] `functions` citations only checked for existence (load/append/t.* cite payload cases) — deferred
- [x] [Review][Defer] `CRUCIBLE_VERBOSE` not derived from any TS source; environment drift one-way — deferred
- [x] [Review][Defer] operation drift compares against the `SpecFixtures` registry, not the directory (the directory side is `make spec-goldens-check` in CI) — deferred
- [x] [Review][Defer] default/values check one-sided and against the editor schema, not runtime defaults — deferred
- [x] [Review][Defer] `assertionCallInput` schema does not cap `args` at 3 (in-house checker has no `maxItems`) — deferred
- [x] [Review][Defer] `docs` anchors in `surface.json` unchecked — deferred

## Dev Notes

### Current state (read before touching)

- `spec/` (Stories 8.1–8.3, 8.6): 10 operations in 16 fixture files; `fixture.schema.json` (draft-07 subset checked by `src/core/test/schema-check.util.ts`: `$ref type required properties additionalProperties(bool) items minItems minLength minimum pattern enum oneOf`); registry `src/core/test/spec-fixtures.util.ts` (JSON module imports, `SpecFixtures.files()`); schema/id/golden checks in `src/core/spec-fixtures.test.ts`.
- `e2e/ext/conformance/spec-goldens.sh check` fails on any `spec/**/*.json` (except `fixture.schema.json`) not imported by the registry file (grep on `'../../../<path>'`).
- Runtime key lists are private (`RunOptionsValidator.KNOWN_KEYS`, `Judge/Extractor.OPTION_KEYS`, `config.ts KNOWN_FIELDS`). Do NOT export them for the test (test-induced design damage). Use type-level records (`satisfies Record<keyof RunOptions, true>` — fails typecheck on a missing or extra key) and the shipped JSON schema.
- Coherent/extract/facts argument validation (`usage` for non-string text, unknown option, bad `as`, non-boolean `strict`, bad `facts`) and how call options reach the payload have no fixture today (only resolved values in `payload/*`). Expect the check to flag `as` / `facts` validation; close it with a new operation if needed.
- Engine: `Runner` (concurrent runs, `AbortController`, deadline timer, fatal = `infra` non-retryable aborts, rethrow of `usage`/`config`/verdict errors), `RunScope` (`AsyncLocalStorage<RunStore>`), `RunHandle` (`t`, closes with its run), `Gate` (declare → `{ test, timeout }`), `GroupSettings` (stack, or `groupPath` from the runner's suite tree on Vitest), `RunnerWrapper` + `RunnerSpec` (variant tree: `register` / `passthrough` / `table`, `forward`, `blocked` reasons in `blocked-reason.enum.ts`), bindings `JestBinding` / `VitestBinding`.

### Must preserve

- Every existing fixture id, file, golden and runner; `make spec-goldens(-check)` behaviour.

### Testing

- CLAUDE.md test rules: one class per file, harness `*-harness.util.ts`, utilities `*.util.ts`, enums `.enum.ts`, `type`, named exports at end, no comments, no `readonly` in test helpers, no real fs/process state, assert outcomes. Coverage assertions are `toEqual([])` on a list of findings, like `spec-fixtures.test.ts`.

### References

- [Source: _bmad-output/planning-artifacts/epics.md#Story 8.4]
- [Source: spec/README.md], [Source: docs/api.md], [Source: docs/runs-and-threshold.md]
- [Source: _bmad-output/planning-artifacts/csharp-port-notes.md]
- [Source: _bmad-output/implementation-artifacts/8-1-…, 8-2-…, 8-3-…, 8-6-… story files; deferred-work.md Epic 8 entries]

## Dev Agent Record

### Agent Model Used

Claude Opus 5.5 (claude-opus-5-5)

### Debug Log References

- Red: first run of `spec-surface.test.ts` on the initial manifest failed 3 tests: `callOptions coherent.facts`, `extract.as`, `extract.facts` had no fixture (schema + uncited), and 4 mis-citations (`testTimeout`, `provider`, `baseUrl`, `openai-compatible` cited cases that never set them).
- Each malformed-manifest variant (11) was probed and fails for its own reason (uncited, unknown id, not exercised, wrong kind, wrong retryable, text missing, option missing/unknown, default differs, operation missing, call option missing).
- `assertion/call` runner sanity: flipping `usage` → `config` and one `strict` mode in a copy failed 44 of 67 cases; restored file passes.
- Gate: lint, format:check, typecheck, `npm test` (40 suites, 1461 tests), build, verify:pack, `tsc -p e2e`, `make spec-goldens-check` all pass.

### Completion Notes List

- `spec/PORTING.md`: done-when checklist; §1 public API (functions, run/call options, config fields, providers, env vars, errors, verdict/report) each mapped to operations; §2 engine (gate loop steps, settle/halt rules, judge-call rules) vs runner adapter (registration, runner timeout = declared testTimeout + 5000 or runner max, variants, blocked variants and reasons, group settings by stack or suite tree or attributes, argument forms), per-run context per language; §3 fixtures vs port-own tests; §4 shared assets, versioning (spec version = repo tag/commit; port declares it + skipped ids), reusing the surface check; §5 language-notes table linked into README sections; §6 first-week order. Linked from `spec/README.md` and root README Documentation.
- `spec/surface.json` + `surface.schema.json`: operations, functions (with `portTests`), runOptions, callOptions, configFields, providers, environment, errorKinds (infra split by retryable), verdictOutcomes, reportText (markers for the headline variants, sections, fields and trace lines; review added the settled passed/errored, verdict pass/errored and false-verdict tally markers).
- Coverage check `src/core/spec-surface.test.ts` (`SurfaceCheck`, `PublicSurface`): uncited items, unknown ids, cited cases that do not exercise the item (mention in input / exact error kind+retryable / verdict outcome / marker in expected text of the right operation), operation drift, and TS surface drift (type-checked `Record<keyof …, true>` over `CrucibleSurface`, `RunContext`, `RunOptions`, `CoherentOptions`, `ExtractOptions`, `ExtractType`, `CrucibleErrorKind`, `VerdictOutcome`; config schema fields, required, defaults, enums, `testDefaults` keys, providers, default key variable). No runtime key list exported from `src/`.
- Gap closed: new operation `assertion/call` (69 cases after review, `spec/assertion/call.json`, schema branch, README contract, runner `scoped-assertions.spec-fixtures.test.ts` through real `ScopedAssertions` → `Judge`/`Extractor` with `EchoJudge`). Pins facts/coherent/extract argument and option validation and how `facts`/`as`/`strict` reach the payload. All pass on current TS (no bug).
- Duplicates removed: JSON-expressible usage cases in `judge.test.ts` (non-string args, invalid facts, string/array/null/unknown-key options) and `extractor.test.ts` (9 option cases), `FactsHarness`/`InvalidFacts` trimmed to the non-JSON inputs (holed array, String object); non-plain option objects kept.
- Gaps listed, not closed (deferred-work): argument forms of it/describe/gate (functions cannot be fixtures); reportText manifest is hand-maintained; "mentions" heuristic.
- `spec-goldens.sh` registry check ignores `*.schema.json` and `surface.json`. No `src/` behaviour change.

### File List

- spec/PORTING.md (new)
- spec/surface.json (new)
- spec/surface.schema.json (new)
- spec/assertion/call.json (new)
- spec/README.md
- spec/fixture.schema.json
- README.md
- e2e/ext/conformance/spec-goldens.sh
- src/core/spec-surface.test.ts (new)
- src/core/scoped-assertions.spec-fixtures.test.ts (new)
- src/core/test/surface-check.util.ts (new)
- src/core/test/public-surface.util.ts (new)
- src/core/test/spec-surface.util.ts (new)
- src/core/test/malformed-surface.util.ts (new)
- src/core/test/malformed-surface-name.enum.ts (new)
- src/core/test/assertion-call-fixture-harness.util.ts (new)
- src/core/test/spec-fixtures.util.ts
- src/core/test/facts-harness.util.ts
- src/core/test/invalid-facts.enum.ts
- src/core/judge.test.ts
- src/core/extractor.test.ts
- _bmad-output/implementation-artifacts/8-4-porting-guide-and-coverage.md (new)
- _bmad-output/implementation-artifacts/deferred-work.md
- _bmad-output/implementation-artifacts/sprint-status.yaml

## Change Log

- 2026-11-14: Story 8.4 implemented — porting guide, surface manifest + coverage check, `assertion/call` operation (gap found by the check), duplicated unit cases removed. Status → review.
- 2026-11-14: Code review: 15 patches applied (see Review Findings), 6 deferred. Status → done.
