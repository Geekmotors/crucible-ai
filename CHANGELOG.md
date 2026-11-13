# Changelog

All notable changes to `crucible-ai` are listed here. The project follows
[Semantic Versioning](https://semver.org); before 1.0, a minor version may
contain breaking changes, and they are marked **Breaking** below.

## Unreleased

### Changed

- **Breaking:** a `crucible.it()` with no `runs`/`threshold` (and none in
  `testDefaults`) now runs its body 10 times and passes when at least 9 runs
  pass (`runs: 10`, `threshold: 0.9`); before, it ran once and had to pass.
  Each run calls your system under test and the judge, so an unconfigured
  test now costs 10 runs of your system and 10 judge calls per assertion, and
  its default test timeout is 39 s. The runs start together, so a test can
  have 10 judge calls in flight at once; mind your provider's rate limits.
  To keep the old behaviour, declare
  `{ runs: 1, threshold: 1 }` on the test, or set
  `"testDefaults": { "runs": 1, "threshold": 1 }` in `crucible.config.json`.
- **Breaking:** the built-ins also fill a field you leave out, on the test or
  in `testDefaults`. `{ runs: 20 }` without a `threshold` used to need 20 of
  20 runs to pass and now needs 18; `{ threshold: 1 }` without `runs` used to
  be 1 run and is now 10 runs that must all pass. Declare both fields to keep
  a gate as it was. With fewer than 10 runs, 0.9 still needs every run to
  pass (`{ runs: 5 }` needs 5 of 5).
- **Breaking (types only):** `crucible.it()` is typed as its four supported
  forms — `(name, body)`, `(name, body, timeout)`, `(name, options, body)`,
  `(name, options, body, timeout)` — so a call without a body, such as
  `crucible.it(name, options)`, is a compile error instead of a `usage` error
  at registration. A trailing timeout may be `undefined`. A wrapper that
  forwards a `RunOptions | TestBody` union no longer compiles; branch on the
  argument and call the matching form. JavaScript callers still get the
  runtime `usage` error.

### Added

- Editor hints: `RunOptions` fields, `crucible.it()`, `crucible.coherent()`,
  `crucible.extract()`, `crucible.load()` and `crucible.append()` carry
  documentation, including each option's default.
- `CHANGELOG.md` is included in the published package.

## 0.3.0

### Added

- `openai` provider: judge with OpenAI (`https://api.openai.com/v1`).
- `openai-compatible` provider: judge with any OpenAI-compatible endpoint
  (Azure OpenAI, a LiteLLM gateway, Ollama) through `baseUrl`.
- `apiKeyEnv` is accepted by every provider and names the environment variable
  that holds the judge key.
- A warning (once per test file) when a key is sent over plain `http://` to a
  host other than `localhost`, `127.x.x.x` or `[::1]`.

### Changed

- **Breaking:** the judge key is read from `CRUCIBLE_JUDGE_KEY` unless
  `apiKeyEnv` names another variable. `OPENROUTER_API_KEY` and
  `OPENAI_API_KEY` are no longer read. To migrate, rename the variable (and
  your CI secret) to `CRUCIBLE_JUDGE_KEY`, or set
  `"apiKeyEnv": "OPENROUTER_API_KEY"` in `crucible.config.json`.
- **Breaking:** an `openai-compatible` config without `apiKeyEnv` sends
  `CRUCIBLE_JUDGE_KEY` when it is set; before, it never sent a key.
- A judge key containing whitespace, control or non-ASCII characters inside it
  is a `config` error.
- Internal provider error classes were renamed (`ProviderHttpError`,
  `ProviderEnvelopeError`); they appear only in debug output and are not
  exported.

## 0.2.0

- `crucible.extract(text, description, { as })`: pull one typed value out of
  prose, or `null` when the text commits to none.
- `crucible.coherent()` parameters are `(actual, expectation)`.
- Repository moved to `Geekmotors/crucible-ai`.

## 0.1.0

- First release: `crucible.it`, `crucible.coherent`, `crucible.load`,
  `crucible.append`, the OpenRouter provider, timeouts and the failure report.
