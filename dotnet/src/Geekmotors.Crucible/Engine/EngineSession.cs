using System.Text.Json.Nodes;
using CrucibleAI.Assertions;
using CrucibleAI.Config;
using CrucibleAI.Judging;
using CrucibleAI.Providers;
using CrucibleAI.Reports;
using CrucibleAI.Tracing;

namespace CrucibleAI.Engine;

internal sealed class EngineSession
{
    private readonly ITraceOutput _output;
    private readonly Verbosity _verbosity;

    public EngineSession(JudgeConfig config, IJudgeClient judge, TimeProvider time, ITraceOutput output)
        : this(
            config.Run,
            ChatEndpoint.For(config).Name,
            config.Model,
            config.Meta,
            new JudgeStampFactory().For(ChatEndpoint.For(config).Name, config.Model),
            judge,
            time,
            output)
    {
    }

    public EngineSession(
        RunSettings settings,
        string provider,
        string model,
        JsonObject? meta,
        JudgeStamp stamp,
        IJudgeClient judge,
        TimeProvider time,
        ITraceOutput output)
    {
        var exchange = new JudgeExchange(judge, time);
        _output = output;
        _verbosity = settings.Verbosity;
        TestDefaults = settings.TestDefaults;
        Coherent = new CoherentAssertion(exchange);
        Extract = new ExtractAssertion(exchange);
        Reports = new ReportRenderer(new ReportSettings(settings.ExcerptChars, settings.Verbosity, stamp));
        Trace = new DebugTrace(
            new TraceSettings(settings.Verbosity, provider, model, meta, settings.TestDefaultsNode, settings.ExcerptChars),
            output);
    }

    public RunOptions TestDefaults { get; }

    public CoherentAssertion Coherent { get; }

    public ExtractAssertion Extract { get; }

    public ReportRenderer Reports { get; }

    public DebugTrace Trace { get; }

    public void WritePassingReport(Func<string> report)
    {
        if (_verbosity == Verbosity.Default)
        {
            return;
        }
        try
        {
            _output.Write(report() + "\n");
        }
        catch (Exception failure) when (failure is not OutOfMemoryException)
        {
        }
    }
}
