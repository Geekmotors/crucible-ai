using System.Text.Json.Nodes;
using CrucibleAI.Options;

namespace CrucibleAI.Tests.Harnesses;

internal static class RunOptionsJson
{
    public static JsonObject Of(RunOptions options)
    {
        var json = new JsonObject();
        if (options.Runs is { } runs)
        {
            json["runs"] = runs;
        }
        if (options.Threshold is { } threshold)
        {
            json["threshold"] = threshold;
        }
        if (options.InferenceTimeout is { } inferenceTimeout)
        {
            json["inferenceTimeout"] = inferenceTimeout;
        }
        if (options.TestTimeout is { } testTimeout)
        {
            json["testTimeout"] = testTimeout;
        }
        if (options.Strict is { } strict)
        {
            json["strict"] = strict;
        }
        if (options.Measure is { } measure)
        {
            json["measure"] = measure;
        }
        return json;
    }

    public static JsonObject Of(ResolvedRunOptions options)
    {
        var json = new JsonObject
        {
            ["runs"] = options.Runs,
            ["threshold"] = options.Threshold,
            ["inferenceTimeout"] = options.InferenceTimeout,
            ["testTimeout"] = options.TestTimeout,
            ["strict"] = options.Strict,
            ["measure"] = options.Measure,
        };
        if (options.MeasureRuns is { } measureRuns)
        {
            json["measureRuns"] = measureRuns;
        }
        return json;
    }
}
