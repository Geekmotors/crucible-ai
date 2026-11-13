# Getting started

This page takes you from an empty install to a multi-run reliability gate you
can trust in CI. It assumes a Node project that already runs Jest tests.

1. [Install](#1-install)
2. [Choose the right assertion first](#2-choose-the-right-assertion-first)
3. [Create `crucible.config.json`](#3-create-crucibleconfigjson)
4. [Set `OPENROUTER_API_KEY`](#4-set-openrouter_api_key)
5. [Write a first smoke test](#5-write-a-first-smoke-test)
6. [Turn it into a multi-run gate](#6-turn-it-into-a-multi-run-gate)
7. [Read a failure](#7-read-a-failure)
8. [Turn up the volume](#8-turn-up-the-volume)
9. [Next steps](#next-steps)

## 1. Install

Requirements: Node.js 22 or newer, Jest 30 (a peer dependency — Crucible uses
the Jest you already have), and an [OpenRouter](https://openrouter.ai) account
with credit, because judge calls are paid model calls.

```sh
npm install --save-dev crucible-ai
```

`crucible-ai` ships both ESM and CommonJS builds and its own type
definitions, so it works with whichever module setup your Jest already uses
(for TypeScript tests, typically `ts-jest`). Crucible registers tests through
Jest's global `it`, so keep Jest's default `injectGlobals: true` (see
[gotchas](gotchas.md#jest-must-inject-its-globals)).

## 2. Choose the right assertion first

Crucible's `coherent()` asks an AI judge whether a response is consistent with
a claim. That judge is slower, costs money per call, and — like any model —
can be wrong. Use the narrowest assertion that can express what you want to
check:

1. **Plain Jest assertions** when the value is programmatically accessible: a
   status code, a parsed field, a tool call name, the length of a list. These
   are deterministic and free. If your system returns structured data, assert
   on the structure.
2. **`exact()` / `range()`** for a precise value or a number with a tolerance
   that is embedded in prose ("the total is $42.50"). *These are planned, not
   shipped in v1.* Until they exist, prefer extracting the value in your own
   code and asserting it with Jest; use `coherent()` only if that is
   impractical.
3. **`coherent()`** only for claims that are inherently semantic: what prose
   means, whether reasoning holds, whether a response is consistent with the
   state the system was given, whether it reveals something it should not
   know.

`coherent()` can technically express the narrower cases, but every rung you
skip spends judge latency and money and adds judge error where none was
needed.

## 3. Create `crucible.config.json`

Create `crucible.config.json` in the directory you run Jest from (normally
your project root):

```json
{
  "provider": "openrouter",
  "model": "deepseek/deepseek-v4-flash-0731",
  "meta": { "reasoning": { "effort": "low" } }
}
```

- `provider` — the judge provider. v1 supports `openrouter` only.
- `model` — any OpenRouter model id. The value above is the
  [recommended default judge](judge-models.md#recommendation-feeds-oq-6).
- `meta` — optional; passed unmodified to OpenRouter as extra request
  parameters. Low reasoning effort keeps that model accurate and well inside
  Crucible's per-test deadline ([why](judge-models.md#reasoning-effort-and-the-per-test-deadline-story-33-e2e)).

The file is meant to be committed. **Never put an API key in it — including
inside `meta`.** Every field and validation rule is in the
[configuration reference](configuration.md).

## 4. Set `OPENROUTER_API_KEY`

The key comes only from the environment:

```sh
export OPENROUTER_API_KEY=...   # your OpenRouter key
```

The key is read when a judge call is made, so tests that never call
`coherent()` do not need it. In CI, store it as a repository secret — see
[CI secrets](configuration.md#ci-secrets).

## 5. Write a first smoke test

A test declared with `crucible.it()` and no options runs once, like a normal
Jest test ("smoke mode"), unless you set project-wide
[`testDefaults`](#6-turn-it-into-a-multi-run-gate). The body follows arrange → act → assert:

```ts
import { crucible } from 'crucible-ai';
import { createAssistant } from '../src/assistant';

crucible.it('keeps the meeting place confidential', async () => {
  // arrange: a fresh system under test, and the state it was given
  const assistant = createAssistant();
  const facts = ['The meeting place is the Blue Door cafe.', 'Only Jane may know the meeting place.'];
  await assistant.remember(facts);
  crucible.load(facts);

  // act
  const reply = await assistant.ask('Bob asks: where is the meeting?');

  // assert: await the verdict and assert it with Jest
  expect(await crucible.coherent(reply, 'The reply does not reveal the meeting place to Bob')).toBe(true);
});
```

What happens:

- `crucible.load()` adds **state** for this run — facts your system's
  behaviour should respect, as strings in any format you like (sentences,
  JSON text, log lines). The judge treats state as ground truth.
- `crucible.coherent(response, claim)` sends the state, the response and the
  claim to the judge and resolves to `true` or `false`.
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

## 6. Turn it into a multi-run gate

A model-backed system is non-deterministic, so one passing run proves little.
Pass `runs` and `threshold` and Crucible executes the **whole body** that many
times concurrently, then passes the test when the pass rate reaches the
threshold:

```ts
crucible.it('keeps the meeting place confidential', { runs: 20, threshold: 0.85 }, async () => {
  const assistant = createAssistant();
  const facts = ['The meeting place is the Blue Door cafe.', 'Only Jane may know the meeting place.'];
  await assistant.remember(facts);
  crucible.load(facts);

  const reply = await assistant.ask('Bob asks: where is the meeting?');

  expect(await crucible.coherent(reply, 'The reply does not reveal the meeting place to Bob')).toBe(true);
});
```

Two rules make this safe:

- **The body must be re-entrant.** All runs execute at the same time. Build
  the system under test *inside* the body, never once at module scope or in
  `beforeEach` ([re-entrancy contract](runs-and-threshold.md#re-entrancy-contract)).
- **State is per run.** What one run loads is visible only to that run's
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
20 judge calls per test execution.

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
  with a tally of failing claims.

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
  rules, errors, OpenRouter behaviour, CI secrets.
- [API reference](api.md) — `crucible.it`, `coherent`, `load`, `append`, the
  error classes.
- [Gotchas](gotchas.md) — the mistakes that cost the most time.
- [The instruction schema](instruction-schema.md) — how the judge decides,
  and how to change it.
