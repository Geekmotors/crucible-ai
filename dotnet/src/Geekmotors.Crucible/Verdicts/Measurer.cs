using CrucibleAI.Runs;

namespace CrucibleAI.Verdicts;

internal sealed class Measurer
{
    public const int SharperRuns = 50;

    private const double RangeTail = 0.025;
    private const double PlanningTail = 0.2;
    private const double FalseRed = 0.05;
    private const double Drop = 0.1;
    private const double Epsilon = 1e-9;
    private const int MinimumDecimals = 2;
    private const int RateDecimals = 3;

    public Measurement Measure(IReadOnlyCollection<RunStatus> statuses, double threshold, int gateRuns)
    {
        var passed = statuses.Count(status => status == RunStatus.Passed);
        var failed = statuses.Count(status => status == RunStatus.Failed);
        var errored = statuses.Count(status => status == RunStatus.Errored);
        var settled = passed + failed;
        if (settled == 0)
        {
            return new Measurement(passed, failed, errored, 0, 0, new LikelyRange(0, 0), 0, false, null, null);
        }
        var need = NeedFor(threshold, settled);
        var planning = PlanningRate(passed, settled);
        return new Measurement(
            passed,
            failed,
            errored,
            settled,
            Rate(passed, settled),
            Range(passed, settled),
            need,
            passed >= need,
            Gate(planning, gateRuns, passed, settled),
            gateRuns < SharperRuns ? Gate(planning, SharperRuns, passed, settled) : null);
    }

    public LikelyRange Range(int passed, int settled)
    {
        var low = passed == 0 ? 0 : Binomial.Rising(p => Binomial.AtLeast(passed, settled, p), RangeTail);
        var high = passed == settled ? 1 : Binomial.Falling(p => Binomial.AtMost(passed, settled, p), RangeTail);
        return new LikelyRange(Math.Floor(low * 100) / 100, Math.Ceiling(high * 100) / 100);
    }

    public IReadOnlyList<AssertionCount> ByAssertion(IEnumerable<RunResult> runs)
    {
        var order = new List<string>();
        var counts = new Dictionary<string, (int Passed, int Evaluated)>(StringComparer.Ordinal);
        foreach (var run in runs.Where(run => run.Status is RunStatus.Passed or RunStatus.Failed))
        {
            foreach (var verdict in run.Calls.OfType<VerdictCall>())
            {
                if (!counts.TryGetValue(verdict.Claim, out var count))
                {
                    order.Add(verdict.Claim);
                }
                counts[verdict.Claim] = (count.Passed + (verdict.Verdict ? 1 : 0), count.Evaluated + 1);
            }
        }
        return order.Select(claim => new AssertionCount(claim, counts[claim].Passed, counts[claim].Evaluated)).ToArray();
    }

    public static double Rate(int passed, int settled) => FloorTo((double)passed / settled, RateDecimals);

    private static SuggestedGate? Gate(double planning, int runs, int passed, int settled)
    {
        var need = LargestSafeNeed(planning, runs);
        if (need == 0)
        {
            return null;
        }
        var drop = FloorTo(((double)passed / settled) - Drop, RateDecimals);
        if (drop <= 0)
        {
            return new SuggestedGate(runs, need, ThresholdFor(need, runs), null, null);
        }
        var caught = (int)Math.Floor((Binomial.Below(need, runs, drop) * 100) + 0.5);
        return new SuggestedGate(runs, need, ThresholdFor(need, runs), drop, caught);
    }

    private static int LargestSafeNeed(double planning, int runs)
    {
        var need = 0;
        while (need < runs && Binomial.Below(need + 1, runs, planning) <= FalseRed)
        {
            need++;
        }
        return need;
    }

    private static double ThresholdFor(int need, int runs)
    {
        for (var decimals = MinimumDecimals; ; decimals++)
        {
            var threshold = FloorTo((double)need / runs, decimals);
            if (NeedFor(threshold, runs) == need)
            {
                return threshold;
            }
        }
    }

    private static double PlanningRate(int passed, int settled) =>
        passed == 0 ? 0 : Binomial.Rising(p => Binomial.AtLeast(passed, settled, p), PlanningTail);

    private static int NeedFor(double threshold, int runs)
    {
        double product = threshold * runs;
        double lowered = product - Epsilon;
        return Math.Max(1, (int)Math.Ceiling(lowered));
    }

    private static double FloorTo(double value, int decimals)
    {
        var scale = Math.Pow(10, decimals);
        double scaled = value * scale;
        double nudged = scaled + Epsilon;
        return Math.Floor(nudged) / scale;
    }
}
