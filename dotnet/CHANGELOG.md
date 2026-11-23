# Changelog

All notable changes to the .NET packages `Geekmotors.Crucible` and `Geekmotors.Crucible.Xunit` are listed here. Both
packages share one version and are released together; `Geekmotors.Crucible.Xunit` depends on exactly the same version
of `Geekmotors.Crucible`. The project follows [Semantic Versioning](https://semver.org); before 1.0, a minor version
may contain breaking changes, and they are marked **Breaking** below. The TypeScript package `crucible-ai` has its own
[changelog](https://github.com/Geekmotors/crucible-ai/blob/main/typescript/CHANGELOG.md).

## 0.2.0

### Added

- Every report (the `CrucibleVerdictException` message, and the passing report at `full` and `debug`) now ends with
  a judge stamp: the configured provider and model (`IChatClient`, with no model, for a judge set with
  `Crucible.UseJudge`), the model the provider says served the calls, how many judge responses the test received,
  their tokens and their cost (OpenRouter reports cost; other providers and `IChatClient` judges show
  `cost not reported`), the `Geekmotors.Crucible` version and a short SHA-256 of each judge instruction schema. For
  example:

  ```text
  Judge: openrouter "anthropic/claude-haiku-5.5"; served as "anthropic/claude-haiku-5.5", 1 response(s), 812 tokens, cost $0.000250
  Crucible: Geekmotors.Crucible 0.2.0; schemas coherent 2ecbb5d8, extract 1e09070c
  ```

  See [Reading the failure report](https://github.com/Geekmotors/crucible-ai/blob/main/docs/runs-and-threshold.md#reading-the-failure-report).

## 0.1.0

First release of the C# port, for `net8.0` and `net10.0`. Every type lives in the `CrucibleAI` namespace. It passes the
shared `spec/` at the tag `dotnet-v0.1.0` (37 case ids skipped, each input a C# caller cannot express; the list is in
the repository).

### Added

- `Geekmotors.Crucible`, the engine:
  - `Crucible.Facts`, `Crucible.CoherentAsync`, `Crucible.ExtractAsync<T>` (`string`, `int?`, `long?`, `double?`,
    `bool?`, with lenient or strict mode) and `Crucible.Context`, resolved per run through the ambient run context.
    Facts and run state belong to one run of one test; a call outside a running Crucible test is a `usage` error.
  - `Crucible.Gate(options, body, cancellationToken)`: runs a body N times (concurrently by default, or
    sequentially) and gates on the pass rate, inside any test framework (NUnit, MSTest, xUnit). A failing gate throws
    `CrucibleVerdictException` with the failure report.
  - The judge: the config file's `openrouter`, `openai` or `openai-compatible` provider, or any
    `Microsoft.Extensions.AI` `IChatClient` through `Crucible.UseJudge`, with the same retry and reply rules. A judge
    client that caches responses gets a warning. A judge reply with a trailing comma before `}` or `]` is repaired
    instead of asked again.
  - `crucible.config.json` / `crucible.config.jsonc` with `testDefaults`, `verbosity`, `excerptChars`, `meta` and
    `apiKeyEnv`, the same fields as the TypeScript package; `CRUCIBLE_VERBOSE` overrides the verbosity.
  - `CrucibleException` with `Kind` (`Usage`, `Config`, `Infra`) and `Retryable`.
- `Geekmotors.Crucible.Xunit`, the xUnit v3 adapter:
  - `[CrucibleFact]` and `[CrucibleTheory]` run a test method N times, each run on its own test-class instance with
    its own facts, and report one xUnit result per test (per theory data row).
  - `[Crucible]` on a class or the assembly sets defaults; settings resolve method, class, assembly, config
    `testDefaults`, then the built-in defaults, one setting at a time.
  - An MSBuild `build/` targets file copies `crucible.config.json`/`.jsonc` from beside the test project to the output
    folder, so xUnit finds it without project-file edits.
- Packages carry SourceLink, symbols (`.snupkg`), the README and the MIT licence expression.
