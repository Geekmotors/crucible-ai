using System.Globalization;
using System.Text;
using System.Text.Json.Nodes;
using CrucibleAI.Json;

namespace CrucibleAI.Providers;

internal sealed class ChatResponseReader
{
    private const int RequestTimeout = 408;
    private const int TooManyRequests = 429;

    private static readonly UTF8Encoding Utf8 = new(false, false);

    private static ReadOnlySpan<byte> Utf8ByteOrderMark => [0xEF, 0xBB, 0xBF];

    private readonly ChatUsageReader _usage = new();

    public async Task<ChatReply> ReadAsync(HttpResponseMessage response, CancellationToken cancellation)
    {
        var status = (int)response.StatusCode;
        if (status is < 200 or > 299)
        {
            throw StatusFailure(status);
        }
        var envelope = Parse(Utf8Text(await response.Content.ReadAsByteArrayAsync(cancellation).ConfigureAwait(false)));
        if (envelope is JsonObject members && members.TryGetPropertyValue("error", out var error) && error is not null)
        {
            throw error is JsonObject details && details["code"] is JsonValue code && code.TryGetValue<double>(out var number)
                ? StatusFailure(number)
                : Malformed("The provider reported an error without a numeric code.");
        }
        return envelope is JsonObject root && root["choices"] is JsonArray { Count: > 0 } choices
            && choices[0] is JsonObject choice
            && choice["message"] is JsonObject message
            && message["content"] is JsonValue content
            && content.TryGetValue<string>(out var reply)
            ? new ChatReply(reply, _usage.Read(root))
            : throw Malformed("The provider response holds no reply text.");
    }

    private static string Utf8Text(byte[] body)
    {
        var start = body.AsSpan().StartsWith(Utf8ByteOrderMark) ? Utf8ByteOrderMark.Length : 0;
        return Utf8.GetString(body, start, body.Length - start);
    }

    private static JsonNode? Parse(string body)
    {
        try
        {
            return JsonTextParser.Parse(body, JsonDialect.Strict);
        }
        catch (JsonSyntaxException failure)
        {
            throw new ProviderAttemptException("The provider response is not JSON.", false, failure);
        }
    }

    private static ProviderAttemptException StatusFailure(double status) =>
        new(
            $"The provider answered with status {status.ToString(CultureInfo.InvariantCulture)}.",
            status is >= 400 and < 500 and not RequestTimeout and not TooManyRequests);

    private static ProviderAttemptException Malformed(string message) => new(message, false);
}
