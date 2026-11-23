using CrucibleAI.Assertions;
using CrucibleAI.Options;
using CrucibleAI.Runs;

namespace CrucibleAI.Engine;

internal sealed class RunState
{
    private readonly ResolvedRunOptions _options;
    private readonly EngineSession _session;
    private readonly CancellationToken _cancellation;
    private readonly RunObserver _observer;
    private int _open = 1;

    public RunState(int number, ResolvedRunOptions options, EngineSession session, CancellationToken cancellation)
    {
        Number = number;
        _options = options;
        _session = session;
        _cancellation = cancellation;
        _observer = new RunObserver(session.Trace, number, Record);
        Context = new CrucibleContext(this);
    }

    public int Number { get; }

    public CancellationToken Cancellation => _cancellation;

    public RunRecord Record { get; } = new();

    public CrucibleContext Context { get; }

    public bool IsOpen => Volatile.Read(ref _open) == 1;

    public void Close() => Volatile.Write(ref _open, 0);

    public void AddFacts(IEnumerable<string?>? facts)
    {
        EnsureOpen();
        Record.AddFacts(facts);
    }

    public async Task<bool> CoherentAsync(CoherentCall call, CancellationToken cancellation)
    {
        EnsureOpen();
        using var linked = CancellationTokenSource.CreateLinkedTokenSource(_cancellation, cancellation);
        return await _session.Coherent.AskAsync(Assertion(linked.Token), call).ConfigureAwait(false);
    }

    public async Task<object?> ExtractAsync(ExtractCall call, CancellationToken cancellation)
    {
        EnsureOpen();
        using var linked = CancellationTokenSource.CreateLinkedTokenSource(_cancellation, cancellation);
        return await _session.Extract.AskAsync(Assertion(linked.Token), call).ConfigureAwait(false);
    }

    private AssertionRun Assertion(CancellationToken cancellation) =>
        new(Record, _options.Strict, TimeSpan.FromMilliseconds(_options.InferenceTimeout), _observer, cancellation);

    private void EnsureOpen()
    {
        if (!IsOpen)
        {
            throw CrucibleException.Usage("This run has ended; use its context only while the run is running.");
        }
    }
}
