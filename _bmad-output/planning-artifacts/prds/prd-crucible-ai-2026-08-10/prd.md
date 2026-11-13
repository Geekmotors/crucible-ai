---
title: Crucible — Semantic Assertion Library for Non-Deterministic Systems
status: final
created: 2026-08-10
updated: 2026-09-14
---

# PRD: Crucible

*Package name: `crucible-ai` (npm availability verified 2026-08-10).*

## 0. Document Purpose

This PRD defines v1 (MVP) of Crucible, an open-source TypeScript library for semantically testing non-deterministic inference output inside existing test suites. Readers: the builder (Jack), downstream architecture and epic/story workflows, and future contributors. Vocabulary is anchored in §3 Glossary; features are grouped with globally numbered FRs; assumptions are tagged `[ASSUMPTION]` inline and indexed in §9. Technical mechanism decisions (architecture split, config shapes, portability analysis) live in `addendum.md`; competitive research in `research-landscape.md`.

## 1. Vision

Crucible is a code-first semantic assertion library for systems with non-deterministic, inference-driven output. Today's test frameworks (Jest, xUnit, JUnit) assert deterministically: same input, same output, exact match. Inference breaks that contract — twenty identical calls produce twenty different strings, some correct, some not. Crucible closes the gap by making a semantic claim ("Jane won't find Bob, because they aren't in the same place") a first-class, probabilistically evaluated assertion inside the developer's existing test suite.

The design philosophy is code-first: the system under test is instantiated in-process, and state is arranged dynamically in code during the test — not front-loaded into config files or prompt templates. This makes stateful systems (story engines, AI NPCs, agents with memory, chatbots with history) naturally testable, while stateless testing remains the degenerate case: a test with no state arrange.

Long-term, Crucible is language-agnostic. The semantics of each assertion live in a portable instruction schema an AI agent executes as judge; only a thin deterministic shell (run orchestration, aggregation, framework bindings) is ported per language ecosystem — TypeScript/Jest first, then Python, .NET, Java. Write the assertion semantics once; run them anywhere developers already test.

### Why Now

- promptfoo — the nearest neighbour — was acquired by OpenAI (March 2026); the team has committed to open-source continuity, but its roadmap centres on enterprise security/red-teaming inside the Frontier platform. App-level semantic testing is not where it is heading — a real need, and a different one.
- OpenAI Evals is deprecated (read-only October 2026). Consolidation into the OpenAI ecosystem leaves whitespace for a provider-neutral tool.
- DeepEval's TypeScript support explicitly trails its Python package; TypeScript-first teams have no first-class option.
- pass^k (τ-bench: all k runs succeed) has become standard industry vocabulary for multi-run reliability. Crucible ships the related pass-rate threshold as a test primitive; `threshold: 1` over k runs is the pass^k case. Nothing in the landscape treats system state as a first-class assertion input (see `research-landscape.md`).

## 2. Target User

### 2.1 Jobs To Be Done

- **Functional:** assert that non-deterministic output is *semantically* correct given the state the system was in — inside the red-green loop I already have, with tooling I already use.
- **Functional:** measure reliability, not single-shot luck — "this behaviour holds with a pass rate ≥ 0.95" as a CI gate.
- **Contextual:** my SUT is my own engine, instantiated in-process — not a prompt endpoint reachable by a YAML harness.
- **Emotional:** stop shipping inference features on vibes; get the same confidence unit tests give deterministic code.

Primary personas: developers of AI storytellers, book-writing assistants, roleplay systems, AI NPCs (games), and chatbots — plus anyone testing stateful *or* stateless LLM-backed systems who prefers a code-first approach. First user: the builder (Proscenium is the inspiration and first dogfood target — not the assumed domain).

### 2.2 Non-Users (v1)

- Teams wanting config-first eval matrices across prompt × provider grids (promptfoo's shape).
- Teams wanting hosted dashboards, dataset management, or observability platforms (Braintrust, LangSmith).
- Security/red-team evaluation needs.
- Non-TypeScript ecosystems (v1 is TS/Jest; other languages are roadmap).

### 2.3 Key User Journeys

*Library product — journeys kept to one line each.*

- **UJ-1.** A storytelling-engine dev arranges character/location facts as state in a Jest test (hand-authored or harvested from the engine, e.g. `story.getLogs()`), acts by sending an input to their in-process engine, and asserts the response is coherent with that state across 20 runs at a 0.95 threshold.
- **UJ-2.** A chatbot dev with no state arrange asserts a stateless response satisfies a semantic claim — same API, runs omitted, single-shot smoke mode.
- **UJ-3.** A dev whose CI run fails reads the first judge error per failing run in the terminal, re-runs locally with debug logging to see engine init, per-run execution, and provider traffic, and fixes their engine (or their claim).

## 3. Glossary

- **SUT** — system under test; the user's own engine/app with inference capability, instantiated in-process in the test.
- **State** — facts the SUT's behaviour should respect, arranged in code during the test as strings (any serialization the user likes — plain sentences, JSON-as-string). Domain-agnostic: chat history, game entities, agent memory, document context.
- **Claim** — a natural-language semantic statement the response is judged against (e.g. "Jane won't find Bob, because they aren't in the same place").
- **Response** — SUT output produced in the act step and passed to an assertion.
- **Assertion** — a Crucible function (`coherent()` in MVP) that judges a response against a claim (and loaded state) and resolves to a boolean, asserted with the test framework's native primitive.
- **Judge** — the AI agent that evaluates a claim by following the instruction schema, called via the configured provider.
- **Instruction schema** — language-agnostic markdown rule files defining *how* the judge evaluates each assertion type; the portable, non-deterministic core of Crucible.
- **Run** — one full execution of an inference test's body (arrange → act → assert).
- **Inference test** — a test declared with `crucible.it()`, executed as one or more runs.
- **Threshold** — minimum pass rate (passed runs ÷ total runs) for the inference test to be green, expressed as a decimal fraction in [0, 1] (e.g. `0.95`) everywhere. This is a pass-rate threshold, not τ-bench pass^k (which requires all k runs to pass; `threshold: 1` is that special case).
- **Provider** — the API service the judge is called through (MVP: OpenRouter), set in the config file.
- **Config file** — `crucible.config.json` at project root: provider, model, provider-specific `meta` passthrough, verbosity defaults.

## 4. Features

### 4.1 Probabilistic Test Runner

**Description:** `crucible.it()` extends the test framework's `it`: the whole test body (arrange, act, assert) is re-executed for the configured number of runs, and the inference test passes when the pass rate meets the threshold. Repetition wraps the *test*, not the assertion — each run re-arranges state fresh, so mutation during a run never leaks into the next, and multiple assertions inside one body form a natural AND. Runs execute in parallel by default: proper tests build an isolated SUT per arrange, so runs share nothing. Realizes UJ-1, UJ-2.

#### FR-1: Declare an inference test
Developer can declare a test with `crucible.it(name, { runs?, threshold? }, body)` alongside ordinary Jest tests in the same file. The runner lives on the `crucible` namespace, matching `crucible.load()` and `crucible.coherent()`; each language binding exposes the idiomatic equivalent (see §4.6).

**Consequences (testable):**
- An inference test with `{ runs: 20, threshold: 0.95 }` executes its body 20 times and passes iff ≥ 19 runs pass.
- The pass rule is integer-safe: the test passes iff passed runs ≥ ⌈threshold × runs⌉; the ratio is never compared in floating point.
- Omitting `runs` executes the body exactly once (smoke mode); the test passes iff that run passes.
- A run passes iff every assertion in its body passes.

**Notes:** a threshold is a sampled estimate — a SUT whose true pass rate *equals* the threshold will fail the gate frequently (binomial noise: a true-0.95 SUT fails `{ runs: 20, threshold: 0.95 }` ≈ 26% of executions). Getting-started docs must include runs/threshold headroom guidance. Judge cost scales linearly: one judge call per assertion per run.

#### FR-2: Parallel run execution
Runs of one inference test execute concurrently by default.

**Consequences (testable):**
- Wall-clock time for 20 runs is bounded by the slowest run plus orchestration overhead, not the sum of runs. [ASSUMPTION: provider rate limits permit ≥20 concurrent judge calls; behaviour under rate-limiting is an open question — OQ-3.]

**Out of Scope:** serial execution mode and concurrency limits — post-MVP configuration. [NON-GOAL for MVP]

### 4.2 State Management

**Description:** State is arranged in code, inside the test, as strings — the KISS contract. Crucible does not interpret structure; the judge reads state as given (JSON-as-string or any serialization). State may be appended mid-test (FR-4); single arrange-act-assert per test remains the documented best practice. Realizes UJ-1.

#### FR-3: Load state
Developer can load state via `crucible.load(string | string[])` during a test's arrange step.

**Consequences (testable):**
- Loaded state is available to every judge call made by assertions later in the same run.
- State is scoped to the run even under parallel execution: concurrent runs never observe each other's state. The isolation mechanism (ambient per-run context vs explicitly injected handle) is an architecture decision — OQ-7; the PRD requires only the contract.
- State may be hand-authored strings or harvested from the SUT (e.g. `crucible.load(story.getLogs())`); Crucible treats both identically.

#### FR-4: Append state
Developer can append additional state after acts within the same run; subsequent assertions are judged against the accumulated state.

**Consequences (testable):**
- State appended after an act is included in every subsequent judge call in the same run; verdicts already returned are unaffected.

**Out of Scope:** typed state schemas; user-written custom parsing instructions for the judge — post-MVP idea. [NON-GOAL for MVP]

### 4.3 Semantic Assertions

**Description:** MVP ships one assertion: `crucible.coherent(response, claim)`, resolving to a boolean asserted with the framework's native primitive — `expect(await crucible.coherent(response, claim)).toBe(true)`. No custom matchers: keeping the assertion surface native per framework is what makes the deterministic shell cheap to port. When an assertion resolves false, Crucible prints judge diagnostics (§4.5) — the framework asserts, Crucible explains. Crucible does not track unasserted verdicts; forgetting `expect()` on one is the developer's responsibility, as with any async helper (documented as a gotcha). Realizes UJ-1, UJ-2.

#### FR-5: Coherence assertion
Developer can call `crucible.coherent(response, claim)` and receive a boolean verdict of whether the response is semantically coherent with the claim given loaded state.

**Consequences (testable):**
- With state "Bob is at the casino; Jane is at home" and a response placing Jane and Bob in the same location, `coherent(response, "Jane won't find Bob, because they aren't in the same place")` resolves `false`.
- With no state loaded, the claim is judged against the response alone (stateless mode).
- Knowledge-boundary claims are first-class: with state establishing what an actor should *not* know, a claim like "the narrator does not reveal the contents of the sealed letter" resolves `false` when the response leaks it (anti-omniscience testing — the original motivating case).

**Notes:** future assertion types (`range()`, `exact()`, others — open list) follow the same boolean contract. [NON-GOAL for MVP]

**Assertion-selection doctrine (decided 2026-09-14):** use the narrowest assertion that can express the claim — judge latitude is a cost, spent only when needed. Ladder: (1) plain framework assertions when the value is programmatically accessible (deterministic, no judge spend); (2) `exact()` when an exact target value is embedded in prose — judge extracts only, comparison is fixed by the schema; (3) `range()` for numeric targets with tolerance, same extraction pattern; (4) `coherent()` for claims that are inherently semantic — prose, reasoning, state consistency, knowledge boundaries — never where a narrower rung suffices. `coherent()` can express the narrower cases, but `exact()`/`range()` exist to give them a consistent, low-latitude prompt structure; this doctrine (not judge-unreliability evidence alone) justifies building them post-MVP. Getting-started docs must teach the ladder.

### 4.4 Judge Engine

**Description:** The judge is an AI agent following the instruction schema — markdown rule files defining how each assertion type is evaluated. The judge's task is deliberately narrow (evaluate one claim against one response plus provided state), which is why frontier models are expected to be reliable at it; judge false-negatives are an accepted limitation. Provider access is configured in `crucible.config.json`: provider (MVP: OpenRouter), model, and a provider-specific `meta` passthrough (e.g. OpenRouter routing/reasoning params). Realizes UJ-1, UJ-2, UJ-3.

#### FR-6: Instruction-schema-driven judging
Each assertion type's evaluation procedure is defined in a language-agnostic instruction schema the judge executes; the TypeScript library maps assertion calls to instruction sets.

**Consequences (testable):**
- `coherent()` behaviour changes by editing its instruction schema, with no change to TypeScript code.

#### FR-7: Provider configuration
Developer can configure provider, model, and provider-specific `meta` parameters in `crucible.config.json`; Crucible passes `meta` through to the provider unmodified.

**Consequences (testable):**
- With `{ "provider": "openrouter", "model": "deepseek-v3", "meta": { ... } }`, judge calls hit OpenRouter with that model and those params.
- An unsupported provider value fails fast at engine init with an actionable error.
- Judge infrastructure failures (rate limit, timeout, provider 5xx) are never recorded as semantic failures: the affected run is reported as *errored* with the infrastructure cause named. Retry/backoff policy: OQ-3.

**Feature-specific NFRs:**
- Judge calls are metered spend; MVP e2e testing budget is a funded OpenRouter account.
- API keys are supplied via environment variable, never in `crucible.config.json` — the config file stays committable. (Exact env var naming and CI-secret docs: OQ-1.)

### 4.5 Diagnostics & Observability

**Description:** When an inference test fails, the terminal shows pass rate vs threshold and, per failing run, the first judge error by default — response excerpt plus judge reasoning. A verbosity ladder is set in the config file and overridden by environment variable (env wins; frameworks lack native flag passthrough, and env vars port to every ecosystem). Debug level is in-scope for MVP: maximal logging across engine init, run execution, and provider connection. No file output — users redirect stdout (`yarn test > output.log`). Realizes UJ-3.

#### FR-8: Actionable failure output
On inference-test failure, Crucible prints pass rate vs threshold and, for each failing run, the failing assertion's claim, a response excerpt, and the judge's reasoning (first error per run at default verbosity).

**Consequences (testable):**
- Failure output names: pass rate vs threshold, and per failing run — claim, response excerpt (bounded; [ASSUMPTION: default cap ~500 chars, configurable]), judge reasoning.
- Errored runs (judge infrastructure) are visually distinct from semantically failed runs.

#### FR-9: Verbosity ladder
Developer can set output detail in `crucible.config.json` and override it per invocation via environment variable; levels include at minimum default (first error per failing run), full (all judge output per run), and debug (engine init, execution, provider connection tracing).

**Consequences (testable):**
- `CRUCIBLE_VERBOSE=debug yarn test` produces debug-level output regardless of config. [ASSUMPTION: env var named `CRUCIBLE_VERBOSE` — naming unconfirmed.]

### 4.6 Cross-Language Foundation

**Description:** Vision-level feature shipped as an architectural property of MVP, not as new language ports: the deterministic shell (run orchestration, aggregation, framework binding, config, output) is language-specific and ported per ecosystem; the instruction schema is the non-deterministic core, written once. MVP delivers the TS/Jest shell; FR-6 validates the split. Test-level repetition ports to every target ecosystem in its idiomatic form — xUnit `[CrucibleFact(Runs, Threshold)]`, JUnit 5 `@CrucibleTest(runs, threshold)`, pytest `@crucible.it(runs, threshold)` — see addendum for mechanisms and prior art.

**Out of Scope:** Python, .NET, Java shells; Vitest/other JS-runner bindings. [NON-GOAL for MVP — Vitest is likely the cheapest second binding; OQ-4.]

## 5. Non-Goals (Explicit)

- No config-first eval matrices (prompt × provider grids) — that is promptfoo's shape, not Crucible's.
- No hosted service, dashboard, UI, or dataset management. Crucible is a library.
- No observability *platform* — debug logging is for test-time diagnosis, not production tracing.
- No security/red-team evaluation.
- No prompt optimization or generation features.
- No custom test-framework matchers — native assertion primitives only.
- No opinionated state schema — state stays strings.

## 6. MVP Scope

### 6.1 In Scope

- TypeScript library, Jest binding (`crucible.it()`).
- `crucible.load()` / state append; string-based state contract.
- `crucible.coherent(response, claim)` boolean assertion.
- Instruction schema for `coherent`; judge execution via OpenRouter.
- `crucible.config.json` (provider/model/meta, verbosity default) + env-var override.
- Failure diagnostics + verbosity ladder incl. debug level.
- Parallel run execution.
- Docs: getting started, config reference (OpenRouter page), instruction-schema explainer.
- CI: GitHub Actions — PR lane (lint, typecheck, unit; no provider traffic), main-merge lane additionally runs `e2e/core` against the funded OpenRouter account; full e2e suite runs locally via Makefile (manual, no pre-commit hook) per architecture AD-12.

### 6.2 Out of Scope for MVP

- Additional assertion types (`range()`, `exact()`, …) — after `coherent` proves the schema shape; justified by the assertion-selection doctrine (§4.3), shaped as judge-extracts / schema-fixes-comparison.
- Additional providers (Bedrock etc.) — each needs its own docs page at GA; deferred.
- Python/.NET/Java shells; Vitest binding. [NOTE FOR PM: Vitest may be near-free — revisit if MVP lands quickly. OQ-4.]
- Serial/concurrency-limited run execution.
- Custom state-parsing instructions for the judge.
- Judge-verdict caching / cost optimizations.

## 7. Success Metrics

*Builder is explicitly indifferent to adoption numbers ("anything is good") — metrics kept to signals of life. [ASSUMPTION: soft targets below are placeholders, not commitments.]*

**Primary**
- **SM-1**: Dogfood complete — Proscenium's inference behaviours tested with Crucible in its own CI. Validates FR-1..FR-9.

**Secondary**
- **SM-2**: External signal of life — a nonzero stream of npm installs and ≥1 issue/PR from a stranger within 6 months of launch.

**Counter-metrics (do not optimize)**
- **SM-C1**: Feature breadth (assertion-type count, provider count). Chasing breadth before the `coherent` + schema shape is proven undermines the portability bet. Counterbalances SM-2.

## 8. Open Questions

1. **OQ-1 — Secret handling (partially resolved):** keys via environment variable is decided; remaining: env var naming convention and CI-secret documentation.
2. **OQ-2 — Package name (resolved):** `crucible-ai` — `crucible` is taken on npm; `crucible-ai` verified free 2026-08-10.
3. **OQ-3 — Rate limiting & judge-error retry:** retry/backoff policy for judge infrastructure failures under parallel execution; when is an errored run retried vs surfaced as errored (FR-7)?
4. **OQ-4 — Vitest:** in or out for v1? Likely cheap; currently out.
5. **OQ-5 — Instruction schema versioning:** how schema files are versioned/pinned relative to library releases (matters once schema is shared cross-language).
6. **OQ-6 — Judge model guidance:** recommended/default judge models and a documented stance on judge reliability per model tier.
7. **OQ-7 — State isolation mechanism:** how per-run state scoping is implemented under parallel runs (ambient per-run context à la AsyncLocalStorage vs explicitly injected handle). Architecture decision; the PRD fixes only the isolation contract (FR-3).

## 9. Assumptions Index

- §4.1/FR-2 — provider tolerates ≥20 concurrent judge calls. (OQ-3)
- §4.5/FR-8 — response excerpt default cap ~500 chars, configurable.
- §4.5/FR-9 — env var named `CRUCIBLE_VERBOSE`.
- §7 — metric targets are placeholders; builder indifferent.
