---
baseline_commit: 19c700a
---

# Story 8.5: Live tests only where a real judge is the point

Status: done

## Story

As the maintainer paying for judge calls,
I want e2e tests to call OpenRouter only when the real provider or a real model is what's being tested,
so that `make e2e` and CI are cheap, deterministic and not flaky, while model behaviour stays covered by the conformance harness.

## Acceptance Criteria

1. **TS conformance e2e leaves `make e2e`.** `e2e/ext/coherent-conformance.test.ts` and `e2e/ext/extract-conformance.test.ts` are deleted. TS = jq parity for every conformance case is already proven by `spec/payload/{coherent,extract}-conformance.json` (checked by `npm test` through `PayloadAssembler`, and by `make spec-goldens-check` against the jq builder) and `spec/provider/request-conformance.json` (system prompt verbatim + request envelope).
2. **Model-semantics e2e become conformance cases.** The judged steps of `e2e/core/stateful-coherence.test.ts` (room-booking, 3 steps) and `e2e/ext/knowledge-boundary.test.ts` (2 steps) are appended to `e2e/ext/fixtures/coherent-conformance.json` as cases with their full state (room-booking: loaded state + every append up to that step). Both tests and their fixtures are deleted; `make spec-goldens` regenerates the goldens; existing case order kept (the request goldens use case 0).
3. **Stub judge.** A `StubJudgeServer` (node:http, `127.0.0.1`, OpenAI chat-completions envelope) answers judge calls from a scripted fixture JSON, matched on the CLAIM (coherent) or TARGET (+ optional RESPONSE) section of the last user message; coherent reply `{"verdict":…,"reasoning":…}`, extract reply `{"value":…,"reasoning":…}`; an unscripted call gets an HTTP 404 (fatal, the test fails loudly).
4. **Stub suites.** The child-process projects `debug-trace`, `failure-report`, `openai-compatible` and the runner suites `plain-runner-gate`, `runner-variants`, `vitest/core-scenarios` judge against the stub via `openai-compatible` on `http://127.0.0.1:<port>/v1` — real Jest/Vitest processes kept, outcomes deterministic, no key needed. The debug-trace leak check sets a sentinel `CRUCIBLE_JUDGE_KEY` for the child and asserts it never appears in the output; the openai-compatible child runs with no key at all.
5. **No-key target in PR CI.** `make e2e-offline` (no key) runs every stub suite; `make e2e` includes it; the PR `unit` job runs it.
6. **One live smoke.** `e2e/core/cjs-build.test.cts` stays live (OpenRouter, `e2e/crucible.config.json`): one coherent + one extract call (≤ 2 calls). `make e2e` ≤ 3 live calls (was 72); CI per main push ≤ 2 (was 22).
7. **Conformance in CI.** A workflow runs `make conformance` (Docker, alpine) on pushes to `main` and on same-repo pull requests (`github.event.pull_request.head.repo.full_name == github.repository`; secrets are not available to forks) when `schemas/**`, `e2e/ext/fixtures/*-conformance.json`, `e2e/ext/conformance/**` or `src/core/payload-assembler.util.ts` change, plus a weekly `schedule` and `workflow_dispatch`; key from the `CRUCIBLE_JUDGE_KEY` secret.
8. **Docs.** RELEASING.md requires a passing `make conformance` (or the CI conformance run on the release commit) before tagging; `docs/judge-models.md` and the porting guide say model semantics are covered by `make conformance` and where e2e runs offline; `e2e/crucible.config.json` stays on OpenRouter (the conformance Dockerfile copies it).
9. **Gate.** `npm run lint && npm run format:check && npm run typecheck && npm test && npm run build && npm run verify:pack && npx tsc --noEmit -p e2e && make spec-goldens-check` and `make e2e-offline` pass.

## Tasks / Subtasks

- [x] Conformance cases: append room-booking ×3 and knowledge-boundary ×2 to `coherent-conformance.json`; `make spec-goldens`; `npm test` (AC 2)
- [x] Delete the TS conformance and model-semantics e2e (AC 1, 2)
- [x] `StubJudgeServer` + reply script + Jest/Vitest global setup; move stub suites under `e2e/stub/` with a stub `crucible.config.json` (AC 3, 4)
- [x] Child projects: stub configs, sentinel key / keyless env, trace expectations for `openai-compatible` (AC 4)
- [x] Live smoke: cjs-build coherent + extract (AC 6)
- [x] Makefile `e2e-offline`, `e2e`; CI `unit` job + main lane; conformance workflow (AC 5, 6, 7)
- [x] Docs: RELEASING.md, judge-models.md, instruction-schema.md, configuration.md, PORTING.md (CHANGELOG not needed: test infra only) (AC 8)
- [x] Gate + `make e2e-offline` (AC 9)

## Dev Notes

### Live-call audit (before this story)

`make e2e` = 72 live OpenRouter judge calls; CI (main push, `e2e-core` + `e2e-vitest`) = 22.

| Test | Calls | Why live | Decision |
| --- | --- | --- | --- |
| `e2e/ext/coherent-conformance.test.ts` | 4 | duplicates `make conformance`, single shot, flaky | delete (parity proven by payload/request goldens) |
| `e2e/ext/extract-conformance.test.ts` | 32 | same | delete |
| `e2e/core/stateful-coherence.test.ts` | 9 (3 steps × 3 runs) | model semantics | fold into `coherent-conformance.json`, delete |
| `e2e/ext/knowledge-boundary.test.ts` | 6 (2 × 3) | model semantics | fold, delete |
| `e2e/ext/debug-trace`, `failure-report`, `openai-compatible` | 2 + 4 + 2 | judge answer incidental | stub |
| `e2e/core/plain-runner-gate`, `runner-variants` | 3 + 4 | incidental | stub |
| `e2e/vitest/core-scenarios` | 5 | incidental | stub |
| `e2e/core/cjs-build.test.cts` | 1 | real wire/auth | keep live, add one extract (2) |

After: `make e2e` = 2 live calls, CI main push = 2, PR = 0 (stub suites run there with no secret). The room-booking flow (facts appended between calls that are all started before any is awaited) also stays as an offline stub suite, `e2e/stub/runner/growing-facts.test.ts`, which the stub answers on STATE.

### Stub design (decided)

- **Fixed port, checked-in configs.** Crucible reads config only from `process.cwd()` with no env interpolation. A fixed loopback port (`28731`, below the Linux and macOS ephemeral ranges) baked into checked-in `crucible.config.json` files is simpler than writing temp configs at test time, and needs no file writes. `make e2e-offline` runs the Jest stub run (`--runInBand`, `maxWorkers: 1`) and then the Vitest run sequentially (`.NOTPARALLEL`), so the port is bound by one process at a time. A clash fails with an error naming the port, `lsof`, and the files to change.
- **Layout.** `e2e/stub/` holds everything that judges against the stub: `crucible.config.json` (cwd for in-process suites), `jest.config.mjs` (`setupFilesAfterEnv: stub-judge.lifecycle.ts`, one server per test file, `maxWorkers: 1`), `judge-replies.json` (the script), `runner/` (plain-runner-gate, runner-variants, growing-facts), `projects/` (child-process tests + their child projects), `vitest/` (core-scenarios + its config with `globalSetup`). `e2e/core/` keeps only the live smoke; `e2e/ext/` keeps the conformance harness and cases.
- **Child processes** keep using `e2e/jest.config.mjs` (no stub lifecycle, so they never bind the port) with `cwd` = the child project; the server started by the parent test file's `beforeAll` answers them (the child runs inside that file's own `beforeAll`, after the server is up, and is SIGKILLed at its 100 s deadline, before the file's `afterAll`).
- **Matching.** A script reply names any of STATE / RESPONSE / CLAIM / TARGET; exactly one reply must match every section it names, else HTTP 404 (fatal) and the stub writes the sections it saw to stderr. Unknown routes 404, unparseable bodies 400.
- `openai-compatible` with no `apiKeyEnv`: no Authorization header when `CRUCIBLE_JUDGE_KEY` is unset; a set key IS sent (fine: loopback, no plain-http warning, sentinel value).

### Must preserve

- `e2e/crucible.config.json` on OpenRouter (Dockerfile copies it; `spec-goldens.sh` request goldens read it).
- Conformance case order/ids (request goldens use case 0 of each matrix); `make spec-goldens(-check)`.
- No `src/` production change (review added one unit test). Root `npm test` only matches `src/**`.
- `conformance.sh` retries each call twice on curl's transient set (`--retry 2`: timeouts, 408, 429, 5xx, `Retry-After`); `alpine:3.22` is still not digest-pinned (Story 3.4, deferred). A provider outage fails the conformance workflow, not the PR gate.

### Testing

- e2e helpers follow `e2e/test/` conventions: one class per file, `.util.ts`, enums `.enum.ts`, `type`, named exports at end, no comments. Tool-mandated global-setup modules use a default export.
- Writing files in tests: none needed (fixed port).

### References

- [Source: _bmad-output/planning-artifacts/epics.md#Story 8.5]
- [Source: e2e/ext/conformance/spec-goldens.sh], [Source: spec/README.md], [Source: spec/PORTING.md#3]
- [Source: src/providers/openai-compatible.ts], [Source: src/providers/chat-completions-adapter.ts], [Source: src/providers/transport-security.util.ts]
- [Source: _bmad-output/implementation-artifacts/deferred-work.md — Story 3.4 conformance hardening, Story 8.2/8.3 parity items]

## Dev Agent Record

### Agent Model Used

Claude Opus 5.5 (claude-opus-5-5)

### Debug Log References

- Red: after appending the 5 cases, `make spec-goldens-check` failed (`spec/payload/coherent-conformance.json is stale`); `make spec-goldens` regenerated it (request goldens unchanged, they use case 0); `npm test` 1476 pass.
- Jest `globalSetup` in TypeScript did not work: Jest loads an ESM global setup with Node's native loader, so its `../test/*.js` imports (TS sources) are not resolved through `moduleNameMapper`/ts-jest (`ERR_MODULE_NOT_FOUND`). Switched the Jest stub run to `setupFilesAfterEnv` (`e2e/stub/stub-judge.lifecycle.ts`: start in `beforeAll`, stop in `afterAll`) with `maxWorkers: 1`, so each test file owns the fixed port in turn. Vitest uses `globalSetup` (`e2e/stub/vitest/stub-judge.setup.ts`), which Vite transforms.
- Red checks: breaking the weekday claim and the "three apples" value in `judge-replies.json` failed 9 Jest stub tests (incl. the child projects); breaking the museum claim failed 1 Vitest test; restored file passes.
- `make e2e-offline`: Jest 5 suites (24 passed, 1 skipped, 1 todo), Vitest 6 passed; also passes with a key exported (the Makefile strips `CRUCIBLE_JUDGE_KEY` for the stub runs). `jest --listTests` on `e2e/jest.config.mjs` lists only `core/cjs-build.test.cts`.
- Review gate: see Review Follow-ups; `make e2e-offline` Jest 6 suites (25 passed, 1 skipped, 1 todo), Vitest 6 passed.
- Gate: lint, format:check, typecheck, `npm test` (40 suites, 1476 tests), build, verify:pack, `tsc -p e2e`, `make spec-goldens-check` pass. No live calls, no Docker run.

### Review Follow-ups (code review 2026-11-14)

- Stub server: async handler errors destroy the socket instead of an unhandled rejection; `error` listener detached after listen; EADDRINUSE rethrown with a clear message; unknown route 404, bad body 400; exactly-one-match rule (an ambiguous or empty match is loud, not first-wins); refusals written to stderr with the sections seen; STATE matching added and every coherent reply in `judge-replies.json` keyed on its facts.
- Lost coverage restored: call-time snapshot of run facts for pending calls — unit test `a pending call judges the run facts as they stood when it was made` (`src/core/judge.test.ts`; red with an `await` before the state copy) and offline e2e `e2e/stub/runner/growing-facts.test.ts` (the deleted room-booking flow, stub answers on STATE; red with the same mutation).
- Makefile: `.NOTPARALLEL`, `--runInBand`, `CRUCIBLE_VERBOSE` stripped with the key, `e2e-stub-jest`/`e2e-stub-vitest` depend on `e2e-compile` (no recursive make).
- `conformance.yml`: paths add `e2e/crucible.config.json` (the judge model) and `Makefile`; Dependabot PRs skipped (no secrets). `src/providers/**` not added: the harness never runs TS code, and TS = jq request parity is enforced by `spec-goldens-check` / `npm test` on every PR.
- `conformance.sh`: `curl --retry 2`.
- Docs: RELEASING step 2 names the `main` commit released from; instruction-schema no longer claims CI runs before releases; judge-models names the judge-config trigger and the stub port; PORTING says other e2e can run offline against a stub.
- `stub-judge.lifecycle.ts` uses a `StubJudgeHost` instance (no module-level mutable state).

### Completion Notes List

- Live calls: `make e2e` 72 → 2 (cjs-build: 1 coherent + 1 extract, 1 run each); CI per main push 22 → 2 (`e2e-core` only; `e2e-vitest` step removed); PR CI 0 (stub suites in `unit`).
- Conformance cases added (coherent, 4 → 9): `room-booking-unknown-room` (false), `room-booking-free-room` (true), `room-booking-appended-room` (true, state includes the appended Orion fact), `knowledge-boundary-sealed-winner-known` (false), `knowledge-boundary-sealed-winner-wondered` (true). Goldens regenerated.
- Stub: `StubJudgeServer` (node:http on `127.0.0.1:28731`, `POST /v1/chat/completions`, OpenAI envelope, replies from `e2e/stub/judge-replies.json` matched on CLAIM / TARGET (+ RESPONSE) of the last user message, 404 when unscripted → fatal provider error). Fixed port chosen over generated temp configs: config is read only from cwd with no env interpolation, a checked-in config needs no file writes, and the offline runs are sequential.
- Layout: `e2e/stub/` (config, Jest config, script, `runner/`, `projects/` + child fixtures, `vitest/`); `e2e/core/` = live smoke only; `e2e/ext/` = conformance harness + cases. Child processes still use `e2e/jest.config.mjs` (no stub lifecycle) with cwd = child project; the parent test file's server answers them.
- debug-trace: child gets sentinel `CRUCIBLE_JUDGE_KEY` (sent to the loopback stub, never printed); asserts the openai-compatible config/request trace lines. openai-compatible: child runs with the key removed (keyless loopback). failure-report: key removed. `JestProcess.run` accepts `undefined` to remove a variable; `revealsApiKey` (read the real key from `process.env`) removed.
- Makefile: `e2e-compile` (no key), `e2e-offline` (compile + `e2e-stub-jest` + `e2e-stub-vitest`, `CRUCIBLE_JUDGE_KEY` stripped), `e2e-core` (live smoke), `e2e: e2e-key e2e-offline e2e-core`; `e2e-ext` / `e2e-vitest` removed.
- CI: `unit` job runs `make e2e-offline` (both Node versions); main lane renamed, `make e2e-vitest` removed. New `.github/workflows/conformance.yml`: push to main + pull_request (path filters: `schemas/**`, `e2e/ext/fixtures/*-conformance.json`, `e2e/ext/conformance/**`, `src/core/payload-assembler.util.ts`, the workflow itself), weekly cron (Mon 05:23 UTC), `workflow_dispatch`; job guarded by `github.event_name != 'pull_request' || github.event.pull_request.head.repo.full_name == github.repository`; secret check step; `make conformance` with `CRUCIBLE_JUDGE_KEY`.
- Docs: RELEASING.md step 2 requires `make conformance` (or a green conformance run on the release commit) before tagging; `docs/judge-models.md` new "Where model behaviour is tested" section, stale e2e claims fixed; `docs/instruction-schema.md` and `docs/configuration.md` updated. CHANGELOG not touched (test-infra only, no user-visible change). `e2e/crucible.config.json` unchanged (OpenRouter).
- No `src/` production change; one unit test added in review.

### File List

- .github/workflows/ci.yml
- .github/workflows/conformance.yml (new)
- Makefile
- RELEASING.md
- docs/configuration.md
- docs/instruction-schema.md
- docs/judge-models.md
- spec/payload/coherent-conformance.json
- e2e/jest.config.mjs
- e2e/core/cjs-build.test.cts
- e2e/core/fixtures/cjs-smoke.json
- e2e/core/stateful-coherence.test.ts (deleted)
- e2e/core/fixtures/room-booking.json (deleted)
- e2e/ext/coherent-conformance.test.ts (deleted)
- e2e/ext/extract-conformance.test.ts (deleted)
- e2e/ext/knowledge-boundary.test.ts (deleted)
- e2e/ext/fixtures/knowledge-boundary.json (deleted)
- e2e/ext/fixtures/coherent-conformance.json
- e2e/stub/crucible.config.json (new)
- e2e/stub/jest.config.mjs (new)
- e2e/stub/judge-replies.json (new)
- e2e/stub/stub-judge.lifecycle.ts (new)
- e2e/stub/runner/plain-runner-gate.test.ts (moved from e2e/core/)
- e2e/stub/runner/runner-variants.test.ts (moved from e2e/core/)
- e2e/stub/runner/fixtures/plain-runner-gate.json (moved from e2e/core/fixtures/)
- e2e/stub/runner/fixtures/runner-variants.json (moved from e2e/core/fixtures/)
- e2e/stub/projects/debug-trace.test.ts (moved from e2e/ext/)
- e2e/stub/projects/failure-report.test.ts (moved from e2e/ext/)
- e2e/stub/projects/openai-compatible.test.ts (moved from e2e/ext/)
- e2e/stub/projects/fixtures/** (moved from e2e/ext/fixtures/projects/; configs point at the stub)
- e2e/stub/vitest/core-scenarios.test.ts (moved from e2e/vitest/)
- e2e/stub/vitest/fixtures/core-scenarios.json (moved from e2e/vitest/fixtures/)
- e2e/stub/vitest/vitest.config.ts (moved from e2e/vitest/)
- e2e/stub/vitest/stub-judge.setup.ts (new)
- e2e/test/stub-judge-server.util.ts (new)
- e2e/test/stub-judge-host.util.ts (new)
- e2e/test/stub-judge.enum.ts (new)
- e2e/test/judge-script.ts (new)
- e2e/test/judge-key.enum.ts (new)
- e2e/test/jest-process.util.ts
- e2e/test/trace-line.enum.ts
- e2e/test/extract-mode.enum.ts (deleted)
- e2e/stub/runner/growing-facts.test.ts (new, review)
- e2e/stub/runner/fixtures/growing-facts.json (new, review)
- e2e/ext/conformance/conformance.sh (review: curl retry)
- src/core/judge.test.ts (review: pending-call snapshot test)
- spec/PORTING.md (review)
- _bmad-output/implementation-artifacts/8-5-live-tests-only-where-needed.md (new)
- _bmad-output/implementation-artifacts/deferred-work.md
- _bmad-output/implementation-artifacts/sprint-status.yaml

## Change Log

- 2026-11-14: Story 8.5 implemented — TS conformance e2e deleted, stateful scenarios folded into conformance cases, stub-judge offline e2e (`make e2e-offline`, PR CI), one live smoke (2 calls), conformance workflow, release checklist. Status → review.
