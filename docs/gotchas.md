# Gotchas

The mistakes that cost the most time, and what Crucible does (and does not)
protect you from.

**Assertions**

- [A verdict nobody asserts never fails a test](#a-verdict-nobody-asserts-never-fails-a-test)
- [Assert true claims, not false ones](#assert-true-claims-not-false-ones)
- [The judge can say false when the answer is true](#the-judge-can-say-false-when-the-answer-is-true)
- [`extract()` returns `null` when there is no single committed value](#extract-returns-null-when-there-is-no-single-committed-value)
- [`extract()` is async: always `await` it](#extract-is-async-always-await-it)

**Runs and state**

- [Bodies must be re-entrant](#bodies-must-be-re-entrant)
- [`beforeEach` arranges once per test, not once per run](#beforeeach-arranges-once-per-test-not-once-per-run)
- [`load` never replaces](#load-never-replaces)
- [Keep state consistent](#keep-state-consistent)

**Time**

- [Every test has a deadline; Jest's global `testTimeout` does not change it](#every-test-has-a-deadline-jests-global-testtimeout-does-not-change-it)
- [Fake timers stop Crucible's clock](#fake-timers-stop-crucibles-clock)

**Secrets, data and spend**

- [Never put an API key in `meta`](#never-put-an-api-key-in-meta)
- [A key over plain `http` travels unencrypted](#a-key-over-plain-http-travels-unencrypted)
- [Reports print your errors and responses as they are](#reports-print-your-errors-and-responses-as-they-are)
- [Everything you judge leaves your machine](#everything-you-judge-leaves-your-machine)
- [Runs spend in parallel](#runs-spend-in-parallel)

**Environment**

- [Jest must inject its globals](#jest-must-inject-its-globals)
- [The config is read from the working directory](#the-config-is-read-from-the-working-directory)
- [Behind a TLS-intercepting proxy, judge calls error](#behind-a-tls-intercepting-proxy-judge-calls-error)

---

## A verdict nobody asserts never fails a test

`crucible.coherent()` only *returns* a verdict. Crucible does not track
verdicts or fail a test because one was `false` — just like any other async
function, the result means nothing until you assert it. All of these pass or
fail for the wrong reason:

```ts
crucible.coherent(reply, 'The reply stays polite');                    // not awaited, not asserted: never fails
await crucible.coherent(reply, 'The reply stays polite');              // awaited, not asserted: never fails
expect(crucible.coherent(reply, 'The reply stays polite')).toBe(true); // a Promise is never true: always fails
expect(crucible.coherent(reply, 'The reply stays polite')).resolves.toBe(true); // not awaited: never checked
```

Write one of these:

```ts
expect(await crucible.coherent(reply, 'The reply stays polite')).toBe(true);
await expect(crucible.coherent(reply, 'The reply stays polite')).resolves.toBe(true);
```

An unasserted call still costs a judge request.

## Assert true claims, not false ones

Write each claim as something that should hold, and assert `toBe(true)`.
To check that something must not happen, put the negation in the claim:

```ts
expect(await crucible.coherent(reply, 'The reply does not reveal the meeting place')).toBe(true);
```

rather than `expect(await crucible.coherent(reply, 'The reply reveals the meeting place')).toBe(false)`.

The failure report shows, for each failed run, the *first `false` verdict* in
that run. If a body expects some verdicts to be `false`, that expected
`false` is what the report shows, even when the run actually failed on a
different assertion — and you have to rerun with `CRUCIBLE_VERBOSE=full` to
find the real one.

## The judge can say false when the answer is true

The judge is a model and can be wrong. Crucible accepts this: judge
false-negatives — a `false` verdict for a response that was actually fine —
are a known limitation, not a bug that a retry hides. The mitigations are
structural:

- **Narrow, single-claim assertions.** The judge's task is deliberately
  small — one claim against one response plus state — which capable models do
  reliably. One fact per claim; split compound claims into several calls.
- **Gates with headroom.** A threshold below your measured reliability
  absorbs occasional judge errors along with your system's own variance
  ([headroom](runs-and-threshold.md#headroom-patterns)).
- **Reasoning in every failure.** Read the *Judge reasoning* before treating
  a red run as a regression. If the reasoning is wrong, the claim may be
  ambiguous (rule 6 of the schema: ambiguity is `false`), the model too weak,
  or the [schema](instruction-schema.md#changing-the-judges-behaviour) in
  need of a rule.
- **A capable judge.** See [choosing a judge model](configuration.md#choosing-a-judge-model).

Judge *infrastructure* failures (timeouts, rate limits, provider errors) are
different: they are never counted as `false`. The run is reported as errored.

## `extract()` returns `null` when there is no single committed value

`null` from `crucible.extract()` is an answer, not an error: the judge found no
single value the text commits to. That is the case when the text

- hedges, even about one value: "Probably two", "I think two", "around two";
- offers alternatives: "Probably two, maybe three", "two or three";
- only says what the value is not: "It's not two";
- never answers: "I haven't counted yet".

The judge does not pick the likeliest value or fall back on the state: a value
only the state holds is `null` too. So `expect(...).toBe(2)` fails on a hedged
reply, which is usually what you want — and the failure report lists the
extraction with the judge's reasoning, so you can see it was a hedge, not a
wrong number. If a hedged answer is acceptable, say so in the assertion
(`expect([2, null]).toContain(value)`) rather than in the description.

Two cases are not `null`: a revised answer extracts the *final* value ("I
thought 3, but it's two" → `2`), and for `{ as: 'boolean' }` a committed
"no" is `false`.

A judge reply that is not `null` or the requested type (for example `"2"` for
`'number'`) is never coerced: it is asked once more and then errors the run as
`infra`.

## `extract()` is async: always `await` it

`crucible.extract()` returns a Promise, like `coherent()`:

```ts
expect(crucible.extract(reply, 'the number of apples', { as: 'number' })).toBe(2);       // a Promise is never 2: always fails
expect(await crucible.extract(reply, 'the number of apples', { as: 'number' })).toBe(2); // right
```

Several extractions from one reply can run together with `Promise.all`; each
one is a paid judge call.

## Bodies must be re-entrant

All runs of a test execute **at the same time** — and a test with no options
has 10 runs. Anything the body shares with other runs is shared by all of
them concurrently:

```ts
const assistant = createAssistant(); // module scope: shared by every run of every test

crucible.it('…', { runs: 20, threshold: 0.85 }, async () => {
  await assistant.remember(['…']); // 20 runs mutate the same instance at once
});
```

Create a fresh system under test inside the body, every time. The same goes
for files, databases, ports and anything else your system writes to. See the
[re-entrancy contract](runs-and-threshold.md#re-entrancy-contract).

## `beforeEach` arranges once per test, not once per run

Jest runs `beforeEach` once before the whole `crucible.it()` test — not once
per run. So:

- a system under test created in `beforeEach` is **shared by all runs** (see
  above);
- `crucible.load()` or `crucible.append()` in `beforeEach` (or `beforeAll`,
  or at module scope) **throws a `usage` error**, because state belongs to a
  run and no run exists yet.

Put the whole arrange step in the body. To share setup code, call a helper
function from inside the body.

## `load` never replaces

`crucible.load()` and `crucible.append()` both add to the run's state; neither
removes anything. Calling `load` twice keeps both sets of entries. Use `load`
for the arrange step and `append` after an act — the names state your intent,
the behaviour is the same. See [`load` and `append`](api.md#crucibleload-and-crucibleappend).

## Keep state consistent

The schema treats state as ground truth but has no rule for entries that
contradict each other — for example an appended "the booking was cancelled"
after a loaded "the booking is confirmed". Judges handle such conflicts
inconsistently (sometimes keeping the older fact). Until the schema defines
an ordering rule, add facts that build on each other rather than overturning
earlier ones, or phrase the change so it does not contradict ("the booking
that was confirmed has since been cancelled").

## Every test has a deadline; Jest's global `testTimeout` does not change it

By default a `crucible.it()` test must finish within 30 s plus 1 s per extra
run (39 s for the default 10 runs) — your arrange and act steps included, all
runs concurrently — and each judge reply attempt
within 30 s. When the test runs out of time, in-flight runs are discarded and
the test fails as *errored*. Jest's global `testTimeout` setting does not
change these budgets. Raise them per test — a trailing number
(`crucible.it(name, body, 90000)`) or the `testTimeout` and
`inferenceTimeout` options — or project-wide in `testDefaults`.
`testTimeout` caps everything: an `inferenceTimeout` larger than it is in
effect bounded by it.

What eats the budget is usually judge calls awaited one after another. With a
reasoning model at default effort a call can take ~11 s, so three sequential
`coherent()` calls in one body can run out of time. Use low reasoning effort
([recommended config](configuration.md#choosing-a-judge-model)), and start
independent judgments together and await them at once
([pattern](api.md#cruciblecoherent)). Each judge reply attempt also has its
own limit (`inferenceTimeout`, 30 s by default). Details:
[Timeout](runs-and-threshold.md#timeout).

## Fake timers stop Crucible's clock

Crucible's test deadline and the backoff between provider retries are
scheduled with the global `setTimeout`. With `jest.useFakeTimers()` (or
`fakeTimers: { enableGlobally: true }`) active in a test file, those timers
are faked too and do not advance on their own:

- the deadline never fires, so a hung body is not stopped by Crucible. If you
  passed a test timeout to `crucible.it()` (trailing number or `testTimeout`),
  Jest's own timeout fails the test 5 s after it (capped at 2147483647 ms), without a Crucible report;
  otherwise Jest's fallback timeout is about 24.8 days, so the suite hangs;
- a judge call that needs a retry waits in its backoff until the fake clock
  is advanced.

Keep fake timers out of files that declare `crucible.it()` tests (call
`jest.useRealTimers()` at the top of such a file if fake timers are enabled
globally), or switch to fake timers only inside a plain Jest test.

## Never put an API key in `meta`

The config file rejects top-level fields named like secrets (`apiKey`,
`token`, …) so the file stays safe to commit. `meta` is passed to the
provider unmodified and is **never inspected** — a key placed inside it is
committed with the file and sent in every request body. Keys belong only in
the environment — `CRUCIBLE_JUDGE_KEY`, or the variable `apiKeyEnv` names.
`apiKeyEnv` itself takes a variable *name*: a value with punctuation, like
`sk-…`, is rejected, but a key made only of letters, digits and underscores
passes as a name, so check what you put there. See
[`meta`](configuration.md#meta).

## A key over plain `http` travels unencrypted

An `openai-compatible` `baseUrl` may be `http://`. If it points anywhere but
this machine (`localhost`, `127.x.x.x`, `[::1]`) and a key is set, the key
crosses the network in clear text. Crucible makes the call anyway and prints
one warning per test file to stderr (it names the variable and URL, never
the key). Use `https`, or — without `apiKeyEnv` — leave `CRUCIBLE_JUDGE_KEY`
unset for a server that needs no key. See [`openai-compatible`](configuration.md#openai-compatible).

## Reports print your errors and responses as they are

Failure reports and the `full`/`debug` output include, verbatim (bounded in
length): the error your test body threw (`Thrown:`), the infrastructure
cause of errored runs (`Cause:`), the response excerpt, your claims and
extraction descriptions and, at
`debug`, the assembled state. In CI that output lands in build logs.

Crucible never prints your API key or `meta` values, and its bundled
provider adapter never puts the key in an error message. But if your own
system under test throws errors, or produces responses, that contain secrets
or personal data, they are printed. Keep secrets out of test fixtures and
error messages.

## Everything you judge leaves your machine

Each `coherent()` call sends the run's state, the response and the claim to
your judge provider (each `extract()` call the state, the text and the
description). OpenRouter and gateways such as LiteLLM forward them to the
model provider serving your chosen model. Treat everything you `load`,
`append` and judge as data shared with those services: use synthetic
fixtures, not production data, and check the provider's data policy
(OpenRouter's provider routing settings can restrict where requests go,
through `meta`). Only a local server such as Ollama keeps it on your machine.

## Runs spend in parallel

All runs start together, so a `runs: 50` test can have 50 judge calls in
flight — check your provider's rate limits and credit. A local model server
may process them one at a time, so large gates can hit the inference timeout. Every run executes in
full even after enough runs have passed. When a test stops early (a fatal
provider error or the deadline), Crucible cancels its own in-flight judge
calls, but calls your system under test makes in discarded runs keep running
— and spending — until they finish. See [Cost](runs-and-threshold.md#cost).

## Jest must inject its globals

`crucible.it()` registers its test through Jest's global `it`. With
`injectGlobals: false` in your Jest config there is no global `it`, and
`crucible.it()` throws a `usage` error while the file is collected. This
setting is not supported in v1; keep the default (`true`) for test files that
use Crucible. Importing `expect` from `@jest/globals` is fine.

## The config is read from the working directory

Crucible looks for `crucible.config.json` or `crucible.config.jsonc` (exactly
one of them) in the directory the Jest process runs in — not next to the test
file, not in a parent directory. If tests fail
with a `config` error saying the file cannot be found, check where Jest was
started (monorepo workspace scripts often start it in a package directory).
See [Where and when the file is read](configuration.md#where-and-when-the-file-is-read).

## Behind a TLS-intercepting proxy, judge calls error

Corporate proxies that re-sign TLS traffic make Node's built-in `fetch` reject
your provider's certificate (`SELF_SIGNED_CERT_IN_CHAIN`). Crucible retries,
then reports every run as *errored*. Tell Node to trust the operating
system's certificates:

```sh
NODE_OPTIONS=--use-system-ca npx jest
```

`--use-system-ca` needs Node 22.15 or newer (or 23.8+). On older versions,
point `NODE_EXTRA_CA_CERTS` at your proxy's CA certificate instead. Never
disable certificate verification.
