using System.Globalization;
using CrucibleAI.Config;
using CrucibleAI.Judging;
using CrucibleAI.Runs;
using CrucibleAI.Text;
using CrucibleAI.Verdicts;

namespace CrucibleAI.Reports;

internal sealed class ReportRenderer(ReportSettings settings)
{
    private const int SectionsPerStatus = 3;
    private const int SmokeRuns = 1;
    private const double RateScale = 1000;
    private const double RateEpsilon = 1e-9;
    private const string Failed = "FAILED:";
    private const string Errored = "ERRORED, not failed:";
    private const string Passed = "PASSED:";
    private const string Smoke = "the smoke run (runs: 1)";
    private const string FatalAdvice = "Fix the provider setup (API key, model) or configuration and rerun.";
    private const string ExpiryAdvice = "Check for a slow system under test or a throttled judge provider.";
    private const char Arrow = (char)0x2192;

    private readonly ReportFields _fields = new(settings.ExcerptChars);
    private readonly VerdictCalculator _calculator = new();

    private bool IsFull => settings.Verbosity != Verbosity.Default;

    public string Render(TestRecord test)
    {
        var headline = Headline(test);
        var top = IsSmoke(test.Runs) ? headline : headline + "\n" + CountsLine(test.Results);
        var sections = Sections(test).Prepend(top);
        if (settings.Stamp is { } stamp)
        {
            sections = sections.Append(new StampSection(stamp, _fields).Render(test.Results));
        }
        return string.Join("\n\n", sections);
    }

    private string Headline(TestRecord test) => test.Ending switch
    {
        AbortedEnding when IsSmoke(test.Runs) => $"{Errored} {Smoke} aborted on a fatal error. {FatalAdvice}",
        AbortedEnding => $"{Errored} aborted on a fatal error after {Settled(test)}. {FatalAdvice}",
        ExpiredEnding expired when IsSmoke(test.Runs) =>
            $"{Errored} {Smoke} did not finish within its {Integer(expired.DeadlineMs)} ms deadline. {ExpiryAdvice}",
        ExpiredEnding expired =>
            $"{Errored} the test did not finish within its {Integer(expired.DeadlineMs)} ms deadline; {Settled(test)}. {ExpiryAdvice}",
        _ => VerdictHeadline(test, _calculator.Compute(test.Threshold, test.Results.Select(result => result.Status).ToArray())),
    };

    private static string VerdictHeadline(TestRecord test, Verdict verdict)
    {
        var smoke = IsSmoke(test.Runs);
        return verdict.Outcome switch
        {
            VerdictZone.Passed when smoke => $"{Passed} {Smoke} passed.",
            VerdictZone.Passed => $"{Passed} {RateClause(test, verdict)}.",
            VerdictZone.Errored when smoke => $"{Errored} {Smoke} hit an infrastructure problem, so there is no verdict.",
            VerdictZone.Errored =>
                $"{Errored} {RateClause(test, verdict)}; {Integer(verdict.Errored)} errored run(s) left the result inconclusive.",
            _ when smoke => $"{Failed} {Smoke} did not pass.",
            _ => $"{Failed} {RateClause(test, verdict)}.",
        };
    }

    private static string RateClause(TestRecord test, Verdict verdict)
    {
        var rate = Math.Floor((double)verdict.Passed / test.Runs * RateScale + RateEpsilon) / RateScale;
        return $"{Integer(verdict.Passed)}/{Integer(test.Runs)} runs passed (pass rate {EcmaScriptNumber.Format(rate)}) "
            + $"against threshold {EcmaScriptNumber.Format(test.Threshold)} (need {Integer(verdict.Need)})";
    }

    private static string Settled(TestRecord test)
    {
        var discarded = Count(test.Results, RunStatus.Discarded);
        var settled = $"{Integer(test.Results.Count - discarded)}/{Integer(test.Runs)} runs settled";
        return discarded > 0 ? $"{settled}; {Integer(discarded)} in-flight run(s) discarded to stop spend" : settled;
    }

    private static string CountsLine(IReadOnlyList<RunResult> results) =>
        $"Runs: {Integer(Count(results, RunStatus.Passed))} passed, {Integer(Count(results, RunStatus.Failed))} failed, "
        + $"{Integer(Count(results, RunStatus.Errored))} errored, {Integer(Count(results, RunStatus.Discarded))} discarded.";

    private List<string> Sections(TestRecord test)
    {
        var numbered = test.Results.Select((result, index) => (Result: result, Number: index + 1)).ToArray();
        var failed = WithStatus(numbered, RunStatus.Failed);
        var errored = WithStatus(numbered, RunStatus.Errored);
        if (test.Ending is AbortedEnding aborted)
        {
            errored = [.. errored.Where(run => run.Number == aborted.FatalRun), .. errored.Where(run => run.Number != aborted.FatalRun)];
        }
        var discarded = WithStatus(numbered, RunStatus.Discarded);
        if (IsFull)
        {
            return
            [
                .. failed.Select(run => WithJudgeCalls(FailedSection(run), run.Result)),
                .. errored.Select(run => WithJudgeCalls(ErroredSection(run), run.Result)),
                .. WithStatus(numbered, RunStatus.Passed).Select(run => WithJudgeCalls($"[PASSED] Run #{Integer(run.Number)}", run.Result)),
                .. discarded.Select(run => WithJudgeCalls(
                    $"[DISCARDED] Run #{Integer(run.Number)} (cut off in flight; counted in no zone)", run.Result)),
            ];
        }
        List<string> sections =
        [
            .. failed.Take(SectionsPerStatus).Select(FailedSection),
            .. HiddenSummary(failed, "failed"),
            .. ClaimTally(failed),
            .. errored.Take(SectionsPerStatus).Select(ErroredSection),
            .. HiddenSummary(errored, "errored"),
        ];
        if (discarded.Length > 0)
        {
            sections.Add($"[DISCARDED] Run(s) {Ranges(discarded)}: still in flight when the test was cut off; counted in no zone.");
        }
        return sections;
    }

    private string WithJudgeCalls(string section, RunResult result)
    {
        if (result.Calls.Count == 0)
        {
            return section + "\n" + _fields.Field("Judge calls", "none recorded");
        }
        return string.Join('\n', result.Calls.Select((call, index) => JudgeCallLines(call, index + 1, result.Calls.Count)).Prepend(section));
    }

    private string JudgeCallLines(JudgeCall call, int position, int total)
    {
        var heading = $"Judge call {Integer(position)} of {Integer(total)}";
        return call switch
        {
            VerdictCall verdict => string.Join('\n', new[]
            {
                _fields.Field(heading, "coherent verdict " + (verdict.Verdict ? "true" : "false")),
                _fields.Field("Claim", verdict.Claim, ReportFields.Nested),
            }.Concat(Judged(verdict.Facts, verdict.Reasoning, verdict.Response))),
            ExtractionCall extraction => ExtractionLines(
                heading, $"extract ({ExtractWords.Of(extraction.Mode)}) {Extracted(extraction)}", extraction),
            ErroredCall error => string.Join('\n',
                _fields.Field(heading, $"errored after {Integer(error.Attempts)} attempt(s)"),
                _fields.Field("Judge error", error.Cause.Describe(), ReportFields.Nested)),
            _ => throw new ArgumentException("Unknown judge call.", nameof(call)),
        };
    }

    private IEnumerable<string> Judged(IReadOnlyList<string> facts, string reasoning, string response) =>
    [
        .. _fields.Facts(facts, ReportFields.Nested),
        _fields.Field("Judge reasoning", reasoning, ReportFields.Nested),
        _fields.Excerpt(response, ReportFields.Nested),
    ];

    private string ExtractionLines(string heading, string summary, ExtractionCall extraction) =>
        string.Join('\n', Judged(extraction.Facts, extraction.Reasoning, extraction.Response).Prepend(_fields.Field(heading, summary)));

    private static string Extracted(ExtractionCall extraction) =>
        $"\"{extraction.Description}\" as {ExtractWords.Of(extraction.Type)} {Arrow} {EcmaScriptJson.Value(extraction.Value)}";

    private string FailedSection((RunResult Result, int Number) run)
    {
        var extractions = run.Result.Calls.OfType<ExtractionCall>().ToArray();
        IEnumerable<string> extractionFields = IsFull
            ? []
            : extractions.Select((extraction, index) => ExtractionLines(
                $"Extraction {Integer(index + 1)} of {Integer(extractions.Length)} ({ExtractWords.Of(extraction.Mode)})",
                Extracted(extraction),
                extraction));
        return string.Join('\n', FailureFields(run.Result).Prepend($"[FAILED] Run #{Integer(run.Number)}").Concat(extractionFields));
    }

    private IEnumerable<string> FailureFields(RunResult result)
    {
        var thrown = _fields.Field("Thrown", Describe(result.Cause));
        var (verdict, position, judged) = FirstFalseVerdict(result);
        if (verdict is not null)
        {
            return
            [
                _fields.Field("First failed assertion", $"coherent (assertion {Integer(position)} of {Integer(judged)} judged in this run)"),
                _fields.Field("Claim", verdict.Claim),
                .. _fields.Facts(verdict.Facts),
                _fields.Field("Judge reasoning", verdict.Reasoning),
                _fields.Excerpt(verdict.Response),
                thrown,
            ];
        }
        if (FirstError(result) is { } error)
        {
            return
            [
                _fields.Field("First failure", $"a judge call errored after {Integer(error.Attempts)} attempt(s)"),
                _fields.Field("Judge error", error.Cause.Describe()),
                thrown,
            ];
        }
        return [_fields.Field("First failure", "no assertion returned false; the body threw"), thrown];
    }

    private static (VerdictCall? Verdict, int Position, int Judged) FirstFalseVerdict(RunResult result)
    {
        var judged = result.Calls.OfType<VerdictCall>().Count();
        var position = 0;
        foreach (var call in result.Calls)
        {
            if (call is ErroredCall)
            {
                break;
            }
            if (call is not VerdictCall verdict)
            {
                continue;
            }
            position++;
            if (!verdict.Verdict)
            {
                return (verdict, position, judged);
            }
        }
        return (null, 0, judged);
    }

    private static ErroredCall? FirstError(RunResult result) => result.Calls.OfType<ErroredCall>().FirstOrDefault();

    private string ErroredSection((RunResult Result, int Number) run)
    {
        var lines = new List<string>
        {
            $"[ERRORED] Run #{Integer(run.Number)} (infrastructure, not a semantic failure)",
            _fields.Field("Cause", Describe(run.Result.Cause)),
        };
        if (FirstError(run.Result) is { } error)
        {
            lines.Add(_fields.Field("Judge attempts", Integer(error.Attempts)));
        }
        return string.Join('\n', lines);
    }

    private static IEnumerable<string> HiddenSummary((RunResult Result, int Number)[] runs, string status)
    {
        var hidden = runs.Skip(SectionsPerStatus).ToArray();
        return hidden.Length == 0 ? [] : [$"+ {Integer(hidden.Length)} more {status} run(s) not shown in full: {Ranges(hidden)}."];
    }

    private static IEnumerable<string> ClaimTally((RunResult Result, int Number)[] failed)
    {
        if (failed.Length <= SectionsPerStatus)
        {
            return [];
        }
        var lines = failed
            .Select(run => FailureLabel(run.Result))
            .GroupBy(label => label, StringComparer.Ordinal)
            .OrderByDescending(group => group.Count())
            .Select(group => $"{ReportFields.Indent}{Integer(group.Count())} run(s): {group.Key}");
        return [string.Join('\n', lines.Prepend($"Failing claims (first failure of each of the {Integer(failed.Length)} failed runs):"))];
    }

    private static string FailureLabel(RunResult result)
    {
        if (FirstFalseVerdict(result).Verdict is { } verdict)
        {
            return TextFormat.Indented($"coherent \"{verdict.Claim}\"", ReportFields.Nested);
        }
        return FirstError(result) is null ? "thrown without a false verdict" : "a judge call errored";
    }

    private static string Ranges(IEnumerable<(RunResult Result, int Number)> runs)
    {
        var spans = new List<(int Start, int End)>();
        foreach (var (_, number) in runs)
        {
            if (spans.Count > 0 && spans[^1].End + 1 == number)
            {
                spans[^1] = (spans[^1].Start, number);
            }
            else
            {
                spans.Add((number, number));
            }
        }
        return string.Join(", ", spans.Select(span => span.Start == span.End ? $"#{Integer(span.Start)}" : $"#{Integer(span.Start)}-#{Integer(span.End)}"));
    }

    private static (RunResult Result, int Number)[] WithStatus((RunResult Result, int Number)[] runs, RunStatus status) =>
        runs.Where(run => run.Result.Status == status).ToArray();

    private static int Count(IReadOnlyList<RunResult> results, RunStatus status) => results.Count(result => result.Status == status);

    private static string Describe(RunCause? cause) => cause?.Describe() ?? string.Empty;

    private static bool IsSmoke(int runs) => runs == SmokeRuns;

    private static string Integer(long value) => value.ToString(CultureInfo.InvariantCulture);
}
