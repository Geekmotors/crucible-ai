using System.Globalization;
using System.Text.Json;
using System.Text.Json.Nodes;

namespace CrucibleAI.Options;

internal sealed class RunOptionsReader(RunOptionsValidator validator)
{
    private const string RunsKey = "runs";
    private const string ThresholdKey = "threshold";
    private const string InferenceTimeoutKey = "inferenceTimeout";
    private const string TestTimeoutKey = "testTimeout";
    private const string StrictKey = "strict";
    private const string MeasureKey = "measure";

    private static readonly string[] KnownKeys = [RunsKey, ThresholdKey, InferenceTimeoutKey, TestTimeoutKey, StrictKey, MeasureKey];

    public RunOptions Read(JsonNode? options, RunOptionsSource source)
    {
        if (options is not JsonObject members)
        {
            throw validator.Rejection(source, "Run options must be an object.");
        }
        if (members.Select(member => member.Key).FirstOrDefault(key => !KnownKeys.Contains(key)) is { } unknown)
        {
            throw validator.Rejection(source, $"Unknown option \"{unknown}\". Supported options: {string.Join(", ", KnownKeys)}.");
        }
        var read = new RunOptions
        {
            Runs = Whole(members, RunsKey, source),
            Threshold = Number(members, ThresholdKey, source),
            InferenceTimeout = Whole(members, InferenceTimeoutKey, source),
            TestTimeout = Whole(members, TestTimeoutKey, source),
            Strict = Flag(members, StrictKey, source),
            Measure = Flag(members, MeasureKey, source),
        };
        return validator.Validate(read, source);
    }

    private int? Whole(JsonObject members, string key, RunOptionsSource source)
    {
        var number = Number(members, key, source);
        if (number is not { } value)
        {
            return null;
        }
        if (Math.Floor(value) != value || value < int.MinValue || value > int.MaxValue)
        {
            throw validator.Rejection(source, $"\"{key}\" must be an integer.");
        }
        return (int)value;
    }

    private double? Number(JsonObject members, string key, RunOptionsSource source)
    {
        if (!members.TryGetPropertyValue(key, out var node))
        {
            return null;
        }
        return ReadNumber(node) ?? throw validator.Rejection(source, $"\"{key}\" must be a number.");
    }

    private bool? Flag(JsonObject members, string key, RunOptionsSource source)
    {
        if (!members.TryGetPropertyValue(key, out var node))
        {
            return null;
        }
        return ReadFlag(node) ?? throw validator.Rejection(source, $"\"{key}\" must be true or false.");
    }

    private static bool? ReadFlag(JsonNode? node)
    {
        if (node is not JsonValue value)
        {
            return null;
        }
        if (value.TryGetValue<JsonElement>(out var element))
        {
            return element.ValueKind is JsonValueKind.True or JsonValueKind.False ? element.GetBoolean() : null;
        }
        return value.GetValue<object>() is bool flag ? flag : null;
    }

    private static double? ReadNumber(JsonNode? node)
    {
        if (node is not JsonValue value)
        {
            return null;
        }
        if (value.TryGetValue<JsonElement>(out var element))
        {
            return element.ValueKind == JsonValueKind.Number && element.TryGetDouble(out var parsed) ? parsed : null;
        }
        return value.GetValue<object>() is IConvertible convertible && IsNumeric(convertible.GetTypeCode())
            ? convertible.ToDouble(CultureInfo.InvariantCulture)
            : null;
    }

    private static bool IsNumeric(TypeCode code) => code is >= TypeCode.SByte and <= TypeCode.Decimal;
}
