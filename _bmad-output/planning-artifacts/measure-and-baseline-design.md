# Measure mode and test baselines: design

Status: **draft for review**. Nothing here is built yet. Decisions marked **Decision needed** have a recommendation and
are open until reviewed.

## 1. Problem

A Crucible test is a gate: it passes or fails on a pass rate. That leaves two gaps.

1. **No score on a pass.** At the default verbosity a passing test prints nothing. 9 of 10 and 10 of 10 look the same,
   and so do 7 of 10 and 9 of 10 under a 0.7 threshold.
2. **Choosing a threshold is manual guesswork.** The docs already describe the right workflow ("Measure first, with
   many runs", then "Gate below measured reliability" in `docs/runs-and-threshold.md`), but the user has to run it by
   hand: write a `threshold: 1` test, read the count off a failure, work out headroom from the false-red table, then
   type a threshold into the code.

What users want is to keep tests from getting worse than they are today, without blocking CI on noise and without
guessing numbers.

## 2. Goals and non-goals

Goals:

- Run any test, or a whole suite, **without gating**, and see each test's pass rate with its uncertainty.
- Get a **suggested threshold per test**, computed so an unchanged system rarely fails it.
- Switch this on **from the command line**, with no change to the tests.
- Later: **apply** measured thresholds automatically, without editing test code, and keep a per-test settings file
  that overrides the code.
- Identical behaviour in TypeScript and C#, specified in `spec/`.

Non-goals:

- Storing history, charting trends or hosting results. Crucible stays an assertion library. Users can keep the file
  from phase 2 under version control, and CI tools can read it.
- Rewriting test source code. Suggestions are applied through a file, never by editing the user's tests (see 7.1).

## 3. The workflow, end to end

```sh
# 1. Measure the story tests with plenty of runs. Nothing fails on pass rate.
CRUCIBLE_MODE=measure CRUCIBLE_MEASURE_RUNS=50 npx jest tests/story

#    Each test prints its pass rate, its likely range and a suggested gate.

# 2a. Phase 1: copy the suggested thresholds into the tests by hand.
# 2b. Phase 2: let Crucible write them into crucible.baseline.json instead.
CRUCIBLE_MODE=baseline CRUCIBLE_MEASURE_RUNS=50 npx jest tests/story
git diff crucible.baseline.json    # review, then commit

# 3. Normal CI runs gate every test against its own baseline.
npx jest
```

The same works with Vitest, `dotnet test` and `dotnet test --filter ...`.

## 4. Phase 1: measure mode

### 4.1 Switching it on

Two switches, both optional:

| Switch | Scope | Values |
| --- | --- | --- |
| `measure` run option | one test, a group, or the project | `true` or `false` (default `false`) |
| `CRUCIBLE_MODE` environment variable | every Crucible test in this invocation | unset (default) or `measure` |

Where the run option goes, following the existing precedence for `runs`, `threshold` and `strict`:

- TypeScript: `crucible.it(name, { measure: true }, body)`, `crucible.describe(name, { measure: true }, ...)`,
  `testDefaults.measure` in the config file.
- C#: `[CrucibleFact(Measure = true)]`, `[CrucibleTheory(Measure = true)]`, `[Crucible(Measure = true)]` on a class
  or assembly, `RunOptions.Measure` for `Crucible.Gate`, `testDefaults.measure` in the config file.

`CRUCIBLE_MODE=measure` wins over every `measure: false`, the same way `CRUCIBLE_VERBOSE` wins over the config file.
There is no value that forces gating over a per-test `measure: true`; a test marked that way is informational by
design.

The run option is for tests that should always be informational (for example a tone or style check you watch but
never block on). The environment variable is for measuring a suite: the tests don't change between measuring and
gating, and the runner's own path and name filters (`npx jest tests/story`, `-t`, `dotnet test --filter`) choose
which tests are measured.

Validation:

- `measure` that is not `true` or `false` is a `usage` error at registration (option) or a `config` error (config
  file), exactly like `strict`.
- `CRUCIBLE_MODE` set to anything other than `measure` (phase 2 adds `baseline` and `rebaseline`) is a `config`
  error. Blank counts as unset.

### 4.2 How many runs

A measurement wants many runs; a gate wants few. So measure mode has its own run count:

- `CRUCIBLE_MEASURE_RUNS`: integer from 1 to 1000. Applies only to tests being measured, and only to the number of
  runs executed. Unset: the test's own resolved `runs`.
- The **gate runs** used for suggestions (4.4) are always the test's own resolved `runs`, never
  `CRUCIBLE_MEASURE_RUNS`. You measure at 50 to choose a threshold for the 10 runs CI will actually execute.
- Test timeout: when `testTimeout` is not set, the existing formula (`30000 + 1000 × (runs − 1)`) uses the
  measurement run count. When it is set, a measured test uses the larger of the configured value and the formula, so
  `CRUCIBLE_MEASURE_RUNS=50` doesn't trip a timeout sized for 10 runs.
- Cost scales with the measurement runs. The docs will say so next to the variable.

**Decision needed (D1): the default when `CRUCIBLE_MEASURE_RUNS` is unset.** Recommendation: the test's own `runs`,
so measure mode never spends more than a normal run unless asked. The output then shows a wide range, and the
suggestion line says to measure with more runs (4.6). The alternative, a fixed default such as 50, gives useful numbers
immediately but makes the first `CRUCIBLE_MODE=measure` run cost 5× a normal one without warning.

### 4.3 Outcome of a measured test

Runs execute and are classified exactly as today (passed, failed, errored, discarded). The test then ends in a new
outcome, **measured**, instead of the three verdict zones:

- **Green** whatever the pass rate. Falling below the test's threshold is reported ("below target"), never failed.
- **Errored runs** are left out of the pass rate and counted separately in the report. The pass rate is
  `passed ÷ (passed + failed)`.
- **Red, as errored**, when no run settled as passed or failed (every run errored). There is nothing to measure.
- Unchanged: a fatal provider error, a `config` or `usage` error, and the test deadline still stop the test and fail it
  as today. A measurement run with a broken judge must never look like a score.

**Decision needed (D2): errored runs.** Recommendation as above: excluded from the rate and shown, red only when no run
settled. The stricter alternative is red when any run errored; that is simpler to explain but throws away a 50-run
measurement over one provider blip, after retries.

### 4.4 The numbers

Let `n = passed + failed` (settled runs), `x = passed`, and `g` = the test's gate runs.

**Pass rate:** `x ÷ n`, shown to 2 decimals.

**Likely range:** the 95% two-sided Clopper-Pearson interval for `x` of `n`, the same interval the docs already use
("19/20 is consistent with any true rate from 0.75 to 0.999"). Lower bound rounded down and upper bound rounded up, to
2 decimals. Ports compute it by bisection on the exact binomial tail (no special functions needed): the lower bound
`L` solves `P(X ≥ x | n, L) = 0.025` (0 when `x = 0`), the upper bound `U` solves `P(X ≤ x | n, U) = 0.025` (1 when
`x = n`). Fixtures avoid values within 0.001 of a rounding boundary, so ports can't disagree through floating-point
noise.

**Suggested gate:** the largest `need` `k` in `1..g` such that a system whose true rate is the **planning rate** `p`
fails the gate (fewer than `k` of `g` runs pass) on at most 5% of builds:

```text
k = max { k in 1..g : P(X < k | g, p) ≤ 0.05 }
```

The suggested threshold is `k ÷ g`, rounded down to 2 decimals (for `g ≤ 100` that keeps `need` at exactly `k`; above
100, 3 decimals). If no `k` qualifies, there is no useful gate at `g` runs and the output says so.

The 5% is a constant, not a setting, in this version. One test with a 5% false-red rate is fine; a suite of twenty
such tests is red on about 64% of builds with nothing wrong, so the docs will say to keep the number of gated
inference tests small or to raise their runs.

**Decision needed (D3): the planning rate `p`.** This is the main judgement call. The table shows the suggestion for
each choice, and how often the suggested gate then catches a 10-point drop in the true rate:

| Measured | Planning rate | Gate at 10 runs | Gate at 20 runs | Gate at 50 runs |
| --- | --- | --- | --- | --- |
| 44 / 50 | point estimate 0.880 | 7/10, catches 16% | 15/20, catches 27% | 40/50, catches 56% |
| 44 / 50 | one-sided 80% lower bound 0.824 | 6/10, catches 5% | 14/20, catches 13% | 37/50, catches 19% |
| 44 / 50 | two-sided 95% lower bound 0.757 | 5/10, catches 1% | 12/20, catches 2% | 33/50, catches 2% |
| 95 / 100 | point estimate 0.950 | 8/10, catches 18% | 17/20, catches 35% | 45/50, catches 78% |
| 95 / 100 | one-sided 80% lower bound 0.922 | 8/10, catches 18% | 16/20, catches 17% | 43/50, catches 48% |
| 95 / 100 | two-sided 95% lower bound 0.887 | 7/10, catches 5% | 15/20, catches 7% | 40/50, catches 12% |

("Catches" = how often the gate goes red if the true rate has dropped by 0.10 from the measured rate.)

- The **point estimate** gives the most useful gates, but if the measurement was lucky, the real false-red rate is
  above 5%.
- The **95% lower bound** almost never fails an unchanged system, but its gates catch almost nothing.
- Recommendation: the **one-sided 80% lower bound** (`P(X ≥ x | n, p) = 0.20`). It still protects against a somewhat
  lucky measurement and keeps gates that catch something.

The table's main lesson holds whatever rule is chosen: **at 10 gate runs, no threshold both avoids false reds and
reliably catches a 10-point drop.** Gate runs, not threshold, buy detection. The output must make this visible (4.6)
rather than let a suggested threshold look stronger than it is.

### 4.5 Variability

Verdicts are pass or fail per run; there is no per-run confidence score to average. "How much does this swing?" is
answered three ways:

- **Within one measurement:** the likely range (4.4). It is the spread you would see if you measured again, and it
  narrows as runs increase.
- **Per assertion:** each `coherent` expectation in the test gets its own pass count, so a flaky claim is visible
  instead of being folded into the test's rate. Calls are grouped by expectation text. A run that stops early (its body
  threw before a later assertion) doesn't count for the assertions it never reached, so each line shows how many runs
  evaluated it. `extract` has no pass or fail and is not listed. The breakdown is shown only when the test has more
  than one distinct expectation.
- **Between measurements:** phase 2 keeps the previous measurement, and a baseline run prints it next to the new one
  (5.4).

A running pass rate at 5, 10, 15 runs is not shown (7.4).

### 4.6 Output

A measured test always prints, at every verbosity, when it finishes. It uses the same channel as today's `PASSED:`
report (TypeScript: `process.stdout`; C#: the test output the passing report uses today).

Default verbosity:

```text
MEASURED: keeps the meeting place secret: 44 of 50 runs passed (pass rate 0.88, likely 0.75–0.96); threshold 0.9 not enforced, below target.
  Suggested gate: runs 10, threshold 0.6. An unchanged system fails it on under 5% of builds; a drop to 0.78 fails it on 5%.
  Sharper gate: runs 50, threshold 0.74. A drop to 0.78 fails it on 19%.
  Errored runs: 0.
  By assertion:
    "never reveals the meeting place": 50 of 50 passed
    "stays in the narrator's voice": 44 of 50 passed (0.88, likely 0.75–0.96)

[FAILED] Run #3
  ...up to three failing runs, exactly as the failure report shows them today...

Judge: openrouter "anthropic/claude-haiku-5.5"; served as "anthropic/claude-haiku-5.5", 50 response(s), 59100 tokens, cost $0.007750
Crucible: crucible-ai 0.7.0; schemas coherent 2ecbb5d8, extract 1e09070c
```

- The headline names the test, since measured output is read in bulk across a suite.
- "below target" appears when `passed < need` for the test's own threshold; otherwise "meets target".
- "Sharper gate" appears only when the gate runs are below 50. It shows the same suggestion at 50 runs, so the trade-off
  between runs and detection is visible.
- "A drop to …" uses the measured rate minus 0.10 (omitted when that is ≤ 0).
- With no qualifying `k`: `No useful gate at runs 10: even 1 of 10 would fail an unchanged system on over 5% of builds. Measure with more runs, or raise runs.`
- When the measurement used fewer than 30 settled runs: one more line, `Measured with only 10 runs; the range is wide. Set CRUCIBLE_MEASURE_RUNS=50 for a firmer suggestion.`
- The failing runs section follows the existing verbosity rules: up to three at `default`, all runs at `full` and
  `debug`.
- The judge stamp comes last, as in every report.
- Per-assertion lines show a range only when the assertion didn't pass every time it was evaluated. Expectation text
  is truncated to `excerptChars`.

The exact text is specified in `spec/report/render.json` fixtures, like every other report line.

### 4.7 What changes where

- **Spec:**
  - The `measure` run option in the run-option and `testDefaults` fixtures.
  - `CRUCIBLE_MODE` and `CRUCIBLE_MEASURE_RUNS` parsing.
  - New operation `verdict/measure`: settled counts plus gate runs, giving the pass rate, the range and the
    suggestions.
  - New operation `verdict/by-assertion`: per-run assertion outcomes, giving the per-assertion counts.
  - New `report/render` cases for the `MEASURED:` report.
  - A spec README section on measure mode.
- **TypeScript:** the run option on `crucible.it` and `crucible.describe`, environment parsing, the measured outcome in
  the runner, the reporter.
- **C#:** `Measure` on `RunOptions` and on the three attributes, the same engine changes, and `testDefaults.measure`.
- **Docs:**
  - `runs-and-threshold.md`: a new "Measure mode" section, with "Headroom patterns 1–2" rewritten to use it.
  - `configuration.md`: the environment variables and `testDefaults.measure`.
  - Getting started: one step.
  - Both API references and both changelogs.

## 5. Phase 2: test overrides and baselines

### 5.1 Two files

Hand-written settings and measured values live in separate files, both next to the config file and both committed.
Each has one writer, so neither writer gets in the other's way.

| File | Written by | Holds | Format |
| --- | --- | --- | --- |
| Overrides | you; Crucible never writes it | `runs`, `threshold`, `measure` per test, with your comments | TypeScript: `crucible.tests.yml`; C#: `crucible.tests.json` |
| Baseline | Crucible, in `baseline` and `rebaseline` mode | the measured `threshold` per test, with the measurement it came from | `crucible.baseline.json` in both |

Overrides, TypeScript (`crucible.tests.yml`):

```yaml
tests:
  # Tone is watched, never gated.
  "story/tone.test.ts > stays in period voice":
    measure: true
  # Held at 0.8 until the new narrator prompt ships.
  "story/omniscience.test.ts > narrator > keeps the meeting place secret":
    threshold: 0.8
```

Overrides, C# (`crucible.tests.json`, comments and trailing commas allowed):

```jsonc
{
  "tests": {
    // Tone is watched, never gated.
    "Story.ToneTests.StaysInPeriodVoice": { "measure": true },
  }
}
```

Baseline, both languages (`crucible.baseline.json`):

```json
{
  "tests": {
    "story/omniscience.test.ts > narrator > keeps the meeting place secret": {
      "threshold": 0.6,
      "measured": {
        "passed": 44,
        "settled": 50,
        "measuredAt": "2026-11-27",
        "judge": "openrouter \"anthropic/claude-haiku-5.5\"",
        "schemas": { "coherent": "2ecbb5d8", "extract": "1e09070c" }
      },
      "previous": { "passed": 46, "settled": 50, "measuredAt": "2026-10-02" }
    }
  }
}
```

- Overrides may set `runs`, `threshold` and `measure`. Other run options (`strict`, the timeouts) stay in code; they
  describe how the test works, not how good it is. (Open to extending later.)
- The baseline file holds only `threshold`, plus `measured` and `previous`, which are read for the stale-judge
  warning and the between-measurements comparison (5.4). Hand edits to it work, but the next baseline run may replace
  them; deliberate changes belong in the overrides file.
- `CRUCIBLE_TESTS=<path>` and `CRUCIBLE_BASELINE=<path>` point at different files, so CI can switch sets, for example
  a stricter overrides file on `main`. A path given and missing is a `config` error; a default path missing just means
  that file is empty.
- Crucible writes the baseline file with sorted keys and two-space indentation, so diffs stay small and reviewable.

**Decision (D4): YAML overrides in TypeScript, JSON with comments in C#, JSON baseline in both.**

- The overrides file is never rewritten, so comments are safe in any format. (A single rewritten file was the original
  problem: C# has no comment-preserving JSONC or YAML editor, so comments would vanish on every baseline run.)
- Each language follows its ecosystem: YAML is common in JavaScript projects; .NET projects expect JSON
  (`appsettings.json`), and `System.Text.Json` already skips comments and trailing commas, so C# adds no dependency.
- Entries never overlap between languages (5.2 keys differ), so a mixed repository loses nothing by having two
  overrides files.
- Cost on the TypeScript side: the first runtime dependency, `yaml` (which has none of its own), loaded only when the
  overrides file exists. It is parsed as YAML 1.2, so `no`, `on` and `0.10` are not reinterpreted. Keys containing
  `:` or ` > ` must be quoted; every docs example quotes keys.
- The spec defines the overrides data model, not its syntax. Shared fixtures are JSON; the TypeScript port adds tests
  that the YAML form loads into the same model.

### 5.2 Test identity

An entry's key must name the same test across runs and machines.

- **Jest and Vitest:** the test file path relative to the config file's directory (forward slashes), then ` > `, then
  the full test name: the enclosing `describe` names and the test name joined with ` > `. Crucible builds the name
  itself from `crucible.describe` and `crucible.it`. Plain `describe` blocks are read from the runner (Jest's
  `currentTestName`, Vitest's task tree). The key format is the same under both runners, so switching runners keeps
  the file valid.
- **xUnit:** the fully qualified method name, `Namespace.Class.Method`. For a `[CrucibleTheory]`, an entry keyed with
  the data row's display name (`Namespace.Class.Method(row: "a")`) wins over a method-level entry, so one entry can
  cover every row and individual rows can still differ.
- **`Crucible.Gate` (NUnit, MSTest, others):** there is no ambient test identity, so `Gate` gains an optional `id`
  parameter. Without it, neither file applies to that test, and a baseline run prints a one-line notice that the
  test was measured but not saved.

**Decision needed (D5): theory rows.** Recommendation as above: method-level entries apply to all rows, and row-level
entries win. Baseline runs write method-level entries from the lowest suggestion across the rows, so one weak row
doesn't get hidden by an average.

### 5.3 Precedence and provenance

From lowest to highest:

1. Built-in defaults.
2. `testDefaults` in the config file.
3. `crucible.describe` / `[Crucible]` on a class or assembly.
4. The test's own options.
5. **The test's entry in the baseline file.**
6. **The test's entry in the overrides file.**
7. **`CRUCIBLE_MODE` and `CRUCIBLE_MEASURE_RUNS`.**

The overrides file beats the baseline file, so a deliberate human decision always wins over a measured one. The code
is the author's intent, the baseline is what was measured, and the overrides are a decision about both.

Because the files override the code, a reader of the test can see `threshold: 0.9` while 0.6 applies. To keep that
visible, every report that shows a threshold names where it came from when it isn't the code:
`threshold 0.6 (crucible.baseline.json)` or `threshold 0.8 (crucible.tests.yml)`. The `debug` trace prints the
resolved settings with their sources.

### 5.4 Baseline runs

Two more `CRUCIBLE_MODE` values. Both measure exactly as in phase 1, then write to the baseline file:

| Mode | Writes `threshold` when the suggestion is... | Use it for |
| --- | --- | --- |
| `baseline` | higher than the entry's current threshold, or there is no entry | the normal ratchet: thresholds only go up |
| `rebaseline` | different from the current threshold | accepting a deliberate drop (new model, changed behaviour) |

- A `baseline` run that suggests a **lower** threshold leaves the entry alone and says so: `kept threshold 0.7;
  this measurement suggests 0.6. Use CRUCIBLE_MODE=rebaseline to lower it.` A lower suggestion is either noise or a
  real regression, and the ratchet must not quietly accept a regression.
- Every run updates the entry's measurement, whether or not the threshold changed: the old `measured` block moves to
  `previous`, and the new measurement replaces it.
- The report compares the two: `Previous: 46 of 50 (2026-10-02). Now: 44 of 50.` When the two ranges don't overlap it
  adds `The change is larger than run-to-run noise.` This is the between-measurements variability from 4.5.
- When the overrides file sets this test's threshold, the baseline is still written, and the report notes that
  `crucible.tests.yml` overrides it.
- Only tests that ran are touched. A path- or name-filtered run updates only those entries; every other entry is kept
  byte-for-byte.
- A test with no qualifying gate (4.4) gets no `threshold` written; the run reports it.
- `measure: true` entries are never given a threshold; they stay informational.

**Stale judge warning.** On a normal gating run, if a test's baseline was measured with a different judge (provider
and model, or schema hashes) than the current one, the report adds:
`Baseline measured with openrouter "deepseek/...", schemas coherent 1111aaaa; the judge has changed since. Re-run CRUCIBLE_MODE=rebaseline.`
The judge stamp work already gives both values.

**Decision needed (D6): raise-only by default.** Recommendation as above. The alternative is a single `baseline` mode
that always overwrites; simpler, but it turns "don't get worse" into "accept whatever the last measurement said".

### 5.5 Writing safely

Jest and Vitest run test files in parallel worker processes, so several workers may update the file at once.

Only the baseline file is ever written.

- Each write takes an exclusive lock file (`crucible.baseline.json.lock`, created with exclusive-create, retried with
  backoff for up to 10 seconds, removed in a `finally`). Under the lock: re-read the file, apply this test's change,
  write a temporary file in the same directory, rename it over the original. Renaming within a directory is atomic on
  POSIX and on Windows (`File.Replace` / `fs.rename`).
- A lock older than 60 seconds is treated as abandoned (a crashed worker) and broken, with a warning.
- A file that fails to parse is never overwritten: the baseline run fails as a `config` error naming the file.

This changes one documented promise: "crucible never writes files at any level" becomes "crucible writes only
`crucible.baseline.json`, and only in `baseline` and `rebaseline` mode".

### 5.6 Stale entries

When a test is renamed or deleted, its entries stay in both files. In this version Crucible doesn't detect that: a filtered run can't
tell a deleted test from one it skipped, and there is no suite-end hook that sees every test. Entries are listed with
the test name, so they are easy to delete by hand.

**Later option:** a `crucible-ai baseline prune` CLI command that lists keys whose test file no longer exists. It can't
detect renamed tests inside a file that still exists.

### 5.7 What changes where

- **Spec:** JSON Schemas for both files, shared and shipped in `schemas/` (the overrides schema also gives YAML
  editors completion through `# yaml-language-server: $schema=...`). New operations:
  - `settings/file`: validate an overrides or baseline entry.
  - `settings/resolve`: precedence across all levels, with sources.
  - `baseline/apply`: the current entry plus a measurement and a mode, giving the new entry (the ratchet rules).
  - `report/render` cases for the provenance suffix, the stale-judge warning and the previous-measurement line.
  - Key derivation is per runner and tested in each port, not in the spec.
- **Ports:** file reading and resolution, locked atomic writes, the `Gate` `id` parameter (C#), and key derivation
  per runner. TypeScript adds the `yaml` dependency for the overrides file.
- **Docs:** a "Baselines" page; the precedence table in `runs-and-threshold.md`; `configuration.md` for
  `CRUCIBLE_TESTS` and `CRUCIBLE_BASELINE`; the gotchas page on file-over-code precedence.

## 6. Decisions needed

| # | Question | Recommendation |
| --- | --- | --- |
| D1 | Default measurement runs when `CRUCIBLE_MEASURE_RUNS` is unset | the test's own `runs`; suggest 50 in the output |
| D2 | Errored runs in measure mode | excluded from the rate and shown; red only when no run settled |
| D3 | Planning rate for suggestions | one-sided 80% lower bound; variability shown per assertion and between measurements, not as a running rate |
| D4 | Settings file format | **decided:** overrides in `crucible.tests.yml` (TypeScript) or `crucible.tests.json` (C#), never written by Crucible; measured values in `crucible.baseline.json` |
| D5 | Theory rows | method-level entries; row-level entries win; baseline writes the lowest row suggestion |
| D6 | Baseline ratchet | `baseline` only raises; `rebaseline` overwrites |

Also open, lower stakes:

- A machine-readable results file (`CRUCIBLE_RESULTS=results.jsonl`, one line per test) for CI dashboards. It's
  useful but independent of both phases; I'd leave it until someone asks.

## 7. Alternatives considered

### 7.1 Rewriting thresholds in test source

Like Jest inline snapshots. Rejected:

- It needs a syntax-tree rewriter per language: Babel or the TypeScript compiler API for TypeScript, Roslyn for C#.
- It has to cope with options inherited from `describe` or `[Crucible]`, with constants and with shared option
  objects.
- It edits code people wrote by hand.

The settings file gives the same result with none of that.

### 7.2 A suite-average score

Rejected as the basis for suggestions: an average of 0.87 can hide one test at 0.6 and another at 1.0, and thresholds
are per test. A suite summary line could be added later as a headline, but it would need a suite-end hook that both
Jest and xUnit lack without extra user setup.

### 7.3 Runner command-line flags (`jest --crucible-measure`)

Rejected: Jest and Vitest reject flags they don't know. Environment variables work the same in every runner and in
CI, and match `CRUCIBLE_VERBOSE`.

### 7.4 A running pass rate (at 5, 10, 15 runs)

Rejected. Runs are independent and execute concurrently, so their order carries no information: a running rate only
shows sampling noise settling, and shuffling the same results gives a different curve with the same conclusion. The
likely range states the same uncertainty directly.

### 7.5 One settings file that Crucible rewrites

The first draft of this design. Rejected: hand edits and measured values would share one file, so comments couldn't
survive a rewrite in C#, and a baseline run could clobber a deliberate override. Splitting the files removes both
problems.

## 8. Rollout

1. Phase 1 (measure mode) in one minor release of each package. It changes nothing for existing tests: `measure`
   defaults to `false` and `CRUCIBLE_MODE` defaults to unset.
2. Phase 2 (settings file, baselines) in a later minor release, after phase 1 has been used on real suites. Your own
   storytelling project is the first candidate.
