using System.Text.Json.Nodes;
using CrucibleAI.Config;
using CrucibleAI.Tests.Fakes;

namespace CrucibleAI.Tests.Harnesses;

internal static class ConfigFixtureHarness
{
    public const string ProjectDirectory = "/project";

    private static readonly Dictionary<ProviderKind, string> ProviderNames = new()
    {
        [ProviderKind.OpenRouter] = "openrouter",
        [ProviderKind.OpenAi] = "openai",
        [ProviderKind.OpenAiCompatible] = "openai-compatible",
    };

    private static readonly Dictionary<Verbosity, string> VerbosityNames = new()
    {
        [Verbosity.Default] = "default",
        [Verbosity.Full] = "full",
        [Verbosity.Debug] = "debug",
    };

    public static JsonNode? Load(JsonNode? input)
    {
        var config = Loader(input!["files"]!.AsObject(), input["env"]).Load();
        var output = new JsonObject
        {
            ["provider"] = ProviderNames[config.Provider],
            ["model"] = config.Model,
            ["verbosity"] = VerbosityNames[config.Verbosity],
            ["testDefaults"] = RunOptionsJson.Of(config.TestDefaults),
            ["excerptChars"] = config.ExcerptChars,
        };
        if (config.Meta is { } meta)
        {
            output["meta"] = meta.DeepClone();
        }
        if (config.Invocation.Measure)
        {
            output["mode"] = "measure";
        }
        if (config.Invocation.MeasureRuns is { } measureRuns)
        {
            output["measureRuns"] = measureRuns;
        }
        return output;
    }

    public static ConfigLoader Loader(JsonObject files, JsonNode? env)
    {
        var fileSystem = new FakeConfigFileSystem();
        foreach (var (name, file) in files)
        {
            var path = Path.Combine(ProjectDirectory, name);
            if (SpecialValueDecoder.IsUnreadable(file))
            {
                fileSystem.WithUnreadable(path, new UnauthorizedAccessException());
            }
            else
            {
                fileSystem.WithFile(path, file!.GetValue<string>());
            }
        }
        return new ConfigLoader(new ConfigFileLocator(fileSystem, () => ProjectDirectory), Environment(env));
    }

    public static FakeEnvironment Environment(JsonNode? env) =>
        new((env as JsonObject ?? []).ToDictionary(entry => entry.Key, entry => entry.Value!.GetValue<string>()));
}
