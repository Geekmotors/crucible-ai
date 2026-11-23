using CrucibleAI.Config;
using CrucibleAI.Engine;
using CrucibleAI.Tests.Constants;
using CrucibleAI.Tests.Fakes;
using Microsoft.Extensions.AI;
using Microsoft.Extensions.Caching.Distributed;
using Microsoft.Extensions.Caching.Memory;
using OptionsFactory = Microsoft.Extensions.Options.Options;

namespace CrucibleAI.Tests.Harnesses;

internal sealed class EngineHostHarness
{
    public EngineHostHarness(string? configText = null)
    {
        var files = new FakeConfigFileSystem();
        if (configText is not null)
        {
            files.WithFile(ConfigPaths.JsonPath, configText);
        }
        var loader = new ConfigLoader(new ConfigFileLocator(files, () => ConfigPaths.ProjectDirectory), new FakeEnvironment());
        Host = new EngineHost(loader, Warnings, Output, new ManualTimeProvider());
    }

    public RecordingWarningSink Warnings { get; } = new();

    public RecordingTraceOutput Output { get; } = new();

    public EngineHost Host { get; }

    public Task GateAsync() =>
        Host.Engine.GateAsync(
            new RunOptions { Runs = 1, Threshold = 1 },
            async context =>
            {
                if (!await context.CoherentAsync(EngineTexts.Response, EngineTexts.Claim))
                {
                    throw new InvalidOperationException(EngineTexts.Problem);
                }
            },
            TestContext.Current.CancellationToken);

    public Task JudgedThenFailingGateAsync() =>
        Host.Engine.GateAsync(
            new RunOptions { Runs = 1, Threshold = 1 },
            async context =>
            {
                await context.CoherentAsync(EngineTexts.Response, EngineTexts.Claim);
                throw new InvalidOperationException(EngineTexts.Problem);
            },
            TestContext.Current.CancellationToken);

    public static IChatClient Caching(IChatClient inner) =>
        new ChatClientBuilder(inner)
            .ConfigureOptions(_ => { })
            .UseDistributedCache(new MemoryDistributedCache(OptionsFactory.Create(new MemoryDistributedCacheOptions())))
            .Build();
}
