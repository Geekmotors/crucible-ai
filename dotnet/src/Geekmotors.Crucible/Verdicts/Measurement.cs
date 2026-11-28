namespace CrucibleAI.Verdicts;

internal sealed record Measurement(
    int Passed,
    int Failed,
    int Errored,
    int Settled,
    double Rate,
    LikelyRange Range,
    int Need,
    bool MeetsTarget,
    SuggestedGate? Suggestion,
    SuggestedGate? Sharper)
{
    public bool NothingSettled => Settled == 0;
}
