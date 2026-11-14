# API reference

Everything is exported from the package root:

```ts
import { crucible, CrucibleError, CrucibleVerdictError } from 'crucible-ai';
import type {
  CoherentOptions,
  CrucibleDescribe,
  CrucibleErrorKind,
  CrucibleIt,
  ExtractedValue,
  ExtractOptions,
  ExtractType,
  GateBody,
  GatedTest,
  RunContext,
  RunOptions,
  TestBody,
  VerdictOutcome,
} from 'crucible-ai';
```

`crucible` is a frozen object with six functions: [`it`](#crucibleit),
[`describe`](#crucibledescribe), [`gate`](#cruciblegate),
[`coherent`](#cruciblecoherent), [`extract`](#crucibleextract)
and [`facts`](#cruciblefacts), plus two deprecated aliases of `facts`,
[`load` and `append`](#crucibleload-and-crucibleappend-deprecated). Each run
of a test body also gets a [run context `t`](#the-run-context-t) with
`facts`, `coherent` and `extract` bound to that run — the recommended style.
`crucible.it` and `crucible.describe` also have the runner's
[variants](#variants-only-skip-todo-each): `only`, `skip`, `todo` and `each`.

On Vitest, import the same names from `crucible-ai/vitest` instead; see
[Vitest](#vitest) for what differs.

## `crucible.it()`

```ts
crucible.it(name, body);
crucible.it(name, body, timeout);
crucible.it(name, { runs, threshold, inferenceTimeout, testTimeout, strict }, body);
crucible.it(name, { runs, threshold }, body, timeout);
```

Registers one Jest test that executes `body` `runs` times concurrently and
passes when at least `threshold` of the runs pass. Each run calls `body` with
its own [run context `t`](#the-run-context-t) (`async (t) => { ... }`); a
body that takes no argument works too. `runs` (integer ≥ 1) and
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

`crucible.describe` has the same [variants](#variants-only-skip-todo-each)
as `crucible.it` (except `todo`), and Jest's own `describe`,
`describe.only`, `describe.skip` and `describe.each` work around or inside a
group; inheritance holds in every case.

## Variants: `only`, `skip`, `todo`, `each`

```ts
crucible.it.only(name, [options,] body, [timeout]);
crucible.it.skip(name, [options,] body, [timeout]);
crucible.it.todo(name);
crucible.it.each(table)(name, [options,] async (t, ...row) => { ... }, [timeout]);
crucible.it.only.each(table)(...);
crucible.it.skip.each(table)(...);

crucible.describe.only(name, [options,] fn);
crucible.describe.skip(name, [options,] fn);
crucible.describe.each(table)(name, [options,] (...row) => { ... });
crucible.describe.only.each(table)(...);
crucible.describe.skip.each(table)(...);
```

Each variant forwards to Jest's own variant of the same name after taking
out the Crucible options: a test variant's body runs through the gate
(`runs`, `threshold`, the run context `t`, the deadline and the report, as
for `crucible.it()`) and Jest gets the computed test timeout; a group
variant's callback collects its tests with the group's options, which they
inherit as for `crucible.describe()`. So focus and skip work exactly as in
Jest: a skipped test never runs its body and costs no judge calls, and
`only` focuses the test or group within the file. Every variant takes the
same argument forms as `crucible.it()` or `crucible.describe()` and throws
the same `usage` errors. `todo` takes a name only and goes to Jest
unchanged.

`each` takes the table (an array of rows, or Jest's tagged template) and
returns a registrar. Jest formats each name (`%s`, `%i`, `$name`, ...) and
passes the row's values: after `t` in a test body, as the arguments of a
group callback. Array rows are spread, a single value or an object arrives
as one argument:

```ts
crucible.it.each([
  ['free', false],
  ['pro', true],
])('answers whether the %s plan can export', { runs: 5, threshold: 0.8 }, async (t, plan, allowed) => {
  const reply = await createAssistant({ plan }).ask('Can I export as PDF?');
  expect(await t.extract(reply, 'whether exporting is allowed', { as: 'boolean' })).toBe(allowed);
});

crucible.describe.each([{ locale: 'en' }, { locale: 'fr' }])('in $locale', { runs: 5 }, ({ locale }) => {
  crucible.it('greets the user', async (t) => {
    /* 5 runs per locale */
  });
});
```

Row types follow the table: `[string, boolean][]` types `plan` and
`allowed`. Each row is its own test with its own runs, threshold and
report.

Two Jest variants of `crucible.it` are not supported; reading them throws a
`usage` error, and they are absent from the types. So does any other
variant of the runner function that Crucible does not wrap, or a variant
above used in the wrong place (`crucible.it.each.only`,
`crucible.describe.todo`). Any other property behaves as on a plain
function: `call`, `apply` and `bind` work, and a property neither Crucible
nor Jest has, such as `then`, is `undefined`, so printing, serialising or
awaiting `crucible.it` is harmless.

- **`failing`** inverts a test's outcome. A pass-rate gate passes when
  enough runs pass, so "expected to fail" is ambiguous: every run failing,
  or too few passing? Assert the expected failure inside the body instead.
- **`concurrent`** runs tests at the same time. The runs of a Crucible test
  already run concurrently under one test deadline; running tests
  concurrently as well would share that time budget and your provider's
  rate limits unpredictably.

## Vitest

`crucible-ai/vitest` exports the same `crucible` object, errors and types as
the root, built on Vitest's `test` and `describe` (imported from `vitest`, so
Vitest's `globals` option is not needed). The root `crucible-ai` entry stays
the Jest one; never mix the two entries in one test file.

```ts
import { expect } from 'vitest';
import { crucible } from 'crucible-ai/vitest';
import type { RunContext } from 'crucible-ai/vitest';
```

Everything on this page applies, with these differences:

- **Variants.** `crucible.it` has `only`, `skip`, `todo`, `each`, `for`,
  `skipIf(condition)` and `runIf(condition)`, plus `only.each`, `only.for`,
  `skip.each` and `skip.for`. `crucible.describe` has the same list, `todo`
  included. `skipIf` and `runIf` return a registrar taking the usual forms:
  `crucible.it.skipIf(isCi)(name, { runs: 5 }, async (t) => { ... })`.
- **`for`.** `crucible.it.for(table)(name, [options,] async (t, row) => { ... },
  [timeout])` registers one test per row and passes the row whole, never
  spread: `crucible.it.for([[2, 'two']])('%s', async (t, [n, word]) => ...)`.
  `crucible.describe.for` passes the row whole to the callback. `each`
  spreads array rows after `t`, as on Jest.
- **No test context.** Vitest passes its test context to a test function;
  `crucible.it` bodies (every variant) receive only `t`, and `for` bodies
  `(t, row)`. Fixtures from `test.extend` are not available to
  `crucible.it`. On Vitest's own `test`, a `crucible.gate()` body receives
  the context after `t`: `test(name, crucible.gate(async (t, context) => { ... }), 60000)`.
- **Timeouts.** The computed test timeout goes to Vitest as the `timeout`
  test option, for every variant. Vitest's default
  test timeout is 5 s, so a plain `test` with `crucible.gate()` needs one
  passed explicitly, as on Jest.
- **Groups.** Vitest runs a `describe` callback later, during collection,
  not when `describe` is called. Group settings still reach every test
  inside, nested `crucible.describe` and plain Vitest `describe` blocks
  included. Callbacks must still be synchronous: an `async` callback is a
  `usage` error on Vitest too, so one test file behaves the same on both
  runners.
- **Not supported.** `crucible.it.fails` and `crucible.it.concurrent` (for
  the reasons given for Jest's `failing` and `concurrent` above), and
  `crucible.describe.concurrent`, `.shuffle` and `.sequential`: Crucible
  assumes a group's tests run one after another in declaration order, each
  under its own deadline with its runs already concurrent; running them
  concurrently or reordering them would share deadlines and provider rate
  limits unpredictably. Reading any of them is a `usage` error. Crucible
  also registers its tests with `concurrent: false` and its groups with
  `concurrent: false, shuffle: false`, so a surrounding plain
  `describe.concurrent` or `describe.shuffle`, or `sequence.concurrent` in
  your Vitest config, never runs Crucible tests concurrently with each other
  or reorders a group. A plain suite that Vitest runs concurrently can still
  run alongside another suite; keep Crucible tests out of those.
- **Unsupported Vitest version.** Group settings follow Vitest's suite
  chain (`TestRunner.getCurrentSuite()`). If a Vitest version stops exposing
  it, a `crucible.describe` callback fails with a `usage` error when Vitest
  collects it, rather than silently running its tests at the defaults.
- **Watch mode.** `vitest` without `run` watches files and re-runs affected
  tests on every save. Each re-run makes judge calls; use `vitest run` (or
  focus with `only`) while you iterate on unrelated code.

## `crucible.gate()`

```ts
it(name, crucible.gate(body), timeout);
it(name, crucible.gate({ runs, threshold, inferenceTimeout, testTimeout, strict }, body), timeout);
it.each(table)(name, crucible.gate(options, async (t, ...row) => { ... }), timeout);
```

Wraps `body` into a test function for your runner's own `it` or `test`, any
variant included (`it.only`, `it.skip`, `it.each`, `test.each`, ...). When
the runner calls it, the gate does everything `crucible.it()` does: it runs
the body `runs` times concurrently, passes when at least `threshold` of the
runs pass, and throws the same [`CrucibleVerdictError`](#crucibleverdicterror)
with the same failure report. Each run calls `body` with its own
[run context `t`](#the-run-context-t), followed by whatever the runner passes
(the row values of `it.each`, for example):

```ts
import { crucible } from 'crucible-ai';

it(
  'declines the PDF export on the free plan',
  crucible.gate({ runs: 5, threshold: 0.8 }, async (t) => {
    const assistant = createAssistant({ plan: 'free' });
    const reply = await assistant.ask('Export my report as PDF.');
    t.facts(assistant.getLogs());
    expect(await t.coherent(reply, 'The reply declines the export')).toBe(true);
  }),
  60_000,
);

it.each([
  ['free', false],
  ['pro', true],
])(
  'answers whether the %s plan can export',
  crucible.gate({ runs: 5, threshold: 0.8 }, async (t, plan: string, allowed: boolean) => {
    const reply = await createAssistant({ plan }).ask('Can I export as PDF?');
    expect(await t.extract(reply, 'whether exporting is allowed', { as: 'boolean' })).toBe(
      allowed,
    );
  }),
  60_000,
);
```

- **Options** resolve exactly as for `crucible.it()`, each field on its own,
  last wins: built-in default, the config's `testDefaults` (read when the
  test runs), the enclosing [`crucible.describe`](#crucibledescribe) groups
  (captured when `crucible.gate()` is called, which happens while the file is
  collected), then the gate's own options. Invalid options, a missing body,
  two bodies or an argument after the body throw a `usage` error when
  `crucible.gate()` is called.
- **Timeouts.** The gate enforces its own `testTimeout` (default
  `30000 + 1000 × (runs − 1)`) and reports an `errored` verdict when it
  passes, as `crucible.it()` does. It cannot set the runner's timeout: pass
  the runner one at least as large (Jest's third argument; Jest's default is
  5 s, far below the gate's 39 s for 10 runs). If the runner's timeout is
  shorter, the runner fails the test first, without Crucible's report. See
  [Timeout](runs-and-threshold.md#timeout).
- **Arity.** The returned function declares no parameters, so Jest never
  treats it as a `done`-callback test; it forwards every argument the runner
  passes to `body`, after `t`.
- **Typing.** Annotate row parameters to type them
  (`async (t, plan: string, allowed: boolean) => ...`); the returned function
  then takes exactly those arguments, which is what `it.each` expects.
  Unannotated rest parameters (`async (t, ...row) => ...`) take the row
  types of the `it.each` table the gate is passed to, else `unknown[]`.
  A gate whose body takes row parameters passed to a plain `it` is a compile
  error.

## The run context `t`

```ts
type RunContext = {
  facts(fact: string | readonly string[]): void;
  coherent(actual: string, expectation: string, options?: CoherentOptions): Promise<boolean>;
  extract(text: string, description: string, options?: ExtractOptions): Promise<ExtractedValue>;
};
```

Every run of a `crucible.it()` or `crucible.gate()` body receives its own
`t` as the first argument. `t.facts()`, `t.coherent()` and `t.extract()`
take the same arguments, validate them the same way and return the same
results as [`crucible.facts()`](#cruciblefacts),
[`crucible.coherent()`](#cruciblecoherent) and
[`crucible.extract()`](#crucibleextract) (including the `as` typing of
`extract`), bound to that run:

- **Visible scope.** `t` makes it obvious which run a fact or judgement
  belongs to. It is the recommended style; the global functions keep
  working.
- **One run state.** Inside a run, `t` and the global functions share the
  same facts and records: facts added through either are seen by both.
- **Works after a lost async context.** `t` holds its run, so it works from
  callbacks that lost Node's async context (some event emitters, custom
  schedulers, native callbacks), where the global functions throw a `usage`
  error.
- **Ends with its run.** Once its run has passed, failed, errored or been
  discarded (the test deadline or a fatal error), any `t` call is a `usage`
  error: `t.facts()` throws, `t.coherent()` and `t.extract()` reject.

## `crucible.coherent()`

```ts
crucible.coherent(actual: string, expectation: string): Promise<boolean>
crucible.coherent(actual: string, expectation: string, { facts }): Promise<boolean>
```

Asks the judge whether `actual` — your system's output — is semantically
consistent with `expectation`, a natural-language claim about it, given the
facts the current run has added so far ([`crucible.facts()`](#cruciblefacts))
and any `facts` passed with this call. The order is Jest's: actual first.
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
- **Facts are read when you call it.** The judgment uses the run's facts as
  they stand at the moment `coherent()` is called. A `crucible.facts()` made
  after the call — even before the returned promise resolves — is not part of
  that judgment. That lets you start several judgments and await them
  together, each seeing exactly the facts that existed at its own step:

  ```ts
  crucible.it('tracks each step against the facts so far', { runs: 3 }, async () => {
    const assistant = createAssistant();
    await assistant.remember(['The meeting is at six.']);
    const first = await assistant.ask('When is the meeting?');
    await assistant.remember(['The meeting is in room B12.']);
    const second = await assistant.ask('Where is the meeting?');

    crucible.facts('The meeting is at six.');
    const firstVerdict = crucible.coherent(first, 'The reply says the meeting is at six');
    crucible.facts('The meeting is in room B12.');
    const secondVerdict = crucible.coherent(second, 'The reply says the meeting is in room B12');

    expect(await Promise.all([firstVerdict, secondVerdict])).toEqual([true, true]);
  });
  ```

  Start the judgments and await them together with no other `await` in
  between, so a rejected judgment is never left unobserved.
  Starting judgments early also saves time against the
  [test deadline](runs-and-threshold.md#timeout): sequential awaits cost one
  judge round trip each.
- **Facts for one call.** `{ facts }` (a string or an array of strings) is
  sent with this call only, after the run's facts. It is not added to the
  run, so later calls do not see it:

  ```ts
  expect(
    await crucible.coherent(reply, 'The reply offers the upgrade', {
      facts: 'The user is on the free plan.',
    }),
  ).toBe(true);
  ```

- **Without facts** the claim is judged against the response alone.
- **Errors.** A non-string `actual` or `expectation`, a third argument that
  is not a plain object, an option other than `facts`, or `facts` that are not a
  string or an array of strings throws a `usage` error;
  calling it outside a running `crucible.it()` or `crucible.gate()` body throws a `usage` error. A
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
crucible.extract(text: string, description: string, { as: 'number', facts }): Promise<number | null> // facts for this call only
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
- **Facts are context, not a source.** The run's facts are sent with the
  call, as for `coherent()`, and are read when you call it; `{ facts }` adds
  facts for this call only, after the run's, without adding them to the run.
  Facts can resolve what the text refers to (fact "Room 4 is the blue room",
  text "I booked the blue room" → `4`), but a value that only the facts hold,
  which the text does not commit to, is `null`.
- **It does not fail the test.** `extract()` resolves to a value; your Jest
  matcher decides. Always `await` it — a pending Promise is never `2`.
- **Recorded for the report.** Each extraction (description, type, mode,
  value, facts, judge reasoning, response) is recorded for the run, and the report
  names its mode (`Extraction 1 of 2 (lenient): …`). When a run fails, the
  report lists the run's extractions, so a failing `toBe(2)` shows that the
  judge returned `null` and why
  ([failure report](runs-and-threshold.md#reading-the-failure-report)).
- **Errors.** A non-string `text` or `description`, options that are not a
  plain object, an `as` other than `'string'`, `'number'` or `'boolean'`, or a
  `strict` that is not a boolean, `facts` that are not a string or an array
  of strings, or an option other than `as`, `strict` and `facts` throws a
  `usage` error; so does calling it outside a running
  `crucible.it()` or `crucible.gate()` body.
  A judge reply whose value is not `null` or of the requested type (a number
  must be finite) is asked once more, then becomes a retryable `infra` error —
  the run is *errored*, not *failed*. Provider failures behave as for
  `coherent()`.
- **Cost.** Each call is one paid judge request (more if retried).

How the judge extracts is defined by the
[extract schema](instruction-schema.md#the-extract-schema).

## `crucible.facts()`

```ts
crucible.facts(fact: string | readonly string[]): void
```

Adds facts to the current run: one string, or an array of strings added in
order. Facts are the ground truth your system worked from — what its
behaviour should respect — in any text format (sentences, JSON text, log
lines). The judge treats them as true for every later `coherent()` and
`extract()` call in the run. On the wire they travel as the payload's `STATE`
section ([what the judge receives](instruction-schema.md#what-the-judge-receives));
"facts" and "state" are the same thing.

- **Scoped to the current run, not global.** `crucible` is a module import,
  but its facts are not shared: each run of each test starts with none and
  keeps its own, even when runs execute concurrently, and other tests never
  see them. Calling `crucible.facts()` outside a running `crucible.it()` or
  `crucible.gate()` body — at module scope, in `beforeEach`, in a plain Jest
  `it` without the gate — throws a `usage` error.
- **Append-only.** Every call adds; nothing is ever replaced or removed
  within a run. Add facts while arranging, and again as new ones arise after
  an act.
- **Read when an assertion is called.** Each `coherent()` or `extract()`
  uses the facts added before it was called.
- **Copied.** Changing your array after the call does not change the facts.
- **Errors.** Anything other than a string or an array of strings throws a
  `usage` error.

Facts often come straight from your system under test (here `getLogs()`
returns a `string[]`):

```ts
const assistant = createAssistant({ plan: 'free' });
const reply = await assistant.ask('Export my report as PDF.');
crucible.facts(assistant.getLogs());
expect(await crucible.coherent(reply, 'The reply declines the export')).toBe(true);
```

For facts that matter to a single assertion, pass `{ facts }` to
[`coherent()`](#cruciblecoherent) or [`extract()`](#crucibleextract)
instead: they are sent after the run's facts, with that call only.

The failure report lists, under each judged call, the facts it used (run
facts, then that call's own) as `Facts:`
([failure report](runs-and-threshold.md#reading-the-failure-report)).

## `crucible.load()` and `crucible.append()` (deprecated)

```ts
crucible.load(state: string | readonly string[]): void
crucible.append(state: string | readonly string[]): void
```

Deprecated aliases of [`crucible.facts()`](#cruciblefacts), with identical
behaviour. They are planned for removal in 1.0; replace either with
`crucible.facts()`.

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

Thrown by a `crucible.it()` or `crucible.gate()` test that did not pass. Its `message` is the
[failure report](runs-and-threshold.md#reading-the-failure-report).

| Property | Type | Meaning |
| --- | --- | --- |
| `outcome` | `'failed' \| 'errored'` | `failed`: your system missed the threshold. `errored`: infrastructure (provider failures, a fatal provider error, or the deadline) prevented a verdict. |
| `cause` | `unknown` | The underlying error of a representative run, when there is one. |

## Exported types

| Type | Meaning |
| --- | --- |
| `RunOptions` | `{ runs?: number; threshold?: number; inferenceTimeout?: number; testTimeout?: number; strict?: boolean }` |
| `TestBody` | `(t: RunContext) => unknown` — the body passed to `crucible.it()`, usually `async`; a body without parameters fits too |
| `RunContext` | `{ facts, coherent, extract }` — the [run context `t`](#the-run-context-t) each run receives |
| `GateBody<A>` | `(t: RunContext, ...args: A) => unknown` — the body passed to `crucible.gate()` |
| `GatedTest<A>` | `(...args: A) => Promise<void>` — what `crucible.gate()` returns, for the runner's `it` |
| `CrucibleIt` | the type of `crucible.it`: its four forms and its `only`, `skip`, `todo`, `each` variants (from `crucible-ai/vitest`: also `for`, `skipIf`, `runIf`) |
| `CrucibleDescribe` | the type of `crucible.describe`: its two forms and its `only`, `skip`, `each` variants (from `crucible-ai/vitest`: also `todo`, `for`, `skipIf`, `runIf`) |
| `ExtractType` | `'string' \| 'number' \| 'boolean'` — the `as` option of `crucible.extract()` |
| `CoherentOptions` | `{ facts?: string \| readonly string[] }` — the third argument of `crucible.coherent()` |
| `ExtractOptions` | `{ as?: ExtractType; strict?: boolean; facts?: string \| readonly string[] }` (generic: `ExtractOptions<T extends ExtractType>` narrows `as` to `T`) |
| `ExtractedValue` | `string \| number \| boolean \| null` — any value `crucible.extract()` can resolve to |
| `CrucibleErrorKind` | `'config' \| 'usage' \| 'infra'` |
| `VerdictOutcome` | `'failed' \| 'errored'` |
