---
baseline_commit: c13e0d7
---

# Story 2.4: Choose runs and threshold with eyes open

Status: done

## Story

As a developer,
I want guidance on picking `runs`/`threshold` combinations,
so that I don't misread binomial noise as a broken library (NFR4).

## Acceptance Criteria

1. **Headroom-guidance doc exists.** A doc under `docs/` explains that a threshold is a sampled estimate (binomial model of k-of-n passes); states that a true-0.95 SUT fails `{ runs: 20, threshold: 0.95 }` ≈ 26% of the time (figure recomputed and verified, not copied); gives a false-red probability table across true pass rates × `(runs, threshold)` combinations; and gives recommended headroom patterns (gate below measured reliability; more runs for a tighter gate) with worked examples. [NFR4, PRD FR-1 notes, epics Story 2.4]
2. **`crucible.it()` API reference.** The docs carry an API reference section for `crucible.it()`: signature (both overloads), `runs`/`threshold` defaults (1 / 1.0) and validation (`runs` integer ≥ 1, `threshold` in (0, 1], unknown keys rejected — all `usage` errors at registration), three-zone verdict semantics with the exact formula `need = max(1, ⌈threshold × runs − 1e-9⌉)` and the `0.35 × 20 = 7` example, passed / failed / errored / discarded run meaning, the per-test timeout policy, and the re-entrancy contract (concurrent runs, fresh SUT per arrange, `load`/`append` per-run). [FR1, AD-3, AD-4, AD-5, AD-8]
3. **Docs describe actual behaviour.** Every behavioural statement matches `src/` (runner, aggregator, run-options resolver, reporter, judge, retry, jest binding). Any src/spec mismatch found is documented as actual behaviour and recorded in Completion Notes. No `src/` changes. [epics Story 2.4]
4. **Cost note.** The doc states judge calls per execution = assertions × runs (plus retries), that all runs execute (no early stop on pass), and links the judge model cost data. [NFR2]
5. **Absorbable by Epic 3.** The doc is self-contained and linkable so Story 3.6 getting-started can link/absorb it rather than rewrite it; it does not pre-empt Story 2.5 (`testDefaults`) or Story 3.6 content (getting-started walkthrough, OpenRouter reference, schema explainer, gotchas list). README links it with a minimal edit. [AR13, epics Story 3.6]
6. **Suite stays green.** `npm run lint && npm run format:check && npm run typecheck && npm test && npm run build` pass.

## Tasks / Subtasks

- [x] **Task 1 — Verify the math** (AC: 1)
  - [x] 1.1 python3 script (scratchpad, not committed): `need()` mirroring `Aggregator`, exact binomial CDF via `math.comb`, false-red table, worked examples, Clopper-Pearson interval for a measured rate.
  - [x] 1.2 Check the IEEE-754 example claimed in AD-4 (`0.35 × 20 = 7.000000000000001`) in Node.
- [x] **Task 2 — Write `docs/runs-and-threshold.md`** (AC: 1, 2, 3, 4, 5)
  - [x] 2.1 `crucible.it()` reference: signature, options table, run statuses, three-zone verdict, timeout, re-entrancy.
  - [x] 2.2 Sampled-estimate explanation + 26% figure + false-red table.
  - [x] 2.3 Headroom patterns with worked examples.
  - [x] 2.4 Cost note.
- [x] **Task 3 — README link** (AC: 5)
- [x] **Task 4 — Quality gates** (AC: 6)

## Dev Notes

### Nature of the story

Docs-only. No `src/` behaviour is added, so the TDD rule has nothing to drive; the "test" for this story is the verification script whose output is pasted into Completion Notes. Do not ship the script in the repo (no runtime consumer; it is evidence, not product).

### Actual behaviour to document (read from src at baseline c13e0d7)

- `src/api/crucible.ts` — `crucible.it(name, optsOrBody, maybeBody?)`; `crucible.load` and `crucible.append` both call `runScope.appendState` (identical behaviour today: append string or string[] to the current run's state; anything else → `usage`; outside a run → `usage`).
- `src/bindings/jest.ts` — registration validates options synchronously (`usage` at registration time: non-object options, unknown key, bad `runs`/`threshold`, two bodies, missing body); registers exactly one Jest test with timeout `runner.timeoutFor(runs)`.
- `src/core/run-options-resolver.util.ts` — defaults `runs: 1`, `threshold: 1`; `runs` must be a number, integer, ≥ 1; `threshold` a number with `0 < t ≤ 1`; only keys `runs`, `threshold`.
- `src/core/runner.ts` — all `runs` bodies started concurrently, each in its own `RunScope`; waits for every run (no early stop once `need` is met) unless a halting outcome lands. Classification: body resolves → `passed`; rejection whose cause chain's first `CrucibleError` is `infra` → `errored`; no `CrucibleError` in chain → `failed`; `config`/`usage` `CrucibleError` or a nested `CrucibleVerdictError` → abort siblings, rethrow untouched. Fatal = errored run whose infra error has `retryable !== true` → abort siblings, unsettled runs `discarded`, throw `CrucibleVerdictError('errored', …)` immediately. Timeout: `30000 + (runs − 1) × 1000` ms.
- `src/core/aggregator.util.ts` — `need = max(1, ceil(threshold × runs − 1e-9))`; `passed ≥ need` → pass; `passed + errored < need` → fail; else errored. Discarded counted in no zone.
- `src/core/reporter.util.ts` — headline `X/N runs passed against threshold T (need K)`; errored zone prefixed "Verdict errored, not failed"; per failing/errored run sections; discarded listed on one line.
- `src/core/judge.ts` / `src/core/retry.ts` — 30 s deadline per judge reply attempt (expiry → retryable infra); up to 3 provider attempts per reply with exponential backoff; non-JSON reply re-asked once (`MAX_REPLY_ATTEMPTS = 2`); exhaustion → retryable infra → errored run; provider-classified fatal → non-retryable infra → fatal abort.

### Scope guards

- Story 2.5 adds `testDefaults` in `crucible.config.json` — omit; do not document config-level defaults.
- Story 3.6 owns getting-started, OpenRouter reference, schema explainer, gotchas (unasserted verdicts NFR5, re-entrancy in the gotcha list) — this doc may state the re-entrancy contract as part of the API reference, but no getting-started walkthrough.
- Tone/format: match `docs/judge-models.md` / `docs/judge-validation-runs.md` (plain Markdown, tables, short paragraphs). `.prettierignore` excludes `*.md`, so formatting gates do not touch the doc.

### Previous story intelligence (2.1–2.3)

- 2.1: integer-safe `need`, three zones, verdict error `outcome` `failed | errored`, reporter headline; deferred: no upper bound on `runs`.
- 2.2: ALS per-run state, `load`/`append`, re-entrant bodies.
- 2.3: fatal infra aborts siblings, `discarded` status, config/usage rethrown immediately; post-review commit c13e0d7 made judge-deadline expiry retryable infra (errored, not failed).

### References

- `_bmad-output/planning-artifacts/epics.md` — Story 2.4, 2.5, 3.6; NFR2, NFR4, FR1
- `_bmad-output/planning-artifacts/prds/prd-crucible-ai-2026-08-10/prd.md` — FR-1 notes
- `_bmad-output/planning-artifacts/architecture/architecture-crucible-ai-2026-08-10/ARCHITECTURE-SPINE.md` — AD-3, AD-4

## Dev Agent Record

### Agent Model Used

Claude Opus 5.5 (claude-opus-5-5), unattended

### Debug Log References

### Completion Notes List

- Ultimate context engine analysis completed - comprehensive developer guide created.
- Docs-only story; no `src/` changes. TDD has no behaviour to drive; the verification script below is the evidence for every published number.
- Task 1: `headroom.py` (scratchpad, not committed) mirrors `Aggregator.need` (`max(1, ceil(t*n - 1e-9))`), computes exact binomial tails via `math.comb`, and Clopper-Pearson 95% intervals by bisection. Output:

```text
0.35*20 = 7.0 need 7
need(0.95,20) 19 P(X>=19|p=.95)=0.7358 red=0.2642
runs,thr,need | p=0.99 p=0.95 p=0.90 p=0.85 p=0.80 p=0.70
1,1.0,1 |    1.0%    5.0%   10.0%   15.0%   20.0%   30.0%
5,1.0,5 |    4.9%   22.6%   41.0%   55.6%   67.2%   83.2%
10,0.9,9 |    0.4%    8.6%   26.4%   45.6%   62.4%   85.1%
20,0.95,19 |    1.7%   26.4%   60.8%   82.4%   93.1%   99.2%
20,0.9,18 |    0.1%    7.5%   32.3%   59.5%   79.4%   96.5%
20,0.85,17 |    0.0%    1.6%   13.3%   35.2%   58.9%   89.3%
20,0.8,16 |    0.0%    0.3%    4.3%   17.0%   37.0%   76.2%
50,0.9,45 |    0.0%    3.8%   38.4%   78.1%   95.2%   99.9%
50,0.85,43 |    0.0%    0.3%   12.2%   48.1%   81.0%   99.3%
100,0.9,90 |    0.0%    1.1%   41.7%   90.1%   99.4%  100.0%
CP95 95/100: 0.887-0.984
CP95 19/20: 0.751-0.999
CP95 20/20: 0.832-1.000
CP95 190/200: 0.910-0.976
--- worked examples
runs=20 thr=0.85 need=17 p=0.887 red=18.31% pass=81.69%
runs=50 thr=0.85 need=43 p=0.887 red=19.86% pass=80.14%
runs=20 thr=0.85 need=17 p=0.950 red=1.59% pass=98.41%
runs=50 thr=0.85 need=43 p=0.950 red=0.32% pass=99.68%
runs=20 thr=0.85 need=17 p=0.700 red=89.29% pass=10.71%
runs=50 thr=0.85 need=43 p=0.700 red=99.27% pass=0.73%
runs=20 thr=0.9 need=18 p=0.950 red=7.55% pass=92.45%
runs=20 thr=0.95 need=19 p=0.990 red=1.69% pass=98.31%
runs=20 thr=0.85 need=17 p=0.800 red=58.86% pass=41.14%
runs=50 thr=0.85 need=43 p=0.800 red=80.96% pass=19.04%
10 tests at {20,.95} p=.95, P(>=1 red) = 95.3%
10 tests at {20,.85} p=.95, P(>=1 red) = 14.8%
need 0.07x100: 7.000000000000001 7 no-eps: 8
```

- **26% figure verified:** P(X ≥ 19 | Binomial(20, 0.95)) = 0.7358 → false-red 26.42%. PRD/NFR4 "≈26%" holds; published as 26.4%.
- **Spec discrepancy (AD-4 example):** the spine says `0.35 × 20 = 7.000000000000001`; in IEEE-754 (Node and Python) `0.35 * 20 === 7` exactly, so that example never exercises the epsilon. The doc keeps `0.35 × 20 = 7` as the need example (as asked) and uses `0.07 × 100 = 7.000000000000001` (verified in Node; need 7 with epsilon, 8 without) to illustrate why the epsilon exists. The aggregator behaviour is correct either way; only the spine's illustration is wrong — worth a one-line spine fix later.
- Behaviour documented as implemented (no src/doc mismatch found against AD-3/AD-4/AD-8): defaults runs 1 / threshold 1; validation at registration (`usage`: runs integer ≥ 1, threshold in (0,1], unknown keys, non-object options, missing/duplicate body); `need` formula and three zones; passed/failed/errored/discarded; fatal non-retryable infra aborts siblings (errored verdict, discarded runs), config/usage/nested verdict error rethrown; no early stop once `need` is met; Jest timeout `30000 + 1000 × (runs − 1)` ms, not user-configurable, overrides Jest `testTimeout`; 30 s deadline per judge reply attempt (covers provider retries inside it; expiry → retryable infra → errored); retries 3 provider attempts, 2 reply attempts; `load`/`append` identical per-run appends.
- Decisions (unattended): single doc `docs/runs-and-threshold.md` holding both the `crucible.it()` API reference and the headroom guidance (one linkable page for Story 3.6 to absorb); Story 2.5 `testDefaults` omitted entirely (not yet real); 3.6 gotchas (unasserted verdicts etc.) not pre-empted — re-entrancy stated only as part of the API contract; measurement tip uses `threshold: 1` because the reporter prints the pass count only on red; costs quoted from `docs/judge-models.md` per-call figures; README gets one paragraph + link under the `crucible.it()` intro.
- `.prettierignore` excludes `*.md`, so `npm run format` does not touch docs. Gates: lint, format:check, typecheck, test (230 tests / 14 suites), build — all green.

### File List

New:
- docs/runs-and-threshold.md
- _bmad-output/implementation-artifacts/2-4-choose-runs-and-threshold-with-eyes-open.md

Modified:
- README.md
- _bmad-output/implementation-artifacts/sprint-status.yaml

### Change Log

- 2026-11-13: Story 2.4 implemented — `docs/runs-and-threshold.md` (crucible.it() reference, three-zone verdict, binomial headroom guidance with verified numbers, cost note); README link.

### Review Triage Log

**Checked against src/** (runner, aggregator.util, run-options-resolver.util, reporter.util, judge, retry, state, bindings/jest, api/crucible): defaults 1 / 1.0; registration-time `usage` validation; `need = max(1, ⌈t×n − 1e-9⌉)` and three zones; passed/failed/errored/discarded classification; fatal (`infra`, `retryable !== true`) abort with discarded in-flight runs and `CrucibleVerdictError('errored')`; config/usage/nested verdict rethrow; no early stop; timeout `30000 + (runs−1)×1000`; per-reply-attempt 30 s judge deadline wrapping the 3-attempt retry, 2 reply attempts, deadline expiry = retryable infra (errored); reporter headlines; load/append per-run, `usage` outside a run.

**Math recomputed** (python3, exact binomial via math.comb): every false-red table cell, 0.7358/26.4%, 95.3% suite figure, 18.3%/19.9% at p=0.887, Clopper-Pearson intervals 19/20 (0.751–0.999), 95/100 (0.887–0.984), 190/200 (0.910–0.976). Cost figures match docs/judge-models.md. All correct.

**Fixed in doc:**
- Errored classification wording: it is the *first* `CrucibleError` in the cause chain that decides (a `usage` error wrapping an `infra` one is rethrown, not errored), not "anywhere in the chain".
- Validation bullet: resolver rejects non-objects, `null` and arrays — not "not a plain object" (class instances pass).
- "state" terminology: re-entrancy bullet and example comment no longer define per-run "state" as vocabulary; phrased as what the run's judge calls see.

**Rejected / no change:** README edit accurate and minimal. No Story 2.5 (`testDefaults`) or 3.6 (getting-started, OpenRouter, schema, gotchas) content pre-empted. All ACs 1–5 met; AC6 untouched (doc-only, `*.md` prettier-ignored).
