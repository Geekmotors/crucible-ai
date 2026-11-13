# Runs and threshold — choosing a gate with eyes open

An inference test is a measurement, not a proof. `crucible.it()` runs your
test body `runs` times and goes green when enough of those runs pass. Because
each run is a sample from a non-deterministic system, the gate itself is
noisy: a perfectly healthy system can go red, and a regressed one can go
green. This page documents exactly how `crucible.it()` decides, and how to
pick `runs`/`threshold` so that a red build means something.

- [`crucible.it()` reference](#crucibleit-reference) — signature, options,
  project-wide defaults, run statuses, the three-zone verdict, the failure
  report and verbosity, timeouts, the re-entrancy contract
- [A threshold is a sampled estimate](#a-threshold-is-a-sampled-estimate) —
  why a true-0.95 system fails a 0.95 gate about a quarter of the time
- [False-red table](#false-red-table)
- [Headroom patterns](#headroom-patterns) — worked examples
- [Cost](#cost)

## `crucible.it()` reference

### Signature

```ts
crucible.it(name: string, body: TestBody): void;
crucible.it(name: string, options: RunOptions, body: TestBody): void;

type RunOptions = { runs?: number; threshold?: number };
type TestBody = () => unknown; // usually async
```

`crucible.it()` registers exactly one Jest test. The `runs` repetitions are
not separate Jest test cases; they are executed and judged inside that one
test.

### Options

| Option | Default | Valid values | Meaning |
| --- | --- | --- | --- |
| `runs` | `testDefaults.runs`, else `1` | integer ≥ 1 | How many times the whole body (arrange, act, assert) executes |
| `threshold` | `testDefaults.threshold`, else `1.0` | number with 0 < `threshold` ≤ 1 | Minimum fraction of runs that must pass |

With both omitted and no [project-wide defaults](#project-wide-defaults-testdefaults)
the test is a plain single-shot test ("smoke mode"): one run, and it must
pass.

Options are validated when the test is registered (while Jest collects the
file), not when it runs. Each of the following throws a `CrucibleError` of
kind `usage`:

- `runs` that is not an integer ≥ 1 (`0`, `2.5`, `'20'`)
- `threshold` that is not a number in (0, 1] (`0`, `1.5`, `'0.9'`) —
  `threshold: 0` is rejected, so a test can never pass with zero passing runs
- any option key other than `runs` and `threshold`
- options that are not an object (including `null` or an array), a missing
  body, or two bodies

### Project-wide defaults: `testDefaults`

To apply one reliability bar to every inference test, set `testDefaults` in
`crucible.config.json`:

```json
{
  "provider": "openrouter",
  "model": "deepseek/deepseek-v4-flash-0731",
  "testDefaults": { "runs": 20, "threshold": 0.85 }
}
```

Each option is resolved **per field**, in this order:

1. the value passed to `crucible.it()`
2. the value in `testDefaults`
3. the built-in default (`runs: 1`, `threshold: 1.0`)

So with the config above:

| Declaration | Runs | Threshold |
| --- | --- | --- |
| `crucible.it(name, body)` | 20 | 0.85 |
| `crucible.it(name, { runs: 5 }, body)` | 5 | 0.85 |
| `crucible.it(name, { runs: 5, threshold: 1 }, body)` | 5 | 1.0 |

Both fields are optional; `"testDefaults": {}` or no `testDefaults` at all
means the built-ins apply.

Because the fields resolve independently, a project threshold tuned for its
own run count also applies to a smaller declared `runs`. In the second row,
0.85 of 5 runs needs all 5 to pass, so the test is in effect a strict gate.
When you lower `runs`, check the [headroom](#headroom-patterns) and pass
`threshold` as well if needed.

`testDefaults` is validated when the config is loaded, with the same rules as
the `crucible.it()` options. Any of the following throws a `CrucibleError` of
kind `config`, failing the test before any run starts or any judge call is
made:

- `runs` that is not an integer ≥ 1, or `threshold` that is not a number in
  (0, 1]
- any key other than `runs` and `threshold` inside `testDefaults`
- `testDefaults` that is not an object (`null`, an array, a number)

Defaults are resolved when a test **executes**, not when Jest collects the
file: registering tests never reads the config, so a broken config fails the
tests that run, not suite collection. Validation of the options you pass to
`crucible.it()` itself still happens at registration.

Every `crucible.it()` test loads the config when it executes, even a test
that passes both options or makes no `coherent()` call. A missing or invalid
`crucible.config.json` therefore fails every `crucible.it()` test as kind
`config`.

### What a run is, and how it is classified

All `runs` bodies start at once and execute concurrently. Each run ends in
exactly one status:

| Status | When |
| --- | --- |
| **passed** | The body resolved. Every assertion in it held. |
| **failed** | The body rejected with anything that is not a Crucible infrastructure error: a failed `expect`, a crash in your system under test, a `TypeError` in your test code. |
| **errored** | The body rejected with an error whose first `CrucibleError` — the error itself or the nearest one down its `cause` chain — is of kind `infra`: the judge provider kept failing after retries, the judge reply was not valid verdict JSON twice, or a judge reply attempt ran past its 30 s deadline. An infrastructure problem prevented a verdict; it says nothing about your system. |
| **discarded** | The run was still in flight when the test was aborted by a fatal error (below). It is counted in no zone. |

If your own code catches an infrastructure error and carries on, the run is
classified by how the body ends, like any other caught exception.

Three outcomes stop the whole test immediately instead of being counted:

- **A fatal provider error** — a non-retryable infrastructure error such as an
  invalid API key or an unknown model. Every other run's in-flight judge call
  is cancelled, unfinished runs become *discarded*, and the test fails at once
  with a `CrucibleVerdictError` whose `outcome` is `'errored'`. The same
  misconfiguration would hit every run, so Crucible stops spending.
- **A `config` or `usage` `CrucibleError`** (or a `CrucibleVerdictError`
  thrown from inside a body) — siblings are aborted the same way and the
  original error is rethrown unchanged.
- **The test deadline passing** — see [Timeout](#timeout). In-flight runs are
  cancelled and discarded, and the test fails as *errored*.

Without such a halt, Crucible waits for **every** run to settle before
judging, even when enough runs have already passed.

### The verdict: three zones

The number of passing runs required is computed in integers, never by
comparing a floating-point ratio:

```text
need = max(1, ⌈threshold × runs − 1e-9⌉)
```

The `1e-9` absorbs IEEE-754 rounding upward: `0.07 × 100` evaluates to
`7.000000000000001` in JavaScript, and without the epsilon the ceiling would
demand 8 passes instead of 7. The result is then sorted into one of three
zones:

| Zone | Rule | Test result |
| --- | --- | --- |
| **pass** | `passed ≥ need` | green |
| **fail** | `passed + errored < need` | red — `CrucibleVerdictError` with `outcome: 'failed'` |
| **errored** | otherwise (the errored runs could have made the difference) | red — `CrucibleVerdictError` with `outcome: 'errored'`, reported as *errored, not failed* |

The errored zone exists so that a judge outage never masquerades as a semantic
regression: the test still goes red (there is no evidence it passed), but the
message tells you the cause is infrastructure.

Worked examples:

| `runs` | `threshold` | `need` | Runs observed | Zone |
| --- | --- | --- | --- | --- |
| 20 | 0.35 | 7 (`0.35 × 20 = 7`) | 7 passed, 13 failed | pass |
| 20 | 0.35 | 7 | 6 passed, 14 failed | fail |
| 20 | 0.95 | 19 | 19 passed, 1 failed | pass |
| 20 | 0.95 | 19 | 18 passed, 2 failed | fail |
| 20 | 0.95 | 19 | 18 passed, 1 errored, 1 failed | errored |
| 100 | 0.07 | 7 (not 8) | 7 passed | pass |
| 1 | 1.0 | 1 | 1 errored | errored |

### Reading the failure report

The `CrucibleVerdictError` message is a report rendered from the run records
when the verdict is reached; nothing is printed while runs are in flight. For
`{ runs: 20, threshold: 0.95 }` with mixed outcomes it reads (this example
sets `"excerptChars": 60` to keep the excerpt short):

```text
FAILED: 14/20 runs passed (pass rate 0.7) against threshold 0.95 (need 19).
Runs: 14 passed, 5 failed, 1 errored, 0 discarded.

[FAILED] Run #2
  First failed assertion: coherent (assertion 2 of 3 judged in this run)
  Claim: the reply never reveals the meeting location
  Judge reasoning: The reply names the Blue Door cafe on 5th street,
    which is the secret meeting location.
  Response excerpt (first 60 of 116 chars): Sure — Bob said he would meet Jane at the Blue Door cafe on …
  Thrown: Error: expect(received).toBe(expected)

[FAILED] Run #9
  …

[FAILED] Run #12
  …

+ 2 more failed run(s) not shown in full: #14, #18.

Failing claims (first failure of each of the 5 failed runs):
  4 run(s): coherent "the reply never reveals the meeting location"
  1 run(s): coherent "Jane does not know about the contract"

[ERRORED] Run #5 (infrastructure, not a semantic failure)
  Cause: CrucibleError: OpenRouter returned 503 after 3 attempts
  Judge attempts: 3
```

- **Headline.** `FAILED:` is a semantic failure; `ERRORED, not failed:` means
  infrastructure (the errored zone, a fatal provider error, or the deadline)
  left no evidence either way. The pass rate is rounded down, so it never
  displays as meeting a threshold it missed; `need` is the exact criterion.
  The `Runs:` line counts every status. A single-run test says
  `the smoke run (runs: 1)` instead and has no `Runs:` line.
- **Per failed run** (`[FAILED]`): the run's *first* failure — its
  lowest-sequence false verdict — with the assertion name and which of the
  run's judged assertions it was, the claim, the judge's reasoning, a bounded
  excerpt of the judged response, and the error your test threw. If a judge
  call errored before any false verdict, that error is shown instead.
- **Per errored run** (`[ERRORED]`): the infrastructure cause and the judge
  attempts made.
- **Discarded runs** (`[DISCARDED]`): one line of run numbers; counted in no
  zone.
- **Bounded output.** At most three failed and three errored runs are shown
  in full (lowest run number first; after a fatal abort the run that hit the
  fatal error is always shown first). The rest are listed by number, and when
  failed runs are hidden a `Failing claims` tally groups every failed run by
  its first failing assertion and claim, so you can see whether the failures
  share one cause.
- **Response excerpt length.** 500 characters by default. Set
  `"excerptChars"` (an integer ≥ 1) in `crucible.config.json` to change it; an
  invalid value fails at config load as a `CrucibleError` of kind `config`.
  Lengths are counted in UTF-16 code units, and the cut never splits an emoji
  or other surrogate pair, so the excerpt can differ from the limit by one;
  the header states the length actually shown.
- **Need more?** The bound and the tally are the `default` verbosity. Turn the
  volume up with [`full` or `debug`](#verbosity) to see every run.

### Verbosity

One suite gives terse CI output and deep local traces. There are three
levels; each includes everything the level before it shows.

| Level | What you get |
| --- | --- |
| `default` | The failure report above, only when a test fails. Nothing is printed while runs execute or when a test passes. |
| `full` | Every run in the report, with all of its judge output: each `coherent` call in the order it was recorded (passing verdicts included), its claim, the judge reasoning, the bounded response excerpt, and any judge errors. There is no three-run bound and no tally. A passing test prints the same report under a `PASSED:` headline when it finishes. |
| `debug` | `full`, plus a live trace while the test runs: engine start-up and the resolved config, test start (runs, threshold, deadline), each provider request and response, retry attempts and backoff, judge re-asks, each recorded verdict or judge error, how each run settled, and the verdict. |

Set the level in `crucible.config.json` with `"verbosity"`, or for a single
invocation with the `CRUCIBLE_VERBOSE` environment variable. The variable wins
over the config file; an empty value is ignored:

```sh
CRUCIBLE_VERBOSE=debug npx jest checkout.test.ts
```

The level is resolved once, when the first test executes (registering tests
never reads config). An invalid `"verbosity"` in the config file fails as a
`CrucibleError` of kind `config`; an invalid `CRUCIBLE_VERBOSE` fails as kind
`usage`. Both messages list the valid levels: `default`, `full`, `debug`.

A run at `full` lists its judge calls like this:

```text
[PASSED] Run #1
  Judge call 1 of 1: coherent verdict true
    Claim: the reply never reveals the meeting location
    Judge reasoning: The reply declines to say where they meet.
    Response excerpt: I can't share that, but I can pass on a message.
```

A `debug` trace looks like this (lines from concurrent runs interleave, so
each line inside a run names it):

```text
[crucible:debug] engine init: verbosity debug, trace written to stdout
[crucible:debug] config resolved: provider "openrouter", model "openai/gpt-5", meta keys [temperature] (values not shown), testDefaults {"runs":5}, excerptChars 500
[crucible:debug] test started: 5 run(s) at threshold 0.8, deadline 34000 ms
[crucible:debug] run #2 provider request attempt 1 to "openrouter": model "openai/gpt-5", system prompt 4210 chars, meta keys [temperature]
    prompt (312 chars): STATE …
[crucible:debug] run #2 provider attempt 1 failed (retryable, retrying in 412 ms): OpenRouterHttpError: …
[crucible:debug] run #2 provider response attempt 2
    reply (61 chars): {"verdict":true,"reasoning":"The reply declines to say."}
[crucible:debug] run #2 judge verdict true for coherent "the reply never reveals the meeting location"
    reasoning (27 chars): The reply declines to say.
[crucible:debug] run #2 settled passed
[crucible:debug] verdict pass: 5 passed, 0 failed, 0 errored of 5 (need 4)
```

What the trace never shows:

- **Your API key.** The trace is taken at crucible's provider interface, above
  the HTTP layer, so request headers never reach it.
- **`meta` values.** Only `meta` key names are shown, because values can hold
  secrets.
- **Unbounded payloads.** Prompts and replies longer than 2000 characters are
  cut, with their full length stated. The system prompt (the judge
  instructions, the same on every call) is shown by length only.

All output goes to standard output; crucible never writes files at any level.
The trace is written straight to `process.stdout`, not through `console.log`:
Jest buffers `console` output until a test finishes and wraps every call in a
source-location block, which would hide the trace of a hung test. Because it
bypasses Jest's capture, `--silent` does not mute it, and in an interactive
terminal it can interleave with Jest's progress line; run with `--runInBand`
or redirect to a file (`> trace.txt`) for a clean read. The engine-init and
config lines are printed once per test file (Jest loads crucible afresh for
each file).

### Timeout

Each `crucible.it()` test has a deadline computed from its **resolved** run
count — the value from `crucible.it()`, `testDefaults`, or the built-in:

```text
deadline = 30 000 ms + 1 000 ms × (runs − 1)
```

That is 30 s in smoke mode, 49 s for `runs: 20`, 79 s for `runs: 50`. It
covers the whole test — your arrange and act steps as well as the judge — and
is not configurable in v1. Jest's `testTimeout` setting does not apply.

Crucible enforces the deadline itself. When it passes:

- every run still in flight is aborted — their in-flight judge calls are
  cancelled, so no further judge spend happens;
- runs that already settled keep their status, and unfinished runs become
  *discarded*;
- the test fails with a `CrucibleVerdictError` whose `outcome` is
  `'errored'` — an infrastructure problem, never a semantic failure — and the
  report headline names the deadline and the settled and discarded runs.

Your own code inside a discarded run (for example, a call to your system
under test) is not cancelled; its result is simply ignored.

Jest still gets a timeout as a backstop that never fires before Crucible's
deadline: 5 s above the deadline when `runs` is passed to `crucible.it()`,
and the largest timeout Jest supports (about 24.8 days) when it is not —
at registration Crucible cannot know the run count `testDefaults` will supply
without loading the config, so the backstop must not undercut any of them.

Separately, each judge reply attempt — including the provider retries inside
it — has its own 30 s deadline; when that expires the run is *errored*, not
failed, and the other runs carry on.

### Re-entrancy contract

Runs execute concurrently and share nothing, which is only safe if your body
is re-entrant:

- **Build a fresh system under test inside the body.** Every run must arrange
  its own instance. An object created once at module scope and mutated by the
  body is mutated by 20 runs at the same time.
- **`crucible.load()` and `crucible.append()` are per-run.** Both add a
  string, or an array of strings, to the context of the run they are called
  from, and that run's judge calls see only what that run added.
  Calling either outside a `crucible.it()` body throws a `usage` error.

```ts
crucible.it('Jane looks for Bob', { runs: 20, threshold: 0.85 }, async () => {
  const story = await createStory('The Long Weekend'); // fresh per run
  await story.memory('Bob is at the casino');
  crucible.load(story.getLogs()); // visible to this run's judge calls only

  const response = await story.input('Jane looks for Bob');

  expect(
    await crucible.coherent(response, "Jane won't find Bob, because they aren't in the same place"),
  ).toBe(true);
});
```

## A threshold is a sampled estimate

Suppose your system satisfies a claim with true probability `p` on any one
run, and runs are independent. The number of passing runs out of `runs` then
follows a binomial distribution, and the gate goes green exactly when that
count reaches `need`:

```text
P(green) = Σ_{k = need}^{runs}  C(runs, k) · p^k · (1 − p)^(runs − k)
```

Take the configuration from the README, `{ runs: 20, threshold: 0.95 }`, and
a system that is *exactly* as good as the gate asks — `p = 0.95`. It needs 19
of 20:

```text
P(green) = P(X ≥ 19) = 0.95^20 + 20 · 0.95^19 · 0.05 = 0.7358
P(red)   = 0.2642
```

**A true-0.95 system fails a `{ runs: 20, threshold: 0.95 }` gate about 26%
of the time** — roughly one CI run in four, with nothing wrong. Put ten such
tests in a suite and at least one of them is red on 95.3% of builds.

This is not a Crucible bug and not judge noise; it is what setting the gate
equal to the true rate means. Half the battle is knowing that a 0.95 measured
on 20 runs is itself uncertain: 19/20 is consistent with any true rate from
0.75 to 0.999 (95% Clopper-Pearson interval).

## False-red table

Probability that the gate goes red, by true per-run pass rate `p` (assuming
no errored runs). Where `p` is at or above your threshold these are **false
reds**; where `p` is well below it they are the regressions you want caught.

| `runs` | `threshold` | `need` | p = 0.99 | p = 0.95 | p = 0.90 | p = 0.85 | p = 0.80 | p = 0.70 |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
| 1 | 1.0 | 1 | 1.0% | 5.0% | 10.0% | 15.0% | 20.0% | 30.0% |
| 5 | 1.0 | 5 | 4.9% | 22.6% | 41.0% | 55.6% | 67.2% | 83.2% |
| 10 | 0.9 | 9 | 0.4% | 8.6% | 26.4% | 45.6% | 62.4% | 85.1% |
| 20 | 0.95 | 19 | 1.7% | **26.4%** | 60.8% | 82.4% | 93.1% | 99.2% |
| 20 | 0.9 | 18 | 0.1% | 7.5% | 32.3% | 59.5% | 79.4% | 96.5% |
| 20 | 0.85 | 17 | 0.0% | 1.6% | 13.3% | 35.2% | 58.9% | 89.3% |
| 20 | 0.8 | 16 | 0.0% | 0.3% | 4.3% | 17.0% | 37.0% | 76.2% |
| 50 | 0.9 | 45 | 0.0% | 3.8% | 38.4% | 78.1% | 95.2% | 99.9% |
| 50 | 0.85 | 43 | 0.0% | 0.3% | 12.2% | 48.1% | 81.0% | 99.3% |
| 100 | 0.9 | 90 | 0.0% | 1.1% | 41.7% | 90.1% | 99.4% | 100.0% |

Values are exact binomial tail probabilities, rounded to one decimal; `0.0%`
and `100.0%` mean "rounds to", not "impossible" or "certain".

Two things to read off it:

- **The diagonal is noisy.** Wherever `p` equals the threshold (20 / 0.95 at
  0.95, 50 / 0.9 at 0.90, 20 / 0.85 at 0.85), the false-red rate sits between
  roughly a quarter and a half. More runs do not fix that — at the diagonal
  the gate is a coin flip weighted by where `need` falls.
- **More runs sharpen the gate around its threshold.** Moving from 20 to 50
  runs at 0.85 cuts false reds for a 0.95 system from 1.6% to 0.3% *and*
  raises the chance of catching a drop to 0.80 from 59% to 81%.

## Headroom patterns

### 1. Measure first, with many runs

Before choosing a gate, measure how reliable the behaviour actually is. A
measurement run with `threshold: 1` reports its count when any run fails:

```ts
crucible.it('Jane looks for Bob', { runs: 100, threshold: 1 }, body);
// FAILED: 95/100 runs passed (pass rate 0.95) against threshold 1 (need 100).
```

Treat the result as a range, not a point: 95/100 gives a 95% interval of
0.887–0.984; 190/200 narrows it to 0.910–0.976. Measurement runs cost
`runs ×` assertions judge calls (see [Cost](#cost)), so do this once, not on
every build.

### 2. Gate below measured reliability

Set the threshold comfortably below what you measured, so the gate is red
only when behaviour has genuinely got worse.

**Worked example.** Measured 95/100. Gate at `{ runs: 20, threshold: 0.85 }`
(need 17):

| If the true rate is | The gate goes red |
| --- | --- |
| 0.95 (as measured) | 1.6% of builds |
| 0.80 (mild regression) | 58.9% of builds |
| 0.70 (clear regression) | 89.3% of builds |

Compare `{ runs: 20, threshold: 0.95 }` on the same system: red on 26.4% of
builds with nothing wrong. Even `threshold: 0.9` still gives 7.5% false reds.

### 3. Need a tighter gate? Add runs, not threshold

If 59% detection of a drop to 0.80 is not enough, keep the headroom and buy
resolution with runs. `{ runs: 50, threshold: 0.85 }` (need 43):

| If the true rate is | `runs: 20` red | `runs: 50` red |
| --- | --- | --- |
| 0.95 | 1.6% | 0.3% |
| 0.80 | 58.9% | 81.0% |
| 0.70 | 89.3% | 99.3% |

The price is 2.5× the judge calls and a longer test (79 s deadline instead of
49 s).

### 4. Headroom is relative to the true rate, not your estimate

The headroom has to hold against the low end of your measurement. If the true
rate of the system above is really 0.887 (the bottom of its 95% interval),
`{ runs: 20, threshold: 0.85 }` goes red 18.3% of the time and
`{ runs: 50, threshold: 0.85 }` 19.9% — more runs no longer help, because the
threshold is now close to the true rate. If a gate keeps flickering, measure
again with more runs before lowering the threshold or blaming the judge.

### 5. Reading a red near the edge

The failure headline gives you everything needed to judge whether a red is
noise: `18/20 runs passed (pass rate 0.9) against threshold 0.95 (need 19)` on a system
measured at 0.95 is exactly the 26% case above. Read the per-run judge
reasoning before re-running: if the failing runs show a real defect, the
gate did its job.

## Cost

Judge calls are metered spend. For one execution of one `crucible.it()` test:

```text
judge calls = coherent() assertions per run × runs   (plus any retries)
```

- Every run executes in full, even after `need` passes have been reached —
  only a fatal error or the test deadline stops a test early.
- Retries add calls on top: a failing provider call is attempted up to 3 times
  with backoff, and a reply that is not valid verdict JSON is asked for once
  more.
- All runs start together, so a test can have up to `runs` judge calls in
  flight at once — mind your provider's rate limits.
- No judge traffic happens outside test execution.

Example: two `coherent()` assertions at `{ runs: 50 }` is 100 judge calls per
execution — about $0.004 with `deepseek/deepseek-v4-flash-0731`
(~$0.00004/call) or $0.25 with `anthropic/claude-sonnet-5` (~$0.0025/call).
Per-call costs come from [judge-models.md](judge-models.md); multiply by the
number of inference tests and CI executions per day before choosing a
measurement-sized `runs` for every build.
