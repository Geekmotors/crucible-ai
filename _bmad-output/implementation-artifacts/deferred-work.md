# Deferred Work

- source_spec: `_bmad-output/implementation-artifacts/spec-1-1-install-and-configure-crucible.md`
  summary: Document (Story 3.6 gotchas) that API keys must never be placed inside config `meta` — `meta` is an opaque passthrough per FR-7 and is deliberately not scanned for key-like fields, so a key committed there bypasses the NFR1 config guard.
  evidence: Review confirmed `meta` contents are never validated (by design, FR-7 opacity); the top-level key-like rejection cannot cover it, making this a real committable-secret hazard only docs can mitigate.

- source_spec: `_bmad-output/planning-artifacts/prds/prd-crucible-ai-2026-08-10/prd.md` (§4.3 assertion-selection doctrine, decided 2026-09-14)
  summary: Story 3.6 getting-started docs must teach the assertion-selection ladder — plain framework assertions first, `exact()`/`range()` for embedded values (post-MVP), `coherent()` only for inherently semantic claims (prose, reasoning, state consistency, knowledge boundaries).
  evidence: Doctrine decided with Jack 2026-09-14 and recorded in the PRD; without a docs entry it will be missed when Story 3.6 is drafted from the epic ACs alone.

- source_spec: `_bmad-output/implementation-artifacts/spec-1-2-reliable-judge-connectivity-via-openrouter.md`
  summary: No per-attempt timeout exists anywhere — a hung provider socket stalls a judge call forever and the retry machinery never engages; decide per-attempt timeout policy when Story 1.4's runner derives test timeouts from run count and provider budget (AD-3).
  evidence: Both reviewers flagged it; the spec matrix lists "timeout" as retryable input but only the caller's signal can currently produce one, and nothing arms such a signal yet.

- source_spec: `_bmad-output/implementation-artifacts/spec-1-3-coherent-instruction-schema-spike.md`
  summary: Extend the coherent conformance fixtures with genuinely ambiguous and adversarial cases (partial reveals, implication-only leaks, multi-fact state conflicts) before publishing GA judge-model guidance (OQ-6) — the current 4-case matrix is deliberately easy and all candidates scored perfectly on it.
  evidence: 60/60 verdicts across three models on the current matrix gives no discrimination between models; docs/judge-models.md flags the same caveat.

- source_spec: `_bmad-output/implementation-artifacts/spec-1-4-first-semantic-verdict-smoke-mode.md`
  summary: Verify the built artifact's schema loading under CJS and bundler-inlined consumers (import.meta.url package-root walk) in Story 3.3 e2e; and revisit injectGlobals:false Jest support (lazy @jest/globals import) with Story 3.6 docs gotchas.
  evidence: Review flagged both; the walk depends on tsdown's CJS shim and breaks if a consumer bundler inlines the package; the binding currently requires an injected global `it`.

- source_spec: PR #8 review discussion (2026-09-14)
  summary: When recommended judge-model guidance ships (OQ-6, docs epic), promote a model enum into src as its home — until then model identifiers stay user-supplied config data with the test enum in providers/test/test-model.enum.ts.
  evidence: Jack asked whether the test model enum should be usable by implementation; today src has no consumer for it (FR-7 keeps provider params opaque), but OQ-6's recommended-model docs would create one.

- source_spec: 2-1-repeat-and-gate-on-pass-rate.md (code review 2026-11-13)
  summary: No upper bound on `runs`. Absurd counts (> 2^32-1) make `Array.from` throw a RangeError rather than a usage error, and runs above ~2.1M push `timeoutFor` past the setTimeout maximum. Choose a product cap when concurrency caps / serial mode are designed.
  evidence: RunOptionsResolver.isValidRuns accepts any integer ≥ 1; concurrency caps are an explicit deferred non-goal in the story.

- source_spec: 2-1-repeat-and-gate-on-pass-rate.md (code review 2026-11-13)
  summary: Per-test timeout `30000 + (runs-1)×1000` assumes near-perfect parallelism; under provider throttling and retry backoff, Jest may kill a large gate before a verdict report is rendered. Revisit together with the Story 2.5 testDefaults budget note and OQ-3.
  evidence: Runner.timeoutFor; spec "Timeout policy" decision.

- source_spec: 2-1-repeat-and-gate-on-pass-rate.md (code review 2026-11-13)
  summary: The aggregate report renders one section per non-passed run with no bound or grouping, and the headline omits the failed count. Belongs to the Story 3.1 output contract.
  evidence: Reporter.renderVerdict / headline.

- source_spec: 2-3-fail-fast-without-burning-spend.md (code review 2026-11-13)
  summary: A per-call judge timeout (`AbortSignal.timeout(JUDGE_CALL_TIMEOUT_MS)`) surfaces as a raw `TimeoutError`/adapter abort error with no `CrucibleError` in its chain, so the runner classifies the run `failed` (semantic) instead of `errored` — violates AD-4 "infra never semantic". Fix: wrap a timeout-only abort (run signal not aborted) as `CrucibleError('infra', …, { retryable: true })` in `Judge`; needs an injectable per-call timeout source to test without real timers.
  evidence: Pre-existing since Story 1.4 (`judge.ts` timeout; `retry.ts` rethrows raw on `signal.aborted`); 2.3's `AbortSignal.any` keeps it reachable. Flagged by Edge Case Hunter and orchestrator review.

- source_spec: 2-3-fail-fast-without-burning-spend.md (code review 2026-11-13)
  summary: The per-test abort reaches only crucible's judge calls; the user's own SUT/provider calls in discarded runs keep running (and spending) after the test rejects. AC6 forbids a public signal handle in 2.3; decide whether a public `crucible.signal`-style accessor is wanted (would need an AD-5 amendment).
  evidence: Blind Hunter + Edge Case Hunter; `RunScope.abortSignal()` is internal only by spec.

- source_spec: 2-3-fail-fast-without-burning-spend.md (code review 2026-11-13)
  summary: Story 3.1 output contract — (a) smoke-mode (1-run) fatal now renders the abort headline ("0 in-flight run(s) discarded") instead of the pass-rate headline; (b) runner-side snapshot (settled runs keep status, unsettled → discarded) is only locked by reporter tests over hand-built results, because asserting the thrown report text from runner tests is forbidden (no error-message assertions, no reporter-call capture). Revisit when 3.1 defines a structured report surface.
  evidence: Acceptance Auditor; `Runner.discardUnsettled`, `Reporter.renderAborted`.
