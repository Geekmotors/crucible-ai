using CrucibleAI.Runs;

namespace CrucibleAI.Providers;

internal sealed record ChatReply(string Text, JudgeUsage Usage);
