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

Starting a new port? Read the [porting guide](PORTING.md) first: the public
API a port provides, what is runner-specific, what these fixtures cover and
what each port tests itself, and the order to build it in.

## Layout

```
spec/
  README.md                     this file: format, runner contract, operations
  PORTING.md                    the checklist a new port follows
  fixture.schema.json           JSON Schema (draft-07) every fixture file follows
  surface.json                  the public surface, each item with the cases that pin it
  surface.schema.json           JSON Schema (draft-07) of surface.json
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
  jsonc/
    parse.json                  operation "parse"
  config/
    load.json                   operation "load"
  provider/
    request.json                operation "request"
    request-conformance.json    operation "request", generated (see below)
    response.json               operation "response"
    plain-http-warning.json     operation "plain-http-warning"
  judge/
    reply.json                  operation "reply"
  assertion/
    call.json                   operation "call"
```

A file holds the cases of one **operation** of one **area**. An operation
is one behaviour a port implements, with one input shape and one outcome
shape, described under [Operations](#operations). An operation may span more
than one file: `<operation>.json` holds the hand-written cases and
`<operation>-<source>.json` holds cases generated from another source. A
runner runs every file whose `area` and `operation` name the operation.

### Generated goldens

`payload/coherent-conformance.json` and `payload/extract-conformance.json`
hold one case per conformance case (`e2e/ext/fixtures/*-conformance.json`).
Their expected text is produced by the conformance harness's own jq payload
builder (`e2e/ext/conformance/payload-sections.jq` and
`<suite>-payload.jq`), so a port that passes them sends, for every
conformance case, the very payload `make conformance` sends to the model.

`provider/request-conformance.json` holds the whole HTTP request the harness
builds (`conformance.sh request <suite> <case index>`: its URL, its headers
and the JSON body of its own `chat_request`, with the system prompt read from
`schemas/<suite>.md`) for the first case of each suite with the repository's
harness config (`e2e/crucible.config.json`), and for the first coherent case
with one config of each other provider shape (`openai` with `apiKeyEnv`,
`openai-compatible` with a trailing slash in `baseUrl`, `openai-compatible`
without a key). The envelope does not depend on the case, and the payload of
every case is already pinned by the payload goldens, so a port that passes
both sends, for every conformance case, the request `make conformance`
sends: same system prompt (the schema file verbatim), model, `meta` members,
messages, URL and `Authorization` header. One difference is removed on
purpose: for `openrouter` the harness adds `"usage": { "include": true }` to
the body to print the cost of each call. Crucible does not send it (a port
must not either), so the golden drops that member (keeping a `usage` the
config's `meta` sets, which both send) and says so in the description of
each `openrouter` case.

Never edit generated goldens by hand:

- `make spec-goldens` regenerates them (needs `jq` and the installed
  `node_modules`, for Prettier; no network). `make spec-payloads` is an alias.
- `make spec-goldens-check` (run in CI; alias `make spec-payloads-check`)
  fails when any golden is stale (a changed schema file, conformance case,
  harness config or harness builder makes them stale), also runs the jq
  builder over every hand-written payload case (jq and every port agree on
  the same text), and fails when a fixture file under `spec/` is not
  registered with the TypeScript runner.
- The TypeScript runner also checks, without jq, that the payload goldens
  hold exactly the current conformance cases with their current inputs, and
  that the request goldens hold the current harness config and the current
  payload of each suite's first case.

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
    report areas and `provider` / `response` use it.
  - `{ "error": { "kind": "usage" | "config" } }` or
    `{ "error": { "kind": "infra", "retryable": <bool> } }`: the operation
    fails with a Crucible error of this kind. `retryable` is required for
    `infra` and never present for the other kinds. Message text is never part
    of a fixture.
  - An `error` may also hold `"mustNotContain": ["<string>", …]` (at least
    one non-empty string): the error's message, and anything else the port
    shows the user for this error, must not contain any of these strings.
    It is how a fixture says a secret (a key pasted into the wrong field, a
    password in a URL) is never echoed. It says nothing else about the
    message. "Contain" is a plain substring test on the string exactly as
    the fixture gives it, applied to the error's message, its string form
    and every error in its cause chain. An escaped or partial rendering of
    the secret (`sk-spec\nsentinel` for a key holding a line break) reveals
    it just the same, even though the substring test cannot see it: the
    safe implementation never puts the value into an error at all.

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
| `{ "$special": "unreadable" }`      | only as a file in the `files` input of `config` / `load`: the file exists but cannot be read (permissions, a directory, an I/O error). Nowhere else.                                                                         |
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
   - when `expect.error` holds `mustNotContain`, also keep, as
     `mustNotContain` of the captured error, those strings of the expected
     list that the error does **not** reveal (its message, string form and
     cause chain, see above). The lists are then equal exactly when nothing
     was revealed.
   - where an input lists what the outside world answers in turn (the
     `responses` of `provider` / `response`, the `replies` of `judge` /
     `reply`), fail the case if the operation asks for more entries than
     the list holds: that is a fixture bug, never a network failure.
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
`src/core/trace-reporter.spec-fixtures.test.ts`,
`src/core/jsonc-reader.util.spec-fixtures.test.ts`,
`src/core/config.spec-fixtures.test.ts`,
`src/providers/chat-completions-adapter.spec-fixtures.test.ts`,
`src/providers/transport-security.util.spec-fixtures.test.ts`,
`src/core/judge-exchange.spec-fixtures.test.ts`,
`src/core/scoped-assertions.spec-fixtures.test.ts`,
`src/core/spec-fixtures.test.ts` (schema, ids, golden currency) and
`src/core/spec-surface.test.ts` (the [surface manifest](#surface-manifest-and-coverage-check)). Their
harnesses live in `src/core/test/` and `src/providers/test/`. Where an
operation's outcome is an HTTP request, the TypeScript runner gets it the
way a user would see it: a fake HTTP boundary answers each request with the
request itself as the judge's reply, read back through the real judge
exchange. A new fixture file is registered in
`src/core/test/spec-fixtures.util.ts`; an unregistered file is neither checked
nor run. The TypeScript runner compares header names exactly, which is
stricter than rule 5 of `provider` / `request` requires.

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
  contract says so (`report` / `trace` does, and `provider` / `response`
  returns the reply exactly as the provider sent it, trailing white space
  included).
- **Line breaks in values** (report only). Where a value is split into lines,
  a break is `\r\n`, `\r`, `\n`, U+2028 or U+2029 (`\r\n` counts as one).
  Payload fencing uses its own, wider break set (adds VT, FF, U+001C–U+001E
  and U+0085, to match every common line splitter); see `payload` /
  `coherent`.
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
  by default, and even `UnsafeRelaxedJsonEscaping` still escapes astral
  characters, with uppercase hex; Java/Python libraries differ too: write
  the string escaper yourself.
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

**Fencing.** Every section's content goes through this rule before it is
placed between its fences:

1. For the check only, split the content into lines at every line break:
   U+000A (`\n`), U+000B (VT), U+000C (FF), U+000D (`\r`), U+001C, U+001D,
   U+001E, U+0085 (NEL), U+2028 and U+2029. This is the set Python's
   `str.splitlines` uses and a superset of the Unicode mandatory breaks.
   `\r\n` is one break; splitting it as `\r` then `\n` gives the same
   result, because the empty line between them never matches. The order in
   which an implementation splits on the breaks does not matter.
2. For the check only, remove every invisible code point from the line:
   U+00AD, U+034F, U+061C, U+115F, U+1160, U+17B4, U+17B5, U+180B–U+180F,
   U+200B–U+200F, U+202A–U+202E, U+2060–U+206F, U+3164, U+FE00–U+FE0F,
   U+FEFF, U+FFA0, U+FFF0–U+FFF8, U+1BCA0–U+1BCA3, U+1D173–U+1D17A,
   U+E0000–U+E0FFF (Unicode's `Default_Ignorable_Code_Point` set, frozen
   here as listed). Work on code points, not UTF-16 code units: the last
   three ranges are astral.
3. The line matches when what is left, after trimming padding from both
   ends, is exactly `<<<` or exactly `>>>`. Padding is exactly these code
   points: U+0009, U+0020, U+00A0, U+1680, U+2000–U+200A, U+202F, U+205F,
   U+3000 (the ECMAScript `String.prototype.trim` set without the line
   breaks of step 1 and without U+FEFF, which step 2 removes). Nothing else
   counts: not U+001F or any other control character, no combining mark,
   and no Unicode-database class (`\s`, `Zs`, `isspace`, `\p{...}`), which
   differ between engines and versions.
4. A matching line gets one U+0020 in front of its first code point,
   whatever that is: a line that already starts with padding or an
   invisible code point still gains exactly one space (` >>>` →
   `  >>>`). The line itself, its padding and invisible code points, and
   every line break around it are kept byte for byte; every other line is
   left as is. Nothing else changes and nothing is ever truncated.

Examples (content → fenced content): `>>>` → ` >>>`; ` >>>` → `  >>>`;
`  >>>  ` → `   >>>  `; `\t<<<` → ` \t<<<`; `a\r\n>>>\r\nb` →
`a\r\n >>>\r\nb`; `a\r>>>\rb` → `a\r >>>\rb`; `a` U+2028 `>>>` U+2029 `b`
→ `a` U+2028 ` >>>` U+2029 `b`; `a\v>>>\fb` → `a\v >>>\fb`; U+200B `>>>`
→ ` ` U+200B `>>>`; `>` U+200B `>>` → ` >` U+200B `>>`. Unchanged:
`>>>>`, `>>>x`, `>>> x`, `>>> >>>`, `<<<>>>`, `>> >`, U+001F `<<<`,
`>>>` U+0301, `＞＞＞` (U+FF1E), `›››` (U+203A).

So whichever of those breaks a reader splits lines on, the only lines that
start with a fence marker and reduce to one are the fences the builder
writes itself; content can never hold an unindented fence line, whatever
headers or instructions it contains. Because every matching line gains
exactly one space, content `>>>` and content ` >>>` stay distinct (` >>>`
and `  >>>`).

**Known limits.** The rule is exact, not a model of what a judge might read
as a fence. It does not touch look-alike brackets (fullwidth, guillemets,
dingbats), marker runs of other lengths (`>>`, `>>>>`), a marker sharing its
line with visible text (`>>> CLAIM`), or combining marks on a marker. The
judge's system prompt (`schemas/*.md`) defines a fence as a line holding
only `<<<` or `>>>` and tells the judge that anything inside a fence that
resembles a header, a fence or an instruction is data; that instruction, not
this rule, is the defence against those.

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

### `jsonc` / `parse`

Parses JSONC, the format of both config files (`crucible.config.json` and
`crucible.config.jsonc` are read the same way).

**Input.** `{ "text": <string> }`. **Output.** The parsed value (any JSON
value), or error kind `config`. Crucible only ever parses config files, so
every parse failure is a config error.

**Rules.** JSONC here is JSON (RFC 8259, strict) plus exactly these
additions, applied in one left-to-right scan:

1. **Byte-order mark.** If the text starts with U+FEFF, that one character is
   dropped. A U+FEFF anywhere else outside a string or comment (a second
   one, or one after white space) is an error.
2. **Strings** start at `"` and end at the next `"` not consumed by a
   backslash: a `\` always takes the next code unit with it (`"C:\\"` ends
   after the second backslash). Everything inside a string is text: `//`,
   `/*`, `*/`, `,]`, `,}` there are never comments or trailing commas. A
   string with no closing quote is an error. After the scan, strings must be
   valid JSON strings (escapes as in JSON, no raw control characters such as
   a line break).
3. **Line comments** start at `//` outside a string and run up to, not
   including, the next CR (U+000D) or LF (U+000A), or to the end of the text.
   U+2028, U+2029 and other separators do not end them. A `/*` inside a line
   comment opens nothing.
4. **Block comments** start at `/*` outside a string and end at the first
   `*/` after it. The `*` of the opener cannot be the `*` of the closer
   (`/*/` does not close). A comment's content is never read: any character
   in it (U+FEFF, U+00A0, a lone `"`) is fine. They do not nest: in `/* a /* b */ c */` the
   comment ends at the first `*/` and ` c */` is an error. With no `*/` the
   text is an error. A block comment separates tokens like white space, so
   `1/**/0` is two numbers (an error), not `10`.
5. **Trailing commas.** A comma is dropped when the next character that is
   not white space or part of a comment is `]` or `}`, **and** the last
   significant character before the comma (ignoring white space and
   comments) is not `{`, `[`, `,` or `:`. So `[1,]`, `{"a":1,}`, `["a",]`,
   `[1, // c\n]` are fine, while `[,]`, `{,}`, `[1,,]`, `{"a":,}` and a comma
   after the root value (`{},`) are errors.
6. Everything else is strict JSON. White space between tokens is only
   U+0020, U+0009, U+000A and U+000D: U+00A0, form feed, vertical tab and
   other Unicode spaces are errors. Duplicate object keys are allowed and the
   last one wins. Empty text, white space only and comments only are errors.
   The root may be any JSON value. Numbers are IEEE 754 doubles as in
   JSON (an integer beyond 2^53 is the nearest double, not an exact big
   integer); fixtures use none that overflow. A `\uD800`-style escape that
   leaves a lone surrogate is outside the contract.

A port may report the line of a failure (TypeScript does); it is not part of
the outcome. The error never holds the text itself (a config file may hold a
pasted key), only, at most, a position.

### `config` / `load`

Loads the config the way every test run does: reads the config file, checks
it and resolves defaults and `CRUCIBLE_VERBOSE`.

**Input.** `{ "files": { "crucible.config.json"?: <file>, "crucible.config.jsonc"?: <file> }, "env"?: { <name>: <string> } }`.
A `<file>` is its text, or `{ "$special": "unreadable" }`. A missing name is
a file that does not exist. `env` holds the environment variables that are
set (default none); only `CRUCIBLE_VERBOSE` matters here.

**Output.** `{ "provider", "model", "meta"?, "verbosity", "testDefaults", "excerptChars" }`:
the provider's name, the model as written, `meta` only when the file sets it,
the effective verbosity, the `testDefaults` object (`{}` when absent) and
`excerptChars` (500 when absent).

**Rules, in this order.** The first rule that fails decides the error. Every
error is kind `config` except an invalid `CRUCIBLE_VERBOSE`, which is
`usage` (the invocation set it, not the file); the order only matters
between those two kinds, and is pinned by the `precedence-*` cases.

1. **Files.** If either file is unreadable: error. If neither exists: error.
   If both exist: error (keep one). Otherwise read the one that exists.
2. **Syntax.** The text is parsed as `jsonc` / `parse`; failure is an error,
   and that error never holds any of the file's text.
3. **Root.** The value must be a JSON object (not an array, null, string or
   number).
4. **Key-like fields.** A top-level field whose name, lower-cased
   (Unicode default lower-casing, independent of locale: ECMAScript
   `toLowerCase`, Java `toLowerCase(Locale.ROOT)`, C#
   `ToLowerInvariant`), is
   `apikey`, `api_key`, `key`, `token`, `secret` or `authorization` is an
   error, and the error never contains the field's value. (Only top-level
   names are checked; `meta` is passed through unchecked.)
5. **Unknown fields.** Every top-level field must be one of `provider`,
   `model`, `meta`, `verbosity`, `testDefaults`, `excerptChars`, `baseUrl`,
   `apiKeyEnv` or `$schema`, compared case-sensitively, whatever its value
   (null included). `$schema` is ignored, whatever its value. An unknown
   field's value is never echoed (its name may be).
6. **`provider`**: a string that is not empty after ECMAScript `trim` (see
   Text rules; Java's `String.trim` is not the same).
7. **`baseUrl`** (when present, for any provider): a string with no `?` and
   no `#` anywhere in the raw text (checked before parsing, so `%3F` is
   fine), that parses as an absolute URL under the
   [WHATWG URL Standard](https://url.spec.whatwg.org/) with scheme `http` or
   `https` and no username or password. Its value is never echoed (it may
   hold a password). The resolved base URL is the parsed URL's serialisation
   (`href`) with every trailing `/` removed: the scheme and host are
   lower-cased, a default port (`:80` for http, `:443` for https) is dropped,
   `.` and `..` path segments are resolved, the path keeps its case. Use a
   WHATWG parser: C#'s `Uri`, Java's `URI` and Python's `urllib` differ on
   these points and on others the fixtures do not pin (WHATWG strips
   leading and trailing spaces and control characters, drops tabs and line
   breaks, reads `\` as `/`, percent-encodes the path and converts host
   names to punycode). The `provider` / `request` cases are a sample, not
   the whole rule.
8. **`apiKeyEnv`** (when present, for any provider): a string whose whole
   text matches `[A-Za-z_][A-Za-z0-9_]*` (ASCII only; `$` in Python and
   Java also matches before a final line break, so use a full match). Its value is never echoed (a
   key pasted here is a common mistake).
9. **Provider name and settings.** `provider` must be exactly `openrouter`,
   `openai` or `openai-compatible` (case-sensitive, not trimmed).
   `openrouter` and `openai` take no `baseUrl` (even a valid one is an
   error); `openai-compatible` requires one. All three take `apiKeyEnv`.
10. **`model`**: a string that is not empty after ECMAScript `trim`. It is kept
    exactly as written, surrounding white space included.
11. **`meta`** (optional): a JSON object (not null or an array), kept as is.
12. **`verbosity`** (optional): exactly `default`, `full` or `debug`.
13. **`CRUCIBLE_VERBOSE`**: when set and not empty, it must be exactly
    `default`, `full` or `debug` (not trimmed) and replaces the configured
    verbosity; otherwise error kind `usage`. An empty value is ignored. It is
    checked after the configured verbosity, so an invalid configured value
    fails as `config` even beside a valid override.
14. **`testDefaults`** (optional): as `run-options` / `validate` with source
    `config`.
15. **`excerptChars`** (optional): a number with no fractional part, at least
    1 (`2.0` is 2; a string, boolean or null is an error). A port accepts
    integers up to at least 2147483647; behaviour above 2^53 is unspecified.

An optional field set to `null` is an error, never the same as leaving it
out (except `$schema`, which is ignored whatever its value).

Whether the key variable is set is not checked here; that happens when a
request is built (`provider` / `request`).

### `provider` / `request`

Builds the HTTP request of one judge call.

**Input.** `{ "config": <object>, "env"?: { <name>: <string> }, "system": <string>, "prompt": <string> }`:
`config` is the content of the config file (the runner writes it as the
text of `crucible.config.json`, the only file, and loads it with `config` /
`load` and the same `env`, so a config that fails there fails here with the
same error before any request), `env` the environment (default none), `system` the system
prompt (for a judge call, the text of `schemas/<coherent|extract>.md` word
for word) and `prompt` the user message (the `payload` text).

**Output.**

```json
{
  "method": "POST",
  "url": "https://openrouter.ai/api/v1/chat/completions",
  "headers": { "Authorization": "Bearer sk-spec-sentinel-key", "Content-Type": "application/json" },
  "body": { "model": "…", "messages": [{ "role": "system", "content": "…" }, { "role": "user", "content": "…" }] }
}
```

**Rules.**

1. **URL.** `<base>/chat/completions` where `<base>` is
   `https://openrouter.ai/api/v1` for `openrouter`,
   `https://api.openai.com/v1` for `openai` and the resolved `baseUrl` (no
   trailing `/`, see `config` / `load`) for `openai-compatible`. Nothing is
   inferred from the path: a `baseUrl` already ending in `/chat/completions`
   gets it twice. The method is always `POST`.
2. **Key variable.** The key is read from the variable `apiKeyEnv` names,
   or from `CRUCIBLE_JUDGE_KEY` when there is no `apiKeyEnv`. No other
   variable is ever read (not `OPENROUTER_API_KEY`, not `OPENAI_API_KEY`).
   The value is trimmed of white space (ECMAScript `trim`, see Text rules);
   an unset, empty or blank value is no key.
3. **No key.** `openrouter` and `openai` need a key: error kind `config`.
   `openai-compatible` needs one only when `apiKeyEnv` is set; without
   `apiKeyEnv` and with no key it sends the request with no `Authorization`
   header (a local server).
4. **Key characters.** The trimmed key must consist only of printable ASCII,
   U+0021 to U+007E (quotes and backslashes are allowed; spaces, control
   characters and non-ASCII are not). Otherwise error kind `config`, and the
   error never contains the key. A key that is set is checked even where
   none is required (keyless `openai-compatible`): it is never silently
   dropped.
5. **Headers.** The fixture lists exactly the headers Crucible sets:
   `Authorization: Bearer <key>` when a key is sent, and
   `Content-Type: application/json`. Header names are case-insensitive on the
   wire: a runner compares them case-insensitively, and ignores headers its
   HTTP client adds on its own (`Content-Length`, `User-Agent`, `Accept`,
   `Host`, …). Values compare exactly. Fixtures use a sentinel key, never a
   real one.
6. **Body.** One JSON object: every `meta` member as given (nested values,
   nulls and a `usage` member included), then `model` (the configured model,
   verbatim) and `messages` = `[{ "role": "system", "content": system },
   { "role": "user", "content": prompt }]`. `model` and `messages` always
   come from Crucible: a `meta` member with either name is replaced. Nothing
   else is added (no `temperature`, no `response_format`, no `usage`).
   The body is compared as parsed JSON, so member order and number spelling
   do not matter; send it as UTF-8 JSON with any valid escaping (TypeScript
   sends meta members first, then `model`, then `messages`, and escapes only
   what `JSON.stringify` escapes). Both texts are sent exactly, even when
   empty.

### `provider` / `response`

Turns the HTTP responses of one judge call's attempts into the judge's reply
text (before any JSON parsing of that text) or an error.

**Input.** `{ "responses": [ … ] }`: one entry per attempt, in order. An
entry is `{ "status": <integer>, "json": <any JSON> }` (a response whose body
is that JSON), `{ "status": <integer>, "text": <string> }` (a body that is
not JSON) or `{ "failure": "network" }` (no HTTP response: DNS, connection
or TLS failure). A call never uses more entries than it makes attempts; the
rest are never fetched. The rules are the same for every provider.

**Output.** Text: the reply. Or error kind `infra` with `retryable`.

**Rules.**

1. **One attempt.** A status from 200 to 299 is a success response; its body
   is parsed as JSON:
   - not JSON: retryable failure;
   - the body is an object with an `error` member that is not `null` (any
     other value counts, `false`, `0` and `""` included; do not test
     truthiness): if `error` is an object whose `code` is a JSON number, the
     attempt fails as if the response had that status, classified by rule 2
     on its numeric value (fatal exactly when `400 <= code < 500` and it is
     not 408 or 429, fractions included; any other number, 200 included, is
     retryable). Otherwise (not an object, no code, a string code) it is a
     retryable failure. This holds even beside valid choices (some providers
     report a failed generation with status 200);
   - otherwise the reply is `choices[0].message.content` when `choices` is an
     array whose first element has a `message` object whose `content` is a
     string (empty included). Anything else (no choices, empty array,
     `null` or array content, a root that is not an object) is a retryable
     failure. Other members (`id`, `usage`, further choices,
     `finish_reason`) are ignored, and the reply is kept exactly (white space
     included).
2. **Status classes.** Any other status fails the attempt without reading
   the body. 400 to 499 are **fatal**, except 408 (request timeout) and 429
   (rate limited), which are **retryable**; every other status (5xx, 3xx,
   anything outside 400 to 499) is retryable. A fatal response is a request
   the provider will refuse again (bad key, no credit, unknown model, bad
   body): retrying only burns time and money. Everything else may succeed on
   the next attempt.
3. A network failure is retryable.
4. **Attempts.** A call makes at most 3 attempts. A retryable failure is
   retried while attempts remain; a success ends the call with its reply.
   A fatal failure ends the call at once: error `infra`, `retryable: false`.
   A third retryable failure ends it: error `infra`, `retryable: true` (the
   test reports the run as errored, not failed). The wait between attempts
   is timing, not part of this operation.

### `provider` / `plain-http-warning`

Decides whether a judge call writes the warning that the key travels
unencrypted (TypeScript writes it to stderr, once per provider instance; the
wording is each port's business).

**Input.** `{ "baseUrl": <string>, "keySent": <boolean> }`: an
`openai-compatible` `baseUrl` that `config` / `load` accepts, and whether
the call sends a key. **Output.** `true` or `false`.

**Rule.** `true` exactly when a key is sent, the scheme is `http` and the
host, after WHATWG URL parsing, is not loopback. Loopback is the host
`localhost` (after parsing, so any letter case), the IPv6 address `[::1]`
(after parsing, so `[0:0:0:0:0:0:0:1]` too) or an IPv4 address
`127.x.y.z` (after parsing, so the shorthand `127.1` too). A host name that
merely starts like one (`localhost.example.com`, `127.0.0.1.example.com`)
is remote, and so are private and unspecified addresses (`192.168.x.y`,
`0.0.0.0`). The test is on the parsed host:

- IPv4 written any way WHATWG accepts (`127.1`, decimal `2130706433`, hex
  `0x7f.1`, a trailing dot `127.0.0.1.`) is parsed to an address first;
- a host name keeps its trailing dot, so `localhost.` is remote, and so is
  `foo.localhost`;
- only `[::1]` is IPv6 loopback: an IPv4-mapped address
  (`[::ffff:127.0.0.1]`) is remote, whatever a platform's `IsLoopback`
  says.

The call is made either way.

### `judge` / `reply`

Reads the judge's reply text into the result of a `coherent` or `extract`
call, asking the judge once more after an unusable reply.

**Input.** `{ "ask": "coherent", "replies": [<string>, …] }` or
`{ "ask": "extract", "type": "string" | "number" | "boolean", "replies": [<string>, …] }`:
the reply text of each ask, in order (one, or two when the first is
unusable). **Output.** `{ "verdict": <boolean>, "reasoning": <string> }` for
`coherent`, `{ "value": <value>, "reasoning": <string> }` for `extract`, or
error `infra` with `retryable: true`.

**Rules.**

1. **Unwrap.** Trim the reply (ECMAScript `trim`, so a leading U+FEFF goes
   too). If it starts with three backticks followed by zero or more ASCII
   letters (any case), remove those and the white space after them (white
   space here and below is the `trim` set, line breaks included). If it
   then ends with three backticks, optionally followed by white space,
   remove those. Trim again. So `` ```json `` and `` ```JSON `` fences, unclosed or unopened
   fences and fences on one line are removed, while `` ```json5 `` (the `5`
   stays) and `` ``` json `` (the tag stays) leave text that is not JSON, and
   `~~~` fences are not removed. Text before or after the JSON is never
   removed.
2. **Parse** the result as strict JSON (no comments, no trailing commas, one
   value; duplicate keys: the last wins). Numbers are IEEE 754 doubles: an
   integer beyond 2^53 becomes the nearest double, and one that overflows
   (`1e999`) is infinity. A lone-surrogate escape is outside the contract.
3. **Shape.** `coherent`: an object with a boolean `verdict` and a string
   `reasoning` (empty allowed). `extract`: an object with a `value` member
   (present; `null` allowed for every type) and a string `reasoning`; a
   non-null `value` must be a JSON string for `string`, a finite number for
   `number` (`2.0` is 2; infinity is unusable), a boolean for `boolean`.
   Objects and arrays are never values. Other members are ignored; key order
   does not matter.
4. **Re-ask once.** If the reply is unusable (rules 1 to 3), the judge is
   asked again with the same request. A usable second reply is the result;
   a second unusable reply is error `infra`, `retryable: true` (an
   infrastructure problem: the model broke its output contract). A usable
   first reply ends the call; the judge is not asked again. Each ask is a
   full `provider` / `response` call with its own attempts. Only unusable
   reply text triggers the re-ask: a `provider` / `response` error on either
   ask ends the call with that error unchanged (a fatal one stays
   `retryable: false`).

### `assertion` / `call`

Validates the arguments of `crucible.facts`, `crucible.coherent` and
`crucible.extract` (and the same functions of the run context `t`) the way a
test body calls them, and builds the user message the judge call sends. It
pins how call options reach the payload; `payload` / `coherent` and
`payload` / `extract` pin the payload text itself.

**Input.** `{ "assertion": "coherent" | "extract", "facts"?: [<any>, …], "strict"?: <boolean>, "args": [<any>, …] }`:

- `facts`: the argument of each `crucible.facts` call the run makes before
  the assertion, in order (default none). A call takes one string or an
  array of strings.
- `strict`: the test's resolved `strict` (see `run-options` / `resolve`;
  default `false`).
- `args`: the arguments of the one `coherent` or `extract` call, in order.
  A missing trailing argument is left out; `$special: undefined` is an
  argument passed as unset.

**Output.** Text: the user message, exactly as `payload` / `coherent` or
`payload` / `extract` builds it. Or error kind `usage`.

**Rules.**

1. **Facts.** Each `facts` call adds its string, or each entry of its
   array, to the run, in order. Anything else (a number, `null`, unset, an
   object, an array holding anything but strings, nested arrays included) is
   a `usage` error, and the assertion is never called.
2. **Arguments.** `coherent(actual, expectation, options?)` and
   `extract(text, description, options?)`: the first two arguments must be
   strings (empty allowed); anything else, a missing one included, is a
   `usage` error.
3. **Options.** Absent or unset: no options. Otherwise a plain object (not
   `null`, an array or a string) whose keys are all known, even when a
   key's value is unset: `facts` for `coherent`; `as`, `strict` and `facts`
   for `extract`. Else `usage`.
4. **`facts` option**: unset is none, else as rule 1 for one call. The
   call's facts follow the run's facts in `STATE` (`payload` input
   `callFacts`); they are not added to the run.
5. **`as`** (extract): unset is `string`; else exactly `string`, `number`
   or `boolean` (case-sensitive), sent as `TYPE`. Else `usage`.
6. **`strict`** (extract): unset keeps the test's `strict`; else `true` or
   `false` (never coerced), and wins over the test's. `MODE` is `strict`
   when the result is `true`, `lenient` otherwise. `coherent` has no mode.

Options objects a JSON file cannot hold (a class instance, an object with
an inherited key) are each port's business; TypeScript rejects anything but
a plain object as `usage`. So is an argument after `options`: TypeScript's
signature has no room for one and ignores it at run time, and no case
passes one.

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
- the inference timeout, the test deadline, aborts, and the waits between
  provider attempts (timing). Their classification is fixed, though: an ask
  that runs out of time fails as `infra`, `retryable: true`, and is not
  re-asked;
- that the plain-http warning is written once per provider and never holds
  the key, and its wording;
- `meta` values a JSON file cannot hold (TypeScript rejects a `meta` it
  cannot serialise as `usage`);
- the line number a port may give for a JSONC failure;
- the argument forms of `crucible.it`, `crucible.describe` and
  `crucible.gate` (options before the body, the trailing timeout, two
  bodies, an argument after the last one): they take functions, which a
  fixture cannot hold. The [porting guide](PORTING.md#3-what-the-fixtures-cover-and-what-a-port-tests-itself)
  lists them;
- reading the files themselves (where the working directory is, which file
  system errors mean "missing" rather than "unreadable").

## Known limits

- The schema checks each operation's input keys and their basic types, not
  every rule of an operation's contract (for example that `fatalRun` names an
  errored run, or that `runs` matches the results of a verdict ending). Cases
  outside a contract are a fixture bug, not a port's.
- Values inside run options layers stay free-form in the schema (any JSON or
  `$special`), because invalid values are what `validate` tests.
- `env` objects and the `config` of `provider` / `request` are free-form
  objects in the schema (the in-house checker supports no
  `additionalProperties` schema); config validity is what `config` / `load`
  tests.

## Surface manifest and coverage check

`surface.json` lists the public surface every port provides, item by item,
each with the ids of the cases that pin it:

| Section           | Items                                                                           | A cited case must                                        |
| ----------------- | ------------------------------------------------------------------------------- | -------------------------------------------------------- |
| `operations`      | every `<area>/<operation>`                                                      | (the list equals the operations of the fixture files)    |
| `functions`       | `crucible.*` and `t.*`, with `portTests`: what fixtures cannot pin              | exist                                                    |
| `runOptions`      | `runs`, `threshold`, …, with `default` and `valid`                              | mention the option in its input                          |
| `callOptions`     | `coherent.facts`, `extract.as`, …                                               | mention the option in its input; an `assertion` / `call` case must call that assertion and set the option in its `options` argument |
| `configFields`    | every config file field, `required`, `default`, `values`                        | mention the field in its input                           |
| `providers`       | each provider, its endpoint, `baseUrl` and key rule                             | mention the provider in its input                        |
| `environment`     | `CRUCIBLE_JUDGE_KEY`, `CRUCIBLE_VERBOSE`                                         | mention the variable in its input                        |
| `errorKinds`      | `usage`, `config`, `infra` with `retryable` `true` and `false`                  | expect exactly that error kind and `retryable`           |
| `verdictOutcomes` | `passed`, `failed`, `errored`                                                   | be a `verdict` / `compute` case with that outcome        |
| `reportText`      | every headline variant, section, field and trace line, as a fixed `text` marker | be a case of its `operation` whose expected text holds it |

"Mention" is a plain check: the name is a key anywhere in the input, a
string equal to it, or appears quoted (`"provider"`) inside a string (the
config file texts).

The TypeScript check (`src/core/spec-surface.test.ts`, part of `npm test`
and so of CI) fails when an item cites no case, cites an id no case has, or
cites a case that does not exercise it as above; when a section lists a
name twice; when the manifest's
operations differ from the fixture files'; or when the manifest and the
TypeScript surface differ: the functions of `crucible` and `t`, the keys of
`RunOptions`, `CoherentOptions` and `ExtractOptions`, the `ExtractType`
values and the `CrucibleErrorKind`s, `infra` once per `retryable` value (from the exported types, through
records the compiler checks for missing and extra keys), and the config
fields, required fields, `testDefaults` keys, defaults, enumerations and
providers of `schemas/crucible.config.schema.json`. So a new public option,
config field, provider or error kind fails CI until it is listed and pinned
by a fixture.

A port reuses the manifest the same way: it checks that every item it
exposes is in `surface.json` (and the reverse, except the deprecated
aliases `crucible.load` and `crucible.append`, which a new port may
omit), and its fixture runner, which runs every case, then proves each item. A port that skips a case by id
sees which items that weakens by searching the manifest for the id.

## Versioning

The spec is versioned with the repository. A port records the commit (or
release tag) of the spec it passes; [the porting guide](PORTING.md#4-shared-assets-and-versioning)
says how.

- Adding cases, or a new operation or area, is not a behaviour change for
  ports that already pass. They pick up the new cases when they update.
- Changing a case's `expect` changes behaviour. It needs a CHANGELOG entry
  and must land together with the TypeScript change that makes it pass.
- Ids are stable. A case whose input changes meaning gets a new id, and the
  old id is retired, never reused.
- A change to the fixture format changes `fixture.schema.json` and this
  README together, and every runner updates in the same change.
