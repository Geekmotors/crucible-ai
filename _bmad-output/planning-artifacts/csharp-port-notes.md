# C# port: positioning and integration notes

Captured 2026-11-14 from Jack, for when the C# port starts (after Epic 6 and Vitest). Re-check every claim against current Microsoft docs at that time; the evaluation library was still described as preview.

## The incumbent

`Microsoft.Extensions.AI.Evaluation` evaluates AI apps from MSTest, xUnit or NUnit (Test Explorer, `dotnet test`, CI). It is built on the `Microsoft.Extensions.AI` abstractions, ships quality evaluators (relevance, truthfulness, completeness, fluency, coherence, equivalence, groundedness), supports custom evaluators through `IEvaluator`, and has a `dotnet aieval` tool for reports.

It scores response quality. It has no repeated-run reliability gate and no world-state input, so position Crucible for .NET as **complementary, not competing**.

## Integration decisions to make

- **Accept `IChatClient`** for both the system under test and the judge. Microsoft Agent Framework (MAF) users already have one, so adoption is one line. The judge provider config (OpenRouter / OpenAI / OpenAI-compatible) becomes one option among others.
- **Consider implementing `IEvaluator`**, so Crucible's assertions feed Microsoft's reporting (`dotnet aieval`) instead of competing with it.
- **Response caching defeats repeated sampling.** The evaluation reporting stack can serve cached responses when prompt and model are unchanged, and an app may wrap its `IChatClient` in a caching client. Either way, 20 runs could return 20 identical answers and silently turn the pass-rate gate into one sample. Decide whether the integration disables or detects caching automatically; at minimum the docs must say to turn it off for Crucible tests. Distinguish the two cases: caching on the system under test breaks the gate; caching on the judge is safer but still hides judge variance.

## Shape already sketched

`docs/inspiration.md` ("Beyond TypeScript") has the xUnit sketch: `[CrucibleFact(Runs = 20, Threshold = 0.95)]` with `Crucible.Load` / `Crucible.Coherent`. Update it to the post-Epic-6 API (defaults, describe-level settings, lenient/strict extract) before porting.
