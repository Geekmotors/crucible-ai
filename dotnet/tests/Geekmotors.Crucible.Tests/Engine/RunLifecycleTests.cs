using System.Collections.Concurrent;
using CrucibleAI.Engine;
using CrucibleAI.Tests.Constants;
using CrucibleAI.Tests.Harnesses;

namespace CrucibleAI.Tests.Engine;

public sealed class RunLifecycleTests
{
    private readonly EngineHarness _harness = new();

    [Fact]
    public async Task EachRunIsTornDownAfterItsBodyFinished()
    {
        var finished = new ConcurrentDictionary<int, bool>();
        var tornDownAfterBody = new ConcurrentBag<int>();

        await _harness.RunAsync(new GateRequest(
            [],
            EngineRuns.AllOfFew,
            run => Task.FromResult(new RunBody(
                async _ =>
                {
                    await Task.Yield();
                    finished[run] = true;
                },
                () =>
                {
                    if (finished.ContainsKey(run))
                    {
                        tornDownAfterBody.Add(run);
                    }
                    return ValueTask.CompletedTask;
                })),
            false));

        Assert.Equal(Enumerable.Range(1, EngineRuns.Few), tornDownAfterBody.Order());
    }

    [Fact]
    public async Task TheTeardownRunsOutsideTheRun()
    {
        var teardown = new ThrownCapture();

        await _harness.RunAsync(new GateRequest(
            [],
            EngineRuns.Smoke,
            _ => Task.FromResult(new RunBody(_ => Task.CompletedTask, () =>
            {
                teardown.Run(() => Crucible.Facts(EngineTexts.LateFact));
                return ValueTask.CompletedTask;
            })),
            false));

        Assert.Equal(CrucibleErrorKind.Usage, Assert.IsType<CrucibleException>(await teardown.Thrown).Kind);
    }

    [Fact]
    public async Task AnAsyncBodyFactoryRunsOutsideTheRun()
    {
        var error = await Assert.ThrowsAsync<CrucibleException>(() => _harness.RunAsync(new GateRequest(
            [],
            EngineRuns.Smoke,
            async _ =>
            {
                await Task.Yield();
                Crucible.Facts(EngineTexts.LateFact);
                return RunBody.Of(_ => Task.CompletedTask);
            },
            false)));

        Assert.Equal(CrucibleErrorKind.Usage, error.Kind);
    }

    [Fact]
    public async Task AFailingBodyFactoryFailsItsRun()
    {
        var error = await Assert.ThrowsAsync<CrucibleVerdictException>(() => _harness.RunAsync(new GateRequest(
            [],
            EngineRuns.Smoke,
            async _ =>
            {
                await Task.Yield();
                throw new InvalidOperationException(EngineTexts.Problem);
            },
            false)));

        Assert.Equal(VerdictOutcome.Failed, error.Outcome);
    }

    [Fact]
    public async Task AFailingTeardownFailsItsRun()
    {
        var error = await Assert.ThrowsAsync<CrucibleVerdictException>(() => _harness.RunAsync(new GateRequest(
            [],
            EngineRuns.Smoke,
            _ => Task.FromResult(new RunBody(_ => Task.CompletedTask, () => throw new InvalidOperationException(EngineTexts.Problem))),
            false)));

        Assert.Equal(VerdictOutcome.Failed, error.Outcome);
    }

    [Fact(Timeout = TestLimits.HangGuardMs)]
    public async Task ABodyStillRunningAfterAHaltIsTornDownWhenItFinishes()
    {
        var release = new TaskCompletionSource(TaskCreationOptions.RunContinuationsAsynchronously);
        var started = new TaskCompletionSource(TaskCreationOptions.RunContinuationsAsynchronously);
        var tornDown = new TaskCompletionSource<bool>(TaskCreationOptions.RunContinuationsAsynchronously);
        var finished = false;

        await Assert.ThrowsAsync<CrucibleException>(() => _harness.RunAsync(new GateRequest(
            [],
            new RunOptions { Runs = EngineRuns.Pair, Threshold = EngineRuns.Everyone },
            run => Task.FromResult(run == EngineRuns.FirstRun
                ? RunBody.Of(async _ =>
                {
                    await started.Task;
                    throw CrucibleException.Usage(EngineTexts.Problem);
                })
                : new RunBody(
                    async _ =>
                    {
                        started.SetResult();
                        await release.Task;
                        finished = true;
                    },
                    () =>
                    {
                        tornDown.SetResult(finished);
                        return ValueTask.CompletedTask;
                    })),
            false)));
        release.SetResult();

        Assert.True(await tornDown.Task.WaitAsync(TestContext.Current.CancellationToken));
    }

    [Fact(Timeout = TestLimits.HangGuardMs)]
    public async Task CancellingTheGateEndsItAndCancelsTheRuns()
    {
        using var cancellation = new CancellationTokenSource();
        var runToken = new TaskCompletionSource<CancellationToken>(TaskCreationOptions.RunContinuationsAsynchronously);

        var gate = _harness.RunAsync(new GateRequest(
            [],
            EngineRuns.Smoke,
            _ => Task.FromResult(RunBody.Of(async context =>
            {
                runToken.SetResult(context.CancellationToken);
                await Task.Delay(Timeout.Infinite, context.CancellationToken);
            })),
            false,
            Cancellation: cancellation.Token));
        var token = await runToken.Task.WaitAsync(TestContext.Current.CancellationToken);
        await cancellation.CancelAsync();

        await Assert.ThrowsAnyAsync<OperationCanceledException>(() => gate);
        Assert.True(token.IsCancellationRequested);
    }

    [Fact]
    public async Task AGateCancelledBeforeItStartsRunsNoBody()
    {
        using var cancellation = new CancellationTokenSource();
        await cancellation.CancelAsync();
        var runs = 0;

        await Assert.ThrowsAnyAsync<OperationCanceledException>(() => _harness.RunAsync(new GateRequest(
            [],
            EngineRuns.AllOfFew,
            _ => Task.FromResult(RunBody.Of(_ =>
            {
                Interlocked.Increment(ref runs);
                return Task.CompletedTask;
            })),
            false,
            Cancellation: cancellation.Token)));

        Assert.Equal(0, runs);
    }

    [Fact(Timeout = TestLimits.HangGuardMs)]
    public async Task CancellingAGateThroughItsTokenEndsItAndCancelsTheRuns()
    {
        using var cancellation = new CancellationTokenSource();
        var runToken = new TaskCompletionSource<CancellationToken>(TaskCreationOptions.RunContinuationsAsynchronously);

        var gate = _harness.Engine.GateAsync(
            EngineRuns.Smoke,
            async context =>
            {
                runToken.SetResult(context.CancellationToken);
                await Task.Delay(Timeout.Infinite, context.CancellationToken);
            },
            cancellation.Token);
        var token = await runToken.Task.WaitAsync(TestContext.Current.CancellationToken);
        await cancellation.CancelAsync();

        await Assert.ThrowsAnyAsync<OperationCanceledException>(() => gate);
        Assert.True(token.IsCancellationRequested);
    }

    [Fact]
    public async Task AGateWhoseTokenIsAlreadyCancelledRunsNoBody()
    {
        using var cancellation = new CancellationTokenSource();
        await cancellation.CancelAsync();
        var runs = 0;

        await Assert.ThrowsAnyAsync<OperationCanceledException>(() => _harness.Engine.GateAsync(
            EngineRuns.AllOfFew,
            _ =>
            {
                Interlocked.Increment(ref runs);
                return Task.CompletedTask;
            },
            cancellation.Token));

        Assert.Equal(0, runs);
    }

    [Fact(Timeout = TestLimits.HangGuardMs)]
    public async Task ARunStillBeingCreatedWhenTheGateEndsNeverRunsItsBodyButIsTornDown()
    {
        var created = new TaskCompletionSource<RunBody>(TaskCreationOptions.RunContinuationsAsynchronously);
        var tornDown = new TaskCompletionSource<bool>(TaskCreationOptions.RunContinuationsAsynchronously);
        var bodyRan = false;
        var gate = _harness.RunAsync(new GateRequest(
            [],
            new RunOptions { Runs = EngineRuns.Single, TestTimeout = EngineRuns.TestTimeoutMs },
            _ => created.Task,
            false));

        _harness.Clock.Advance(EngineRuns.TestTimeout);
        await Assert.ThrowsAsync<CrucibleVerdictException>(() => gate.WaitAsync(TestContext.Current.CancellationToken));
        created.SetResult(new RunBody(
            _ =>
            {
                bodyRan = true;
                return Task.CompletedTask;
            },
            () =>
            {
                tornDown.SetResult(bodyRan);
                return ValueTask.CompletedTask;
            }));

        Assert.False(await tornDown.Task.WaitAsync(TestContext.Current.CancellationToken));
    }
}
