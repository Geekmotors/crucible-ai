using System.Text.Json;
using System.Text.Json.Nodes;
using CrucibleAI.Config;
using CrucibleAI.Judging;
using CrucibleAI.Runs;
using CrucibleAI.Verdicts;

namespace CrucibleAI.Tests.Harnesses;

internal static class RunRecordJson
{
    private static readonly Dictionary<string, RunStatus> Statuses = new(StringComparer.Ordinal)
    {
        ["passed"] = RunStatus.Passed,
        ["failed"] = RunStatus.Failed,
        ["errored"] = RunStatus.Errored,
        ["discarded"] = RunStatus.Discarded,
    };

    private static readonly Dictionary<string, ExtractType> Types = new(StringComparer.Ordinal)
    {
        ["string"] = ExtractType.String,
        ["number"] = ExtractType.Number,
        ["boolean"] = ExtractType.Boolean,
    };

    private static readonly Dictionary<string, Verbosity> Levels = new(StringComparer.Ordinal)
    {
        ["default"] = Verbosity.Default,
        ["full"] = Verbosity.Full,
        ["debug"] = Verbosity.Debug,
    };

    public static Verbosity Level(JsonNode? level) => Levels[level!.GetValue<string>()];

    public static RunStatus Status(JsonNode? status) => Statuses[status!.GetValue<string>()];

    public static RunCause? Cause(JsonNode? cause) =>
        cause is null ? null : new RunCause(cause["name"]!.GetValue<string>(), cause["message"]!.GetValue<string>());

    public static RunResult Result(JsonNode? result) =>
        new(
            Status(result!["status"]),
            Cause(result["cause"]),
            (result["calls"]?.AsArray() ?? []).Select(Call).ToArray(),
            (result["usage"]?.AsArray() ?? []).Select(Usage).ToArray());

    public static JudgeUsage Usage(JsonNode? usage) =>
        new(usage!["model"]?.GetValue<string>(), usage["tokens"]?.GetValue<double>(), usage["cost"]?.GetValue<double>());

    public static JsonObject Json(JudgeUsage usage)
    {
        var members = new JsonObject();
        if (usage.Model is { } model)
        {
            members["model"] = model;
        }
        if (usage.Tokens is { } tokens)
        {
            members["tokens"] = tokens;
        }
        if (usage.Cost is { } cost)
        {
            members["cost"] = cost;
        }
        return members;
    }

    public static JudgeCall Call(JsonNode? call)
    {
        if (call!["verdict"] is JsonObject verdict)
        {
            return new VerdictCall(
                Text(verdict, "claim"), verdict["verdict"]!.GetValue<bool>(), Text(verdict, "reasoning"), Text(verdict, "response"), Facts(verdict));
        }
        if (call["extraction"] is JsonObject extraction)
        {
            return new ExtractionCall(
                Text(extraction, "description"),
                Types[Text(extraction, "type")],
                Text(extraction, "mode") == "strict" ? ExtractMode.Strict : ExtractMode.Lenient,
                Value(extraction["value"]),
                Text(extraction, "reasoning"),
                Text(extraction, "response"),
                Facts(extraction));
        }
        var error = call["error"]!;
        return new ErroredCall(Cause(error["cause"])!, error["attempts"]!.GetValue<int>());
    }

    private static string Text(JsonObject members, string key) => members[key]!.GetValue<string>();

    private static IReadOnlyList<string> Facts(JsonObject members) => CallArguments.Strings(members["facts"]) ?? [];

    private static object? Value(JsonNode? value) => value?.GetValueKind() switch
    {
        null or JsonValueKind.Null => null,
        JsonValueKind.String => value.GetValue<string>(),
        JsonValueKind.Number => value.GetValue<double>(),
        _ => value.GetValue<bool>(),
    };
}
