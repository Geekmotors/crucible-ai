# Judge Model Notes — `coherent` schema validation (Story 1.3 spike)

Run date: 2026-09-14 · 3 models × 4 conformance cases × 5 repetitions = 60 real
OpenRouter calls against `schemas/coherent.md` (schema as system prompt, payload
assembled per the schema's documented order). Fixtures:
`e2e/ext/fixtures/coherent-conformance.json`.

## Results

| Model | JSON compliance | Verdict accuracy | Median latency | Cost / call | Total run cost |
| --- | --- | --- | --- | --- | --- |
| `deepseek/deepseek-v4-flash-0731` | 20/20 | 20/20 | 4.8 s | ~$0.00004 | $0.0008 |
| `google/gemini-3.8-flash` | 20/20 | 20/20 | 3.2 s | ~$0.0014 | $0.027 |
| `anthropic/claude-sonnet-5` | 20/20 | 20/20 | 2.4 s | ~$0.0025 | $0.049 |

## Ratings (1–5; reliability graded by comparing each model's verdicts and stated reasoning against Claude Fable 5's own interpretation of every case)

| Model | Speed | Cost | Reliability | Notes |
| --- | --- | --- | --- | --- |
| `deepseek/deepseek-v4-flash-0731` | 3 | 5 | 5 | Slowest of the three but ~65× cheaper than sonnet; every verdict and reasoning matched the reference interpretation; reasoning concise and correctly cites the deciding fragment |
| `google/gemini-3.8-flash` | 4 | 4 | 5 | Quotes response evidence verbatim in reasoning; fully aligned verdicts |
| `anthropic/claude-sonnet-5` | 5 | 3 | 5 | Fastest and the only model that explicitly weaves STATE facts into its justification (richest diagnostics for failure output) |

## Recommendation (feeds OQ-6)

- **Default judge:** `deepseek/deepseek-v4-flash-0731` — indistinguishable
  accuracy on this matrix at a fraction of the cost; multi-run pass-rate testing
  multiplies call volume, so cost dominates.
- **When failure diagnostics matter most:** `anthropic/claude-sonnet-5` —
  fastest verdicts and the most state-aware reasoning.
- **Caveat:** this matrix is small and unambiguous by design. Before GA
  model guidance, extend fixtures with genuinely ambiguous and adversarial
  cases (partial reveals, implication-only leaks, multi-fact state conflicts)
  — deliberate follow-up for the conformance cases.

## Wire findings (confirms Story 1.2 adapter assumptions)

- Envelope shape `choices[0].message.content` confirmed on all three models.
- Strict-JSON output held for 60/60 calls with no code fences — the schema's
  output contract is sufficient without provider structured-output params.
- `usage: { include: true }` returns per-call `usage.cost` — useful for a
  future spend report.
- Local dev gotcha: Node's fetch rejects the corporate TLS proxy
  (`SELF_SIGNED_CERT_IN_CHAIN`); run harnesses/e2e with `--use-system-ca`.
  The e2e Makefile (Story 3.3) should bake this in.

## Reasoning effort and the per-test deadline (Story 3.3 e2e)

Measured 2026-11-13 against real OpenRouter while building the e2e suite:

| `deepseek/deepseek-v4-flash-0731` with | Latency per call | Cost per call | Reasoning tokens |
| --- | --- | --- | --- |
| default reasoning | ~11.7 s | ~$0.0007 | ~2,200 |
| `"meta": { "reasoning": { "effort": "low" } }` | ~4–5 s | — | — |
| `"meta": { "reasoning": { "enabled": false } }` | ~2 s | ~$0.0001 | 0 |

- By default Crucible gives a test 30 s plus 1 s per extra run. A body that
  awaits three `coherent` calls one after another at ~11 s each runs out of
  time and the test reports `ERRORED` (runs discarded at the deadline). The
  budget can be raised with `testTimeout` (and the per-call
  limit with `inferenceTimeout`) — see
  [Timeout](runs-and-threshold.md#timeout).
- With reasoning disabled the judge is fast but unreliable on stateful claims:
  a 3-run gate failed 2 of 3 runs on the e2e room-booking scenario (now the
  `room-booking-*` conformance cases).
- The judge config `e2e/crucible.config.json` (the live smoke and the default
  for `make conformance`) uses `"reasoning": { "effort": "low" }`: correct
  verdicts, inside the deadline.
- Multi-step bodies that start every step's `coherent` call before awaiting
  any of them (each call judges the state as it stands when it is made) cost
  about one judge round trip per run instead of one per step.

## Where model behaviour is tested

Whether a judge model gets the verdicts and values right is checked only by
the conformance harness (`make conformance`, below), against the cases in
`e2e/ext/fixtures/coherent-conformance.json` and
`e2e/ext/fixtures/extract-conformance.json`. CI runs it when the schemas,
the cases, the harness, the judge config (`e2e/crucible.config.json`) or the
payload builder change, and weekly to catch provider or model drift; a
release needs a passing run (see [RELEASING.md](../RELEASING.md)). The payload and request goldens in `spec/`
prove that Crucible sends exactly what the harness sends, so the harness
result holds for the library.

The e2e suite does not test the model. `make e2e-offline` (no key; it runs
on every pull request) drives real Jest and Vitest processes against a local
stub judge on `127.0.0.1:28731` that answers from a script (a call it has no
reply for fails the test); if that port is taken, the run stops with an
error naming it; `make e2e` adds one live OpenRouter
smoke (`e2e/core/cjs-build.test.cts`: one `coherent` and one `extract` call)
that proves the real provider accepts the request and key.

## Using another provider or model

Every measurement on this page was made on OpenRouter with the models named
here. Judge quality is a property of the model, not of Crucible: a model that
returns prose instead of strict JSON, or that misreads state, makes runs
errored or verdicts wrong whichever provider serves it. Before relying on a
different model — on OpenRouter, on OpenAI, or behind an `openai-compatible`
endpoint — check it with the conformance harness, which sends the real
schemas and the conformance cases to your judge and reports, per case,
whether each reply was strict JSON and matched the expected verdict or value.

```sh
make conformance CONFORMANCE_CONFIG=path/to/your/crucible.config.json
```

- Needs Docker. The harness reads `provider`, `model`, `meta`, `baseUrl` and
  `apiKeyEnv` from the config you point it at (default:
  `e2e/crucible.config.json`, OpenRouter) and passes the key into the
  container by the variable's name: `CRUCIBLE_JUDGE_KEY`, or the variable
  `apiKeyEnv` names. Export it first. The harness reads plain JSON only: a
  config with comments or trailing commas (fine for Crucible itself, as in
  the `crucible.config.jsonc` that `init` writes) stops it with a usage error
  (exit 2), so point `CONFORMANCE_CONFIG` at a plain JSON copy.
  `openai-compatible` without `apiKeyEnv`
  runs keyless when `CRUCIBLE_JUDGE_KEY` is unset, and the harness warns when
  a key would go over plain `http://` to a non-loopback host.
- `CONFORMANCE_REPS` (default 3) repeats each case; `CONFORMANCE_SUITES`
  (`coherent`, `extract`, default both) picks the suites. It makes real,
  usually paid, judge calls: about `cases × reps` of them.
- The harness runs in a container, so `localhost` there is the container
  itself. For a model server on your machine, use
  `http://host.docker.internal:11434/v1` (Docker Desktop) as `baseUrl` in the
  config you pass to the harness.
- `usage: { include: true }` (OpenRouter's per-call cost report) is sent only
  to `openrouter`; other providers report cost as `$0`.

Treat anything short of every case matching on every rep as a reason to pick
another model, or to measure your gates with that in mind
([measure first](runs-and-threshold.md#1-measure-first-with-many-runs)).

Tested so far: `openai-compatible` against OpenRouter's compatible endpoint
(`https://openrouter.ai/api/v1`), run live while that provider was built
(the e2e suite now runs `openai-compatible` against a local stub). The `openai`
preset, Azure OpenAI, Ollama and LiteLLM have not been tested against the
live services.
