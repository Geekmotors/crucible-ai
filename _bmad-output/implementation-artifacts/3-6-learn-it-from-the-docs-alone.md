---
baseline_commit: ce90eeb
---

# Story 3.6: Learn it from the docs alone

Status: done

## Story

As a new user,
I want docs that take me from install to a trustworthy CI gate,
so that I never need to read source or file an issue to use v1 correctly.

[Source: epics.md#Story 3.6; AR13; PRD §4.3, §6.1; NFR3/NFR4/NFR5]

## Acceptance Criteria

1. **Getting started.** A getting-started page walks install → `crucible.config.json` (provider/model/`meta`) → `OPENROUTER_API_KEY` → first smoke test → multi-run gate → reading a failure → verbosity, and links (absorbs, not rewrites) the Story 2.4 headroom guidance in `docs/runs-and-threshold.md` (NFR4 — states the ~26% false-red fact). [Epic 3.6 AC 1, AR13]
2. **Assertion-selection ladder taught early.** Getting started teaches the PRD §4.3 ladder before the first `coherent()` example: plain framework assertions first; `exact()`/`range()` for values embedded in prose (post-MVP, not shipped — say so); `coherent()` only for inherently semantic claims. [PRD §4.3, deferred-work]
3. **Configuration / OpenRouter reference.** Documents every config field (`provider`, `model`, `meta`, `verbosity`, `testDefaults`, `excerptChars`), each validation rule and the error kind it raises, where the file is read from and when, `OPENROUTER_API_KEY`, `CRUCIBLE_VERBOSE`, failure classes of OpenRouter errors (retryable vs fatal), and CI-secret guidance (repository secret, step-scoped env, PR lanes provider-free). Warns that API keys must never go inside `meta`. [Epic 3.6 AC 2, NFR1, deferred-work 1.1]
4. **Instruction-schema explainer.** Covers the concept (AD-1 shell/schema split), `schemas/coherent.md`'s contract (frontmatter, judgment rules, output JSON, payload assembly), how editing it changes behaviour with no TypeScript change (FR6), versioning with the package (AD-11), and the Story 3.4 conformance harness. [Epic 3.6 AC 3]
5. **Gotchas.** A gotchas page covers at least: unasserted verdicts (NFR5), the re-entrant body requirement, the judge false-negative stance (NFR3), and every deferred-work item tagged for Story 3.6 (see Dev Notes "3.6 obligations"). [Epic 3.6 AC 4]
6. **API reference.** The public surface (`crucible.it/coherent/load/append`, `CrucibleError`, `CrucibleVerdictError`, exported types) is documented, including that `coherent` judges the run's state as it stands at call time and that `load`/`append` both append. [deferred-work 3.3 review]
7. **Index and README.** `docs/README.md` indexes every doc; the root `README.md` links out to it and to getting started, and its examples match the current API.
8. **Docs match the code.** Every behavioural claim is checked against `src/` and config validation; every TypeScript example type-checks against the built `dist/index.d.ts` (method recorded). Doc-vs-code mismatches are recorded: docs fixed when docs are wrong; code bugs deferred (no `src/` change in this story).
9. **Terminology.** "State" is the term; domain examples illustrate only, never define (spine Consistency Conventions).
10. **Housekeeping and gates.** Resolved 3.6 entries removed from `deferred-work.md` and listed in this story; `npm run lint && npm run format:check && npm run typecheck && npm test && npm run build` green.

## Tasks / Subtasks

- [x] Task 1: Verify behaviour against `src/` for every claim to be written (config, binding, runner, judge, state, retry, OpenRouter adapter, reporter).
- [x] Task 2: `docs/getting-started.md` (AC 1, 2).
- [x] Task 3: `docs/configuration.md` (AC 3).
- [x] Task 4: `docs/instruction-schema.md` (AC 4).
- [x] Task 5: `docs/gotchas.md` (AC 5).
- [x] Task 6: `docs/api.md` (AC 6).
- [x] Task 7: `docs/README.md` index; root `README.md` link-out; fix inaccuracies in existing docs (AC 7, 8).
- [x] Task 8: Type-check every `ts` example against `dist/index.d.ts` from a scratchpad harness (AC 8).
- [x] Task 9: deferred-work cleanup, gates, self-review, Review Triage Log (AC 10).

## Dev Notes

### Scope

Docs-only story. No `src/` change (CLAUDE.md TDD applies to `src/`; docs are exempt). `*.md` is prettier-ignored. `docs/` is **not** in the npm tarball (`files: dist, schemas`); `README.md` is. Story 3.7 owns the npm README check — keep README examples correct now.

### Existing docs (absorb / link, do not rewrite)

- `docs/runs-and-threshold.md` — `crucible.it()` reference (signature, options, `testDefaults`, statuses, three zones, failure report, verbosity, timeout, re-entrancy) + headroom guidance, false-red table, cost. Canonical for those topics; new pages link to its anchors.
- `docs/judge-models.md` — model comparison, recommended default (`deepseek/deepseek-v4-flash-0731`), reasoning-effort/deadline findings, TLS-proxy gotcha.
- `docs/judge-validation-runs.md` — verbatim validation transcripts.
- `schemas/coherent.md` — the schema itself (the explainer describes it; never paraphrase its rules into new rules).
- `README.md` — motivation, example, judge validation table, alternatives.

### Verified code facts (source of truth for the docs)

- Public API (`src/api/crucible.ts`, `src/index.ts`): `crucible` (frozen: `it`, `coherent`, `load`, `append`), `CrucibleError` (`kind: 'config'|'usage'|'infra'`, `retryable` on infra), `CrucibleVerdictError` (`outcome: 'failed'|'errored'`); types `RunOptions`, `TestBody`, `VerdictOutcome`, `CrucibleErrorKind`, `ProviderAdapter`, `CompletionRequest`, `FailureClass`. No `it.only/skip/each`.
- Config (`src/core/config.ts`): read from `join(process.cwd(), 'crucible.config.json')`, lazily on first test execution, memoized per module registry (per Jest test file). BOM stripped. Checks in order: missing/unreadable/invalid JSON/non-object root → `config`; top-level key-like field (case-insensitive exact `apikey|api_key|key|token|secret|authorization`) → `config`; unknown field → `config`; `provider` non-empty string and registered (`openrouter` only) → `config`; `model` non-empty (whitespace-only rejected); `meta` plain object when present, never inspected; `verbosity` ∈ default/full/debug (`config`, validated even when env is set); `CRUCIBLE_VERBOSE` exact match, empty ignored, invalid → `usage`; `testDefaults` as runs-and-threshold.md; `excerptChars` integer ≥ 1 (default 500).
- No public provider registration: `providerRegistry` is internal; only `openrouter` resolvable.
- OpenRouter (`src/providers/openrouter.ts`): POST `https://openrouter.ai/api/v1/chat/completions`, body `{ ...meta, model, messages }` (so `meta.model`/`meta.messages` are overridden); key read from `OPENROUTER_API_KEY` (trimmed) at each judge call; missing → `CrucibleError('config')` when the first `coherent` runs (tests with no `coherent` need no key). HTTP 408/429/5xx/network → retryable; other 4xx → fatal (abort test, `errored`). Embedded envelope error with numeric code classified like HTTP.
- Retry (`src/core/retry.ts`): 3 attempts, backoff 250 ms × 2^(n−1) × (1+jitter); global `setTimeout` (fakeable). Judge (`src/core/judge.ts`): payload assembled synchronously at call time (state snapshot); 30 s per reply attempt via `AbortSignal.timeout`; invalid verdict JSON re-asked once; code fences stripped.
- State (`src/core/state.ts`): ALS per run; `load`≡`append` (append); non-string entries → `usage`; outside a `crucible.it` body → `usage`.
- Binding (`src/bindings/jest.ts`): global `it` looked up at registration; missing → `usage` ("injectGlobals: false is not supported in v1").
- Runner (`src/core/runner.ts`): deadline via global `setTimeout` (fakeable); Jest backstop = deadline+5 s when `runs` declared, ~24.8 days when not.

### 3.6 obligations (collected from deferred-work and story files)

| Source | Obligation | Doc |
| --- | --- | --- |
| spec 1.1 | Never put API keys in `meta` (not scanned) | configuration, gotchas |
| PRD §4.3 (2026-09-14) | Teach assertion-selection ladder | getting-started |
| spec 1.4 | `injectGlobals: false` unsupported | gotchas |
| 2.2 | `load` = arrange / `append` = after act; both append; `beforeEach` arranges once per test, not per run, and `load` there throws | api, gotchas |
| 2.4 | Gotcha list incl. unasserted verdicts, re-entrancy | gotchas |
| 2.5 review | `jest.useFakeTimers()` fakes crucible's deadline/backoff | gotchas |
| 3.2 / runs-and-threshold | Error messages appear verbatim in reports/traces (secrets) | gotchas |
| 3.3 review | `coherent` snapshots state at call time | api |
| 3.3 e2e | Asserting an expected-false verdict misattributes "first failure" (AD-13 open) | gotchas |
| 3.3 e2e | Reasoning effort vs deadline; recommend low, not none (OQ-6) | configuration, gotchas |
| 1.3 / 3.3 | TLS proxy `--use-system-ca` | gotchas |
| spec 1.3 / OQ-6 | Judge guidance status: recommended default, not GA guidance | configuration |
| 3.3 e2e | Contradicting state facts undefined in schema (no supersede rule) | instruction-schema, gotchas |

Not resolved by docs (stay deferred): model enum promotion (src), per-attempt timeout policy, bundler-inlined schema walk, schema-conflict rule itself, AD-13 amendment, fake-timer immunity (code), all 3.1/3.2/3.4/3.5 code items.

### Decisions (unattended — user away)

- New pages: `docs/README.md` (index), `getting-started.md`, `configuration.md`, `instruction-schema.md`, `gotchas.md`, `api.md`. Existing pages kept canonical for their topics.
- `api.md` added (not in the epic list) because the 3.3 review item says "API docs", and runs-and-threshold.md covers only `crucible.it()`.
- Examples use a neutral placeholder SUT (`createAssistant()`); examples verified by a scratchpad extractor + `tsc` against `dist/index.d.ts` with ambient declarations for the placeholder SUT and Jest globals.
- README keeps relative `docs/` links (consistent with existing). On npm they will not resolve without a `repository` field — flagged for Story 3.7.

### References

- [Source: _bmad-output/planning-artifacts/epics.md#Story 3.6, AR13, NFR1–NFR5]
- [Source: _bmad-output/planning-artifacts/prds/prd-crucible-ai-2026-08-10/prd.md §3, §4.2–4.5, §6.1, §8]
- [Source: _bmad-output/planning-artifacts/architecture/architecture-crucible-ai-2026-08-10/ARCHITECTURE-SPINE.md AD-1, AD-11, AD-12, AD-13, Consistency Conventions]
- [Source: _bmad-output/implementation-artifacts/deferred-work.md]
- [Source: 2-2, 2-4, 2-5, 3-2, 3-3, 3-4, 3-5 story files; spec-1-1, spec-1-3, spec-1-4]

## Dev Agent Record

### Agent Model Used

Claude Opus 5.5 (claude-opus-5-5), unattended (user away — decisions recorded in Dev Notes).

### Debug Log References

- **Example type-check (AC 8).** Scratchpad harness (`doccheck/extract.py`, not committed): extracts every ```` ```ts ```` block from `README.md` and `docs/*.md` into its own module under `gen/test/`, adds `import { crucible } from 'crucible-ai'` when absent, and compiles with `tsc` (strict, `moduleResolution: bundler`) where `crucible-ai` → the freshly built `dist/index.d.ts` and `@jest/globals` → the repo's Jest types; ambient declarations only for placeholder SUTs (`createAssistant`, `createStory`, `sut`, `reply`, `body`) and Jest globals. Result: 13 blocks, `tsc` exit 0. Negative control (unknown option `retries`, one-argument `coherent`) → 2 errors, so the harness does catch API misuse. 4 signature-reference blocks (non-runnable `name: type` notation) skipped and checked by hand against `dist/index.d.ts`.
- **Links/JSON.** Scratch link checker: every relative link and `#anchor` in README + docs resolves (GitHub slug rules); every ```` ```json ```` block parses. 0 problems.
- **Gates:** lint, format:check, typecheck, test (15 suites / 350 tests), build — green. No `src/` change.

### Completion Notes List

- Ultimate context engine analysis completed - comprehensive developer guide created.
- New docs: `docs/README.md` (index), `getting-started.md` (install → config → key → smoke → gate → failure → verbosity; assertion ladder in step 2 before any `coherent()`; NFR4 26% fact + links to headroom/false-red/cost), `configuration.md` (all six fields, ordered validation table with error kinds, `meta` passthrough + key warning, env vars, OpenRouter failure classes, judge-model guidance status, CI-secret pattern), `api.md` (it/coherent/load/append, call-time state snapshot, errors, exported types), `instruction-schema.md` (AD-1 split, coherent.md parts, payload example, edit-to-change-behaviour (FR6), versioning (AD-11), conformance harness), `gotchas.md` (15 gotchas).
- Existing docs kept canonical and linked: runs-and-threshold.md (one sentence fixed — see mismatches), judge-models.md, judge-validation-runs.md, schemas/coherent.md (unchanged).
- README: "Get started" section (install, requirements, links to getting started + docs index). Existing example already matches the current API; untouched.
- **Doc-vs-code mismatches:** (1) runs-and-threshold.md said "a custom adapter must not either", implying user adapters — there is no public registration API → doc fixed; exported-but-unusable `ProviderAdapter` types deferred (code/surface decision). (2) `crucible.it` type is one permissive signature while docs present overloads → api.md states the truth; type overloads deferred. (3) README relative docs links will break on npm (no `repository`, docs not packed) → deferred to 3.7. No code bug changes behaviour claimed in docs.
- **Resolved 3.6 deferred-work entries (removed from deferred-work.md):** meta-key gotcha (spec 1.1); assertion-selection ladder (PRD §4.3); fake-timers gotcha (2.5 review — docs option chosen; making the deadline immune to fake timers remains an optional code change, not tracked); coherent call-time state snapshot (3.3 review); low-not-none reasoning guidance (3.3 e2e). Partially: spec 1.4 item — `injectGlobals: false` documented; support decision + bundler walk stay deferred.
- **Covered without a deferred entry:** unasserted verdicts (NFR5), re-entrancy, judge false-negative stance (NFR3), `beforeEach` once-per-test and `load` outside a run, `load` never replaces, expected-false attribution (3.3 e2e, AD-13 still open), conflicting state (3.3, schema rule still open), deadline vs `testTimeout`, verbatim error/response printing, data leaving the machine, parallel spend, config cwd, TLS proxy.

### File List

- `docs/README.md` (new)
- `docs/getting-started.md` (new)
- `docs/configuration.md` (new)
- `docs/api.md` (new)
- `docs/instruction-schema.md` (new)
- `docs/gotchas.md` (new)
- `docs/runs-and-threshold.md` (modified — custom-adapter sentence)
- `README.md` (modified — Get started section)
- `_bmad-output/implementation-artifacts/3-6-learn-it-from-the-docs-alone.md` (new)
- `_bmad-output/implementation-artifacts/deferred-work.md` (modified)
- `_bmad-output/implementation-artifacts/sprint-status.yaml` (modified)

### Change Log

- 2026-11-13: Story 3.6 — shipped docs set (getting started, configuration/OpenRouter, API, instruction schema, gotchas, index), README link-out, examples type-checked against `dist`. Status → done.

### Review Triage Log

Self-review 2026-11-13 against ACs, every claim re-checked against `src/` (no adversarial review pass).

- AC 1 met: getting-started steps 1–8 in the AC order; NFR4 fact stated, links to headroom patterns, false-red table, cost.
- AC 2 met: ladder is step 2, before any `coherent()` example; `exact()`/`range()` flagged as planned, not shipped.
- AC 3 met: six fields, validation order + kinds (incl. `CRUCIBLE_VERBOSE` = `usage`, missing key = `config`), cwd/lazy/per-file read, OpenRouter retryable/fatal classes, CI-secret guidance mirroring ci.yml, `meta` key warning.
- AC 4 met: concept, frontmatter/rules/output/payload, FR6 edit path, AD-11 versioning, conformance harness.
- AC 5 met: NFR5, re-entrancy, NFR3 plus all 3.6 obligations table rows.
- AC 6 met: api.md incl. call-time snapshot and load≡append.
- AC 7 met: docs/README.md indexes all 8 pages; README links out; README example unchanged and type-checks.
- AC 8 met: harness + negative control; 3 mismatches recorded (1 doc fixed, 3 deferred).
- AC 9 met: "state" defined generically; examples illustrate (no domain vocabulary as definition; grep clean).
- AC 10 met: deferred-work cleaned; gates green.
- [x] [Patch] api.md concurrent-judgment example first awaited the SUT between starting judgments (a rejected judgment could go unobserved → unhandled rejection); rewritten to start judgments with no intervening `await`, and the rule stated.
- [x] [Patch] Examples first used contradicting state ("meeting moved", "upgraded plan"), which the schema leaves undefined; replaced with consistent facts.
- [x] [Patch] Removed advice to use `expect.assertions(n)` — it counts across all concurrent runs of one Jest test, so it would mislead.
- [x] [Patch] configuration.md failure table: timeout / bad-JSON rows were labelled "retryable" though they are not retried by the provider loop → "non-fatal"; backoff stated as exact ranges.
- [x] [Defer] Exported provider types without registration API; permissive `crucible.it` type; README links on npm → deferred-work.
- Accepted: fake-timer description does not claim whether the per-reply 30 s `AbortSignal.timeout` is faked (depends on Jest's fake-timer implementation); the claims made (deadline, backoff via global `setTimeout`) are code-verified.

### Doc fact-check

Independent check of getting-started, configuration, api, instruction-schema and gotchas against `src/` and `schemas/coherent.md`.

Verified accurate: config location (cwd only, no parent search) and lazy per-test-file load; field table, defaults (`runs` 1, `threshold` 1, `excerptChars` 500, verbosity `default`); validation order and kinds (key-like before unknown fields, `CRUCIBLE_VERBOSE` → `usage`, empty ignored, BOM tolerated); config/usage errors abort the whole test and rethrow unchanged; key trimming; retry policy (3 attempts, 250–500 / 500–1000 ms backoff, 408/429/5xx/network retryable, other 4xx fatal → abort, embedded numeric codes treated as HTTP status); 2 reply attempts on bad JSON, fence tolerance; 30 s per reply attempt; deadline 30 s + 1 s × (runs − 1); Jest timeout = deadline + 5 s only when `runs` declared, else ~24.8 days; `meta` spread before `model`/`messages`; trace shows meta keys only; three-zone verdict and `need`; false-red figures (26%, 1.6%); report headline/field format and 3-run cap; payload assembly and fence neutralising; schema loaded once per test file from the package.

Fixed:
- configuration.md: "30 s test deadline" corrected to the real formula (30 s + 1 s per extra run); clarified the 30 s per-call limit sits inside the test deadline.
- configuration.md: added the missing `usage` error for non-JSON-serializable `meta` at judge-call time.
- getting-started.md: said `createAssistant` is a stand-in for the reader's system; noted the sample failure report is trimmed to one run (a real 5-failure report shows 3 runs plus a hidden-runs line and claim tally).
