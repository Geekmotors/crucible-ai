using System.Globalization;
using CrucibleAI.Text;
using CrucibleAI.Verdicts;

namespace CrucibleAI.Reports;

internal sealed class MeasuredReport
{
    private const int WideRangeBelow = 30;
    private const int NoneCaught = 0;
    private const int AllCaught = 100;
    private const char EnDash = (char)0x2013;

    private readonly Measurer _measurer = new();

    public string Headline(Measurement measurement, double threshold, MeasuredTest test, string countsLine)
    {
        var named = test.Name is null ? string.Empty : test.Name + ": ";
        if (measurement.NothingSettled)
        {
            return $"ERRORED, not failed: {named}no run settled as passed or failed, so there is nothing to measure.\n{countsLine}";
        }
        var lines = new List<string>
        {
            $"MEASURED: {named}{Integer(measurement.Passed)} of {Integer(measurement.Settled)} settled runs passed "
                + $"(pass rate {Number(measurement.Rate)}, likely {RangeText(measurement.Range)}); "
                + $"threshold {Number(threshold)} not enforced, {(measurement.MeetsTarget ? "meets" : "below")} target.",
            countsLine,
            SuggestionLine(measurement.Suggestion, test.GateRuns),
        };
        if (measurement.Sharper is { } sharper)
        {
            lines.Add(SharperLine(sharper));
        }
        if (measurement.Settled < WideRangeBelow)
        {
            lines.Add(
                $"Measured with only {Integer(measurement.Settled)} settled run(s); the range is wide. "
                + "Set CRUCIBLE_MEASURE_RUNS=50 for a firmer suggestion.");
        }
        return string.Join('\n', lines);
    }

    public IEnumerable<string> Breakdown(IReadOnlyList<AssertionCount> counts)
    {
        if (counts.Count < 2)
        {
            return [];
        }
        return [string.Join('\n', counts.Select(AssertionLine).Prepend("By assertion:"))];
    }

    private string AssertionLine(AssertionCount count)
    {
        var label = TextFormat.Indented($"coherent \"{count.Claim}\"", ReportFields.Nested);
        var line = $"{ReportFields.Indent}{label}: {Integer(count.Passed)} of {Integer(count.Evaluated)} passed";
        if (count.Passed == count.Evaluated)
        {
            return line;
        }
        var range = _measurer.Range(count.Passed, count.Evaluated);
        return $"{line} (pass rate {Number(Measurer.Rate(count.Passed, count.Evaluated))}, likely {RangeText(range)})";
    }

    private static string SuggestionLine(SuggestedGate? suggestion, int gateRuns)
    {
        if (suggestion is null)
        {
            return $"No useful gate at runs {Integer(gateRuns)}: even needing 1 of {Integer(gateRuns)} would fail an unchanged system "
                + "on over 5% of builds. Raise runs, or measure with more runs.";
        }
        var gate = $"Suggested gate: runs {Integer(suggestion.Runs)}, threshold {Number(suggestion.Threshold)}. "
            + "An unchanged system fails it on under 5% of builds";
        return suggestion.Drop is { } drop ? $"{gate}; a drop to {Number(drop)} fails it on {Caught(suggestion)}." : gate + ".";
    }

    private static string SharperLine(SuggestedGate sharper)
    {
        var gate = $"Sharper gate: runs {Integer(sharper.Runs)}, threshold {Number(sharper.Threshold)}.";
        return sharper.Drop is { } drop ? $"{gate} A drop to {Number(drop)} fails it on {Caught(sharper)}." : gate;
    }

    private static string Caught(SuggestedGate gate) => gate.Caught switch
    {
        NoneCaught => "under 1%",
        AllCaught => "over 99%",
        var caught => Integer(caught ?? 0) + "%",
    };

    private static string RangeText(LikelyRange range) => $"{Number(range.Low)}{EnDash}{Number(range.High)}";

    private static string Number(double value) => EcmaScriptNumber.Format(value);

    private static string Integer(long value) => value.ToString(CultureInfo.InvariantCulture);
}
