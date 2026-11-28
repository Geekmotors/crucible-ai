using CrucibleAI.Engine;
using CrucibleAI.Tests.Constants;
using CrucibleAI.Tests.Fakes;
using CrucibleAI.Tests.Harnesses;

namespace CrucibleAI.Tests.Engine;

public sealed class GateEngineTests
{
    [Fact]
    public async Task AGateWhoseRunsAllPassCompletes()
    {
        var harness = new EngineHarness();

        var error = await Record.ExceptionAsync(() => harness.RunAsync(EngineRuns.AllOfFew, _ => Task.CompletedTask));

        Assert.Null(error);
    }

    [Fact(Timeout = TestLimits.HangGuardMs)]
    public async Task EveryRunStartsAtOnce()
    {
        var harness = new EngineHarness();
        var together = new Rendezvous(EngineRuns.Many, TestContext.Current.CancellationToken);

        var error = await Record.ExceptionAsync(() => harness.RunAsync(EngineRuns.AllOfMany, _ => together.ArriveAsync()));

        Assert.Null(error);
    }

    [Fact]
    public async Task EachRunHasItsOwnNumber()
    {
        var harness = new EngineHarness();
        var numbers = new System.Collections.Concurrent.ConcurrentBag<int>();

        await harness.RunAsync(EngineRuns.AllOfMany, context =>
        {
            numbers.Add(context.Run);
            return Task.CompletedTask;
        });

        Assert.Equal(Enumerable.Range(1, EngineRuns.Many), numbers.Order());
    }

    [Fact]
    public async Task ASequentialGateRunsOneRunAtATime()
    {
        var harness = new EngineHarness();
        var gauge = new ConcurrencyGauge();

        await harness.RunAsync(new GateRequest([], EngineRuns.AllOfMany, _ => Task.FromResult(RunBody.Of(async _ =>
        {
            gauge.Enter();
            await Task.Yield();
            gauge.Leave();
        })), true));

        Assert.Equal(EngineRuns.OneAtATime, gauge.Most);
    }

    [Fact]
    public async Task TheBodyFactoryIsCalledOncePerRunWithItsNumber()
    {
        var harness = new EngineHarness();
        var built = new System.Collections.Concurrent.ConcurrentBag<int>();

        await harness.RunAsync(new GateRequest([], EngineRuns.AllOfFew, run =>
        {
            built.Add(run);
            return Task.FromResult(RunBody.Of(_ => Task.CompletedTask));
        }, false));

        Assert.Equal(Enumerable.Range(1, EngineRuns.Few), built.Order());
    }

    [Fact]
    public async Task TestDefaultsApplyWhereNoGroupOrTestDeclaresTheOption()
    {
        var harness = new EngineHarness(config: EngineTexts.ConfigWithTestDefaults);
        var runs = 0;

        await harness.RunAsync(new GateRequest([new RunOptions { Threshold = EngineRuns.Everyone }], new RunOptions(), _ => Task.FromResult(RunBody.Of(_ =>
        {
            Interlocked.Increment(ref runs);
            return Task.CompletedTask;
        })), false));

        Assert.Equal(EngineRuns.FromTestDefaults, runs);
    }

    [Fact]
    public async Task TooFewPassingRunsFailWithTheFirstFailedRunsCause()
    {
        var harness = new EngineHarness();
        var problems = Enumerable.Range(0, EngineRuns.Few).Select(_ => new InvalidOperationException(EngineTexts.Problem)).ToArray();
        var othersSettled = new TaskCompletionSource(TaskCreationOptions.RunContinuationsAsynchronously);
        var settled = 0;

        var error = await Assert.ThrowsAsync<CrucibleVerdictException>(() => harness.RunAsync(EngineRuns.AllOfFew, async context =>
        {
            if (context.Run == EngineRuns.FirstRun)
            {
                await othersSettled.Task.WaitAsync(TestContext.Current.CancellationToken);
            }
            else if (Interlocked.Increment(ref settled) == EngineRuns.Few - 1)
            {
                othersSettled.SetResult();
            }
            throw problems[context.Run - 1];
        }));

        Assert.Equal(VerdictOutcome.Failed, error.Outcome);
        Assert.Same(problems[EngineRuns.FirstRun - 1], error.InnerException);
    }

    [Fact]
    public async Task EnoughPassingRunsPassDespiteFailures()
    {
        var harness = new EngineHarness();

        var error = await Record.ExceptionAsync(() => harness.RunAsync(
            new RunOptions { Runs = EngineRuns.Few, Threshold = EngineRuns.Half },
            context => context.Run == EngineRuns.FirstRun ? throw new InvalidOperationException(EngineTexts.Problem) : Task.CompletedTask));

        Assert.Null(error);
    }

    [Fact]
    public async Task RetryableInfraFailuresMakeTheVerdictErrored()
    {
        var harness = new EngineHarness();

        var error = await Assert.ThrowsAsync<CrucibleVerdictException>(
            () => harness.RunAsync(EngineRuns.AllOfFew, _ => throw CrucibleException.Infra(EngineTexts.Problem, true)));

        Assert.Equal(VerdictOutcome.Errored, error.Outcome);
    }

    [Fact]
    public async Task AnInfraFailureWrappedInAnotherExceptionStillErrorsTheRun()
    {
        var harness = new EngineHarness();

        var error = await Assert.ThrowsAsync<CrucibleVerdictException>(() => harness.RunAsync(
            EngineRuns.AllOfFew,
            _ => throw new InvalidOperationException(EngineTexts.Problem, CrucibleException.Infra(EngineTexts.Problem, true))));

        Assert.Equal(VerdictOutcome.Errored, error.Outcome);
    }

    [Theory]
    [InlineData(CrucibleErrorKind.Usage)]
    [InlineData(CrucibleErrorKind.Config)]
    public async Task AUsageOrConfigErrorHaltsTheGateAndIsRethrownUnchanged(CrucibleErrorKind kind)
    {
        var harness = new EngineHarness(new HangingJudgeClient());
        var thrown = kind == CrucibleErrorKind.Usage ? CrucibleException.Usage(EngineTexts.Problem) : CrucibleException.Config(EngineTexts.Problem);

        var error = await Record.ExceptionAsync(() => harness.RunAsync(
            EngineRuns.AllOfFew,
            async context =>
            {
                if (context.Run == EngineRuns.FirstRun)
                {
                    throw thrown;
                }
                await context.CoherentAsync(EngineTexts.Response, EngineTexts.Claim);
            }));

        Assert.Same(thrown, error);
    }

    [Theory]
    [InlineData(CrucibleErrorKind.Usage)]
    [InlineData(CrucibleErrorKind.Config)]
    public async Task AWrapperAroundAUsageOrConfigErrorIsRethrownUnchanged(CrucibleErrorKind kind)
    {
        var harness = new EngineHarness();
        var inner = kind == CrucibleErrorKind.Usage ? CrucibleException.Usage(EngineTexts.Problem) : CrucibleException.Config(EngineTexts.Problem);
        var thrown = new InvalidOperationException(EngineTexts.Problem, inner);

        var error = await Record.ExceptionAsync(() => harness.RunAsync(EngineRuns.AllOfFew, _ => throw thrown));

        Assert.Same(thrown, error);
    }

    [Fact]
    public async Task ABodyReturningNoTaskIsAUsageError()
    {
        var harness = new EngineHarness();

        var error = await Assert.ThrowsAsync<CrucibleException>(() => harness.RunAsync(EngineRuns.AllOfFew, _ => null!));

        Assert.Equal(CrucibleErrorKind.Usage, error.Kind);
    }

    [Fact]
    public async Task AVerdictFromANestedGateIsRethrownUnchanged()
    {
        var harness = new EngineHarness();
        CrucibleVerdictException? nested = null;

        var error = await Record.ExceptionAsync(() => harness.RunAsync(EngineRuns.Smoke, async _ =>
        {
            nested = await Assert.ThrowsAsync<CrucibleVerdictException>(
                () => harness.RunAsync(EngineRuns.Smoke, _ => throw new InvalidOperationException(EngineTexts.Problem)));
            throw nested;
        }));

        Assert.Same(nested, error);
    }

    [Fact(Timeout = TestLimits.HangGuardMs)]
    public async Task AFatalJudgeErrorAbortsTheGateAndDiscardsTheRunsInFlight()
    {
        var harness = new EngineHarness(new HangingJudgeClient());
        var fatal = CrucibleException.Infra(EngineTexts.Problem, false);

        var error = await Assert.ThrowsAsync<CrucibleVerdictException>(() => harness.RunAsync(
            EngineRuns.AllOfFew,
            async context =>
            {
                if (context.Run == EngineRuns.FirstRun)
                {
                    throw fatal;
                }
                await context.CoherentAsync(EngineTexts.Response, EngineTexts.Claim);
            }).WaitAsync(TestContext.Current.CancellationToken));

        Assert.Equal(VerdictOutcome.Errored, error.Outcome);
        Assert.Same(fatal, error.InnerException);
        Assert.Contains(EngineTexts.AbortedMarker, error.Message, StringComparison.Ordinal);
    }

    [Fact(Timeout = TestLimits.HangGuardMs)]
    public async Task TheTestDeadlineEndsTheGateAsErrored()
    {
        var harness = new EngineHarness(new HangingJudgeClient());
        var gate = harness.RunAsync(
            new RunOptions { Runs = EngineRuns.Few, TestTimeout = EngineRuns.TestTimeoutMs },
            context => context.CoherentAsync(EngineTexts.Response, EngineTexts.Claim));

        harness.Clock.Advance(EngineRuns.TestTimeout);

        var error = await Assert.ThrowsAsync<CrucibleVerdictException>(() => gate.WaitAsync(TestContext.Current.CancellationToken));
        Assert.Equal(VerdictOutcome.Errored, error.Outcome);
        var cause = Assert.IsType<CrucibleException>(error.InnerException);
        Assert.Equal((CrucibleErrorKind.Infra, true), (cause.Kind, cause.Retryable));
        Assert.Contains(EngineTexts.ExpiredMarker, error.Message, StringComparison.Ordinal);
    }

    [Fact(Timeout = TestLimits.HangGuardMs)]
    public async Task TheTestDeadlineCancelsTheJudgeCallsInFlight()
    {
        var judge = new HangingJudgeClient();
        var harness = new EngineHarness(judge);
        var inFlight = new ThrownCapture();
        var gate = harness.RunAsync(
            new RunOptions { Runs = EngineRuns.Single, TestTimeout = EngineRuns.TestTimeoutMs },
            context => inFlight.RunAsync(() => context.CoherentAsync(EngineTexts.Response, EngineTexts.Claim)));

        await judge.Reached.WaitAsync(TestContext.Current.CancellationToken);
        harness.Clock.Advance(EngineRuns.TestTimeout);
        await Assert.ThrowsAsync<CrucibleVerdictException>(() => gate.WaitAsync(TestContext.Current.CancellationToken));

        Assert.IsAssignableFrom<OperationCanceledException>(await inFlight.Thrown.WaitAsync(TestContext.Current.CancellationToken));
    }

    [Fact(Timeout = TestLimits.HangGuardMs)]
    public async Task TheTestDeadlineCancelsTheRunsToken()
    {
        var harness = new EngineHarness();
        var waiting = new TaskCompletionSource(TaskCreationOptions.RunContinuationsAsynchronously);
        var observer = new ThrownCapture();
        var gate = harness.RunAsync(
            new RunOptions { Runs = EngineRuns.Single, TestTimeout = EngineRuns.TestTimeoutMs },
            context => observer.RunAsync(() =>
            {
                waiting.SetResult();
                return Task.Delay(Timeout.Infinite, context.CancellationToken);
            }));

        await waiting.Task.WaitAsync(TestContext.Current.CancellationToken);
        harness.Clock.Advance(EngineRuns.TestTimeout);
        await Assert.ThrowsAsync<CrucibleVerdictException>(() => gate.WaitAsync(TestContext.Current.CancellationToken));

        Assert.IsAssignableFrom<OperationCanceledException>(await observer.Thrown.WaitAsync(TestContext.Current.CancellationToken));
    }

    [Fact]
    public async Task AConfigProblemIsAConfigError()
    {
        var harness = new EngineHarness(config: EngineTexts.BrokenConfig);

        var error = await Assert.ThrowsAsync<CrucibleException>(() => harness.RunAsync(EngineRuns.Smoke, _ => Task.CompletedTask));

        Assert.Equal(CrucibleErrorKind.Config, error.Kind);
    }

    [Theory]
    [InlineData(EngineTexts.Full)]
    [InlineData(EngineTexts.Debug)]
    public async Task APassingGateWritesItsReportAtFullAndDebug(string verbosity)
    {
        var harness = new EngineHarness(verbosity: verbosity);

        await harness.RunAsync(EngineRuns.Smoke, _ => Task.CompletedTask);

        Assert.Contains(EngineTexts.PassedHeadline, harness.Output.Text, StringComparison.Ordinal);
    }

    [Fact]
    public async Task APassingGateWritesNothingAtDefault()
    {
        var harness = new EngineHarness();

        await harness.RunAsync(EngineRuns.Smoke, _ => Task.CompletedTask);

        Assert.Empty(harness.Output.Text);
    }

    [Fact]
    public async Task ABrokenOutputNeverFailsTheGate()
    {
        var harness = new EngineHarness(verbosity: EngineTexts.Debug, output: new BrokenTraceOutput(new IOException()));

        var error = await Record.ExceptionAsync(() => harness.RunAsync(
            EngineRuns.Smoke, context => context.CoherentAsync(EngineTexts.Response, EngineTexts.Claim)));

        Assert.Null(error);
    }

    [Fact]
    public async Task TheDebugTraceShowsTheTestDefaultsAsWritten()
    {
        var harness = new EngineHarness(config: EngineTexts.ConfigWithTestDefaults, verbosity: EngineTexts.Debug);

        await harness.RunAsync(new RunOptions { Threshold = EngineRuns.Everyone }, _ => Task.CompletedTask);

        Assert.Contains(EngineTexts.TraceTestDefaults, harness.Output.Text, StringComparison.Ordinal);
    }

    [Fact]
    public async Task TheDebugTraceShowsProviderAttemptsAndRecordedCallsTaggedWithTheirRun()
    {
        var failing = HttpAnswers.Json(EngineTexts.ServerError, null);
        var client = new ProviderHarness(JudgeSettings.OpenRouterConfig).Client(failing, HttpAnswers.Reply(JudgeSettings.Reply));
        var harness = new EngineHarness(client, verbosity: EngineTexts.Debug);

        await harness.RunAsync(EngineRuns.Smoke, context => context.CoherentAsync(EngineTexts.Response, EngineTexts.Claim));

        Assert.Contains(EngineTexts.RunTag + EngineTexts.ProviderRetryLine, harness.Output.Text, StringComparison.Ordinal);
        Assert.Contains(EngineTexts.RunTag + EngineTexts.JudgeRecordedLine, harness.Output.Text, StringComparison.Ordinal);
    }

    [Fact]
    public async Task ExtractReturnsTheValueAsTheRequestedNullableType()
    {
        var harness = new EngineHarness(new EchoJudgeClient(EngineRuns.WholeNumber));
        int? extracted = null;

        await harness.RunAsync(EngineRuns.Smoke, async _ => extracted = await Crucible.ExtractAsync<int?>(EngineTexts.Response, EngineTexts.Target));

        Assert.Equal(EngineRuns.WholeNumber, extracted);
    }

    [Fact]
    public async Task ExtractingANonNullableValueTypeIsAUsageError()
    {
        var harness = new EngineHarness(new EchoJudgeClient(EngineRuns.WholeNumber));

        var error = await Assert.ThrowsAsync<CrucibleException>(
            () => harness.RunAsync(EngineRuns.Smoke, _ => Crucible.ExtractAsync<int>(EngineTexts.Response, EngineTexts.Target)));

        Assert.Equal(CrucibleErrorKind.Usage, error.Kind);
    }

    [Fact]
    public async Task AMeasuredTestBelowItsThresholdPassesAndWritesItsReportAtDefault()
    {
        var harness = new EngineHarness();
        var runs = 0;

        await harness.RunAsync(EngineRuns.MeasuredPair, _ => Interlocked.Increment(ref runs) == 1
            ? Task.CompletedTask
            : throw new InvalidOperationException(EngineTexts.Problem));

        Assert.Contains(EngineTexts.MeasuredHeadline, harness.Output.Text, StringComparison.Ordinal);
    }

    [Fact]
    public async Task CrucibleModeMeasuresATestThatDoesNotAskToBe()
    {
        var harness = new EngineHarness(invocation: new Dictionary<string, string> { [EngineTexts.ModeVariable] = EngineTexts.Measure });

        await harness.RunAsync(EngineRuns.Smoke, _ => throw new InvalidOperationException(EngineTexts.Problem));

        Assert.Contains(EngineTexts.MeasuredHeadline, harness.Output.Text, StringComparison.Ordinal);
    }

    [Fact]
    public async Task AMeasuredTestExecutesCrucibleMeasureRunsRuns()
    {
        var harness = new EngineHarness(invocation: new Dictionary<string, string>
        {
            [EngineTexts.ModeVariable] = EngineTexts.Measure,
            [EngineTexts.MeasureRunsVariable] = EngineTexts.TwentyRuns,
        });
        var runs = 0;

        await harness.RunAsync(EngineRuns.AllOfFew, _ =>
        {
            Interlocked.Increment(ref runs);
            return Task.CompletedTask;
        });

        Assert.Equal(EngineRuns.Measured, runs);
    }

    [Fact]
    public async Task AGatedTestIgnoresCrucibleMeasureRuns()
    {
        var harness = new EngineHarness(invocation: new Dictionary<string, string> { [EngineTexts.MeasureRunsVariable] = EngineTexts.TwentyRuns });
        var runs = 0;

        await harness.RunAsync(EngineRuns.AllOfFew, _ =>
        {
            Interlocked.Increment(ref runs);
            return Task.CompletedTask;
        });

        Assert.Equal(EngineRuns.Few, runs);
    }

    [Fact]
    public async Task AMeasuredTestWhoseEveryRunErroredFailsAsErrored()
    {
        var harness = new EngineHarness();

        var error = await Assert.ThrowsAsync<CrucibleVerdictException>(() => harness.RunAsync(
            EngineRuns.MeasuredSmoke, _ => throw CrucibleException.Infra(EngineTexts.Problem, true)));

        Assert.Equal(VerdictOutcome.Errored, error.Outcome);
    }

    [Fact]
    public async Task AMeasuredReportNamesTheTest()
    {
        var harness = new EngineHarness();

        await harness.RunAsync(new GateRequest(
            [], EngineRuns.MeasuredSmoke, _ => Task.FromResult(RunBody.Of(_ => Task.CompletedTask)), false, EngineTexts.MeasuredTestName));

        Assert.Contains(EngineTexts.MeasuredHeadline + EngineTexts.MeasuredTestName + ": ", harness.Output.Text, StringComparison.Ordinal);
    }
}
