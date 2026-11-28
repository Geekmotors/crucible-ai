namespace CrucibleAI.Options;

internal sealed record ResolvedRunOptions(
    int Runs,
    double Threshold,
    int InferenceTimeout,
    int TestTimeout,
    bool Strict,
    bool Measure = false,
    int? MeasureRuns = null)
{
    public int ExecutedRuns => MeasureRuns ?? Runs;

    public ResolvedRunOptions ForCall(bool? strict) => strict is { } callStrict ? this with { Strict = callStrict } : this;
}
