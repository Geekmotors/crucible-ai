# Crucible spec

Language-neutral fixtures for Crucible's pure behaviour: things that take
inputs and give back a value, an exact text, or an error, with no judge call,
clock or file system involved. Every port (TypeScript today; C#, Python and
Java later) runs these same cases through its own code. A port that passes
them all behaves like every other port for that behaviour. The TypeScript
port runs them as part of `npm test`.

A fixture describes **inputs** and the **observable outcome**. It never
describes internal structure, class names or error message text. Message
wording is each port's business. Only the error kind is shared.

The judge instruction schemas (`schemas/*.md`) are shared the same way: every
port sends them word for word.

`spec/` lives in the repository only. It is not in the npm package.

## Layout

```
spec/
  README.md                     this file: format, runner contract, operations
  fixture.schema.json           JSON Schema (draft-07) every fixture file follows
  run-options/
    resolve.json                operation "resolve"
    validate.json               operation "validate"
  verdict/
    compute.json                operation "compute"
  payload/
    coherent.json               operation "coherent"
    coherent-conformance.json   operation "coherent", generated (see below)
    extract.json                operation "extract"
    extract-conformance.json    operation "extract", generated (see below)
  report/
    render.json                 operation "render"
    trace.json                  operation "trace"
```

A file holds the cases of one **operation** of one **area**. An operation
is one behaviour a port implements, with one input shape and one outcome
shape, described under [Operations](#operations). An operation may span more
than one file: `<operation>.json` holds the hand-written cases and
`<operation>-<source>.json` holds cases generated from another source. A
runner runs every file whose `area` and `operation` name the operation.

### Generated payload goldens

`payload/coherent-conformance.json` and `payload/extract-conformance.json`
hold one case per conformance case (`e2e/ext/fixtures/*-conformance.json`).
Their expected text is produced by the conformance harness's own jq payload
builder (`e2e/ext/conformance/payload-sections.jq` and
`<suite>-payload.jq`), so a port that passes them sends, for every
conformance case, the very payload `make conformance` sends to the model.
Never edit them by hand:

- `make spec-payloads` regenerates them (needs `jq` and the installed
  `node_modules`, for Prettier; no network).
- `make spec-payloads-check` (run in CI) fails when they are stale, also
  runs the jq builder over every hand-written payload case (jq and every
  port agree on the same text), and fails when a fixture file under `spec/`
  is not registered with the TypeScript runner.
- The TypeScript runner also checks, without jq, that the goldens hold exactly
  the current conformance cases with their current inputs.

## Fixture format

```json
{
  "area": "verdict",
  "operation": "compute",
  "description": "What the operation does.",
  "cases": [
    {
      "id": "verdict-compute-single-failed",
      "description": "A single failed run at threshold 1 fails.",
      "input": { "threshold": 1, "statuses": { "failed": 1 } },
      "expect": {
        "value": { "outcome": "failed", "need": 1, "passed": 0, "failed": 1, "errored": 0 }
      }
    }
  ]
}
```

- `area`, `operation`: kebab-case names. The pair picks the operation.
- `id`: kebab-case, starts with `<area>-<operation>-` (for example
  `run-options-validate-test-runs-zero`), unique across the whole spec, and
  stable. A port may use
  it as its test name and to skip a case it knowingly differs on. Never reuse
  an id for a different case.
- `description`: what the case shows, in one sentence.
- `input`: the operation's input, in the shape its contract gives.
- `expect`: exactly one outcome:
  - `{ "value": <JSON> }`: the operation returns this value.
  - `{ "text": "<string>" }`: the operation returns exactly this text,
    code unit for code unit (see [Text rules](#text-rules)). The payload and
    report areas use it.
  - `{ "error": { "kind": "usage" | "config" } }` or
    `{ "error": { "kind": "infra", "retryable": <bool> } }`: the operation
    fails with a Crucible error of this kind. `retryable` is required for
    `infra` and never present for the other kinds. Message text is never part
    of a fixture.

Cases only use inputs inside an operation's contract. What an operation does
with input outside it (a status not listed, a threshold out of range where the
contract says the input is valid) is not specified, and a port need not test
it.

`fixture.schema.json` enforces this shape, and each operation's input shape:
a fixture with an unknown area/operation pair, an unknown input key, a missing
required input key or a mistyped input value fails the schema. The id prefix
and ids being unique across files are checked by the runner, not the schema.

### Special values

JSON cannot hold some inputs a dynamic language can receive. An object with
the single key `$special` stands for one of them:

| Token                               | Meaning                                                                                                                                                                                     |
| ----------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `{ "$special": "NaN" }`             | IEEE 754 not-a-number                                                                                                                                                                       |
| `{ "$special": "Infinity" }`        | positive infinity                                                                                                                                                                           |
| `{ "$special": "-Infinity" }`       | negative infinity                                                                                                                                                                           |
| `{ "$special": "undefined" }`       | the value is present but unset: an explicit `undefined` in JavaScript, `None` in Python, `null` for a nullable option in C#. As a field value it means the same as leaving the field out. |

`$special` is a reserved key: no fixture holds a plain object whose only key
is `$special`, and a runner fails on a token not in this table. No `expect`
holds `NaN`.

A port decodes these tokens (recursively, anywhere in `input` or `expect`)
before calling the operation. A port whose types cannot express an input
(say, a string passed where a statically typed number is expected) skips that
case by id and notes why. The compiler already rules the input out.

## Writing a runner

A port needs one small runner per operation:

1. Load every fixture file of the operation. Load them through the build
   (embedded resources or JSON module imports), not by reading files at test
   time, if the port's rules forbid file reads in unit tests.
2. For each case, decode special values in `input` and `expect`.
3. Call the port's implementation of the operation with `input`, and capture
   the outcome:
   - returned normally: `{ "value": <result> }`, or `{ "text": <result> }`
     for an operation whose outcome is text
   - threw a Crucible error: `{ "error": { "kind": <kind> } }`, plus
     `retryable` when the error has one (`infra`)
   - threw anything else: fail the case (that is a bug, not an outcome).
4. Compare the captured outcome with `expect` by deep equality:
   - objects compare by key, in any order. A key whose value is unset
     (`undefined`/`None`/`null` for an option) equals a missing key.
   - numbers compare exactly, as the IEEE 754 double nearest the JSON
     literal (`0.9` is the double nearest 0.9). `20` and `20.0` are the same
     number.
   - arrays compare in order.

The runner also validates every fixture file against `fixture.schema.json`,
checks that every id starts with its file's `<area>-<operation>-` and checks
that ids are unique. The TypeScript runner does this with a small
built-in checker, so it needs no schema library.

TypeScript runners: `src/core/run-options.spec-fixtures.test.ts`,
`src/core/aggregator.util.spec-fixtures.test.ts`,
`src/core/payload-assembler.util.spec-fixtures.test.ts`,
`src/core/reporter.util.spec-fixtures.test.ts`,
`src/core/trace-reporter.spec-fixtures.test.ts` and
`src/core/spec-fixtures.test.ts` (schema, ids, golden currency). Their harnesses live in
`src/core/test/`. A new fixture file is registered in
`src/core/test/spec-fixtures.util.ts`; an unregistered file is neither checked
nor run.

## Operations

### `run-options` / `resolve`

Resolves the effective run options of one test, and of one extract call in
it.

**Input.** Every key is optional:

| Key            | Meaning                                                                                                                                     |
| -------------- | ------------------------------------------------------------------------------------------------------------------------------------------- |
| `testDefaults` | the config file's `testDefaults` object                                                                                                    |
| `groups`       | the options of each enclosing group (`crucible.describe`), outermost first                                                                  |
| `test`         | the test's own options (`crucible.it` / `crucible.gate`)                                                                                    |
| `call`         | the options of one `crucible.extract` call inside the test. It holds `strict` at most; no other key appears. When `call` is present, the output's `strict` is that call's mode. |

Every layer in the input is valid (validity is the `validate` operation's
job).

**Output.** `{ "runs", "threshold", "inferenceTimeout", "testTimeout", "strict" }`.

**Rules.**

1. Precedence, nearest wins, **one field at a time**: built-in →
   `testDefaults` → outer group → … → inner group → test → call (call:
   `strict` only). A layer that leaves a field out, or sets it to
   `undefined`, does not change that field.
2. Built-ins: `runs` 10, `threshold` 0.9, `inferenceTimeout` 30000,
   `strict` false.
3. `testTimeout`: the nearest declared `testTimeout`. If no layer declares
   one, it is `min(2147483647, 30000 + (runs − 1) × 1000)` using the
   **resolved** `runs`, so 10 runs give 39000. Compute it in 64-bit integers
   or doubles: `(runs − 1) × 1000` passes the 32-bit range from about 2.1
   million runs. Once any layer declares a `testTimeout`, the formula no
   longer applies, even when a nearer layer changes `runs`.
4. `strict` for an extract call is the call's own `strict` if it gives one.
   Otherwise it is the test's resolved `strict`.

### `run-options` / `validate`

Validates one run options value at one of the places a user writes it.

**Input.** `{ "source": "test" | "group" | "config", "options": <any JSON> }`:

- `test`: the options argument of `crucible.it` / `crucible.gate`.
- `group`: the options argument of `crucible.describe`.
- `config`: the `testDefaults` value of the config file. `config` cases
  never use `NaN` or infinities, because a JSON or JSONC file cannot hold
  them.

**Output.** On success, the accepted options as a value. They equal the
input. For `config`, a missing `testDefaults` (`$special: undefined`) is
accepted as `{}`.

**Errors.** Kind `usage` for `test` and `group`, kind `config` for `config`.
Each of these is an error:

- the value is not a plain object (`null`, an array, a number, a string, a
  boolean). For `test` and `group`, an unset value (`$special: undefined`) is
  an error too.
- a key other than `runs`, `threshold`, `inferenceTimeout`, `testTimeout`,
  `strict`, even when its value is unset
- `runs` that is not an integer ≥ 1 (`null`, strings, fractions, `NaN`, ±∞
  included)
- `threshold` that is not a number in (0, 1]
- `inferenceTimeout` or `testTimeout` that is not an integer from 1 to
  2147483647
- `strict` that is not `true` or `false`

"Integer" means a number with no fractional part. A boolean is never a
number: `runs: true` is an error even where a language treats `true` as 1.
`runs` has no upper bound. A port accepts integers up to at least 2147483647;
behaviour above 2^53 is unspecified, and no fixture goes there.

A known field set to `$special: undefined` is the same as a missing field,
and is valid.

### `verdict` / `compute`

Computes a test's verdict from its runs.

**Input.** `{ "threshold": <number in (0, 1]>, "statuses": { <status>: <count>, … } }`.
`statuses` gives how many runs ended in each status: `"passed"`, `"failed"`,
`"errored"` or `"discarded"`. A missing status means 0. The run count
(`runs`) is the sum of the counts, always at least 1. A port whose
implementation takes one status per run expands the counts into a list, in
any order: the outcome does not depend on order.

**Output.** `{ "outcome", "need", "passed", "failed", "errored" }`:

- `need = max(1, ceil(threshold × runs − 1e-9))`, computed in IEEE 754
  doubles in this order: multiply and round to a double, subtract `1e-9` and
  round to a double, then take the ceiling. No fused multiply-add, no
  decimal types. The `1e-9` keeps a product such as
  `0.28 × 25 = 7.000000000000001` from rounding up to 8, while
  `0.7000001 × 10 = 7.000001` still needs 8.
- `passed`, `failed`, `errored`: the count of each status. A `discarded` run
  counts toward the run total and so toward `need`, but toward no count and
  no zone.
- `outcome` (the three zones):
  - `"passed"` if `passed ≥ need`
  - otherwise `"failed"` if `passed + errored < need`: even if every errored
    run had passed, the test could not meet its threshold
  - otherwise `"errored"`: errored runs decide the verdict, so it says
    nothing about the system under test.

### Text rules

These rules hold for every `text` outcome and every operation below.

- **Characters.** Text is a sequence of UTF-16 code units, as in JavaScript,
  C# and Java strings. Every length ("chars"), cut and limit counts UTF-16
  code units: an astral character such as 😀 counts 2. A port whose strings
  count code points (Python) converts. No Unicode normalization anywhere:
  text passes through exactly as given. Fixture strings never hold a lone
  (unpaired) surrogate.
- **Objects keep their member order.** Where output lists an input object's
  keys (`meta`, `testDefaults` in `report` / `trace`), it uses the order the
  members appear in the fixture file, so parse input objects preserving
  member order (no hash map). Fixtures never use keys that look like array
  indices (`"0"`, `"12"`): JavaScript lists those first.
- **Line endings.** Output lines are separated by `\n` (U+000A) only. No
  `\r` is ever added. No `text` outcome ends with a newline unless its
  contract says so (only `report` / `trace` does).
- **Line breaks in values** (report only). Where a value is split into lines,
  a break is `\r\n`, `\r`, `\n`, U+2028 or U+2029 (`\r\n` counts as one).
  Payloads never split on anything but `\n`.
- **Blank line.** A line that is empty or holds only white space as
  ECMAScript `String.prototype.trim` defines it, exactly these code units:
  U+0009, U+000A, U+000B, U+000C, U+000D, U+0020, U+00A0, U+1680,
  U+2000–U+200A, U+2028, U+2029, U+202F, U+205F, U+3000, U+FEFF. Not
  U+0085, U+180E or U+001C–U+001F (Python's `str.isspace` and
  `str.splitlines` differ: do not use them).
- **Numbers** in running text (thresholds, pass rates) print as ECMAScript
  `Number.prototype.toString`: the shortest decimal that reads back as the
  same double, no trailing `.0` (`1`, `0.9`, `0.857`). Fixtures only use
  numbers that print in plain decimal notation. Counts and milliseconds are
  integers.
- **JSON values** (extracted values) print as ECMAScript `JSON.stringify`:
  `null`, `true`, `false`, numbers as above (`12.5`, `-3`), strings in double
  quotes escaping only `"`, `\`, `\b`, `\f`, `\n`, `\r`, `\t` and other
  U+0000–U+001F as `\u00xx` (lowercase hex), and a lone surrogate as
  `\udxxx` (lowercase hex). Every other character, astral ones included, is
  written raw, never `\u`-escaped. C#: `System.Text.Json` escapes non-ASCII
  even with `UnsafeRelaxedJsonEscaping` (astral characters, uppercase hex),
  and Java/Python libraries differ too: write the string escaper yourself.
  Extracted values are only `null`, booleans, numbers and strings.
- **The cut.** `cut(text, limit)` keeps the first `limit` code units. If the
  last kept unit is a high surrogate (U+D800–U+DBFF): with `limit > 1` it is
  dropped, so the cut is one unit shorter; with `limit == 1` the next unit is
  kept too, so the cut is the whole pair (never empty).
- **`…`** is U+2026 HORIZONTAL ELLIPSIS, one code unit.
- **Causes** are errors given as `{ "name", "message" }` and render as
  `describe(cause)` = `<name>: <message>`.

### `payload` / `coherent`

Builds the user message of a `coherent` judge call. The system message is the
file `schemas/coherent.md`, word for word (the whole file, front matter
included).

**Input.** `{ "facts"?: [string], "callFacts"?: [string], "response": string, "claim": string }`:
`facts` are the run's facts (`crucible.facts`), `callFacts` the call's own
`facts` option. A missing list is empty.

**Output.** Text: the sections below, each rendered as
`<HEADER>\n<<<\n<fenced content>\n>>>`, joined by `\n\n` (one blank line).
No leading or trailing newline.

1. `STATE`, only if `facts` followed by `callFacts` is not empty: those facts
   in that order, joined by `\n`. Facts are not trimmed or escaped; an empty
   fact is an empty line, and a fact holding `\n` spans lines.
2. `RESPONSE`: `response`.
3. `CLAIM`: `claim`.

**Fencing.** Content is split on `\n` only (a `\r`, U+2028 or U+2029 is
plain content). Every piece that equals exactly `<<<` or exactly `>>>` gets
one leading space (` <<<`, ` >>>`); every other piece is left as is (` >>>`,
`>>>>`, `>>> x`, `>>>\r` are unchanged). The pieces are joined back with
`\n`. So, read as `\n`-separated lines, content can never hold a line that
closes its section or opens a forged one, whatever headers or instructions it
contains. (A reader that also breaks lines on `\r`, U+2028 or U+2029 can still
see one: a known gap, kept for now so every port and the jq harness agree.)
Neutralising is one-way: content `>>>` and content ` >>>` look the same to
the judge. Nothing is ever truncated.

### `payload` / `extract`

Builds the user message of an `extract` judge call. The system message is the
file `schemas/extract.md`, word for word.

**Input.** `{ "facts"?: [string], "callFacts"?: [string], "response": string, "target": string, "type": "string" | "number" | "boolean", "mode": "lenient" | "strict" }`.
`type` is the resolved type (`string` when the caller asks for none); `mode`
is the call's resolved mode (see `run-options` / `resolve`).

**Output.** As for `coherent`, with the sections `STATE` (same rule),
`RESPONSE` (`response`), `TARGET` (`target`), `TYPE` (the type word) and
`MODE` (the mode word), in that order.

### `report` / `render`

Renders the report of one test: the message of a failed or errored test's
error, and (at `full` or `debug` verbosity) the report printed for a passing
test, which is written followed by one `\n`.

**Input.**

```json
{
  "settings": { "excerptChars": 500, "verbosity": "default" },
  "runs": 3,
  "threshold": 1,
  "ending": { "kind": "verdict" },
  "results": [
    { "status": "passed" },
    {
      "status": "failed",
      "cause": { "name": "AssertionError", "message": "expected false to be true" },
      "calls": [
        { "verdict": { "claim": "…", "verdict": false, "reasoning": "…", "response": "…", "facts": ["…"] } },
        { "extraction": { "description": "…", "type": "number", "mode": "strict", "value": null, "reasoning": "…", "response": "…" } },
        { "error": { "cause": { "name": "…", "message": "…" }, "attempts": 2 } }
      ]
    }
  ]
}
```

- `settings.verbosity`: `default`, `full` or `debug` (`debug` renders like
  `full`). `settings.excerptChars`: an integer ≥ 1.
- `runs`, `threshold`: the test's resolved run options. With
  `ending.kind: "verdict"`, `runs` equals the number of results.
- `ending`: how the test ended: `{ "kind": "verdict" }` (all runs settled),
  `{ "kind": "aborted", "fatalRun": <n> }` (a fatal error, raised by run
  number `n`, an errored run, stopped the test) or
  `{ "kind": "expired", "deadlineMs": <n> }` (the test deadline passed).
  `results` may then hold fewer entries than `runs`.
- `results`: the runs in run-number order (the first is run #1). A `failed`
  or `errored` run has a `cause`; `passed` and `discarded` runs have none.
  `calls` (default empty): the run's judge calls in the order they were
  recorded. A missing `facts` is empty.

**Verdict.** For `ending.kind: "verdict"`, `need`, `passed`, `failed`,
`errored` and the zone come from `verdict` / `compute` over the statuses of
`results` with `threshold`. Zone `passed` renders the passing headline,
`failed` / `errored` the failing ones.

**Fields.** `field(label, value, indent)` is `indent + label + ": " + v`,
where `v` is `value` split into lines (text rules), the first line as is,
each later line prefixed with `indent + "  "` unless it is blank, joined
with `\n`. Then every run of spaces and tabs at the end of any line is
removed. Indents: top-level fields 2 spaces, nested fields 4.

`bounded(label, value, indent)`: if `value` has at most `excerptChars`
code units, `field(label, value, indent)`. Otherwise `c = cut(value,
excerptChars)` and
`field(label + " (first " + len(c) + " of " + len(value) + " chars)", c + "…", indent)`.
For facts the value is the facts joined by `\n`, and when the code unit right
after `c` is `\n` (the cut ends on a whole fact, or on a line break inside a
fact) a `\n` goes between `c` and `…`, so the marker sits on its own line.
Only the code unit count decides truncation: with `excerptChars: 1` a value
that is one astral character (2 units) still renders as
`(first 2 of 2 chars): 😀…`.

- Facts field: no line when the call used no facts, else
  `bounded("Facts", facts joined by "\n", indent)`.
- Excerpt field: `bounded("Response excerpt", response, indent)`.

**Headline.** Smoke means `runs == 1`. `rate = floor(passed / runs × 1000 +
1e-9) / 1000`, computed in IEEE 754 doubles in this order: divide, multiply,
add, floor, divide (floored to three decimals, never rounded up).
`clause = "<passed>/<runs> runs passed (pass rate <rate>) against threshold <threshold> (need <need>)"`.
`settled = "<results − discarded>/<runs> runs settled"`, plus
`"; <discarded> in-flight run(s) discarded to stop spend"` when any run was
discarded.

| Ending          | Smoke                                                                                                                                  | Otherwise                                                                                        |
| --------------- | -------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------ |
| verdict, passed | `PASSED: the smoke run (runs: 1) passed.`                                                                                              | `PASSED: <clause>.`                                                                              |
| verdict, failed | `FAILED: the smoke run (runs: 1) did not pass.`                                                                                        | `FAILED: <clause>.`                                                                              |
| verdict, errored | `ERRORED, not failed: the smoke run (runs: 1) hit an infrastructure problem, so there is no verdict.`                                 | `ERRORED, not failed: <clause>; <errored> errored run(s) left the result inconclusive.`          |
| aborted         | `ERRORED, not failed: the smoke run (runs: 1) aborted on a fatal error. <FIX>`                                                         | `ERRORED, not failed: aborted on a fatal error after <settled>. <FIX>`                           |
| expired         | `ERRORED, not failed: the smoke run (runs: 1) did not finish within its <deadlineMs> ms deadline. <CHECK>`                             | `ERRORED, not failed: the test did not finish within its <deadlineMs> ms deadline; <settled>. <CHECK>` |

`<FIX>` is `Fix the provider setup (API key, model) or configuration and
rerun.`; `<CHECK>` is `Check for a slow system under test or a throttled
judge provider.`. Unless smoke, the headline is followed by `\n` and
`Runs: <p> passed, <f> failed, <e> errored, <d> discarded.` (counts of
`results`).

**Report.** The headline block, then each section, joined by `\n\n`. No
trailing newline. Run lists below keep run-number order, except that for an
aborted test the fatal run comes first among the errored runs.

**First failure** of a failed run: the first `verdict` call with
`verdict: false` (at position `p` among the run's verdict calls, of `j`
verdict calls in all) unless an `error` call comes before it, in which case
the first `error` call; with neither, none.

**Failed run section** (`[FAILED] Run #<n>`, then one line per field):

- none: `field("First failure", "no assertion returned false; the body threw")`
- error: `field("First failure", "a judge call errored after <attempts> attempt(s)")`,
  `field("Judge error", describe(error cause))`
- verdict: `field("First failed assertion", "coherent (assertion <p> of <j> judged in this run)")`,
  `field("Claim", claim)`, the facts field, `field("Judge reasoning", reasoning)`,
  the excerpt field

then `field("Thrown", describe(cause))`. At `default` verbosity each
`extraction` call `i` of `m` (in order) follows:
`field("Extraction <i> of <m> (<mode>)", "\"<description>\" as <type> → <json(value)>")`,
then, nested (4 spaces), its facts field, `field("Judge reasoning", …)` and
its excerpt field. The description is quoted as is, not escaped.

**Errored run section**: `[ERRORED] Run #<n> (infrastructure, not a semantic failure)`,
`field("Cause", describe(cause))`, and, when the run recorded an `error`
call, `field("Judge attempts", <attempts of its first error call>)`.

**Default verbosity sections**, in this order:

1. the first three failed runs, as failed run sections;
2. with more than three: `+ <k> more failed run(s) not shown in full: <ranges>.`
   and then the claim tally (below);
3. the first three errored runs, as errored run sections;
4. with more than three: `+ <k> more errored run(s) not shown in full: <ranges>.`;
5. if any run was discarded:
   `[DISCARDED] Run(s) <ranges>: still in flight when the test was cut off; counted in no zone.`

Passed runs get no section. `<ranges>`: the run numbers in list order, a
run that directly follows the previous number extending its range; a range
prints `#a-#b`, a single run `#a`; ranges are joined by `, `
(`#5, #7-#9`).

Claim tally: `Failing claims (first failure of each of the <f> failed runs):`
and one line per label, `  <count> run(s): <label>`, most frequent first,
equal counts in the order first seen. Over every failed run, the label of
its first failure is `coherent "<claim>"` (later lines of a multi-line
label indented by 4 spaces unless blank; trailing white space kept),
`a judge call errored`, or `thrown without a false verdict`. Runs are counted
together when their labels render to the same text (so claims `a\r\nb` and
`a\nb` share a line). The claim is quoted as is, not escaped.

**Full verbosity** (`full` or `debug`): every failed run (failed run section
without the extraction lines), every errored run, every passed run
(`[PASSED] Run #<n>`) and every discarded run
(`[DISCARDED] Run #<n> (cut off in flight; counted in no zone)`), in that
order, with no bound, ranges, tally or grouped discarded line. Each section
is followed by its judge calls: `  Judge calls: none recorded` when it has
none, else for each call `i` of `t`, in order:

- verdict: `field("Judge call <i> of <t>", "coherent verdict <true|false>")`,
  then nested `Claim`, facts field, `Judge reasoning`, excerpt field;
- extraction: `field("Judge call <i> of <t>", "extract (<mode>) \"<description>\" as <type> → <json(value)>")`,
  then nested facts field, `Judge reasoning`, excerpt field;
- error: `field("Judge call <i> of <t>", "errored after <attempts> attempt(s)")`,
  then nested `field("Judge error", describe(cause))`.

### `report` / `trace`

Renders the debug trace (`verbosity: "debug"`) written for a sequence of
events. Output is everything written, in order; each write ends with `\n`.

**Input.** `{ "settings": { "verbosity", "provider", "model", "meta"?, "testDefaults", "excerptChars" }, "events": [ … ] }`.
`meta` is the config's provider `meta` object (absent means `{}`, here and on
a `provider-request` event). `testDefaults` holds plain JSON values only (no
special values). Each event is an object with an `event` name, the fields
below, and an optional `run`: the run the event happened in (absent for
test-level events). With no events nothing is written, not even the header.

**Rules.**

- Below `debug` (`default`, `full`) nothing is written for any event.
- Before the first event line, once: `[crucible:debug] engine init: verbosity <verbosity>, trace written to stdout\n`
  and `[crucible:debug] config resolved: provider "<provider>", model "<model>", meta keys [<keys>] (values not shown), testDefaults <json(testDefaults)>, excerptChars <excerptChars>\n`.
  `<keys>`: the `meta` keys in the order given, joined by `, `. Meta values
  are never written. `json(testDefaults)` is compact JSON (no spaces) in key
  order. `provider` and `model` are written as is, never split into lines.
- Every quoted value (`"<provider>"`, `"<model>"`, `"<claim>"`,
  `"<description>"`) is written as is: a `"` inside it is not escaped.
- Each event writes `[crucible:debug] ` + (`run #<run> ` when `run` is set) +
  the headline, then, for events with a body, `\n    ` + the body, then
  `\n`. In headline and body, later lines (text rules) are prefixed with
  4 spaces unless blank; trailing white space is kept.
- `payload(label, value)`: `<label> (<len> chars): <value>` when `value` has
  at most 2000 code units, else
  `<label> (first <len(c)> of <len> chars): <c>…` with `c = cut(value, 2000)`.
  The 2000 bound is fixed; `excerptChars` does not apply.

| `event`                | Fields                                                     | Headline                                                                                                                                             | Body                   |
| ---------------------- | ---------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------- |
| `test-started`         | `runs`, `threshold`, `deadlineMs`                          | `test started: <runs> run(s) at threshold <threshold>, deadline <deadlineMs> ms`                                                                     |                        |
| `run-settled`          | `number`, `status`, `cause`?                               | `run #<number> settled <status>`, plus `: <describe(cause)>` with a cause                                                                            |                        |
| `test-aborted`         | `cause`, `discarded`                                       | `test aborted on a fatal error: <describe(cause)>; <discarded> in-flight run(s) discarded`                                                           |                        |
| `test-expired`         | `deadlineMs`, `discarded`                                  | `test deadline of <deadlineMs> ms expired; <discarded> in-flight run(s) discarded`                                                                   |                        |
| `verdict-reached`      | `outcome`, `need`, `passed`, `failed`, `errored`, `runs`   | `verdict <zone>: <passed> passed, <failed> failed, <errored> errored of <runs> (need <need>)`; zone `pass` / `fail` / `errored` for outcome `passed` / `failed` / `errored` |                        |
| `provider-request`     | `provider`, `model`, `system`?, `meta`?, `prompt`, `attempt` | `provider request attempt <attempt> to "<provider>": model "<model>", system prompt <len(system)> chars, meta keys [<keys>]`; `system prompt none` without a `system` field (an empty one prints `0 chars`); the system prompt text itself is never written | `payload("prompt", prompt)` |
| `provider-response`    | `attempt`, `reply`                                         | `provider response attempt <attempt>`                                                                                                                | `payload("reply", reply)` |
| `provider-failure`     | `attempt`, `cause`, `next`, `delayMs` (with `retry`)       | `provider attempt <attempt> failed (<why>): <describe(cause)>`; `<why>`: `retryable, retrying in <round(delayMs)> ms` (the nearest integer, ties toward +∞, as ECMAScript `Math.round`: `1234.5` → `1235`, `-2.5` → `-2`; not banker's rounding, the C# and Python default), `fatal, not retried`, `retryable, but no attempts left`, `the call was aborted` for `retry` / `fatal` / `exhausted` / `aborted` |                        |
| `judge-reply-rejected` | `ask`, `cause`                                             | `judge reply <ask> unusable: <describe(cause)>`                                                                                                      |                        |
| `judge-recorded`       | `call` (a `render` judge call)                             | verdict: `judge verdict <verdict> for coherent "<claim>"` (`true` or `false`); extraction: `judge value <json(value)> for extract "<description>" as <type> (<mode>)`; error: `judge call errored after <attempts> attempt(s): <describe(cause)>` | verdict, extraction: `payload("reasoning", reasoning)` |

### Out of scope for fixtures

Left to each port's own unit tests, because they depend on the language,
the clock or object identity:

- causes that are not errors (a thrown string, a plain object, a value whose
  rendering throws) and a failed run without a cause: how they print is
  each port's business (TypeScript prints JSON, then falls back to the
  string form, then `[unrenderable cause]`);
- how the fatal error of an aborted test is identified (TypeScript compares
  object identity; fixtures name the run);
- when events happen and in what order (runner behaviour), deadlines and
  backoff timing, stack traces;
- that a broken output stream never fails the caller, and that the passing
  report is written (followed by `\n`) only at `full` and `debug`;
- the provider wire format around the payload (request JSON, headers),
  covered by the provider area (Story 8.3) and the conformance harness.

## Known limits

- The schema checks each operation's input keys and their basic types, not
  every rule of an operation's contract (for example that `fatalRun` names an
  errored run, or that `runs` matches the results of a verdict ending). Cases
  outside a contract are a fixture bug, not a port's.
- Values inside run options layers stay free-form in the schema (any JSON or
  `$special`), because invalid values are what `validate` tests.

## Versioning

The spec is versioned with the repository. A port records the commit (or
release tag) of the spec it passes.

- Adding cases, or a new operation or area, is not a behaviour change for
  ports that already pass. They pick up the new cases when they update.
- Changing a case's `expect` changes behaviour. It needs a CHANGELOG entry
  and must land together with the TypeScript change that makes it pass.
- Ids are stable. A case whose input changes meaning gets a new id, and the
  old id is retired, never reused.
- A change to the fixture format changes `fixture.schema.json` and this
  README together, and every runner updates in the same change.
