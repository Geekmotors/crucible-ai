---
baseline_commit: 9a1bd16
---

# Story 5.1: Judge with OpenAI or any OpenAI-compatible endpoint

Status: done

## Story

As a developer whose company uses OpenAI, Azure OpenAI, a LiteLLM gateway or a local model server instead of OpenRouter,
I want to point Crucible's judge at that endpoint from `crucible.config.json`,
so that I can use Crucible without an OpenRouter account.

Jack's decision (2026-11-14): start with OpenAI and any OpenAI-compatible endpoint. Bedrock and Vertex wait until there is an account to test against.

## Acceptance Criteria

1. **OpenAI preset.** `{ "provider": "openai", "model": "<openai model id>" }` sends judge calls to OpenAI's chat completions API (`https://api.openai.com/v1/chat/completions`) with the key from `OPENAI_API_KEY`; a missing or empty key is a `config` error at call time.
2. **Generic endpoint.** `{ "provider": "openai-compatible", "baseUrl": "<url>", "apiKeyEnv": "<ENV_NAME>", "model": "..." }` sends judge calls to `<baseUrl>/chat/completions` (a trailing slash on `baseUrl` is stripped) with `Authorization: Bearer <value of ENV_NAME>`.
3. **Keyless endpoints.** When `apiKeyEnv` is omitted no Authorization header is sent (Ollama, LM Studio). A named but unset or empty variable is a `config` error at call time, like the OpenRouter key.
4. **Config validation at load (`config` errors).** `baseUrl` not a string, not parseable, not http/https, or carrying credentials, a query or a fragment; `apiKeyEnv` not matching `^[A-Za-z_][A-Za-z0-9_]*$`; `baseUrl` or `apiKeyEnv` with a provider that does not take them (`openrouter`, `openai`); `baseUrl` missing for `openai-compatible`. A key value is never accepted in the config file (key-like field rejection unchanged; `apiKeyEnv` is allowed because it names a variable).
5. **Identical behaviour.** Retry, timeouts, abort, verdicts, records and reports are the same for every provider: HTTP 408/429/5xx retryable, other 4xx fatal, malformed envelopes retryable, embedded 200-with-error envelopes classified by code, `meta` passed through unchanged. OpenRouter keeps its exact current behaviour.
6. **No OpenRouter-only fields elsewhere.** The adapter sends none; the conformance harness sends `usage: { include: true }` only for `openrouter`.
7. **Conformance + e2e.** `make conformance` is provider-pluggable from the judge config (`provider`, `baseUrl`, `apiKeyEnv`; the key passed into the container by env var name), default run unchanged on OpenRouter. e2e covers `openai-compatible` against OpenRouter's compatible endpoint (`https://openrouter.ai/api/v1`, `apiKeyEnv: OPENROUTER_API_KEY`).
8. **Docs.** configuration (provider section, field reference, validation rules, OpenAI / Azure OpenAI v1 / Ollama / LiteLLM examples), getting-started (provider choice), judge-models (verify judge quality per model, run `make conformance` against your endpoint), gotchas, README (features, requirements, quick start). Azure and Ollama are marked untested against the live services; only OpenRouter's compatible endpoint is live-verified. TS examples compile against `dist`.

## Tasks / Subtasks

- [x] Task 1: Shared chat-completions adapter (AC 1–3, 5) — generalise `OpenRouterAdapter` into `ChatCompletionsAdapter` over an endpoint `{ name, url, keyEnvVar?, keyLabel }`; `ProviderHttpError` / `ProviderEnvelopeError` replace the OpenRouter-named errors; key read through an injected `EnvReader`; no Authorization header without a key env var.
- [x] Task 2: Provider factories + registry (AC 1–4) — `ProviderFactory` port (name, setting uses, `create(settings)`); `OpenRouterProvider`, `OpenAiProvider`, `OpenAiCompatibleProvider`; `ProviderRegistry.register(factory)` / `create(name, settings)` / `tryCreate`; unsupported or missing settings → `config`; `ProviderRegistry.builtIn(fetch, env)` builds the default registry.
- [x] Task 3: Config (AC 4) — `baseUrl`, `apiKeyEnv` known fields; format validation + trailing-slash strip; provider built from settings; key-like message names the right env var.
- [x] Task 4: Conformance harness pluggable (AC 6, 7) — endpoint/key env from judge config; `usage` only for openrouter; `key-env` command; Makefile `CONFORMANCE_CONFIG` mounted at runtime and the named key forwarded.
- [x] Task 5: e2e child project `openai-compatible` (AC 7).
- [x] Task 6: Docs + README + example compile check (AC 8).
- [x] Task 7: Full gate.

### Review Findings

- [x] [Review][Patch] Key-like-field error echoed an unvalidated `apiKeyEnv` (a pasted `sk-…` key) as "set the sk-… environment variable" [src/core/config.ts:115] — fixed test-first: only a valid variable name is used to describe the key variable.
- [x] [Review][Patch] Conformance harness looser than core config: accepted credentials/query/fragment in `baseUrl` (and echoed it), ignored `baseUrl`/`apiKeyEnv` on `openrouter`/`openai`, treated empty or non-string `apiKeyEnv` as keyless, echoed a pasted key in the `apiKeyEnv` error, did not trim the key, let `"`/`\`/control characters break the curl config line, and gave raw jq errors for an unreadable/non-object config [e2e/ext/conformance/conformance.sh] — fixed; all reject with exit 2 without echoing secrets.
- [x] [Review][Patch] Docs claimed the OpenRouter compatible endpoint was live-verified while the e2e has not yet run live, and did not mark the `openai` preset untested [docs/configuration.md, docs/judge-models.md, README.md] — reworded; README feature line carries the caveat.
- [x] [Review][Patch] Docs said "a pasted key is refused" by `apiKeyEnv`, untrue for keys made of letters/digits/underscores [docs/configuration.md, docs/gotchas.md] — reworded; Azure example notes only the v1 API (no `?api-version`) is supported.
- [x] [Review][Patch] Magic provider-name literals in tests and loose module-level status constants in a fake [src/core/config.test.ts, src/providers/registry.test.ts, src/providers/test/fetch-boundary.fake.ts] — `ProviderName` enum added; constants moved to private static members.
- [x] [Review][Defer] A key made only of `[A-Za-z0-9_]` passes the `apiKeyEnv` name check and is then named in the missing-key error [src/core/config.ts:169] — deferred, inherent to the format; docs now warn.
- [x] [Review][Defer] Bearer key may go over plain `http://` to a non-loopback host [src/core/config.ts] — deferred, needs a policy decision.
- [x] [Review][Defer] `baseUrl` already ending in `/chat/completions` is not caught (404 fatal) [src/core/config.ts] — deferred.
- [x] [Review][Defer] Interior CR/LF in a key makes `fetch` throw a TypeError classified retryable [src/providers/chat-completions-adapter.ts:55] — deferred, pre-existing.
- [x] [Review][Defer] Small design/test nits (tryCreate swallows all errors; duplicate baseUrl check in `OpenAiCompatibleProvider.create`; format errors precede applicability errors; `openai-compatible` errors don't name the endpoint; `ChatEndpoint` type exported from the class file; bare literals `11434`/`42`/`'fake'`/`'test-endpoint'`; identity `.toBe(adapter)` in registry tests; triplicated provider tests; weak "wrong key" test; e2e `revealsApiKey` hard-codes `OPENROUTER_API_KEY`) — deferred.
- [x] [Review][Defer] Makefile: `abspath` breaks on paths with spaces, extra `docker run` for `key-env`, whitespace-only key passes the host guard (container then rejects) [Makefile] — deferred.
- [x] [Review][Defer] OpenRouter users see renamed error classes/messages in traces (`ProviderHttpError`, `Provider "openrouter" responded…`) though the wire is unchanged — deferred, changelog note.
- [x] [Review][Defer] Docs TS-example compile check is a scratchpad script, not committed — deferred.

## Dev Notes

### Current state (read before touching)

- `src/providers/openrouter.ts` — `OpenRouterAdapter`: hard-coded URL, Bearer key from `OPENROUTER_API_KEY` via injected `ApiKeyReader`, injected `FetchLike`; body `{...meta, model, messages}` (meta first, so `model`/`messages` win); `!ok` → `OpenRouterHttpError(status)`; unparseable / no string content → `OpenRouterEnvelopeError`; embedded `error` with numeric code → `OpenRouterHttpError(code)`, else envelope error; unserializable meta → `usage`. `classifyFailure`: HTTP error → fatal for 4xx except 408/429, else retryable; `CrucibleError` → retryable only for retryable infra; anything else (network, envelope) retryable.
- `src/providers/registry.ts` — `ProviderRegistry` of singleton adapters (`register(name, adapter)`, `resolve`, `tryResolve`); module-level `providerRegistry` registers OpenRouter.
- `src/providers/types.ts` — port `ProviderAdapter { name, envVar, complete, classifyFailure }`.
- `src/core/config.ts` — `ConfigStore.load`: parse → reject key-like fields (exact lowercase names, so `apiKeyEnv` passes) → reject unknown fields → `registry.resolve(provider)`; key-like message names `adapter.envVar` via `tryResolve`.
- `src/core/judge-exchange.ts` — wraps the adapter to count attempts, copying `name`/`envVar`.
- `e2e/ext/conformance/` — POSIX sh + jq + curl in Docker; endpoint and `OPENROUTER_API_KEY` hard-coded; judge config is `e2e/crucible.config.json` copied at build time; `chat_request` adds `usage: {include: true}`. jq 1.8.2 crashes on nested `include` between modules: keep concatenating `payload-sections.jq` with the suite file.

### Design

- `ProviderSettings = { baseUrl?, apiKeyEnv? }`; each `ProviderFactory` declares per-setting use (`required` / `optional` / `unsupported`); the registry enforces it so config stays generic. Config owns format validation.
- Adapters are created per config; `config.get()` is memoized, so one adapter per process as before.
- `envVar` on the port becomes optional (keyless endpoints have none).
- Keep `meta` passthrough; send no OpenRouter-only fields.

### Must preserve

- OpenRouter behaviour and every existing classification test.
- Registration never reads config; adapters never import core logic beyond `CrucibleError`.
- CLAUDE.md testing rules: fakes one per file, enums for literals, harness classes, error kind only, no captured-request inspection (URL/auth behaviour is observed through a fake endpoint that answers like a server), no real env/fs/network.

### References

- [Source: _bmad-output/planning-artifacts/epics.md#Story 5.1]
- [Source: _bmad-output/planning-artifacts/architecture/architecture-crucible-ai-2026-08-10/ARCHITECTURE-SPINE.md#AD-8, AD-9]
- [Source: _bmad-output/implementation-artifacts/4-2-extract-a-value.md] (conformance suites, jq include gotcha, docs example harness)

## Dev Agent Record

### Agent Model Used

Claude Opus 5.5 (claude-opus-5-5)

### Completion Notes List

- **TDD.** Each src behaviour landed red → green: shared adapter (35 tests, incl. new URL/auth/keyless/trimmed-key/wrong-key cases), provider factories + registry (31), config settings (34 new rows). Validation tests were mutation-checked: disabling the `baseUrl`/`apiKeyEnv` checks and the slash strip fails 13 tests. Unit tests 446 → 499, 20 suites.
- **Shared adapter.** `ChatCompletionsAdapter` (`src/providers/chat-completions-adapter.ts`) is the old OpenRouter adapter generalised over a `ChatEndpoint { name, baseUrl, keyEnvVar?, keyOwner }`: request `{...meta, model, messages}` to `${baseUrl}/chat/completions`, Bearer key from an injected `EnvReader` (trimmed; missing/blank → `config` at call time), no `Authorization` header when the endpoint has no key variable, identical HTTP/envelope classification. `ProviderHttpError(provider, status)` / `ProviderEnvelopeError(provider)` replace the OpenRouter-named errors. Boundary types moved to `provider-boundary.ts`. The port's `envVar` is now optional (keyless endpoints).
- **Factories + registry.** Port `ProviderFactory { name, settingUses, create(settings) }` with per-setting use `required | optional | unsupported`. `OpenRouterProvider`, `OpenAiProvider` (presets: base URL + key variable fixed, both settings unsupported) and `OpenAiCompatibleProvider` (`baseUrl` required, `apiKeyEnv` optional). `ProviderRegistry.register(factory)`, `create(name, settings)` (unknown provider, an unsupported setting given, or a required one missing → `config`), `tryCreate`; `ProviderRegistry.builtIn(fetch = globalThis.fetch, env = process.env)` builds the default `providerRegistry`. Adapters are now built per config; `config.get()` is memoized, so still one adapter per test file.
- **Config.** `baseUrl`, `apiKeyEnv` are known fields. `baseUrl`: string, parses as a URL, http/https, no credentials, no `?`/`#` (checked on the raw string so an empty `?` is caught); normalised through `URL.href` with trailing slashes stripped. `apiKeyEnv`: `^[A-Za-z_][A-Za-z0-9_]*$` (a pasted `sk-…` key fails). Format checks are generic in `ConfigStore`; applicability is the registry's job. Key-like field rejection is unchanged (`apiKeyEnv` passes the exact-name check); its message now names the key variable of the configured provider/settings when it can be built. `URL.parse` avoided (engines `>=22`, it landed in 22.1).
- **Judgment calls.** Rejected query strings/fragments/credentials in `baseUrl` (they would break `/chat/completions` appending or put a secret in the committed file). The missing-key message for `openai-compatible` names the base URL. `meta` is still unvalidated pass-through for every provider; docs warn that a provider-specific `meta` (e.g. OpenRouter `reasoning`) may be rejected elsewhere. No OpenRouter-only fields are sent by the adapter. Trace/report output unchanged (provider name only).
- **Conformance.** `conformance.sh` resolves endpoint + key variable from the judge config (`openrouter` / `openai` presets; `openai-compatible` needs an http(s) `baseUrl`, optional `apiKeyEnv` validated as a name; unknown provider → exit 2), reads the key with `printenv`, sends no `Authorization` when there is no key, and has a new `key-env` command. `payload-sections.jq` adds `usage: {include: true}` only when `provider == "openrouter"` (no nested includes; still concatenated). Makefile: `CONFORMANCE_CONFIG` (default `e2e/crucible.config.json`) is bind-mounted read-only over the image's judge config; the target asks the image for `key-env`, checks that variable on the host and forwards it with `--env NAME`; replaces the old `e2e-key` dependency. Verified offline with Docker: default and compatible configs without the key → exit 2 naming `OPENROUTER_API_KEY`; unknown provider → exit 2; missing config file → exit 2; keyless config at `http://127.0.0.1:9/v1/` → runs, curl fails per call, summary + exit 1 (trailing slash stripped, no key needed); `payloads` unchanged. jq check: request body carries `usage` for the OpenRouter config and not for the compatible one.
- **e2e (written, not run live).** Child project `e2e/ext/fixtures/projects/openai-compatible/` (`openai-compatible` → `https://openrouter.ai/api/v1`, `apiKeyEnv: OPENROUTER_API_KEY`, same judge model/meta as the other configs) with one stateful coherent + one extract; `e2e/ext/openai-compatible.test.ts` runs it at `debug` and asserts exit 0, the trace's resolved provider and provider requests are `openai-compatible`, the verdict and extraction are recorded, and the key never appears. Offline smoke through `dist` with the key unset: config resolved as `openai-compatible`, the call failed fast as `config` naming `OPENROUTER_API_KEY`. `OPENROUTER_API_KEY` was not in the shell, so `make e2e-ext` and `make conformance` were not run live (deferred-work entry added).
- **Docs.** configuration.md (retitled "Configuration and provider reference": fields `baseUrl`/`apiKeyEnv`, validation rows in check order, env vars per provider, new Providers section with OpenAI, Azure OpenAI v1, Ollama, LM Studio, LiteLLM and OpenRouter-compatible examples, untested-endpoints note, generic Provider failures, model-choice + CI-secret wording), getting-started.md (provider choice table, Ollama example, "Set your API key" step), judge-models.md (new "Using another provider or model": `make conformance CONFORMANCE_CONFIG=…`, key forwarding, `host.docker.internal` for local servers, verification status), gotchas.md (keys/`apiKeyEnv`, data leaving the machine, rate limits, TLS), README (feature bullet, requirements, quick start, docs links), docs/README.md, api.md (missing key), runs-and-threshold.md (error class names in trace example, real exhausted-retry cause text), instruction-schema.md (conformance key). Example check (scratchpad, not committed): 23 ts blocks compile with `tsc` against `dist/index.d.ts`, exit 0; 5 signature-reference blocks skipped; negative control → 17 errors. Every JSON block parses; every relative link/anchor resolves.
- **Gate:** `npm run lint && npm run format:check && npm run typecheck && npm test && npm run build && npm run verify:pack && npx tsc --noEmit -p e2e` → exit 0 (499 tests).

### File List

- Makefile
- README.md
- docs/README.md
- docs/api.md
- docs/configuration.md
- docs/getting-started.md
- docs/gotchas.md
- docs/instruction-schema.md
- docs/judge-models.md
- docs/runs-and-threshold.md
- e2e/ext/conformance/conformance.sh
- e2e/ext/conformance/payload-sections.jq
- e2e/ext/openai-compatible.test.ts (new)
- e2e/ext/fixtures/projects/openai-compatible/crucible.config.json (new)
- e2e/ext/fixtures/projects/openai-compatible/openai-compatible.scenario.ts (new)
- e2e/ext/fixtures/projects/openai-compatible/scenario.json (new)
- e2e/test/child-project.enum.ts
- e2e/test/trace-line.enum.ts
- src/core/config.ts
- src/core/config.test.ts
- src/core/test/config-harness.util.ts
- src/core/test/invalid-base-url.enum.ts (new)
- src/core/test/invalid-key-env.enum.ts (new)
- src/providers/chat-completions-adapter.ts (new, from openrouter.ts)
- src/providers/chat-completions-adapter.test.ts (renamed from openrouter.test.ts)
- src/providers/openrouter.ts (now `OpenRouterProvider` factory)
- src/providers/openrouter.test.ts (new)
- src/providers/openai.ts (new)
- src/providers/openai.test.ts (new)
- src/providers/openai-compatible.ts (new)
- src/providers/openai-compatible.test.ts (new)
- src/providers/provider-boundary.ts (new)
- src/providers/provider-http-error.ts (renamed from openrouter-http-error.ts)
- src/providers/provider-envelope-error.ts (renamed from openrouter-envelope-error.ts)
- src/providers/registry.ts
- src/providers/registry.test.ts
- src/providers/types.ts
- src/providers/test/api-key.enum.ts (new)
- src/providers/test/base-url.enum.ts (new)
- src/providers/test/chat-adapter-harness.util.ts (renamed from openrouter-harness.util.ts)
- src/providers/test/endpoint-url.enum.ts (new)
- src/providers/test/environment.fake.ts (new)
- src/providers/test/fetch-boundary.fake.ts
- src/providers/test/key-env.enum.ts (new)
- src/providers/test/provider-factory.fake.ts (new)
- src/providers/test/provider-name.enum.ts (new, review)
- _bmad-output/implementation-artifacts/5-1-openai-compatible-provider.md (new)
- _bmad-output/implementation-artifacts/deferred-work.md
- _bmad-output/implementation-artifacts/sprint-status.yaml

## Change Log

- 2026-11-14: Story created (ready-for-dev).
- 2026-11-14: Implemented `openai` and `openai-compatible` providers over a shared `ChatCompletionsAdapter`, provider factories in the registry, `baseUrl`/`apiKeyEnv` config, provider-pluggable conformance harness, `openai-compatible` e2e child project, docs. Gate green (499 tests). Status → review.
- 2026-11-14: Code review (Blind Hunter, Edge Case Hunter, Acceptance Auditor). 5 patches applied (config secret echo, conformance harness parity/secret handling, docs honesty, test literals). Deferred items logged. Gate green (500 tests). Status → done.
