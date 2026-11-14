---
stepsCompleted: ['step-01-validate-prerequisites', 'step-02-design-epics', 'step-03-create-stories', 'step-04-final-validation']
inputDocuments:
  - _bmad-output/planning-artifacts/prds/prd-crucible-ai-2026-08-10/prd.md
  - _bmad-output/planning-artifacts/prds/prd-crucible-ai-2026-08-10/addendum.md
  - _bmad-output/planning-artifacts/architecture/architecture-crucible-ai-2026-08-10/ARCHITECTURE-SPINE.md
---

# crucible-ai - Epic Breakdown

## Overview

This document provides the complete epic and story breakdown for crucible-ai, decomposing the requirements from the PRD, UX Design if it exists, and Architecture requirements into implementable stories.

## Requirements Inventory

### Functional Requirements

FR1: Developer can declare an inference test with `crucible.it(name, { runs?, threshold? }, body)` alongside ordinary Jest tests; passes iff passed runs ≥ ⌈threshold × runs − 1e-9⌉ (integer-safe); omitted `runs` → 1 (smoke mode); omitted `threshold` → 1.0; threshold validated to (0,1].
FR2: Runs of one inference test execute concurrently by default (Promise.all inside a single registered `it()`); wall-clock bounded by slowest run plus orchestration overhead.
FR3: Developer can load state via `crucible.load(string | string[])` during arrange; loaded state available to every judge call in the same run; state scoped per run under parallel execution (concurrent runs never observe each other's state); hand-authored or SUT-harvested strings treated identically.
FR4: Developer can append state after acts within the same run; subsequent assertions judged against accumulated state; already-returned verdicts unaffected.
FR5: Developer can call `crucible.coherent(response, claim)` and receive a boolean verdict of semantic coherence with the claim given loaded state; stateless mode (no state loaded) judges claim against response alone; knowledge-boundary (anti-omniscience) claims are first-class.
FR6: Each assertion type's evaluation procedure is defined in a language-agnostic markdown instruction schema the judge executes; `coherent()` behaviour changes by editing its schema with no TypeScript change.
FR7: Developer can configure provider, model, and provider-specific `meta` passthrough in `crucible.config.json`; unsupported provider fails fast at config load with actionable error; judge infrastructure failures (429/timeout/5xx) are recorded as errored runs, never semantic failures.
FR8: On inference-test failure, Crucible prints pass rate vs threshold and, per failing run, the first failed assertion's claim, bounded response excerpt, and judge reasoning; errored runs render visually distinct from failed runs.
FR9: Developer can set verbosity in `crucible.config.json` and override per invocation via `CRUCIBLE_VERBOSE` env var (env wins); levels: default (first error per failing run), full (all judge output), debug (engine init, run execution, provider traffic).

### NonFunctional Requirements

NFR1: API keys are supplied via provider-native environment variables only (`OPENROUTER_API_KEY` for MVP), never in `crucible.config.json`; the config file stays committable; `CRUCIBLE_` prefix reserved for crucible-owned variables.
NFR2: Judge calls are metered spend — one judge call per assertion per run; judge cost scales linearly; no judge traffic outside explicit test execution.
NFR3: Judge false-negatives are an accepted limitation, mitigated by narrow single-claim assertions; frontier models expected reliable at the narrow task.
NFR4: Getting-started docs must include runs/threshold binomial-headroom guidance (a true-0.95 SUT fails `{runs: 20, threshold: 0.95}` ≈ 26% of executions).
NFR5: Unasserted verdicts are the developer's responsibility (as with any async helper); documented as a gotcha, not tracked by the engine.

### Additional Requirements

- **No starter template** — greenfield hand-rolled package per the spine's Structural Seed (AD-2 layout: `src/bindings/`, `src/core/`, `src/providers/`, `schemas/`, `e2e/`, `docs/`).
- AR1 (AD-1): Evaluation semantics live only in `schemas/*.md`; TypeScript never encodes judgment logic.
- AR2 (AD-2/AD-9): Dependency direction enforced — core never imports adapters/bindings; only `core/config` calls `providers/registry`.
- AR3 (AD-3): Registration inert; runner throws `CrucibleVerdictError` rendered solely by `core/report`; runner sets framework per-test timeout from run count and provider budget; bodies documented as re-entrant (fresh SUT per arrange).
- AR4 (AD-4): Three-zone verdict — pass / fail / errored(inconclusive → test fails, reported as errored); run-status classification: body resolves → passed; `CrucibleError` kind `infra` → errored; any other rejection → failed.
- AR5 (AD-5/AD-13): `core/state` owns the single AsyncLocalStorage holding `RunContext { state, verdicts, errors }`; access via accessors only; judge appends `VerdictRecord`/`ErrorRecord` before resolving; reporter renders exclusively from records at verdict time.
- AR6 (AD-7): Judge = one stateless completion per assertion; schema as system prompt; strict JSON `{verdict, reasoning}`; parsing and unparseable→retryable classification live only in `core/judge`.
- AR7 (AD-8): Provider port `complete(request, AbortSignal): Promise<string>`; adapter classifies retryable/fatal and declares its env var; core owns retry (3 attempts, exponential backoff + jitter); runner aborts sibling runs on first fatal, aborted runs discarded.
- AR8 (AD-9): `config.get()` memoized, first invoked at first run execution; config load resolves adapter singleton and `effectiveVerbosity`.
- AR9 (AD-11): Schemas ship in package, named per assertion (`coherent.md`), frontmatter carries name + output contract, versioned by package version.
- AR10 (AD-12 as amended): CI (GitHub Actions) two lanes — PR lane = lint + typecheck + unit, zero provider traffic; main-merge lane additionally runs `make e2e-core` with `OPENROUTER_API_KEY` repo secret; local e2e manual-only (no pre-commit hook), split `e2e/core` + `e2e/ext`, Makefile targets `e2e-core`/`e2e-ext`/`e2e`; publish = `v*` tag → unit tests → `npm publish` with provenance via npm Trusted Publishing (OIDC) or `NPM_TOKEN` fallback; permitted CI secrets = npm credential + `OPENROUTER_API_KEY`.
- AR11 (Stack): TypeScript 6.x; Node engines >=22, CI matrix 22/24; Jest 30 (peer, never dependency — globals reached lazily); tsdown dual ESM+CJS build; one `crucible` namespace, future bindings via subpath exports only.
- AR12 (Conventions): kebab-case files; `CrucibleError` base with kind `config|usage|infra`; no `console.*` outside `core/report`; env access only in `core/config` + adapter key lookup; "state" terminology, never domain vocabulary.
- AR13 (PRD §6.1): Docs deliverables — getting started (incl. NFR4 headroom guidance), OpenRouter config reference, instruction-schema explainer, unasserted-verdict gotcha.

### UX Design Requirements

N/A — library product, no UI. Terminal output contract is covered by FR8/FR9.

### FR Coverage Map

FR1: Epic 1 (declaration + smoke default) → Epic 2 (runs/threshold aggregation completes it)
FR2: Epic 2 — parallel run execution
FR3: Epic 2 — load state, per-run isolation
FR4: Epic 2 — append state
FR5: Epic 1 — coherence assertion
FR6: Epic 1 — instruction-schema-driven judging
FR7: Epic 1 — provider configuration, fail-fast, retry taxonomy
FR8: Epic 3 — full failure-output contract (Epic 1 ships provisional print incl. judge reasoning)
FR9: Epic 3 — verbosity ladder incl. debug

## Epic List

### Epic 1: First semantic assertion (walking skeleton)
A developer can install crucible-ai, configure OpenRouter, and get a real semantic verdict inside a Jest test — `crucible.it()` smoke mode (single run), `crucible.coherent()`, schema-driven judge, fail-fast config, core retry taxonomy, and a minimal failure print that includes the judge's reasoning (not just the boolean). Proves the core bet — schema-driven judging — earliest and cheapest.
**FRs covered:** FR1 (declare + smoke), FR5, FR6, FR7

### Epic 2: Reliability measurement (stateful pass-rate gates)
A developer can arrange per-run state and gate CI on pass rate — full `{runs, threshold}` semantics, parallel execution, ALS state isolation (`load`/`append`), three-zone verdict, sibling abort on fatal. Runs/threshold binomial-headroom guidance (NFR4) is authored alongside `threshold` in this epic — load-bearing math, not deferred documentation.
**FRs covered:** FR1 (runs/threshold aggregation), FR2, FR3, FR4

### Epic 3: Diagnose, document & ship
A developer can debug a failing CI run from terminal output alone, and the package is publicly consumable — full FR8 output contract, verbosity ladder incl. debug, docs set (incorporating the Epic 2 headroom guidance, OpenRouter reference, schema explainer, unasserted-verdict gotcha), fixture-driven local e2e via Makefile (manual, no pre-commit hook), `e2e-core` on the CI main-merge lane, a language-agnostic judge-conformance spike, and tag-triggered npm publish. The `e2e/core` critical-path test is a self-contained fixture-driven scenario: a checked-in fixture file (txt/json/md) establishes state, the test feeds input prompts and asserts semantic expectations — domain-agnostic, no external project dependency.
**FRs covered:** FR8, FR9 (+ NFR4/NFR5 docs, AR10/AR13 ops)

### Epic 4: Field readiness
Field use from real e2e runs and the first consumer project surfaced constraints that block adoption. A developer can tune crucible's time budgets per test and project the way Jest users expect.

### Epic 5: Bring your own provider
A developer who can't or won't use OpenRouter can point Crucible's judge at the model access they already have. Jack's decision (2026-11-14): start with OpenAI and any OpenAI-compatible endpoint. Bedrock and Vertex wait until there is an account to test against.

## Epic 1: First semantic assertion (walking skeleton)

A developer can install crucible-ai, configure OpenRouter, and get a real semantic verdict inside a Jest test — smoke mode, schema-driven judge, fail-fast config, retry taxonomy, and a failure print that includes the judge's reasoning. Proves the core bet — schema-driven judging — earliest and cheapest.

### Story 1.1: Install and configure Crucible

As a developer,
I want to install crucible-ai and configure it via `crucible.config.json`,
So that misconfiguration fails fast with an actionable error before any judge spend.

**Acceptance Criteria:**

**Given** a fresh TS/Jest project with crucible-ai installed (scaffold: tsdown dual ESM+CJS build, TS 6.x strict, Node >=22, kebab-case layout per spine seed, CI workflow running lint+typecheck+unit)
**When** a valid `crucible.config.json` (`provider`, `model`, optional `meta`, optional verbosity) exists at project root
**Then** `config.get()` loads and validates it once (memoized), resolving the adapter singleton via `providers/registry` and `effectiveVerbosity` (env wins)
**And** an unknown provider, missing model, or malformed file throws `CrucibleError` kind `config` with an actionable message at load — never mid-run
**And** registration-time code paths never trigger config load (registration inert, AD-9)
**And** no API key field is accepted in the config file (NFR1)

### Story 1.2: Reliable judge connectivity via OpenRouter

As a developer,
I want judge requests sent through OpenRouter with retry on transient failures,
So that provider flake doesn't produce false verdicts or wasted spend.

**Acceptance Criteria:**

**Given** the OpenRouter adapter implementing the port `complete(request, signal): Promise<string>`
**When** a judge request succeeds
**Then** raw completion text returns to core untouched (no parsing in the adapter, AD-8)
**And** the adapter reads `OPENROUTER_API_KEY` from env (its declared var); a missing key is a fatal `config` error
**When** the provider returns 429/timeout/5xx
**Then** core retries max 3 attempts with exponential backoff + jitter, then surfaces `CrucibleError` kind `infra`, `retryable: true`
**When** the provider returns 400/401/unknown-model
**Then** the error is classified fatal and surfaces immediately without retry
**And** `meta` config passes through to the request unmodified (FR7)

### Story 1.3: Design the `coherent` instruction schema (spike)

As a library author,
I want `schemas/coherent.md` designed and validated against real judge models with no TypeScript involved,
So that the language-agnostic core of Crucible is proven before any shell code binds to it.

**Acceptance Criteria:**

**Given** a scratch harness that is explicitly not library code (raw HTTP/curl or throwaway script against OpenRouter)
**When** the schema is executed as system prompt with hand-built payloads (state + response + claim)
**Then** a fixture matrix passes on at least two candidate judge models: coherent case → `true`, incoherent case (Jane/Bob canonical) → `false`, knowledge-boundary leak → `false`, stateless case (no state) judged on response alone
**And** every reply parses as strict JSON `{verdict, reasoning}` with meaningful reasoning — format compliance measured across repeated calls, not one lucky sample
**And** the schema file carries frontmatter (`name: coherent`, output contract) per AD-11, registry-ready
**And** the schema contains no TypeScript-specific or provider-specific instructions — payload assembly order is documented in the schema itself so any language shell can reproduce it (AD-7)
**And** model behaviour notes (which models comply, quirks, refusal rates) are recorded as input to the deferred judge-model guidance (OQ-6)

### Story 1.4: First semantic verdict (smoke mode)

As a developer,
I want to write `crucible.it('name', body)` with `crucible.coherent(response, claim)` inside,
So that I get a real semantic pass/fail in my Jest suite from a single run.

**Acceptance Criteria:**

**Given** a `crucible.it()` test with `runs`/`threshold` omitted
**When** the suite runs
**Then** exactly one Jest test registers and the body executes exactly once inside `state.enterRun` (ambient `RunContext`, AD-5)
**And** `crucible.coherent(response, claim)` assembles one stateless completion — system prompt = `schemas/coherent.md` (the Story 1.3 artifact), user content = response + claim — parses strict JSON `{verdict, reasoning}` in `core/judge`, appends a `VerdictRecord`, and resolves the boolean (AD-7/AD-13)
**And** with the PRD's canonical case (response places Jane and Bob together, claim says they can't meet) the verdict resolves `false`; the inverse resolves `true` (FR5)
**And** editing `schemas/coherent.md` changes judge behaviour with zero TS changes (FR6)
**And** calling `crucible.coherent()` outside a run scope fails fast with `CrucibleError` kind `usage`
**And** an unparseable judge reply is classified retryable infra, never a verdict

### Story 1.5: See why it failed

As a developer,
I want a failing or erroring smoke test to tell me what the judge thought,
So that I can fix my engine or my claim without re-running blind.

**Acceptance Criteria:**

**Given** a smoke test whose assertion resolved `false`
**When** the test fails
**Then** the thrown `CrucibleVerdictError` message — rendered solely by `core/report` from run records — shows the claim, a bounded response excerpt, and the judge's reasoning
**Given** a smoke test whose run errored (retries exhausted or fatal)
**Then** output renders the run as *errored, not failed*, naming the infrastructure cause (FR7)
**And** no module outside `core/report` writes to stdout/stderr (AR12)

## Epic 2: Reliability measurement (stateful pass-rate gates)

A developer can arrange per-run state and gate CI on pass rate — full `{runs, threshold}` semantics, parallel execution, ALS state isolation, three-zone verdict, sibling abort on fatal, config-level defaults, and the load-bearing headroom math authored alongside.

### Story 2.1: Repeat and gate on pass rate

As a developer,
I want `crucible.it(name, { runs, threshold }, body)` to execute the body N times in parallel and gate on the pass rate,
So that I measure reliability, not single-shot luck.

**Acceptance Criteria:**

**Given** `{ runs: 20, threshold: 0.95 }`
**When** the suite runs
**Then** one Jest test registers; the body executes 20 times concurrently (`Promise.all`), each in its own `state.enterRun` scope
**And** verdict follows the three-zone rule with `need = ⌈threshold × runs − 1e-9⌉`: passed ≥ need → green; passed + errored < need → fail; otherwise → errored-not-failed with infra causes named (AR4)
**And** `Math.ceil`-bump cases verify exactly: `{runs: 20, threshold: 0.35}` needs 7, not 8
**And** run-status classification: body resolves → passed; rejection with `CrucibleError` kind `infra` → errored; any other rejection → failed
**And** `threshold: 0` or `> 1` rejected as `usage` error at declaration
**And** the runner sets the framework per-test timeout from run count and provider budget (AR3)
**And** wall-clock for 20 runs ≈ slowest run + overhead, not the sum (FR2)

### Story 2.2: Arrange state per run

As a developer,
I want `crucible.load()` and `crucible.append()` to scope state to the current run,
So that assertions are judged against the state each run actually arranged — even with 20 runs in flight.

**Acceptance Criteria:**

**Given** a body calling `crucible.load("Bob is at the casino; Jane is at home")` then asserting coherence
**When** runs execute in parallel
**Then** every judge call in a run sees only that run's accumulated state — concurrent runs never observe each other's (FR3; verified with a unit test that interleaves runs writing distinct state)
**And** `crucible.append()` after an act includes the new state in subsequent judge calls of the same run; already-resolved verdicts are unaffected (FR4)
**And** `load`/`append` accept `string | string[]`; hand-authored and SUT-harvested strings are treated identically
**And** calls outside a run scope fail fast (`usage` error)
**And** with no state loaded, the judge payload contains no state section (stateless mode, FR5)

### Story 2.3: Fail fast without burning spend

As a developer,
I want a fatal provider error (bad key, unknown model) to abort the whole test immediately,
So that one misconfiguration doesn't burn 20 runs of judge spend.

**Acceptance Criteria:**

**Given** 20 parallel runs and a judge call failing with 401
**When** the first fatal classification lands
**Then** the runner's `AbortController` cancels all sibling in-flight judge calls via the port's `AbortSignal` (AR7)
**And** aborted runs are *discarded* — counted in no zone, rendered as discarded
**And** the test throws the fatal error immediately with its cause
**And** a retryable error that exhausts retries errors only its own run — siblings continue

### Story 2.4: Choose runs and threshold with eyes open

As a developer,
I want guidance on picking `runs`/`threshold` combinations,
So that I don't misread binomial noise as a broken library (NFR4).

**Acceptance Criteria:**

**Given** the repo's docs source
**When** this story completes
**Then** a headroom-guidance doc exists explaining: threshold is a sampled estimate; a true-0.95 SUT fails `{runs: 20, threshold: 0.95}` ≈ 26% of the time; recommended headroom patterns (e.g. gate below measured reliability) with worked examples
**And** the `crucible.it()` API reference section documents `runs`/`threshold` defaults and the three-zone verdict semantics
**And** Epic 3's docs stories link/absorb this content rather than rewrite it

### Story 2.5: Project-wide run defaults

As a developer,
I want to set default `runs`/`threshold` in `crucible.config.json`,
So that my team's reliability bar applies to every inference test without repeating it, while individual tests can still override.

**Acceptance Criteria:**

**Given** `crucible.config.json` containing `{ "testDefaults": { "runs": 20, "threshold": 0.95 } }`
**When** a `crucible.it()` test omits `runs`/`threshold`
**Then** the config defaults apply (20 runs, 0.95)
**And** a test passing `{ runs: 5 }` uses 5 runs with the config's 0.95 threshold — per-field override, not all-or-nothing
**And** a test passing both uses its own values entirely
**And** with no `testDefaults` in config, built-ins apply (`runs: 1`, `threshold: 1.0`)
**And** invalid config defaults (threshold outside (0,1], non-integer runs < 1) fail at config load as `config` errors — same fail-fast as provider validation (AD-9 as amended)
**And** resolution happens at execution time, not registration (registration stays inert)

## Epic 3: Diagnose, document & ship

A developer can debug a failing CI run from terminal output alone, and the package is publicly consumable — full failure-output contract, verbosity ladder, fixture-driven e2e (local manual + main-merge CI lane), language-agnostic judge conformance spike, docs set, tag-triggered publish.

### Story 3.1: Read a failure like a report

As a developer,
I want failing inference tests to print the full diagnostic contract,
So that I can diagnose a red CI run from terminal output alone.

**Acceptance Criteria:**

**Given** a test failing `{ runs: 20, threshold: 0.95 }` with mixed run outcomes
**When** the verdict renders
**Then** output shows pass rate vs threshold, and per failing run: the first failed assertion's claim, a bounded response excerpt (default ~500 chars, configurable), and judge reasoning — lowest-`seq` record first (FR8, AD-13)
**And** errored runs render visually distinct from failed, discarded distinct from both
**And** multiple assertions in one body attribute correctly (the report names *which* claim failed)
**And** all rendering comes from run records at verdict time — no mid-run prints at default level

### Story 3.2: Turn up the volume when needed

As a developer,
I want a verbosity ladder set in config and overridable per invocation,
So that I get terse CI output and deep local traces from the same suite.

**Acceptance Criteria:**

**Given** config verbosity `default`
**When** `CRUCIBLE_VERBOSE=debug yarn test` runs
**Then** debug output wins (env > config, FR9): engine init, config resolution, per-run lifecycle, provider request/response traffic, retry attempts
**And** `full` prints all judge output per run, not just first errors
**And** invalid verbosity values fail at config load; invalid env value = `usage` error naming valid levels
**And** output remains stdout-only — no file writes at any level

### Story 3.3: Prove it end-to-end locally

As a library author,
I want a fixture-driven e2e suite runnable locally against real OpenRouter,
So that the critical path is proven with real inference on demand.

**Acceptance Criteria:**

**Given** a checked-in fixture file (txt/json/md) establishing a self-contained test scenario (state + inputs + expected semantic behaviours — domain-agnostic, no external project)
**When** `make e2e-core` runs with `OPENROUTER_API_KEY` set locally
**Then** the core scenario exercises the full path — config → `crucible.it` multi-run → `load`/`append` → `coherent` → judge → three-zone verdict — and passes against the real provider
**And** `make e2e-ext` runs extended scenarios; `make e2e` runs both
**And** e2e execution is manual-only locally (no pre-commit hook)
**And** e2e never runs in PR CI; missing API key aborts with an actionable message, not a hang (AR10)

### Story 3.4: Language-agnostic judge conformance (spike)

As a library author,
I want the judge exercised directly from a container with no TypeScript involved — CLIs installed, a checked-in JSON payload copied in, `curl` against the provider,
So that the schema's language-agnostic claim is a repeatable conformance check, not a one-time design validation, paving the way for a core schema pack outside the TS framework.

**Spike — deliverables over fixed ACs; explicitly allowed to spawn follow-up stories.**

**Acceptance Criteria (spike exit):**

**Given** a docker container provisioned with required CLIs and the checked-in payload fixture
**When** the harness curls the provider with schema-as-system-prompt + assembled payload
**Then** the conformance matrix verdicts match Story 1.3's fixture expectations with zero TS in the loop
**And** findings are recorded: fixture format fit for a conformance suite, payload-assembly-doc completeness gaps, where the harness should live long-term (e2e/ext now, language-agnostic pack later)
**And** candidate follow-up stories are proposed (e.g. schema pack extraction, cross-shell conformance suite)

### Story 3.5: e2e-core on merge to main

As a library author,
I want `make e2e-core` to run in CI when changes merge to main,
So that the real-inference critical path is continuously verified without spending on every PR.

**Acceptance Criteria:**

**Given** a merge to main
**When** the main-lane workflow runs
**Then** it executes lint + typecheck + unit, then `make e2e-core` against real OpenRouter using the `OPENROUTER_API_KEY` repo secret (amended AD-12)
**And** PR-lane workflows remain provider-free — no provider secret exposure to PR builds
**And** a main-lane e2e failure is loud (red workflow, visible status badge)
**And** permitted CI secrets remain exactly: npm credential + `OPENROUTER_API_KEY`

### Story 3.6: Learn it from the docs alone

As a new user,
I want docs that take me from install to a trustworthy CI gate,
So that I never need to read source or file an issue to use v1 correctly.

**Acceptance Criteria:**

**Given** the shipped docs set
**When** a newcomer follows it
**Then** getting-started walks install → config → first smoke test → multi-run gate, absorbing the Story 2.4 headroom guidance (AR13)
**And** an OpenRouter reference documents provider/model/`meta`/`testDefaults`, `OPENROUTER_API_KEY`, and CI-secret guidance
**And** a schema explainer covers the instruction-schema concept, `coherent.md`'s contract, and how editing it changes behaviour (FR6)
**And** documented gotchas include: unasserted verdicts (NFR5), re-entrant body requirement, judge false-negative stance (NFR3)

### Story 3.7: Ship it with provenance

As a library author,
I want a tag-triggered publish pipeline,
So that every npm release is built, tested, and attested reproducibly.

**Acceptance Criteria:**

**Given** a `v*` tag pushed to GitHub
**When** the publish workflow runs
**Then** it runs lint + typecheck + unit, builds dual ESM+CJS via tsdown, and publishes `crucible-ai` to npm with provenance via Trusted Publishing (OIDC; `NPM_TOKEN` fallback) (AR10)
**And** the published package exposes one `crucible` namespace, ships `schemas/`, declares Jest as peer dependency, engines `>=22`
**And** `npm pack` contents verified: no e2e, fixtures, or config with local values leak into the tarball
**And** README on npm shows the current `crucible.it()` API

## Epic 4: Field readiness

### Story 4.1: Tune timeouts per test

As a developer whose test bodies call my own model and then `coherent()` several times,
I want to raise or lower crucible's time budgets per test and per project,
So that slow but healthy runs aren't cut off at 30 s and reported ERRORED.

Jack's decision (2026-11-13): keep 30 s as the default and allow overrides the way Jest does, through a trailing number or through named options.

**Acceptance Criteria:**

**Given** `crucible.it(name, body, 50000)` or `crucible.it(name, { runs, threshold }, body, 50000)`
**When** the test runs
**Then** the trailing number is the test timeout in ms (Jest semantics): the runner deadline for the whole multi-run test, and the Jest ceiling is that deadline plus the existing margin

**Given** `crucible.it(name, { inferenceTimeout: 50000, testTimeout: 60000 }, body)`
**When** the test runs
**Then** each `coherent()` judge call aborts after `inferenceTimeout` ms (a retryable infra error, as today) and the whole test expires after `testTimeout` ms (the ERRORED expiry report, as today)

**Given** `testDefaults: { inferenceTimeout, testTimeout }` in config
**When** a test does not declare them
**Then** they apply with the existing per-field precedence (declared > testDefaults > built-in)

**Given** no overrides
**Then** behaviour is unchanged: inference 30000 ms and test `30000 + (runs-1)×1000` ms

**Given** a timeout that is not a positive integer (or exceeds the timer maximum), or a trailing number together with `testTimeout`
**Then** it is a `usage` error at declaration (or a `config` error for testDefaults) — never a silent clamp

**And** docs (`configuration.md`, `api.md`, `gotchas.md`, `runs-and-threshold.md`) document both knobs and note that `testTimeout` caps everything, so an `inferenceTimeout` above it is effectively bounded by it

### Story 4.2: Extract a value and assert it with Jest

As a developer testing what my system's reply says,
I want to pull a typed value out of free-form prose with `crucible.extract()`,
So that I can check exact values (counts, names, yes/no answers) with ordinary Jest matchers, while crucible handles phrasing and the run gating.

Jack's decisions (2026-11-13): build `extract()` before a C# port. A single hedged value ("probably two") returns `null`.

**Acceptance Criteria:**

**Given** `await crucible.extract(text, 'the number of apples', { as: 'number' })`
**When** the text commits to one final value
**Then** it resolves to that value with the requested type (`number`, `string` or `boolean`; default `string`), so `expect(...).toBe(2)` works

**Given** text with several candidates, where the speaker revises ("At first I thought 3, but the answer is two")
**Then** the final committed answer is extracted (2), not the first mention

**Given** text that negates a value ("It's not two"), hedges ("Probably two", "Probably two, maybe three"), or contains no answer
**Then** it resolves to `null`; the judge never guesses or invents a value

**Given** state loaded with `crucible.load()`/`append()`
**Then** the extraction is made with that state as context, as for `coherent()`

**Given** a judge reply whose value does not match the requested type, or is malformed
**Then** it is re-asked once and then becomes a retryable `infra` error, the same as `coherent()`

**Given** any extraction
**Then** it is recorded per run (description, value or null, the judge's reasoning, the response) and shown in the failure report and the debug trace, so a failing `toBe(2)` shows why the judge returned `null` or another value

**And** the judge contract lives in a new language-agnostic `schemas/extract.md` with explicit rules for final answers, negation, hedging and no-answer, with conformance cases in the 3.4 harness and real-provider e2e cases for each rule
**And** the docs (API reference, getting started, gotchas, README) cover `extract()`, including that `null` means "no single committed value"

## Epic 5: Bring your own provider

### Story 5.1: Judge with OpenAI or any OpenAI-compatible endpoint

As a developer whose company uses OpenAI, Azure OpenAI, a LiteLLM gateway or a local model server instead of OpenRouter,
I want to point Crucible's judge at that endpoint from `crucible.config.json`,
So that I can use Crucible without an OpenRouter account.

**Acceptance Criteria:**

**Given** `{ "provider": "openai", "model": "<openai model id>" }`
**When** a judge call is made
**Then** it is sent to OpenAI's chat completions API with the key from `OPENAI_API_KEY`, and a missing key is a `config` error

**Given** `{ "provider": "openai-compatible", "baseUrl": "<url>", "apiKeyEnv": "<ENV_NAME>", "model": "..." }`
**When** a judge call is made
**Then** it is sent to `<baseUrl>/chat/completions` with the key read from the named environment variable
**And** when `apiKeyEnv` is omitted, no Authorization header is sent (local servers such as Ollama), while a named but unset variable is a `config` error

**Given** an invalid `baseUrl` (not http/https or not parseable), an `apiKeyEnv` that is not a valid environment variable name, or `baseUrl`/`apiKeyEnv` with a provider that does not use them
**Then** config load fails with a `config` error; a key value is never accepted in the config file

**Given** the existing retry, timeout, abort, verdict and report behaviour
**Then** it is identical for every provider: HTTP 408/429/5xx retryable, other 4xx fatal, malformed envelopes retryable, `meta` passed through unchanged

**And** OpenRouter-only request fields are never sent to other providers
**And** `make conformance` and the e2e suites can run against any OpenAI-compatible endpoint; the live tests use OpenRouter's OpenAI-compatible endpoint through `openai-compatible`
**And** the docs (configuration, getting started, judge models, README, gotchas) cover both providers, including Azure OpenAI and Ollama examples and that judge quality must be checked per model with the conformance harness


### Story 5.2: Choose where the judge key comes from

As a developer whose judge key lives in a secret manager, CI secret or vault under its own name,
I want one default key variable for every provider and the option to name my own,
So that I set the judge key once, the same way, whichever provider I judge with.

**Acceptance Criteria:**

**Given** any provider (`openrouter`, `openai`, `openai-compatible`)
**When** `crucible.config.json` declares `apiKeyEnv`
**Then** the judge key is read from that variable (same name validation as today; a pasted key is never echoed in an error)

**Given** `apiKeyEnv` is absent
**When** a judge call is made
**Then** the key is read from `CRUCIBLE_JUDGE_KEY`; `OPENROUTER_API_KEY` and `OPENAI_API_KEY` are no longer read (breaking, pre-1.0)

**Given** `openrouter` or `openai`
**When** the resolved key variable is unset or blank
**Then** the judge call fails with a `config` error naming the variable

**Given** `openai-compatible`
**When** `apiKeyEnv` is absent and `CRUCIBLE_JUDGE_KEY` is unset or blank
**Then** no Authorization header is sent (local servers such as Ollama)
**And** when `apiKeyEnv` is declared and that variable is unset or blank, the judge call fails with a `config` error naming it

**Given** an `openai-compatible` `baseUrl` that is plain `http://` to a host other than loopback (`localhost`, `127.0.0.0/8`, `[::1]`)
**When** a key will be sent
**Then** Crucible warns once per process that the key travels unencrypted, without ever including the key; the call is not rejected

**And** e2e, the conformance harness (`make conformance`), the Makefile, CI workflows (the `CRUCIBLE_JUDGE_KEY` repo secret), README and docs use `CRUCIBLE_JUDGE_KEY` and describe `apiKeyEnv` for every provider

## Epic 6: Ergonomics

Make the common case need no options, make settings declarable once per group of tests, and let extraction match how loosely LLMs answer. Design rule for every story: the settings chain and `describe` logic stay runner-neutral; anything that touches Jest lives in one replaceable layer, so a Vitest adapter (next epic) reuses it unchanged.

### Story 6.1: Sensible defaults with IDE hints

As a developer writing my first Crucible test,
I want useful run and threshold defaults that my editor shows me,
So that a test with no options is already a meaningful reliability gate and I never have to look the defaults up.

**Acceptance Criteria:**

**Given** a `crucible.it()` with no `runs`/`threshold` and no `testDefaults`
**Then** it executes 10 runs and passes when at least 90% (9 of 10) pass (was 1 run, threshold 1.0; breaking, pre-1.0)
**And** the default `testTimeout` formula is unchanged (`30000 + 1000 × (runs − 1)`, so 39000 for 10 runs)

**Given** an editor with TypeScript support
**When** the user hovers or autocompletes `RunOptions` fields, `crucible.it`, `crucible.coherent` or `crucible.extract`
**Then** JSDoc shows each option's meaning and `@default`
**And** `crucible.it` is typed as its four supported forms (overloads), so `crucible.it(name, options)` without a body is a type error

**And** README, docs and CHANGELOG (Unreleased) state the new defaults, the cost (10 judge calls and 10 runs of the system under test per unconfigured test) and how to get the old behaviour (`{ runs: 1, threshold: 1 }` or `testDefaults`)
**And** `CHANGELOG.md` is included in the published package

### Story 6.2: A commented config file and `crucible-ai init`

As a developer setting up Crucible,
I want a generated config file that lists every setting and its default as a commented line, with editor autocomplete,
So that I can see and change any default without reading the docs.

**Acceptance Criteria:**

**Given** `crucible.config.json` or `crucible.config.jsonc` in the directory Jest runs from
**Then** either is read, and both accept `//` and `/* */` comments and trailing commas (comment markers inside strings are text)
**And** both files present is a `config` error; malformed content is a `config` error with no key echoed

**Given** the package
**Then** it ships a JSON Schema for the config (`schemas/crucible.config.schema.json`) describing every field with its description and default
**And** a `"$schema"` field in the config is accepted and ignored by validation

**Given** `npx crucible-ai init` in a directory with no config file
**Then** it writes `crucible.config.jsonc` with `$schema` pointing at the installed schema, `provider` and `model` set to the documented defaults, and every other setting (`apiKeyEnv`, `meta`, every `testDefaults` field) present as a commented line showing its default
**And** with either config file already present it changes nothing and exits non-zero
**And** the runtime still has no dependencies (the JSONC reader is in-house)

**And** README and docs use the generated file in Quick start

### Story 6.3: Group settings with `crucible.describe`

As a developer with many tests that share run settings,
I want to declare them once on a group,
So that each `crucible.it()` only states what differs.

**Acceptance Criteria:**

**Given** `crucible.describe(name, fn)` or `crucible.describe(name, options, fn)` where `options` takes the same fields as `crucible.it()` options
**Then** it registers a Jest `describe` block and every `crucible.it()` inside inherits its options

**Given** nested settings
**Then** each field resolves independently, last wins: built-in default → config `testDefaults` → outer `describe` → inner `describe` → the `it`'s own options (a trailing timeout number counts as the `it`'s `testTimeout`)
**And** plain Jest `describe` blocks may be nested inside or around `crucible.describe` without breaking inheritance

**Given** invalid `describe` options, a missing callback or an async callback
**Then** a `usage` error at collection, with the same validation as `crucible.it()`

**And** the settings chain is runner-neutral; the Jest binding is one replaceable layer
**And** docs (API reference, runs and threshold, README) cover `describe` and the precedence

### Story 6.4: Lenient extraction by default, strict on request

As a developer asserting values in loosely worded LLM replies,
I want extraction to take the value a reply leans to unless I ask for strictness,
So that "I think so" counts as yes while I can still demand a firm commitment where it matters.

**Acceptance Criteria:**

**Given** lenient extraction (the default)
**Then** colloquial and mildly hedged answers commit to the value they lean to ("I think so" → `true`, "nah" → `false`, "probably two" → `2`)
**And** `null` remains for no answer, a genuine split ("two or three") and a bare negation ("not two")

**Given** strict extraction
**Then** today's rules apply unchanged (any hedge → `null`)

**Given** `strict: boolean` in config `testDefaults`, `crucible.describe` options, `crucible.it` options and `crucible.extract` options
**Then** it resolves last-wins in that order; default `false`; it applies to every assertion that supports it (today only `extract`)

**And** the extract schema defines both modes; the conformance harness covers both with cases on each side of the line
**And** the failure report shows which mode each extraction used
**And** docs and CHANGELOG state the default change (breaking, pre-1.0)

### Story 6.5: Facts — one name for state, per call or per run

As a developer giving the judge the ground truth my system worked from,
I want one clearly named function for it, and the option to pass facts with a single assertion,
So that the common case reads naturally and multi-step tests stay possible.

**Acceptance Criteria:**

**Given** `crucible.facts(fact: string | readonly string[])` inside a running `crucible.it()` body
**Then** it adds the facts to the run's state, exactly as `load`/`append` do today (append-only, per run, read when an assertion is called)
**And** `crucible.load()` and `crucible.append()` remain as aliases with identical behaviour, marked `@deprecated` in JSDoc (removal planned for 1.0), and are no longer shown in README or guides

**Given** `crucible.coherent(actual, expectation, { facts })` or `crucible.extract(text, description, { as, facts })`
**Then** those facts are sent with that call only, after the run's facts; they are not added to the run's state and later calls do not see them
**And** `facts` follows the same validation as `crucible.facts()` (string or array of strings, else `usage`)
**And** per-call facts work inside a running `crucible.it()` body (the same scope rules as today); the failure report shows the facts each judged call used

**And** the judge payload section stays `STATE` (instruction schema unchanged; conformance unaffected); docs call the concept "facts" and explain the wire name once
**And** README and guides use `crucible.facts()`, with an example showing facts taken from the system under test (e.g. `crucible.facts(assistant.getLogs())`), and the Quick start shows a first test without facts
**And** CHANGELOG `## Unreleased` lists the new function, the per-call option and the deprecations
