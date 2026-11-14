# Configuration and provider reference

Crucible is configured by one committable file, `crucible.config.json` or
`crucible.config.jsonc`, plus environment variables for anything secret or
per-invocation.

- [Create it with `init`](#create-it-with-init)
- [Where and when the file is read](#where-and-when-the-file-is-read)
- [Comments and editor hints](#comments-and-editor-hints)
- [Fields](#fields)
- [Validation and errors](#validation-and-errors)
- [Environment variables](#environment-variables)
- [Providers](#providers)
- [Provider failures](#provider-failures)
- [Choosing a judge model](#choosing-a-judge-model)
- [CI secrets](#ci-secrets)

## Create it with `init`

```sh
npx crucible-ai init
```

writes `crucible.config.jsonc` in the current directory:

```jsonc
{
  "$schema": "./node_modules/crucible-ai/schemas/crucible.config.schema.json",

  // Judge provider: "openrouter", "openai" or "openai-compatible" (the last also needs
  // a "baseUrl", e.g. "http://localhost:11434/v1"). The API key comes from the environment.
  "provider": "openrouter",
  "model": "deepseek/deepseek-v4-flash-0731",
  // OpenRouter reasoning setting that speeds up the model above; extra request fields
  // go to the provider as-is, so remove or change this when you switch provider.
  "meta": { "reasoning": { "effort": "low" } },

  // Every line below shows a default. Uncomment a line to change it.
  // "apiKeyEnv": "CRUCIBLE_JUDGE_KEY", // the variable holding the key, never the key
  // "verbosity": "default", // "default", "full" or "debug"
  // "excerptChars": 500, // response excerpt length in failure reports
  // "testDefaults": {
  //   "runs": 10,
  //   "threshold": 0.9, // at least 9 of 10 runs must pass
  //   "inferenceTimeout": 30000, // ms per judge request
  //   testTimeout defaults to 30000 + 1000 per run after the first; set "testTimeout": <ms> to fix it
  //   "strict": false, // true: extract() treats any hedge ("probably two") as null
  // },
}
```

- `meta` is the one active setting beyond the judge: an OpenRouter
  reasoning setting for the recommended model
  ([why](judge-models.md#reasoning-effort-and-the-per-test-deadline-story-33-e2e)).
  Remove or change it when you switch provider ([`meta`](#meta)).
- Uncomment a line to change that setting; a commented line changes nothing.
  Uncomment `"testDefaults": {`, the fields you want and the closing `},`
  together.
- `testTimeout` has no setting line because its default is a formula, not
  a value: it grows with `runs`. Adding `"testTimeout": <ms>` fixes it at
  that value, and it no longer grows with `runs`.
- `init` never overwrites. If `crucible.config.json` or
  `crucible.config.jsonc` already exists, it writes nothing, says which file
  is in the way and exits with code 1. An unknown command prints usage and
  exits with code 2; `npx crucible-ai --help` prints usage and exits with 0.
- Run it from the directory you start Jest from.

## Where and when the file is read

- **Location:** `crucible.config.json` or `crucible.config.jsonc` in the
  current working directory of the Jest process — the directory you run Jest
  from, normally your project root. It is not searched for in parent
  directories; in a monorepo, put it where you start Jest. Keep exactly one:
  with both present, every `crucible.it()` test fails with a `config` error.
- **When:** the first time a `crucible.it()` test **executes** in a test file,
  never while Jest collects the file. It is then reused for the rest of that
  test file. Jest loads Crucible afresh for each test file, so each file reads
  it once.
- **Who needs it:** every `crucible.it()` test, even one that passes every
  option or makes no `coherent()` or `extract()` call. A missing or invalid
  file fails each `crucible.it()` test that runs; plain Jest `it()` tests are
  unaffected.

## Comments and editor hints

Both file names are read the same way, as JSON with comments: `//` line
comments, `/* */` block comments and trailing commas are allowed. Comment
markers inside strings are ordinary text, so `"baseUrl": "http://…"` is safe.
A UTF-8 byte-order mark is tolerated.

The package ships a JSON Schema,
`node_modules/crucible-ai/schemas/crucible.config.schema.json`. Point the
config at it with `"$schema"` (as `init` does) and VS Code, and other editors
that read JSON Schema, show each field's description and default on hover,
autocomplete field names and values, and flag invalid values as you type.
Crucible itself ignores `"$schema"`; validation is the runtime checks below.
The schema tells VS Code that comments and trailing commas are allowed, so
it does not underline them in either file name.

The `"$schema"` path that `init` writes is relative to the config file and
assumes `crucible-ai` is installed in the `node_modules` next to it. In a
workspace (monorepo) where the package is hoisted to the root
`node_modules`, change the path to point there (for example
`"../../node_modules/crucible-ai/schemas/crucible.config.schema.json"`);
a wrong path only loses the editor hints.

## Fields

```json
{
  "provider": "openrouter",
  "model": "deepseek/deepseek-v4-flash-0731",
  "meta": { "reasoning": { "effort": "low" } },
  "verbosity": "default",
  "testDefaults": { "runs": 20, "threshold": 0.85, "testTimeout": 90000 },
  "excerptChars": 500
}
```

| Field | Required | Type and valid values | Default | Meaning |
| --- | --- | --- | --- | --- |
| `$schema` | no | string | — | Path or URL of the JSON Schema, for editor hints; ignored by Crucible |
| `provider` | yes | `"openrouter"`, `"openai"` or `"openai-compatible"` | — | Which judge provider to call ([Providers](#providers)) |
| `model` | yes | non-empty string (not only whitespace) | — | The provider's model id, passed through as given |
| `baseUrl` | with `openai-compatible` only | http or https URL, no credentials, query or fragment | — | The endpoint's API root; judge calls go to `<baseUrl>/chat/completions` (a trailing `/` is dropped) |
| `apiKeyEnv` | no; every provider | environment variable **name**: letters, digits and `_`, not starting with a digit | `CRUCIBLE_JUDGE_KEY` | The variable that holds the judge's API key ([Judge key](#judge-key)) |
| `meta` | no | JSON object | none | Extra provider request parameters, passed through unmodified ([below](#meta)) |
| `verbosity` | no | `"default"`, `"full"` or `"debug"` (exact, lowercase) | `"default"` | Output detail ([Verbosity](runs-and-threshold.md#verbosity)) |
| `testDefaults` | no | object with optional `runs` (integer ≥ 1), `threshold` (number in (0, 1]), `inferenceTimeout` and `testTimeout` (integer ms, 1 to 2147483647), and `strict` (`true` or `false`) | `{}` (built-ins: `runs` 10, `threshold` 0.9, `strict` false) | Project-wide run options ([testDefaults](runs-and-threshold.md#project-wide-defaults-testdefaults)); a [`crucible.describe`](runs-and-threshold.md#group-settings-crucibledescribe) group or the test itself overrides them per field. With the built-ins, every test runs your system 10 times and makes 10 judge calls per assertion; `{ "runs": 1, "threshold": 1 }` makes every test a single run that must pass; `"strict": true` makes every `crucible.extract()` treat a hedged reply as `null` ([extract](api.md#crucibleextract)) |
| `excerptChars` | no | integer ≥ 1 | `500` | Length of the response excerpt in failure reports ([report](runs-and-threshold.md#reading-the-failure-report)) |

No other top-level field is accepted.

### `meta`

`meta` is copied into the body of every judge request, for every provider.
With the config above, each request to OpenRouter is:

```json
{
  "reasoning": { "effort": "low" },
  "model": "deepseek/deepseek-v4-flash-0731",
  "messages": [{ "role": "system", "content": "…" }, { "role": "user", "content": "…" }]
}
```

- Use it for any request parameter your provider accepts: for OpenRouter,
  any [OpenRouter request parameter](https://openrouter.ai/docs/api-reference/parameters)
  (`temperature`, `reasoning`, `provider` routing preferences, and so on); for
  OpenAI and most compatible endpoints, chat-completions parameters such as
  `temperature` or `reasoning_effort`. Crucible does not interpret it, so a
  parameter one provider understands may be rejected by another — change
  `meta` when you change `provider`.
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
| No config file, both `crucible.config.json` and `crucible.config.jsonc` present, a file unreadable, not valid JSON (comments and trailing commas are allowed), or not a JSON object. A syntax error names the line where it can, and never quotes the file's content | `config` |
| A top-level field named like a secret — `apiKey`, `api_key`, `key`, `token`, `secret`, `authorization` (any letter case) | `config` |
| Any other unknown top-level field | `config` |
| `provider` missing, empty, or not a string | `config` |
| `baseUrl` not a string, not a parseable URL, not http/https, or carrying credentials (`user:pass@`), a query (`?`) or a fragment (`#`) | `config` |
| `apiKeyEnv` not a string or not a valid environment variable name (a key value such as `sk-…` fails this check) | `config` |
| `provider` not a supported provider | `config` |
| `baseUrl` set for a provider that does not take it (`openrouter`, `openai`), or missing for `openai-compatible` | `config` |
| `model` missing, empty, whitespace only, or not a string | `config` |
| `meta` present but not an object (`null`, an array, a string…) | `config` |
| `verbosity` not one of the three levels — checked even when `CRUCIBLE_VERBOSE` is set | `config` |
| `CRUCIBLE_VERBOSE` set to anything other than the three levels (an empty value is ignored) | `usage` |
| `testDefaults` not an object, an unknown key in it, or an invalid `runs`/`threshold`/`inferenceTimeout`/`testTimeout`/`strict` | `config` |
| `excerptChars` not an integer ≥ 1 | `config` |
| The key variable (`CRUCIBLE_JUDGE_KEY`, or the one `apiKeyEnv` names) missing or blank when a judge call is made — always for `openrouter` and `openai`; for `openai-compatible` only when `apiKeyEnv` is set | `config` |
| The key variable holding a character no API key carries (inner whitespace, a control character, non-ASCII) when a judge call is made; the value is never echoed | `config` |
| `meta` not JSON-serializable (for example a `BigInt` value) when a judge call is made | `usage` |

A `config` or `usage` error stops the whole test at once — other in-flight
runs are cancelled — and is rethrown unchanged, so the test fails with the
message that names the fix. A UTF-8 byte-order mark at the start of the file
is tolerated.

## Environment variables

| Variable | Read by | Meaning |
| --- | --- | --- |
| `CRUCIBLE_JUDGE_KEY` | every provider, on every judge call, unless `apiKeyEnv` names another variable | The judge provider's API key. Optional for `openai-compatible`. |
| the variable `apiKeyEnv` names | every provider, on every judge call, in place of `CRUCIBLE_JUDGE_KEY` | The judge provider's API key. |
| `CRUCIBLE_VERBOSE` | config load | Overrides `verbosity` for one invocation: `default`, `full` or `debug`. Matched exactly (case-sensitive, no trimming). Empty means "not set". |

Key values have surrounding whitespace trimmed, and are needed only by tests
that call `coherent()` or `extract()`. Variables prefixed `CRUCIBLE_` are
reserved for Crucible. API keys always come from the environment, never from
the config file.

### Judge key

Every provider reads its key from `CRUCIBLE_JUDGE_KEY`, whichever provider you
pick, so switching provider means changing the config and the key's value, not
its name. To read it from a variable you already have — a vault export, a CI
secret, a company-wide `OPENAI_API_KEY` — name that variable in `apiKeyEnv`:

```json
{
  "provider": "openai",
  "apiKeyEnv": "OPENAI_API_KEY",
  "model": "gpt-5-mini"
}
```

- `openrouter` and `openai` always need a key: an unset or blank variable is a
  `config` error at the judge call, naming the variable.
- `openai-compatible` sends a key only when it has one. Without `apiKeyEnv`, an
  unset or blank `CRUCIBLE_JUDGE_KEY` means no `Authorization` header (local
  servers such as Ollama). With `apiKeyEnv`, the named variable is required,
  as for the other providers.
- `apiKeyEnv` holds a variable **name**. Crucible rejects anything that is not
  a valid name, so a pasted key with a `-` or other punctuation (`sk-…`) is
  refused instead of committed, and never repeated in the error. A key made
  only of letters, digits and underscores looks like a name and cannot be told
  apart, so check what you put there.

In 0.2 and earlier, `openrouter` read `OPENROUTER_API_KEY` and `openai` read
`OPENAI_API_KEY`. Those variables are no longer read: rename your variable to
`CRUCIBLE_JUDGE_KEY`, or keep it and set `"apiKeyEnv"` to its name.

## Providers

Every provider speaks the OpenAI chat-completions protocol: Crucible sends one
`POST` per judge call with `model`, your `meta` and two messages — the
system message is the [instruction schema](instruction-schema.md), the user
message holds the state, response and claim — and reads
`choices[0].message.content`. The key, when there is one, goes in an
`Authorization: Bearer` header. Retries, timeouts, cancellation, verdicts and
reports are the same whichever provider you pick, and Crucible adds no
provider-specific fields of its own to the request.

| `provider` | Endpoint | Key |
| --- | --- | --- |
| `openrouter` | `https://openrouter.ai/api/v1/chat/completions` | `CRUCIBLE_JUDGE_KEY` or `apiKeyEnv`, required |
| `openai` | `https://api.openai.com/v1/chat/completions` | `CRUCIBLE_JUDGE_KEY` or `apiKeyEnv`, required |
| `openai-compatible` | `<baseUrl>/chat/completions` | `CRUCIBLE_JUDGE_KEY` if set; the `apiKeyEnv` variable, required, when given |

### `openrouter`

One key gives you every model OpenRouter routes to. `model` is an OpenRouter
model id such as `deepseek/deepseek-v4-flash-0731`. This is the provider
Crucible's own tests, judge measurements and CI run on.

### `openai`

```json
{
  "provider": "openai",
  "model": "gpt-5-mini"
}
```

```sh
export CRUCIBLE_JUDGE_KEY=...   # your OpenAI key
```

`model` is an OpenAI model id. Calls go to OpenAI's chat completions API.

### `openai-compatible`

For any server that implements `POST /chat/completions` the way OpenAI does:
Azure OpenAI, a LiteLLM or other gateway, a company proxy, or a local model
server. `baseUrl` is the API root the server documents — the part before
`/chat/completions`, usually ending in `/v1`.

- Without `apiKeyEnv`, Crucible sends `CRUCIBLE_JUDGE_KEY` as a bearer token
  when it is set, and no `Authorization` header when it is unset or blank —
  for local servers that need no key.
- With `apiKeyEnv`, Crucible reads the key from that variable on every judge
  call. A named variable that is unset or blank is a `config` error at the
  judge call, as for the built-in providers.
- A key sent over plain `http://` to a host other than this machine
  (`localhost`, `127.x.x.x`, `[::1]`) travels unencrypted. Crucible still
  makes the call but prints one warning per test file to stderr (Jest loads
  Crucible afresh for each file); the warning names the variable and the
  URL, never the key. Use `https`, or — without `apiKeyEnv` — leave
  `CRUCIBLE_JUDGE_KEY` unset for a local server that needs none.
- Without `apiKeyEnv`, a set `CRUCIBLE_JUDGE_KEY` goes to whatever `baseUrl`
  names, https included. If that variable holds your OpenRouter or OpenAI
  key, unset it (or point `apiKeyEnv` at the gateway's own key) before
  judging against a third-party endpoint.

**Azure OpenAI** (the v1 API only; `model` is your **deployment name**). The
older API that needs `?api-version=…` is not supported, because `baseUrl`
takes no query string:

```json
{
  "provider": "openai-compatible",
  "baseUrl": "https://<resource>.openai.azure.com/openai/v1",
  "apiKeyEnv": "AZURE_OPENAI_API_KEY",
  "model": "<deployment-name>"
}
```

**Ollama** on your machine (no key):

```json
{
  "provider": "openai-compatible",
  "baseUrl": "http://localhost:11434/v1",
  "model": "qwen3:8b"
}
```

LM Studio works the same way at `http://localhost:1234/v1`.

**LiteLLM proxy** (`model` is a model name your proxy config defines):

```json
{
  "provider": "openai-compatible",
  "baseUrl": "https://litellm.internal.example.com/v1",
  "apiKeyEnv": "LITELLM_API_KEY",
  "model": "judge"
}
```

**OpenRouter through its OpenAI-compatible endpoint** — equivalent to
`"provider": "openrouter"`, and how Crucible's own e2e suite exercises this
provider:

```json
{
  "provider": "openai-compatible",
  "baseUrl": "https://openrouter.ai/api/v1",
  "model": "deepseek/deepseek-v4-flash-0731"
}
```

What is tested: the OpenRouter compatible endpoint above is the only
`openai-compatible` endpoint Crucible's e2e suite runs against a live service.
The `openai` preset and the Azure OpenAI, Ollama, LM Studio and LiteLLM
examples follow those services' published OpenAI-compatible APIs but have
**not** been run against them. Whatever you
point Crucible at, check the judge on it with the conformance harness first
([judge models](judge-models.md#using-another-provider-or-model)).

## Provider failures

How provider failures are handled, per judge call, for every provider:

| Failure | Class | What Crucible does |
| --- | --- | --- |
| HTTP 408 or 429, any 5xx, a network error | retryable | Retries up to 3 attempts in total with exponential backoff (250–500 ms before the second attempt, 500–1000 ms before the third). If all fail, the run is **errored** — an infrastructure problem, never counted as a semantic failure. |
| Any other HTTP 4xx (for example 401 bad key, 402 no credit, 400/404 unknown model) | fatal | Stops the whole test at once: other runs' judge calls are cancelled and the test fails as `ERRORED, not failed:` with advice to fix the provider setup. The same mistake would hit every run, so Crucible stops spending. |
| A reply that is not valid `{ "verdict", "reasoning" }` JSON | non-fatal | Asks once more; a second bad reply makes the run errored. |
| A reply attempt (including its retries) running past the inference timeout (30 s unless `inferenceTimeout` is set) | non-fatal | The run is errored; other runs carry on. This per-call limit sits inside the test timeout (30 s plus 1 s per extra run, 39 s for the default 10 runs, unless `testTimeout` is set), which caps everything and also stops the test. |

An error embedded in a `200` response body (as OpenRouter does) with a
numeric code is treated as that HTTP status; without one, it is retryable,
like a reply with no completion text. All runs start together, so a test can
have up to `runs` judge calls in flight at once — mind your provider's rate
limits for large gates (a local server may also queue them one at a time;
raise `inferenceTimeout` if calls time out).

## Choosing a judge model

The recommended default judge is `deepseek/deepseek-v4-flash-0731` with
`"meta": { "reasoning": { "effort": "low" } }`:

- It matched more expensive models on every case of the validation matrix at
  a fraction of the cost ([judge-models.md](judge-models.md),
  [raw runs](judge-validation-runs.md)). Cost dominates once multi-run gates
  multiply call volume.
- With default reasoning it takes ~11 s per call, which leaves little room in
  the default test timeout (30 s plus 1 s per extra run; 39 s for the
  default 10 runs) when a body awaits
  several judgments in sequence; raise `testTimeout` (per test or in
  `testDefaults`) if your bodies need longer
  ([Timeout](runs-and-threshold.md#timeout)).
  Low effort brings it to ~4–5 s.
- Do **not** disable reasoning (`"enabled": false`): it is faster and cheaper
  but was unreliable on claims about state (a 3-run gate failed 2 of 3 runs).

This guidance is provisional. The validation matrix is small and
deliberately unambiguous, so it cannot yet tell models apart on hard cases.
Any model id your provider serves works, but judge quality varies by model:
before relying on a different model or provider, run the conformance harness
against it ([judge models](judge-models.md#using-another-provider-or-model)),
then re-measure your gates
([measure first](runs-and-threshold.md#1-measure-first-with-many-runs)).

The judge can be wrong, as any model can. Crucible's stance on that is in
[gotchas](gotchas.md#the-judge-can-say-false-when-the-answer-is-true).

## CI secrets

- Store the key as a **repository secret** — `CRUCIBLE_JUDGE_KEY` below
  (GitHub: Settings → Secrets and variables → Actions → New repository
  secret) — and expose it as the `CRUCIBLE_JUDGE_KEY` variable, or as the
  variable `apiKeyEnv` names. Never commit it, never put it in
  the config file.
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
      - name: Require CRUCIBLE_JUDGE_KEY secret
        env:
          CRUCIBLE_JUDGE_KEY: ${{ secrets.CRUCIBLE_JUDGE_KEY }}
        run: |
          if [ -z "$CRUCIBLE_JUDGE_KEY" ]; then
            echo "::error::Add a CRUCIBLE_JUDGE_KEY repository secret."
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
          CRUCIBLE_JUDGE_KEY: ${{ secrets.CRUCIBLE_JUDGE_KEY }}
        run: npx jest --ci
```

Everything you `load`, `append` and judge is sent to your judge provider (and,
for OpenRouter or a gateway, the model provider it routes to) — see [gotchas](gotchas.md#everything-you-judge-leaves-your-machine).
