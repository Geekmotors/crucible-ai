# Why Crucible exists

## The problem

While working on one of my AI side projects, a storytelling app I call Proscenium, I had trouble testing its inference.

The testing tools we use every day, such as Jest, xUnit and JUnit, are deterministic. You call a function, you get the same answer every time, and you assert on it. Inference doesn't work like that. The same input can produce a different reply on every call, and "correct" is a question of meaning, not of exact text.

Proscenium keeps a world log of events and uses a memory-management technique to prevent omniscience: characters must only act on what they could actually know. Omniscience is the number one killer of long-form storytelling. A character who knows where someone is hiding, without ever having been told, breaks the story. Proving that this doesn't happen is exactly the kind of test deterministic tools can't express.

## The aim

I wanted a test that reads like any other unit test, in the suite I already have, against my own engine running in-process:

```ts
crucible.it("Jane looks for Bob", { runs: 20, threshold: 0.95 }, async () => {
  // arrange
  const story = await sut.createNewStory("The Long Weekend");
  await sut.memory("Bob is at the casino");
  await sut.memory("Jane is at home");
  crucible.load(story.getLogs());

  // act
  const response = await sut.input("Jane looks for Bob");

  // assert
  expect(
    await crucible.coherent(
      response,
      "Jane won't find Bob, because they aren't in the same place"
    )
  ).toBe(true);
});
```

Three ideas shape it:

- **State is a first-class input.** Whether a reply is right depends on what the system knew at the time. `crucible.load()` and `crucible.append()` hand that ground truth to the judge, so "Jane can't know where Bob is" is something a test can check.
- **Reliability is a gate, not a lucky run.** `crucible.it()` re-runs the whole body (arrange, act, assert) many times in parallel and passes only when the pass rate reaches the threshold. That is a pass^k-style measure you can put in CI. A threshold is a sampled estimate, so read [Runs and threshold](runs-and-threshold.md) before picking numbers.
- **Assertions stay native.** The judge returns a value, and you assert it with plain Jest (`toBe(true)`). When a run fails, Crucible prints the judge's reasoning.

## Beyond TypeScript

v1 is TypeScript and Jest. The same shape ports to each ecosystem's idiomatic test framework, and the judge's instruction schema is language-agnostic by design: a container with only `curl` and `jq` already drives it correctly ([instruction schema](instruction-schema.md)). These sketches are the roadmap, not shipped code:

<details>
<summary><b>C# (xUnit)</b></summary>

```csharp
[CrucibleFact(Runs = 20, Threshold = 0.95)]
public async Task JaneLooksForBob()
{
    // arrange
    var story = await sut.CreateNewStory("The Long Weekend");
    await sut.Memory("Bob is at the casino");
    await sut.Memory("Jane is at home");
    Crucible.Load(story.GetLogs());

    // act
    var response = await sut.Input("Jane looks for Bob");

    // assert
    Assert.True(await Crucible.Coherent(
        response,
        "Jane won't find Bob, because they aren't in the same place"));
}
```

</details>

<details>
<summary><b>Java (JUnit 5)</b></summary>

```java
@CrucibleTest(runs = 20, threshold = 0.95)
void janeLooksForBob() throws Exception {
    // arrange
    var story = sut.createNewStory("The Long Weekend");
    sut.memory("Bob is at the casino");
    sut.memory("Jane is at home");
    Crucible.load(story.getLogs());

    // act
    var response = sut.input("Jane looks for Bob");

    // assert
    assertTrue(Crucible.coherent(
        response,
        "Jane won't find Bob, because they aren't in the same place"));
}
```

</details>

<details>
<summary><b>Python (pytest)</b></summary>

```python
@crucible.it(runs=20, threshold=0.95)
async def test_jane_looks_for_bob():
    # arrange
    story = await sut.create_new_story("The Long Weekend")
    await sut.memory("Bob is at the casino")
    await sut.memory("Jane is at home")
    crucible.load(story.get_logs())

    # act
    response = await sut.input("Jane looks for Bob")

    # assert
    assert await crucible.coherent(
        response, "Jane won't find Bob, because they aren't in the same place"
    )
```

</details>

## Does the judge actually work?

The `coherent` instruction schema — the language-agnostic core that judge
models execute — was validated against real judge models over OpenRouter
(4-case conformance matrix × 5 repetitions per model; schema as system
prompt; details in [docs/judge-models.md](judge-models.md)):

| Model | JSON compliance | Verdict accuracy | Median latency | Cost / call | Speed | Cost | Reliability |
| --- | --- | --- | --- | --- | --- | --- | --- |
| `deepseek/deepseek-v4-flash-0731` | 20/20 | 20/20 | 4.8 s | ~$0.00004 | 3/5 | 5/5 | 5/5 |
| `google/gemini-3.8-flash` | 20/20 | 20/20 | 3.2 s | ~$0.0014 | 4/5 | 4/5 | 5/5 |
| `anthropic/claude-sonnet-5` | 20/20 | 20/20 | 2.4 s | ~$0.0025 | 5/5 | 3/5 | 5/5 |

Every model held the strict-JSON output contract for all 60 calls and
returned the correct verdict on every case, including the knowledge-boundary
(anti-omniscience) leak. Recommended default judge:
`deepseek/deepseek-v4-flash-0731` — equal accuracy at a fraction of the
cost, which dominates once multi-run reliability gates multiply call volume.
Reliability was graded by comparing each model's verdicts and reasoning
against a frontier model's independent interpretation of the same cases.

For trust and transparency, the verbatim inputs and unedited model replies
from these runs are published in
[docs/judge-validation-runs.md](judge-validation-runs.md) — see for
yourself that the concept works.

## How it differs from what already exists

**[promptfoo](https://www.promptfoo.dev)** is the closest neighbour and the difference is philosophical. Promptfoo is config-first: the test suite is a YAML file, the CLI is the primary surface, and the unit of work is an eval run across a matrix of prompts and providers. Crucible is code-first: the test is a function in an existing test suite, the system under test is the developer's own engine instantiated in-process, and the unit of work is a single assertion inside a red-green loop.

The practical consequence is state. Promptfoo's model is prompt in, output out, assert on the output. State can be passed through template variables and a custom rubric prompt, and people do, but it is a workaround rather than a concept the framework has. Crucible treats state as a first-class input because that is the only way to express whether a character *should* know something.

Worth noting that promptfoo was acquired by OpenAI in March 2026 and is being integrated into their Frontier platform. It remains open source and the team committed to continuity. Its roadmap is enterprise security and red teaming, which is a real need and not this one.

**[DeepEval](https://deepeval.com)** has the strongest metric library going, and G-Eval is a genuinely good primitive. It shipped a TypeScript SDK in July 2026, so the old "Python-only" complaint is out of date. Parity is another matter: LLM-as-a-judge metrics and fully local evaluation still live in the Python package, and the team is refreshingly direct that TypeScript follows Python rather than standing alongside it. That is a reasonable call for them and a bad fit for anyone whose production system is not Python.

**[vitest-evals](https://github.com/getsentry/vitest-evals)** (Sentry) and **[evalite](https://github.com/mattpocock/evalite)** are the closest ergonomic neighbours in TypeScript: evals that live in or next to the unit-test workflow, local-first and free. Both score a stateless input/output pair against a dataset or scorer; neither has a concept of state as an assertion input, nor of a reliability threshold across repeated runs.

**[semantic-expect](https://github.com/agorischek/semantic-expect)** deserves a nod as prior art: LLM-judged matchers for Jest/Vitest with an N-run, pass-count configuration — the same probabilistic-assertion instinct. It is early, stateless, and tied to OpenAI.

**[Braintrust](https://www.braintrust.dev)** and **[LangSmith](https://docs.langchain.com/langsmith)** are platform plays — datasets, experiments, traces, and dashboards, with test-runner integrations attached. Good fits for teams that want a hosted eval loop; Crucible is a library for teams that want assertions in a test suite.
