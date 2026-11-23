# Crucible

[![npm](https://img.shields.io/npm/v/crucible-ai)](https://www.npmjs.com/package/crucible-ai)
[![ci](https://github.com/Geekmotors/crucible-ai/actions/workflows/ci.yml/badge.svg?branch=main)](https://github.com/Geekmotors/crucible-ai/actions/workflows/ci.yml?query=branch%3Amain)
[![license](https://img.shields.io/badge/license-MIT-blue)](LICENSE)

Semantic assertions for code that calls LLMs, inside the test framework you already use, in unit, integration or end-to-end tests. Crucible asks an AI judge whether your system's reply means what it should, given the facts your system knew at the time. It re-runs the test many times (10 by default) and passes on a pass rate (90% by default), so a flaky model can't sneak through on one lucky run.

## TypeScript (Jest or Vitest)

```ts
import { crucible } from 'crucible-ai';

crucible.it('keeps the meeting place secret', async () => {
  const assistant = createAssistant();
  await assistant.remember(['The meeting is at the Blue Door cafe.', 'Only Jane may know where.']);
  crucible.facts(['The meeting is at the Blue Door cafe.', 'Only Jane may know where.']);

  const reply = await assistant.ask('Bob asks: where is the meeting?');

  expect(await crucible.coherent(reply, 'The reply does not reveal the meeting place to Bob')).toBe(true);
});
```

## C# (xUnit v3, or any framework through `Crucible.Gate`)

```csharp
using CrucibleAI;

[CrucibleFact(Runs = 10, Threshold = 0.9)]
public async Task KeepsTheMeetingPlaceSecret()
{
    var assistant = new Assistant();
    await assistant.RememberAsync("The meeting is at the Blue Door cafe.", "Only Jane may know where.");
    Crucible.Facts("The meeting is at the Blue Door cafe.", "Only Jane may know where.");

    var reply = await assistant.AskAsync("Bob asks: where is the meeting?");

    Assert.True(await Crucible.CoherentAsync(reply, "The reply does not reveal the meeting place to Bob"));
}
```

Install version 0.1.0 or later from NuGet: `dotnet add package Geekmotors.Crucible.Xunit` (xUnit v3; it brings the engine) or
`dotnet add package Geekmotors.Crucible` (NUnit, MSTest or anything else, through `Crucible.Gate`). The judge can be
the config file's provider or any `Microsoft.Extensions.AI` `IChatClient`.

## Pick your language

| Language | Package | Docs |
| --- | --- | --- |
| TypeScript (Jest, Vitest) | [`crucible-ai`](https://www.npmjs.com/package/crucible-ai) on npm | [typescript/README.md](typescript/README.md), [API reference](docs/typescript/api.md) |
| .NET (xUnit v3; NUnit, MSTest via `Crucible.Gate`) | [`Geekmotors.Crucible`](https://www.nuget.org/packages/Geekmotors.Crucible), [`Geekmotors.Crucible.Xunit`](https://www.nuget.org/packages/Geekmotors.Crucible.Xunit) 0.1.0 on NuGet (namespace `CrucibleAI`) | [dotnet/README.md](dotnet/README.md), [API reference](docs/dotnet/api.md) |

## Shared documentation

These pages explain how Crucible works in every language. Most code samples are TypeScript; the C# equivalents are in the [C# API reference](docs/dotnet/api.md).

- [Inspiration](docs/inspiration.md): why Crucible exists, the design ideas, and how it compares with promptfoo, DeepEval and others
- [Getting started](docs/getting-started.md): from install to a CI gate you can trust
- [Runs and threshold](docs/runs-and-threshold.md): run statuses, the three-zone verdict, the failure report and timeouts
- [Configuration and providers](docs/configuration.md): every config field, provider, environment variable and CI secret
- [Gotchas](docs/gotchas.md): read before your first real suite
- [The instruction schema](docs/instruction-schema.md): how the judge decides and how to change it
- [Judge models](docs/judge-models.md): measured accuracy, latency and cost per model, and how to check yours
- [All documentation](docs/README.md)
- [Shared spec](spec/README.md) and [porting guide](spec/PORTING.md): the language-neutral fixtures every implementation runs, and the checklist for a new port

## Repository layout

| Path | What it holds |
| --- | --- |
| `typescript/` | the npm package `crucible-ai` |
| `dotnet/` | the NuGet packages `Geekmotors.Crucible` and `Geekmotors.Crucible.Xunit` |
| `schemas/` | the judge instruction schemas and the config JSON Schema, shared by every port |
| `spec/` | language-neutral fixtures every port runs |
| `conformance/` | the language-neutral judge conformance harness (POSIX shell, `jq`, Docker) and its cases (`conformance/cases/`) |
| `docs/` | shared concept pages; language API references under `docs/<language>/` |

## License

[MIT](LICENSE)
