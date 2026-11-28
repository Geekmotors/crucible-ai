using System.Text.Json.Nodes;
using CrucibleAI.Options;

namespace CrucibleAI.Tests.Harnesses;

internal static class RunOptionsFixtureHarness
{
    private static readonly RunOptionsValidator Validator = new();
    private static readonly RunOptionsReader Reader = new(Validator);
    private static readonly RunOptionsResolver Resolver = new();

    private static readonly Dictionary<string, RunOptionsSource> Sources = new(StringComparer.Ordinal)
    {
        ["test"] = RunOptionsSource.Test,
        ["group"] = RunOptionsSource.Group,
        ["config"] = RunOptionsSource.Config,
    };

    public static JsonNode? Validate(JsonNode? input)
    {
        var request = input!.AsObject();
        var source = Sources[request["source"]!.GetValue<string>()];
        var accepted = request.TryGetPropertyValue("options", out var options)
            ? Reader.Read(options, source)
            : Validator.Validate(null, source);
        return RunOptionsJson.Of(accepted);
    }

    public static JsonNode? Resolve(JsonNode? input)
    {
        var layers = input!.AsObject();
        var declared = new List<RunOptions>();
        if (layers["testDefaults"] is { } testDefaults)
        {
            declared.Add(Reader.Read(testDefaults, RunOptionsSource.Config));
        }
        foreach (var group in layers["groups"]?.AsArray() ?? [])
        {
            declared.Add(Reader.Read(group, RunOptionsSource.Group));
        }
        if (layers["test"] is { } test)
        {
            declared.Add(Reader.Read(test, RunOptionsSource.Test));
        }
        var invocation = layers["invocation"] is JsonObject invoked
            ? new Invocation(invoked["mode"]?.GetValue<string>() == "measure", invoked["measureRuns"]?.GetValue<int>())
            : null;
        var resolved = Resolver.Resolve(declared, invocation);
        if (layers["call"] is JsonObject call)
        {
            resolved = resolved.ForCall(call["strict"]?.GetValue<bool>());
        }
        return RunOptionsJson.Of(resolved);
    }
}
