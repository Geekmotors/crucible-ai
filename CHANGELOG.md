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
  `"testDefaults": { "runs": 1, "threshold": 1 }` in the config file.
- **Breaking:** the built-ins also fill a field you leave out, on the test or
  in `testDefaults`. `{ runs: 20 }` without a `threshold` used to need 20 of
  20 runs to pass and now needs 18; `{ threshold: 1 }` without `runs` used to
  be 1 run and is now 10 runs that must all pass. Declare both fields to keep
  a gate as it was. With fewer than 10 runs, 0.9 still needs every run to
  pass (`{ runs: 5 }` needs 5 of 5).
- **Breaking:** a `crucible.config.jsonc` next to `crucible.config.json`,
  previously ignored, is now read too, so having both fails every
  `crucible.it()` with a `config` error. Keep one of them.
- **Breaking (types only):** `crucible.it()` is typed as its four supported
  forms — `(name, body)`, `(name, body, timeout)`, `(name, options, body)`,
  `(name, options, body, timeout)` — so a call without a body, such as
  `crucible.it(name, options)`, is a compile error instead of a `usage` error
  at registration. A trailing timeout may be `undefined`. A wrapper that
  forwards a `RunOptions | TestBody` union no longer compiles; branch on the
  argument and call the matching form. JavaScript callers still get the
  runtime `usage` error.
- **Breaking:** `crucible.extract()` is now lenient by default: a colloquial
  or mildly hedged answer resolves to the value it leans to ("I think so" →
  `true`, "nah" → `false`, "probably two" → `2`, "likely Paris" →
  `"Paris"`). `null` remains for no answer, a genuine split ("two or
  three"), a bare negation ("it's not two") and "I don't know". Before, any
  hedge was `null`. To keep the old behaviour, pass `strict: true` on the
  call, the test or a `crucible.describe` group, or set
  `"testDefaults": { "strict": true }` in the config file.
- **Breaking:** `crucible.extract()` options other than `as` and `strict`
  are a `usage` error, as they already are for `crucible.it()`,
  `crucible.describe()` and `testDefaults`; before, a misspelt key such as
  `{ strcit: true }` was silently ignored.
- Failure report and trace lines for an extraction name its mode, for
  anyone parsing reports: `Extraction 1 of 2 (lenient): …` (was
  `Extraction 1 of 2: …`), `Judge call 1 of 1: extract (strict) "…"` at
  `full`, and `judge value 2 for extract "…" as number (lenient)` in the
  `debug` trace.
- The extract schema (`schemas/extract.md`) defines both modes and takes a
  new `MODE` section (`lenient` or `strict`) after `TYPE`; another
  implementation assembling extract payloads must send it.

### Added

- Editor hints: `RunOptions` fields, `crucible.it()`, `crucible.coherent()`,
  `crucible.extract()`, `crucible.load()` and `crucible.append()` carry
  documentation, including each option's default.
- `CHANGELOG.md` is included in the published package.
- `npx crucible-ai init` writes `crucible.config.jsonc` with the provider,
  the recommended judge model, an OpenRouter low-reasoning `meta` setting
  that speeds it up, and every other setting as a commented line showing its
  default. It never overwrites: with `crucible.config.json` or
  `crucible.config.jsonc` already present it changes nothing and exits
  non-zero.
- The config can be named `crucible.config.json` or `crucible.config.jsonc`;
  both accept `//` and `/* */` comments and trailing commas. Having both is a
  `config` error. A syntax error names the line where it can and no longer
  quotes the file's content.
- A JSON Schema for the config ships at
  `schemas/crucible.config.schema.json`, describing every field with its
  default; set `"$schema"` to it for editor autocomplete and hover docs.
  Crucible ignores `"$schema"`.
- `crucible.describe(name, fn)` and `crucible.describe(name, options, fn)`
  register a Jest `describe` block whose run options (`runs`, `threshold`,
  `inferenceTimeout`, `testTimeout`, `strict`) every `crucible.it()` inside
  inherits,
  at any depth. Each field resolves on its own, last wins: built-in default,
  `testDefaults`, outer group, inner group, the test's own options. Without
  a `testTimeout` at any level, the test timeout follows the resolved
  `runs`. Invalid options, a missing callback, a surplus argument or a
  callback that returns a value (an async one included) are a `usage` error
  at collection. Tests outside a group are unchanged.
- `strict` (boolean, default `false`): a run option for `crucible.it()`,
  `crucible.describe()` and `testDefaults`, and an option of
  `crucible.extract()`. It resolves last wins — built-in, `testDefaults`,
  outer group, inner group, the test, then the `extract()` call — and
  applies to every assertion that supports it (today `extract()`). A value
  that is not a boolean is a `usage` error (a `config` error in
  `testDefaults`). The config JSON Schema and the `init` template list it.

### Fixed

- A config file that does not exist no longer stops config loading when the
  operating system refuses the lookup instead of reporting it missing
  (`EPERM`/`EACCES` in some sandboxes, or `ENOTDIR`): it is treated as absent,
  so a lone `crucible.config.json` or `crucible.config.jsonc` loads. A file
  that exists but cannot be read is still a `config` error naming that file
  and the cause.

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
