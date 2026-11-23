using System.Text.Json.Nodes;
using CrucibleAI.Reports;
using CrucibleAI.Runs;

namespace CrucibleAI.Tests.Harnesses;

internal static class ReportFixtureHarness
{
    public static JsonNode? Render(JsonNode? input)
    {
        var settings = input!["settings"]!;
        var renderer = new ReportRenderer(
            new ReportSettings(settings["excerptChars"]!.GetValue<int>(), RunRecordJson.Level(settings["verbosity"]), Stamp(input["stamp"])));
        var test = new TestRecord(
            input["runs"]!.GetValue<int>(),
            input["threshold"]!.GetValue<double>(),
            Ending(input["ending"]!),
            input["results"]!.AsArray().Select(RunRecordJson.Result).ToArray());
        return renderer.Render(test);
    }

    private static JudgeStamp? Stamp(JsonNode? stamp) =>
        stamp is null
            ? null
            : new JudgeStamp(
                stamp["package"]!.GetValue<string>(),
                stamp["version"]!.GetValue<string>(),
                stamp["provider"]!.GetValue<string>(),
                stamp["model"]?.GetValue<string>(),
                stamp["schemas"]!["coherent"]!.GetValue<string>(),
                stamp["schemas"]!["extract"]!.GetValue<string>());

    private static TestEnding Ending(JsonNode ending) => ending["kind"]!.GetValue<string>() switch
    {
        "aborted" => new AbortedEnding(ending["fatalRun"]!.GetValue<int>()),
        "expired" => new ExpiredEnding(ending["deadlineMs"]!.GetValue<long>()),
        _ => new VerdictEnding(),
    };
}
