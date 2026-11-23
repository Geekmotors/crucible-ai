using System.Net;
using CrucibleAI.Providers;
using CrucibleAI.Runs;
using CrucibleAI.Tracing;
using Microsoft.Extensions.AI;

namespace CrucibleAI.ChatClients;

internal sealed class ChatClientJudge(IChatClient client, ChatOptions? options, IRetryBackoff backoff) : IJudgeClient
{
    public const string Name = "chat-client";
    public const string StampedProvider = "IChatClient";

    private const int MaxAttempts = 3;
    private const string ClientDefaultModel = "(client default)";
    private const string StatusProperty = "Status";

    private readonly ChatClientUsageReader _usage = new();

    public ChatClientJudge(IChatClient client, ChatOptions? options)
        : this(client, options, new ExponentialBackoff())
    {
    }

    public string Model { get; } =
        Named(options?.ModelId) ?? Named((client.GetService(typeof(ChatClientMetadata)) as ChatClientMetadata)?.DefaultModelId) ?? ClientDefaultModel;

    public async Task<string> CompleteAsync(JudgeRequest request, IJudgeObserver observer, CancellationToken cancellation)
    {
        Exception? lastFailure = null;
        for (var attempt = 1; attempt <= MaxAttempts; attempt++)
        {
            cancellation.ThrowIfCancellationRequested();
            observer.Observe(new ProviderRequestEvent(Name, Model, request.System, null, request.Prompt, attempt));
            try
            {
                var response = await client.GetResponseAsync(Messages(request), CallOptions(), cancellation).ConfigureAwait(false);
                var reply = response?.Text ?? string.Empty;
                observer.Observe(new ProviderResponseEvent(attempt, reply));
                observer.Spent(_usage.Read(response));
                return reply;
            }
            catch (Exception failure) when (cancellation.IsCancellationRequested && failure is not OutOfMemoryException)
            {
                observer.Observe(Failure(attempt, failure, ProviderFailureNext.Aborted));
                cancellation.ThrowIfCancellationRequested();
                throw;
            }
            catch (Exception failure) when (IsTransient(failure) || HasTransientStatus(failure))
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
            catch (Exception failure) when (failure is not OutOfMemoryException)
            {
                observer.Observe(Failure(attempt, failure, ProviderFailureNext.Fatal));
                throw CrucibleException.Infra($"The IChatClient judge failed: {failure.Message}", false, failure);
            }
        }
        throw CrucibleException.Infra($"The IChatClient judge kept failing after {MaxAttempts} attempts.", true, lastFailure);
    }

    private ChatOptions? CallOptions()
    {
        var copy = options?.Clone();
        if (copy is not null)
        {
            copy.ConversationId = null;
        }
        return copy;
    }

    private static bool HasTransientStatus(Exception failure)
    {
        var visited = new HashSet<Exception>(ReferenceEqualityComparer.Instance);
        for (var current = failure; current is not null && visited.Add(current); current = current.InnerException)
        {
            if (current.GetType().GetProperty(StatusProperty, typeof(int))?.GetValue(current) is int status)
            {
                return status is (int)HttpStatusCode.RequestTimeout or (int)HttpStatusCode.TooManyRequests or >= 500 and < 600;
            }
        }
        return false;
    }

    private static string? Named(string? model) => string.IsNullOrWhiteSpace(model) ? null : model;

    private static ChatMessage[] Messages(JudgeRequest request) =>
        [new(ChatRole.System, request.System), new(ChatRole.User, request.Prompt)];

    private static bool IsTransient(Exception failure) => failure switch
    {
        HttpRequestException { StatusCode: null } => true,
        HttpRequestException { StatusCode: { } status } => status is HttpStatusCode.RequestTimeout or HttpStatusCode.TooManyRequests || (int)status >= 500,
        TimeoutException or IOException or OperationCanceledException => true,
        _ => false,
    };

    private static ProviderFailureEvent Failure(int attempt, Exception failure, ProviderFailureNext next, double delayMs = 0) =>
        new(attempt, RunCause.Of(failure), next, delayMs);
}
