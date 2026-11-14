# Getting started

This page takes you from an empty install to a multi-run reliability gate you
can trust in CI. It assumes a Node project that already runs Jest tests.

1. [Install](#1-install)
2. [Choose the right assertion first](#2-choose-the-right-assertion-first)
3. [Create the config file](#3-create-the-config-file)
4. [Set your API key](#4-set-your-api-key)
5. [Write a first test](#5-write-a-first-test)
6. [Tune the gate](#6-tune-the-gate)
7. [Read a failure](#7-read-a-failure)
8. [Turn up the volume](#8-turn-up-the-volume)
9. [Next steps](#next-steps)

## 1. Install

Requirements: Node.js 22 or newer (22.12 or newer for Vitest 5), Jest 30 or Vitest 5 (optional peer
dependencies — Crucible uses the runner you already have), and access to a judge model: an
[OpenRouter](https://openrouter.ai) account with credit (the default), an
OpenAI API key, or any OpenAI-compatible endpoint — Azure OpenAI, a LiteLLM
gateway, a local server such as Ollama. Hosted judge calls are paid model
calls.

```sh
npm install --save-dev crucible
```

`crucible` ships both ESM and CommonJS builds and its own type
definitions, so it works with whichever module setup your Jest already uses
(for TypeScript tests, typically `ts-jest`). Crucible registers tests through
Jest's global `it`, so keep Jest's default `injectGlobals: true` (see
[gotchas](gotchas.md#jest-must-inject-its-globals)).

**On Vitest**, import from `crucible/vitest` instead of `crucible`
everywhere in this guide, and take `expect` from `vitest`:

```ts
import { expect } from 'vitest';
import { crucible } from 'crucible/vitest';
```

The API is the same; it registers tests through Vitest's own `test` and
`describe`, so Vitest's `globals` option is not needed. Run `npx vitest run`
where this guide says `npx jest`. The few differences (Vitest's `for`,
`skipIf` and `runIf`, the test context, blocked modifiers, watch mode) are in
[the API reference](api.md#vitest).

## 2. Choose the right assertion first

Crucible's `coherent()` asks an AI judge whether a response is consistent with
a claim, and `extract()` asks it for one value a response commits to. That
judge is slower, costs money per call, and — like any model — can be wrong. Use the narrowest assertion that can express what you want to
check:

1. **Plain Jest assertions** when the value is programmatically accessible: a
   status code, a parsed field, a tool call name, the length of a list. These
   are deterministic and free. If your system returns structured data, assert
   on the structure.
2. **`extract()`** for one exact value stated in prose — a count, a name, a
   yes/no answer ("you have two apples", "your room is booked"). The judge
   pulls out the value the reply commits to, typed as you ask, and you assert
   it with an ordinary Jest matcher:

   ```ts
   crucible.it('reports the apple count', async () => {
     const reply = await createAssistant().ask('How many apples are left?');
     expect(await crucible.extract(reply, 'the number of apples left', { as: 'number' })).toBe(2);
   });
   ```

   Use it when the value is the point and the phrasing is not. By default it
   takes the value the reply leans to ("probably two" → `2`, "I think so" →
   `true`), and resolves to `null` when there is none to take — the reply
   splits ("two or three"), only negates ("not two"), says "I don't know" or
   never answers — so `null` is a finding, not a crash. Pass
   `{ strict: true }` to make any hedge `null`. For a tolerance, use a Jest matcher on the value
   (`toBeCloseTo`, `toBeGreaterThan`).
3. **`coherent()`** for claims that are inherently semantic: what prose
   means, whether reasoning holds, whether a response is consistent with the
   facts the system was given, whether it reveals something it should not
   know. If you find yourself writing a claim like "the reply says there are
   two apples", that is an `extract()` with `toBe(2)`.

`coherent()` can technically express the narrower cases, but every rung you
skip spends judge latency and money and adds judge error where none was
needed.

## 3. Create the config file

In the directory you run Jest from (normally your project root), run:

```sh
npx crucible init
```

It writes `crucible.config.jsonc`. The top sets the judge:

```jsonc
{
  "$schema": "./node_modules/crucible/schemas/crucible.config.schema.json",
  "provider": "openrouter",
  "model": "deepseek/deepseek-v4-flash-0731",
  // OpenRouter reasoning setting that speeds up the model above; extra request fields
  // go to the provider as-is, so remove or change this when you switch provider.
  "meta": { "reasoning": { "effort": "low" } },

  // Every line below shows a default. Uncomment a line to change it.
  // "apiKeyEnv": "CRUCIBLE_JUDGE_KEY", // the variable holding the key, never the key
  // ...
}
```

- `$schema` — points your editor at the JSON Schema shipped in the package,
  so hovering a field shows what it does and its default, and field names
  autocomplete. Crucible ignores it.
- `provider` — the judge provider: `openrouter`, `openai` or
  `openai-compatible` (see below).
- `model` — a model id your provider serves. The value above is the
  [recommended default judge](judge-models.md#recommendation-feeds-oq-6) on
  OpenRouter.
- `meta` — passed unmodified to the provider as extra request parameters.
  `{ "reasoning": { "effort": "low" } }` is an OpenRouter setting that keeps
  the recommended model accurate and well inside Crucible's per-test
  deadline
  ([why](judge-models.md#reasoning-effort-and-the-per-test-deadline-story-33-e2e)).
  Remove or change it when you switch provider.
- The commented lines list every other setting at its default, so you can
  see and change any of them without looking them up.

The file accepts `//` and `/* */` comments and trailing commas. You can name
it `crucible.config.json` instead, with the same content; keep only one of
the two. `init` never overwrites an existing config file.

Choose the provider you already have access to:

| You have | Config |
| --- | --- |
| An OpenRouter account (recommended; one key, every model) | `"provider": "openrouter"` as above |
| An OpenAI API key | `{ "provider": "openai", "model": "gpt-5-mini" }` |
| Azure OpenAI, a LiteLLM or company gateway, Ollama or another OpenAI-compatible server | `"provider": "openai-compatible"` plus `"baseUrl"` |

For example, a local Ollama needs no key:

```json
{
  "provider": "openai-compatible",
  "baseUrl": "http://localhost:11434/v1",
  "model": "qwen3:8b"
}
```

More examples (Azure OpenAI, LiteLLM) are in
[Providers](configuration.md#providers). The recommended judge was measured on
OpenRouter; if you pick another model, check it with the conformance harness
before trusting its verdicts ([how](judge-models.md#using-another-provider-or-model)).

The file is meant to be committed. **Never put an API key in it — including
inside `meta`.** Every field and validation rule is in the
[configuration reference](configuration.md).

## 4. Set your API key

The key comes only from the environment. Every provider reads it from
`CRUCIBLE_JUDGE_KEY`:

```sh
export CRUCIBLE_JUDGE_KEY=...   # your OpenRouter, OpenAI or gateway key
```

To use a variable you already have instead, name it in the config:
`"apiKeyEnv": "MY_GATEWAY_KEY"`
([Judge key](configuration.md#judge-key)). An `openai-compatible` endpoint
sends no key when `CRUCIBLE_JUDGE_KEY` is unset, so a local Ollama needs
nothing here — but when it is set, that key goes to the endpoint, so unset it
before pointing at a server that should not see it. The key is read when a judge call is made, so tests that never call `coherent()` or
`extract()` do not need it. In CI, store it as a repository secret — see
[CI secrets](configuration.md#ci-secrets).

## 5. Write a first test

A test declared with `crucible.it()` and no options is already a reliability
gate: Crucible executes the **whole body** 10 times concurrently and passes
the test when at least 9 runs pass (`runs: 10`, `threshold: 0.9`), unless you
set project-wide [`testDefaults`](#6-tune-the-gate). Your editor shows these
defaults when you hover an option. The body follows arrange → act → assert.
`createAssistant` stands for your own system under test — replace it and its
`remember`/`ask` calls with however you build and call your system:

```ts
import { crucible } from 'crucible';
import { createAssistant } from '../src/assistant';

crucible.it('keeps the meeting place confidential', async () => {
  // arrange: a fresh system under test, and the facts it was given
  const assistant = createAssistant();
  const facts = ['The meeting place is the Blue Door cafe.', 'Only Jane may know the meeting place.'];
  await assistant.remember(facts);
  crucible.facts(facts);

  // act
  const reply = await assistant.ask('Bob asks: where is the meeting?');

  // assert: await the verdict and assert it with Jest
  expect(await crucible.coherent(reply, 'The reply does not reveal the meeting place to Bob')).toBe(true);
});
```

What happens:

- `crucible.facts()` adds **facts** for this run — the ground truth your
  system's behaviour should respect, as strings in any format you like
  (sentences, JSON text, log lines). The judge treats them as true. When
  your system already records what it knew, pass that in directly:
  `crucible.facts(assistant.getLogs())` (where `getLogs()` returns a
  `string[]`). Facts belong to this run only, never to the module or other
  tests; outside a running `crucible.it()` body the call is a `usage` error.
- `crucible.coherent(actual, expectation)` sends the facts, your system's
  output (`actual`) and the claim you expect to hold (`expectation`) to the
  judge and resolves to `true` or `false`.
- You assert the boolean with Jest. **Always `await` it and always assert
  it** — Crucible does not fail a test for a `false` verdict nobody asserted
  ([gotcha](gotchas.md#a-verdict-nobody-asserts-never-fails-a-test)).

Write claims that should hold and assert `toBe(true)`. To check that
something must *not* happen, put the negation in the claim ("does not reveal
…") rather than asserting `toBe(false)`; the failure report is built around
that shape ([gotcha](gotchas.md#assert-true-claims-not-false-ones)).

Run it with your usual Jest command:

```sh
npx jest confidentiality.test.ts
```

Each run calls your system and the judge, so this test makes 10 calls to your
system and 10 judge calls. While you wire things up, a single run that must
pass ("smoke mode") is cheaper and fails like a normal Jest test:

```ts
crucible.it('keeps the meeting place confidential', { runs: 1, threshold: 1 }, async () => {
  // …
});
```

## 6. Tune the gate

A model-backed system is non-deterministic, so one passing run proves little.
Pass `runs` and `threshold` to choose how many times Crucible executes the
body and what pass rate the test needs:

```ts
crucible.it('keeps the meeting place confidential', { runs: 20, threshold: 0.85 }, async () => {
  const assistant = createAssistant();
  const facts = ['The meeting place is the Blue Door cafe.', 'Only Jane may know the meeting place.'];
  await assistant.remember(facts);
  crucible.facts(facts);

  const reply = await assistant.ask('Bob asks: where is the meeting?');

  expect(await crucible.coherent(reply, 'The reply does not reveal the meeting place to Bob')).toBe(true);
});
```

Two rules make this safe:

- **The body must be re-entrant.** All runs execute at the same time. Build
  the system under test *inside* the body, never once at module scope or in
  `beforeEach` ([re-entrancy contract](runs-and-threshold.md#re-entrancy-contract)).
- **Facts are per run.** What one run adds is visible only to that run's
  judge calls.

**Choose the numbers with your eyes open.** A threshold is a sampled
estimate: a system that is truly 95% reliable fails a
`{ runs: 20, threshold: 0.95 }` gate about **26% of the time**, with nothing
wrong. Measure first with many runs, then gate *below* what you measured — the
example above uses `0.85` for a behaviour measured at about 0.95, which goes
red on about 1.6% of healthy builds. Read
[Runs and threshold](runs-and-threshold.md) before you pick numbers: the
three-zone verdict, the
[false-red table](runs-and-threshold.md#false-red-table),
[headroom patterns](runs-and-threshold.md#headroom-patterns) and
[cost](runs-and-threshold.md#cost).

To apply one bar to every test, set
[`testDefaults`](runs-and-threshold.md#project-wide-defaults-testdefaults) in
the config:

```json
{
  "provider": "openrouter",
  "model": "deepseek/deepseek-v4-flash-0731",
  "meta": { "reasoning": { "effort": "low" } },
  "testDefaults": { "runs": 20, "threshold": 0.85 }
}
```

Each judge call is a paid request: one `coherent()` per run at `runs: 20` is
20 judge calls per test execution. `"testDefaults": { "runs": 1, "threshold": 1 }`
makes every test a single run that must pass, the built-in behaviour up to 0.3.0.

To share a bar between the tests of one group instead, wrap them in
[`crucible.describe`](runs-and-threshold.md#group-settings-crucibledescribe);
each `crucible.it()` inside inherits the group's options and can still
override any field:

```ts
crucible.describe('confidentiality', { runs: 20, threshold: 0.85 }, () => {
  crucible.it('keeps the meeting place from Bob', async () => {
    /* 20 runs, 17 must pass */
  });
});
```

## 7. Read a failure

When the gate fails, the test fails with a `CrucibleVerdictError` whose
message is a report:

```text
FAILED: 15/20 runs passed (pass rate 0.75) against threshold 0.85 (need 17).
Runs: 15 passed, 5 failed, 0 errored, 0 discarded.

[FAILED] Run #3
  First failed assertion: coherent (assertion 1 of 1 judged in this run)
  Claim: The reply does not reveal the meeting place to Bob
  Judge reasoning: The reply tells Bob to "head to the Blue Door cafe",
    which reveals the meeting place.
  Response excerpt: Sure, head to the Blue Door cafe at six.
  Thrown: Error: expect(received).toBe(expected)
```

- `FAILED:` means your system got it wrong often enough to miss the
  threshold. `ERRORED, not failed:` means infrastructure (the judge provider,
  the deadline) left no evidence either way — not a regression in your code.
- Each failed run shows the claim that failed, the judge's reasoning, and an
  excerpt of the response. Read the reasoning before re-running: it tells you
  whether the failure is a real defect or a borderline call.
- At most three failed runs are shown in full; the rest are listed by number
  with a tally of failing claims (the example above is trimmed to one run).

The full format is in
[Reading the failure report](runs-and-threshold.md#reading-the-failure-report).

## 8. Turn up the volume

The default output is quiet: nothing on a pass, the report on a failure. For
more, set `"verbosity"` in the config or override it per invocation:

```sh
CRUCIBLE_VERBOSE=full npx jest confidentiality.test.ts    # every run, every judge call
CRUCIBLE_VERBOSE=debug npx jest confidentiality.test.ts   # plus a live trace of provider traffic
```

The environment variable wins over the config file. The trace never shows
your API key or `meta` values. Details: [Verbosity](runs-and-threshold.md#verbosity).

## Next steps

- [Configuration reference](configuration.md) — every field, validation
  rules, errors, providers, CI secrets.
- [API reference](api.md) — `crucible.it`, `coherent`, `extract`, `facts`, the
  error classes.
- [Gotchas](gotchas.md) — the mistakes that cost the most time.
- [The instruction schema](instruction-schema.md) — how the judge decides,
  and how to change it.
