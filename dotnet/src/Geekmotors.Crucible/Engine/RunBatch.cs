using CrucibleAI.Runs;
using CrucibleAI.Tracing;
using CrucibleAI.Verdicts;

namespace CrucibleAI.Engine;

internal sealed class RunBatch
{
    private readonly object _gate = new();
    private readonly IReadOnlyList<RunState> _runs;
    private readonly SettledRun?[] _settled;
    private readonly DebugTrace _trace;
    private readonly TaskCompletionSource<BatchEnd> _end = new(TaskCreationOptions.RunContinuationsAsynchronously);
    private int _pending;

    public RunBatch(IReadOnlyList<RunState> runs, DebugTrace trace)
    {
        _runs = runs;
        _settled = new SettledRun?[runs.Count];
        _pending = runs.Count;
        _trace = trace;
    }

    public Task<BatchEnd> Ended => _end.Task;

    public bool IsEnded => _end.Task.IsCompleted;

    public void Settle(RunState run, RunSettlement settlement, Exception? thrown)
    {
        lock (_gate)
        {
            if (IsEnded)
            {
                return;
            }
            if (settlement == RunSettlement.Halt)
            {
                _end.SetResult(new BatchEnd(new VerdictEnding(), [], null, thrown));
                return;
            }
            var status = settlement switch
            {
                RunSettlement.Passed => RunStatus.Passed,
                RunSettlement.Failed => RunStatus.Failed,
                _ => RunStatus.Errored,
            };
            var cause = thrown is null ? null : RunCause.Of(thrown);
            _settled[run.Number - 1] = new SettledRun(new RunResult(status, cause, run.Record.Calls, run.Record.Usage), thrown);
            _trace.Write(new RunSettledEvent(run.Number, status, cause));
            if (settlement == RunSettlement.Fatal)
            {
                var results = WithUnsettledDiscarded(out var discarded);
                _trace.Write(new TestAbortedEvent(cause!, discarded));
                _end.SetResult(new BatchEnd(new AbortedEnding(run.Number), results, thrown, null));
                return;
            }
            if (--_pending == 0)
            {
                _end.SetResult(new BatchEnd(new VerdictEnding(), WithUnsettledDiscarded(out _), null, null));
            }
        }
    }

    public void Expire(long deadlineMs)
    {
        lock (_gate)
        {
            if (IsEnded)
            {
                return;
            }
            var results = WithUnsettledDiscarded(out var discarded);
            _trace.Write(new TestExpiredEvent(deadlineMs, discarded));
            _end.SetResult(new BatchEnd(new ExpiredEnding(deadlineMs), results, null, null));
        }
    }

    public void Cancel(CancellationToken cancellation)
    {
        lock (_gate)
        {
            if (!IsEnded)
            {
                _end.SetResult(new BatchEnd(new VerdictEnding(), [], null, new OperationCanceledException(cancellation)));
            }
        }
    }

    private SettledRun[] WithUnsettledDiscarded(out int discarded)
    {
        var results = new SettledRun[_runs.Count];
        discarded = 0;
        for (var index = 0; index < results.Length; index++)
        {
            if (_settled[index] is { } settled)
            {
                results[index] = settled;
                continue;
            }
            discarded++;
            results[index] = new SettledRun(new RunResult(RunStatus.Discarded, null, _runs[index].Record.Calls, _runs[index].Record.Usage), null);
        }
        return results;
    }
}
