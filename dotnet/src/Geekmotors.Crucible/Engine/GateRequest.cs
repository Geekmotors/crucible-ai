namespace CrucibleAI.Engine;

internal sealed record GateRequest(
    IReadOnlyList<RunOptions> Groups,
    RunOptions Declared,
    Func<int, Task<RunBody>> BodyFor,
    bool Sequential,
    string? Name = null,
    CancellationToken Cancellation = default);
