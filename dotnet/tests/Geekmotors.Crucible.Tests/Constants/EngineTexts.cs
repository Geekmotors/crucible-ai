namespace CrucibleAI.Tests.Constants;

internal static class EngineTexts
{
    public const string Config = """{ "provider": "openrouter", "model": "judge-model" }""";
    public const string ConfigWithTestDefaults =
        """{ "provider": "openrouter", "model": "judge-model", "testDefaults": { "strict": true, "runs": 2 } }""";
    public const string TraceTestDefaults = """testDefaults {"strict":true,"runs":2}""";
    public const string BrokenConfig = """{ "provider": "openrouter" }""";
    public const string VerbosityVariable = "CRUCIBLE_VERBOSE";
    public const string Full = "full";
    public const string Debug = "debug";
    public const string FactFormat = "Fact of run #{0}.";
    public const string GateFactFormat = "Fact of gate {0}, run #{1}.";
    public const string LateFact = "Fact written by a run that has ended.";
    public const string Response = "The meeting is at six.";
    public const string Claim = "The reply names a time";
    public const string Target = "the facts the judge received";
    public const string PassedHeadline = "PASSED:";
    public const string MeasuredHeadline = "MEASURED: ";
    public const string ModeVariable = "CRUCIBLE_MODE";
    public const string MeasureRunsVariable = "CRUCIBLE_MEASURE_RUNS";
    public const string Measure = "measure";
    public const string TwentyRuns = "20";
    public const string MeasuredTestName = "Story.Narrator.KeepsTheMeetingPlaceSecret";
    public const string ExpiredMarker = "deadline";
    public const string AbortedMarker = "aborted on a fatal error";
    public const string ProviderRetryLine = "provider attempt 1 failed (retryable, retrying in 0 ms)";
    public const string JudgeRecordedLine = "judge verdict true for coherent";
    public const string RunTag = "run #1 ";
    public const string Problem = "the system under test misbehaved";
    public const int ServerError = 500;
    public const string FirstGate = "A";
    public const string SecondGate = "B";
}
