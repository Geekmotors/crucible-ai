using CrucibleAI.Providers;
using CrucibleAI.Runs;
using CrucibleAI.Tracing;

namespace CrucibleAI.Tests.Fakes;

internal sealed class QuietJudgeObserver : IJudgeObserver
{
    public void Observe(TraceEvent traced)
    {
    }

    public void Spent(JudgeUsage usage)
    {
    }
}
