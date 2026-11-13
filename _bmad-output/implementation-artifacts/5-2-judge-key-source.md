---
baseline_commit: 968171d
---

# Story 5.2: Choose where the judge key comes from

Status: review

## Story

As a developer whose judge key lives in a secret manager, CI secret or vault under its own name,
I want one default key variable for every provider and the option to name my own,
so that I set the judge key once, the same way, whichever provider I judge with.

Jack's decisions (2026-11-14), not to be re-litigated: `apiKeyEnv` for every provider; default `CRUCIBLE_JUDGE_KEY`; `OPENROUTER_API_KEY` / `OPENAI_API_KEY` dropped (breaking, pre-1.0); `openai-compatible` key optional unless `apiKeyEnv` is declared; plain-http to a non-loopback host with a key → warn once per process, never reject; the CI repo secret is renamed to `CRUCIBLE_JUDGE_KEY` (updated mid-story).

## Acceptance Criteria

1. **`apiKeyEnv` for every provider.** `openrouter`, `openai` and `openai-compatible` all accept an optional `apiKeyEnv`; validation unchanged (`^[A-Za-z_][A-Za-z0-9_]*$`, a pasted key is never echoed in any error).
2. **Default variable.** Without `apiKeyEnv` the key is read from `CRUCIBLE_JUDGE_KEY`. `OPENROUTER_API_KEY` and `OPENAI_API_KEY` are no longer read by anything.
3. **Required for presets.** `openrouter` / `openai`: resolved variable unset or blank → `config` error at call time naming the variable.
4. **Optional for openai-compatible.** `apiKeyEnv` absent and `CRUCIBLE_JUDGE_KEY` unset/blank → no `Authorization` header; `CRUCIBLE_JUDGE_KEY` set → `Bearer` key sent. `apiKeyEnv` declared → today's behaviour: that variable unset/blank → `config` error at call time.
5. **Plain-http warning.** `openai-compatible` with an `http://` `baseUrl` whose host is not loopback (`localhost`, `127.0.0.0/8`, `[::1]`) and a key that will be sent → one warning per process through an injected warning sink (default stderr). Never contains the key. The call proceeds. No warning for https, loopback http, or when no key is sent.
6. **Everything renamed.** e2e (fixtures, `JestProcess.revealsApiKey`), conformance harness (default `KEY_ENV=CRUCIBLE_JUDGE_KEY`, `apiKeyEnv` for all providers, `key-env` reports whether the key is required, same plain-http warning), Makefile (`e2e-key`, `conformance`), `.github/workflows/ci.yml` (`CRUCIBLE_JUDGE_KEY: ${{ secrets.CRUCIBLE_JUDGE_KEY }}` — Jack renamed the repo secret mid-story), README, docs. No changelog exists → breaking change recorded in Completion Notes. Deferred http-key item removed from deferred-work.md.

## Tasks / Subtasks

- [x] Task 1 (AC 1–3): presets — `apiKeyEnv` becomes `optional` for `OpenRouterProvider`/`OpenAiProvider`; key variable `settings.apiKeyEnv ?? CRUCIBLE_JUDGE_KEY` (shared constant in its own module); tests first (default var, declared var, old var alone → `config`).
- [x] Task 2 (AC 4): `ChatEndpoint` gains `keyRequired`; adapter sends no header when an optional key is unset/blank; `OpenAiCompatibleProvider` resolves var + requiredness; tests first.
- [x] Task 3 (AC 5): `WarningSink` boundary type; `OneTimeWarning` class; `TransportSecurity` util (plain http to non-loopback); wired through `ProviderRegistry.builtIn(fetch, env, warn)`; default sink writes to `process.stderr`; tests with a `FakeWarningSink`.
- [x] Task 4 (AC 1): config/registry tests — `apiKeyEnv` accepted for every provider; key-like-field message names `CRUCIBLE_JUDGE_KEY` or the declared variable.
- [x] Task 5 (AC 6): e2e, conformance.sh, Makefile, CI workflow.
- [x] Task 6 (AC 6): README + docs; deferred-work cleanup.
- [x] Task 7: full gate.

### Review Findings

- [ ] [Review][Decision] Warning is once per Jest test file, not once per process — the once-guard lives on the module-level factory and Jest reloads modules per test file. Docs corrected to "per test file"; true per-process needs state surviving Jest's module reset. Deferred to Jack.
- [ ] [Review][Decision] No migration hint for 0.2 users who only set `OPENROUTER_API_KEY` / `OPENAI_API_KEY` — hint in the config error vs changelog only. Deferred to Jack.
- [x] [Review][Patch] Key with an inner line break, control or non-ASCII character leaked through fetch's header `TypeError` into the infra report → now a `config` error naming only the variable [src/providers/chat-completions-adapter.ts]
- [x] [Review][Patch] Plain-http warning fired before the body was serialized (unserializable `meta` → warning for a request never sent) → body serialized first [src/providers/chat-completions-adapter.ts]
- [x] [Review][Patch] No tests for lookalike hosts (`127.0.0.1.<remote>`, `localhost.<remote>`), uppercase, expanded IPv6, IPv4 shorthand, or the declared-`apiKeyEnv` plain-http path [src/providers/openai-compatible.test.ts]
- [x] [Review][Patch] "warns once, without the key" test asserted two purposes → split [src/providers/openai-compatible.test.ts]
- [x] [Review][Patch] Bare `''` key literals → `ApiKey.Empty` [src/providers/test/api-key.enum.ts]
- [x] [Review][Patch] Task 4 registry coverage: presets judge with the key from the variable `apiKeyEnv` names [src/providers/registry.test.ts]
- [x] [Review][Patch] Docs: "one warning per test process" → per test file; "leave the key unset" advice holds only without `apiKeyEnv`; default key goes to any `openai-compatible` `baseUrl` (https included) now stated; new malformed-key `config` row [docs/configuration.md, docs/gotchas.md, docs/getting-started.md]
- [x] [Review][Patch] Makefile `e2e-key` / `conformance` accepted a whitespace-only key [Makefile]
- [x] [Review][Defer] Warning prints full `baseUrl` incl. path (tenant tokens in path) [src/providers/openai-compatible.ts] — deferred, low
- [x] [Review][Defer] Conformance loopback/key-char parity with core (safe-direction false positives) [e2e/ext/conformance/conformance.sh] — deferred, low
- [x] [Review][Defer] Raw `TypeError` from `new URL` on direct factory call with bad `baseUrl`; throwing sink unclassified [src/providers/transport-security.util.ts] — deferred, unreachable via config
- [x] [Review][Defer] Pasted all-`[A-Za-z0-9_]` key in `apiKeyEnv` echoed in missing-key error now covers every provider [src/core/config.ts] — extends existing 5.1 deferred item

## Dev Notes

### Current state (from Story 5.1, read before touching)

- `src/providers/chat-completions-adapter.ts` — `ChatEndpoint { name, baseUrl, keyEnvVar?, keyOwner }`; `authorization()` returns `{}` when `keyEnvVar` is undefined, else requires the key (trimmed; missing/blank → `config` naming the variable). Port `envVar` copied from `keyEnvVar`.
- `openrouter.ts` / `openai.ts` — presets with hard-coded `OPENROUTER_API_KEY` / `OPENAI_API_KEY`, `settingUses` both `unsupported`.
- `openai-compatible.ts` — `baseUrl` required, `apiKeyEnv` optional; `keyEnvVar: settings.apiKeyEnv`.
- `registry.ts` — `checkSettings` rejects `unsupported` settings (`describeTakers`); `builtIn(fetch, readEnv)` is the module-level default.
- `src/core/config.ts` — format validation of `baseUrl`/`apiKeyEnv`; `describeKeyEnvVar` uses `tryCreate(...).envVar` for the key-like-field message (only a valid name is ever echoed — keep).
- `e2e/ext/conformance/conformance.sh` — `resolve_endpoint` rejects `apiKeyEnv` for presets; `KEY_ENV` empty means keyless; `key-env` prints the variable; Makefile forwards it with `--env NAME`.

### Design

- `CRUCIBLE_JUDGE_KEY` lives in `src/providers/judge-key.ts` (constant module; three providers share it).
- `ChatEndpoint { name, baseUrl, keyEnvVar: string, keyRequired: boolean, keyOwner, onKeySent?: () => void }`. Adapter: read + trim; blank and required → `config`; blank and optional → no header; key present → call `onKeySent` then send `Bearer`.
- `OpenAiCompatibleProvider(fetch, env, warn)`: `keyRequired = apiKeyEnv !== undefined`; `onKeySent` only when `TransportSecurity.exposesKey(baseUrl)`; the factory owns one `OneTimeWarning`, so the warning is once per process (the registry/factory is built once at module load; config is memoized).
- `TransportSecurity.exposesKey(baseUrl)`: `protocol === 'http:'` and hostname not `localhost`, not `127.x.y.z`, not `[::1]` (WHATWG `URL` normalises IPv4 shorthand and lowercases hosts).
- AD-9 says keys come from provider-native vars and `CRUCIBLE_` is reserved for crucible-owned settings; AD-10 says nothing prints mid-run. Jack's decision overrides both for the judge key and the transport warning; extend the existing deferred spine-amendment item.

### Must preserve

- Retry/classification, meta passthrough, trace output, key never echoed.
- CLAUDE.md testing rules: fakes one per file under `test/`, enums for literals, outcomes not interactions (auth observed through `FakeFetchBoundary.serving` / `servingWithoutCredentials`), error kind only, no real env/fs/process.

### References

- [Source: _bmad-output/planning-artifacts/epics.md#Story 5.2]
- [Source: _bmad-output/implementation-artifacts/5-1-openai-compatible-provider.md]
- [Source: _bmad-output/planning-artifacts/architecture/architecture-crucible-ai-2026-08-10/ARCHITECTURE-SPINE.md#AD-8, AD-9, AD-10]
- [Source: _bmad-output/implementation-artifacts/deferred-work.md] (plain-http key item)

## Dev Agent Record

### Agent Model Used

Claude Opus 5.5 (claude-opus-5-5)

### Debug Log References

### Completion Notes List

- Ultimate context engine analysis completed - comprehensive developer guide created
- **TDD.** Tests written first across presets, openai-compatible, adapter, registry and config: 20 failing → green. Mutation checks: removing the once-guard fails the "warns once" test; removing the 127/8 check fails 2 loopback rows. Unit tests 500 → 540, 20 suites.
- **Key source.** `DEFAULT_JUDGE_KEY_ENV = 'CRUCIBLE_JUDGE_KEY'` (`src/providers/judge-key.ts`). `openrouter`/`openai`: `apiKeyEnv` now `optional`, key variable `apiKeyEnv ?? CRUCIBLE_JUDGE_KEY`, required. `openai-compatible`: same variable; required only when `apiKeyEnv` is declared, else an unset/blank key sends no `Authorization`. `ChatEndpoint` now `{ keyEnvVar, keyRequired, onKeySent? }`; port `envVar` is always set for built-ins (key-like-field message names `CRUCIBLE_JUDGE_KEY` or the declared variable; a pasted key is still never echoed — tested for all three providers).
- **Plain-http warning.** `TransportSecurity.exposesKey(baseUrl)` (http and host not `localhost` / `127.x.x.x` / `[::1]`, via WHATWG URL). `OpenAiCompatibleProvider(fetch, env, warn)` owns one `OneTimeWarning`; the adapter calls `onKeySent` only when a key is actually sent. `WarningSink` boundary type; `ProviderRegistry.builtIn(fetch, env, warn = stderr)`. Message names the variable and URL, never the key. Call still proceeds. Tests inject `FakeWarningSink` (registry/config harnesses too, so no test touches real stderr).
- **Breaking change (no CHANGELOG exists):** `OPENROUTER_API_KEY` and `OPENAI_API_KEY` are no longer read. Migrate by renaming to `CRUCIBLE_JUDGE_KEY` or setting `"apiKeyEnv": "OPENROUTER_API_KEY"` (or `OPENAI_API_KEY`). Also: an `openai-compatible` config without `apiKeyEnv` now sends `CRUCIBLE_JUDGE_KEY` if it is set (previously never sent a key). Documented in configuration.md "Judge key".
- **Conformance.** Default `KEY_ENV=CRUCIBLE_JUDGE_KEY`; `apiKeyEnv` accepted for every provider (same name check); `key-env` prints `NAME required|optional`; keyless only for openai-compatible without `apiKeyEnv`; same plain-http warning on stderr (loopback detection checked offline with sh over 9 URLs). Makefile forwards the variable when set, fails only when required and unset. `sh -n` clean. Not run with Docker or live.
- **e2e.** `revealsApiKey` reads `CRUCIBLE_JUDGE_KEY`; `openai-compatible` fixture drops `apiKeyEnv` and so exercises the new default. Not run live.
- **CI.** `ci.yml` uses `CRUCIBLE_JUDGE_KEY: ${{ secrets.CRUCIBLE_JUDGE_KEY }}` per Jack's mid-story update (repo secret renamed); docs CI example matches. RELEASING notes `.env.dev.local` must set `CRUCIBLE_JUDGE_KEY`.
- **Architecture.** AD-9 (provider-native key var, `CRUCIBLE_` reserved) and AD-10 (all output via reporter) are contradicted by Jack's decisions; folded into the existing deferred spine-amendment item. Plain-http deferred item removed.
- **Gate:** `npm run lint && npm run format:check && npm run typecheck && npm test && npm run build && npm run verify:pack && npx tsc --noEmit -p e2e` → exit 0 (540 tests).

### File List

- .github/workflows/ci.yml
- Makefile
- README.md
- RELEASING.md
- docs/api.md
- docs/configuration.md
- docs/getting-started.md
- docs/gotchas.md
- docs/judge-models.md
- e2e/ext/conformance/conformance.sh
- e2e/ext/fixtures/projects/openai-compatible/crucible.config.json
- e2e/ext/fixtures/projects/openai-compatible/scenario.json
- e2e/test/jest-process.util.ts
- src/core/config.ts
- src/core/config.test.ts
- src/core/test/config-harness.util.ts
- src/providers/chat-completions-adapter.ts
- src/providers/chat-completions-adapter.test.ts
- src/providers/judge-key.ts (new)
- src/providers/one-time-warning.ts (new)
- src/providers/transport-security.util.ts (new)
- src/providers/openai-compatible.ts
- src/providers/openai-compatible.test.ts
- src/providers/openai.ts
- src/providers/openai.test.ts
- src/providers/openrouter.ts
- src/providers/openrouter.test.ts
- src/providers/provider-boundary.ts
- src/providers/registry.ts
- src/providers/registry.test.ts
- src/providers/test/api-key.enum.ts
- src/providers/test/base-url.enum.ts
- src/providers/test/chat-adapter-harness.util.ts
- src/providers/test/compatible-provider-harness.util.ts (new)
- src/providers/test/endpoint-url.enum.ts
- src/providers/test/key-env.enum.ts
- src/providers/test/registry-harness.util.ts
- src/providers/test/warning-sink.fake.ts (new)
- _bmad-output/planning-artifacts/epics.md
- _bmad-output/implementation-artifacts/5-2-judge-key-source.md (new)
- _bmad-output/implementation-artifacts/deferred-work.md
- _bmad-output/implementation-artifacts/sprint-status.yaml

## Change Log

- 2026-11-14: Story created (ready-for-dev).
- 2026-11-14: `CRUCIBLE_JUDGE_KEY` default and `apiKeyEnv` for every provider; optional key for openai-compatible; one-time plain-http warning; conformance/Makefile/CI/e2e/docs migrated. Gate green (540 tests). Status → review.
