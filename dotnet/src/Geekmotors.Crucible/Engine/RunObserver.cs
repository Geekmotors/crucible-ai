using CrucibleAI.Providers;
using CrucibleAI.Runs;
using CrucibleAI.Tracing;

namespace CrucibleAI.Engine;

internal sealed class RunObserver(DebugTrace trace, int run, RunRecord record) : IJudgeObserver
{
    public void Observe(TraceEvent traced) => trace.Write(traced with { Run = run });

    public void Spent(JudgeUsage usage) => record.Spend(usage);
}
