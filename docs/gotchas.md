# Gotchas

The mistakes that cost the most time, and what Crucible does (and does not)
protect you from.

**Assertions**

- [A verdict nobody asserts never fails a test](#a-verdict-nobody-asserts-never-fails-a-test)
- [Assert true claims, not false ones](#assert-true-claims-not-false-ones)
- [The judge can say false when the answer is true](#the-judge-can-say-false-when-the-answer-is-true)
- [`extract()` returns `null` when there is no value to take](#extract-returns-null-when-there-is-no-value-to-take)
- [`extract()` is async: always `await` it](#extract-is-async-always-await-it)

**Runs and facts**

- [Bodies must be re-entrant](#bodies-must-be-re-entrant)
- [`beforeEach` arranges once per test, not once per run](#beforeeach-arranges-once-per-test-not-once-per-run)
- [Facts are per run, never global](#facts-are-per-run-never-global)
- [`facts` never replaces](#facts-never-replaces)
- [Keep facts consistent](#keep-facts-consistent)

**Time**

- [Every test has a deadline; Jest's global `testTimeout` does not change it](#every-test-has-a-deadline-jests-global-testtimeout-does-not-change-it)
- [Fake timers stop Crucible's clock](#fake-timers-stop-crucibles-clock)
- [Vitest watch mode re-runs, and re-spends, on every save](#vitest-watch-mode-re-runs-and-re-spends-on-every-save)

**Secrets, data and spend**

- [Never put an API key in `meta`](#never-put-an-api-key-in-meta)
- [A key over plain `http` travels unencrypted](#a-key-over-plain-http-travels-unencrypted)
- [Reports print your errors and responses as they are](#reports-print-your-errors-and-responses-as-they-are)
- [Everything you judge leaves your machine](#everything-you-judge-leaves-your-machine)
- [Runs spend in parallel](#runs-spend-in-parallel)

**Environment**

- [Jest must inject its globals](#jest-must-inject-its-globals)
- [On Vitest, import from `crucible/vitest`](#on-vitest-import-from-cruciblevitest)
- [On Vitest, bodies do not get the test context](#on-vitest-bodies-do-not-get-the-test-context)
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

## `extract()` returns `null` when there is no value to take

`null` from `crucible.extract()` is an answer, not an error: the judge found no
value the text commits to. By default extraction is **lenient**: a mildly
hedged or colloquial answer counts as the value it leans to ("probably two" →
`2`, "around two" → `2`, "I think so" → `true`, "I don't think so" →
`false`). It is still `null` when the text

- splits between values with no lean: "two or three", "maybe Paris, maybe
  Lyon";
- only says what the value is not: "It's not two";
- says it cannot answer: "I don't know";
- never answers: "I haven't counted yet".

With `strict: true` (on the call, the test, a `crucible.describe` group or
`testDefaults`), any hedge is `null` too: "Probably two", "I think two",
"around two", "I think so". Use it where a firm commitment is the point, or
where an estimate must not pass for an exact value.

The judge never invents a lean the text does not show or falls back on the
state: a value only the state holds is `null` too. So `expect(...).toBe(2)` fails on a split
reply (or, strict, a hedged one), which is usually what you want — and the
failure report lists the extraction, its mode and the judge's reasoning, so
you can see it was a split or a hedge, not a wrong number. If a `null` is acceptable, say
so in the assertion (`expect([2, null]).toContain(value)`) rather than in the
description.

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
- `crucible.facts()` in `beforeEach` (or `beforeAll`, or at module scope)
  **throws a `usage` error**, because facts belong to a run and no run exists
  yet.

Put the whole arrange step in the body. To share setup code, call a helper
function from inside the body.

## Facts are per run, never global

`crucible` is a module import, but `crucible.facts()` does not set anything
module-wide: the facts belong to the run that is executing when you call it,
found through Node's async context. Concurrent runs and other tests never
share them. Code that loses that async context — for example a timer or
event listener set up in `beforeAll` that fires later, outside any run — gets
a `usage` error, not shared facts. Call `crucible.facts()` from
code the running body awaits, or use the run context `t` the body receives:
`t.facts()`, `t.coherent()` and `t.extract()` hold their run, so they work
from such callbacks until that run ends (afterwards they are a `usage`
error). See [the run context `t`](api.md#the-run-context-t).

## `facts` never replaces

`crucible.facts()` only adds to the run's facts; calling it twice keeps both
sets of entries. Add facts while arranging and again after an act. Facts
passed to a single call (`{ facts }` on `coherent()` or `extract()`) are
never added to the run. See [`crucible.facts()`](api.md#cruciblefacts).

## Keep facts consistent

The schema treats facts (the `STATE` section) as ground truth but has no rule for entries that
contradict each other — for example a later "the booking was cancelled"
after an earlier "the booking is confirmed". Judges handle such conflicts
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

## With `crucible.gate()`, the runner's timeout must cover the gate's

`crucible.gate()` enforces its own test deadline (39 s for the default 10
runs) but cannot change the runner's timeout, and Jest's default is 5 s. A
gated test without a runner timeout is cut off by Jest after 5 s, with
Jest's timeout message instead of Crucible's report. Pass the runner a
timeout at least as large as the gate's `testTimeout` — Jest's third
argument: `it(name, crucible.gate(options, body), 60000)` — or raise Jest's
`testTimeout` for those files. `crucible.it()` sets Jest's timeout for you.
See [Gate timeouts](runs-and-threshold.md#gate-timeouts).

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

## Vitest watch mode re-runs, and re-spends, on every save

`vitest` without `run` starts in watch mode and re-runs the affected test
files whenever you save. Every re-run of a Crucible test makes its judge
calls again (10 per assertion with the built-in defaults). Use
`vitest run` for Crucible suites, or keep them out of the watched set (a
separate Vitest project or `--exclude`) while you work on other code.

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
extraction descriptions, the facts each judged call used (`Facts:`) and, at
`debug`, the assembled payload. In CI that output lands in build logs.

Crucible never prints your API key or `meta` values, and its bundled
provider adapter never puts the key in an error message. But if your own
system under test throws errors, or produces responses, that contain secrets
or personal data, they are printed. Keep secrets out of test fixtures and
error messages.

## Everything you judge leaves your machine

Each `coherent()` call sends the facts, the response and the claim to
your judge provider (each `extract()` call the facts, the text and the
description). OpenRouter and gateways such as LiteLLM forward them to the
model provider serving your chosen model. Treat every fact you pass and everything you judge as data shared with those services: use synthetic
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

## On Vitest, import from `crucible/vitest`

The root `crucible` entry registers tests through Jest's global `it`.
Under Vitest (whose globals are off by default) that is a `usage` error, and
with `globals: true` it would register through Vitest's global without the
Vitest-specific handling. Import `crucible` from `crucible/vitest` in
every Vitest test file, and never mix the two entries: each has its own
group settings, so a `crucible.describe` from one does not reach a
`crucible.it` from the other. The same holds when a project loads both the
ESM and the CommonJS build of one entry.

`crucible/vitest` ships a CommonJS build and `.d.cts` types so
TypeScript projects in CommonJS mode type-check, but like Vitest itself it
only loads through `import`: Vitest's test files always do, while a plain
`require('crucible/vitest')` throws Vitest's own "cannot be imported in a
CommonJS module" error.

## On Vitest, bodies do not get the test context

Vitest passes its test context (`expect`, `task`, `skip`, fixtures) as the
first argument of a test function. `crucible.it` bodies receive the run
context `t` instead, and nothing else (`crucible.it.for` bodies get
`(t, row)`), so fixtures from `test.extend` do not reach them; import
`expect` from `vitest`. On Vitest's own `test` with `crucible.gate()`, the
body receives the context after `t`: `async (t, context) => { ... }`.

## The config is read from the working directory

Crucible looks for `crucible.config.json` or `crucible.config.jsonc` (exactly
one of them) in the directory the Jest or Vitest process runs in — not next to the test
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
