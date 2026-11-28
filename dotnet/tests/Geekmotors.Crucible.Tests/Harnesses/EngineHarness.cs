using System.Globalization;
using System.Text;
using CrucibleAI.Engine;
using CrucibleAI.Providers;
using CrucibleAI.Tests.Constants;
using CrucibleAI.Tests.Fakes;
using CrucibleAI.Tracing;

namespace CrucibleAI.Tests.Harnesses;

internal sealed class EngineHarness
{
    private static readonly CompositeFormat RunFact = CompositeFormat.Parse(EngineTexts.FactFormat);
    private static readonly CompositeFormat GateFact = CompositeFormat.Parse(EngineTexts.GateFactFormat);

    public EngineHarness(
        IJudgeClient? client = null,
        string config = EngineTexts.Config,
        string? verbosity = null,
        ITraceOutput? output = null,
        IReadOnlyDictionary<string, string>? invocation = null)
    {
        var variables = new Dictionary<string, string>(StringComparer.Ordinal) { [JudgeSettings.KeyVariable] = JudgeSettings.Key };
        if (verbosity is not null)
        {
            variables[EngineTexts.VerbosityVariable] = verbosity;
        }
        foreach (var (name, value) in invocation ?? new Dictionary<string, string>())
        {
            variables[name] = value;
        }
        var environment = new FakeEnvironment(variables);
        var judge = client ?? new PromptJudgeClient();
        var written = output ?? Output;
        Engine = new GateEngine(() => new EngineSession(ProviderHarness.Load(config, environment), judge, Clock, written), Clock);
    }

    public ManualTimeProvider Clock { get; } = new();

    public RecordingTraceOutput Output { get; } = new();

    public GateEngine Engine { get; }

    public Task RunAsync(RunOptions options, Func<CrucibleContext, Task> body) => Engine.RunAsync(new GateRequest([], options, _ => Task.FromResult(RunBody.Of(body)), false));

    public Task RunAsync(GateRequest request) => Engine.RunAsync(request);

    public static async Task<string> PromptAsync() =>
        await Crucible.ExtractAsync<string>(EngineTexts.Response, EngineTexts.Target) ?? string.Empty;

    public static string Fact(int run) => string.Format(CultureInfo.InvariantCulture, RunFact, run);

    public static string Fact(string gate, int run) => string.Format(CultureInfo.InvariantCulture, GateFact, gate, run);
}
