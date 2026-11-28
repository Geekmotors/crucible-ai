using System.Runtime.CompilerServices;
using CrucibleAI.Xunit;
using Xunit;
using Xunit.v3;

namespace CrucibleAI;

/// <summary>
/// Marks a test method that Crucible runs <see cref="Runs"/> times (at once unless <see cref="Sequential"/>), each run on its
/// own test-class instance, passing when at least <see cref="Threshold"/> of the runs pass. Use it in place of
/// <c>[Fact]</c>; the method reaches its run through <see cref="Crucible.Facts(string[])"/>,
/// <see cref="Crucible.CoherentAsync"/>, <see cref="Crucible.ExtractAsync{T}"/> and <see cref="Crucible.Context"/>.
/// A setting left out here comes from the class or assembly <see cref="CrucibleAttribute"/>, then the config file's
/// <c>testDefaults</c>, then the built-in default. xUnit's own settings (<c>Skip</c>, <c>Explicit</c>, <c>Timeout</c>, ...)
/// keep their xUnit meaning.
/// </summary>
/// <param name="sourceFilePath">Filled in by the compiler.</param>
/// <param name="sourceLineNumber">Filled in by the compiler.</param>
[XunitTestCaseDiscoverer(typeof(CrucibleFactDiscoverer))]
[AttributeUsage(AttributeTargets.Method, AllowMultiple = false)]
public sealed class CrucibleFactAttribute(
    [CallerFilePath] string? sourceFilePath = null,
    [CallerLineNumber] int sourceLineNumber = -1) : FactAttribute(sourceFilePath, sourceLineNumber), ICrucibleSettings
{
    private readonly CrucibleSettings _settings = new();

    /// <summary>How many times the test runs, each run on its own test-class instance. At least 1. Reads 0 when not set here (inherited).</summary>
    public int Runs { get => _settings.Runs ?? 0; set => _settings.Runs = value; }

    /// <summary>The share of runs that must pass, greater than 0 and at most 1. Reads 0 when not set here (inherited).</summary>
    public double Threshold { get => _settings.Threshold ?? 0; set => _settings.Threshold = value; }

    /// <summary>Milliseconds each judge reply may take. Reads 0 when not set here (inherited).</summary>
    public int InferenceTimeout { get => _settings.InferenceTimeout ?? 0; set => _settings.InferenceTimeout = value; }

    /// <summary>
    /// Milliseconds the whole test (every run) may take; Crucible's deadline, separate from xUnit's <c>Timeout</c>.
    /// Reads 0 when not set here (inherited).
    /// </summary>
    public int TestTimeout { get => _settings.TestTimeout ?? 0; set => _settings.TestTimeout = value; }

    /// <summary>Whether extract calls use the strict mode unless the call says otherwise. Reads false when not set here (inherited).</summary>
    public bool Strict { get => _settings.Strict ?? false; set => _settings.Strict = value; }

    /// <summary>
    /// Whether the test is measured instead of gated: it never fails on its pass rate and writes its pass rate, likely range
    /// and a suggested gate to the test output. <c>CRUCIBLE_MODE=measure</c> measures every test. Reads false when not set
    /// here (inherited).
    /// </summary>
    public bool Measure { get => _settings.Measure ?? false; set => _settings.Measure = value; }

    /// <summary>Whether the runs execute one after another instead of all at once. Reads false when not set here (inherited).</summary>
    public bool Sequential { get => _settings.Sequential ?? false; set => _settings.Sequential = value; }

    CrucibleSettings ICrucibleSettings.Settings => _settings;
}
