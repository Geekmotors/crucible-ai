namespace CrucibleAI.Options;

internal sealed class RunOptionsResolver
{
    private const int DefaultRuns = 10;
    private const double DefaultThreshold = 0.9;
    private const int DefaultInferenceTimeout = 30000;
    private const bool DefaultStrict = false;
    private const bool DefaultMeasure = false;
    private const long TestTimeoutBase = 30000;
    private const long TestTimeoutPerExtraRun = 1000;

    public ResolvedRunOptions Resolve(IEnumerable<RunOptions> layersOuterToInner, Invocation? invocation = null)
    {
        var invoked = invocation ?? Invocation.Gating;
        var declared = layersOuterToInner.Aggregate(new RunOptions(), Nearer);
        var runs = declared.Runs ?? DefaultRuns;
        var gating = new ResolvedRunOptions(
            runs,
            declared.Threshold ?? DefaultThreshold,
            declared.InferenceTimeout ?? DefaultInferenceTimeout,
            declared.TestTimeout ?? TestTimeoutFor(runs),
            declared.Strict ?? DefaultStrict);
        if (!invoked.Measure && !(declared.Measure ?? DefaultMeasure))
        {
            return gating;
        }
        var measureRuns = invoked.MeasureRuns ?? runs;
        var measuredTimeout = TestTimeoutFor(measureRuns);
        return gating with
        {
            TestTimeout = Math.Max(declared.TestTimeout ?? measuredTimeout, measuredTimeout),
            Measure = true,
            MeasureRuns = measureRuns,
        };
    }

    private static RunOptions Nearer(RunOptions outer, RunOptions inner) => new()
    {
        Runs = inner.Runs ?? outer.Runs,
        Threshold = inner.Threshold ?? outer.Threshold,
        InferenceTimeout = inner.InferenceTimeout ?? outer.InferenceTimeout,
        TestTimeout = inner.TestTimeout ?? outer.TestTimeout,
        Strict = inner.Strict ?? outer.Strict,
        Measure = inner.Measure ?? outer.Measure,
    };

    private static int TestTimeoutFor(int runs) =>
        (int)Math.Min(int.MaxValue, TestTimeoutBase + ((runs - 1L) * TestTimeoutPerExtraRun));
}
