# API reference

Everything is exported from the package root:

```ts
import { crucible, CrucibleError, CrucibleVerdictError } from 'crucible-ai';
import type {
  CrucibleErrorKind,
  ExtractedValue,
  ExtractOptions,
  ExtractType,
  RunOptions,
  TestBody,
  VerdictOutcome,
} from 'crucible-ai';
```

`crucible` is a frozen object with six functions: [`it`](#crucibleit),
[`describe`](#crucibledescribe), [`coherent`](#cruciblecoherent), [`extract`](#crucibleextract),
[`load`](#crucibleload-and-crucibleappend) and
[`append`](#crucibleload-and-crucibleappend). There are no `crucible.it.only`,
`.skip` or `.each` variants; to skip inference tests, wrap them in Jest's
`describe.skip`.

## `crucible.it()`

```ts
crucible.it(name, body);
crucible.it(name, body, timeout);
crucible.it(name, { runs, threshold, inferenceTimeout, testTimeout, strict }, body);
crucible.it(name, { runs, threshold }, body, timeout);
```

Registers one Jest test that executes `body` `runs` times concurrently and
passes when at least `threshold` of the runs pass. `runs` (integer ≥ 1) and
`threshold` (number in (0, 1]) default to the config's `testDefaults`, then to
`10` and `0.9`: with no options, the body runs 10 times and 9 runs must pass.
Each run calls your system under test and the judge, so an unconfigured test
costs 10 runs of your system and 10 judge calls per assertion. For a single
run that must pass, declare `{ runs: 1, threshold: 1 }` on the test or in
[`testDefaults`](runs-and-threshold.md#project-wide-defaults-testdefaults).

Two time budgets, in milliseconds (integers from 1 to 2147483647):

- `testTimeout` — the whole test, every run included. Defaults to
  `testDefaults.testTimeout`, then `30000 + 1000 × (runs − 1)` (39000 for
  the default 10 runs; at most 2147483647). A trailing
  `timeout` number sets it the way Jest's `it(name, fn, timeout)` does;
  passing both a trailing number and `testTimeout` is a `usage` error.
- `inferenceTimeout` — each `crucible.coherent()` or `crucible.extract()`
  judge reply attempt.
  Defaults to `testDefaults.inferenceTimeout`, then `30000`.

`strict` (boolean, default `testDefaults.strict`, then `false`) sets how
[`crucible.extract()`](#crucibleextract) treats a hedged reply in this test:
`false` takes the value it leans to, `true` makes any hedge `null`. A call's
own `{ strict }` wins.

`testTimeout` caps everything: an `inferenceTimeout` above it is in effect
bounded by it. Invalid options or timeouts throw a `CrucibleError` of kind
`usage` when the file is collected — out-of-range values are rejected, never
clamped.

The four forms above are TypeScript overloads, so a call that matches none of
them — `crucible.it(name, options)` without a body, two bodies, a timeout
before the body — is a compile error. Editors show each option's meaning and
default (`@default`) on hover and in autocomplete. The types check the
argument shape only: option values (`runs: 0`, `threshold: 2`), unknown keys
in an options variable, and a trailing timeout together with `testTimeout`
still compile and throw a `usage` error at registration. JavaScript callers
get the shape checks at runtime too, as `usage` errors.

The full reference — run statuses, the three-zone verdict, the failure
report, verbosity, the [timeouts](runs-and-threshold.md#timeout) and the
re-entrancy contract — is in
[Runs and threshold](runs-and-threshold.md#crucibleit-reference).

## `crucible.describe()`

```ts
crucible.describe(name, fn);
crucible.describe(name, { runs, threshold, inferenceTimeout, testTimeout, strict }, fn);
```

Registers a Jest `describe` block named `name` and runs `fn` to collect its
tests, so the group shows up in Jest's output like any `describe`. The
options take the same fields as `crucible.it()` options, and every
`crucible.it()` declared inside `fn` inherits them, at any depth — plain Jest
`describe` blocks inside or around the group do not break inheritance:

```ts
crucible.describe('refund policy', { runs: 20, threshold: 0.85 }, () => {
  crucible.it('explains the 30-day window', async () => {
    /* 20 runs, 17 must pass */
  });

  describe('edge cases', () => {
    crucible.it('handles a missing receipt', { threshold: 0.95 }, async () => {
      /* 20 runs, 19 must pass */
    });
  });
});
```

Each field resolves on its own, last wins: the built-in default, then the
config's `testDefaults`, then the outer `crucible.describe`, then the inner
`crucible.describe`, then the test's own options (a trailing timeout number
counts as the test's `testTimeout`). A field a level leaves out comes from
further up, so a group `{ runs: 20 }` keeps the threshold from
`testDefaults`. A `crucible.it()` outside any `crucible.describe` behaves as
if there were none.

The built-in test timeout `30000 + 1000 × (runs − 1)` uses the resolved
`runs`, so a group `{ runs: 20 }` gives its tests 49 s — unless a
`testTimeout` is declared at any level (config, group or test), in which case
the nearest declared one wins and does not grow with `runs`. A group
`testTimeout` with a trailing timeout on a test inside is allowed (the test
wins); a trailing timeout together with `testTimeout` in the same test's
options is still a `usage` error.

`fn` must be synchronous, like Jest's own `describe`. Invalid options (the
same rules as `crucible.it()`), a missing or non-function `fn`, an argument
after `fn`, or an `fn` that returns a value (a promise included) throw a
`CrucibleError` of kind `usage` when the file is collected, which fails the
file. Options are checked before the group is registered; a returned promise
can only be seen after `fn` has run, so tests an async `fn` declared before
its first `await` are already registered by then, and anything after the
`await` runs outside the group. A later rejection of that promise is
absorbed rather than reported as an unhandled rejection. Group settings
never leak into sibling groups or later tests, even when `fn` throws. The two
forms are TypeScript overloads; `crucible.describe(name, options)` without
`fn` is a compile error.

There are no `.only`, `.skip` or `.each` variants of `crucible.describe`.
Jest's own `describe.only`, `describe.skip` and `describe.each` work around
or inside a group: wrap a group in `describe.skip` to skip it, in
`describe.only` to focus it, or in `describe.each` to repeat it per case;
inheritance holds in every case.

## `crucible.coherent()`

```ts
crucible.coherent(actual: string, expectation: string): Promise<boolean>
```

Asks the judge whether `actual` — your system's output — is semantically
consistent with `expectation`, a natural-language claim about it, given the
state the current run has loaded so far. The order is Jest's: actual first.
`actual` is sent to the judge as the `RESPONSE` section and `expectation` as
the `CLAIM` ([what the judge receives](instruction-schema.md#what-the-judge-receives)).
Resolves to the verdict; it does not throw on a `false` verdict. Assert it
with Jest:

```ts
expect(await crucible.coherent(reply, 'The reply declines to share the meeting place')).toBe(true);
```

- **One claim per call.** The judge evaluates one natural-language statement.
  For several properties, make several calls — narrow claims are judged more
  reliably than compound ones.
- **State is read when you call it.** The judgment uses the run's state as it
  stands at the moment `coherent()` is called. A `crucible.append()` made
  after the call — even before the returned promise resolves — is not part of
  that judgment. That lets you start several judgments and await them
  together, each seeing exactly the state that existed at its own step:

  ```ts
  crucible.it('tracks each step against the state so far', { runs: 3 }, async () => {
    const assistant = createAssistant();
    await assistant.remember(['The meeting is at six.']);
    const first = await assistant.ask('When is the meeting?');
    await assistant.remember(['The meeting is in room B12.']);
    const second = await assistant.ask('Where is the meeting?');

    crucible.load('The meeting is at six.');
    const firstVerdict = crucible.coherent(first, 'The reply says the meeting is at six');
    crucible.append('The meeting is in room B12.');
    const secondVerdict = crucible.coherent(second, 'The reply says the meeting is in room B12');

    expect(await Promise.all([firstVerdict, secondVerdict])).toEqual([true, true]);
  });
  ```

  Start the judgments and await them together with no other `await` in
  between, so a rejected judgment is never left unobserved.
  Starting judgments early also saves time against the
  [test deadline](runs-and-threshold.md#timeout): sequential awaits cost one
  judge round trip each.
- **Without state** the claim is judged against the response alone.
- **Errors.** A non-string `actual` or `expectation` throws a `usage` error;
  calling it outside a running `crucible.it()` body throws a `usage` error. A
  missing provider key (`CRUCIBLE_JUDGE_KEY`, or the variable `apiKeyEnv`
  names; optional for `openai-compatible` without `apiKeyEnv`) throws a
  `config` error. Provider failures
  surface as `infra` errors after retries, which make the run *errored* rather
  than *failed* ([classification](runs-and-threshold.md#what-a-run-is-and-how-it-is-classified)).
- **Cost.** Each call is one paid judge request (more if retried).

How the judge decides is defined by the [instruction schema](instruction-schema.md).

## `crucible.extract()`

```ts
crucible.extract(text: string, description: string): Promise<string | null>
crucible.extract(text: string, description: string, { as: 'string' }): Promise<string | null>
crucible.extract(text: string, description: string, { as: 'number' }): Promise<number | null>
crucible.extract(text: string, description: string, { as: 'boolean' }): Promise<boolean | null>
crucible.extract(text: string, description: string, { as: 'number', strict: true }): Promise<number | null> // any hedge is null
```

Asks the judge for the single value `text` commits to for `description`,
typed as `as` asks (default `'string'`), so you can check an exact value in
prose with ordinary Jest matchers:

```ts
crucible.it('counts the apples', async () => {
  const reply = await createAssistant().ask('How many apples are in the basket?');
  expect(await crucible.extract(reply, 'the number of apples in the basket', { as: 'number' })).toBe(2);
});
```

The TypeScript result type follows `as`: `number | null` for `'number'`,
`boolean | null` for `'boolean'`, and `string | null` when `as` is omitted.
(The declaration is one generic signature over the options,
`extract<O extends ExtractOptions | undefined = undefined>(text, description, options?: O)`,
which types the four forms above. When `as` is a widened `ExtractType` or
may be absent, the result widens to every type it could be.)

- **The final committed answer.** When the text revises itself ("At first I
  thought 3, but the answer is two"), the final answer is extracted: `2`.
- **Normalised to the type.** Number words become numbers ("two" → `2`); a
  committed yes or no becomes `true` or `false` for `'boolean'`; a string is
  the value as stated.
- **Lenient by default.** The judge takes the value the text leans to:
  "I think so" and "yeah" are `true`, "nah" is `false`, "probably two" is
  `2`, "likely Paris" is `"Paris"`. `null` means "no value to lean to": no
  answer, a genuine split ("two or three", "maybe Paris, maybe Lyon"), a
  bare negation ("It's not two") or "I don't know". A `boolean` "no" is a
  value (`false`), not a negation.
- **Strict on request.** With `strict: true` any hedge resolves to `null`
  ("Probably two", "I think so", "Probably two, maybe three"); only a firm
  commitment is a value. `strict` (boolean, never coerced) resolves last
  wins: built-in `false`, `testDefaults.strict`, the enclosing
  `crucible.describe` groups, the `crucible.it()` options, then the call's
  own `{ strict }`
  ([precedence](runs-and-threshold.md#group-settings-crucibledescribe)).
  It applies to every assertion that supports it; today that is
  `extract()`. The judge never guesses in either mode.
- **State is context, not a source.** The run's state is sent with the call,
  as for `coherent()`, and is read when you call it. It can resolve what the
  text refers to (state "Room 4 is the blue room", text "I booked the blue
  room" → `4`), but a value that only the state holds, which the text does not
  commit to, is `null`.
- **It does not fail the test.** `extract()` resolves to a value; your Jest
  matcher decides. Always `await` it — a pending Promise is never `2`.
- **Recorded for the report.** Each extraction (description, type, mode,
  value, judge reasoning, response) is recorded for the run, and the report
  names its mode (`Extraction 1 of 2 (lenient): …`). When a run fails, the
  report lists the run's extractions, so a failing `toBe(2)` shows that the
  judge returned `null` and why
  ([failure report](runs-and-threshold.md#reading-the-failure-report)).
- **Errors.** A non-string `text` or `description`, options that are not an
  object, an `as` other than `'string'`, `'number'` or `'boolean'`, or a
  `strict` that is not a boolean, or an option other than `as` and `strict`
  throws a `usage` error; so does calling it outside a running
  `crucible.it()` body.
  A judge reply whose value is not `null` or of the requested type (a number
  must be finite) is asked once more, then becomes a retryable `infra` error —
  the run is *errored*, not *failed*. Provider failures behave as for
  `coherent()`.
- **Cost.** Each call is one paid judge request (more if retried).

How the judge extracts is defined by the
[extract schema](instruction-schema.md#the-extract-schema).

## `crucible.load()` and `crucible.append()`

```ts
crucible.load(state: string | readonly string[]): void
crucible.append(state: string | readonly string[]): void
```

Add state to the current run: one string, or an array of strings added in
order. State is whatever your system's behaviour should respect — any text,
in any format (sentences, JSON text, log lines). The judge treats it as
ground truth.

- **Both functions append.** They behave identically; the two names express
  intent. Use `load` while arranging, before the act, and `append` for facts
  that arise after an act. Calling `load` twice keeps both sets of entries —
  nothing is ever replaced or removed within a run.
- **Per run.** Each run starts with empty state. What one run adds is visible
  only to that run's later `coherent()` and `extract()` calls, even though
  runs execute concurrently.
- **Only inside the body.** Calling either outside a running `crucible.it()`
  body — at module scope, in `beforeEach`, in a plain Jest `it` — throws a
  `usage` error. A non-string entry throws a `usage` error.

```ts
crucible.load(['The user is on the free plan.', 'Free-plan users cannot export reports.']);
const reply = await assistant.ask('Export my report as PDF.');
crucible.append('The assistant declined the PDF export.');
```

## Errors

### `CrucibleError`

Thrown for problems Crucible detects in setup or infrastructure.

| Property | Type | Meaning |
| --- | --- | --- |
| `kind` | `'config' \| 'usage' \| 'infra'` | `config`: the config file or API-key environment. `usage`: an API called incorrectly. `infra`: the judge provider or judge reply failed. |
| `retryable` | `boolean`, only when `kind` is `'infra'` | Whether the infrastructure failure was transient. A non-retryable `infra` error inside a run stops the whole test. |

Branch on `kind`, never on the message text — messages are for humans and may
change.

### `CrucibleVerdictError`

Thrown by a `crucible.it()` test that did not pass. Its `message` is the
[failure report](runs-and-threshold.md#reading-the-failure-report).

| Property | Type | Meaning |
| --- | --- | --- |
| `outcome` | `'failed' \| 'errored'` | `failed`: your system missed the threshold. `errored`: infrastructure (provider failures, a fatal provider error, or the deadline) prevented a verdict. |
| `cause` | `unknown` | The underlying error of a representative run, when there is one. |

## Exported types

| Type | Meaning |
| --- | --- |
| `RunOptions` | `{ runs?: number; threshold?: number; inferenceTimeout?: number; testTimeout?: number; strict?: boolean }` |
| `TestBody` | `() => unknown` — the body passed to `crucible.it()`, usually `async` |
| `ExtractType` | `'string' \| 'number' \| 'boolean'` — the `as` option of `crucible.extract()` |
| `ExtractOptions` | `{ as?: ExtractType; strict?: boolean }` (generic: `ExtractOptions<T extends ExtractType>` narrows `as` to `T`) |
| `ExtractedValue` | `string \| number \| boolean \| null` — any value `crucible.extract()` can resolve to |
| `CrucibleErrorKind` | `'config' \| 'usage' \| 'infra'` |
| `VerdictOutcome` | `'failed' \| 'errored'` |
