namespace CrucibleAI.Tests.Constants;

internal static class EngineRuns
{
    public const int Single = 1;
    public const int Pair = 2;
    public const int Few = 3;
    public const int Many = 10;
    public const int FromTestDefaults = 2;
    public const double Everyone = 1;
    public const double Half = 0.5;
    public const int TestTimeoutMs = 5000;
    public const int WholeNumber = 6;
    public const int FirstRun = 1;
    public const int OneAtATime = 1;
    public const int Measured = 20;
    public static readonly TimeSpan TestTimeout = TimeSpan.FromMilliseconds(TestTimeoutMs);
    public static readonly RunOptions Smoke = new() { Runs = Single, Threshold = Everyone };
    public static readonly RunOptions AllOfFew = new() { Runs = Few, Threshold = Everyone };
    public static readonly RunOptions AllOfMany = new() { Runs = Many, Threshold = Everyone };
    public static readonly RunOptions MeasuredPair = new() { Runs = Pair, Threshold = Everyone, Measure = true };
    public static readonly RunOptions MeasuredSmoke = new() { Runs = Single, Threshold = Everyone, Measure = true };
}
