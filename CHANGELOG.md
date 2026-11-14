# Changelog

All notable changes to `crucible` (published as `crucible-ai` up to 0.3.0) are listed here. The project follows
[Semantic Versioning](https://semver.org); before 1.0, a minor version may
contain breaking changes, and they are marked **Breaking** below.

## 0.5.0

The package is renamed from `crucible-ai` to `crucible`, and the repository moved to `Geekmotors/crucible` (GitHub redirects the old URLs). Install `crucible`, import from `'crucible'` (or `'crucible/vitest'`), and run `npx crucible init`. The CLI command is now `crucible`, and the `$schema` path in `crucible.config.jsonc` is `./node_modules/crucible/schemas/crucible.config.schema.json`. `crucible-ai` stays on npm at 0.3.0, deprecated. Versions 0.4.x are skipped because the `crucible` name was used for an unrelated package years ago and npm never reuses version numbers.

**Migration:** `npm uninstall crucible-ai && npm install --save-dev crucible`, then replace `'crucible-ai'` with `'crucible'` in imports and the `$schema` path.

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
- **Breaking:** `crucible.extract()` options other than `as`, `strict` and
  `facts` are a `usage` error, as they already are for `crucible.it()`,
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
- **Breaking:** `crucible.coherent()` validates a third argument: anything
  other than `undefined` or a plain options object with only `facts` is a
  `usage` error. Before, a third argument was ignored.
- `crucible.extract()` options must be a plain object: a class instance
  such as a `Map` or `Date`, or an object inheriting an option, is a `usage`
  error.
- **Breaking:** `crucible.it()`, `crucible.describe()` and their variants
  reject any defined argument after the last one as a `usage` error. Before,
  a fifth `crucible.it()` argument was ignored, as was a fourth
  `crucible.describe()` argument after an `undefined` third.
- `usage` errors from a `crucible.describe` variant name the variant, such
  as `crucible.describe.only.each options`.
- The failure report shows, under each judged call, the facts it was judged
  against as a `Facts:` field (bounded by `excerptChars`), for anyone
  parsing reports.

### Added

- Editor hints: `RunOptions` fields, `crucible.it()`, `crucible.coherent()`,
  `crucible.extract()`, `crucible.load()` and `crucible.append()` carry
  documentation, including each option's default.
- `CHANGELOG.md` is included in the published package.
- `npx crucible init` writes `crucible.config.jsonc` with the provider,
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
- `crucible.facts(fact)` adds one fact or an array of facts to the current
  run, exactly as `crucible.load()` and `crucible.append()` do: append-only,
  per run (never shared between runs or tests), read when an assertion is
  called, and a `usage` error outside a running `crucible.it()` body. Facts
  still travel to the judge as the `STATE` section; the instruction schemas
  are unchanged.
- Per-call facts: `crucible.coherent(actual, expectation, { facts })` and
  `crucible.extract(text, description, { as, strict, facts })` send facts
  with that call only, after the run's facts. They are not added to the run,
  so later calls do not see them. `facts` must be a string or an array of
  strings, else a `usage` error. The `CoherentOptions` type is exported.
- `crucible.gate(body)` and `crucible.gate(options, body)` return a test
  function for your runner's own `it` or `test`, every variant included
  (`it.only`, `it.skip`, `it.each`):
  `it(name, crucible.gate({ runs: 5 }, async (t, ...row) => { ... }), 60000)`.
  The gate runs the body `runs` times concurrently, gates on `threshold`
  and throws the same verdict errors and report as `crucible.it()`; runner
  arguments (such as `it.each` row values) follow `t`. Options resolve as for
  `crucible.it()` (built-in, `testDefaults`, enclosing `crucible.describe`,
  the gate's own) and are validated when `crucible.gate()` is called. The
  gate enforces its own test deadline but cannot set the runner's timeout:
  pass the runner one at least as large.
- A run context `t` for every run: `crucible.it()` and `crucible.gate()`
  bodies receive it as their first argument (`async (t) => ...`), with
  `t.facts()`, `t.coherent()` and `t.extract()` behaving like the
  `crucible.*` functions, bound to that run. `t` and the global functions
  share one run state; `t` keeps working from callbacks that lost the async
  context and is a `usage` error after its run ends. Bodies without
  parameters keep working. New exported types: `RunContext`, `GateBody`,
  `GatedTest`; `TestBody` is now `(t: RunContext) => unknown`, so code that
  calls a `TestBody` itself must pass it a run context.
- Runner variants on `crucible.it` and `crucible.describe`:
  `crucible.it.only`, `.skip`, `.todo`, `.each`, `.only.each` and
  `.skip.each`; `crucible.describe.only`, `.skip`, `.each`, `.only.each` and
  `.skip.each`. Each variant takes the same forms, options and trailing
  timeout as `crucible.it()` / `crucible.describe()` and forwards to Jest's
  own variant: `crucible.it.each(table)(name, options, async (t, ...row) =>
  { ... })` registers one gated test per row with Jest's name formatting, and
  `crucible.describe.each(table)(name, options, (...row) => { ... })` one
  group per row whose tests inherit the options. `it.failing` and
  `it.concurrent` are not supported and are a `usage` error, as is any other
  Jest variant Crucible does not wrap or a variant in the wrong place
  (`crucible.it.each.only`); any other property, such as `then`, is
  `undefined`. New exported types: `CrucibleIt`, `CrucibleDescribe`.
- Vitest support: `import { crucible } from 'crucible/vitest'` gives the
  same API on Vitest 5, without Vitest's `globals` option. `crucible.it`
  adds Vitest's `for`, `skipIf` and `runIf` (and `only.for`, `skip.for`);
  `crucible.describe` adds `todo`, `for`, `skipIf` and `runIf`. Bodies
  receive `t` only (Vitest's test context is dropped); `crucible.it.for`
  bodies receive `(t, row)`. `fails`, `concurrent`, and
  `describe.concurrent`, `.shuffle` and `.sequential` are a `usage` error.
  Group settings reach tests inside nested groups and plain Vitest
  `describe` blocks, although Vitest collects group callbacks later; group
  callbacks must stay synchronous, as on Jest. Crucible tests and groups
  opt out of Vitest's inherited `concurrent` and `shuffle`, so a plain
  `describe.concurrent` or `sequence.concurrent` around them never overlaps
  their deadlines; a Vitest whose suite chain Crucible cannot read fails
  each `crucible.describe` with a `usage` error instead of dropping its
  settings. `skipIf` and `runIf` return a plain registrar (no `.each` or
  `.for` after them). On a plain Vitest `test`, a
  `crucible.gate()` body receives `(t, context)`. The root entry is
  unchanged and stays the Jest one.
- `jest` is now an optional peer dependency, next to the new optional
  `vitest` peer (`^5.1.0`): install the runner you use. Nothing changes for
  Jest users.

### Deprecated

- `crucible.load()` and `crucible.append()` are deprecated aliases of
  `crucible.facts()`, with identical behaviour and no runtime warning; your
  editor marks them. They are planned for removal in 1.0.

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
- Repository moved to `Geekmotors/crucible`.

## 0.1.0

- First release: `crucible.it`, `crucible.coherent`, `crucible.load`,
  `crucible.append`, the OpenRouter provider, timeouts and the failure report.
