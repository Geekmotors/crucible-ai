using System.Text.Json.Nodes;
using CrucibleAI.Json;
using CrucibleAI.Options;
using CrucibleAI.Providers;
using CrucibleAI.Text;
using CrucibleAI.Urls;

namespace CrucibleAI.Config;

internal sealed class ConfigLoader(ConfigFileLocator files, IEnvironment environment)
{
    public const string VerbosityVariable = "CRUCIBLE_VERBOSE";
    public const string ModeVariable = "CRUCIBLE_MODE";
    public const string MeasureRunsVariable = "CRUCIBLE_MEASURE_RUNS";

    private const string MeasureMode = "measure";
    private const int MaxMeasureRuns = 1000;

    private const string JsonFileName = "crucible.config.json";
    private const string JsoncFileName = "crucible.config.jsonc";
    private const string ProviderField = "provider";
    private const string ModelField = "model";
    private const string MetaField = "meta";
    private const string VerbosityField = "verbosity";
    private const string TestDefaultsField = "testDefaults";
    private const string ExcerptCharsField = "excerptChars";
    private const string BaseUrlField = "baseUrl";
    private const string ApiKeyEnvField = "apiKeyEnv";
    private const string SchemaField = "$schema";
    private const int DefaultExcerptChars = 500;

    private static readonly string[] FileNames = [JsonFileName, JsoncFileName];

    private static readonly string[] JudgeFields = [ProviderField, ModelField, BaseUrlField, ApiKeyEnvField, MetaField];

    private static readonly string[] KnownFields =
    [
        ProviderField, ModelField, MetaField, VerbosityField, TestDefaultsField, ExcerptCharsField, BaseUrlField, ApiKeyEnvField, SchemaField,
    ];

    private static readonly HashSet<string> KeyLikeFields = new(StringComparer.Ordinal)
    {
        "apikey", "api_key", "key", "token", "secret", "authorization",
    };

    private static readonly Dictionary<string, ProviderKind> Providers = new(StringComparer.Ordinal)
    {
        ["openrouter"] = ProviderKind.OpenRouter,
        ["openai"] = ProviderKind.OpenAi,
        ["openai-compatible"] = ProviderKind.OpenAiCompatible,
    };

    private static readonly Dictionary<string, Verbosity> Levels = new(StringComparer.Ordinal)
    {
        ["default"] = Verbosity.Default,
        ["full"] = Verbosity.Full,
        ["debug"] = Verbosity.Debug,
    };

    private readonly JsoncReader _reader = new();

    public static IReadOnlyList<string> Fields => KnownFields;

    public static IEnumerable<string> ProviderNames => Providers.Keys;
    private readonly HttpUrlParser _urls = new();
    private readonly RunOptionsReader _runOptions = new(new RunOptionsValidator());

    public ConfigLoader()
        : this(new ConfigFileLocator(), new ProcessEnvironment())
    {
    }

    public JudgeConfig Load()
    {
        var root = Root(ReadFile() ?? throw Missing());
        RejectKeyLikeFields(root);
        RejectUnknownFields(root);
        var providerName = RequireName(root, ProviderField);
        var baseUrl = OptionalBaseUrl(root);
        var apiKeyEnv = OptionalApiKeyEnv(root);
        var provider = RequireProvider(providerName, baseUrl);
        var model = RequireName(root, ModelField);
        var meta = OptionalMeta(root);
        var run = Run(root);
        return new JudgeConfig(
            provider, model, meta, run.Verbosity, run.TestDefaults, run.TestDefaultsNode, run.ExcerptChars, baseUrl, apiKeyEnv, run.Invocation);
    }

    public RunSettings LoadRunSettings(IWarningSink warnings)
    {
        var root = ReadFile() is { } text ? Root(text) : [];
        RejectKeyLikeFields(root);
        RejectUnknownFields(root);
        var ignored = JudgeFields.Where(root.ContainsKey).ToArray();
        if (ignored.Length > 0)
        {
            warnings.Write(
                $"Crucible: the judge is the IChatClient passed to Crucible.UseJudge, so {string.Join(", ", ignored)} "
                + "in the config file are ignored. Remove them to silence this warning.");
        }
        return Run(root);
    }

    private RunSettings Run(JsonObject root)
    {
        var verbosity = EffectiveVerbosity(root);
        var testDefaults = root.TryGetPropertyValue(TestDefaultsField, out var defaults)
            ? _runOptions.Read(defaults, RunOptionsSource.Config)
            : new RunOptions();
        var testDefaultsNode = defaults as JsonObject ?? [];
        var excerptChars = ExcerptChars(root);
        return new RunSettings(verbosity, testDefaults, testDefaultsNode, excerptChars, ReadInvocation());
    }

    private Invocation ReadInvocation()
    {
        var mode = environment.Get(ModeVariable);
        var measure = !string.IsNullOrEmpty(mode);
        if (measure && !string.Equals(mode, MeasureMode, StringComparison.Ordinal))
        {
            throw CrucibleException.Usage($"Invalid {ModeVariable}. Set it to \"{MeasureMode}\" or leave it empty.");
        }
        var runs = environment.Get(MeasureRunsVariable);
        return new Invocation(measure, string.IsNullOrEmpty(runs) ? null : MeasureRuns(runs));
    }

    private static int MeasureRuns(string text)
    {
        var digitsOnly = text.Length is >= 1 and <= 4 && text[0] != '0' && text.All(character => character is >= '0' and <= '9');
        if (digitsOnly && int.Parse(text, System.Globalization.CultureInfo.InvariantCulture) is var runs and <= MaxMeasureRuns)
        {
            return runs;
        }
        throw CrucibleException.Usage(
            $"Invalid {MeasureRunsVariable}. Set it to a whole number from 1 to {MaxMeasureRuns.ToString(System.Globalization.CultureInfo.InvariantCulture)}.");
    }

    private string? ReadFile()
    {
        var reads = FileNames.Select(name => (Name: name, Read: files.Read(name))).ToList();
        if (reads.FirstOrDefault(entry => entry.Read.State == ConfigFileState.Unreadable) is { Name: { } unreadable })
        {
            throw Failure($"Could not read {files.Location(unreadable)}.");
        }
        var found = reads.Where(entry => entry.Read.State == ConfigFileState.Found).ToList();
        return found.Count switch
        {
            0 => null,
            1 => found[0].Read.Text,
            _ => throw Failure($"Found both {files.Location(JsonFileName)} and {JsoncFileName}. Keep one and delete the other."),
        };
    }

    private CrucibleException Missing() =>
        Failure(
            $"Could not find {JsonFileName} or {JsoncFileName} in {files.Folder} (the working directory, the test output "
            + "folder under xUnit). Create either file with at least { \"provider\": \"...\", \"model\": \"...\" } beside "
            + "the test project's .csproj: Geekmotors.Crucible.Xunit copies it to the output folder on build. "
            + "Or pass an IChatClient to Crucible.UseJudge.");

    private JsonObject Root(string text) =>
        _reader.Read(text) as JsonObject ?? throw Failure("The config file must contain a single JSON object at the root.");

    private static void RejectKeyLikeFields(JsonObject root)
    {
        if (root.Select(member => member.Key).FirstOrDefault(name => KeyLikeFields.Contains(name.ToLowerInvariant())) is { } keyLike)
        {
            throw Failure(
                $"The config file must never contain API keys: remove \"{keyLike}\" and set the key in the environment variable "
                + "\"apiKeyEnv\" names (default CRUCIBLE_JUDGE_KEY) instead.");
        }
    }

    private static void RejectUnknownFields(JsonObject root)
    {
        if (root.Select(member => member.Key).FirstOrDefault(name => !KnownFields.Contains(name, StringComparer.Ordinal)) is { } unknown)
        {
            throw Failure($"Unknown field \"{unknown}\" in the config file. Allowed fields: {string.Join(", ", KnownFields)}.");
        }
    }

    private static string RequireName(JsonObject root, string field) =>
        root.TryGetPropertyValue(field, out var node) && Text(node) is { } text && EcmaScriptTrim.Trim(text).Length > 0
            ? text
            : throw Failure($"\"{field}\" in the config file must be a non-empty string.");

    private HttpUrl? OptionalBaseUrl(JsonObject root)
    {
        if (!root.TryGetPropertyValue(BaseUrlField, out var node))
        {
            return null;
        }
        if (Text(node) is { } text && text.IndexOfAny(['?', '#']) < 0 && _urls.Parse(text) is { HasCredentials: false } url)
        {
            return url;
        }
        throw Failure(
            "\"baseUrl\" in the config file must be an http or https URL without credentials, query or fragment, "
            + "e.g. \"http://localhost:11434/v1\".");
    }

    private static string? OptionalApiKeyEnv(JsonObject root)
    {
        if (!root.TryGetPropertyValue(ApiKeyEnvField, out var node))
        {
            return null;
        }
        return Text(node) is { } name && IsVariableName(name)
            ? name
            : throw Failure(
                "\"apiKeyEnv\" in the config file must be the name of an environment variable "
                + "(letters, digits and underscores, not starting with a digit), never the key itself.");
    }

    private static bool IsVariableName(string name) =>
        name.Length > 0
        && (char.IsAsciiLetter(name[0]) || name[0] == '_')
        && name.All(unit => char.IsAsciiLetterOrDigit(unit) || unit == '_');

    private static ProviderKind RequireProvider(string name, HttpUrl? baseUrl)
    {
        if (!Providers.TryGetValue(name, out var provider))
        {
            throw Failure($"Unknown provider \"{name}\". Supported providers: {string.Join(", ", Providers.Keys)}.");
        }
        if (provider == ProviderKind.OpenAiCompatible && baseUrl is null)
        {
            throw Failure("The \"openai-compatible\" provider needs \"baseUrl\" in the config file.");
        }
        if (provider != ProviderKind.OpenAiCompatible && baseUrl is not null)
        {
            throw Failure($"The \"{name}\" provider takes no \"baseUrl\"; remove it from the config file.");
        }
        return provider;
    }

    private static JsonObject? OptionalMeta(JsonObject root)
    {
        if (!root.TryGetPropertyValue(MetaField, out var node))
        {
            return null;
        }
        return node as JsonObject ?? throw Failure("\"meta\" in the config file must be an object when present.");
    }

    private Verbosity EffectiveVerbosity(JsonObject root)
    {
        var configured = Verbosity.Default;
        if (root.TryGetPropertyValue(VerbosityField, out var node))
        {
            configured = Text(node) is { } name && Levels.TryGetValue(name, out var level)
                ? level
                : throw Failure($"\"verbosity\" in the config file must be one of {string.Join(", ", Levels.Keys)}.");
        }
        var overridden = environment.Get(VerbosityVariable);
        if (string.IsNullOrEmpty(overridden))
        {
            return configured;
        }
        return Levels.TryGetValue(overridden, out var chosen)
            ? chosen
            : throw CrucibleException.Usage(
                $"Invalid verbosity in the {VerbosityVariable} environment variable. Valid levels: {string.Join(", ", Levels.Keys)}.");
    }

    private static int ExcerptChars(JsonObject root)
    {
        if (!root.TryGetPropertyValue(ExcerptCharsField, out var node))
        {
            return DefaultExcerptChars;
        }
        if (node is JsonValue value && value.TryGetValue<double>(out var number)
            && Math.Floor(number) == number && number >= 1 && number <= int.MaxValue)
        {
            return (int)number;
        }
        throw Failure("\"excerptChars\" in the config file must be an integer of at least 1.");
    }

    private static string? Text(JsonNode? node) => node is JsonValue value && value.TryGetValue<string>(out var text) ? text : null;

    private static CrucibleException Failure(string message) => CrucibleException.Config(message);
}
