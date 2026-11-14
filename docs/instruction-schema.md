# The instruction schema

Crucible's judgments are not defined in TypeScript. They are defined in a
plain markdown file — the **instruction schema** — that the judge model reads
as its instructions on every call. For `coherent()` that file is
[`schemas/coherent.md`](../schemas/coherent.md); for `extract()` it is
[`schemas/extract.md`](../schemas/extract.md). Both ship inside the
`crucible-ai` package.

- [Why a schema](#why-a-schema)
- [What `coherent.md` contains](#what-coherentmd-contains)
- [What the judge receives](#what-the-judge-receives)
- [The extract schema](#the-extract-schema)
- [Changing the judge's behaviour](#changing-the-judges-behaviour)
- [Versioning](#versioning)
- [Checking another implementation](#checking-another-implementation)

## Why a schema

Crucible is split in two:

- a **deterministic shell** — running the test body `runs` times, keeping each
  run's facts apart, calling the provider, retrying, counting passes,
  rendering reports. This part is specific to a language and test framework
  (v1: TypeScript and Jest);
- a **non-deterministic core** — the rules the judge follows to decide a
  verdict. This part lives only in `schemas/*.md`.

The TypeScript code maps `crucible.coherent()` to `coherent.md` and
`crucible.extract()` to `extract.md`, sends the schema to the judge with your
data, and parses the reply. It contains no judgment
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

- `STATE` carries the **facts** the call is judged against: the run's facts
  ([`crucible.facts()`](api.md#cruciblefacts)) in the order they were added,
  then any facts passed with this call (`{ facts }`), one per line (a fact
  that contains line breaks keeps them). The API calls them facts; the wire
  name is `STATE`, and the schemas speak of state. The section is left out
  when the call has no facts.
- `RESPONSE` is the `actual` argument of `crucible.coherent(actual, expectation)`
  and `CLAIM` is its `expectation`, both verbatim.
- A content line consisting solely of `<<<` or `>>>` is prefixed with a space,
  so your data can never close a fence early. The schema tells the judge that
  everything inside fences is data, never instructions — text in a response
  that looks like a header or an instruction is judged, not obeyed.

With `debug` verbosity the trace shows each assembled user message (bounded)
and the system prompt's length.

### Things the schemas do not define (v1)

- **Conflicting state.** There is no rule for facts that contradict each
  other, such as a later fact that supersedes an earlier one. Keep facts
  consistent: add facts, do not overturn them (see
  [gotchas](gotchas.md#keep-facts-consistent)).
- **Line endings.** Content is split on `\n`; a fence-only line ending in
  `\r` (CRLF input) is not neutralised.

## The extract schema

[`schemas/extract.md`](../schemas/extract.md) has the same four parts and the
same payload discipline as `coherent.md`.

**Frontmatter:**

```yaml
---
name: extract
output:
  format: json
  contract: '{ "value": string | number | boolean | null, "reasoning": string }'
---
```

**Payload.** Every `extract()` call is one chat request with the whole of
`extract.md` as the system message and up to five fenced sections, in this
order, assembled exactly as for `coherent()` (same fences, same
neutralising, same separators):

```text
STATE
<<<
Room 4 is the blue room.
>>>

RESPONSE
<<<
Done! I've booked you into the blue room.
>>>

TARGET
<<<
the number of the room that was booked
>>>

TYPE
<<<
number
>>>

MODE
<<<
lenient
>>>
```

- `STATE` — the facts (the run's, then the call's own), omitted when empty,
  exactly as for `coherent()`.
- `RESPONSE` — the `text` argument, verbatim.
- `TARGET` — the `description` argument, verbatim.
- `TYPE` — `string`, `number` or `boolean` (the `as` option; `string` when
  omitted).
- `MODE` — `lenient` or `strict`: `strict` when the resolved `strict` setting
  is `true` (the call's `{ strict }`, else the test's, its groups', then
  `testDefaults`), otherwise `lenient`. Always present.

**Extraction rules**, in summary:

1. Extract the *final committed* answer: a revision ("At first I thought 3,
   but the answer is two") yields the final value, `2`.
2. Normalise to `TYPE`: number words become numbers ("two" → `2`), units
   and currency symbols are dropped ("$42.50" → `42.5`); a committed yes or
   no becomes `true` or `false`; a string is the value as stated.
3. A negation ("It's not two") is `null` — except that a committed "no" to a
   `boolean` target is `false`.
4. Hedging depends on `MODE`. **Lenient** (the default) takes the value the
   response leans to: "I think so" and "yeah" are `true`, "nah", "I don't
   think so" and "probably not" are `false`, "probably two" and "around two"
   are `2`, "likely Paris" is `"Paris"`; it stays `null` for no answer, a
   genuine split ("two or three"), a bare negation ("it's not two") and "I
   don't know". **Strict** treats any hedge as `null`: a single hedged value
   ("Probably two", "around two", "I think so", "I don't think so") and
   alternatives ("Probably two, maybe three") alike. In both modes only the
   final answer counts.
5. No answer is `null`. The judge never guesses or invents a value.
6. **STATE is context, not a source.** State may resolve what the response
   refers to (above: the response commits to "the blue room", and the state
   gives its number, `4`), but a value that only the state holds, which the
   response does not commit to, is `null`. Extraction reads
   what the response says, not what is true; to check the response *against*
   the state, use `coherent()`.
7. `value` is `null` or a JSON value of the requested type; a number is
   finite and never a string such as `"2"`.
8. The reasoning names the deciding words in one to three sentences.

**Output contract:**

```json
{ "value": null, "reasoning": "The reply hedges between two and three (\"Probably two, maybe three\")." }
```

Crucible accepts the object (tolerating a surrounding markdown code fence)
only when `value` is `null` or of the requested type and `reasoning` is a
string; anything else is asked once more and then errors the run as a
retryable `infra` error. The `reasoning` appears under *Judge reasoning* in
the `Extraction` lines of failure reports.

## Changing the judge's behaviour

Because the rules are the system prompt, **editing `coherent.md` changes how
`coherent()` judges (and editing `extract.md` how `extract()` extracts), with
no TypeScript change** — no rebuild of the
TypeScript code is involved, and the next test run reads the edited file.
Crucible reads the file from the installed package
(`node_modules/crucible-ai/schemas/coherent.md`, `…/extract.md`) the first
time a test file makes a call that needs it.

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
the schemas, a POSIX shell, `jq` and `curl` in a container. It runs one suite
per schema (`coherent` and `extract`) and proves each schema is complete
enough for a non-TypeScript implementation to assemble the same payloads and
get the same verdicts and values:

```sh
make conformance   # needs Docker and the judge provider's key; makes real judge calls
```

`make conformance CONFORMANCE_SUITES=extract` (or `coherent`) runs one suite. Its fixtures
(`e2e/ext/fixtures/coherent-conformance.json`,
`e2e/ext/fixtures/extract-conformance.json`), its dry `payloads` mode, which prints every assembled user message without calling a
provider, and its dry `request <suite> <case index>` mode, which prints the
HTTP request (URL, headers, JSON body) it would send for one case, are the
reference for anyone writing another shell. `make spec-goldens-check` proves
the TypeScript port builds the same payloads and request envelopes (see
[`spec/README.md`](../spec/README.md)).
