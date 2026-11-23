using System.Net.Http.Headers;
using CrucibleAI.Config;
using CrucibleAI.Runs;
using CrucibleAI.Tracing;

namespace CrucibleAI.Providers;

internal sealed class ChatCompletionsClient(JudgeConfig config, HttpClient http, IEnvironment environment, IRetryBackoff backoff, IWarningSink warnings)
    : IJudgeClient
{
    private const int MaxAttempts = 3;
    private const string JsonMediaType = "application/json";
    private const string AuthorizationHeader = "Authorization";

    private static readonly HttpClient SharedHttp = new(new SocketsHttpHandler { PooledConnectionLifetime = TimeSpan.FromMinutes(2) })
    {
        Timeout = Timeout.InfiniteTimeSpan,
    };

    private readonly ChatEndpoint _endpoint = ChatEndpoint.For(config);
    private readonly JudgeKeyReader _keys = new(environment);
    private readonly ChatResponseReader _responses = new();
    private readonly PlainHttpRule _plainHttp = new();
    private int _warnedPlainHttp;

    public ChatCompletionsClient(JudgeConfig config)
        : this(config, SharedHttp, new ProcessEnvironment(), new ExponentialBackoff(), new StandardErrorWarningSink())
    {
    }

    public async Task<string> CompleteAsync(JudgeRequest request, IJudgeObserver observer, CancellationToken cancellation)
    {
        var key = _keys.Read(_endpoint);
        var body = ChatRequestBody.Serialize(config.Model, config.Meta, request);
        WarnIfKeyTravelsInPlainText(key);
        Exception? lastFailure = null;
        for (var attempt = 1; attempt <= MaxAttempts; attempt++)
        {
            cancellation.ThrowIfCancellationRequested();
            observer.Observe(new ProviderRequestEvent(_endpoint.Name, config.Model, request.System, config.Meta, request.Prompt, attempt));
            try
            {
                using var message = Message(key, body);
                using var response = await http.SendAsync(message, cancellation).ConfigureAwait(false);
                var reply = await _responses.ReadAsync(response, cancellation).ConfigureAwait(false);
                observer.Observe(new ProviderResponseEvent(attempt, reply.Text));
                observer.Spent(reply.Usage);
                return reply.Text;
            }
            catch (Exception failure) when (cancellation.IsCancellationRequested && IsAttemptFailure(failure))
            {
                observer.Observe(Failure(attempt, failure, ProviderFailureNext.Aborted));
                cancellation.ThrowIfCancellationRequested();
                throw;
            }
            catch (ProviderAttemptException failure) when (failure.Fatal)
            {
                observer.Observe(Failure(attempt, failure, ProviderFailureNext.Fatal));
                throw CrucibleException.Infra($"The \"{_endpoint.Name}\" judge refused the request: {failure.Message}", false, failure);
            }
            catch (Exception failure) when (IsAttemptFailure(failure) && failure is not OperationCanceledException)
            {
                lastFailure = failure;
                if (attempt == MaxAttempts)
                {
                    observer.Observe(Failure(attempt, failure, ProviderFailureNext.Exhausted));
                    break;
                }
                var delay = backoff.Delay(attempt);
                observer.Observe(Failure(attempt, failure, ProviderFailureNext.Retry, delay.TotalMilliseconds));
                await backoff.WaitAsync(delay, cancellation).ConfigureAwait(false);
            }
        }
        throw CrucibleException.Infra($"The \"{_endpoint.Name}\" judge kept failing after {MaxAttempts} attempts.", true, lastFailure);
    }

    private static bool IsAttemptFailure(Exception failure) =>
        failure is ProviderAttemptException or HttpRequestException or IOException or OperationCanceledException;

    private static ProviderFailureEvent Failure(int attempt, Exception failure, ProviderFailureNext next, double delayMs = 0) =>
        new(attempt, RunCause.Of(failure), next, delayMs);

    private void WarnIfKeyTravelsInPlainText(string? key)
    {
        if (_endpoint.BaseUrl is { } baseUrl && _plainHttp.Warns(baseUrl, key is not null)
            && Interlocked.Exchange(ref _warnedPlainHttp, 1) == 0)
        {
            warnings.Write(
                $"Crucible: the judge key is sent unencrypted to {baseUrl.Host} over plain http. "
                + "Use https, or a loopback address for a local judge.");
        }
    }

    private HttpRequestMessage Message(string? key, byte[] body)
    {
        var message = new HttpRequestMessage(HttpMethod.Post, _endpoint.Url)
        {
            Content = new ByteArrayContent(body) { Headers = { ContentType = new MediaTypeHeaderValue(JsonMediaType) } },
        };
        if (key is not null)
        {
            message.Headers.TryAddWithoutValidation(AuthorizationHeader, $"Bearer {key}");
        }
        return message;
    }
}
