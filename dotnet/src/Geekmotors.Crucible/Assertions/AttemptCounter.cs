using CrucibleAI.Providers;
using CrucibleAI.Runs;
using CrucibleAI.Tracing;

namespace CrucibleAI.Assertions;

internal sealed class AttemptCounter(IJudgeObserver observer) : IJudgeObserver
{
    private int _attempts;

    public int Attempts => Volatile.Read(ref _attempts);

    public void Observe(TraceEvent traced)
    {
        if (traced is ProviderRequestEvent)
        {
            Interlocked.Increment(ref _attempts);
        }
        observer.Observe(traced);
    }

    public void Spent(JudgeUsage usage) => observer.Spent(usage);
}
