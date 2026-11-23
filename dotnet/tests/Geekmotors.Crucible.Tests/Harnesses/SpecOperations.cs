namespace CrucibleAI.Tests.Harnesses;

internal static class SpecOperations
{
    public const string RunOptionsResolve = "run-options/resolve";
    public const string RunOptionsValidate = "run-options/validate";
    public const string VerdictCompute = "verdict/compute";
    public const string JsoncParse = "jsonc/parse";
    public const string ConfigLoad = "config/load";
    public const string ProviderRequest = "provider/request";
    public const string ProviderResponse = "provider/response";
    public const string ProviderUsage = "provider/usage";
    public const string ProviderPlainHttpWarning = "provider/plain-http-warning";
    public const string JudgeReply = "judge/reply";
    public const string PayloadCoherent = "payload/coherent";
    public const string PayloadExtract = "payload/extract";
    public const string ReportRender = "report/render";
    public const string ReportTrace = "report/trace";
    public const string AssertionCall = "assertion/call";

    private const string UnsetUnknownKeyReason =
        "Neither C# input can hold an unknown key whose value is unset: RunOptions has no member for an unknown key, "
        + "and JSON has no unset value (null is a value, rejected by the *-null cases). "
        + "run-options-validate-*-unknown-key covers the rule; the reader rejects an unknown key whatever its value.";

    private const string NotAStringReason =
        "The C# parameter is a string: a number or an object cannot be passed (the compiler rules it out). "
        + "A null or unset string is expressible and covered by the *-null/*-unset cases.";

    private const string MissingArgumentReason =
        "The C# parameter is required: a call without it does not compile.";

    private const string NullIsUnsetReason =
        "C# has one null, and README Special values makes it the unset value: JavaScript rejects null here but accepts unset, "
        + "a distinction a C# caller cannot make. The *-unset cases cover the unset value.";

    private const string TypedOptionsReason =
        "C# options are a typed record (CoherentOptions, ExtractOptions): a string, an array or an unknown key cannot be passed.";

    private const string NotAStringListReason =
        "C# facts are a string or a list of strings: a number, an object, a nested list or a list holding a number cannot be passed. "
        + "A null fact is expressible and covered by the null/unset cases.";

    private const string TypeArgumentReason =
        "The C# extract type is the generic argument (ExtractAsync<T>), not a string: a mis-cased or null type name cannot be written. "
        + "An unsupported type is covered by assertion-call-extract-as-unknown-type (ExtractAsync<DateTime>).";

    private const string NotABooleanReason =
        "The C# strict option is a bool?: a string or a number cannot be passed.";

    public static IReadOnlyDictionary<string, SpecOperation> Implemented { get; } =
        new Dictionary<string, SpecOperation>(StringComparer.Ordinal)
        {
            [RunOptionsResolve] = SpecOperation.Value(RunOptionsFixtureHarness.Resolve),
            [RunOptionsValidate] = SpecOperation.Value(RunOptionsFixtureHarness.Validate),
            [VerdictCompute] = SpecOperation.Value(VerdictFixtureHarness.Compute),
            [JsoncParse] = SpecOperation.Value(JsoncFixtureHarness.Parse),
            [ConfigLoad] = SpecOperation.Value(ConfigFixtureHarness.Load),
            [ProviderRequest] = SpecOperation.Value(ProviderFixtureHarness.RequestAsync),
            [ProviderResponse] = SpecOperation.Text(ProviderFixtureHarness.ResponseAsync),
            [ProviderUsage] = SpecOperation.Value(ProviderFixtureHarness.Usage),
            [ProviderPlainHttpWarning] = SpecOperation.Value(PlainHttpFixtureHarness.Decide),
            [JudgeReply] = SpecOperation.Value(JudgeReplyFixtureHarness.AskAsync),
            [PayloadCoherent] = SpecOperation.Text(PayloadFixtureHarness.CoherentAsync),
            [PayloadExtract] = SpecOperation.Text(PayloadFixtureHarness.ExtractAsync),
            [AssertionCall] = SpecOperation.Text(AssertionCallFixtureHarness.CallAsync),
            [ReportRender] = SpecOperation.Text(ReportFixtureHarness.Render),
            [ReportTrace] = SpecOperation.Text(TraceFixtureHarness.Trace),
        };

    public static IReadOnlySet<string> Pending { get; } = new HashSet<string>(StringComparer.Ordinal);

    public static IReadOnlyDictionary<string, string> Skipped { get; } = new Dictionary<string, string>(StringComparer.Ordinal)
    {
        ["run-options-validate-test-unknown-key-unset"] = UnsetUnknownKeyReason,
        ["run-options-validate-group-unknown-key-unset"] = UnsetUnknownKeyReason,
        ["assertion-call-coherent-actual-number"] = NotAStringReason,
        ["assertion-call-coherent-expectation-object"] = NotAStringReason,
        ["assertion-call-extract-text-number"] = NotAStringReason,
        ["assertion-call-extract-description-number"] = NotAStringReason,
        ["assertion-call-coherent-expectation-missing"] = MissingArgumentReason,
        ["assertion-call-extract-description-missing"] = MissingArgumentReason,
        ["assertion-call-coherent-options-null"] = NullIsUnsetReason,
        ["assertion-call-coherent-facts-null"] = NullIsUnsetReason,
        ["assertion-call-extract-options-null"] = NullIsUnsetReason,
        ["assertion-call-extract-as-null"] = TypeArgumentReason,
        ["assertion-call-extract-strict-null"] = NullIsUnsetReason,
        ["assertion-call-extract-facts-null"] = NullIsUnsetReason,
        ["assertion-call-coherent-options-string"] = TypedOptionsReason,
        ["assertion-call-coherent-options-array"] = TypedOptionsReason,
        ["assertion-call-coherent-unknown-option"] = TypedOptionsReason,
        ["assertion-call-coherent-extract-option"] = TypedOptionsReason,
        ["assertion-call-coherent-unknown-option-unset"] = TypedOptionsReason,
        ["assertion-call-extract-options-string"] = TypedOptionsReason,
        ["assertion-call-extract-options-array"] = TypedOptionsReason,
        ["assertion-call-extract-unknown-option"] = TypedOptionsReason,
        ["assertion-call-extract-unknown-option-unset"] = TypedOptionsReason,
        ["assertion-call-coherent-facts-number"] = NotAStringListReason,
        ["assertion-call-coherent-facts-object"] = NotAStringListReason,
        ["assertion-call-coherent-facts-mixed-array"] = NotAStringListReason,
        ["assertion-call-coherent-facts-nested-array"] = NotAStringListReason,
        ["assertion-call-facts-number"] = NotAStringListReason,
        ["assertion-call-facts-object"] = NotAStringListReason,
        ["assertion-call-facts-mixed-array"] = NotAStringListReason,
        ["assertion-call-facts-error-after-valid-call"] = NotAStringListReason,
        ["assertion-call-extract-facts-number"] = NotAStringListReason,
        ["assertion-call-extract-facts-object"] = NotAStringListReason,
        ["assertion-call-extract-run-facts-invalid"] = NotAStringListReason,
        ["assertion-call-extract-as-wrong-casing"] = TypeArgumentReason,
        ["assertion-call-extract-strict-string"] = NotABooleanReason,
        ["assertion-call-extract-strict-number"] = NotABooleanReason,
    };

    public static IEnumerable<string> Covered => Implemented.Keys.Concat(Pending);
}
