# Porting Crucible

The checklist for a new port of Crucible (C# first, then Python and Java).
It says what a port must provide, which parts the shared fixtures prove,
what each port proves itself, and the order to build it in. You should not
need to read the TypeScript source: where a rule matters, this guide or
[`README.md`](README.md) states it. Where they differ, `README.md` (the
fixture contracts) wins, then [`docs/api.md`](../docs/api.md).

A port is done when:

- [ ] its fixture runner passes every case under `spec/` (or skips a case by
      id, with a reason, only where the language cannot express the input);
- [ ] every item of [`surface.json`](surface.json) exists in its public API
      (the deprecated aliases `crucible.load` and `crucible.append` may be
      left out), and nothing public is missing from it
      ([§1](#1-the-public-api));
- [ ] its own tests cover what fixtures cannot
      ([§3](#3-what-the-fixtures-cover-and-what-a-port-tests-itself));
- [ ] it embeds the shared assets unchanged and declares the spec version it
      implements ([§4](#4-shared-assets-and-versioning));
- [ ] one live smoke test passes against a real judge.

## Contents

1. [The public API](#1-the-public-api)
2. [Engine and runner adapter](#2-engine-and-runner-adapter)
3. [What the fixtures cover, and what a port tests itself](#3-what-the-fixtures-cover-and-what-a-port-tests-itself)
4. [Shared assets and versioning](#4-shared-assets-and-versioning)
5. [Language notes](#5-language-notes)
6. [The first week](#6-the-first-week)

## 1. The public API

[`surface.json`](surface.json) is the machine-readable list of everything
below, each item with the fixture cases that pin it. Use idiomatic names
(`Runs` in C#, `runs` in Python) for functions and options, but keep every
value that crosses a boundary exactly as written here: config field names,
provider names, environment variable names, error kinds, verbosity levels,
extract types and modes, and all report and payload text.

### Functions

A port exposes one entry object (`crucible` in TypeScript) and a per-run
context `t`:

| Function | What it does | Pinned by | The port tests itself |
| --- | --- | --- | --- |
| `it(name, [options,] body, [timeout])` | Registers one runner test. Its body runs `runs` times concurrently; the test passes when at least `need` runs pass, else throws the verdict error whose message is the report. | `run-options/*`, `verdict/compute`, `report/render`, `report/trace` | argument forms, registration, runner timeout, variants, the engine ([§2](#2-engine-and-runner-adapter)) |
| `describe(name, [options,] callback)` | Registers a runner group whose options every `it` inside inherits, one field at a time, at any depth. | `run-options/validate` (`group`), `run-options/resolve` (`groups`) | inheritance through nested and plain runner groups, no leak to siblings, synchronous callback |
| `gate([options,] body)` | Returns a test function for the runner's own `it`/`test`, with the same runs, verdict and report as `it`. The runner's own arguments (table rows) follow `t`. Invalid options, a missing body or two bodies throw `usage` when `gate` is called. The returned function declares no parameters (Jest would otherwise treat it as a `done`-callback test). | as `it` | forwarding, groups captured when `gate` is called, validation at the call |
| `coherent(actual, expectation, [{ facts }])` | Asks the judge whether `actual` is consistent with the claim `expectation`, given the run's facts. Resolves to the verdict; never throws on `false`. | `assertion/call`, `payload/coherent`, `judge/reply`, `provider/*` | only inside a running body; inference timeout; recorded for the report |
| `extract(text, description, [{ as, strict, facts }])` | Asks the judge for the one value `text` commits to, typed as `as` asks, or null. | `assertion/call`, `payload/extract`, `judge/reply`, `provider/*` | as `coherent` |
| `facts(fact or facts)` | Adds facts to the current run; every later judge call of the run sends them. | `assertion/call`, `payload/*` (`STATE`) | per-run isolation between concurrent runs, copied, append-only, usage error outside a run |
| `load`, `append` | Deprecated aliases of `facts`. A new port may omit them; TypeScript removes them in 1.0. | as `facts` | |
| `t.facts`, `t.coherent`, `t.extract` | The same three, bound to one run; they share the run's state with the global functions. They work where the per-run context is lost. Once their run has ended they are a `usage` error: `t.facts` throws, `t.coherent` and `t.extract` reject. | as above | lost context, use after the run ended |

Rules that hold across the table:

- **When validation runs.** Options of `it` and `describe` are validated
  when the test file is collected (declaration), options of `gate` when
  `gate` is called; `testDefaults` when the config is loaded, at run time.
- **Facts are read when an assertion is called**, not when its result
  arrives: a `facts` call made after `coherent` started does not reach that
  call.
- **`extract`'s result type follows `as`**: string, number or boolean, or
  null. A reply that is still unusable after the re-ask (not null and not of
  the requested type, or a non-finite number) is an `infra` error,
  `retryable: true`, so the run is errored.
- **A missing judge key** is a `config` error, thrown from `coherent` or
  `extract` (the first judge call), not at registration.
- `testTimeout` caps everything: an `inferenceTimeout` above it is in effect
  the test deadline.
- A group may declare `testTimeout` and a test inside it a trailing timeout:
  the test wins. Only both on the same test is `usage`.
- The TypeScript entry object is frozen. Its exported types (`RunOptions`,
  `CoherentOptions`, `ExtractOptions`, `ExtractType`, `ExtractedValue`,
  `VerdictOutcome`, `TestBody`, `GateBody`, `GatedTest`, `CrucibleIt`,
  `CrucibleDescribe`) have idiomatic equivalents in a port, not exact
  copies. Jest- and Vitest-only details (variant placement, `for` rows,
  Vitest's test context, how `crucible.it` behaves as a plain function) are
  in [`docs/api.md`](../docs/api.md); a port maps its own runner's
  equivalents.

### Run options

Written on a test (`it`, `gate`), on a group (`describe`) and in the config
file's `testDefaults`. Each field resolves on its own, nearest wins:
built-in → `testDefaults` → outer group → … → inner group → test → call
(`strict` only). Contract: [`run-options/resolve`](README.md#run-options--resolve),
[`run-options/validate`](README.md#run-options--validate).

| Option | Default | Valid | Invalid in a test or group | Invalid in `testDefaults` |
| --- | --- | --- | --- | --- |
| `runs` | 10 | integer ≥ 1 | `usage` | `config` |
| `threshold` | 0.9 | number in (0, 1] | `usage` | `config` |
| `inferenceTimeout` | 30000 ms | integer 1 to 2147483647 | `usage` | `config` |
| `testTimeout` | `30000 + 1000 × (runs − 1)` from the resolved `runs`, at most 2147483647, unless any layer declares one | integer 1 to 2147483647 | `usage` | `config` |
| `strict` | `false` | `true` or `false` | `usage` | `config` |

An unknown key, or options that are not an object, are the same errors.
`need = max(1, ceil(threshold × runs − 1e-9))`: 0.9 of fewer than 10 runs
needs every run ([`verdict/compute`](README.md#verdict--compute)).

### Call options

| Assertion | Option | Default | Valid | Pinned by |
| --- | --- | --- | --- | --- |
| `coherent`, `extract` | `facts` | none | a string or a list of strings, sent after the run's facts, for this call only | `assertion/call` |
| `extract` | `as` | `string` | `string`, `number`, `boolean` | `assertion/call` |
| `extract` | `strict` | the test's resolved `strict` | `true` or `false`, never coerced | `assertion/call`, `run-options/resolve` |

Invalid arguments and options are `usage` errors
([`assertion/call`](README.md#assertion--call)).

### Config file

`crucible.config.json` or `crucible.config.jsonc` (both read as JSONC, one
of them, never both) in the directory the test runner runs from. It is read
once, when the first test executes, never at registration. Contract:
[`config/load`](README.md#config--load), [`jsonc/parse`](README.md#jsonc--parse);
editor schema: [`schemas/crucible.config.schema.json`](../schemas/crucible.config.schema.json).

| Field | Required | Default | Rule |
| --- | --- | --- | --- |
| `provider` | yes | | `openrouter`, `openai` or `openai-compatible` |
| `model` | yes | | non-blank string, kept verbatim |
| `baseUrl` | `openai-compatible` only (rejected elsewhere) | | absolute http(s) URL, no credentials, query or fragment; never echoed |
| `apiKeyEnv` | no | `CRUCIBLE_JUDGE_KEY` | a variable name; never echoed |
| `meta` | no | none | an object, sent as extra request-body members; a member named `model` or `messages` is replaced by Crucible's own ([`provider/request`](README.md#provider--request)) |
| `verbosity` | no | `default` | `default`, `full`, `debug` |
| `testDefaults` | no | `{}` | run options |
| `excerptChars` | no | 500 | integer ≥ 1 |
| `$schema` | no | | ignored |

Any other field is a `config` error, and so is a key-like field (`apiKey`,
`token`, …) whose value is never echoed.

| Provider | Endpoint | Key |
| --- | --- | --- |
| `openrouter` | `https://openrouter.ai/api/v1/chat/completions` | required |
| `openai` | `https://api.openai.com/v1/chat/completions` | required |
| `openai-compatible` | `<baseUrl>/chat/completions` | required only with `apiKeyEnv`; without a key no `Authorization` header is sent, and a key sent over plain `http` to a non-loopback host writes a warning |

Contracts: [`provider/request`](README.md#provider--request),
[`provider/response`](README.md#provider--response),
[`provider/plain-http-warning`](README.md#provider--plain-http-warning).

| Environment variable | Meaning |
| --- | --- |
| `CRUCIBLE_JUDGE_KEY` | the judge key when the config sets no `apiKeyEnv` (else the variable it names); trimmed, printable ASCII only; missing where required is a `config` error. No provider-native variable (`OPENAI_API_KEY`) is ever read. |
| `CRUCIBLE_VERBOSE` | overrides `verbosity` when set and not empty; an invalid value is a `usage` error |

### Errors

Two error types. Callers branch on the kind, never on message text; message
wording is each port's business, and fixtures never pin it.

| Error | Field | Values |
| --- | --- | --- |
| `CrucibleError` | `kind` | `usage`: an API called incorrectly. `config`: the config file or key environment. `infra`: the judge provider or judge reply failed. |
| | `retryable` | only for `infra`: `true` when transient (the run is *errored*), `false` when the provider will refuse again (bad key, unknown model: the whole test aborts) |
| `CrucibleVerdictError` | `outcome` | `failed` (the system under test missed the threshold) or `errored` (infrastructure prevented a verdict: provider failures, a fatal provider error, the deadline) |
| | `message` | the report text ([`report/render`](README.md#report--render)) |
| | `cause` | the error of a representative run, when there is one |

Secrets (keys, `baseUrl` passwords, key-like field values, config file
text) never appear in any error: fixtures pin this with `mustNotContain`.

### Verdict and report

Each run ends `passed`, `failed`, `errored` or `discarded`; the test's
verdict is `passed`, `failed` or `errored`
([`verdict/compute`](README.md#verdict--compute)). The failure report, the
passing report (`full` and `debug` only) and the debug trace (stdout,
`debug` only) are exact text
([`report/render`](README.md#report--render),
[`report/trace`](README.md#report--trace)); `surface.json` lists every
headline variant, section, field and trace line with a case that prints it.

## 2. Engine and runner adapter

Crucible is two parts. The **engine** is runner-neutral and is most of a
port: everything in §1 except registration. The **runner adapter** is small
and per test framework (Jest and Vitest in TypeScript; xUnit, NUnit or
MSTest in C#; pytest; JUnit). Keep the boundary: the engine never imports a
test framework.

### The engine

The gate is what `it` and `gate` run when the runner calls the test:

1. **Resolve options** at run time: built-ins, then `testDefaults` (the
   config is loaded now, on first use), then the group layers captured at
   declaration, then the test's own.
2. **Start `runs` runs at once**, concurrently, each in its own per-run
   context (below) and with its run number from 1. Each run calls the body
   with its `t`.
3. **Arm the test deadline** (`testTimeout`). One cancellation token / abort
   signal is shared by every run's judge calls.
4. **Settle each run** by how its body ends:
   - returned: `passed`;
   - threw an error whose first `CrucibleError` (the error itself or the
     nearest down its cause chain) is `infra`: `errored`;
   - threw a `CrucibleVerdictError`, or an error whose first `CrucibleError`
     (as above, so a wrapper whose cause is one counts) is `usage` or
     `config`: **halt**, cancel every other run and rethrow the thrown error
     unchanged;
   - threw anything else (a failed assertion, a crash): `failed`.
5. **Halt early** on a fatal error (an `errored` run whose `infra` error is
   not retryable) or when the deadline passes: cancel in-flight judge calls,
   mark unsettled runs `discarded`, and throw `CrucibleVerdictError`
   (`errored`) with the aborted or expired report.
6. Otherwise **wait for every run** (even when enough already passed),
   compute the verdict, and throw `CrucibleVerdictError` with the report
   unless it passed. At `full`/`debug` a passing test writes its report.
7. **Close every `t`**: any later use is a `usage` error.

Judge calls inside a run: build the payload, send the request with up to 3
provider attempts (exponential backoff with jitter between them; TypeScript
waits 250 ms × 2^(n−1) × (1 + random), not pinned), re-ask once after an
unusable reply, and record the call for the report. So a call asks for at
most 2 replies. Each reply (its provider attempts and their backoff
included) gets its own `inferenceTimeout` budget, and the re-ask a fresh
one; the test's cancellation bounds them all. A reply that runs out of time
fails as `infra`, retryable, and is not re-asked.

### Per-run context

`crucible.facts()` and `crucible.coherent()` are global functions, yet each
must find the run it is called from while 10 runs execute at once. The
engine stores the run in an async-local slot that flows into everything the
run's body awaits and starts:

| Language | Mechanism | Watch for |
| --- | --- | --- |
| TypeScript | `AsyncLocalStorage` | callbacks of some emitters and native code lose it |
| C# | `AsyncLocal<T>`, set inside each run's task before the body starts | it flows down into awaits, `Task.Run` and continuations, never back up: a value set inside an awaited method is gone in its caller, so set it in the run's own task; `ExecutionContext.SuppressFlow`, `ThreadPool.UnsafeQueueUserWorkItem` and similar unsafe callbacks lose it |
| Python | `contextvars.ContextVar`, set in each run's `asyncio` task | tasks copy the context when created, and `asyncio.to_thread` carries it; `loop.run_in_executor` and plain threads do not (wrap with `contextvars.copy_context().run`) |
| Java | `ScopedValue` (final in Java 25, JEP 506) or a `ThreadLocal` with one thread per run | `CompletableFuture` stages and executors do not carry it; only `StructuredTaskScope` (preview in 25) forks inherit a `ScopedValue` |

Whatever the mechanism, `t` holds its run explicitly, so it is the fallback
wherever the context is lost; the global functions throw `usage` there. Two
concurrent runs must never see each other's facts or records.

### The runner adapter

What a runner adapter does, and nothing more:

- **Register** each `it` with the runner: its name, a test function that
  runs the gate, and a **runner timeout**. The gate enforces its own
  deadline; the adapter gives the runner a declared `testTimeout` + 5000 ms,
  capped at 2147483647 (the largest 32-bit timer), or that maximum when no
  test or group declares one (the default
  depends on `testDefaults`, which is read only when the test runs). A
  runner whose timeout fires first fails the test without Crucible's report.
- **Variants**: map the runner's own focus, skip, todo and table forms
  (Jest `only`, `skip`, `todo`, `each`; Vitest also `for`, `skipIf`,
  `runIf`; in C# whatever the framework offers: `[Fact(Skip = …)]`,
  `[Theory]` with data rows). A table test passes each row's values after
  `t`. A skipped test never runs its body and costs no judge calls.
- **Blocked variants**: refuse, as a `usage` error, the ones that break a
  pass-rate gate, and say why:
  - inverted outcome (Jest `failing`, Vitest `fails`): a gate passes when
    enough runs pass, so "expected to fail" is ambiguous;
  - concurrent tests (`concurrent`): the runs of a test already execute
    concurrently under one deadline; concurrent tests would share it and the
    provider's rate limits unpredictably;
  - group scheduling (Vitest `describe.concurrent`, `shuffle`,
    `sequential`): a group's tests must run one at a time in declaration
    order. Register tests and groups explicitly non-concurrent where the
    runner allows a surrounding setting to override (Vitest
    `{ concurrent: false, shuffle: false }`; xUnit test collections run in
    parallel by default, so put Crucible tests in one non-parallel
    collection).
- **Group settings**: a group's options must reach every test declared
  inside it, at any depth, through plain runner groups too, and never leak
  to siblings. Two strategies:
  - a **stack**, pushed while the group callback runs, when the runner runs
    group callbacks synchronously at declaration (Jest);
  - the **runner's suite tree**, when callbacks run later (Vitest: look up
    the current suite and its parents, and keep each group's options keyed
    by its suite object). Fail with `usage` when the runner exposes no tree,
    rather than silently using defaults.
  An attribute-based runner (xUnit, NUnit, MSTest) has no callbacks: read
  group settings from class or assembly attributes, nearest wins.
- **Argument forms**: `it(name, body)`, `it(name, options, body)`,
  `it(name, options?, body, timeout)`; a trailing timeout is the test's
  `testTimeout` (both at once is `usage`); two bodies, a missing body or an
  argument after the last one are `usage`. A group callback must be
  synchronous and return nothing. These take functions, so no fixture pins
  them.

**xUnit, NUnit, MSTest.** There is no global `it` to wrap. Either give the
port its own attributes (`[CrucibleFact(Runs = 20, Threshold = 0.95)]`, a
custom test case discoverer that runs the gate), or expose the gate as a
call inside an ordinary `[Fact]`/`[Test]`/`[TestMethod]`
(`await Crucible.Gate(options, async t => { … })`, the equivalent of
`crucible.gate`). The second needs no runner extension and is the smaller
first step; the runner timeout is then the framework's own (`[Fact(Timeout
= …)]`, NUnit `[CancelAfter]`, MSTest `[Timeout]`), set as above. Group
settings come from class or assembly attributes, nearest wins. The xUnit
sketch in [`docs/inspiration.md`](../docs/inspiration.md) predates the
current API (defaults, group settings, strict extract).

**C# integration** (from the port's planning notes; re-check against
current Microsoft docs):

- Accept `IChatClient` (`Microsoft.Extensions.AI`) as a judge option, beside
  the provider config of §1, so Microsoft Agent Framework users plug in what
  they already have. The provider config stays, and its request goldens
  still pin what it sends.
- Consider implementing `IEvaluator`, so Crucible's assertions feed
  `Microsoft.Extensions.AI.Evaluation` reporting (`dotnet aieval`) instead of
  competing with it. Crucible is complementary: it adds the repeated-run
  gate and world-state facts, which that library does not have.
- **Response caching defeats the gate.** A caching `IChatClient` around the
  system under test, or the evaluation stack's response cache, can serve one
  answer to all 20 runs and silently turn the gate into a single sample.
  Detect or disable it, and at least document turning it off; caching the
  judge hides judge variance too.

## 3. What the fixtures cover, and what a port tests itself

| Operation | Pins |
| --- | --- |
| `run-options/resolve`, `run-options/validate` | option precedence, defaults, the test timeout formula, every validation rule and its kind |
| `verdict/compute` | `need`, the three zones, discarded runs |
| `assertion/call` | assertion and `facts` arguments, call options reaching the payload |
| `payload/coherent`, `payload/extract` | the exact user message, fencing and injection safety, every conformance case |
| `judge/reply` | reply unwrapping, strict JSON, shapes, the re-ask |
| `provider/request` | URL, headers, body, key rules, per provider |
| `provider/response` | envelopes, status classes, retries, fatal vs retryable |
| `provider/plain-http-warning` | when the plain-http key warning is written |
| `jsonc/parse`, `config/load` | the config file, rule by rule, secrets never echoed |
| `report/render`, `report/trace` | every report and trace text |

What each port still tests itself, with its own unit tests (fake clock,
fake HTTP, fake runner):

- **The runner adapter**: registration, the runner timeout, every variant,
  blocked variants, group inheritance (nested groups, plain runner groups,
  siblings, a throwing callback), argument forms, synchronous callbacks.
- **The engine's timing and concurrency**: runs start together, the
  deadline, fatal-error abort, discarded runs, the rethrow of `usage` and
  `config` errors, `t` after its run ended, a lost async context, facts
  isolated between concurrent runs, the inference timeout and cancellation
  of in-flight calls.
- **Boundaries**: finding and reading the config file (missing vs
  unreadable), reading the environment, writing the trace and the passing
  report (a broken output stream never fails the test), the plain-http
  warning written once per provider and never holding the key, the HTTP
  client (cancellation, TLS).
- **Language-only inputs** a JSON fixture cannot hold, and every case it
  skips by id.
- **One live smoke**: one `coherent` and one `extract` call against a real
  judge (TypeScript: OpenRouter, at most two calls), run in CI. Every other
  end-to-end test can run offline against a scripted stub judge
  (TypeScript: `make e2e-offline`, a loopback OpenAI-compatible server).
- **Model behaviour is not a port's test.** `make conformance` (a jq/curl
  harness in [`e2e/ext/conformance/`](../e2e/ext/conformance/)) checks the
  judge models against the conformance cases. A port that passes the
  payload and request goldens sends exactly what that harness sends, so its
  results hold for every port.

## 4. Shared assets and versioning

Embed these unchanged, byte for byte (UTF-8, as in the repository):

| Asset | Use |
| --- | --- |
| [`schemas/coherent.md`](../schemas/coherent.md), [`schemas/extract.md`](../schemas/extract.md) | the judge system prompts, sent verbatim, front matter included (`provider/request-conformance.json` proves it) |
| [`schemas/crucible.config.schema.json`](../schemas/crucible.config.schema.json) | ship it for editor hints (`"$schema"` in a config file); the port's own config rules are `config/load` |
| `spec/**/*.json` (fixture files), [`fixture.schema.json`](fixture.schema.json), [`surface.json`](surface.json) | test resources: the fixture runner and the surface check |
| [`e2e/ext/fixtures/*-conformance.json`](../e2e/ext/fixtures/) | the conformance cases; already turned into payload goldens, so a port only needs them to run `make conformance` itself |

Copy them into the port at a pinned commit (a script, a git submodule, or a
build step) and embed them as resources, so unit tests never read files at
test time.

**Versioning.** The spec has no version number of its own: its version is
the commit or release tag of this repository (`crucible-ai` `v0.4.0`, say).
Package versions are independent: `Geekmotors.Crucible` 0.1.0 may implement
the spec of `crucible-ai` v0.5.0. A port declares, in its README and in one
machine-readable file it ships (for example `spec-version.txt`, or an
assembly attribute), the tag or commit it passes, and lists every case id
it skips with the reason. To upgrade, diff `spec/` between the two commits:
new cases and operations add coverage; a changed `expect` is a behaviour
change and has a CHANGELOG entry here; ids are never reused
([Versioning](README.md#versioning)).

**Reusing the surface check.** Port the check, not the TypeScript test:
list the port's public functions, option names, config fields, providers and
error kinds from its own sources (reflection over the options types, or
compile-time lists the compiler keeps complete), and fail when they differ
from `surface.json`. The fixture runner then proves every item, because it
runs every case the manifest cites. When the TypeScript surface grows, the
manifest grows with it, and the port's check fails until the port catches
up.

## 5. Language notes

Rules that commonly differ between languages, collected from
[`README.md`](README.md). Each bites one of the listed fixtures. A claim
marked *verify* is believed true but was not checked against the runtime:
confirm it with a unit test before relying on it.

| Topic | Rule | C# | Python | Java |
| --- | --- | --- | --- | --- |
| [Text length](README.md#text-rules) | count UTF-16 code units; `😀` is 2; `cut` never splits a pair except at limit 1 | native | convert: `len(s.encode('utf-16-le', 'surrogatepass')) // 2` (plain `encode` raises on a lone surrogate) | native |
| [Fencing](README.md#payload--coherent) | invisible code points and padding are matched by **code point** (some are astral) | iterate code points by hand (`char.IsSurrogatePair`, `char.ConvertToUtf32`): `EnumerateRunes` turns a lone surrogate into U+FFFD | native | `codePoints()` |
| [JSON values in reports](README.md#text-rules) | `JSON.stringify` escaping: only `"`, `\`, controls (`\u00xx` lowercase), lone surrogates; everything else raw | the default `System.Text.Json` encoder escapes every non-ASCII character and `<>&'+`; `UnsafeRelaxedJsonEscaping` leaves most of the BMP raw but still escapes astral characters as surrogate pairs (*verify*), and escapes use uppercase hex: write your own | `json.dumps(ensure_ascii=False)` writes lone surrogates raw: write your own | write your own |
| [Numbers in text](README.md#text-rules) | ECMAScript `Number.toString`: shortest round-trip, no `.0` | `double.ToString("R", CultureInfo.InvariantCulture)` (shortest round-trip on .NET Core 3.0+), which switches to `E` notation from 1E+15 (*verify*) where ECMAScript waits until 1e21: fixtures use plain values only | `repr`, strip `.0`; `repr` switches to exponent form from `1e+16` and below `0.0001` (ECMAScript: from 1e21 and below 0.000001) | `Double.toString` prints `1.0`, uses `E` outside [10⁻³, 10⁷), and is shortest only from JDK 19: format yourself |
| [`Math.round`](README.md#report--trace) | ties toward +∞ (`-2.5` → `-2`) | `Math.Round(x)` defaults to `MidpointRounding.ToEven` (banker's): use `f = Math.Floor(x)`, then `f + 1` when `x - f >= 0.5`, else `f` (`Math.Floor(x + 0.5)` is wrong for 0.49999999999999994) | `round` is banker's: as C#, with `math.floor` | `Math.round` matches (Java 7 and later) |
| [`need`, pass rate](README.md#verdict--compute) | IEEE 754 doubles, in the order given, no FMA, no `decimal` | `double`, not `decimal` | `float` | `double`, no `StrictMath.fma` |
| [Test timeout](README.md#run-options--resolve) | `30000 + (runs − 1) × 1000` overflows 32 bits from about 2.1 million runs | `long` | native | `long` |
| [Integers and booleans](README.md#run-options--validate) | `2.0` is the integer 2; a boolean is never a number (`runs: true` is invalid) | check JSON token kinds | `bool` is a subclass of `int`: test it first | check JSON token kinds |
| [Lower-casing](README.md#config--load) | Unicode default, locale-independent | `ToLowerInvariant` (simple, one-to-one case mapping: `İ` U+0130 stays one character where ECMAScript gives `i̇`, *verify*; the key-like names are ASCII, so fixtures do not see it) | `str.lower` (full mapping, as ECMAScript) | `toLowerCase(Locale.ROOT)` |
| [Trim](README.md#text-rules) | exactly the ECMAScript `trim` set | `string.Trim()` differs (U+0085 in, U+FEFF out): write your own | `str.strip` differs (U+001C–U+001F and U+0085 in, U+FEFF out): write your own | `trim` strips every code unit ≤ U+0020, `strip` uses `Character.isWhitespace` (no U+00A0, U+2007, U+202F, U+FEFF; U+001C–U+001F in): write your own |
| [Line breaks](README.md#text-rules) | the report set and the wider fencing set are different lists | write both | `splitlines` is the fencing set only | write both |
| [Regex match](README.md#config--load) | match the whole string | `\A…\z` | `re.fullmatch` | `matches()` |
| [URLs](README.md#config--load) | WHATWG URL Standard parsing and serialisation | `Uri` differs: use a WHATWG parser | `urllib` differs: use a WHATWG parser | `URI` differs: use a WHATWG parser |
| [JSON input](README.md#text-rules) | keep object member order; duplicate keys: last wins; strict JSON for replies; numbers are doubles (`1e999` is infinity, then unusable) | check your parser accepts duplicates and huge exponents | `json` keeps order, last wins | Jackson `ObjectNode` keeps order |
| [Unset vs null](README.md#special-values) | `$special: "undefined"` is a present but unset value | `null` for an optional option | `None` | `null` / `Optional.empty()` |
| [Headers](README.md#provider--request) | header names compare case-insensitively | | | |

## 6. The first week

Each step is done when its fixtures pass. The order builds each layer on
the one before and leaves the runner for last.

1. **Fixture runner**: load the embedded files, decode `$special`, compare
   outcomes ([Writing a runner](README.md#writing-a-runner)), validate each
   file against `fixture.schema.json`, check id prefixes and uniqueness.
   Port the surface check next to it.
2. **Run options and verdict**: `run-options/resolve`,
   `run-options/validate`, `verdict/compute`.
3. **Payload**: `payload/coherent`, `payload/extract` (fencing included),
   then `assertion/call`.
4. **Judge reply**: `judge/reply`.
5. **Provider**: `provider/request`, `provider/response`,
   `provider/plain-http-warning`.
6. **Config**: `jsonc/parse`, `config/load`.
7. **Report**: `report/render`, `report/trace`.
8. **Gate**: the engine of §2, with the port's own timing tests.
9. **Runner adapter**: one test framework first, with its own tests.
10. **Live smoke**: one `coherent` and one `extract` against a real judge.
11. **Conformance**: run `make conformance` once with the port's judge
    config; record the spec version the port passes.
