---
baseline_commit: a67cbe5
---

# Story 8.3: Parsing and provider rules

Status: done

## Story

As a maintainer porting Crucible,
I want config parsing, provider envelopes and retry classification as fixtures,
so that ports read the same files and treat provider failures identically.

## Acceptance Criteria

1. **JSONC area.** `spec/jsonc/parse.json` (operation `jsonc/parse`): `{ "text" }` → the parsed value, or error kind `config`. Cases cover line and block comments (leading, trailing, own line, spanning lines, at end of text), comments ending at CR / CRLF / LF, trailing commas (object, array, nested, before comments) and the commas that stay errors (`[,]`, `{,}`, `[1,,]`, after the root value), comment markers and commas/brackets inside strings, escaped quotes and backslashes, a leading BOM (and a BOM elsewhere), CRLF / CR line endings, unterminated string / block comment, `1/**/0` (a comment separates tokens), nested block comments, non-JSON white space, empty / comment-only text, top-level scalars, and duplicate keys (last wins).
2. **Config area.** `spec/config/load.json` (operation `config/load`): `{ "files": { "crucible.config.json"?, "crucible.config.jsonc"? }, "env"? }` → resolved config value `{ provider, model, meta?, verbosity, testDefaults, excerptChars }` or error kind. A file is its text or `{ "$special": "unreadable" }` (documented extension of `$special`). Cases cover: either file name, both files, no file, unreadable file (alone or beside a good one), JSONC in either file, root not an object, `$schema` ignored (any value), unknown fields, key-like fields (every name, any casing), every field rule (`provider`, `model`, `meta`, `verbosity` + `CRUCIBLE_VERBOSE` override incl. empty override and usage kind, `testDefaults` wiring, `excerptChars`), every per-provider setting rule (`baseUrl`: unsupported for `openrouter`/`openai`, required and validated for `openai-compatible`; `apiKeyEnv` name rule for all three), and rule precedence where the kind differs. "Never echoed" is an outcome: `expect.error.mustNotContain` (new, optional, documented in schema and README) lists strings the error must not reveal; cases cover pasted keys in `apiKeyEnv`, key-like fields, credentials in `baseUrl` and a malformed file holding a key.
3. **Provider area.**
   - `provider/request`: `{ config, env, system, prompt }` → the HTTP request `{ method, url, headers, body }` (headers the port sets: `Authorization` present/absent with a sentinel key, `Content-Type`; body as parsed JSON) or error kind. Cases: each provider's URL, `baseUrl` normalisation and joining (trailing slashes, case, default port, root URL), key env default / `apiKeyEnv` / provider-native names ignored, key trimming, missing / blank key (required vs optional), malformed key characters (config, never echoed), model passed verbatim, `meta` pass-through (nested, empty, cannot override `model` / `messages`).
   - `provider/response`: `{ responses: [...] }` (HTTP status + JSON or text body, or a network failure, one per attempt) → the judge reply text or error kind with `retryable`. Cases: success envelopes (whitespace kept, empty content, extra fields, non-200 2xx), malformed envelopes, unparseable bodies, embedded `error` (numeric code fatal/retryable, without code), every status class (408, 429, other 4xx fatal; 5xx, 3xx retryable), network failure, retry then success, three attempts exhausted, fatal after a retry.
   - `provider/plain-http-warning`: `{ baseUrl, keySent }` → whether the plain-http key warning is written (loopback names / addresses, look-alikes, https, no key).
4. **Judge area.** `spec/judge/reply.json` (operation `judge/reply`): `{ ask: "coherent" | "extract", type?, replies: [...] }` → `{ verdict, reasoning }` / `{ value, reasoning }` or `infra` retryable. Cases: strict JSON, white space, code fences (with / without language tag, upper case, unclosed, tag with a digit or a space), prose around JSON, wrong types, missing keys, extra keys, null value for every type, non-finite numbers, duplicate keys, the re-ask-once rule (bad then good → value; two bad → error).
5. **Envelope parity with the jq harness.** The 8.2 golden mechanism grows to request envelopes: `conformance.sh` gains a `request <suite> <index>` mode printing the request it would send (URL, headers, body from its own `chat_request`); the golden script writes `spec/provider/request-conformance.json` from it for representative judge configs (the repo's `e2e/crucible.config.json` and one per provider shape), the TS `provider/request` runner runs them, a TS test checks the goldens' prompts and config match the current payload goldens and e2e config, and the check runs in CI. Make targets renamed to `spec-goldens` / `spec-goldens-check`; old names kept as aliases; CI, README, docs updated. A TS↔jq difference is reported, not fixed (AC 8).
6. **Shed duplicates.** Unit tests fully covered by fixtures are removed (jsonc-reader, config, chat-completions-adapter, provider factories, registry built-ins, openai-compatible key and warning cases, retry outcomes, judge/extractor reply parsing); tests for wiring, timing, abort, real-fs adapters, warnings sink behaviour (once only, key never in warning), memoisation, schema-defaults agreement, registry mechanics, trace output stay. Before/after line counts recorded.
7. **README.** Porter-grade contracts per operation: JSONC grammar edge rules, config file precedence and rule order, URL parsing / normalisation / joining, header names and casing, body key semantics, key validation, response classification and why, retry count, reply parsing and re-ask rule, loopback detection. Layout and runner list updated; "Out of scope" updated.
8. **No `src/` behaviour change.** A fixture revealing a bug or a TS↔jq mismatch is reported.
9. **Gate.** `npm run lint && npm run format:check && npm run typecheck && npm test && npm run build && npm run verify:pack && npx tsc --noEmit -p e2e` and `make spec-goldens-check` pass.

## Tasks / Subtasks

- [x] Schema: per-operation input schemas for the six new operations, `mustNotContain`, `unreadable` file token; malformed cases (AC 2–4)
- [x] `FixtureOutcome` concealment check (AC 2)
- [x] `jsonc/parse` harness, runner, fixtures (AC 1)
- [x] `config/load` harness, runner, fixtures (AC 2)
- [x] `provider/request` + `provider/response` harness, fakes (request echo, scripted HTTP), runner, fixtures (AC 3)
- [x] `provider/plain-http-warning` harness, runner, fixtures (AC 3)
- [x] `judge/reply` harness, runner, fixtures (AC 4)
- [x] `conformance.sh request` mode, golden script rename + request goldens + check, Makefile aliases, CI, TS currency test (AC 5)
- [x] Remove duplicated unit tests; record line counts (AC 6)
- [x] README contracts, layout, runners, out of scope (AC 7)
- [x] Gate (AC 9)

## Dev Notes

### Current state (read before touching)

- `JsoncReader.read(text)` (`src/core/jsonc-reader.util.ts`): drops one leading U+FEFF; scans: strings copied verbatim to their closing quote (a `\` skips the next unit; no end → failure); `//` to the next CR or LF (dropped); `/* … */` replaced by spaces, line breaks kept (no `*/` → failure; no nesting); JS `\s` copied; a `,` whose previous significant char is not one of `{ [ , :` is a trailing-comma candidate, blanked if the next significant char is `}` or `]`. Then `JSON.parse` (strict JSON; non-JSON white space such as U+00A0 or a mid-text BOM fails there; duplicate keys last wins). Returns `{ ok, value }` or `{ ok: false, line? }`; `ConfigStore` turns failure into `config`.
- `ConfigStore.load` (`src/core/config.ts`) rule order: read both names (any unreadable → config; none → config; both → config) → JSONC → root plain object → key-like field names (lower-cased: `apikey api_key key token secret authorization`) → unknown fields (`$schema` ignored) → `provider` non-blank string → `baseUrl` (no `?`/`#`, WHATWG-parses, http/https, no credentials; normalised to `href` minus trailing `/`s) → `apiKeyEnv` (`^[A-Za-z_][A-Za-z0-9_]*$`) → registry (unknown provider; `baseUrl` unsupported for openrouter/openai, required for openai-compatible) → `model` non-blank string (kept verbatim) → `meta` plain object → configured `verbosity` (config) → `CRUCIBLE_VERBOSE` override when non-empty (usage) → `testDefaults` (run-options validate, config) → `excerptChars` integer ≥ 1 (default 500).
- `ChatCompletionsAdapter.complete`: POST `<baseUrl>/chat/completions`; key from env var (`apiKeyEnv` ?? `CRUCIBLE_JUDGE_KEY`), trimmed; blank → config if required (openrouter, openai, openai-compatible with `apiKeyEnv`), else no `Authorization`; key must be `[\x21-\x7e]+` else config; headers `{ Authorization?: "Bearer <key>", "Content-Type": "application/json" }`; body `JSON.stringify({ ...meta, model, messages: [system?, user] })`. Non-2xx → `ProviderHttpError` (fatal for 4xx except 408/429, else retryable); unparseable body / no `choices[0].message.content` string → envelope error (retryable); `error` member not null/undefined → numeric `code` → as HTTP status, else envelope error. Network rejections retryable.
- `RetryingCompleter` (`src/core/retry.ts`): 3 attempts; fatal → `infra` retryable false (CrucibleError non-retryable kinds rethrown as-is); exhausted → `infra` retryable true.
- `JudgeExchange` (`src/core/judge-exchange.ts`): asks at most twice; reply → trim, strip leading ```` ```[a-z]*\s* ```` (case-insensitive) and trailing ```` ```\s* ````, trim, `JSON.parse`; `Judge` needs boolean `verdict` + string `reasoning`; `Extractor` needs own `value` (null or `typeof` = type, finite numbers) + string `reasoning`; two unusable replies → `infra` retryable true.
- `TransportSecurity.exposesKey(baseUrl)`: `http:` and hostname (WHATWG-normalised) not `localhost`, `[::1]` or `127.d.d.d`; the warning is written once per provider, only when a key is sent.
- jq harness (`e2e/ext/conformance/`): `chat_request` = `meta + { model, messages: [system, user] }` + `{ usage: { include: true } }` for openrouter only; URL from `resolve_endpoint`; key trimmed by `sed`.

### Design decisions (owner-approved, see story brief)

- Env neutral: `{ name: value }`; files `{ name: text | { "$special": "unreadable" } }`.
- The HTTP request is the operation's observable output, produced through a fake fetch that echoes the request back as the judge reply (same reasoning as 8.2's `EchoJudge`); runners read it through the real `JudgeExchange`.
- Request goldens generated by the jq harness, never hand-edited.

### Must preserve

- Unit tests for: JSONC failure line numbers, `FileSystemConfigBoundary` (real-fs adapter), config memoisation and schema-defaults agreement, adapter abort contract, registry mechanics (fake factories, duplicate registration, tryCreate), plain-http warning written once and never holding the key, no warning when the request is never sent, unserialisable meta (usage), retry abort/backoff/trace behaviour, judge/extractor usage, facts, timeouts, records and trace.

### Testing

- CLAUDE.md test rules in full; fakes `.fake.ts` one per file, harness classes `*-harness.util.ts`, enums `.enum.ts`, `type`, named exports at end, no comments, no real fs / process state, assert outcomes only.
- New fixture files registered in `src/core/test/spec-fixtures.util.ts`.

### References

- [Source: _bmad-output/planning-artifacts/epics.md#Epic 8, Stories 8.3, 8.5, 8.6 note]
- [Source: _bmad-output/implementation-artifacts/8-1-spec-run-options-and-verdicts.md]
- [Source: _bmad-output/implementation-artifacts/8-2-spec-payloads-and-reports.md]
- [Source: _bmad-output/implementation-artifacts/deferred-work.md#Deferred from: code review of 8-2]
- [Source: spec/README.md], [Source: docs/judge-models.md#Wire findings]

## Dev Agent Record

### Agent Model Used

Claude Opus 5.5 (claude-opus-5-5)

### Debug Log References

- Baseline `npm test`: 35 suites, 1172 tests. After: 38 suites, 1348 tests (366 new fixture cases + 6 malformed-schema cases + 1 request-golden currency test; duplicated unit cases removed).
- Runner sanity: flipping every `config` kind (jsonc, request), every `retryable` (response, reply), every boolean value (plain-http), every `mustNotContain` list (config) and adding `usage` to one request golden failed exactly those 155 cases; restored files pass.
- `make spec-goldens-check` passes; editing the request golden makes it fail as stale.

### Completion Notes List

- Ultimate context engine analysis completed - comprehensive developer guide created
- Operations and case counts: `jsonc/parse` 61, `config/load` 123, `provider/request` 49 + 5 generated (`request-conformance.json`), `provider/response` 49, `provider/plain-http-warning` 15, `judge/reply` 64.
- Fixture format: optional `expect.error.mustNotContain` (strings the error must not reveal; the runner keeps the unrevealed ones, so equality = nothing revealed); `$special: "unreadable"` only as a `config/load` file. Per-operation input schemas for all six operations; `provider/response` outcome is text or error. Six malformed-schema cases added.
- TS runners: `jsonc-reader.util`, `config`, `judge-exchange` (core), `chat-completions-adapter` (request + response), `transport-security.util` (plain-http) `.spec-fixtures.test.ts`. The request is observed through `RequestEchoFetch` (fake fetch answering with the request as the judge's reply, read back through the real `ConfigStore` → registry → `JudgeExchange` → `RetryingCompleter` → adapter); responses through `ScriptedFetch` + real `RetryingCompleter`; replies through real `Judge` / `Extractor` with `ScriptedAdapter`.
- Envelope parity: `conformance.sh request <suite> <index>` prints the harness's own request (URL from `resolve_endpoint`, `Authorization` from the same function the curl config uses, body from `chat_request`, system from `schemas/<suite>.md`). `spec-goldens.sh` (renamed from `spec-payloads.sh`) writes `spec/provider/request-conformance.json` for the first case of each suite with `e2e/crucible.config.json` and three more provider shapes on coherent; `make spec-goldens(-check)` with `spec-payloads(-check)` kept as aliases; CI runs `spec-goldens-check`; a TS test checks the request goldens hold the current harness config and the current first-case payloads. Result: system prompt, model, meta, messages, URL and headers agree; **one mismatch**: the harness adds `usage: { include: true }` for openrouter, Crucible does not. The golden drops it explicitly (`harness_only_removed`) and the README says so; recorded in deferred-work for an owner decision. No `src/` change.
- Other TS↔harness differences (shell-level, outside the envelope): key character rules, loopback detection, `baseUrl` normalisation. Recorded in deferred-work. No TS bug found; quirks pinned as current behaviour listed there too.
- Removed duplicates (unit test lines 2008 → 957, −1051): `openai.test.ts`, `openrouter.test.ts` deleted; `jsonc-reader.util.test.ts` 141→26 (line numbers kept), `config.test.ts` 444→56 (memoisation, registry wiring, schema-defaults agreement kept), `chat-completions-adapter.test.ts` 228→64 (unserialisable meta, CrucibleError classification, abort kept), `openai-compatible.test.ts` 167→78 (factory guard, warning once / never holds key / named variable / not when never sent kept), `registry.test.ts` 156→91 (built-ins removed), `retry.test.ts` 161→117 (outcome cases removed; abort, backoff, infra-retryable rethrow, trace kept), `judge.test.ts` 349→305, `extractor.test.ts` 268→220 (reply parsing removed; default string type, strict/lenient, records, usage, facts, timeouts, trace kept). Seven enum files and `routing-meta.fake.ts` deleted, unused enum/harness members dropped. Added: 62 lines of runners, 290 lines of new harness/fake files plus ~115 in existing utils (goldens currency, outcome, malformed cases), fixtures (parse 61, load 123, request 49, response 49, plain-http 15, reply 64 cases), schema +244, README +364.
- Docs: `docs/instruction-schema.md` names the new `request` mode and `make spec-goldens-check`.

### File List

- spec/README.md
- spec/fixture.schema.json
- spec/jsonc/parse.json (new)
- spec/config/load.json (new)
- spec/provider/request.json (new)
- spec/provider/request-conformance.json (new, generated)
- spec/provider/response.json (new)
- spec/provider/plain-http-warning.json (new)
- spec/judge/reply.json (new)
- spec/payload/coherent-conformance.json (regenerated: description names the renamed script)
- spec/payload/extract-conformance.json (regenerated: description names the renamed script)
- e2e/ext/conformance/conformance.sh
- e2e/ext/conformance/spec-goldens.sh (renamed from spec-payloads.sh)
- Makefile
- .github/workflows/ci.yml
- docs/instruction-schema.md
- src/core/jsonc-reader.util.spec-fixtures.test.ts (new)
- src/core/config.spec-fixtures.test.ts (new)
- src/core/judge-exchange.spec-fixtures.test.ts (new)
- src/providers/chat-completions-adapter.spec-fixtures.test.ts (new)
- src/providers/transport-security.util.spec-fixtures.test.ts (new)
- src/core/test/jsonc-fixture-harness.util.ts (new)
- src/core/test/config-fixture-harness.util.ts (new)
- src/core/test/judge-reply-fixture-harness.util.ts (new)
- src/providers/test/provider-fixture-harness.util.ts (new)
- src/providers/test/request-echo-fetch.fake.ts (new)
- src/providers/test/scripted-fetch.fake.ts (new)
- src/core/spec-fixtures.test.ts
- src/core/test/spec-fixtures.util.ts
- src/core/test/fixture-outcome.util.ts
- src/core/test/conformance-goldens.util.ts
- src/core/test/malformed-fixture.util.ts
- src/core/test/malformed-fixture-name.enum.ts
- src/core/jsonc-reader.util.test.ts
- src/core/config.test.ts
- src/core/retry.test.ts
- src/core/judge.test.ts
- src/core/extractor.test.ts
- src/providers/chat-completions-adapter.test.ts
- src/providers/openai-compatible.test.ts
- src/providers/registry.test.ts
- src/providers/openai.test.ts (deleted)
- src/providers/openrouter.test.ts (deleted)
- src/core/test/config-harness.util.ts
- src/core/test/config-text.enum.ts
- src/core/test/jsonc-text.enum.ts
- src/core/test/extract-reply.enum.ts
- src/core/test/excerpt-chars.enum.ts (deleted)
- src/core/test/invalid-base-url.enum.ts (deleted)
- src/core/test/invalid-excerpt-chars.enum.ts (deleted)
- src/core/test/invalid-key-env.enum.ts (deleted)
- src/core/test/jsonc-value.enum.ts (deleted)
- src/core/test/leaked-secret.enum.ts (deleted)
- src/core/test/read-failure.enum.ts (deleted)
- src/providers/test/routing-meta.fake.ts (deleted)
- src/providers/test/api-key.enum.ts
- src/providers/test/base-url.enum.ts
- src/providers/test/chat-adapter-harness.util.ts
- src/providers/test/endpoint-url.enum.ts
- src/providers/test/fetch-boundary.fake.ts
- src/providers/test/key-env.enum.ts
- src/providers/test/provider-name.enum.ts
- src/providers/test/test-model.enum.ts
- _bmad-output/implementation-artifacts/deferred-work.md
- _bmad-output/implementation-artifacts/sprint-status.yaml

## Change Log

- 2026-11-14: Story 8.3 implemented — jsonc, config, provider and judge areas (six operations), `mustNotContain` and `unreadable`, request-envelope goldens from the jq harness (`make spec-goldens`), duplicated unit tests removed. Status → review.
