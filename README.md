# Crucible

[![npm](https://img.shields.io/npm/v/crucible-ai)](https://www.npmjs.com/package/crucible-ai)
[![ci](https://github.com/Geekmotors/crucible-ai/actions/workflows/ci.yml/badge.svg?branch=main)](https://github.com/Geekmotors/crucible-ai/actions/workflows/ci.yml?query=branch%3Amain)
[![license](https://img.shields.io/npm/l/crucible-ai)](https://github.com/Geekmotors/crucible-ai/blob/main/LICENSE)

Semantic assertions for code that calls LLMs, inside the Jest suite you already have.

Crucible asks an AI judge whether your system's reply means what it should, given the facts your system knew at the time. It re-runs the test many times (10 by default) and passes on a pass rate (90% by default), so a flaky model can't sneak through on one lucky run.

```ts
crucible.it('keeps the meeting place secret', async () => {
  const assistant = createAssistant();
  await assistant.remember(['The meeting is at the Blue Door cafe.', 'Only Jane may know where.']);
  crucible.facts(['The meeting is at the Blue Door cafe.', 'Only Jane may know where.']);

  const reply = await assistant.ask('Bob asks: where is the meeting?');

  expect(await crucible.coherent(reply, 'The reply does not reveal the meeting place to Bob')).toBe(true);
});
```

Why this exists, and how it compares with promptfoo, DeepEval and others: [Inspiration](https://github.com/Geekmotors/crucible-ai/blob/main/docs/inspiration.md).

## Features

- **Semantic assertions:** `crucible.coherent(actual, expectation)` returns the judge's `true`/`false` verdict, which you assert with plain Jest.
- **Value extraction:** `crucible.extract(text, description, { as, strict, facts })` pulls one typed value out of prose (a count, a name, a yes/no), or `null` when the text commits to none, so you can use any Jest matcher on it. Lenient by default ("probably two" → `2`); `strict: true` makes any hedge `null`.
- **Fact-aware judging:** `crucible.facts()` tells the judge what your system knew, for the whole run or for one assertion, so you can test things like "the character can't know this yet".
- **Reliability gates:** every test runs its whole body concurrently (10 runs by default) and passes on the pass rate (0.9 by default); `{ runs, threshold }` tunes both.
- **Readable failures:** the report shows the pass rate, each failed run and the judge's reasoning.
- **Fail fast, spend less:** a fatal provider or config error stops the sibling runs.
- **Any judge model, your provider:** [OpenRouter](https://openrouter.ai), OpenAI, or any OpenAI-compatible endpoint (Azure OpenAI, a LiteLLM gateway, Ollama; only OpenRouter's compatible endpoint is tested live so far), chosen in a committed config file.
- ESM and CommonJS builds, bundled TypeScript types, published with npm provenance.

## Requirements

- Node.js 22 or later (Vitest 5 itself needs Node.js 22.12 or later)
- Jest 30 (with the default `injectGlobals: true`) or Vitest 5. Both are optional peer dependencies: install the one you use.
- Access to a judge model: an OpenRouter API key with credit (the default), an OpenAI API key, or an OpenAI-compatible endpoint. Hosted judge calls are paid model calls, typically a fraction of a cent each.

## Installation

```sh
npm install --save-dev crucible-ai
```

## Quick start

**1. Create the config file** in the directory you run Jest or Vitest from, and commit it:

```sh
npx crucible-ai init
```

This writes `crucible.config.jsonc`: the provider, the judge model and an OpenRouter reasoning setting that speeds it up, then every other setting as a commented line showing its default (trimmed here):

```jsonc
{
  "$schema": "./node_modules/crucible-ai/schemas/crucible.config.schema.json",
  "provider": "openrouter",
  "model": "deepseek/deepseek-v4-flash-0731",
  // OpenRouter reasoning setting that speeds up the model above; extra request fields
  // go to the provider as-is, so remove or change this when you switch provider.
  "meta": { "reasoning": { "effort": "low" } },

  // Every line below shows a default. Uncomment a line to change it.
  // "apiKeyEnv": "CRUCIBLE_JUDGE_KEY", // the variable holding the key, never the key
  // "testDefaults": {
  //   "runs": 10,
  //   "threshold": 0.9, // at least 9 of 10 runs must pass
  //   ...
  // },
}
```

The `$schema` line gives your editor autocomplete and hover docs for every field. `init` never overwrites: if `crucible.config.json` or `crucible.config.jsonc` already exists, it changes nothing and exits non-zero.

To judge with OpenAI instead, set `"provider": "openai"` and `"model": "gpt-5-mini"`, and remove the OpenRouter `meta` line. For Azure OpenAI, a gateway or a local model server, use `"provider": "openai-compatible"` with a `"baseUrl"`. See [Providers](https://github.com/Geekmotors/crucible-ai/blob/main/docs/configuration.md#providers).

**2. Set your API key** in the environment. Never put it in the config file.

```sh
export CRUCIBLE_JUDGE_KEY=...   # every provider reads it; "apiKeyEnv" in the config names another variable
```

**3. Write a test.** With no options it is already a reliability gate: the body runs 10 times concurrently and the test passes when at least 9 runs pass:

```ts
import { crucible } from 'crucible-ai';
import { createAssistant } from '../src/assistant';

crucible.it('declines to export on the free plan', async () => {
  const assistant = createAssistant({ plan: 'free' });

  const reply = await assistant.ask('Export my report as PDF.');

  expect(await crucible.coherent(reply, 'The reply declines the export')).toBe(true);
});
```

The judge sees only the reply and the claim. When whether a reply is right depends on what your system knew, [give the judge facts](#give-the-judge-facts).

Each run calls your system and the judge, so an unconfigured test costs 10 runs of your system and 10 judge calls per assertion. For a single run that must pass, like a normal Jest test, declare `{ runs: 1, threshold: 1 }` on the test or in [`testDefaults`](#project-wide-defaults).

**4. Run it** with your usual Jest command:

```sh
npx jest
```

## Usage

### Gate on a pass rate

Every test runs its body concurrently and passes when at least `threshold` of the runs pass. The defaults are `runs: 10` and `threshold: 0.9`; set your own per test:

```ts
crucible.it('stays in character', { runs: 20, threshold: 0.9 }, async () => {
  const reply = await createAssistant().ask('Who are you really?');
  expect(await crucible.coherent(reply, 'The reply stays in the persona of a ship captain')).toBe(true);
});
```

A threshold is a sampled estimate. A system that is truly 95% reliable fails a `{ runs: 20, threshold: 0.95 }` gate about 26% of the time, so leave headroom. [Runs and threshold](https://github.com/Geekmotors/crucible-ai/blob/main/docs/runs-and-threshold.md) explains how to choose both.

### Give the judge facts

Use facts when the right answer depends on what your system knew: a secret it must keep, a fact that changed, something a character can't know yet. The judge treats facts as ground truth, separate from the reply it judges, so a test can check that a reply does *not* reveal something.

Facts belong to the current run, not to the module or the test file: each run of each test starts with none and keeps its own, even when runs execute concurrently, and other tests never see them. Calling `crucible.facts()` outside a running `crucible.it()` or `crucible.gate()` body is a `usage` error.

Add facts as they arise; each assertion is judged against the facts added before you called it:

```ts
crucible.it('remembers a change of venue', async () => {
  const assistant = createAssistant();
  await assistant.remember(['The meeting is in room B12.']);
  crucible.facts('The meeting is in room B12.');

  await assistant.remember(['The meeting moved to room C3.']);
  crucible.facts('The meeting moved to room C3.');

  const reply = await assistant.ask('Where is the meeting?');
  expect(await crucible.coherent(reply, 'The reply says the meeting is in room C3')).toBe(true);
});
```

Often the facts are already in your system under test, as logs or the records it was given. Pass them straight in (`getLogs()` here returns a `string[]`).

Each run also receives its own run context `t`, with `facts`, `coherent` and `extract` bound to that run. It makes the scope visible, keeps working from callbacks that lost Node's async context, and is the recommended style; the global functions share the same run state:

```ts
crucible.it('keeps the secret it was told', async (t) => {
  const assistant = createAssistant();
  await assistant.remember(['The meeting is at the Blue Door cafe.', 'Only Jane may know where.']);
  t.facts(assistant.getLogs());

  const reply = await assistant.ask('Bob asks: where is the meeting?');
  expect(await t.coherent(reply, 'The reply does not reveal the meeting place to Bob')).toBe(true);
});
```

Facts that matter to one assertion only can go with that call. They are sent after the run's facts and are not kept, so later calls do not see them:

```ts
expect(
  await crucible.coherent(reply, 'The reply offers the upgrade', { facts: 'The user is on the free plan.' }),
).toBe(true);
```

`crucible.extract()` takes the same `facts` option.

### Extract a value

When the point is one exact value stated in prose, extract it and assert it with any Jest matcher. `as` is `'string'` (the default), `'number'` or `'boolean'`, and the result is typed to match:

```ts
crucible.it('counts the apples', async () => {
  const reply = await createAssistant().ask('How many apples are in the basket?');
  expect(await crucible.extract(reply, 'the number of apples in the basket', { as: 'number' })).toBe(2);
});
```

The judge takes the final answer ("I thought 3, but it's two" → `2`). Extraction is lenient by default: it takes the value the text leans to ("probably two" → `2`, "I think so" → `true`) and returns `null` when there is none to take: a split ("two or three"), a bare negation ("not two"), "I don't know" or no answer. Where a firm commitment matters, pass `strict: true` and any hedge is `null`; set it on the call, the test, a `crucible.describe` group or `testDefaults` (last wins):

```ts
expect(await crucible.extract(reply, 'whether the room is booked', { as: 'boolean', strict: true })).toBe(true);
```

Always `await` it. When the assertion fails, the report shows what the judge extracted, in which mode, and why.

### Set timeouts

By default a whole test gets 30 s plus 1 s per extra run (39 s for the default 10 runs), and each judge request gets 30 s. Override them per test, Jest-style or by name:

```ts
crucible.it('summarises a long thread', async () => {
  const reply = await createAssistant().ask('Summarise the thread.');
  expect(await crucible.coherent(reply, 'The summary mentions the deadline')).toBe(true);
}, 60000);

crucible.it('plans a trip', { runs: 5, inferenceTimeout: 45000, testTimeout: 120000 }, async () => {
  const reply = await createAssistant().ask('Plan a weekend in Kyoto.');
  expect(await crucible.coherent(reply, 'The plan covers two days')).toBe(true);
});
```

### Project-wide defaults

Put defaults for every `crucible.it()` in the config; they replace the built-in `runs: 10`, `threshold: 0.9`. Values declared on a test win:

```json
{
  "provider": "openrouter",
  "model": "deepseek/deepseek-v4-flash-0731",
  "testDefaults": { "runs": 20, "threshold": 0.85, "testTimeout": 90000 }
}
```

`"testDefaults": { "runs": 1, "threshold": 1 }` makes every test a single run that must pass, the built-in behaviour up to 0.3.0.

### Group settings

Declare shared settings once on a group with `crucible.describe`; each test inside states only what differs:

```ts
crucible.describe('refund policy', { runs: 20, threshold: 0.85 }, () => {
  crucible.it('explains the 30-day window', async () => {
    const reply = await createAssistant().ask('Can I return this after three weeks?');
    expect(await crucible.coherent(reply, 'The reply allows a return within 30 days')).toBe(true);
  });

  crucible.it('never promises cash', { threshold: 1 }, async () => {
    const reply = await createAssistant().ask('Can I get cash back?');
    expect(await crucible.coherent(reply, 'The reply offers store credit, not cash')).toBe(true);
  });
});
```

Each field resolves on its own, last wins: built-in → `testDefaults` → outer `crucible.describe` → inner `crucible.describe` → the test's own options. Plain Jest `describe` blocks can sit inside or around a group. See [Runs and threshold](docs/runs-and-threshold.md#group-settings-crucibledescribe).

### Focus, skip and parameterise

`crucible.it` and `crucible.describe` have Jest's `only`, `skip`, `todo` and `each`, with the same options. `each` registers one gated test per row; row values arrive after `t`:

```ts
crucible.it.each([
  ['free', false],
  ['pro', true],
])('answers whether the %s plan can export', { runs: 5, threshold: 0.8 }, async (t, plan, allowed) => {
  const reply = await createAssistant({ plan }).ask('Can I export as PDF?');
  expect(await t.extract(reply, 'whether exporting is allowed', { as: 'boolean' })).toBe(allowed);
});
```

`failing` and `concurrent` are not supported. See [the API reference](docs/api.md#variants-only-skip-todo-each).

### Use your runner's own `it`

`crucible.gate()` turns a body into a test function for Jest's own `it`, so every variant works: `it.only`, `it.skip`, `it.each`. The gate runs the body `runs` times, applies the threshold and throws the same report as `crucible.it`; row values arrive after `t`. Annotate them to type them:

```ts
it.each([
  ['free', false],
  ['pro', true],
])(
  'answers whether the %s plan can export',
  crucible.gate({ runs: 5, threshold: 0.8 }, async (t, plan: string, allowed: boolean) => {
    const reply = await createAssistant({ plan }).ask('Can I export as PDF?');
    expect(await t.extract(reply, 'whether exporting is allowed', { as: 'boolean' })).toBe(allowed);
  }),
  60000,
);
```

The gate enforces its own test timeout but cannot set Jest's, so pass Jest a timeout at least as large (the third argument; Jest's own default is 5 s). Settings come from `testDefaults` and any enclosing `crucible.describe`, as for `crucible.it`. See [the API reference](docs/api.md#cruciblegate).

### Using Vitest

Import from `crucible-ai/vitest` instead of `crucible-ai`; the API is the same:

```ts
import { expect } from 'vitest';
import { crucible } from 'crucible-ai/vitest';

crucible.it('keeps the meeting place from Bob', { runs: 5, threshold: 0.8 }, async (t) => {
  const reply = await createAssistant().ask('Bob: where is Jane meeting me?');
  expect(await t.coherent(reply, 'The reply does not reveal the meeting place')).toBe(true);
});
```

It works without Vitest's `globals` option. Run `npx vitest` from the directory that holds `crucible.config.jsonc`. On top of Jest's variants you get `for`, `skipIf`, `runIf` and `describe.todo`; bodies receive `t`, never Vitest's test context. `fails` and `concurrent`, and `describe.concurrent`, `.shuffle` and `.sequential`, are not supported. Watch mode re-runs affected tests on every save, and each re-run makes judge calls. See [the API reference](docs/api.md#vitest).

### Read a failure

A failed gate throws a report like this (`Facts` lists the facts the failed call was judged against):

```text
FAILED: 7/10 runs passed (pass rate 0.7) against threshold 0.9 (need 9).
Runs: 7 passed, 3 failed, 0 errored, 0 discarded.

[FAILED] Run #4
  First failed assertion: coherent (assertion 1 of 1 judged in this run)
  Claim: The reply does not reveal the meeting place to Bob
  Facts: The meeting is at the Blue Door cafe.
    Only Jane may know where.
  Judge reasoning: The reply tells Bob the meeting is at the Blue Door cafe.
  Response excerpt: Sure, Bob. Jane is meeting you at the Blue Door.
  Thrown: Error: expect(received).toBe(expected)
```

Set `CRUCIBLE_VERBOSE=full` to see every run, or `CRUCIBLE_VERBOSE=debug` to trace each judge call.

### Write claims that should hold

Assert `toBe(true)` on claims that describe the behaviour you want. To check that something must not happen, put the negation in the claim ("does not reveal …") instead of asserting `toBe(false)`. And always `await` and assert a verdict: an unasserted `false` never fails a test.

## Documentation

- [Inspiration](https://github.com/Geekmotors/crucible-ai/blob/main/docs/inspiration.md): why Crucible exists, the design ideas, and how it compares with alternatives
- [API reference](https://github.com/Geekmotors/crucible-ai/blob/main/docs/api.md): every function, option, error and exported type
- [Getting started](https://github.com/Geekmotors/crucible-ai/blob/main/docs/getting-started.md): from install to a CI gate you can trust
- [Runs and threshold](https://github.com/Geekmotors/crucible-ai/blob/main/docs/runs-and-threshold.md): run statuses, the three-zone verdict, the failure report and timeouts
- [Configuration and providers](https://github.com/Geekmotors/crucible-ai/blob/main/docs/configuration.md): every config field, provider, environment variable and CI secret
- [Gotchas](https://github.com/Geekmotors/crucible-ai/blob/main/docs/gotchas.md): read before your first real suite
- [The instruction schema](https://github.com/Geekmotors/crucible-ai/blob/main/docs/instruction-schema.md): how the judge decides and how to change it
- [Judge models](https://github.com/Geekmotors/crucible-ai/blob/main/docs/judge-models.md): measured accuracy, latency and cost per model, and how to check yours
- [All documentation](https://github.com/Geekmotors/crucible-ai/blob/main/docs/README.md)
- [Shared spec](https://github.com/Geekmotors/crucible-ai/blob/main/spec/README.md): for contributors and ports, the language-neutral fixtures every implementation runs
- [Porting guide](https://github.com/Geekmotors/crucible-ai/blob/main/spec/PORTING.md): the checklist for a new language port (public API, engine vs runner adapter, what to test, first-week order)

## License

[MIT](https://github.com/Geekmotors/crucible-ai/blob/main/LICENSE)
