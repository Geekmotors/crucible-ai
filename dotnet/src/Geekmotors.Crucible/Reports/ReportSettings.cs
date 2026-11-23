using CrucibleAI.Config;

namespace CrucibleAI.Reports;

internal sealed record ReportSettings(int ExcerptChars, Verbosity Verbosity, JudgeStamp? Stamp);
