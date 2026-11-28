namespace CrucibleAI.Xunit;

internal sealed class CrucibleSettings
{
    public int? Runs { get; set; }

    public double? Threshold { get; set; }

    public int? InferenceTimeout { get; set; }

    public int? TestTimeout { get; set; }

    public bool? Strict { get; set; }

    public bool? Measure { get; set; }

    public bool? Sequential { get; set; }

    public RunOptions Options => new()
    {
        Runs = Runs,
        Threshold = Threshold,
        InferenceTimeout = InferenceTimeout,
        TestTimeout = TestTimeout,
        Strict = Strict,
        Measure = Measure,
    };
}
