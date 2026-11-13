# Crucible

[![npm](https://img.shields.io/npm/v/crucible-ai)](https://www.npmjs.com/package/crucible-ai)
[![ci](https://github.com/jackula83/crucible-ai/actions/workflows/ci.yml/badge.svg?branch=main)](https://github.com/jackula83/crucible-ai/actions/workflows/ci.yml?query=branch%3Amain)
[![license](https://img.shields.io/npm/l/crucible-ai)](https://github.com/jackula83/crucible-ai/blob/main/LICENSE)

Semantic assertions for code that calls LLMs, inside the Jest suite you already have.

Crucible asks an AI judge whether your system's reply means what it should, given the state your system knew at the time. It re-runs the test many times and passes on a pass rate, so a flaky model can't sneak through on one lucky run.

```ts
crucible.it('keeps the meeting place secret', { runs: 10, threshold: 0.9 }, async () => {
  const assistant = createAssistant();
  await assistant.remember(['The meeting is at the Blue Door cafe.', 'Only Jane may know where.']);
  crucible.load(['The meeting is at the Blue Door cafe.', 'Only Jane may know where.']);

  const reply = await assistant.ask('Bob asks: where is the meeting?');

  expect(await crucible.coherent(reply, 'The reply does not reveal the meeting place to Bob')).toBe(true);
});
```

Why this exists, and how it compares with promptfoo, DeepEval and others: [Inspiration](https://github.com/jackula83/crucible-ai/blob/main/docs/inspiration.md).

## Features

- **Semantic assertions:** `crucible.coherent(response, claim)` returns the judge's `true`/`false` verdict, which you assert with plain Jest.
- **State-aware judging:** `crucible.load()` and `crucible.append()` tell the judge what your system knew, so you can test things like "the character can't know this yet".
- **Reliability gates:** `{ runs, threshold }` runs the whole test body concurrently and passes on the pass rate.
- **Readable failures:** the report shows the pass rate, each failed run and the judge's reasoning.
- **Fail fast, spend less:** a fatal provider or config error stops the sibling runs.
- **Any judge model** on [OpenRouter](https://openrouter.ai), chosen in a committed config file.
- ESM and CommonJS builds, bundled TypeScript types, published with npm provenance.

## Requirements

- Node.js 22 or later
- Jest 30 (peer dependency), with the default `injectGlobals: true`
- An OpenRouter API key with credit. Judge calls are paid model calls, typically a fraction of a cent each.

## Installation

```sh
npm install --save-dev crucible-ai
```

## Quick start

**1. Add `crucible.config.json`** to the directory you run Jest from, and commit it:

```json
{
  "provider": "openrouter",
  "model": "deepseek/deepseek-v4-flash-0731",
  "meta": { "reasoning": { "effort": "low" } }
}
```

**2. Set your API key** in the environment. Never put it in the config file.

```sh
export OPENROUTER_API_KEY=...
```

**3. Write a test.** With no options it runs once, like a normal Jest test:

```ts
import { crucible } from 'crucible-ai';
import { createAssistant } from '../src/assistant';

crucible.it('declines to export on the free plan', async () => {
  const assistant = createAssistant({ plan: 'free' });
  crucible.load('Free-plan users cannot export reports.');

  const reply = await assistant.ask('Export my report as PDF.');

  expect(await crucible.coherent(reply, 'The reply declines the export')).toBe(true);
});
```

**4. Run it** with your usual Jest command:

```sh
npx jest
```

## Usage

### Gate on a pass rate

Add `runs` and `threshold` to run the body several times concurrently. The test passes when at least `threshold` of the runs pass:

```ts
crucible.it('stays in character', { runs: 20, threshold: 0.9 }, async () => {
  const reply = await createAssistant().ask('Who are you really?');
  expect(await crucible.coherent(reply, 'The reply stays in the persona of a ship captain')).toBe(true);
});
```

A threshold is a sampled estimate. A system that is truly 95% reliable fails a `{ runs: 20, threshold: 0.95 }` gate about 26% of the time, so leave headroom. [Runs and threshold](https://github.com/jackula83/crucible-ai/blob/main/docs/runs-and-threshold.md) explains how to choose both.

### Give the judge state

Each run starts with empty state. Use `load` while arranging and `append` for facts that arise later. A `coherent()` call judges against the state as it stood when you called it:

```ts
crucible.it('remembers a change of venue', async () => {
  const assistant = createAssistant();
  await assistant.remember(['The meeting is in room B12.']);
  crucible.load('The meeting is in room B12.');

  await assistant.remember(['The meeting moved to room C3.']);
  crucible.append('The meeting moved to room C3.');

  const reply = await assistant.ask('Where is the meeting?');
  expect(await crucible.coherent(reply, 'The reply says the meeting is in room C3')).toBe(true);
});
```

### Set timeouts

By default a whole test gets 30 s plus 1 s per extra run, and each judge request gets 30 s. Override them per test, Jest-style or by name:

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

Put defaults for every `crucible.it()` in the config. Values declared on a test win:

```json
{
  "provider": "openrouter",
  "model": "deepseek/deepseek-v4-flash-0731",
  "testDefaults": { "runs": 10, "threshold": 0.9, "testTimeout": 90000 }
}
```

### Read a failure

A failed gate throws a report like this:

```text
FAILED: 7/10 runs passed (pass rate 0.7) against threshold 0.9 (need 9).
Runs: 7 passed, 3 failed, 0 errored, 0 discarded.

[FAILED] Run #4
  First failed assertion: coherent (assertion 1 of 1 judged in this run)
  Claim: The reply does not reveal the meeting place to Bob
  Judge reasoning: The reply tells Bob the meeting is at the Blue Door cafe.
  Response excerpt: Sure, Bob. Jane is meeting you at the Blue Door.
  Thrown: Error: expect(received).toBe(expected)
```

Set `CRUCIBLE_VERBOSE=full` to see every run, or `CRUCIBLE_VERBOSE=debug` to trace each judge call.

### Write claims that should hold

Assert `toBe(true)` on claims that describe the behaviour you want. To check that something must not happen, put the negation in the claim ("does not reveal …") instead of asserting `toBe(false)`. And always `await` and assert a verdict: an unasserted `false` never fails a test.

## Documentation

- [Inspiration](https://github.com/jackula83/crucible-ai/blob/main/docs/inspiration.md): why Crucible exists, the design ideas, and how it compares with alternatives
- [API reference](https://github.com/jackula83/crucible-ai/blob/main/docs/api.md): every function, option, error and exported type
- [Getting started](https://github.com/jackula83/crucible-ai/blob/main/docs/getting-started.md): from install to a CI gate you can trust
- [Runs and threshold](https://github.com/jackula83/crucible-ai/blob/main/docs/runs-and-threshold.md): run statuses, the three-zone verdict, the failure report and timeouts
- [Configuration and OpenRouter](https://github.com/jackula83/crucible-ai/blob/main/docs/configuration.md): every config field, environment variable and CI secret
- [Gotchas](https://github.com/jackula83/crucible-ai/blob/main/docs/gotchas.md): read before your first real suite
- [The instruction schema](https://github.com/jackula83/crucible-ai/blob/main/docs/instruction-schema.md): how the judge decides and how to change it
- [Judge models](https://github.com/jackula83/crucible-ai/blob/main/docs/judge-models.md): measured accuracy, latency and cost per model
- [All documentation](https://github.com/jackula83/crucible-ai/blob/main/docs/README.md)

## License

[MIT](https://github.com/jackula83/crucible-ai/blob/main/LICENSE)
