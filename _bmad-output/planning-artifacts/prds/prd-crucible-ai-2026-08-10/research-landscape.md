# Landscape research digest — 2026-08-10

**1. promptfoo**
- OpenAI acquired Mar 9 2026 (~$86M valuation). Tech → OpenAI Frontier (enterprise agent platform). Focus: security/red-team, not app eval.
- Stays open source; multi-provider support = open question.
- Config-first (YAML asserts), CLI, CI. Has Jest/Vitest matchers but bolt-on. App-level semantic testing likely deprioritized.
- OpenAI Evals platform deprecated Jun 2026 (dead Nov 30 2026); official migration path = promptfoo. Consolidation → eval whitespace outside OpenAI ecosystem.

**2. DeepEval**
- 4.0 repositioned: "unit testing for LLMs" → "eval harness for vibe-coding agents". pytest-native, Python-first.
- TS: `deepeval-ts` npm v0.1.28 = thin Confident AI API client. Real TS SDK in Python monorepo; local evals ~Jul 2026, target 80% parity. TS second-class, tethered to Confident AI cloud.
- G-Eval = flagship judge metric. Stateless input triple; no first-class state concept.

**3. Comparables**
- **Braintrust/autoevals**: code-first, framework-agnostic, meters scores ($2.50/1k after 10k free). autoevals = OSS TS+Py scorers.
- **LangSmith**: trace-first; `langsmith/vitest`+`jest` custom describe/test, `wrapEvaluator()`. No N-run/threshold semantics; cloud sync.
- **evalite** (Matt Pocock): TS-native, Vitest-based, local-first, free, trace UI. Eval-runner, not in-suite assertion.
- **vitest-evals** (Sentry) + **viteval**: evals as unit tests in Vitest. Closest ergonomic neighbors. Stateless input/output scoring.
- **semantic-expect** (agorischek): `await expect(generator).toGenerate('requirement', numRuns)` — N-run + pass-count in Jest/Vitest. Direct prior art on probabilistic assertion. But 5 stars, early, stateless, OpenAI-only, no state-as-input concept.
- **llm-assert**: Playwright matchers. Niche.
- **Ragas**: RAG metrics, Python. Not competing.
- **Phoenix/Arize**: OTel observability. Infra play, not in-test.

**4. State-as-input / probabilistic prior art**
- Nothing treats system state as first-class assertion input in a test lib. Closest = research benchmarks: STATE-Bench (MSFT May 2026, agent memory, pass^5), NARRA-Gym (interactive-narrative agent eval, academic — watch), WorldMemArena.
- Probabilistic assertion: τ-bench pass^k metric (all k runs succeed) = industry-standard vocabulary (in Anthropic model cards); Crucible's threshold is a pass rate, a different measure. Consensus: run N, pass rate, threshold per stakes; some argue baseline-relative gates > fixed thresholds. semantic-expect = only unit-test-framework impl found.

**5. Positioning matrix**
- Config-first: promptfoo. Code-first: Braintrust, evalite, vitest-evals, DeepEval(Py), semantic-expect.
- Only vitest-evals / semantic-expect / LangSmith-vitest run *inside* existing test runners in-process.
- Judge cost: Braintrust meters; evalite local+caching; DeepEval pushes cloud; judge choice mostly BYO-key.

**Threats/gaps vs Crucible**
- Threats: vitest-evals/evalite could add N-run thresholds cheaply; DeepEval TS parity landing; semantic-expect = concept prior art (cite it).
- Gap Crucible owns: system state as typed first-class assertion input + in-process SUT + pass-rate thresholds as one coherent TS API. No incumbent does this.

Sources: OpenAI×Promptfoo announcement, promptfoo blog, Forbes, Futurum, DeepEval 4.0 blog, DeepEval TS monorepo blog, deepeval-ts npm, Braintrust vs LangSmith (morphllm), LangSmith vitest/jest docs, evalite GitHub, InfoQ evalite, vitest-evals GitHub, Sentry blog, semantic-expect GitHub, llm-assert GitHub, τ-bench arXiv 2406.12045, STATE-Bench (MSFT blog), NARRA-Gym arXiv 2605.08503, OpenAI Evals deprecation (therouter.ai), promptfoo jest docs, MarkTechPost 2026-08 platform comparison.
