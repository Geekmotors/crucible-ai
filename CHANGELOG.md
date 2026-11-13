# Changelog

All notable changes to `crucible-ai` are listed here. The project follows
[Semantic Versioning](https://semver.org); before 1.0, a minor version may
contain breaking changes, and they are marked **Breaking** below.

## Unreleased (0.3.0)

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
