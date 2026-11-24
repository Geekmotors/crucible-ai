# Contributing to Crucible

Thanks for helping. Crucible is a semantic assertion library for code that calls LLMs, with a TypeScript package
(`crucible-ai` on npm) and a C# port (`Geekmotors.Crucible` and `Geekmotors.Crucible.Xunit` on NuGet). Both follow one
language-neutral spec in [`spec/`](spec/README.md).

## Before you start

- **Bug fixes and docs:** open a pull request directly.
- **New features or behaviour changes:** open an issue first so we can agree on the shape before you write code.
- **Scope:** Crucible is an assertion library that runs inside your existing test framework. It does not run suites,
  store datasets or host results, so changes in that direction are unlikely to be accepted.

## Repository layout

| Path | What it holds |
| --- | --- |
| `typescript/` | the npm package `crucible-ai` |
| `dotnet/` | the NuGet packages `Geekmotors.Crucible` and `Geekmotors.Crucible.Xunit` |
| `spec/` | language-neutral fixtures every port runs; [`spec/PORTING.md`](spec/PORTING.md) is the port checklist |
| `schemas/` | the judge instruction schemas and the config JSON Schema, shared by every port |
| `conformance/` | the judge conformance harness (POSIX shell, `jq`, Docker) |
| `docs/` | shared documentation; language API references under `docs/<language>/` |

## Setup

- **TypeScript:** Node.js 22 or later. `cd typescript && npm ci`.
- **C#:** the .NET 10 SDK (see `dotnet/global.json`) and the .NET 8 runtime.
- **Conformance (optional):** Docker and `jq`.

## Checks to run before you open a pull request

TypeScript, from `typescript/`:

```sh
npm run typecheck
npm run lint
npm run format:check
npm test
npm run build
npm run verify:pack
npx tsc --noEmit -p e2e
```

C#, from the repository root:

```sh
make dotnet-build
make dotnet-test
make dotnet-format
make dotnet-pack-check
```

Shared, from the repository root:

```sh
make e2e-offline          # end-to-end tests against a local stub judge, no key needed
make spec-goldens-check   # spec goldens are current
```

CI runs the same checks on every pull request. You don't need an API key for any of them.

The live checks (`make e2e`, `make dotnet-live`, `make conformance`) call a real judge, need `CRUCIBLE_JUDGE_KEY` and
cost money. They are optional for contributors; maintainers run them on `main` and before each release.

## Tests are required

Every change to behaviour comes with tests, in both languages it affects. A pull request without tests for its
behaviour will not be merged.

- **Test behaviour, not implementation.** Assert what a user of the module can observe: return values, error kinds,
  report text. Don't assert on private shape, call counts, captured requests or error message wording.
- **Fake only the boundaries:** network, filesystem, clock, environment and provider APIs. Use real collaborators
  everywhere else, and never touch real process state (environment variables, the working directory, real files) in a
  unit test.
- **TypeScript test layout:**
  - Tests sit next to the code they test (`config.test.ts` beside `config.ts`); never in `__tests__` folders.
  - Fakes live one per file in the area's `test/` folder with a `.fake.ts` suffix, and helpers in `<name>-harness.util.ts`
    classes.
  - Repeated literals go into enums or named constants rather than magic values.
- **C# tests** live under `dotnet/tests/`; follow the structure already there.

## Behaviour that crosses languages

Anything the two ports must agree on is specified in `spec/` first:

1. Add or change the fixtures in `spec/` (and update [`spec/README.md`](spec/README.md) for new rules).
2. Make both ports pass them. If a change applies to only one language, say why in the pull request.
3. Run `make spec-goldens-check`.

## Code style

TypeScript:

- `type` over `interface`; named exports only, grouped at the end of the file; no default exports.
- One class per file, the file named after the class in kebab-case. Pure utility or formatter classes use the
  `.util.ts` suffix.
- Internals are classes with injected collaborators, not module-level state or free-function modules.
- The public surface lives in `typescript/src/api/`; the entry point re-exports only from there.
- No code comments: if code needs one, improve the naming or structure instead.

C#: `make dotnet-format` must leave no changes, the build runs with warnings as errors, and new code should follow the
patterns around it.

## Docs and changelogs

- Update the docs a change affects: [`docs/`](docs/README.md), the API references and the READMEs.
- Add a line under `## Unreleased` in [`typescript/CHANGELOG.md`](typescript/CHANGELOG.md) and/or
  [`dotnet/CHANGELOG.md`](dotnet/CHANGELOG.md) for anything a user would notice.

## Secrets

Never commit an API key, and never put one in a config file, a fixture or a test. Pull requests from forks get no
repository secrets, and the jobs that call a real judge run only on `main`.

## Pull requests

- Keep one purpose per pull request.
- CI must pass, and every pull request needs a maintainer's approval before it merges.
- By contributing, you agree that your contribution is licensed under the [MIT License](LICENSE).
