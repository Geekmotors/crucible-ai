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

- source_spec: 2-3-fail-fast-without-burning-spend.md (code review 2026-11-13)
  summary: The per-test abort reaches only crucible's judge calls; the user's own SUT/provider calls in discarded runs keep running (and spending) after the test rejects. AC6 forbids a public signal handle in 2.3; decide whether a public `crucible.signal`-style accessor is wanted (would need an AD-5 amendment).
  evidence: Blind Hunter + Edge Case Hunter; `RunScope.abortSignal()` is internal only by spec.

- source_spec: 2-5-project-wide-run-defaults.md (code review 2026-11-13)
  summary: Jest fake timers in a user's test file. With `jest.useFakeTimers()`, the runner-owned deadline (and the judge-call deadline) use the faked global `setTimeout`. An omitted-`runs` declaration now has a ~24.8-day Jest backstop rather than 30 s, so a hung body can hang the suite. Decide on a timer boundary that is immune to fake timers, or document it as a gotcha in Story 3.6.
  evidence: Runner.startTimer resolves `setTimeout` at call time; Runner.ceilingFor returns TIMER_MAX_MS when runs are omitted.

## Deferred from: code review of 3-1-read-a-failure-like-a-report.md (2026-11-13)

- source_spec: 3-1-read-a-failure-like-a-report.md (code review 2026-11-13)
  summary: Runner-side discard snapshot (settled runs keep their status, unsettled → discarded at fatal/expiry) is locked only by reporter tests over hand-built results plus the existing "expired deadline cancels every run in flight" runner test. The review removed the public `CrucibleVerdictError.runStatuses` that locked it (test-induced public API). Revisit if a deliberate structured-verdict surface is designed (AD-3/AD-10 amendment) or Story 3.3 e2e can observe it.
  evidence: Runner.discardUnsettled; review triage log in the 3.1 story file.

- source_spec: 3-1-read-a-failure-like-a-report.md (code review 2026-11-13)
  summary: `seq` is taken when a verdict/error is recorded (judge completion), so concurrently awaited assertions in one body (`Promise.all`) are ordered by completion, not source order — "first failure" and "assertion k of n" follow completion order. Decide whether AD-13 wants seq reserved at assertion entry.
  evidence: RunScope.recordVerdict/recordError take seq after the judge call resolves.

- source_spec: 3-1-read-a-failure-like-a-report.md (code review 2026-11-13)
  summary: An errored run's `Judge attempts` comes from its lowest-seq ErrorRecord, not necessarily the record of the terminal cause shown on `Cause:` (pre-existing 2.x behaviour, preserved).
  evidence: Reporter.erroredSection / lowestSeqError.

- source_spec: 3-1-read-a-failure-like-a-report.md (code review 2026-11-13)
  summary: Run-number lists for hidden/discarded runs compress contiguous ranges but are not capped — a large gate with alternating outcomes (e.g. 1000 runs) can still emit hundreds of spans on one line. Cap span count if large gates become common (3.2 `full` remains the escape hatch).
  evidence: Reporter.ranges.

- source_spec: 3-1-read-a-failure-like-a-report.md (code review 2026-11-13)
  summary: `Thrown:`/`Cause:` pass error messages through verbatim, so Jest matcher messages carry their own ANSI colour codes into the report. AC4 forbids colour in crucible's markers only; decide whether to strip ANSI from rendered causes.
  evidence: Reporter.describe.
