# API reference

Everything is exported from the package root:

```ts
import { crucible, CrucibleError, CrucibleVerdictError } from 'crucible-ai';
import type { CrucibleErrorKind, RunOptions, TestBody, VerdictOutcome } from 'crucible-ai';
```

`crucible` is a frozen object with four functions: [`it`](#crucibleit),
[`coherent`](#cruciblecoherent), [`load`](#crucibleload-and-crucibleappend)
and [`append`](#crucibleload-and-crucibleappend). There are no `crucible.it.only`,
`.skip` or `.each` variants; to skip inference tests, wrap them in Jest's
`describe.skip`.

## `crucible.it()`

```ts
crucible.it(name, body);
crucible.it(name, body, timeout);
crucible.it(name, { runs, threshold, inferenceTimeout, testTimeout }, body);
crucible.it(name, { runs, threshold }, body, timeout);
```

Registers one Jest test that executes `body` `runs` times concurrently and
passes when at least `threshold` of the runs pass. `runs` (integer ≥ 1) and
`threshold` (number in (0, 1]) default to the config's `testDefaults`, then to
`1` and `1.0`.

Two time budgets, in milliseconds (integers from 1 to 2147483647):

- `testTimeout` — the whole test, every run included. Defaults to
  `testDefaults.testTimeout`, then `30000 + 1000 × (runs − 1)` (at most 2147483647). A trailing
  `timeout` number sets it the way Jest's `it(name, fn, timeout)` does;
  passing both a trailing number and `testTimeout` is a `usage` error.
- `inferenceTimeout` — each `crucible.coherent()` judge reply attempt.
  Defaults to `testDefaults.inferenceTimeout`, then `30000`.

`testTimeout` caps everything: an `inferenceTimeout` above it is in effect
bounded by it. Invalid options or timeouts throw a `CrucibleError` of kind
`usage` when the file is collected — out-of-range values are rejected, never
clamped.

The TypeScript signature is a single permissive one,
`it(name: string, optsOrBody: RunOptions | TestBody, bodyOrTimeout?: TestBody | number, timeout?: number): void`,
so `crucible.it(name, options)` without a body type-checks; it throws a
`usage` error at registration.

The full reference — run statuses, the three-zone verdict, the failure
report, verbosity, the [timeouts](runs-and-threshold.md#timeout) and the
re-entrancy contract — is in
[Runs and threshold](runs-and-threshold.md#crucibleit-reference).

## `crucible.coherent()`

```ts
crucible.coherent(response: string, claim: string): Promise<boolean>
```

Asks the judge whether `response` is semantically consistent with `claim`,
given the state the current run has loaded so far. Resolves to the verdict;
it does not throw on a `false` verdict. Assert it with Jest:

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
- **Errors.** A non-string `response` or `claim` throws a `usage` error;
  calling it outside a running `crucible.it()` body throws a `usage` error. A
  missing `OPENROUTER_API_KEY` throws a `config` error. Provider failures
  surface as `infra` errors after retries, which make the run *errored* rather
  than *failed* ([classification](runs-and-threshold.md#what-a-run-is-and-how-it-is-classified)).
- **Cost.** Each call is one paid judge request (more if retried).

How the judge decides is defined by the [instruction schema](instruction-schema.md).

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
  only to that run's later `coherent()` calls, even though runs execute
  concurrently.
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
| `RunOptions` | `{ runs?: number; threshold?: number; inferenceTimeout?: number; testTimeout?: number }` |
| `TestBody` | `() => unknown` — the body passed to `crucible.it()`, usually `async` |
| `CrucibleErrorKind` | `'config' \| 'usage' \| 'infra'` |
| `VerdictOutcome` | `'failed' \| 'errored'` |
