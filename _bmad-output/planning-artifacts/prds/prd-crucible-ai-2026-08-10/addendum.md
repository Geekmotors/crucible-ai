# Addendum — Crucible PRD

Depth that belongs downstream (architecture / solution design) or earned a place but doesn't fit the PRD narrative.

## Architecture direction (user-volunteered, 2026-08-10)

Two-part split (illustrated with the final API: `crucible.it('...', { runs: 20, threshold: 0.95 }, ...)` wrapping `crucible.coherent(response, 'Jane and Bob are not in the same room')`):

- **Deterministic shell** — language-specific, ported per ecosystem (TS/Jest first; Python, .NET, Java later). Runs the test N times (`runs: 20`), aggregates, checks pass rate ≥ threshold (0.95) — see Runs semantics. Owns test-framework integration (originally sketched as custom matchers like `toMeet` — superseded; see Assertion surface).
- **Non-deterministic core** — language-agnostic **instruction schema**: markdown rule files an AI agent (e.g. Claude) follows to actually evaluate the semantic claim ("Jane and Bob are not in the same room") against the loaded state. Function calls map to instruction sets. Judge = agent executing instructions, not a hardcoded metric.
- Consequence: porting cost per language = deterministic shell only; assertion semantics written once.

## Design philosophy (user-volunteered, 2026-08-10)

- Code-first ⇒ state is mutable *within the unit of work* — setup happens dynamically during the test's arrange phase, not front-loaded (promptfoo requires state prepared into prompt/template vars ahead of the run).
- Stateless testing is the degenerate case: a test with no state arrange. Stateful capability supersets stateless; no separate mode.

## Terminology rule (user correction, 2026-08-10)

- "World state" / "world log" are Proscenium-specific vocabulary. The framework is domain-agnostic: state can be chat history, game entities, agent memory, document context — anything. Docs and PRD use the generic term "state"; Proscenium appears only as an example, never as the assumed domain.

## Runs semantics — test-level repetition (decided 2026-08-10)

- Rejected: `{runs, threshold}` on the assertion (`coherent(...)`) — would either judge one response 20× (measures the judge, not the SUT) or require re-invoking act inside the assertion, which breaks when state mutates after input.
- Decided: repetition wraps the whole test — `crucible.it('name', { runs: 20, threshold: 0.95 }, async () => { arrange; act; assert })`. Each run re-arranges state fresh; assertions inside are single-shot; pass rate across runs ≥ threshold → green. Measures SUT reliability as a pass rate across runs (τ-bench pass^k is the stricter all-k-runs-pass case, i.e. `threshold: 1`). (Runner named `crucible.it()` — decided 2026-08-10, replacing the earlier `inferenceIt` working name — so the whole surface hangs off one `crucible` namespace.)
- Per-language binding sketches (each ecosystem's idiomatic test-repetition mechanism):
  - **Jest/Vitest (TS)** — `crucible.it(name, { runs, threshold }, body)`: plain function that registers `it()` and loops/aggregates internally. No framework extension API needed.
  - **xUnit (.NET)** — `[CrucibleFact(Runs = 20, Threshold = 0.95)]` custom attribute on the test method; implemented via xUnit's extensible `FactAttribute`/test-case discovery (prior art: xRetry, NUnit `[Repeat]`/`[Retry]`).
  - **JUnit 5 (Java)** — `@CrucibleTest(runs = 20, threshold = 0.95)` composed annotation; implemented as a `TestTemplateInvocationContextProvider` extension (same mechanism as native `@RepeatedTest`) plus threshold aggregation.
  - **pytest (Python)** — `@crucible.it(runs=20, threshold=0.95)` decorator (or marker + plugin hook); prior art: pytest-repeat.
  - Concept ports cleanly everywhere; the shell owns run orchestration in all cases.

## Assertion surface — native, boolean (decided 2026-08-10)

- No custom matchers. `crucible.coherent(response, claim)` → `Promise<boolean>`; asserted with each framework's native primitive (`expect(x).toBe(true)`, `Assert.True`, `assertTrue`, `assert`). `toMeet()` from the original README sketch is dropped.
- Rationale: eliminates per-framework matcher maintenance; assertion layer ports for free. Cost: native failure message is bare ("expected true") — mitigated: the Crucible engine prints judge diagnostics on failure; the framework asserts, Crucible explains.
- `runs` optional on `crucible.it()` — omitted = 1 run (smoke mode, cheap CI lane).
- Parallel runs by default — proper tests build a fresh isolated SUT per arrange, so runs don't share state. Serial fallback configurable post-MVP.

## Verbosity (decided 2026-08-10)

- `crucible.config.json` sets default detail level; env var (e.g. `CRUCIBLE_VERBOSE`) overrides config. Env wins because test frameworks lack native CLI flag passthrough and env vars work identically across all target ecosystems.
- Default failure output: first judge error per failing run; full-log level available. No file dumping — stdout redirection is the user's job.

## Judge configuration (user-volunteered, 2026-08-10)

- `crucible.config.json` at project root. Shape (illustrative):
  ```json
  { "provider": "openrouter", "model": "deepseek-v3", "meta": { "provider": "atlascloud", "reasoning": "minimal" } }
  ```
- `meta` is provider-specific passthrough — keys differ per provider (OpenRouter: provider routing, reasoning; Bedrock: its own). Each supported provider needs its own docs page at GA.
- MVP provider: OpenRouter (user deposits funds for e2e testing). CI: GitHub Actions.

## Competitive rationale (from README + landscape research)

- promptfoo: config-first vs Crucible code-first; acquired by OpenAI Mar 2026, roadmap → enterprise security/red-teaming under Frontier. Passing state via template vars is a workaround there, not a concept.
- DeepEval: strongest metric library (G-Eval); TS SDK follows Python, judge metrics + local eval Python-first; stateless input triple, no first-class state concept.
- semantic-expect: prior art on N-run probabilistic matchers in Jest/Vitest — stateless, OpenAI-only. Cite in docs/positioning.
- τ-bench pass^k: industry vocabulary for multi-run reliability, but it means all k runs pass. Crucible's threshold is a pass rate, so call it a "pass-rate threshold", not pass^k (corrected 2026-11-14).
- Full digest: research-landscape.md.
