using System.Net;
using System.Text;
using System.Text.Json.Nodes;

namespace CrucibleAI.Tests.Harnesses;

internal static class HttpAnswers
{
    private const string JsonMediaType = "application/json";

    public static Func<HttpRequestMessage, CancellationToken, Task<HttpResponseMessage>> Text(int status, string body) =>
        (_, _) => Task.FromResult(new HttpResponseMessage((HttpStatusCode)status) { Content = new StringContent(body, Encoding.UTF8) });

    public static Func<HttpRequestMessage, CancellationToken, Task<HttpResponseMessage>> Json(int status, JsonNode? body) =>
        (_, _) => Task.FromResult(new HttpResponseMessage((HttpStatusCode)status)
        {
            Content = new StringContent(body?.ToJsonString() ?? "null", Encoding.UTF8, JsonMediaType),
        });

    public static Func<HttpRequestMessage, CancellationToken, Task<HttpResponseMessage>> Reply(string reply) =>
        Json(200, Envelope(reply));

    public static Func<HttpRequestMessage, CancellationToken, Task<HttpResponseMessage>> Served(string reply, string model, int tokens, double cost)
    {
        var envelope = Envelope(reply);
        envelope["model"] = model;
        envelope["usage"] = new JsonObject { ["total_tokens"] = tokens, ["cost"] = cost };
        return Json(200, envelope);
    }

    public static Func<HttpRequestMessage, CancellationToken, Task<HttpResponseMessage>> ServedOnlyAt(string url, string reply) =>
        (request, cancellation) => request.RequestUri!.AbsoluteUri == url
            ? Reply(reply)(request, cancellation)
            : Json(404, null)(request, cancellation);

    public static Func<HttpRequestMessage, CancellationToken, Task<HttpResponseMessage>> NetworkFailure() =>
        (_, _) => throw new HttpRequestException();

    public static Func<HttpRequestMessage, CancellationToken, Task<HttpResponseMessage>> BrokenStream() =>
        (_, _) => throw new IOException();

    public static Func<HttpRequestMessage, CancellationToken, Task<HttpResponseMessage>> ServerErrorWhileCancelling(CancellationTokenSource cancellation) =>
        (request, token) =>
        {
            cancellation.Cancel();
            return Json(500, null)(request, token);
        };

    public static Func<HttpRequestMessage, CancellationToken, Task<HttpResponseMessage>> ReplyDeclaringCharset(string reply, string charset) =>
        (_, _) =>
        {
            var content = new ByteArrayContent(Encoding.UTF8.GetBytes(Envelope(reply).ToJsonString()));
            content.Headers.TryAddWithoutValidation("Content-Type", $"{JsonMediaType}; charset={charset}");
            return Task.FromResult(new HttpResponseMessage(HttpStatusCode.OK) { Content = content });
        };

    public static Func<HttpRequestMessage, CancellationToken, Task<HttpResponseMessage>> Never() =>
        async (_, cancellation) =>
        {
            await Task.Delay(Timeout.Infinite, cancellation);
            throw new OperationCanceledException(cancellation);
        };

    public static Func<HttpRequestMessage, CancellationToken, Task<HttpResponseMessage>> Echo() =>
        async (request, cancellation) =>
        {
            var echoed = new JsonObject
            {
                ["method"] = request.Method.Method,
                ["url"] = request.RequestUri!.AbsoluteUri,
                ["headers"] = Headers(request),
                ["body"] = JsonNode.Parse(await request.Content!.ReadAsStringAsync(cancellation)),
            };
            return new HttpResponseMessage(HttpStatusCode.OK)
            {
                Content = new StringContent(Envelope(echoed.ToJsonString()).ToJsonString(), Encoding.UTF8, JsonMediaType),
            };
        };

    private static JsonObject Envelope(string reply) => new()
    {
        ["choices"] = new JsonArray(new JsonObject { ["message"] = new JsonObject { ["role"] = "assistant", ["content"] = reply } }),
    };

    private static JsonObject Headers(HttpRequestMessage request)
    {
        var headers = new JsonObject();
        var all = request.Headers.NonValidated.Concat(request.Content?.Headers.NonValidated ?? default);
        foreach (var (name, values) in all)
        {
            headers[name] = string.Join(", ", values);
        }
        return headers;
    }
}
