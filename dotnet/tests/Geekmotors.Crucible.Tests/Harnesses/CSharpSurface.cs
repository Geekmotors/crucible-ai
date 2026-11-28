using System.Reflection;
using CrucibleAI.Config;
using CrucibleAI.Providers;

namespace CrucibleAI.Tests.Harnesses;

internal static class CSharpSurface
{
    private const string ItReason =
        "Registration belongs to the runner adapter: [CrucibleFact] / [CrucibleTheory] in the Geekmotors.Crucible.Xunit package. "
        + "Crucible.Gate is the framework-neutral form inside any test method.";

    private const string DescribeReason =
        "xUnit, NUnit and MSTest have no group callbacks: group settings come from class or assembly attributes, "
        + "nearest wins ([Crucible(...)] in the Geekmotors.Crucible.Xunit package; PORTING section 2).";

    private const string DeprecatedAliasReason =
        "Deprecated alias of crucible.facts; PORTING section 1 lets a new port leave it out, and TypeScript removes it in 1.0.";

    private const string AsReason = "The type argument of ExtractAsync<T> (string, int?, long?, double?, bool?).";

    private const string PassedReason = "A gate that passed completes its task without throwing CrucibleVerdictException.";

    private static readonly IReadOnlyDictionary<string, SurfaceMapping> Mappings = Build();

    public static IReadOnlySet<string> CSharpAdditions { get; } = new HashSet<string>(StringComparer.Ordinal)
    {
        $"{nameof(Crucible)}.{nameof(Crucible.Context)}",
        $"{nameof(CrucibleContext)}.{nameof(CrucibleContext.Run)}",
        $"{nameof(CrucibleContext)}.{nameof(CrucibleContext.CancellationToken)}",
        $"{nameof(Crucible)}.{nameof(Crucible.UseJudge)}",
    };

    public static IReadOnlyCollection<string> MappedKeys => [.. Mappings.Keys];

    public static IReadOnlyList<Type> PublicTypes { get; } =
    [
        typeof(Crucible),
        typeof(CrucibleContext),
        typeof(RunOptions),
        typeof(CoherentOptions),
        typeof(ExtractOptions),
        typeof(CrucibleException),
        typeof(CrucibleErrorKind),
        typeof(CrucibleVerdictException),
        typeof(VerdictOutcome),
    ];

    public static SurfaceMapping? For(string key) => Mappings.GetValueOrDefault(key);

    public static IEnumerable<string> MappedMembers => Mappings.Values.SelectMany(mapping => mapping.Members);

    public static IEnumerable<string> PublicMembers =>
        new[] { typeof(Crucible), typeof(CrucibleContext), typeof(RunOptions), typeof(CoherentOptions), typeof(ExtractOptions) }
            .SelectMany(type => type
                .GetMembers(BindingFlags.Public | BindingFlags.Static | BindingFlags.Instance | BindingFlags.DeclaredOnly)
                .Where(member => member is PropertyInfo || member is MethodInfo { IsSpecialName: false })
                .Where(member => !member.Name.StartsWith('<') && member.Name is not ("Equals" or "GetHashCode" or "ToString"))
                .Select(member => $"{type.Name}.{member.Name}"))
            .Distinct(StringComparer.Ordinal);

    private static Dictionary<string, SurfaceMapping> Build()
    {
        var mappings = new Dictionary<string, SurfaceMapping>(StringComparer.Ordinal)
        {
            ["functions:crucible.it"] = SurfaceMapping.Absent(ItReason),
            ["functions:crucible.describe"] = SurfaceMapping.Absent(DescribeReason),
            ["functions:crucible.gate"] = Method(typeof(Crucible), nameof(Crucible.Gate)),
            ["functions:crucible.coherent"] = Method(typeof(Crucible), nameof(Crucible.CoherentAsync)),
            ["functions:crucible.extract"] = Method(typeof(Crucible), nameof(Crucible.ExtractAsync)),
            ["functions:crucible.facts"] = Method(typeof(Crucible), nameof(Crucible.Facts)),
            ["functions:crucible.load"] = SurfaceMapping.Absent(DeprecatedAliasReason),
            ["functions:crucible.append"] = SurfaceMapping.Absent(DeprecatedAliasReason),
            ["functions:t.facts"] = Method(typeof(CrucibleContext), nameof(CrucibleContext.Facts)),
            ["functions:t.coherent"] = Method(typeof(CrucibleContext), nameof(CrucibleContext.CoherentAsync)),
            ["functions:t.extract"] = Method(typeof(CrucibleContext), nameof(CrucibleContext.ExtractAsync)),
            ["runOptions:runs"] = Property(typeof(RunOptions), nameof(RunOptions.Runs)),
            ["runOptions:threshold"] = Property(typeof(RunOptions), nameof(RunOptions.Threshold)),
            ["runOptions:inferenceTimeout"] = Property(typeof(RunOptions), nameof(RunOptions.InferenceTimeout)),
            ["runOptions:testTimeout"] = Property(typeof(RunOptions), nameof(RunOptions.TestTimeout)),
            ["runOptions:strict"] = Property(typeof(RunOptions), nameof(RunOptions.Strict)),
            ["runOptions:measure"] = Property(typeof(RunOptions), nameof(RunOptions.Measure)),
            ["callOptions:coherent.facts"] = Property(typeof(CoherentOptions), nameof(CoherentOptions.Facts)),
            ["callOptions:extract.as"] = SurfaceMapping.To(typeof(CrucibleContext).GetMethod(nameof(CrucibleContext.ExtractAsync))!.IsGenericMethodDefinition, AsReason),
            ["callOptions:extract.strict"] = Property(typeof(ExtractOptions), nameof(ExtractOptions.Strict)),
            ["callOptions:extract.facts"] = Property(typeof(ExtractOptions), nameof(ExtractOptions.Facts)),
            ["environment:CRUCIBLE_JUDGE_KEY"] = SurfaceMapping.To(true, ChatEndpoint.DefaultKeyVariable),
            ["environment:CRUCIBLE_VERBOSE"] = SurfaceMapping.To(true, ConfigLoader.VerbosityVariable),
            ["environment:CRUCIBLE_MODE"] = SurfaceMapping.To(true, ConfigLoader.ModeVariable),
            ["environment:CRUCIBLE_MEASURE_RUNS"] = SurfaceMapping.To(true, ConfigLoader.MeasureRunsVariable),
            ["errorKinds:usage"] = ErrorKind(CrucibleErrorKind.Usage),
            ["errorKinds:config"] = ErrorKind(CrucibleErrorKind.Config),
            ["errorKinds:infra(retryable: true)"] = ErrorKind(CrucibleErrorKind.Infra),
            ["errorKinds:infra(retryable: false)"] = ErrorKind(CrucibleErrorKind.Infra),
            ["verdictOutcomes:passed"] = SurfaceMapping.To(true, PassedReason),
            ["verdictOutcomes:failed"] = Outcome(VerdictOutcome.Failed),
            ["verdictOutcomes:errored"] = Outcome(VerdictOutcome.Errored),
        };
        foreach (var field in ConfigLoader.Fields)
        {
            mappings[$"configFields:{field}"] = SurfaceMapping.To(true, field);
        }
        foreach (var provider in ConfigLoader.ProviderNames)
        {
            mappings[$"providers:{provider}"] = SurfaceMapping.To(true, provider);
        }
        foreach (var operation in SpecOperations.Implemented.Keys)
        {
            mappings[$"operations:{operation}"] = SurfaceMapping.To(true, operation);
        }
        foreach (var item in SurfaceManifest.Items.Where(item => item.Key.StartsWith("reportText:", StringComparison.Ordinal)))
        {
            mappings[item.Key] = SurfaceMapping.To(true, SpecOperations.ReportRender, SpecOperations.ReportTrace);
        }
        return mappings;
    }

    private static SurfaceMapping Method(Type type, string name) =>
        SurfaceMapping.To(type.GetMethods(BindingFlags.Public | BindingFlags.Static | BindingFlags.Instance).Any(method => method.Name == name), $"{type.Name}.{name}");

    private static SurfaceMapping Property(Type type, string name) =>
        SurfaceMapping.To(type.GetProperty(name, BindingFlags.Public | BindingFlags.Static | BindingFlags.Instance) is not null, $"{type.Name}.{name}");

    private static SurfaceMapping ErrorKind(CrucibleErrorKind kind) =>
        SurfaceMapping.To(Enum.IsDefined(kind), $"{nameof(CrucibleErrorKind)}.{kind}");

    private static SurfaceMapping Outcome(VerdictOutcome outcome) =>
        SurfaceMapping.To(Enum.IsDefined(outcome), $"{nameof(VerdictOutcome)}.{outcome}");
}
