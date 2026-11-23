using CrucibleAI.Runs;
using Microsoft.Extensions.AI;

namespace CrucibleAI.ChatClients;

internal sealed class ChatClientUsageReader
{
    public JudgeUsage Read(ChatResponse? response) =>
        new(string.IsNullOrEmpty(response?.ModelId) ? null : response.ModelId, Tokens(response?.Usage), null);

    private static double? Tokens(UsageDetails? usage)
    {
        if (usage?.TotalTokenCount is >= 0 and var total)
        {
            return total;
        }
        return usage?.InputTokenCount is >= 0 and var input && usage.OutputTokenCount is >= 0 and var output ? input + output : null;
    }
}
