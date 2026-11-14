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
  README.md               this file: format, runner contract, operations
  fixture.schema.json     JSON Schema (draft-07) every fixture file follows
  run-options/
    resolve.json          operation "resolve"
    validate.json         operation "validate"
  verdict/
    compute.json          operation "compute"
```

One file holds the cases of one **operation** of one **area**. An operation
is one behaviour a port implements, with one input shape and one outcome
shape, described under [Operations](#operations).

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
    byte for byte. No area uses it yet. The payload and report areas will.
  - `{ "error": { "kind": "usage" | "config" } }` or
    `{ "error": { "kind": "infra", "retryable": <bool> } }`: the operation
    fails with a Crucible error of this kind. `retryable` is required for
    `infra` and never present for the other kinds. Message text is never part
    of a fixture.

Cases only use inputs inside an operation's contract. What an operation does
with input outside it (a status not listed, a threshold out of range where the
contract says the input is valid) is not specified, and a port need not test
it.

`fixture.schema.json` enforces this shape. The id prefix and ids being unique
across files are checked by the runner, not the schema.

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
   - returned normally: `{ "value": <result> }`
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
`src/core/aggregator.util.spec-fixtures.test.ts` and
`src/core/spec-fixtures.test.ts` (schema and ids). Their harnesses live in
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

## Known limits

- The schema leaves `input` free-form: it does not check each operation's
  input shape, so a misspelt input key is not caught by the schema.
  Per-operation input schemas are planned for Story 8.2.

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
