# Crucible documentation

Start with **Getting started**; it links to everything else as you need it.

| Page | Read it when |
| --- | --- |
| [Inspiration](inspiration.md) | You want to know why Crucible exists, the ideas behind it, the multi-language roadmap, the judge validation results, or how it compares with promptfoo, DeepEval and others. |
| [Getting started](getting-started.md) | You are new: install → config → API key → first test (a 10-run gate by default) → tuning the gate → reading a failure → verbosity. Also teaches which assertion to use when. |
| [Runs and threshold](runs-and-threshold.md) | You are choosing `runs`/`threshold`, or need the `crucible.it()` reference: group settings (`crucible.describe`), run statuses, the three-zone verdict, the failure report, verbosity, the deadline, re-entrancy, cost. |
| [Configuration and providers](configuration.md) | You need to create the config (`npx crucible init`), a config field, the JSON Schema and editor hints, a validation rule or error kind, the environment variables, a provider set up (OpenRouter, OpenAI, Azure OpenAI, LiteLLM, Ollama), how provider failures are handled, judge-model advice, or CI-secret setup. |
| [API reference](api.md) | You need the exact behaviour of `crucible.it`, `describe`, `coherent`, `extract`, `load`, `append`, or the error classes. |
| [Gotchas](gotchas.md) | Something behaves unexpectedly — or before you write your first real suite. |
| [The instruction schema](instruction-schema.md) | You want to know how the judge decides or extracts, what it is sent, or how to change its behaviour. |
| [Judge models](judge-models.md) | You are choosing a judge model or provider; measured accuracy, latency, cost and reasoning-effort findings, and how to check your own model with the conformance harness. |
| [Judge validation runs](judge-validation-runs.md) | You want the verbatim inputs and model replies behind the judge validation. |
