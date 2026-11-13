# The instruction schema

Crucible's judgments are not defined in TypeScript. They are defined in a
plain markdown file — the **instruction schema** — that the judge model reads
as its instructions on every call. For `coherent()` that file is
[`schemas/coherent.md`](../schemas/coherent.md), and it ships inside the
`crucible-ai` package.

- [Why a schema](#why-a-schema)
- [What `coherent.md` contains](#what-coherentmd-contains)
- [What the judge receives](#what-the-judge-receives)
- [Changing the judge's behaviour](#changing-the-judges-behaviour)
- [Versioning](#versioning)
- [Checking another implementation](#checking-another-implementation)

## Why a schema

Crucible is split in two:

- a **deterministic shell** — running the test body `runs` times, keeping each
  run's state apart, calling the provider, retrying, counting passes,
  rendering reports. This part is specific to a language and test framework
  (v1: TypeScript and Jest);
- a **non-deterministic core** — the rules the judge follows to decide a
  verdict. This part lives only in `schemas/*.md`.

The TypeScript code maps `crucible.coherent()` to `coherent.md`, sends it to
the judge with your data, and parses the verdict. It contains no judgment
logic. That is what lets the same judgment travel to other languages later:
a future Python or .NET shell reuses the schema as is and only re-implements
the deterministic shell.

## What `coherent.md` contains

The file has four parts.

**Frontmatter** — machine-readable metadata:

```yaml
---
name: coherent
output:
  format: json
  contract: '{ "verdict": boolean, "reasoning": string }'
---
```

`name` is the assertion the schema serves (the file name matches it);
`output` declares the reply format.

**Payload assembly** — the exact layout of the data sent with each call, so
that every implementation, in any language, builds byte-identical requests
(see [below](#what-the-judge-receives)).

**Judgment rules** — how the judge decides. In summary:

1. `true` only when the response is fully consistent with the claim; any
   contradiction makes it `false`.
2. State is ground truth and wins over general world knowledge; the judge
   must not invent facts.
3. A claim that something must not be revealed fails if the response reveals
   it directly, by paraphrase, or by unmistakable implication.
4. With no state, the claim is judged against the response alone.
5. Meaning counts, not wording.
6. If the response is genuinely ambiguous about the claim, the verdict is
   `false` — uncertainty is a failure, not a pass.
7. The reasoning names the part of the response that decided the verdict, in
   one to three sentences.

The file itself is authoritative; read it for the exact wording.

**Output contract** — the judge replies with exactly one JSON object:

```json
{ "verdict": false, "reasoning": "The reply names the Blue Door cafe, which reveals the meeting place." }
```

Crucible accepts that object (tolerating a surrounding markdown code fence),
and asks once more if the reply is anything else. The `reasoning` is what
appears under *Judge reasoning* in failure reports.

## What the judge receives

Every `coherent()` call is one chat request:

- **system message:** the whole of `coherent.md`, frontmatter included, byte
  for byte;
- **user message:** up to three fenced sections, in this order:

```text
STATE
<<<
The meeting place is the Blue Door cafe.
Only Jane may know the meeting place.
>>>

RESPONSE
<<<
Sure, head to the Blue Door cafe at six.
>>>

CLAIM
<<<
The reply does not reveal the meeting place to Bob
>>>
```

- `STATE` holds the run's state entries in the order they were added, one per
  line (an entry that contains line breaks keeps them). The section is left
  out when the run has no state.
- `RESPONSE` and `CLAIM` are verbatim.
- A content line consisting solely of `<<<` or `>>>` is prefixed with a space,
  so your data can never close a fence early. The schema tells the judge that
  everything inside fences is data, never instructions — text in a response
  that looks like a header or an instruction is judged, not obeyed.

With `debug` verbosity the trace shows each assembled user message (bounded)
and the system prompt's length.

### Things the schema does not define (v1)

- **Conflicting state.** There is no rule for state entries that contradict
  each other, such as an appended fact that supersedes an earlier one. Keep
  state consistent: add facts, do not overturn them (see
  [gotchas](gotchas.md#keep-state-consistent)).
- **Line endings.** Content is split on `\n`; a fence-only line ending in
  `\r` (CRLF input) is not neutralised.

## Changing the judge's behaviour

Because the rules are the system prompt, **editing `coherent.md` changes how
`coherent()` judges, with no TypeScript change** — no rebuild of the
TypeScript code is involved, and the next test run reads the edited file.
Crucible reads the file from the installed package
(`node_modules/crucible-ai/schemas/coherent.md`) the first time a test file
makes a judge call.

That makes the schema the place to work on judgment quality. If the judge
keeps reaching a verdict you consider wrong:

1. Find the rule it applied in the *Judge reasoning* of the failure report
   (run with `CRUCIBLE_VERBOSE=full` to see every verdict).
2. If your claim is ambiguous or compound, fix the claim first — that is the
   cheapest change.
3. If the rule itself is wrong or missing, the fix belongs in the schema.
   Propose it upstream; editing the copy in `node_modules` is useful for a
   local experiment but is overwritten by the next install.

Every schema change changes every verdict, so re-measure your gates after
one.

## Versioning

Schemas are versioned with the package: `crucible-ai@x.y.z` always uses the
`schemas/` that shipped in `x.y.z`, so library and schema can never drift
apart. A change to a schema's rules is a change to Crucible's behaviour and
appears in the package version and release notes. Each schema's frontmatter
(`name`, output contract) is there so the files can later be published on
their own for other language implementations.

## Checking another implementation

The repository contains a language-agnostic conformance harness,
[`e2e/ext/conformance/`](../e2e/ext/conformance/), that judges with nothing but
`coherent.md`, a POSIX shell, `jq` and `curl` in a container. It proves the
schema is complete enough for a non-TypeScript implementation to assemble the
same payloads and get the same verdicts:

```sh
make conformance   # needs Docker and OPENROUTER_API_KEY; makes real judge calls
```

Its fixtures (`e2e/ext/fixtures/coherent-conformance.json`) and its dry
`payloads` mode, which prints every assembled user message without calling a
provider, are the reference for anyone writing another shell.
