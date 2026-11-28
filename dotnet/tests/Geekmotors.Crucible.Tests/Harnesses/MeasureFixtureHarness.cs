using System.Text.Json.Nodes;
using CrucibleAI.Runs;
using CrucibleAI.Verdicts;

namespace CrucibleAI.Tests.Harnesses;

internal static class MeasureFixtureHarness
{
    private static readonly Measurer Measurer = new();

    private static readonly Dictionary<string, RunStatus> Statuses = new(StringComparer.Ordinal)
    {
        ["passed"] = RunStatus.Passed,
        ["failed"] = RunStatus.Failed,
        ["errored"] = RunStatus.Errored,
        ["discarded"] = RunStatus.Discarded,
    };

    public static JsonNode? Measure(JsonNode? input)
    {
        var statuses = input!["statuses"]!.AsObject()
            .SelectMany(entry => Enumerable.Repeat(Statuses[entry.Key], entry.Value!.GetValue<int>()))
            .ToList();
        var measurement = Measurer.Measure(statuses, input["threshold"]!.GetValue<double>(), input["gateRuns"]!.GetValue<int>());
        var counts = new JsonObject
        {
            ["passed"] = measurement.Passed,
            ["failed"] = measurement.Failed,
            ["errored"] = measurement.Errored,
            ["settled"] = measurement.Settled,
        };
        if (measurement.NothingSettled)
        {
            counts["outcome"] = "errored";
            return counts;
        }
        counts["outcome"] = "measured";
        counts["rate"] = measurement.Rate;
        counts["low"] = measurement.Range.Low;
        counts["high"] = measurement.Range.High;
        counts["need"] = measurement.Need;
        counts["meetsTarget"] = measurement.MeetsTarget;
        counts["suggestion"] = Gate(measurement.Suggestion);
        counts["sharper"] = Gate(measurement.Sharper);
        return counts;
    }

    public static JsonNode? ByAssertion(JsonNode? input)
    {
        var runs = input!["results"]!.AsArray().Select(run => new RunResult(
            Statuses[run!["status"]!.GetValue<string>()],
            null,
            (run["verdicts"]?.AsArray() ?? []).Select(verdict => (JudgeCall)new VerdictCall(
                verdict!["claim"]!.GetValue<string>(), verdict["verdict"]!.GetValue<bool>(), string.Empty, string.Empty, [])).ToArray(),
            []));
        return new JsonArray(Measurer.ByAssertion(runs).Select(count => (JsonNode)new JsonObject
        {
            ["claim"] = count.Claim,
            ["passed"] = count.Passed,
            ["evaluated"] = count.Evaluated,
        }).ToArray());
    }

    private static JsonObject? Gate(SuggestedGate? gate)
    {
        if (gate is null)
        {
            return null;
        }
        var json = new JsonObject { ["runs"] = gate.Runs, ["need"] = gate.Need, ["threshold"] = gate.Threshold };
        if (gate.Drop is { } drop)
        {
            json["drop"] = drop;
            json["caught"] = gate.Caught;
        }
        return json;
    }
}
