using System.Text.Json.Nodes;
using CrucibleAI.Options;
using CrucibleAI.Urls;

namespace CrucibleAI.Config;

internal sealed record JudgeConfig(
    ProviderKind Provider,
    string Model,
    JsonObject? Meta,
    Verbosity Verbosity,
    RunOptions TestDefaults,
    JsonObject TestDefaultsNode,
    int ExcerptChars,
    HttpUrl? BaseUrl,
    string? ApiKeyEnv,
    Invocation Invocation)
{
    public RunSettings Run => new(Verbosity, TestDefaults, TestDefaultsNode, ExcerptChars, Invocation);
}
