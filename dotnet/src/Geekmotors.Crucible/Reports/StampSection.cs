using System.Globalization;
using CrucibleAI.Runs;
using CrucibleAI.Text;

namespace CrucibleAI.Reports;

internal sealed class StampSection(JudgeStamp stamp, ReportFields fields)
{
    private const string TopLevel = "";
    private const string CostFormat = "F6";

    public string Render(IReadOnlyList<RunResult> results)
    {
        var who = stamp.Model is null ? stamp.Provider : $"{stamp.Provider} \"{stamp.Model}\"";
        var spent = results.SelectMany(result => result.Usage).ToArray();
        return fields.Field("Judge", $"{who}; {Spend(spent)}", TopLevel) + "\n"
            + fields.Field(
                "Crucible", $"{stamp.Package} {stamp.Version}; schemas coherent {stamp.CoherentSchema}, extract {stamp.ExtractSchema}", TopLevel);
    }

    private static string Spend(JudgeUsage[] spent)
    {
        if (spent.Length == 0)
        {
            return "no judge responses received";
        }
        return $"{Served(spent)}, {Integer(spent.Length)} response(s), {Tokens(spent)}, {Cost(spent)}";
    }

    private static string Served(JudgeUsage[] spent)
    {
        var models = spent.Select(usage => usage.Model).OfType<string>().Distinct(StringComparer.Ordinal).ToArray();
        return models.Length == 0 ? "served model not reported" : "served as " + string.Join(", ", models.Select(model => $"\"{model}\""));
    }

    private static string Tokens(JudgeUsage[] spent)
    {
        var counts = spent.Select(usage => usage.Tokens).OfType<double>().ToArray();
        return Partial(counts.Length, spent.Length, "tokens not reported", $"{EcmaScriptNumber.Format(counts.Aggregate(0d, Add))} tokens");
    }

    private static string Cost(JudgeUsage[] spent)
    {
        var costs = spent.Select(usage => usage.Cost).OfType<double>().ToArray();
        return Partial(
            costs.Length, spent.Length, "cost not reported", "cost $" + costs.Aggregate(0d, Add).ToString(CostFormat, CultureInfo.InvariantCulture));
    }

    private static string Partial(int reported, int total, string none, string sum)
    {
        if (reported == 0)
        {
            return none;
        }
        return reported == total ? sum : $"{sum} from {Integer(reported)} of {Integer(total)} responses";
    }

    private static double Add(double sum, double value) => sum + value;

    private static string Integer(int value) => value.ToString(CultureInfo.InvariantCulture);
}
