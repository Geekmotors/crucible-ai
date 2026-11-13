# Configuration and OpenRouter reference

Crucible is configured by one committable file, `crucible.config.json`, plus
environment variables for anything secret or per-invocation.

- [Where and when the file is read](#where-and-when-the-file-is-read)
- [Fields](#fields)
- [Validation and errors](#validation-and-errors)
- [Environment variables](#environment-variables)
- [OpenRouter](#openrouter)
- [Choosing a judge model](#choosing-a-judge-model)
- [CI secrets](#ci-secrets)

## Where and when the file is read

- **Location:** `crucible.config.json` in the current working directory of
  the Jest process — the directory you run Jest from, normally your project
  root. It is not searched for in parent directories; in a monorepo, put it
  where you start Jest.
- **When:** the first time a `crucible.it()` test **executes** in a test file,
  never while Jest collects the file. It is then reused for the rest of that
  test file. Jest loads Crucible afresh for each test file, so each file reads
  it once.
- **Who needs it:** every `crucible.it()` test, even one that passes both
  `runs` and `threshold` or makes no `coherent()` call. A missing or invalid
  file fails each `crucible.it()` test that runs; plain Jest `it()` tests are
  unaffected.

## Fields

```json
{
  "provider": "openrouter",
  "model": "deepseek/deepseek-v4-flash-0731",
  "meta": { "reasoning": { "effort": "low" } },
  "verbosity": "default",
  "testDefaults": { "runs": 20, "threshold": 0.85 },
  "excerptChars": 500
}
```

| Field | Required | Type and valid values | Default | Meaning |
| --- | --- | --- | --- | --- |
| `provider` | yes | non-empty string; v1 accepts `"openrouter"` only | — | Which judge provider to call |
| `model` | yes | non-empty string (not only whitespace) | — | The provider's model id, passed through as given |
| `meta` | no | JSON object | none | Extra provider request parameters, passed through unmodified ([below](#meta)) |
| `verbosity` | no | `"default"`, `"full"` or `"debug"` (exact, lowercase) | `"default"` | Output detail ([Verbosity](runs-and-threshold.md#verbosity)) |
| `testDefaults` | no | object with optional `runs` (integer ≥ 1) and `threshold` (number in (0, 1]) | `{}` | Project-wide run options ([testDefaults](runs-and-threshold.md#project-wide-defaults-testdefaults)) |
| `excerptChars` | no | integer ≥ 1 | `500` | Length of the response excerpt in failure reports ([report](runs-and-threshold.md#reading-the-failure-report)) |

No other top-level field is accepted.

### `meta`

`meta` is copied into the body of every judge request. With the config above,
each request to OpenRouter is:

```json
{
  "reasoning": { "effort": "low" },
  "model": "deepseek/deepseek-v4-flash-0731",
  "messages": [{ "role": "system", "content": "…" }, { "role": "user", "content": "…" }]
}
```

- Use it for any [OpenRouter request parameter](https://openrouter.ai/docs/api-reference/parameters):
  `temperature`, `reasoning`, `provider` routing preferences, and so on.
  Crucible does not interpret it.
- `model` and `messages` are always set by Crucible; the same keys inside
  `meta` are overwritten.
- Crucible validates only that `meta` is an object. It never inspects its
  contents — **which means it cannot stop you committing a secret inside it.
  Never put an API key or token in `meta`.** The key-name check described
  below applies to top-level fields only.
- The `debug` trace prints `meta` key names only, never values.

## Validation and errors

Every config problem throws a `CrucibleError` (exported from `crucible-ai`).
Check `error.kind`, not the message text. Checks run in this order and stop at
the first problem:

| Problem | Kind |
| --- | --- |
| `crucible.config.json` missing, unreadable, not valid JSON, or not a JSON object | `config` |
| A top-level field named like a secret — `apiKey`, `api_key`, `key`, `token`, `secret`, `authorization` (any letter case) | `config` |
| Any other unknown top-level field | `config` |
| `provider` missing, empty, not a string, or not a supported provider | `config` |
| `model` missing, empty, whitespace only, or not a string | `config` |
| `meta` present but not an object (`null`, an array, a string…) | `config` |
| `verbosity` not one of the three levels — checked even when `CRUCIBLE_VERBOSE` is set | `config` |
| `CRUCIBLE_VERBOSE` set to anything other than the three levels (an empty value is ignored) | `usage` |
| `testDefaults` not an object, an unknown key in it, or an invalid `runs`/`threshold` | `config` |
| `excerptChars` not an integer ≥ 1 | `config` |
| `OPENROUTER_API_KEY` missing or blank when a judge call is made | `config` |
| `meta` not JSON-serializable (for example a `BigInt` value) when a judge call is made | `usage` |

A `config` or `usage` error stops the whole test at once — other in-flight
runs are cancelled — and is rethrown unchanged, so the test fails with the
message that names the fix. A UTF-8 byte-order mark at the start of the file
is tolerated.

## Environment variables

| Variable | Read by | Meaning |
| --- | --- | --- |
| `OPENROUTER_API_KEY` | the OpenRouter adapter, on every judge call | Your OpenRouter API key. Surrounding whitespace is trimmed. Required only for tests that call `coherent()`. |
| `CRUCIBLE_VERBOSE` | config load | Overrides `verbosity` for one invocation: `default`, `full` or `debug`. Matched exactly (case-sensitive, no trimming). Empty means "not set". |

Variables prefixed `CRUCIBLE_` are reserved for Crucible. API keys always use
the provider's own variable name.

## OpenRouter

Crucible calls OpenRouter's chat-completions endpoint
(`https://openrouter.ai/api/v1/chat/completions`) with your key as a bearer
token. The system message is the [instruction schema](instruction-schema.md);
the user message holds the state, response and claim.

How provider failures are handled, per judge call:

| Failure | Class | What Crucible does |
| --- | --- | --- |
| HTTP 408 or 429, any 5xx, a network error | retryable | Retries up to 3 attempts in total with exponential backoff (250–500 ms before the second attempt, 500–1000 ms before the third). If all fail, the run is **errored** — an infrastructure problem, never counted as a semantic failure. |
| Any other HTTP 4xx (for example 401 bad key, 402 no credit, 400/404 unknown model) | fatal | Stops the whole test at once: other runs' judge calls are cancelled and the test fails as `ERRORED, not failed:` with advice to fix the provider setup. The same mistake would hit every run, so Crucible stops spending. |
| A reply that is not valid `{ "verdict", "reasoning" }` JSON | non-fatal | Asks once more; a second bad reply makes the run errored. |
| A reply attempt (including its retries) running past 30 s | non-fatal | The run is errored; other runs carry on. This per-call limit sits inside the test deadline (30 s plus 1 s per extra run), which also stops the test. |

An error that OpenRouter embeds in a `200` response body with a numeric code
is treated as that HTTP status. All runs start together, so a test can have
up to `runs` judge calls in flight at once — mind your OpenRouter rate limits
for large gates.

## Choosing a judge model

The recommended default judge is `deepseek/deepseek-v4-flash-0731` with
`"meta": { "reasoning": { "effort": "low" } }`:

- It matched more expensive models on every case of the validation matrix at
  a fraction of the cost ([judge-models.md](judge-models.md),
  [raw runs](judge-validation-runs.md)). Cost dominates once multi-run gates
  multiply call volume.
- With default reasoning it takes ~11 s per call, which leaves little room in
  the test deadline (30 s plus 1 s per extra run) when a body awaits several
  judgments in sequence.
  Low effort brings it to ~4–5 s.
- Do **not** disable reasoning (`"enabled": false`): it is faster and cheaper
  but was unreliable on claims about state (a 3-run gate failed 2 of 3 runs).

This guidance is provisional. The validation matrix is small and
deliberately unambiguous, so it cannot yet tell models apart on hard cases.
Any OpenRouter model id works; if you switch, re-measure your gates
([measure first](runs-and-threshold.md#1-measure-first-with-many-runs)).

The judge can be wrong, as any model can. Crucible's stance on that is in
[gotchas](gotchas.md#the-judge-can-say-false-when-the-answer-is-true).

## CI secrets

- Store the key as a **repository secret** named `OPENROUTER_API_KEY`
  (GitHub: Settings → Secrets and variables → Actions → New repository
  secret). Never commit it, never put it in `crucible.config.json`.
- Expose it **only to the step that runs your inference tests**, through
  that step's `env`, not at workflow or job level.
- Keep pull-request lanes **provider-free**: run lint, type-check and
  deterministic unit tests on PRs, and run the inference tests on merge to
  your main branch (or another trusted trigger). Pull requests from forks get
  no secrets anyway, and `pull_request_target` would run untrusted code with
  your secrets — do not use it to work around that.
- Make a missing secret fail loudly instead of skipping the tests, so a red
  build never hides behind a silently skipped job.

This repository's own [`ci.yml`](../.github/workflows/ci.yml) follows that
pattern:

```yaml
jobs:
  inference-tests:
    if: github.event_name == 'push' && github.ref == 'refs/heads/main'
    runs-on: ubuntu-latest
    permissions:
      contents: read
    steps:
      - name: Require OPENROUTER_API_KEY secret
        env:
          OPENROUTER_API_KEY: ${{ secrets.OPENROUTER_API_KEY }}
        run: |
          if [ -z "$OPENROUTER_API_KEY" ]; then
            echo "::error::Add an OPENROUTER_API_KEY repository secret."
            exit 1
          fi
      - uses: actions/checkout@v4
        with:
          persist-credentials: false
      - uses: actions/setup-node@v4
        with:
          node-version: 24
          cache: npm
      - run: npm ci
      - name: Inference tests
        env:
          OPENROUTER_API_KEY: ${{ secrets.OPENROUTER_API_KEY }}
        run: npx jest --ci
```

Everything you `load`, `append` and judge is sent to OpenRouter and the model
provider it routes to — see [gotchas](gotchas.md#everything-you-judge-leaves-your-machine).
