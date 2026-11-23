using CrucibleAI.Tests.Constants;
using CrucibleAI.Tests.Fakes;
using CrucibleAI.Tests.Harnesses;
using Microsoft.Extensions.AI;

namespace CrucibleAI.Tests.Reports;

public sealed class JudgeStampTests
{
    [Fact]
    public async Task AFailureReportNamesTheConfiguredJudgeAndThatNoResponseArrived()
    {
        var harness = new EngineHarness();

        var error = await Assert.ThrowsAsync<CrucibleVerdictException>(
            () => harness.RunAsync(EngineRuns.Smoke, _ => throw new InvalidOperationException(EngineTexts.Problem)));

        Assert.Contains(StampTexts.ConfiguredJudgeWithoutResponses, error.Message, StringComparison.Ordinal);
    }

    [Fact]
    public async Task AFailureReportEndsWithThePackageVersionAndTheSchemaFingerprints()
    {
        var harness = new EngineHarness();

        var error = await Assert.ThrowsAsync<CrucibleVerdictException>(
            () => harness.RunAsync(EngineRuns.Smoke, _ => throw new InvalidOperationException(EngineTexts.Problem)));

        Assert.EndsWith(StampExpectation.CrucibleLineEnding(), error.Message, StringComparison.Ordinal);
    }

    [Fact]
    public async Task EveryProviderResponseIsSpentIncludingAReaskedUnusableReply()
    {
        var client = new ProviderHarness(EngineTexts.Config).Client(
            HttpAnswers.Served(StampTexts.UnusableReply, StampTexts.ServedModel, StampTexts.FirstTokens, StampTexts.FirstCost),
            HttpAnswers.Served(JudgeSettings.Reply, StampTexts.ServedModel, StampTexts.SecondTokens, StampTexts.SecondCost));
        var harness = new EngineHarness(client);

        var error = await Assert.ThrowsAsync<CrucibleVerdictException>(() => harness.RunAsync(EngineRuns.Smoke, async context =>
        {
            await context.CoherentAsync(EngineTexts.Response, EngineTexts.Claim);
            throw new InvalidOperationException(EngineTexts.Problem);
        }));

        Assert.Contains(StampTexts.TwoServedResponses, error.Message, StringComparison.Ordinal);
    }

    [Theory]
    [InlineData(EngineTexts.Full)]
    [InlineData(EngineTexts.Debug)]
    public async Task APassingReportCarriesTheStamp(string verbosity)
    {
        var harness = new EngineHarness(verbosity: verbosity);

        await harness.RunAsync(EngineRuns.Smoke, _ => Task.CompletedTask);

        Assert.Contains(StampTexts.ConfiguredJudgeWithoutResponses, harness.Output.Text, StringComparison.Ordinal);
    }

    [Fact]
    public async Task AChatClientJudgeReportsItsServedModelAndTotalTokens()
    {
        var harness = new EngineHostHarness();
        harness.Host.UseChatClient(
            new ScriptedChatClient(Response(new UsageDetails { TotalTokenCount = StampTexts.ChatClientTotalTokens }, StampTexts.ServedModel)), null);

        var error = await Assert.ThrowsAsync<CrucibleVerdictException>(harness.JudgedThenFailingGateAsync);

        Assert.Contains(StampTexts.ChatClientServedWithTokens, error.Message, StringComparison.Ordinal);
    }

    [Fact]
    public async Task AChatClientJudgeWithoutATotalCountsInputAndOutputTokens()
    {
        var harness = new EngineHostHarness();
        var usage = new UsageDetails { InputTokenCount = StampTexts.ChatClientInputTokens, OutputTokenCount = StampTexts.ChatClientOutputTokens };
        harness.Host.UseChatClient(new ScriptedChatClient(Response(usage, StampTexts.ServedModel)), null);

        var error = await Assert.ThrowsAsync<CrucibleVerdictException>(harness.JudgedThenFailingGateAsync);

        Assert.Contains(StampTexts.ChatClientServedWithTokens, error.Message, StringComparison.Ordinal);
    }

    [Fact]
    public async Task AChatClientJudgeThatReportsNothingStillCountsTheResponse()
    {
        var harness = new EngineHostHarness();
        harness.Host.UseChatClient(new ScriptedChatClient(Response(null, null)), null);

        var error = await Assert.ThrowsAsync<CrucibleVerdictException>(harness.JudgedThenFailingGateAsync);

        Assert.Contains(StampTexts.ChatClientNothingReported, error.Message, StringComparison.Ordinal);
    }

    private static ChatResponse Response(UsageDetails? usage, string? model) =>
        new(new ChatMessage(ChatRole.Assistant, ChatClientTexts.Reply)) { Usage = usage, ModelId = model };
}
