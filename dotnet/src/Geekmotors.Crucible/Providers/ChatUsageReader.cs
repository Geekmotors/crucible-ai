using System.Text.Json;
using System.Text.Json.Nodes;
using CrucibleAI.Runs;

namespace CrucibleAI.Providers;

internal sealed class ChatUsageReader
{
    public JudgeUsage Read(JsonNode? body)
    {
        if (body is not JsonObject root)
        {
            return new JudgeUsage(null, null, null);
        }
        var usage = root["usage"] as JsonObject;
        return new JudgeUsage(Model(root["model"]), Tokens(usage), Cost(usage?["cost"]));
    }

    private static string? Model(JsonNode? model) =>
        model is JsonValue value && value.GetValueKind() == JsonValueKind.String && value.GetValue<string>() is { Length: > 0 } name
            ? name
            : null;

    private static double? Tokens(JsonObject? usage)
    {
        if (Count(usage?["total_tokens"]) is { } total)
        {
            return total;
        }
        return Count(usage?["prompt_tokens"]) is { } prompt && Count(usage?["completion_tokens"]) is { } completion
            ? prompt + completion
            : null;
    }

    private static double? Count(JsonNode? node) => Number(node) is { } count && double.IsInteger(count) && count >= 0 ? count : null;

    private static double? Cost(JsonNode? node) => Number(node) is { } cost && double.IsFinite(cost) && cost >= 0 ? cost : null;

    private static double? Number(JsonNode? node) =>
        node is JsonValue value && value.GetValueKind() == JsonValueKind.Number && value.TryGetValue<double>(out var number) ? number : null;
}
