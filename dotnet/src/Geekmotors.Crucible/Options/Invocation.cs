namespace CrucibleAI.Options;

internal sealed record Invocation(bool Measure, int? MeasureRuns)
{
    public static Invocation Gating { get; } = new(false, null);
}
