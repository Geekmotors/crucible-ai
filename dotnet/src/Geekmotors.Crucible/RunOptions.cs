namespace CrucibleAI;

/// <summary>
/// The run options of a test, a group of tests or the config file's <c>testDefaults</c>.
/// Each option left <see langword="null"/> is not declared here and resolves from the next layer out:
/// built-in, then <c>testDefaults</c>, then groups outer to inner, then the test.
/// </summary>
public sealed record RunOptions
{
    /// <summary>How many times the test body runs. An integer of at least 1. Built-in: 10.</summary>
    public int? Runs { get; init; }

    /// <summary>The share of runs that must pass, greater than 0 and at most 1. Built-in: 0.9.</summary>
    public double? Threshold { get; init; }

    /// <summary>Milliseconds each judge reply may take, from 1 to 2147483647. Built-in: 30000.</summary>
    public int? InferenceTimeout { get; init; }

    /// <summary>
    /// Milliseconds the whole test may take, from 1 to 2147483647.
    /// Built-in: 30000 + 1000 × (runs − 1), at most 2147483647, unless any layer declares one.
    /// </summary>
    public int? TestTimeout { get; init; }

    /// <summary>Whether extract calls use the strict mode unless the call says otherwise. Built-in: false.</summary>
    public bool? Strict { get; init; }

    /// <summary>
    /// Whether the test is measured instead of gated: it never fails on its pass rate and reports the rate, its likely range
    /// and a suggested gate. <c>CRUCIBLE_MODE=measure</c> measures every test; <c>CRUCIBLE_MEASURE_RUNS</c> sets the runs a
    /// measured test executes. Built-in: false.
    /// </summary>
    public bool? Measure { get; init; }
}
