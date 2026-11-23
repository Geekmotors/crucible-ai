namespace CrucibleAI.Reports;

internal sealed record JudgeStamp(string Package, string Version, string Provider, string? Model, string CoherentSchema, string ExtractSchema);
