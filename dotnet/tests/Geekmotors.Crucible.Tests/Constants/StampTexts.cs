namespace CrucibleAI.Tests.Constants;

internal static class StampTexts
{
    public const string ConfiguredJudgeWithoutResponses = "\n\nJudge: openrouter \"judge-model\"; no judge responses received\n";
    public const string ServedModel = "served-judge-model";
    public const string UnusableReply = "not a verdict";
    public const int FirstTokens = 10;
    public const int SecondTokens = 20;
    public const double FirstCost = 0.001;
    public const double SecondCost = 0.002;
    public const string TwoServedResponses =
        "\n\nJudge: openrouter \"judge-model\"; served as \"served-judge-model\", 2 response(s), 30 tokens, cost $0.003000\n";
    public const string CrucibleLineFormat = "\nCrucible: Geekmotors.Crucible {0}; schemas coherent {1}, extract {2}";
    public const string CoherentSchemaFile = "coherent.md";
    public const string ExtractSchemaFile = "extract.md";
    public const string SpecMetadataKey = "CrucibleSpec";
    public const string SpecMetadataPrefix = "dotnet-v";
    public const int ChatClientTotalTokens = 7;
    public const int ChatClientInputTokens = 3;
    public const int ChatClientOutputTokens = 4;
    public const string ChatClientServedWithTokens =
        "\n\nJudge: IChatClient; served as \"served-judge-model\", 1 response(s), 7 tokens, cost not reported\n";
    public const string ChatClientNothingReported =
        "\n\nJudge: IChatClient; served model not reported, 1 response(s), tokens not reported, cost not reported\n";
}
