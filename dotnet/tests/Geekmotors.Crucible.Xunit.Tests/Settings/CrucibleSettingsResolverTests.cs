using CrucibleAI.Xunit.Tests.Constants;
using CrucibleAI.Xunit.Tests.Harnesses;
using CrucibleAI.Xunit.Tests.Samples;

namespace CrucibleAI.Xunit.Tests.Settings;

public sealed class CrucibleSettingsResolverTests
{
    private readonly PlanHarness _harness = new();

    [Fact]
    public void WithoutAnyAttributeSettingTheBuiltInsApply()
    {
        var options = _harness.Effective(typeof(UndecoratedSample), new CrucibleFactAttribute());

        Assert.Equal((SampleValues.BuiltInRuns, SampleValues.BuiltInThreshold), (options.Runs, options.Threshold));
    }

    [Fact]
    public void TheAssemblyAttributeSuppliesDefaults()
    {
        var options = _harness.Effective(typeof(UndecoratedSample), new CrucibleFactAttribute());

        Assert.Equal(SampleValues.AssemblyInferenceTimeout, options.InferenceTimeout);
    }

    [Fact]
    public void TheClassAttributeSuppliesDefaults()
    {
        var options = _harness.Effective(typeof(ClassDefaultsSample), new CrucibleFactAttribute());

        Assert.Equal((SampleValues.ClassRuns, SampleValues.ClassThreshold), (options.Runs, options.Threshold));
    }

    [Fact]
    public void TheMethodAttributeOverridesOnlyWhatItSets()
    {
        var options = _harness.Effective(typeof(ClassDefaultsSample), new CrucibleFactAttribute { Runs = SampleValues.MethodRuns });

        Assert.Equal((SampleValues.MethodRuns, SampleValues.ClassThreshold), (options.Runs, options.Threshold));
    }

    [Fact]
    public void TheTheoryAttributeOverridesLikeTheFactAttribute()
    {
        var options = _harness.Effective(typeof(ClassDefaultsSample), new CrucibleTheoryAttribute { Runs = SampleValues.MethodRuns });

        Assert.Equal(SampleValues.MethodRuns, options.Runs);
    }

    [Fact]
    public void ANestedClassInheritsItsOuterClassAndOverridesIt()
    {
        var options = _harness.Effective(typeof(OuterSample.InnerSample), new CrucibleFactAttribute());

        Assert.Equal((SampleValues.InnerRuns, true), (options.Runs, options.Strict));
    }

    [Fact]
    public void ANestedClassWithoutItsOwnAttributeUsesItsOuterClass()
    {
        var options = _harness.Effective(typeof(OuterSample.SilentInnerSample), new CrucibleFactAttribute());

        Assert.Equal(SampleValues.OuterRuns, options.Runs);
    }

    [Fact]
    public void ADerivedClassInheritsItsBaseClassAndOverridesIt()
    {
        var options = _harness.Effective(typeof(DerivedSample), new CrucibleFactAttribute());

        Assert.Equal((SampleValues.DerivedRuns, SampleValues.BaseTestTimeout), (options.Runs, options.TestTimeout));
    }

    [Fact]
    public void RunsAreConcurrentUnlessALayerAsksForSequential()
    {
        Assert.False(_harness.Sequential(typeof(UndecoratedSample), new CrucibleFactAttribute()));
    }

    [Fact]
    public void AClassCanMakeItsTestsSequential()
    {
        Assert.True(_harness.Sequential(typeof(ClassDefaultsSample), new CrucibleFactAttribute()));
    }

    [Fact]
    public void AMethodCanMakeItsRunsConcurrentAgain()
    {
        Assert.False(_harness.Sequential(typeof(ClassDefaultsSample), new CrucibleFactAttribute { Sequential = false }));
    }

    [Fact]
    public void AnInvalidMethodSettingIsAUsageError()
    {
        var error = _harness.Rejection(typeof(UndecoratedSample), new CrucibleFactAttribute { Runs = SampleValues.InvalidRuns });

        Assert.Equal(CrucibleErrorKind.Usage, error.Kind);
    }

    [Fact]
    public void AnInvalidClassSettingIsAUsageError()
    {
        var error = _harness.Rejection(typeof(InvalidClassSample), new CrucibleFactAttribute());

        Assert.Equal(CrucibleErrorKind.Usage, error.Kind);
    }

    [Fact]
    public void TheFactAttributeMeasuresATest()
    {
        var options = _harness.Effective(typeof(UndecoratedSample), new CrucibleFactAttribute { Measure = true });

        Assert.True(options.Measure);
    }

    [Fact]
    public void TheTheoryAttributeMeasuresATest()
    {
        var options = _harness.Effective(typeof(UndecoratedSample), new CrucibleTheoryAttribute { Measure = true });

        Assert.True(options.Measure);
    }

    [Fact]
    public void TheClassAttributeMeasuresItsTests()
    {
        var options = _harness.Effective(typeof(MeasuredSample), new CrucibleFactAttribute());

        Assert.True(options.Measure);
    }

    [Fact]
    public void TheMethodAttributeGatesATestItsClassMeasures()
    {
        var options = _harness.Effective(typeof(MeasuredSample), new CrucibleFactAttribute { Measure = false });

        Assert.False(options.Measure);
    }
}
