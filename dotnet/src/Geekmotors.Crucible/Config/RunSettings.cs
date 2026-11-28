using System.Text.Json.Nodes;
using CrucibleAI.Options;

namespace CrucibleAI.Config;

internal sealed record RunSettings(
    Verbosity Verbosity,
    RunOptions TestDefaults,
    JsonObject TestDefaultsNode,
    int ExcerptChars,
    Invocation Invocation);
