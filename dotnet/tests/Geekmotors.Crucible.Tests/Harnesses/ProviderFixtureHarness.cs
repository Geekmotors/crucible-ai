using System.Text.Json.Nodes;
using CrucibleAI.Providers;
using CrucibleAI.Tests.Fakes;

namespace CrucibleAI.Tests.Harnesses;

internal static class ProviderFixtureHarness
{
    private static readonly HashSet<string> ClientHeaders = new(StringComparer.OrdinalIgnoreCase)
    {
        "Content-Length", "User-Agent", "Accept", "Accept-Encoding", "Host", "Connection", "Transfer-Encoding",
    };

    private static readonly Dictionary<string, string> CanonicalHeaders = new(StringComparer.OrdinalIgnoreCase)
    {
        ["Authorization"] = "Authorization",
        ["Content-Type"] = "Content-Type",
    };

    public static async Task<JsonNode?> RequestAsync(JsonNode? input)
    {
        var environment = ConfigFixtureHarness.Environment(input!["env"]);
        var config = ProviderHarness.Load(input["config"]!.ToJsonString(), environment);
        var client = new ChatCompletionsClient(
            config, new HttpClient(new ScriptedHandler([HttpAnswers.Echo()])), environment, new ImmediateBackoff(), new RecordingWarningSink());
        var reply = await client.CompleteAsync(
            new JudgeRequest(input["system"]!.GetValue<string>(), input["prompt"]!.GetValue<string>()), new QuietJudgeObserver(), CancellationToken.None);
        var request = JsonNode.Parse(reply)!.AsObject();
        request["headers"] = Headers(request["headers"]!.AsObject());
        return request;
    }

    public static async Task<JsonNode?> ResponseAsync(JsonNode? input)
    {
        var answers = input!["responses"]!.AsArray().Select(Answer).ToArray();
        var reply = await new ProviderHarness(Constants.JudgeSettings.OpenRouterConfig).Client(answers)
            .CompleteAsync(ProviderHarness.Request, new QuietJudgeObserver(), CancellationToken.None);
        return JsonValue.Create(reply);
    }

    public static JsonNode? Usage(JsonNode? input) => RunRecordJson.Json(new ChatUsageReader().Read(input!["json"]));

    private static Func<HttpRequestMessage, CancellationToken, Task<HttpResponseMessage>> Answer(JsonNode? response)
    {
        var entry = response!.AsObject();
        if (entry.ContainsKey("failure"))
        {
            return HttpAnswers.NetworkFailure();
        }
        var status = entry["status"]!.GetValue<int>();
        return entry.TryGetPropertyValue("text", out var text)
            ? HttpAnswers.Text(status, text!.GetValue<string>())
            : HttpAnswers.Json(status, entry["json"]);
    }

    private static JsonObject Headers(JsonObject observed)
    {
        var headers = new JsonObject();
        foreach (var (name, value) in observed.Where(header => !ClientHeaders.Contains(header.Key)))
        {
            headers[CanonicalHeaders.GetValueOrDefault(name, name)] = value?.DeepClone();
        }
        return headers;
    }
}
