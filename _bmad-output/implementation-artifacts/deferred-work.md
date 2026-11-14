# Deferred Work

- source_spec: `_bmad-output/implementation-artifacts/spec-1-2-reliable-judge-connectivity-via-openrouter.md`
  summary: No per-attempt timeout exists anywhere — a hung provider socket stalls a judge call forever and the retry machinery never engages; decide per-attempt timeout policy when Story 1.4's runner derives test timeouts from run count and provider budget (AD-3).
  evidence: Both reviewers flagged it; the spec matrix lists "timeout" as retryable input but only the caller's signal can currently produce one, and nothing arms such a signal yet.

- source_spec: `_bmad-output/implementation-artifacts/spec-1-3-coherent-instruction-schema-spike.md`
  summary: Extend the coherent conformance fixtures with genuinely ambiguous and adversarial cases (partial reveals, implication-only leaks, multi-fact state conflicts) before publishing GA judge-model guidance (OQ-6) — the current 4-case matrix is deliberately easy and all candidates scored perfectly on it.
  evidence: 60/60 verdicts across three models on the current matrix gives no discrimination between models; docs/judge-models.md flags the same caveat.

- source_spec: `_bmad-output/implementation-artifacts/spec-1-4-first-semantic-verdict-smoke-mode.md`
  summary: (CJS half closed by Story 3.3 — `e2e/core/cjs-build.test.cts` judges through `dist/index.cjs`.) (Docs half closed by Story 3.6 — `docs/gotchas.md` documents `injectGlobals: false` as unsupported.) Remaining: verify schema loading under bundler-inlined consumers (import.meta.url package-root walk); decide whether to support injectGlobals:false (lazy @jest/globals import).
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

- source_spec: 3-2-turn-up-the-volume-when-needed.md (code review 2026-11-13)
  summary: An abort that lands during the retry backoff sleep is not traced — `throwIfAborted` at the top of the next attempt throws with no `providerFailure` event, so the trace ends on "retrying in N ms". The run-settle / halt lines still show the outcome.
  evidence: RetryingCompleter.complete loop head.

- source_spec: 3-2-turn-up-the-volume-when-needed.md (code review 2026-11-13)
  summary: In-flight runs discarded by a fatal abort or deadline keep tracing (aborted provider call, judge error) after the halt/verdict line, possibly inside the next test's trace. Lines are run-tagged, so they are attributable; suppress after batch resolution if it confuses users.
  evidence: TraceReporter has no per-test lifecycle; RetryingCompleter/Judge trace on abort.

- source_spec: 3-2-turn-up-the-volume-when-needed.md (code review 2026-11-13)
  summary: Trace headlines carry `describe(cause)` and claim text unbounded (only prompt/reply/reasoning use the 2000-char payload bound). Same as the failure report's `Thrown:`/`Cause:`; bound both together if huge provider error bodies appear.
  evidence: TraceReporter.runSettled/providerFailure/testAborted/judgeRecorded.

- source_spec: 3-2-turn-up-the-volume-when-needed.md (code review 2026-11-13)
  summary: A judge-call deadline timeout is traced as "the call was aborted" (label made neutral in review); distinguishing judge timeout vs run abort needs the per-call deadline reason surfaced to RetryingCompleter.
  evidence: RetryingCompleter catch (signal.aborted branch); Judge combined signal.

- source_spec: 3-2-turn-up-the-volume-when-needed.md (code review 2026-11-13)
  summary: `CRUCIBLE_VERBOSE` is matched exactly (case- and whitespace-sensitive, like the config value). Decide whether to trim/lowercase env input.
  evidence: ConfigStore.requireVerbosity.

## Deferred from: implementation of 3-3-prove-it-end-to-end-locally.md (2026-11-13)

- source_spec: 3-3-prove-it-end-to-end-locally.md (real OpenRouter e2e, 2026-11-13)
  summary: The per-test deadline (30 s + 1 s per extra run) is too tight for bodies with several sequential assertions on a reasoning judge model. `deepseek/deepseek-v4-flash-0731` with default reasoning took ~11 s per call (≈2,200 reasoning tokens); a 3-run body with 3 sequential `coherent` calls expired at 32 s and reported ERRORED with discarded runs. There is no user knob for the budget. Decide timeout policy (per-assertion budget, a `timeoutMs` run option or a config budget) with the existing Runner.timeoutFor item and OQ-3.
  evidence: First e2e-ext run; e2e configs now pass `meta.reasoning.effort: "low"` (~4–5 s per call) to stay inside the deadline.
  status: Addressed by Story 4.1 (tune timeouts per test).

- source_spec: 3-3-prove-it-end-to-end-locally.md (real OpenRouter e2e, 2026-11-13)
  summary: The failure report's "first failed assertion" is the lowest-`seq` false verdict (AD-13), but a body may legitimately assert a false verdict (`expect(await crucible.coherent(...)).toBe(false)`). In a real failing run the report showed the expected-false step's reasoning as the failure while the actual failing step (a true-expected claim judged false) was not shown. Needs an AD-13 amendment (e.g. attribute by the verdict the thrown assertion consumed, or render all false verdicts of a failed run at default).
  evidence: e2e/core room-booking run with reasoning disabled; `CRUCIBLE_VERBOSE=full` was needed to find the real failing step.
  status: Deferred by Jack 2026-11-13. Jack wants to study the problem before choosing a solution, so don't implement it until he picks this up.

- source_spec: 3-3-prove-it-end-to-end-locally.md (real OpenRouter e2e, 2026-11-13)
  summary: `schemas/coherent.md` defines no rule for conflicting or superseding state facts (e.g. an appended cancellation contradicting a loaded booking, or "later, she opens the envelope"). With reasoning disabled the judge kept the older fact; with low reasoning, temporal knowledge-boundary updates were judged slowly and inconsistently. e2e fixtures were made monotonic (appends add facts, never contradict). Decide whether state is ordered with later facts superseding earlier ones and say so in the schema (adds to the 1.3 "multi-fact state conflicts" item).
  evidence: room-booking and knowledge-boundary fixture iterations during 3.3.
  status: Deferred by Jack 2026-11-13. Jack wants to study the problem before choosing a solution, so don't implement it until he picks this up.

- source_spec: 3-3-prove-it-end-to-end-locally.md
  summary: (Main-lane half closed by Story 3.5 — `make e2e-core` on every main push type-checks e2e.) e2e TypeScript is type-checked only by the Makefile (`tsc --noEmit -p e2e` after build) because it resolves `crucible-ai` to `dist/*.d.ts`; the PR lane (lint + typecheck + unit) lints e2e but does not type-check it. Story 3.5 (main lane runs `make e2e-core`) covers it on merge; add a build + e2e typecheck step to the PR lane if e2e type errors slip through.
  evidence: npm run typecheck stays src-only so it needs no build.

## Deferred from: code review of 3-3-prove-it-end-to-end-locally.md (2026-11-13)

- source_spec: 3-3-prove-it-end-to-end-locally.md (code review 2026-11-13)
  summary: (Closed for CI by Story 3.5 — main lane pins setup-node `24`.) `--use-system-ca` is accepted in `NODE_OPTIONS` only from Node 22.15 / 23.8; `engines` says `>=22`. Story 3.5's ubuntu main lane must pin a Node that accepts it (setup-node `22` resolves to latest 22.x, fine) or override `E2E_NODE_OPTIONS` (now `?=` in the Makefile) to drop it.
  evidence: Makefile `E2E_NODE_OPTIONS`.

## Deferred from: 3-4-language-agnostic-judge-conformance-spike.md (2026-11-13)

- source_spec: 3-4-language-agnostic-judge-conformance-spike.md
  summary: A content line `>>>\r` (CRLF input) is not "solely `>>>`", so neither `schemas/coherent.md` nor `PayloadAssembler` neutralises it and the judge may read it as a fence. Decide CRLF normalisation or `\r`-trimmed fence matching (schema rule + assembler, TDD).
  evidence: Offline sh-vs-TS payload diff with a CRLF edge case (identical output, both un-neutralised).

- source_spec: 3-4-language-agnostic-judge-conformance-spike.md
  summary: The conformance fixture has no golden assembled payloads, no `schema`/`version` binding and no assembly edge cases; assembler conformance currently needs a TS reference or live calls. Add payload vectors (checked by a TS unit test and `conformance.sh payloads`) — first step of the schema-pack extraction.
  evidence: Story 3.4 Findings, follow-ups 1–3.

- source_spec: 3-4-language-agnostic-judge-conformance-spike.md
  summary: `e2e/ext/conformance/conformance.sh` has no retry on 429/5xx (an errored call fails the check) and `alpine:3.22` is not digest-pinned. Harden before running it in any CI lane.
  evidence: Story 3.4 Review Triage Log.

## Deferred from: 3-5-e2e-core-on-merge-to-main.md (2026-11-13)

- source_spec: 3-5-e2e-core-on-merge-to-main.md
  summary: (Closed by Story 3.7 — both workflows SHA-pinned to v4.4.0 commits, `.github/dependabot.yml` keeps them fresh.) Workflow actions are pinned by major tag (`actions/checkout@v4`, `actions/setup-node@v4`), not commit SHA. The e2e job now holds `OPENROUTER_API_KEY`, so SHA-pin all actions (with Dependabot for updates) across `ci.yml` and the Story 3.7 publish workflow in one pass.
  evidence: `.github/workflows/ci.yml` (kept consistent with the existing `unit` job in 3.5).

- source_spec: 3-5-e2e-core-on-merge-to-main.md
  summary: (format:check half closed by Story 3.7 — added to the `unit` job.) Remaining: the spine's Structural Seed still annotates `e2e/core/ e2e/ext/` as "local-only" — stale since the AD-12 amendment (e2e/core also runs on the main lane).
  evidence: `.github/workflows/ci.yml` unit job; ARCHITECTURE-SPINE.md Structural Seed.

## Deferred from: 3-6-learn-it-from-the-docs-alone.md (2026-11-13)

- source_spec: 3-6-learn-it-from-the-docs-alone.md (doc-vs-code check)
  summary: (Closed by Story 3.7 — removed from the public surface before first publish; re-adding with a registration API later is non-breaking.) `ProviderAdapter`, `CompletionRequest` and `FailureClass` were exported as public types, but there is no public way to register an adapter (`providerRegistry` is internal; only `openrouter` resolves). The types suggest an extension point that does not exist. Decide before the first publish (Story 3.7 surface check): drop them from the entry point, or design a registration API (AD-2/AD-9 amendment). `docs/api.md` states the current truth.
  evidence: `src/index.ts`, `src/providers/registry.ts`; `docs/runs-and-threshold.md` previously said "a custom adapter must not either" (fixed in 3.6).

- source_spec: 3-6-learn-it-from-the-docs-alone.md (doc-vs-code check)
  summary: `crucible.it` is typed as one permissive signature `(name, optsOrBody: RunOptions | TestBody, maybeBody?)`, so `crucible.it(name, { runs: 5 })` with no body type-checks and only fails at registration (`usage`). Two overloads (`(name, body)`, `(name, options, body)`) would make it a compile error; the docs describe the call forms as overloads. TDD a type-level change if wanted (no runtime change). Story 3.7 decision: stays deferred past first publish — tightening later only rejects calls that already throw `usage` at registration, so it is not a practical breaking change.
  evidence: `dist/index.d.ts`; `docs/api.md` notes the permissive signature.

- source_spec: 3-6-learn-it-from-the-docs-alone.md
  summary: (Closed by Story 3.7 — README links are absolute `github.com/jackula83/crucible-ai/blob/main/docs/...` URLs and package.json has `repository`/`homepage`/`bugs`.) README linked to `docs/*.md` relatively, but `docs/` is not in the npm tarball and package.json has no `repository` field, so the links break on npmjs.com. Story 3.7 (npm README check) should add `repository` (npm then rewrites relative links to the GitHub repo) or switch README links to absolute GitHub URLs.
  evidence: package.json `files: [dist, schemas]`, no `repository`.

- source_spec: 3-7-ship-it-with-provenance.md
  summary: The publish pipeline has never run. The first real release (claim `crucible-ai` with an `NPM_TOKEN` granular token, tag `v0.1.0`, then switch to Trusted Publishing and revoke the token) is Jack's manual action per `RELEASING.md`. Things only that run can confirm: npm's OIDC-first/token-fallback order when both are configured, `origin/main` being present after a `fetch-depth: 0` tag checkout, and `npm install -g npm@11.21.2` on the runner's toolcache Node.
  evidence: `.github/workflows/publish.yml`; `RELEASING.md`. Validated so far only by actionlint, `npm pack --dry-run` and `verify:pack`.

- source_spec: 3-7-ship-it-with-provenance.md
  summary: The publish job installs `npm@11.21.2` from the registry by version, without an integrity pin. Once the Node 24 image bundles npm 11.5.1 or later, consider dropping the install and asserting `npm --version` instead.
  evidence: `.github/workflows/publish.yml` publish job.

## Deferred from: code review of 4-1-tune-timeouts-per-test.md (2026-11-13)

- source_spec: 4-1-tune-timeouts-per-test.md
  summary: Jest ceiling margin collapses near the timer maximum. `ceilingFor` = min(2147483647, testTimeout + 5000), so a declared `testTimeout` within 5 s of 2147483647 leaves the Jest backstop at or barely above the runner deadline, and Jest can fail the test before the runner renders its expiry report. Fix options: cap the accepted testTimeout at TIMER_MAX − margin, or document it.
  evidence: `src/core/runner.ts` `ceilingFor`.

- source_spec: 4-1-tune-timeouts-per-test.md
  summary: `inferenceTimeout` is armed per reply attempt, not per `coherent()` call. With the one re-ask on an unparseable reply, a single assertion can take up to 2 × inferenceTimeout. This is unchanged from the pre-4.1 30 s behaviour and the docs say "each judge reply attempt" correctly, but AC 2 says "each coherent() judge call". Decide whether to budget the whole call.
  evidence: `src/core/judge.ts` `judgedReply` / `completeBeforeDeadline` (MAX_REPLY_ATTEMPTS = 2).

- source_spec: 4-1-tune-timeouts-per-test.md
  summary: The public `crucible.it` forwards only four arguments, so `(name, opts, body, ms, extra)` silently drops `extra`; only the body-first form reports a surplus argument. Typed callers can't hit this. It folds into the existing 3.6 overloads item (overloads would also make `(name, opts, 5000)` and `(name, body, body)` compile errors).
  evidence: `src/api/crucible.ts` `it`, `src/bindings/jest.ts` `declaration`.

- source_spec: 4-1-tune-timeouts-per-test.md
  summary: Two usage messages are misleading even though the error kind is right. `(name, body, undefined, n)` says "argument after the timeout", and `(name, opts, body, fn)` blames `testTimeout` instead of reporting two bodies. The positional slot shift in `normalize`/`declaration` causes both.
  evidence: `src/bindings/jest.ts`.

- source_spec: 4-1-tune-timeouts-per-test.md
  summary: The debug trace's `test started` line shows runs, threshold and the deadline but not the resolved `inferenceTimeout`, so a tuned judge budget can't be checked from the trace. `testStarted` takes `RunGate`.
  evidence: `src/core/trace-reporter.ts` `testStarted`.

- source_spec: 4-1-tune-timeouts-per-test.md
  summary: Test hygiene (pre-existing patterns, extended by 4.1). Runner and binding tests compute expected deadlines with production `TimeBudget.testTimeoutFor` instead of the `TimeoutBudget` enum oracle. Harness helpers repeat `'the response'`/`'the claim'` literals, and `ClaimText.Default` already exists. Sweep both in one pass.
  evidence: `src/core/runner.test.ts`, `src/bindings/test/jest-harness.util.ts` `runnerBudget`, `src/core/test/judge-harness.util.ts`, `src/core/test/runner-harness.util.ts`.

- source_spec: 4-1-tune-timeouts-per-test.md
  summary: `RunScope.enterRun(body, signal?, run?, inferenceTimeout?)` keeps growing optional positional parameters, and callers pad with `undefined`. It also has its own inference default, separate from the resolver. Consider one options object.
  evidence: `src/core/state.ts`, `src/core/test/judge-harness.util.ts`.

## Deferred: product roadmap (2026-11-13)

- source_spec: Jack, product discussion after the v0.1.0 release
  summary: Port Crucible to C# (xUnit first, with the `[CrucibleFact(Runs, Threshold)]` shape sketched in docs/inspiration.md). Deferred until the TypeScript API settles: `extract()` (Story 4.2) and the failure-report attribution study change the surface, and porting earlier would mean redoing both in two languages. The judge schemas are already language-agnostic; the 3.4 conformance spike (`make conformance`, curl + jq only) is the starting point and must pass unchanged against the C# client.
  status: Deferred by Jack 2026-11-13, after Story 4.2.


## Deferred from: code review of 4-2-extract-a-value (2026-11-13)

- source_spec: 4-2-extract-a-value.md
  summary: Live verification still outstanding. Neither `make e2e-ext` (extract conformance matrix, failure-report extraction, debug-trace extraction) nor `make conformance` (11 extract cases, with the reworded rules 2/4/6/8 of `schemas/extract.md`) has run against a real provider. The candidates for flakes are `state-only-value`, `string-value` and the debug-trace child's exact `toBe("Tuesday")`. That child's pass/fail now depends on an exact string, so if it flakes, switch the scenario to a boolean target.
  evidence: `e2e/ext/extract-conformance.test.ts`, `e2e/ext/fixtures/extract-conformance.json`, `e2e/ext/fixtures/projects/debug-trace/`.

- source_spec: 4-2-extract-a-value.md
  summary: Gaps in the extract schema. There is no rule for case or canonical form of strings ("NYC" vs "New York"), and none for a response that commits to different values for different things under one ambiguous target ("two in the bowl, five in the bag"). Settle both with conformance cases.
  evidence: `schemas/extract.md` rules 2 and 5.

- source_spec: 4-2-extract-a-value.md
  summary: Report gaps for extractions:
  - errored runs don't list their extractions in the default verbosity;
  - the hidden-runs "Failing claims" tally labels extraction-driven failures "thrown without a false verdict";
  - default Extraction lines are unbounded per run;
  - descriptions and claims are wrapped in literal quotes with no escaping, so an embedded `"` is ambiguous.
  evidence: `src/core/reporter.util.ts` `erroredSection`, `failureLabel`, `extractionFields`, `extracted`; `src/core/trace-reporter.ts` `judgeRecorded`.

- source_spec: 4-2-extract-a-value.md
  summary: `JudgeExchange` refactor drift, unreachable in practice:
  - recording and tracing a verdict or extraction now runs outside the exchange's error-recording `try`;
  - the schema text now loads before the completion target is resolved, so when both fail the config error surfaced differs.
  The trace tells record types apart by property (`'description' in record`) rather than by a discriminant.
  evidence: `src/core/judge.ts`, `src/core/extractor.ts`, `src/core/judge-exchange.ts` `ask`, `src/core/trace-reporter.ts`.

- source_spec: 4-2-extract-a-value.md
  summary: Number values that are integers beyond `Number.MAX_SAFE_INTEGER` pass validation after silent rounding. Consider re-asking on unsafe integers.
  evidence: `src/core/extractor.ts` `matches`.

- source_spec: 4-2-extract-a-value.md
  summary: The architecture spine still states the boolean-only assertion contract (AD-6), "parsing lives only in core/judge" (AD-7) and `RunContext { state, verdicts, errors }` (AD-5). Amend it for `extract()`, `JudgeExchange` and `extractions`.
  evidence: `_bmad-output/planning-artifacts/architecture/architecture-crucible-ai-2026-08-10/ARCHITECTURE-SPINE.md`.

- source_spec: 4-2-extract-a-value.md
  summary: The conformance harness interface changed for existing coherent users. The `CONFORMANCE_SCHEMA`/`CONFORMANCE_CASES` overrides are gone (replaced by `_DIR`), and the `payloads` headers now read `=== coherent/<id>`. Verdicts are unaffected. Note it in a changelog, or restore aliases.
  evidence: `e2e/ext/conformance/conformance.sh`.

- source_spec: 4-2-extract-a-value.md
  summary: Docs polish:
  - `docs/api.md` lists four `extract` signature forms, but the declaration is one generic signature;
  - a few lines in getting-started.md, gotchas.md and instruction-schema.md break the hard-wrap style;
  - internal `Judge` names (`response`, `claim`) still differ from the public `(actual, expectation)`.
  evidence: `docs/api.md`, `docs/getting-started.md`, `docs/gotchas.md`, `docs/instruction-schema.md`, `src/core/judge.ts`.

- source_spec: 5-1-openai-compatible-provider.md
  summary: The architecture spine still describes a single OpenRouter adapter: AD-8/AD-9 name `OPENROUTER_API_KEY` as the only key variable (Story 5.2 replaced it with `CRUCIBLE_JUDGE_KEY` / `apiKeyEnv` for every provider, contradicting AD-9's "provider-native var" and "`CRUCIBLE_` reserved" wording, and added a stderr warning outside the reporter, contradicting AD-10) and `config.get().provider` as "the resolved adapter singleton", the directory map lists `providers/openrouter.ts` as "MVP adapter", and AD-12 permits only `OPENROUTER_API_KEY` as a CI secret (now `CRUCIBLE_JUDGE_KEY`). Amend for provider factories (`ProviderRegistry.create(name, settings)`), the shared `ChatCompletionsAdapter`, `baseUrl`/`apiKeyEnv`, and the `openai`/`openai-compatible` providers.
  evidence: `_bmad-output/planning-artifacts/architecture/architecture-crucible-ai-2026-08-10/ARCHITECTURE-SPINE.md`.

- source_spec: 5-1-openai-compatible-provider.md
  summary: Live verification pending — `make e2e-ext` (new `e2e/ext/openai-compatible.test.ts`) and `make conformance CONFORMANCE_CONFIG=e2e/ext/fixtures/projects/openai-compatible/crucible.config.json` were written but not run (no key in the dev shell; the key variable is now `CRUCIBLE_JUDGE_KEY`). Azure OpenAI, Ollama and LiteLLM remain untested against live services, as the docs say.
  evidence: `e2e/ext/openai-compatible.test.ts`, `Makefile` `conformance`.

## Deferred from: code review of 5-1-openai-compatible-provider.md (2026-11-14)

- source_spec: 5-1-openai-compatible-provider.md
  summary: A key made only of letters, digits and underscores passes the `apiKeyEnv` name check and is then named in the missing-key error. Inherent to the format; docs now warn. Since Story 5.2 this applies to every provider, not only `openai-compatible`. Consider a heuristic (length/entropy, known prefixes like `gsk_`).
  evidence: `src/core/config.ts` `requireApiKeyEnv`.

- source_spec: 5-1-openai-compatible-provider.md
  summary: A `baseUrl` that already ends in `/chat/completions` (copied from provider docs) is accepted and fails as a fatal 404. Consider rejecting it at config load.
  evidence: `src/core/config.ts` `requireBaseUrl`.

- source_spec: 5-1-openai-compatible-provider.md
  summary: Design/test nits: `ProviderRegistry.tryCreate` swallows every error (narrow to config `CrucibleError`); `OpenAiCompatibleProvider.create` duplicates the registry's `baseUrl` required check; format errors on `baseUrl`/`apiKeyEnv` precede the provider-applicability error; `openai-compatible` HTTP errors don't name the endpoint; `ChatEndpoint` type exported from the class file; bare literals `11434`/`42`/`'fake'`/`'test-endpoint'`; identity `.toBe(adapter)` in registry tests; provider happy paths tested at three layers; the "wrong key" adapter test mostly exercises the fake's 401; e2e `JestProcess.revealsApiKey` hard-codes the key variable (now `CRUCIBLE_JUDGE_KEY`).
  evidence: `src/providers/registry.ts`, `src/providers/openai-compatible.ts`, `src/core/config.ts`, `src/providers/chat-completions-adapter.ts`, `src/core/config.test.ts`, `src/providers/registry.test.ts`, `e2e/test/jest-process.util.ts`.

- source_spec: 5-1-openai-compatible-provider.md
  summary: Makefile `conformance`: `$(abspath $(CONFORMANCE_CONFIG))` breaks on paths with spaces; `key-env` costs an extra `docker run`.
  evidence: `Makefile` `conformance`.

- source_spec: 5-1-openai-compatible-provider.md
  summary: OpenRouter users see renamed error classes and messages in traces and report causes (`ProviderHttpError`, `Provider "openrouter" responded with HTTP …`, missing-key wording) although the wire request is unchanged. Note in the changelog.
  evidence: `src/providers/provider-http-error.ts`, `src/providers/provider-envelope-error.ts`.

- source_spec: 5-1-openai-compatible-provider.md
  summary: The docs TS-example compile check (examples against `dist`) was a scratchpad script; commit it as a script or CI step so it is reproducible.
  evidence: `docs/*.md`.

## Deferred from: code review of 5-2-judge-key-source.md (2026-11-14)

- source_spec: 5-2-judge-key-source.md
  summary: The plain-http warning is once per factory instance; Jest loads the module afresh per test file, so it prints once per test file, not once per process as AC5 says (docs now say "per test file"). True once-per-process needs state that survives Jest's module reset (e.g. a `globalThis` key behind an injected boundary). Decide whether per-file is acceptable.
  evidence: `src/providers/registry.ts` `providerRegistry`, `src/providers/openai-compatible.ts`.

- source_spec: 5-2-judge-key-source.md
  summary: Upgraders from 0.2 with only `OPENROUTER_API_KEY` / `OPENAI_API_KEY` set get "Set the CRUCIBLE_JUDGE_KEY…" with no hint the old variable was dropped; `openai-compatible` users without `apiKeyEnv` silently go keyless (401). Decide whether to add a migration hint (naming the legacy variable only, never its value) or rely on a changelog.
  evidence: `src/providers/chat-completions-adapter.ts` `rejectMissingKey`.

- source_spec: 5-2-judge-key-source.md
  summary: The plain-http warning prints the full `baseUrl`, path included; a gateway that embeds a tenant token in the path would have it written to stderr/CI logs. Consider printing only the origin (core and conformance).
  evidence: `src/providers/openai-compatible.ts` `warnPlainHttp`, `e2e/ext/conformance/conformance.sh` `warn_plain_http`.

- source_spec: 5-2-judge-key-source.md
  summary: Conformance loopback detection matches the raw host, so `[0:0:0:0:0:0:0:1]`, `127.1`, `2130706433`, `0x7f.0.0.1` and `127.0.0.1.` warn in the harness but not in core (WHATWG URL normalises them). False positives only (safe direction). Also `[::ffff:127.0.0.1]`, `localhost.` and `*.localhost` warn in both. Conformance also accepts malformed `127...1` as loopback (curl then fails). Its key check rejects only `"`, `\` and control characters, while core now rejects anything outside visible ASCII.
  evidence: `e2e/ext/conformance/conformance.sh` `plain_http_host`, `require_key`.

- source_spec: 5-2-judge-key-source.md
  summary: `TransportSecurity.exposesKey` calls `new URL(baseUrl)` in `create()`; a direct registry/factory call with an unparseable `baseUrl` throws a raw `TypeError` (ConfigStore validates first, so normal use is unaffected). A throwing warning sink would likewise surface as an unclassified error.
  evidence: `src/providers/transport-security.util.ts`, `src/providers/openai-compatible.ts`.

## Deferred from: code review of 6-1-sensible-defaults.md (2026-11-14)

- source_spec: 6-1-sensible-defaults.md
  summary: `CHANGELOG.md` ships in the tarball, but nothing fails a release whose changelog still says `## Unreleased` or lacks the tagged version; RELEASING.md relies on a manual rename.
  evidence: `scripts/verify-pack.mjs`, `RELEASING.md` step 3.

- source_spec: 6-1-sensible-defaults.md
  summary: `Parameters<typeof crucible.it>` resolves to the last overload only, and `CrucibleSurface` is not exported, so users cannot derive wrapper types from the overload set.
  evidence: `src/api/crucible-surface.ts`, `src/index.ts`.

- source_spec: 6-1-sensible-defaults.md
  summary: Public JSDoc'd `RunOptions` mirrors core `RunOptions` field by field; a field added in core would not appear on the public type and the compiler would not flag it.
  evidence: `src/api/run-options.ts`.

- source_spec: 6-1-sensible-defaults.md
  summary: No live e2e exercises the new 10-run default end to end (all fixtures pin runs or use `testDefaults`); `failure-report` scenarios would become 10 real judge calls each if their `testDefaults` were removed.
  evidence: `e2e/ext/fixtures/projects/failure-report/`.

## Deferred from: code review of 6-2-commented-config-and-init.md (2026-11-14)

- source_spec: 6-2-commented-config-and-init.md
  summary: Syntax errors without a V8 `position N` in the JSON.parse message (e.g. truncated file) report no line number.
  evidence: `src/core/jsonc-reader.util.ts` `lineOfFailure`.

- source_spec: 6-2-commented-config-and-init.md
  summary: Duplicate keys silently keep the last value; VS Code warns. Uncommenting a template line already set elsewhere gives a surprising effective config.
  evidence: `src/core/jsonc-reader.util.ts`, `src/core/config.ts`.

- source_spec: 6-2-commented-config-and-init.md
  summary: A partial `init` write (ENOSPC/EIO after open) leaves a truncated `crucible.config.jsonc` that blocks re-running init.
  evidence: `src/cli/node-project-files.ts`.

- source_spec: 6-2-commented-config-and-init.md
  summary: EPIPE on closed stdout/stderr crashes the CLI with a stack trace instead of its exit code.
  evidence: `src/cli.ts`, `src/cli/stream-cli-output.ts`.

- source_spec: 6-2-commented-config-and-init.md
  summary: The generated template is copied by hand into README, configuration.md and getting-started.md; nothing checks they match `ConfigTemplate`.
  evidence: `src/cli/config-template.util.ts`, docs.

- source_spec: 6-2-commented-config-and-init.md
  summary: CLI has no `--version`.
  evidence: `src/cli/crucible-cli.ts`.

- source_spec: 6-2-commented-config-and-init.md
  summary: `ConfigStore.fileName` is mutable state set as a side effect of `readRaw`; file names are chosen by tuple index (`CONFIG_FILE_NAMES[1]`).
  evidence: `src/core/config.ts`, `src/cli/config-template.util.ts`.

## Deferred from: code review of 6-3-describe-group-settings.md (2026-11-14)

- source_spec: 6-3-describe-group-settings.md
  summary: No in-repo real-Jest fixture covers `crucible.describe` (nested plain describe, describe.skip/only/each); unit tests rely on `DescribeRegistrarFake`, real Jest checked by manual smoke only.
  evidence: `src/bindings/test/describe-registrar.fake.ts`.

- source_spec: 6-3-describe-group-settings.md
  summary: `NodeProjectFiles.exists` treats any stat error as "exists", so `init` in a sandbox that refuses lookups of missing files reports an existing config and writes nothing.
  evidence: `src/cli/node-project-files.ts`.

## From Story 6.3 review decisions (2026-11-14)

- **Sync-only describe callback lives in core.** Vitest allows async suite callbacks. When the Vitest adapter is built, move the thenable check into the Jest binding (or make it per-binding). Decided: keep shared for now.
- **One settings stack per loaded module copy.** Mixing `index.cjs` and `index.js`, or `jest.isolateModules`, silently drops describe inheritance (config and state behave the same today). Decided: document in gotchas when the Vitest epic touches the binding layer; detection not worth it yet.

## Deferred from: code review of 6-4-lenient-strict-extract.md (2026-11-14)

- source_spec: 6-4-lenient-strict-extract.md
  summary: `RunScope.enterRun` takes run settings positionally (signal, run, inferenceTimeout, strict); call sites pass `undefined` placeholders. Switch to a settings object.
  evidence: `src/core/state.ts`, `src/core/test/extractor-harness.util.ts`.

- source_spec: 6-4-lenient-strict-extract.md
  summary: Built-in `strict: false` lives in both `RunScope.enterRun`'s parameter default and `RunOptionsResolver.DEFAULT_STRICT`.
  evidence: `src/core/state.ts`, `src/core/run-options-resolver.util.ts`.

## Deferred from: code review of 6-5-facts-per-call-and-per-run.md (2026-11-14)

- Errored judge calls (`ErrorRecord`) record no facts, so the failure report shows no `Facts:` for a call that errored, and a per-call `{ facts }` is lost for it. Evidence: `src/core/state.ts`, `src/core/reporter.util.ts`.
- Surplus arguments to `crucible.facts`/`load`/`append`/`coherent` are silently ignored (`describe` rejects surplus). Evidence: `src/api/crucible.ts`.

## From Story 6.5 review decisions (2026-11-14)

- **Multi-line facts read as several facts** (report and wire both join with `\n`). Accepted for now; consider numbering facts in the report or the STATE section if users hit it (wire change needs conformance).
- **Empty / whitespace-only facts are accepted** (pre-existing for `load`/`append`). Consider rejecting as `usage` at 1.0 alongside alias removal.

## From Story 7.1 review decisions (2026-11-14)

- **Gate on Jest's default 5 s timeout.** The gate's default deadline is 39 s; on a plain `it` without a timeout argument Jest cuts the test off with no Crucible report. Docs-only for now (README, api.md, gotchas, runs-and-threshold). Revisit in 7.2/7.3: e.g. a one-time warning when the runner's per-test timeout is known to be shorter than the gate's deadline (Vitest exposes it on the test context; Jest does not).
- **`TestBody` now `(t: RunContext) => unknown`.** Listed under Added with a note; not marked Breaking (only code that invokes a TestBody itself is affected).

## Deferred from: code review of 7-2-generic-runner-wrapper.md (2026-11-14)

- Proxy has no `ownKeys`/`getOwnPropertyDescriptor` traps, so `Object.keys(crucible.it)` is empty and REPL autocomplete shows no variants. Evidence: `src/core/runner-wrapper.ts`.
- The runtime variant tree (`JestBinding` nodes) and the public `CrucibleIt`/`CrucibleDescribe` types are tied only by type tests; a cast bridges them. Evidence: `src/api/crucible.ts`.
- A trailing timeout of `null` is a `usage` error; Jest treats it as the default (pre-existing). Evidence: `src/core/declaration-forms.util.ts`.
- Binding tests repeat `TestName` templates in expected row names. Evidence: `src/bindings/jest.test.ts`.

## From Story 7.2 review decisions (2026-11-14) — do in Story 7.3

- Add `src/core/runner-wrapper.test.ts` with a runner-neutral fake spec (tests beside code); keep `src/bindings/jest.test.ts` as the Jest-spec suite.
- Move the `failing`/`concurrent` block reasons from the Jest adapter to a core constant so the Vitest spec maps onto the same reasons.

## Deferred from: dev of 7-3-vitest-adapter.md (2026-11-14)

- `crucible.it.skipIf(cond)` / `runIf(cond)` (and the describe ones) return a plain registrar; Vitest's own return value is a full chain (`.only`, `.each`, `.for`). Chaining after a condition is not wrapped (usage error). Evidence: `src/bindings/vitest.ts`.
- Group inheritance on Vitest relies on `TestRunner.getCurrentSuite()` and the `collector.suite` / `suite.suite` parent links (typed in Vitest's public d.ts, but runner-level API). If a Vitest release changes them, each `crucible.describe` now fails with a `usage` error when collected (code review fix); a change that keeps the links but breaks identity would still be caught only by the e2e group scenario. Evidence: `src/bindings/vitest.ts`, `src/api/crucible-vitest.ts`.
- Vitest exposes the per-test timeout on the test context, so a one-time warning when the runner's timeout is shorter than the gate's deadline (7.1 decision) is now possible for `crucible.gate` on Vitest. Not done.
- `test.extend` fixtures are not reachable from `crucible.it` bodies (context dropped by design). A `crucible.it` bound to an extended `test` would need a spec built over that `test`.
- The CommonJS build of `crucible-ai/vitest` always throws Vitest's own CommonJS error (Vitest's `require` condition is a throwing stub); kept for `.d.cts` types in CommonJS-mode TypeScript projects. Documented in gotchas.

## Deferred from: code review of 7-3-vitest-adapter.md (2026-11-14)

- `crucible.it`/`crucible.describe` from `crucible-ai/vitest` called outside a Vitest run surface Vitest's raw `TypeError` rather than a `CrucibleError('usage')`. Evidence: `src/core/runner-wrapper.ts` registerTest/registerGroup.
- Crucible tests/groups opt out of inherited `concurrent`/`shuffle`, but a plain suite Vitest runs concurrently (e.g. `sequence.concurrent: true`) can still run alongside another suite holding Crucible tests. Documented in docs/api.md. Evidence: `src/bindings/vitest.ts`.
- `errorFrom` helper duplicated in four harnesses; candidate for one shared `.util.ts`.
- Binding tests hand-build expected row names and use inline error literals and run counters (same as `jest.test.ts`).
- `package-lock.json` carries transitive tsdown/rolldown bumps (`@oxc-project/types`, `@emnapi/*`, sourcemap-codec) unrelated to the story; confirm intended before merge.
- `VitestBindingHarness` wires `Gate`/`GroupSettings` by hand instead of through `CompositionRoot`.

## Deferred from: code review of 8-1-spec-run-options-and-verdicts (2026-11-14)

- Per-operation input schemas for spec fixtures (`input` is free-form in `spec/fixture.schema.json`, so a misspelt input key goes unnoticed) — do in Story 8.2.

## Deferred from: dev of 8-2-spec-payloads-and-reports (2026-11-14)

- Payload fencing splits content on `\n` only, so a `>>>` line ending in `\r` (CRLF content) or set off by U+2028/U+2029 is not neutralised; TS and the jq builder agree. Decide whether fencing should treat CRLF/CR as line breaks (a behaviour change for every port and the jq harness). Pinned by `payload-*-crlf-response`, `payload-coherent-lone-cr-response`, `payload-coherent-unicode-separators`.

## Deferred from: code review of 8-2-spec-payloads-and-reports (2026-11-14)

- Fencing hardening: neutralise a fence line when, after splitting on every line break (`\r\n`, `\r`, `\n`, U+2028, U+2029) and trimming surrounding white space, it equals `<<<` or `>>>`; keep original separators. Prompt-injection relevance: a CRLF response holding `>>>` then `CLAIM`/`<<<` lines can look like a forged section to a model. Needs TS + jq builder + payload fixtures + a conformance run.
- `excerptChars: 1` with a value that is one astral character renders `(first 2 of 2 chars): 😀…` (marked cut although whole). Pinned by `report-render-truncation-sole-astral-character`; fix = take the untruncated branch when the cut covers the value.
- Before Story 8.5 deletes the TS conformance e2e: prove TS = jq for the system prompt (schemas/*.md verbatim) and the request envelope (`chat_request`: model, meta, usage), e.g. in Story 8.3's provider request fixtures.
