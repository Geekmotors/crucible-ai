using System.Globalization;
using System.Runtime.ExceptionServices;
using CrucibleAI.Options;
using CrucibleAI.Reports;
using CrucibleAI.Runs;
using CrucibleAI.Tracing;
using CrucibleAI.Verdicts;

namespace CrucibleAI.Engine;

internal sealed class GateEngine(Func<EngineSession> session, TimeProvider time)
{
    private readonly Lazy<EngineSession> _session = new(session);
    private readonly RunOptionsValidator _validator = new();
    private readonly RunOptionsResolver _resolver = new();
    private readonly RunClassifier _classifier = new();
    private readonly VerdictCalculator _calculator = new();
    private readonly Measurer _measurer = new();
    private readonly RunScope _scope = new();

    private const string NoTask = "A Crucible test body must return a Task, not null.";

    public Task GateAsync(RunOptions? options, Func<CrucibleContext, Task>? body, CancellationToken cancellationToken = default)
    {
        if (body is null)
        {
            throw CrucibleException.Usage("Crucible.Gate needs a test body.");
        }
        var declared = _validator.Validate(options, RunOptionsSource.Test);
        return RunAsync(new GateRequest([], declared, _ => Task.FromResult(RunBody.Of(body)), false, Cancellation: cancellationToken));
    }

    public async Task RunAsync(GateRequest request)
    {
        request.Cancellation.ThrowIfCancellationRequested();
        var session = _session.Value;
        var options = _resolver.Resolve([session.TestDefaults, .. request.Groups, request.Declared], session.Invocation);
        session.Trace.Write(new TestStartedEvent(options.ExecutedRuns, options.Threshold, options.TestTimeout));
        var halt = new CancellationTokenSource();
        var runs = Enumerable.Range(1, options.ExecutedRuns).Select(number => new RunState(number, options, session, halt.Token)).ToArray();
        var batch = new RunBatch(runs, session.Trace);
        BatchEnd end;
        using (time.CreateTimer(_ => batch.Expire(options.TestTimeout), null, TimeSpan.FromMilliseconds(options.TestTimeout), Timeout.InfiniteTimeSpan))
        using (request.Cancellation.Register(() => batch.Cancel(request.Cancellation)))
        {
            if (!batch.IsEnded)
            {
                Start(request, runs, batch);
            }
            end = await batch.Ended.ConfigureAwait(false);
        }
        foreach (var run in runs)
        {
            run.Close();
        }
        await halt.CancelAsync().ConfigureAwait(false);
        Conclude(end, options, session, request.Name);
    }

    private void Start(GateRequest request, RunState[] runs, RunBatch batch)
    {
        if (request.Sequential)
        {
            _ = Task.Run(async () =>
            {
                foreach (var run in runs.TakeWhile(_ => !batch.IsEnded))
                {
                    await RunOneAsync(request, run, batch).ConfigureAwait(false);
                }
            });
            return;
        }
        foreach (var run in runs)
        {
            _ = Task.Run(() => RunOneAsync(request, run, batch));
        }
    }

    private async Task RunOneAsync(GateRequest request, RunState run, RunBatch batch)
    {
        Exception? thrown = null;
        RunBody? body = null;
        try
        {
            _scope.Enter(null);
            body = await (request.BodyFor(run.Number) ?? throw CrucibleException.Usage(NoTask)).ConfigureAwait(false);
            if (!batch.IsEnded)
            {
                _scope.Enter(run);
                await (body.Invoke(run.Context) ?? throw CrucibleException.Usage(NoTask)).ConfigureAwait(false);
            }
        }
        catch (Exception failure)
        {
            thrown = failure;
        }
        finally
        {
            run.Close();
            _scope.Enter(null);
        }
        if (body is not null)
        {
            thrown = await TearDownAsync(body, thrown).ConfigureAwait(false);
        }
        batch.Settle(run, _classifier.Classify(thrown), thrown);
    }

    private static async Task<Exception?> TearDownAsync(RunBody body, Exception? thrown)
    {
        try
        {
            await body.TeardownAsync().ConfigureAwait(false);
            return thrown;
        }
        catch (Exception failure)
        {
            return thrown ?? failure;
        }
    }

    private void Conclude(BatchEnd end, ResolvedRunOptions options, EngineSession session, string? name)
    {
        if (end.Rethrow is { } rethrow)
        {
            ExceptionDispatchInfo.Capture(rethrow).Throw();
        }
        var record = new TestRecord(options.ExecutedRuns, options.Threshold, end.Ending, end.Runs.Select(run => run.Result).ToArray());
        switch (end.Ending)
        {
            case ExpiredEnding expired:
                throw new CrucibleVerdictException(
                    VerdictOutcome.Errored,
                    session.Reports.Render(record),
                    CrucibleException.Infra(
                        string.Create(CultureInfo.InvariantCulture, $"The test did not finish within {expired.DeadlineMs} ms."), true));
            case AbortedEnding:
                throw new CrucibleVerdictException(VerdictOutcome.Errored, session.Reports.Render(record), end.Cause);
        }
        if (options.Measure)
        {
            Measure(end, options, session, record, name);
            return;
        }
        var verdict = _calculator.Compute(options.Threshold, record.Results.Select(result => result.Status).ToArray());
        session.Trace.Write(new VerdictReachedEvent(verdict, options.Runs));
        if (verdict.Outcome == VerdictZone.Passed)
        {
            session.WritePassingReport(() => session.Reports.Render(record));
            return;
        }
        var (outcome, status) = verdict.Outcome == VerdictZone.Failed
            ? (VerdictOutcome.Failed, RunStatus.Failed)
            : (VerdictOutcome.Errored, RunStatus.Errored);
        throw new CrucibleVerdictException(
            outcome, session.Reports.Render(record), end.Runs.FirstOrDefault(run => run.Result.Status == status)?.Thrown);
    }

    private void Measure(BatchEnd end, ResolvedRunOptions options, EngineSession session, TestRecord record, string? name)
    {
        var measurement = _measurer.Measure(record.Results.Select(result => result.Status).ToArray(), options.Threshold, options.Runs);
        var report = session.Reports.RenderMeasured(record, measurement, new MeasuredTest(options.Runs, name));
        if (measurement.NothingSettled)
        {
            throw new CrucibleVerdictException(
                VerdictOutcome.Errored, report, end.Runs.FirstOrDefault(run => run.Result.Status == RunStatus.Errored)?.Thrown);
        }
        session.WriteReport(() => report);
    }
}
