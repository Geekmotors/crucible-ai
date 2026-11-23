# C# API reference

Two NuGet packages, one namespace:

| Package | Holds |
| --- | --- |
| `Geekmotors.Crucible` | the engine: `Crucible`, `CrucibleContext`, the options records, the exceptions. Works with any test framework through [`Crucible.Gate`](#cruciblegate). |
| `Geekmotors.Crucible.Xunit` | the xUnit v3 adapter: [`[CrucibleFact]`](#cruciblefact-and-crucibletheory), [`[CrucibleTheory]`](#cruciblefact-and-crucibletheory), [`[Crucible]`](#crucible-class-and-assembly-defaults), and the build step that copies the config file. Depends on `Geekmotors.Crucible`. |

Every public type lives in the `CrucibleAI` namespace (the package ids are
`Geekmotors.*`, the namespace is not, so `Crucible` never clashes with a
`Geekmotors.*` namespace of your own):

```csharp
using CrucibleAI;
```

| Type | What it is |
| --- | --- |
| [`Crucible`](#crucible) | static entry point: the ambient run API, `Gate`, `UseJudge` |
| [`CrucibleContext`](#cruciblecontext-1) | one run of a test: its facts and judge calls |
| [`RunOptions`](#runoptions) | `Runs`, `Threshold`, `InferenceTimeout`, `TestTimeout`, `Strict` |
| [`CoherentOptions`](#coherentoptions-and-extractoptions), [`ExtractOptions`](#coherentoptions-and-extractoptions) | options of one judge call |
| [`CrucibleException`](#crucibleexception), [`CrucibleErrorKind`](#crucibleexception) | usage, config and infrastructure errors |
| [`CrucibleVerdictException`](#crucibleverdictexception), [`VerdictOutcome`](#crucibleverdictexception) | a test that did not pass |
| [`CrucibleFactAttribute`](#cruciblefact-and-crucibletheory), [`CrucibleTheoryAttribute`](#cruciblefact-and-crucibletheory), [`CrucibleAttribute`](#crucible-class-and-assembly-defaults) | xUnit v3 (package `Geekmotors.Crucible.Xunit`) |

The ideas behind the API (runs, the three-zone verdict, the failure report,
facts, the judge's instructions) are the same in every language and are
explained in the shared pages: [Runs and threshold](../runs-and-threshold.md),
[Configuration](../configuration.md), [Gotchas](../gotchas.md),
[The instruction schema](../instruction-schema.md). The TypeScript reference
is [docs/typescript/api.md](../typescript/api.md).

## `[CrucibleFact]` and `[CrucibleTheory]`

```csharp
[CrucibleFact]
[CrucibleFact(Runs = 20, Threshold = 0.9, InferenceTimeout = 60_000, TestTimeout = 120_000, Strict = true, Sequential = true)]
[CrucibleTheory(Runs = 5)] [InlineData(...)] / [MemberData(...)] / [ClassData(...)]
```

Use `[CrucibleFact]` instead of xUnit's `[Fact]` and `[CrucibleTheory]`
instead of `[Theory]`. The test method runs `Runs` times (10 by default),
all at once, and passes when at least `Threshold` of the runs pass (0.9 by
default). It reaches its run through the ambient API: [`Crucible.Facts`](#cruciblefacts),
[`Crucible.CoherentAsync`](#cruciblecoherentasync),
[`Crucible.ExtractAsync<T>`](#crucibleextractasynct) and
[`Crucible.Context`](#cruciblecontext).

```csharp
using CrucibleAI;

public sealed class SupportBotTests(SupportBotFixture bot) : IClassFixture<SupportBotFixture>
{
    [CrucibleFact(Runs = 20, Threshold = 0.9)]
    public async Task DeclinesTheExportOnTheFreePlan()
    {
        var assistant = bot.Create(plan: "free");
        var reply = await assistant.AskAsync("Export my report as PDF.", Crucible.Context.CancellationToken);
        Crucible.Facts(assistant.Logs);

        Assert.True(await Crucible.CoherentAsync(reply, "The reply declines the export"));
    }

    [CrucibleTheory(Runs = 5, Threshold = 0.8)]
    [InlineData("free", false)]
    [InlineData("pro", true)]
    public async Task AnswersWhetherThePlanCanExport(string plan, bool allowed)
    {
        var reply = await bot.Create(plan).AskAsync("Can I export as PDF?", Crucible.Context.CancellationToken);

        Assert.Equal(allowed, await Crucible.ExtractAsync<bool?>(reply, "whether exporting is allowed"));
    }
}
```

| Property | Type | Meaning |
| --- | --- | --- |
| `Runs` | `int` | How many times the method runs, at least 1. Built-in 10. |
| `Threshold` | `double` | The share of runs that must pass, greater than 0 and at most 1. Built-in 0.9. |
| `InferenceTimeout` | `int` (ms) | How long each judge reply may take. Built-in 30000. |
| `TestTimeout` | `int` (ms) | Crucible's deadline for all runs. Built-in `30000 + 1000 × (Runs − 1)`. |
| `Strict` | `bool` | Default strict mode of every `ExtractAsync` call. Built-in `false`. |
| `Sequential` | `bool` | Run one after another instead of all at once. Built-in `false`. |

- **Resolution, nearest wins, one setting at a time.** Built-in default →
  the config file's `testDefaults` → `[assembly: Crucible(...)]` → class
  `[Crucible(...)]` (an outer class before its nested class, a base class
  before a derived class) → the method's attribute. A property you do not set
  is inherited from the next layer out; reading it on the attribute object
  gives `0` / `false`. An invalid value (`Runs = 0`, `Threshold = 1.5`) fails
  that test with a `usage` error.
- **One xUnit result per test**, and per theory data row: passed, or failed
  with a [`CrucibleVerdictException`](#crucibleverdictexception) whose
  message is the [failure report](../runs-and-threshold.md#reading-the-failure-report).
  A `usage` or `config` error fails the test with that `CrucibleException`.
- **Each run has its own test-class instance.** Before a run starts, the
  constructor (with xUnit's class, collection and assembly fixtures and
  `ITestOutputHelper`) and `IAsyncLifetime.InitializeAsync` run; the method
  runs inside the run; `DisposeAsync` / `Dispose` run after it. Those steps
  are outside the run: `Crucible.Facts` there is a `usage` error. A failing
  constructor, initialiser or dispose fails that run. Static test methods run
  without an instance.
- **Isolation.** Facts belong to one run of one test: never to the class,
  the collection, another theory row, another run, or a test running in
  parallel.
- **Shared between runs:** the fixtures, the row's argument objects and the
  `ITestOutputHelper`. Keep them thread-safe and immutable, or set
  `Sequential = true`.
- **Parallelism.** Runs execute on the thread pool, outside xUnit's
  `maxParallelThreads`: one test with `Runs = 10` makes up to 10 concurrent
  judge calls.
- **Timeouts and cancellation.** `TestTimeout` is Crucible's deadline; it
  reports which runs did not finish. xUnit's own `Timeout` still applies to
  the whole test: leave it unset or set it above `TestTimeout`. xUnit's test
  cancellation ends the gate and cancels `Crucible.Context.CancellationToken`.
  A body still running after a halt or the deadline is disposed when it
  finishes, possibly after the test has reported.
- **xUnit's own settings** (`Skip`, `SkipUnless` / `SkipWhen`, `Explicit`,
  `DisplayName`, `Timeout`, traits) keep their meaning. A skipped test runs
  no body and makes no judge calls; `Assert.Skip` inside a run skips the
  whole test. Methods return `void`, `Task`, `Task<T>`, `ValueTask` or
  `ValueTask<T>`; `async void` is refused.

## `[Crucible]`: class and assembly defaults

```csharp
[assembly: Crucible(Runs = 5)]

[Crucible(Runs = 10, Threshold = 0.9, Strict = true)]
public sealed class BookingTests { ... }
```

The same six properties as `[CrucibleFact]`, applied to every Crucible test
of the class (inherited by derived classes and nested classes) or the
assembly. It replaces TypeScript's `crucible.describe()` group settings. An
`[assembly: Crucible(...)]` outside a `CrucibleAI.*` namespace needs
`using CrucibleAI;`.

## `Crucible`

The static entry point. Every member except `Gate` and `UseJudge` acts on
the **current run**: the run whose async flow the call is in, resolved
through an `AsyncLocal` the way `TestContext.Current` is. Facts added
after an `await`, inside `Task.Run` or in a continuation stay in their run.
Called outside a running Crucible test (a plain `[Fact]`, a constructor, a
fixture, a static initialiser, after the run ended), each one throws a
`usage` error.

### `Crucible.Facts`

```csharp
public static void Facts(params string[] facts);
public static void Facts(IEnumerable<string> facts);
```

Adds facts to the current run, in order: the ground truth your system worked
from (its prompt context, retrieved documents, tool results, logs) in any
text format. Every later judge call of that run sends them as the `STATE`
section ([what the judge receives](../instruction-schema.md#what-the-judge-receives)).
Facts are copied, never removed, and seen by no other run. A `null` fact is a
`usage` error. Facts added after a call do not change that call.

### `Crucible.CoherentAsync`

```csharp
public static Task<bool> CoherentAsync(
    string actual, string expectation, CoherentOptions? options = null, CancellationToken cancellationToken = default);
```

Asks the judge whether `actual`, your system's output, is consistent with
`expectation`, one natural-language claim about it, given the run's facts so
far and the call's own `options.Facts`. Returns the verdict and never throws
on `false`: assert it (`Assert.True(await Crucible.CoherentAsync(...))`). A
verdict nobody asserts never fails a test
([Gotchas](../gotchas.md#a-verdict-nobody-asserts-never-fails-a-test)).
Assert true claims ("the reply declines the export"), not false ones.

### `Crucible.ExtractAsync<T>`

```csharp
public static Task<T?> ExtractAsync<T>(
    string text, string description, ExtractOptions? options = null, CancellationToken cancellationToken = default);
```

Asks the judge for the one value `text` commits to for `description`, typed
as `T`, or `null` when it commits to none. Then assert it with ordinary xUnit
assertions.

| `T` | Sent to the judge as | Returns |
| --- | --- | --- |
| `string` | `string` | the text value, or `null` |
| `int?`, `long?` | `number` | a whole number in range; anything else is `null` |
| `double?` | `number` | the number, or `null` |
| `bool?` | `boolean` | the value, or `null` |

Ask for value types in their nullable form (`ExtractAsync<int?>`), because
the judge may answer `null`. Any other `T` is a `usage` error.

**Strict mode.** With `Strict` (from the call's `ExtractOptions.Strict`,
else the test's resolved `Strict`), any hedge in the text extracts as `null`:
"probably two, maybe three" gives `null`. Without it the judge takes the
value the text leans to (`2`). Use strict mode when a hedge must fail the
test ([the extract schema](../instruction-schema.md#the-extract-schema)).

```csharp
var apples = await Crucible.ExtractAsync<int?>(reply, "the number of apples", new ExtractOptions { Strict = true });
Assert.Equal(2, apples);
```

### `Crucible.Context`

```csharp
public static CrucibleContext Context { get; }
```

The current run's [`CrucibleContext`](#cruciblecontext-1). Use it for the run
number and the cancellation token, or hold it where the async flow is lost.

### `Crucible.Gate`

```csharp
public static Task Gate(Func<CrucibleContext, Task> body);
public static Task Gate(RunOptions options, Func<CrucibleContext, Task> body);
public static Task Gate(Func<CrucibleContext, Task> body, CancellationToken cancellationToken);
public static Task Gate(RunOptions options, Func<CrucibleContext, Task> body, CancellationToken cancellationToken);
```

The framework-neutral form, for NUnit, MSTest or anything without a Crucible
adapter: call it inside an ordinary test method. It runs `body` the way
`[CrucibleFact]` runs its method (`options.Runs` times at once, each run with
its own `CrucibleContext`) and completes when the gate passes, or throws
`CrucibleVerdictException` with the failure report. Options left `null`
resolve from the config's `testDefaults`, then the built-in defaults. Inside
`body` both `context.*` and the ambient `Crucible.*` reach the run.

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

- **Cancellation.** Pass the framework's test token (NUnit
  `TestContext.CurrentContext.CancellationToken`, MSTest
  `TestContext.CancellationToken`): cancelling it ends the gate, cancels
  every run's `CancellationToken` and in-flight judge calls, and throws
  `OperationCanceledException`.
- **Timeouts.** The gate enforces its own `TestTimeout`. A framework timeout
  shorter than that fails the test first, without Crucible's report.
- **Errors.** Invalid options or a `null` body throw a `usage` error from
  the call itself. A run that throws a `usage` or `config` error ends the
  gate and the error is rethrown unchanged.
- A gate nested in a run body that does not pass ends the outer gate too.

### `Crucible.UseJudge`

```csharp
public static void UseJudge(IChatClient chatClient, ChatOptions? options = null);
```

Makes any `Microsoft.Extensions.AI` `IChatClient` the judge, instead of the
provider in `crucible.config.json`. Call it **once, before the first
Crucible test starts**:

```csharp
// xUnit v3: an assembly fixture; the client here comes from Microsoft.Extensions.AI.OpenAI
[assembly: AssemblyFixture(typeof(JudgeSetup))]

public sealed class JudgeSetup
{
    public JudgeSetup() =>
        Crucible.UseJudge(
            new OpenAIClient(Environment.GetEnvironmentVariable("CRUCIBLE_JUDGE_KEY")).GetChatClient("gpt-5-mini").AsIChatClient());
}
```

NUnit: a `[SetUpFixture]` with `[OneTimeSetUp]`; MSTest:
`[AssemblyInitialize]`; any framework: a `[ModuleInitializer]`.

- **Rules.** A `null` client is a `usage` error. Calling it after the first
  gate or Crucible test started, or again with a different client or
  options, is a `usage` error (it never silently keeps the old judge). The
  same client and `ChatOptions` instances again are a no-op; equal but
  separate `ChatOptions` objects count as different. The judge belongs to
  the process: xUnit v3 runs each test project as its own process, so each
  test project sets up its own. Crucible never disposes the client, and it
  copies `options` on every call, so do not change them after the call.
- **The config file becomes optional.** Without one, the built-in defaults
  apply (`CRUCIBLE_VERBOSE` still works). With one, `testDefaults`,
  `verbosity` and `excerptChars` apply as usual and every field is still
  validated, except `provider`, `model`, `baseUrl`, `apiKeyEnv` and `meta`:
  they are ignored, and Crucible writes one warning to standard error naming
  them. No judge key is read: authenticate the client yourself.
- **What is sent.** Each judge call sends two messages, `ChatRole.System`
  (the [judge instructions](../instruction-schema.md)) and `ChatRole.User`
  (the payload), with a fresh copy of `options` (or `null`). Choose the
  model, temperature or reasoning effort in `options` or in the client;
  `meta` does not apply. Crucible adds no tools and no response format;
  `Tools`, `ToolMode` and `ResponseFormat` set in `options` are your
  choice and pass through unchanged. `ConversationId` is cleared on every
  call, so no judge call continues a server-side conversation. The
  reply is `ChatResponse.Text`, held to the same rules as a provider reply:
  strict JSON with trailing commas dropped, one re-ask when unusable, `InferenceTimeout` enforced through
  the `CancellationToken` passed to the client.
- **Failures.** One attempt plus up to two retries (after 250 to 500 ms,
  then 500 to 1000 ms) for transient failures: an `HttpRequestException`
  without a status code or with 408, 429 or 5xx, a `TimeoutException`, an
  `IOException`, an `OperationCanceledException` Crucible did not cause (an
  `HttpClient.Timeout`), or an exception that carries, itself or through its
  `InnerException` chain, a public `int Status` property of 408, 429 or 5xx.
  That last rule covers the provider SDKs' own exceptions without a
  dependency on them: `System.ClientModel.ClientResultException` (OpenAI,
  thrown after the SDK's own retries) and `Azure.RequestFailedException`.
  When every attempt fails the run is **errored** (`infra`,
  `Retryable = true`). Any other exception (a 400 or 401, an
  `InvalidOperationException`, an SDK exception with another status) is a
  non-retryable `infra` error that aborts the whole test. Network failures
  without a status (DNS, TLS) are retried, as for the config-file provider.
- **Caching.** If the client is, or wraps, a `CachingChatClient`
  (`UseDistributedCache()` in a `ChatClientBuilder` pipeline), Crucible
  writes one warning to standard error: a cached judge replays one verdict
  for the same input and hides the judge's own variance. It is not an error.
  See [caching](#response-caching-defeats-repeated-runs) below.
- **Debug trace.** With `verbosity: debug` the provider lines name
  `"chat-client"` and the model: `options.ModelId`, else the client's
  `ChatClientMetadata.DefaultModelId`, else `(client default)`.
- **Report stamp.** The `Judge:` line of every report names the judge
  `IChatClient` (no configured model). The served model is each
  `ChatResponse.ModelId`, tokens are `Usage.TotalTokenCount` (else
  `InputTokenCount + OutputTokenCount`), and cost is always
  `cost not reported`.

### Response caching defeats repeated runs

Crucible's runs only measure something when each run calls the **system
under test** afresh. If your system's `IChatClient` pipeline caches responses
(`UseDistributedCache()`, a `CachingChatClient`, an HTTP cache), the second
run gets the first run's reply: N runs become one sample repeated N times,
and the pass rate is 0 or 1 whatever the threshold says. Build the system
under test without response caching in Crucible tests. Crucible cannot see
that client, so it cannot warn about it; it only checks the judge client
passed to `UseJudge`.

## `CrucibleContext`

```csharp
public sealed class CrucibleContext
{
    public int Run { get; }
    public CancellationToken CancellationToken { get; }
    public void Facts(params string[] facts);
    public void Facts(IEnumerable<string> facts);
    public Task<bool> CoherentAsync(string actual, string expectation, CoherentOptions? options = null, CancellationToken cancellationToken = default);
    public Task<T?> ExtractAsync<T>(string text, string description, ExtractOptions? options = null, CancellationToken cancellationToken = default);
}
```

One run of a test. `Gate` passes it to `body`; `Crucible.Context` returns
it anywhere the run's async flow reaches. The methods behave as the
`Crucible.*` members above, bound to this run.

- `Run`: the run's number, from 1, as the failure report names it.
- `CancellationToken`: cancelled when the gate ends (all runs settled, a
  halt, an abort, the deadline, or the caller's cancellation). Pass it to
  your system so work a run started stops when nobody waits for it.
- **Hold it where the flow is lost.** `ExecutionContext.SuppressFlow`,
  `ThreadPool.UnsafeQueueUserWorkItem` and some native callbacks lose the
  `AsyncLocal`, so `Crucible.*` there is a `usage` error; pass the context
  instead. A worker first started inside a run (a timer, a channel consumer)
  stays in that run's flow: hand it the context of the run it serves.
- **Ends with its run.** Once its run passed, failed, errored or was
  discarded, every call is a `usage` error.

## `RunOptions`

```csharp
public sealed record RunOptions
{
    public int? Runs { get; init; }
    public double? Threshold { get; init; }
    public int? InferenceTimeout { get; init; }
    public int? TestTimeout { get; init; }
    public bool? Strict { get; init; }
}
```

The options of [`Crucible.Gate`](#cruciblegate). Each one left `null` is not
declared and resolves from the config's `testDefaults`, else the built-in
default (the table under [`[CrucibleFact]`](#cruciblefact-and-crucibletheory)).
Invalid values are a `usage` error. What `Runs` and `Threshold` mean, and how
to choose them: [Runs and threshold](../runs-and-threshold.md).

**The threshold is a sampled pass rate.** A system that passes exactly 95%
of the time fails a `Runs = 20, Threshold = 0.95` gate about one CI run in
four. Gate below the rate you measured, and add runs rather than raising the
threshold ([A threshold is a sampled estimate](../runs-and-threshold.md#a-threshold-is-a-sampled-estimate)).

## `CoherentOptions` and `ExtractOptions`

```csharp
public sealed record CoherentOptions
{
    public IReadOnlyList<string>? Facts { get; init; }
}

public sealed record ExtractOptions
{
    public bool? Strict { get; init; }
    public IReadOnlyList<string>? Facts { get; init; }
}
```

- `Facts`: sent with this call only, after the run's facts; not added to the
  run. `null`: the run's facts alone.
- `Strict` (extract only): `true` / `false` overrides the test's resolved
  `Strict`; `null` uses it.

New options are added as new properties, so existing initialisers keep
compiling.

## Errors

### `CrucibleException`

Thrown for problems Crucible detects in setup or infrastructure.

| Property | Type | Meaning |
| --- | --- | --- |
| `Kind` | `CrucibleErrorKind` | `Usage`: an API called incorrectly or outside a running test. `Config`: the config file or the judge key environment variable. `Infra`: the judge provider, the judge client or the judge's reply failed. |
| `Retryable` | `bool?` | Set only for `Infra`: `true` when the failure was transient (the run is errored), `false` when it will fail again (the whole test aborts). |

Branch on `Kind`, never on the message text: messages are for humans and may
change. The config rules and messages are listed in
[Configuration](../configuration.md#validation-and-errors).

### `CrucibleVerdictException`

Thrown by a test or gate that did not pass. `Message` is the
[failure report](../runs-and-threshold.md#reading-the-failure-report).

| Property | Type | Meaning |
| --- | --- | --- |
| `Outcome` | `VerdictOutcome` | `Failed`: your system missed the threshold. `Errored`: infrastructure (judge failures, a fatal judge error, or the deadline) prevented a verdict. |
| `InnerException` | `Exception?` | The exception of a representative run, when there is one. |

## The config file

`crucible.config.json` or `crucible.config.jsonc` (comments allowed), read
from the **working directory** the first time a Crucible test runs; the
fields are the same in every language
([Configuration](../configuration.md#fields)). Under xUnit the working
directory is the build output folder, so `Geekmotors.Crucible.Xunit` ships
an MSBuild `build/` targets file that copies the file from beside your
`.csproj` to the output folder on every build (`PreserveNewest`), without
any edit to your project file. With NUnit or MSTest, copy it yourself:

```xml
<ItemGroup>
  <None Update="crucible.config.json" CopyToOutputDirectory="PreserveNewest" />
</ItemGroup>
```

A missing file is a `config` error that names the folder searched, unless a
judge was set with [`Crucible.UseJudge`](#crucibleusejudge). The judge key is
read from `CRUCIBLE_JUDGE_KEY` (or the variable `apiKeyEnv` names), never
from the file.
