using System.Reflection;
using System.Runtime.CompilerServices;
using System.Runtime.ExceptionServices;
using CrucibleAI.Engine;
using Xunit;
using Xunit.Sdk;
using Xunit.v3;

namespace CrucibleAI.Xunit;

internal sealed class CrucibleTestRunner : XunitTestRunnerBase<XunitTestRunnerContext, IXunitTest>
{
    private readonly CrucibleSettingsResolver _settings = new();

    public static CrucibleTestRunner Instance { get; } = new();

    public async ValueTask<RunSummary> Run(
        IXunitTest test,
        IMessageBus messageBus,
        object?[] constructorArguments,
        ExplicitOption explicitOption,
        ExceptionAggregator aggregator,
        CancellationTokenSource cancellationTokenSource,
        ParallelMode parallelMode,
        ExecutionScheduler scheduler,
        IReadOnlyCollection<IBeforeAfterTestAttribute> beforeAfterAttributes,
        FixtureMappingManager caseFixtureMappings)
    {
        var context = new XunitTestRunnerContext(
            test,
            explicitOption,
            messageBus,
            aggregator,
            cancellationTokenSource,
            parallelMode,
            scheduler,
            beforeAfterAttributes,
            constructorArguments,
            caseFixtureMappings);
        await using (context.ConfigureAwait(false))
        {
            await context.InitializeAsync().ConfigureAwait(false);
            return await Run(context).ConfigureAwait(false);
        }
    }

    protected override bool IsTestClassCreatable(XunitTestRunnerContext ctxt) => false;

    protected override ValueTask<TimeSpan> InvokeTest(XunitTestRunnerContext ctxt, object? testClassInstance) =>
        ExecutionTimer.MeasureAsync(() => ctxt.Aggregator.RunAsync(() => new ValueTask(GateAsync(ctxt))));

    private async Task GateAsync(XunitTestRunnerContext ctxt)
    {
        var method = ctxt.Method;
        if (method.ReturnType == typeof(void) && method.GetCustomAttribute<AsyncStateMachineAttribute>() is not null)
        {
            throw new TestPipelineException("Tests marked as 'async void' are not supported. Please convert to 'async Task' or 'async ValueTask'.");
        }
        if (IsUnsupportedAwaitable(method.ReturnType))
        {
            throw new TestPipelineException("Crucible test methods must return void, Task, Task<T>, ValueTask or ValueTask<T>.");
        }
        var plan = _settings.Resolve(ctxt.Test.TestMethod.TestClass.Class, method.GetCustomAttributes().OfType<ICrucibleSettings>().FirstOrDefault());
        var instances = new TestClassInstances(ctxt);
        try
        {
            await Crucible.Engine.RunAsync(new GateRequest(
                plan.Groups,
                plan.Declared,
                _ => instances.CreateAsync(),
                plan.Sequential,
                ctxt.Test.TestDisplayName,
                TestContext.Current.CancellationToken)).ConfigureAwait(false);
        }
        catch (CrucibleVerdictException) when (instances.Skip is not null)
        {
        }
        if (instances.Skip is { } skip)
        {
            ExceptionDispatchInfo.Throw(skip);
        }
    }

    private static bool IsUnsupportedAwaitable(Type returnType) =>
        !typeof(Task).IsAssignableFrom(returnType)
        && returnType != typeof(ValueTask)
        && !(returnType.IsGenericType && returnType.GetGenericTypeDefinition() == typeof(ValueTask<>))
        && returnType.GetMethod(nameof(Task.GetAwaiter), Type.EmptyTypes) is not null;
}
