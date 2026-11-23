using Microsoft.Extensions.AI;

namespace CrucibleAI.Tests.Fakes;

internal sealed class ScriptedChatClient(params object[] script) : IChatClient
{
    private readonly Queue<object> _script = new(script);

    public Task<ChatResponse> GetResponseAsync(
        IEnumerable<ChatMessage> messages, ChatOptions? options = null, CancellationToken cancellationToken = default) =>
        _script.Dequeue() switch
        {
            Exception failure => Task.FromException<ChatResponse>(failure),
            ChatResponse response => Task.FromResult(response),
            var reply => Task.FromResult(new ChatResponse(new ChatMessage(ChatRole.Assistant, (string)reply))),
        };

    public IAsyncEnumerable<ChatResponseUpdate> GetStreamingResponseAsync(
        IEnumerable<ChatMessage> messages, ChatOptions? options = null, CancellationToken cancellationToken = default) =>
        throw new NotSupportedException();

    public object? GetService(Type serviceType, object? serviceKey = null) => serviceType.IsInstanceOfType(this) ? this : null;

    public void Dispose()
    {
    }
}
