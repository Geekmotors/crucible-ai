using CrucibleAI.Verdicts;

namespace CrucibleAI.Runs;

internal sealed record RunResult(RunStatus Status, RunCause? Cause, IReadOnlyList<JudgeCall> Calls, IReadOnlyList<JudgeUsage> Usage);
