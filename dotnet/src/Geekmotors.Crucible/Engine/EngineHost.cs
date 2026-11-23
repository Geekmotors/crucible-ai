using CrucibleAI.ChatClients;
using CrucibleAI.Config;
using CrucibleAI.Providers;
using CrucibleAI.Reports;
using CrucibleAI.Tracing;
using Microsoft.Extensions.AI;

namespace CrucibleAI.Engine;

internal sealed class EngineHost(ConfigLoader configs, IWarningSink warnings, ITraceOutput output, TimeProvider time)
{
    private readonly object _sync = new();
    private readonly CachingClientProbe _caching = new();
    private object? _judge;
    private Func<EngineSession>? _session;
    private GateEngine? _engine;

    public EngineHost()
        : this(new ConfigLoader(), new StandardErrorWarningSink(), new StandardOutputTraceOutput(), TimeProvider.System)
    {
    }

    public GateEngine Engine
    {
        get
        {
            lock (_sync)
            {
                return _engine ??= new GateEngine(_session ?? ProviderSession, time);
            }
        }
    }

    public void UseJudge(IJudgeClient judge) => Choose(judge, () => new EngineSession(configs.Load(), judge, time, output));

    public void UseChatClient(IChatClient? client, ChatOptions? options)
    {
        if (client is null)
        {
            throw CrucibleException.Usage("Crucible.UseJudge needs an IChatClient.");
        }
        var caches = _caching.Caches(client);
        if (Choose((client, options), () => ChatClientSession(client, options)) && caches)
        {
            warnings.Write(
                "Crucible: the judge IChatClient caches responses, so repeated judge calls replay one verdict and hide the judge's "
                + "own variance. Pass Crucible.UseJudge a client without response caching.");
        }
    }

    private bool Choose(object judge, Func<EngineSession> session)
    {
        lock (_sync)
        {
            if (_judge is not null && _judge.Equals(judge))
            {
                return false;
            }
            if (_engine is not null)
            {
                throw CrucibleException.Usage(
                    "Crucible.UseJudge was called after the first Crucible test started. Call it once before any test runs "
                    + "(an xUnit assembly fixture, NUnit [SetUpFixture], MSTest [AssemblyInitialize] or a module initializer).");
            }
            if (_judge is not null)
            {
                throw CrucibleException.Usage("Crucible.UseJudge was already called with a different judge. Call it once per test run.");
            }
            _judge = judge;
            _session = session;
            return true;
        }
    }

    private EngineSession ProviderSession()
    {
        var config = configs.Load();
        return new EngineSession(config, new ChatCompletionsClient(config), time, output);
    }

    private EngineSession ChatClientSession(IChatClient client, ChatOptions? options)
    {
        var judge = new ChatClientJudge(client, options);
        return new EngineSession(
            configs.LoadRunSettings(warnings),
            ChatClientJudge.Name,
            judge.Model,
            null,
            new JudgeStampFactory().For(ChatClientJudge.StampedProvider, null),
            judge,
            time,
            output);
    }
}
