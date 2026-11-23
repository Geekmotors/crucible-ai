# Crucible for .NET

Semantic assertions for code that calls LLMs, inside the test framework you already use, in unit, integration or
end-to-end tests. Crucible asks an AI judge whether your system's reply means what it should, given the facts your
system knew at the time. It re-runs the test many times (10 by default) and passes on a pass rate (90% by default), so
a flaky model can't sneak through on one lucky run.

- `Geekmotors.Crucible`: the engine. `Crucible.Gate` works inside any test framework (NUnit, MSTest, xUnit).
- `Geekmotors.Crucible.Xunit`: the xUnit v3 adapter, `[CrucibleFact]`, `[CrucibleTheory]` and `[Crucible]`.

Both target `net8.0` and `net10.0`. Every type lives in the `CrucibleAI` namespace (`using CrucibleAI;`). The full
C# reference is [docs/dotnet/api.md](https://github.com/Geekmotors/crucible-ai/blob/main/docs/dotnet/api.md).

## Install

```sh
dotnet add package Geekmotors.Crucible.Xunit   # xUnit v3; brings Geekmotors.Crucible
dotnet add package Geekmotors.Crucible         # NUnit, MSTest or anything else: Crucible.Gate
```

`Geekmotors.Crucible.Xunit` depends on exactly the same version of `Geekmotors.Crucible`; let it bring the engine in,
or keep both references at the same version. Release notes:
[CHANGELOG](https://github.com/Geekmotors/crucible-ai/blob/main/dotnet/CHANGELOG.md).

## Quick start (xUnit v3)

1. Put `crucible.config.json` beside your test project's `.csproj`:

   ```json
   {
     "$schema": "https://raw.githubusercontent.com/Geekmotors/crucible-ai/main/schemas/crucible.config.schema.json",
     "provider": "openrouter",
     "model": "anthropic/claude-haiku-5.5"
   }
   ```

2. Set the judge key in the environment, never in the file: `export CRUCIBLE_JUDGE_KEY=sk-or-...` (or name another
   variable with `"apiKeyEnv"`).

3. Write `[CrucibleFact]` where you would write `[Fact]`:

   ```csharp
   using CrucibleAI;

   public sealed class MeetingAssistantTests
   {
       [CrucibleFact(Runs = 10, Threshold = 0.9)]
       public async Task KeepsTheMeetingPlaceSecret()
       {
           var assistant = new Assistant();
           await assistant.RememberAsync("The meeting is at the Blue Door cafe.", "Only Jane may know where.");
           Crucible.Facts("The meeting is at the Blue Door cafe.", "Only Jane may know where.");

           var reply = await assistant.AskAsync("Bob asks: where is the meeting?", Crucible.Context.CancellationToken);

           Assert.True(await Crucible.CoherentAsync(reply, "The reply does not reveal the meeting place to Bob"));
       }
   }
   ```

4. `dotnet test`. The method runs 10 times at once, each run on its own test-class instance with its own facts, and
   reports one xUnit result: passed when at least 9 runs passed, otherwise failed with Crucible's failure report.

## The config file

`crucible.config.json` (or `crucible.config.jsonc`, comments allowed) holds the judge `provider` (`openrouter`,
`openai` or `openai-compatible` with a `baseUrl`), the `model`, and optionally `meta` (extra request fields such as
`temperature`), `apiKeyEnv`, `verbosity` (`default`, `full`, `debug`), `excerptChars` and `testDefaults` (default
run options for every test). The fields are the same in every language:
[Configuration and providers](https://github.com/Geekmotors/crucible-ai/blob/main/docs/configuration.md).

Crucible reads it from the working directory the first time a Crucible test runs. xUnit runs tests with the build
output folder as the working directory, so `Geekmotors.Crucible.Xunit` ships an MSBuild `build/` targets file that
copies the file from beside your `.csproj` to the output folder on every build (`PreserveNewest`). You do not edit
the project file. With NUnit or MSTest, add `<None Update="crucible.config.json" CopyToOutputDirectory="PreserveNewest" />`.
A missing file fails the test with a `config` error naming the folder searched (unless an `IChatClient` judge is
set with `Crucible.UseJudge`, below). Switching from `.json` to `.jsonc`
leaves the old copy in `bin/` until a clean build.

`CRUCIBLE_VERBOSE=full` (or `debug`) overrides `verbosity` for one invocation.

## Attributes and settings

| Property | Meaning | Built-in |
| --- | --- | --- |
| `Runs` | how many times the method runs | 10 |
| `Threshold` | share of runs that must pass, in (0, 1] | 0.9 |
| `InferenceTimeout` | ms each judge reply may take | 30000 |
| `TestTimeout` | ms Crucible gives all runs together | 30000 + 1000 × (Runs − 1) |
| `Strict` | default strict mode of `ExtractAsync` | false |
| `Sequential` | run one after another instead of all at once | false |

Every property is available on `[CrucibleFact]`, `[CrucibleTheory]` (methods) and `[Crucible]` (classes and the
assembly). **Nearest wins, one setting at a time**: the method attribute, then the class `[Crucible(...)]` (a nested
class over its outer class, a derived class over its base), then `[assembly: Crucible(...)]`, then the config file's
`testDefaults`, then the built-in defaults. A property you leave out is inherited. An invalid value fails that test
with a `usage` error.

```csharp
[assembly: Crucible(Runs = 5)]

[Crucible(Threshold = 0.8)]
public sealed class BookingTests(BookingFixture booking) : IClassFixture<BookingFixture>
{
    [CrucibleTheory(Runs = 10)]
    [InlineData("Book a table for four at eight", "a booking for four people")]
    [InlineData("Book a table for six at nine", "a booking for six people")]
    public async Task ConfirmsEachBooking(string request, string expectation)
    {
        var reply = await booking.Assistant.AskAsync(request, Crucible.Context.CancellationToken);
        Assert.True(await Crucible.CoherentAsync(reply, $"The reply confirms {expectation}"));
    }
}
```

- **One result per test**, and per theory data row (`[InlineData]`, `[MemberData]`, `[ClassData]`).
- **Each run has its own test-class instance**: constructor (with fixtures and `ITestOutputHelper`) and
  `IAsyncLifetime.InitializeAsync` before the run, `DisposeAsync`/`Dispose` after it. Those are outside the run:
  `Crucible.Facts` there is a `usage` error. Fixtures, row arguments and the output helper are shared by the runs of
  one test: keep them thread-safe, or set `Sequential = true`.
- **Isolation**: facts belong to one run of one test, never to the class, the collection, another row, another run
  or a test running in parallel.
- **Parallelism**: runs execute on the thread pool, outside xUnit's `maxParallelThreads`; `Runs = 10` means up to 10
  concurrent judge calls.
- **Timeouts**: `TestTimeout` is Crucible's deadline and its report names the runs that did not finish. xUnit's own
  `Timeout` still applies to the whole test: leave it unset or above `TestTimeout`. xUnit's test cancellation ends
  the gate and cancels `Crucible.Context.CancellationToken`; pass that token to your system.
- **xUnit's own settings** (`Skip`, `SkipUnless`/`SkipWhen`, `Explicit`, `DisplayName`, traits) keep their meaning; a
  skipped test makes no judge calls. `async void` methods are refused.

## Facts, coherent and extract

```csharp
Crucible.Facts(assistant.Logs);                                   // what your system knew, per run
bool ok = await Crucible.CoherentAsync(reply, "The reply declines the export");
int? apples = await Crucible.ExtractAsync<int?>(reply, "the number of apples");
string? city = await Crucible.ExtractAsync<string>(reply, "the city the user should travel to");
bool? allowed = await Crucible.ExtractAsync<bool?>(reply, "whether exporting is allowed", new ExtractOptions { Strict = true });
```

- `Crucible.Facts(...)` adds the ground truth your system worked from (prompt context, retrieved documents, tool
  results) to the current run. Every later judge call of that run sends them.
- `Crucible.CoherentAsync(actual, expectation)` returns the judge's verdict on one natural-language claim. It never
  throws on `false`: **assert it**. Assert true claims, not false ones.
- `Crucible.ExtractAsync<T>(text, description)` returns the one value the text commits to, typed as `T` (`string`,
  `int?`, `long?`, `double?`, `bool?`), or `null`. Then assert it with ordinary xUnit assertions.
- **Strict** (`ExtractOptions.Strict`, or `Strict` on the attribute): any hedge extracts as `null` ("probably two,
  maybe three" gives `null` instead of `2`).
- Per-call facts: `new CoherentOptions { Facts = ["..."] }` / `new ExtractOptions { Facts = ["..."] }`.
- `Crucible.Context` is the current run (`Run` number, `CancellationToken`). Called outside a running Crucible test,
  any of these is a `usage` error.

## Runs, threshold and the pass rate

A gate is a measurement, not a proof. A system that passes exactly 95% of the time fails a
`Runs = 20, Threshold = 0.95` gate about one CI run in four, with nothing wrong. Measure first with many runs, gate
below the rate you measured, and add runs rather than raising the threshold:
[Runs and threshold](https://github.com/Geekmotors/crucible-ai/blob/main/docs/runs-and-threshold.md).

## NUnit, MSTest and anything else: `Crucible.Gate`

```csharp
[Test]
public async Task DeclinesTheExport() =>
    await Crucible.Gate(
        new RunOptions { Runs = 5, Threshold = 0.8 },
        async context =>
        {
            var reply = await CreateAssistant("free").AskAsync("Export my report as PDF.", context.CancellationToken);
            Assert.That(await context.CoherentAsync(reply, "The reply declines the export"), Is.True);
        },
        TestContext.CurrentContext.CancellationToken);
```

`Crucible.Gate` runs the body the way `[CrucibleFact]` runs its method and throws `CrucibleVerdictException` (the
failure report) when the gate does not pass. Pass the framework's test cancellation token (MSTest:
`TestContext.CancellationToken`). Set the framework's timeout above the gate's `TestTimeout`, or the framework fails
the test first without Crucible's report.

## Your own `IChatClient` as the judge

Any `Microsoft.Extensions.AI` `IChatClient` can be the judge instead of the config file's provider. Call
`Crucible.UseJudge` once, before the first Crucible test starts:

```csharp
[assembly: AssemblyFixture(typeof(JudgeSetup))]

public sealed class JudgeSetup
{
    public JudgeSetup() =>
        Crucible.UseJudge(
            new OpenAIClient(Environment.GetEnvironmentVariable("CRUCIBLE_JUDGE_KEY")).GetChatClient("gpt-5-mini").AsIChatClient());
}
```

(NUnit: `[SetUpFixture]`; MSTest: `[AssemblyInitialize]`; anywhere: `[ModuleInitializer]`.)

- A `null` client, a call after a Crucible test started, or a second call with a different client or `ChatOptions`
  instance is a `usage` error; the same instances again are a no-op. The judge is per process: xUnit v3 runs each
  test project as its own process, so set it up in every test project. Crucible never disposes the client.
- The config file becomes optional. If present, `testDefaults`, `verbosity` and `excerptChars` still apply;
  `provider`, `model`, `baseUrl`, `apiKeyEnv` and `meta` are ignored with one warning on standard error.
- Each judge call sends a system and a user message with a copy of your `ChatOptions`; choose the model and
  temperature there or in the client. The reply follows the same rules as a provider reply (strict JSON with trailing commas dropped,
  one re-ask, `InferenceTimeout`).
- An `HttpRequestException` without status or with 408, 429 or 5xx, a `TimeoutException`, an `IOException`, a
  client-side timeout, or an SDK exception whose public `int Status` (itself or an inner exception) is 408, 429 or
  5xx (OpenAI's `ClientResultException`, Azure's `RequestFailedException`) is retried twice, then errors the run. Any
  other exception aborts the test (non-retryable `infra`).
- Your `Tools`, `ToolMode` and `ResponseFormat` pass through unchanged; `ConversationId` is cleared on every call.

## Response caching defeats repeated runs

N runs only measure something if each run calls the system under test afresh. If your system's chat pipeline caches
responses (`UseDistributedCache()`, a `CachingChatClient`, an HTTP cache), every run after the first replays the same
reply: N runs become one sample, and the pass rate is 0 or 1. **Turn response caching off for the system under test
in Crucible tests.** Crucible cannot see your system's client, so it cannot detect this for you. It does check the
judge: a judge client passed to `UseJudge` that is or wraps a `CachingChatClient` gets one warning on standard
error, because a cached judge replays one verdict and hides the judge's own variance.

## Reading a failure

A failed test's message is the failure report:

```text
FAILED: 14/20 runs passed (pass rate 0.7) against threshold 0.95 (need 19).
Runs: 14 passed, 5 failed, 1 errored, 0 discarded.

[FAILED] Run #2
  First failed assertion: coherent (assertion 1 of 1 judged in this run)
  Claim: The reply does not reveal the meeting place to Bob
  Facts: The meeting is at the Blue Door cafe.
    Only Jane may know where.
  Judge reasoning: The reply names the Blue Door cafe, which is the secret meeting place.
  Response excerpt: Sure, Jane and Bob are meeting at the Blue Door cafe.
  Thrown: TrueException: Assert.True() Failure …

[ERRORED] Run #5 (infrastructure, not a semantic failure)
  Cause: CrucibleException: The "openrouter" judge kept failing after 3 attempts.
  Judge attempts: 3
```

`FAILED` is a semantic failure (`CrucibleVerdictException.Outcome` is `Failed`); `ERRORED, not failed` means
infrastructure left no verdict (`Errored`). Usage, config and infrastructure problems throw `CrucibleException`:
branch on `Kind` (`Usage`, `Config`, `Infra`) and `Retryable`, never on the message.
[Reading the failure report](https://github.com/Geekmotors/crucible-ai/blob/main/docs/runs-and-threshold.md#reading-the-failure-report)
explains every field and the `full` and `debug` verbosity levels.

## Documentation

- [C# API reference](https://github.com/Geekmotors/crucible-ai/blob/main/docs/dotnet/api.md)
- [Getting started](https://github.com/Geekmotors/crucible-ai/blob/main/docs/getting-started.md): which assertion to
  use when, tuning the gate
- [Runs and threshold](https://github.com/Geekmotors/crucible-ai/blob/main/docs/runs-and-threshold.md)
- [Configuration and providers](https://github.com/Geekmotors/crucible-ai/blob/main/docs/configuration.md)
- [Gotchas](https://github.com/Geekmotors/crucible-ai/blob/main/docs/gotchas.md)
- [The instruction schema](https://github.com/Geekmotors/crucible-ai/blob/main/docs/instruction-schema.md): how the
  judge decides
- [Judge models](https://github.com/Geekmotors/crucible-ai/blob/main/docs/judge-models.md)

The port follows [`spec/PORTING.md`](https://github.com/Geekmotors/crucible-ai/blob/main/spec/PORTING.md) and runs
the shared fixtures in `spec/`, the same answer key as the TypeScript package `crucible-ai`. Each release passes the
`spec/` at its own release tag: version X.Y.Z at tag `dotnet-vX.Y.Z`. The assembly says so too:
`[AssemblyMetadata("CrucibleSpec", "dotnet-vX.Y.Z")]` on `Geekmotors.Crucible`.

## Contributing: build and test

Needs the .NET 10 SDK (see `global.json`) and the .NET 8 runtime.

```sh
cd dotnet
dotnet build -warnaserror
dotnet test
dotnet format --verify-no-changes
```

Or from the repository root: `make dotnet-test` and `make dotnet-format`; `make dotnet-live` runs the opt-in live
smoke against OpenRouter; `make dotnet-pack-check` packs both packages into `dotnet/artifacts/packages/` and checks
their contents and metadata (`scripts/verify-pack.sh`). Releases: see
[RELEASING.md](https://github.com/Geekmotors/crucible-ai/blob/main/RELEASING.md#net-packages).

| Path | What |
| --- | --- |
| `src/Geekmotors.Crucible/` | the engine library |
| `src/Geekmotors.Crucible.Xunit/` | the xUnit v3 adapter and its config-copy `build/` targets |
| `tests/Geekmotors.Crucible.Tests/` | engine tests, including the `spec/` fixture runner (`Spec/`) |
| `tests/Geekmotors.Crucible.Xunit.Tests/` | adapter tests: settings resolution, and isolation proven by running the fixture project in a child process |
| `tests/Geekmotors.Crucible.Xunit.Fixture/` | real xUnit tests run only by the adapter tests (fake judge, never by `dotnet test`) |
| `tests/Geekmotors.Crucible.LiveTests/` | opt-in live smoke against OpenRouter (`make dotnet-live`) |
| `scripts/verify-pack.sh` | the package check CI and the release workflow run |

The fixture runner embeds every `spec/**/*.json` file, validates each against `spec/fixture.schema.json` and runs
every case; the case ids C# skips, with their reasons (each is input a C# caller cannot express, such as a number
where the parameter is a `string`), are listed in `tests/Geekmotors.Crucible.Tests/Harnesses/SpecOperations.cs`.
