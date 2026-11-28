using CrucibleAI.Xunit;

namespace CrucibleAI;

/// <summary>
/// Default Crucible settings for every <see cref="CrucibleFactAttribute"/> and <see cref="CrucibleTheoryAttribute"/> test in
/// an assembly or a class (its nested classes and derived classes included). Nearest wins: the method attribute, then the
/// class (inner before outer, derived before base), then the assembly, then the config file's <c>testDefaults</c>.
/// </summary>
[AttributeUsage(AttributeTargets.Assembly | AttributeTargets.Class, AllowMultiple = false, Inherited = true)]
public sealed class CrucibleAttribute : Attribute, ICrucibleSettings
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
