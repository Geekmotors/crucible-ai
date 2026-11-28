namespace CrucibleAI.Verdicts;

internal sealed record SuggestedGate(int Runs, int Need, double Threshold, double? Drop, int? Caught);
