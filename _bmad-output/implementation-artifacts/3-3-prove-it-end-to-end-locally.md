---
baseline_commit: 03ec916
---

# Story 3.3: Prove it end-to-end locally

Status: review

## Story

As a library author,
I want a fixture-driven e2e suite runnable locally against real OpenRouter,
so that the critical path is proven with real inference on demand.

## Acceptance Criteria

1. **Fixture-driven core scenario.** A checked-in JSON fixture under `e2e/core/fixtures/` establishes a self-contained, domain-agnostic scenario: initial state, a state change, inputs (responses + claims) and the expected semantic verdict of each step. No external project, no SUT network call — the fixture *is* the SUT output. [Epic 3.3 AC 1, epic 3 description]
2. **`make e2e-core` proves the full path against the real provider.** With `OPENROUTER_API_KEY` set, `make e2e-core` runs the core scenario through config (`e2e/crucible.config.json`) → `crucible.it` multi-run (3–5 runs, gated) → `load` / `append` → `coherent` → real OpenRouter judge → three-zone verdict, and passes. The same claim + response is judged against different accumulated state with opposite expected verdicts, proving run state reaches the judge payload (closes 2.2 deferral "judge→payload wiring belongs to 3.3 e2e"). [Epic 3.3 AC 2, FR1–FR5]
3. **Built artifact, consumed like a user.** e2e tests import `crucible-ai` by package name (package `exports` self-reference) → `dist/`, never `src/`. The ESM entry is exercised by the core scenario; a `.cts` test exercises the CJS entry (`require` condition → `dist/index.cjs`) through a real `crucible.it` + `coherent` call, proving the `import.meta.url` package-root walk loads `schemas/coherent.md` from the built CJS artifact (closes 1.4 deferral, CJS half). The Makefile builds before running.
4. **`make e2e-ext` / `make e2e`.** `make e2e-ext` runs extended scenarios: the Story 1.3 conformance matrix (`e2e/ext/fixtures/coherent-conformance.json`) through the public API, a knowledge-boundary (anti-omniscience) scenario, a deliberate-failure scenario asserting the produced `CrucibleVerdictError` report (run in a child Jest process so the outer suite stays green), and a `CRUCIBLE_VERBOSE=debug` trace scenario against real OpenRouter. `make e2e` runs both. [Epic 3.3 AC 3]
5. **Composition-root wiring proven.** The deliberate-failure child project's `crucible.config.json` sets `testDefaults` and `excerptChars`; the report shows the run count from `testDefaults` and the excerpt cut at `excerptChars` (closes 2.5 / 3.1 "wiring belongs to 3.3 e2e"). The debug child shows env > config verbosity, the config-resolved header, provider traffic with the loaded state in the traced prompt, and never the API key (closes 3.2 "debug trace against real OpenRouter").
6. **Manual-only, never in PR CI.** No pre-commit hook, no CI workflow change (3.5 owns the main-merge lane). Unit `npm test` never matches e2e files and stays provider-free. [AR10, AD-12]
7. **Missing key aborts fast.** Without `OPENROUTER_API_KEY` every e2e target exits non-zero before building or starting Jest, with an actionable message naming the variable and how to set it. [Epic 3.3 AC 4]
8. **Not shipped.** `npm pack --dry-run` lists no `e2e/`, fixture or dogfood config files (`files` = `dist`, `schemas`).
9. **Spend bounded.** Modest runs (core gate 3 runs); a full `make e2e` costs ~25 judge calls on the cheap default judge model (`deepseek/deepseek-v4-flash-0731`, docs/judge-models.md).
10. **Quality gates.** `npm run lint && npm run format:check && npm run typecheck && npm test && npm run build` green; `grep -rn 'console\.' src --include='*.ts'` empty; e2e TypeScript type-checks (`tsc --noEmit -p e2e`, run by the Makefile after build).

## Tasks / Subtasks

- [x] Task 1: e2e harness scaffold (AC 3, 6, 8)
  - [x] 1.1 `e2e/jest.config.mjs` (separate config; ts-jest ESM for `.ts`, CJS for `.cts`; `testMatch` `core|ext/**/*.test.{ts,cts}`).
  - [x] 1.2 `e2e/tsconfig.json` extends root, `resolveJsonModule`.
  - [x] 1.3 `e2e/crucible.config.json` dogfood config (provider openrouter, cheap model, no key).
- [x] Task 2: Makefile (AC 2, 4, 7) — key guard → build → `tsc -p e2e` → Jest with `--experimental-vm-modules --use-system-ca`, cwd `e2e/`.
- [x] Task 3: core scenario (AC 1, 2) — fixture + ESM test.
- [x] Task 4: CJS build test (AC 3).
- [x] Task 5: ext scenarios (AC 4, 5) — conformance, knowledge boundary, deliberate failure (child Jest), debug trace (child Jest).
- [x] Task 6: Run for real within spend cap; verify missing-key abort; gates; pack dry-run (AC 7–10).

## Dev Notes

### Current state

- `Makefile` targets are placeholders (`exit 1`). `e2e/core` and `e2e/ext` hold only `.gitkeep` + `e2e/ext/fixtures/coherent-conformance.json` (Story 1.3 matrix, 4 cases).
- Root `jest.config.mjs` `testMatch: ['**/src/**/*.test.ts']` — e2e files can never match it. Keep it untouched.
- Config is read from `process.cwd()/crucible.config.json` (`FileSystemConfigBoundary`) → Jest must run with cwd = the directory holding the config (`e2e/`, or a child project dir).
- `SchemaSource.packageRootDir()` walks up from `import.meta.url`; tsdown's CJS output shims it as `pathToFileURL(__filename)` (verified in `dist/index.cjs`). From `dist/` it reaches the repo `package.json` → `schemas/coherent.md`.
- `OpenRouterAdapter` throws `CrucibleError('config')` (fatal) at the first judge call when the key is missing — the Makefile guard aborts earlier.
- `crucible.it` registers through the global `it` (injectGlobals must stay on); the thrown `CrucibleVerdictError` fails the enclosing Jest test, so a deliberately failing scenario must run in a child Jest process.

### Design decisions (settled — user away)

- **Package self-reference** (`import { crucible } from 'crucible-ai'`): verified Jest 30 resolves the repo's own `exports` from inside the repo — ESM `import` → `dist/index.js`, `.cts` → `require` condition → `dist/index.cjs` (checked by moving each file away). No `moduleNameMapper`, no path to dist.
- **Separate config** `e2e/jest.config.mjs`, run from `e2e/` by the Makefile; `NODE_OPTIONS="--experimental-vm-modules --use-system-ca"` (docs/judge-models.md TLS-proxy gotcha).
- **Type-check** of e2e is `tsc --noEmit -p e2e` in the Makefile after `npm run build` (needs `dist/*.d.ts`; ts-jest is transpile-only under the root `isolatedModules`). `npm run typecheck` stays src-only so the PR lane needs no build first.
- **Child-process scenarios** live in `e2e/ext/fixtures/projects/<name>/` (own `crucible.config.json` + `*.scenario.ts`, never matched by `testMatch`); the outer test spawns Jest once per project (`beforeAll`) and asserts the rendered output (report contract), one purpose per test.
- **Key never in output**: leak check uses `includes(...)` → boolean so a failing assertion cannot print the key.

### Testing rules (CLAUDE.md applies to e2e)

Helpers in classes under `e2e/test/` (`*.util.ts` / `*-harness.util.ts`), enums for repeated literals (`*.enum.ts`), `type` not `interface`, named exports at file end, no comments, no `__tests__`. Fixture data drives assertions — no inline magic strings.

### Previous story intelligence

- 2.2: payload-capture unit tests were removed as forbidden; judge→payload wiring deferred here.
- 2.5 / 3.1: composition-root wiring of `testDefaults` / `excerptChars` not unit-testable (real config) → e2e.
- 3.2: debug trace against real OpenRouter; meta keys only; key never traced.
- 1.4 deferral: CJS + bundler-inlined schema walk. Bundler-inlined consumers stay deferred (no bundler in this repo).

### References

- [Source: _bmad-output/planning-artifacts/epics.md#Story 3.3, #Story 3.4, #Story 3.5]
- [Source: ARCHITECTURE-SPINE.md AD-12, Structural Seed]
- [Source: _bmad-output/implementation-artifacts/deferred-work.md]
- [Source: docs/judge-models.md]

## Dev Agent Record

### Agent Model Used

Claude Opus 5.5 (claude-opus-5-5), unattended (user away — decisions recorded below).

### Debug Log References

- Self-reference resolution verified before design was fixed: with `dist/index.cjs` moved away the `.cts` test failed to resolve `crucible-ai`; with `dist/index.js` moved away the `.ts` test failed — ESM → `index.js`, CJS → `index.cjs`.
- Missing key: `env -u OPENROUTER_API_KEY make e2e-core` → exit 2 in 0.06 s, before build/Jest, with the message naming `OPENROUTER_API_KEY` and how to export it.
- Iterations against real OpenRouter (all on `deepseek/deepseek-v4-flash-0731`): (1) default reasoning → knowledge-boundary body (3 sequential calls) hit the 32 s deadline (`ERRORED`, 2 runs discarded); a direct probe measured ~11.7 s/call, ~2,200 reasoning tokens. (2) `reasoning.enabled: false` → ~2 s/call but the room-booking gate failed 2/3 runs (wrong verdict on the appended-state step). (3) `reasoning.effort: "low"` → room-booking 3/3 twice (~14–15 s per test); the temporal knowledge-boundary step was still slow/inconsistent → fixture made two-step (no superseding state).
- Final: `make e2e` green — e2e-core 2/2 tests, e2e-ext 15/15 tests, ~29 s wall clock.
- Live judge calls across all executions in this story: ~162 (incl. 3 direct latency probes, one on `google/gemini-3.8-flash`). Estimated spend under $0.10.
- Gates: lint, format:check, typecheck, unit (350/350, 15 suites — unchanged, provider-free), build green; `grep -rn 'console\.' src --include='*.ts'` empty; `npm pack --dry-run` = LICENSE, README.md, package.json, dist/*, schemas/* only; no OpenRouter key prefix in any changed or new file.

### Completion Notes List

- Ultimate context engine analysis completed - comprehensive developer guide created.
- **No `src/` change.** The story is pure e2e/tooling; every behaviour is exercised through the built package, so no TDD cycle on `src/` was needed (unit suite untouched, 350 tests).
- **Built artifact like a user (AC 3):** tests import `crucible-ai` by name; Jest 30 resolves the repo's own `exports` (package self-reference). No `moduleNameMapper` for the package, no path into `dist/`. The Makefile always runs `npm run build` first.
- **CJS (AC 3, closes 1.4 deferral's CJS half):** `e2e/core/cjs-build.test.cts` runs a real `crucible.it` + `coherent` through `dist/index.cjs`; the tsdown `__filename` shim of `import.meta.url` finds the package root and `schemas/coherent.md`. Bundler-inlined consumers remain deferred.
- **Core scenario (AC 1, 2):** `e2e/core/fixtures/room-booking.json` — loaded schedule, three steps, one append; step 1 and step 3 judge the identical response + claim and expect `false` then `true`, so a pass proves loaded and appended run state reach the judge payload (closes the 2.2 "judge→payload wiring" deferral). Gate `{ runs: 3, threshold: 0.6 }` (need 2) — tolerates one judge wobble, still fails on a systematic break.
- **ext (AC 4, 5):** conformance matrix (4 smoke tests through the public API, reusing the 1.3 fixture), knowledge-boundary gate, deliberate failure and debug trace.
- **Deliberate failure without failing the suite (decision):** child projects under `e2e/ext/fixtures/projects/<name>/` (own `crucible.config.json`, `*.scenario.ts` never matched by the e2e `testMatch`) are run by `JestProcess` (`e2e/test/jest-process.util.ts`) in a child Jest with `cwd` = the project, once per suite (`beforeAll`), and the outer tests assert the outcome: non-zero exit, the `FAILED: 0/2 … (need 2).` headline (runs/threshold from the project's `testDefaults`), the failed claim, and `Response excerpt (first 40 of N chars)` (the project's `excerptChars`) — closes the 2.5 and 3.1 composition-root wiring deferrals. Chosen over hijacking the global `it`, which would test a binding internal rather than what a user sees.
- **Debug trace against real OpenRouter (closes 3.2 deferral):** child run with `CRUCIBLE_VERBOSE=debug` over a config saying `default` — asserts exit 0, `config resolved` header (env > config), provider request line, the loaded state fact inside the traced `prompt (… chars): STATE <<< …` payload, `judge verdict true`, and that the output never contains the API key (boolean `includes` so a failure cannot print the key).
- **Judge config (decision):** dogfood config `e2e/crucible.config.json` = OpenRouter + `deepseek/deepseek-v4-flash-0731` (docs/judge-models.md default) + `meta.reasoning.effort: "low"` — default reasoning blew the per-test deadline, reasoning disabled was unreliable (see Debug Log). Also dogfoods `meta` passthrough end to end. Findings added to docs/judge-models.md.
- **Makefile (AC 2, 4, 7):** `e2e-key` guard (exit 2, actionable message) → `e2e-build` (`npm run build`, `tsc --noEmit -p e2e`) → Jest from `e2e/` (config is read from cwd) with `NODE_OPTIONS="--experimental-vm-modules --use-system-ca"` (TLS-proxy gotcha from 1.3) and `--testPathPatterns 'e2e/core/'` / `'e2e/ext/'`. `make e2e` builds once (shared prerequisite). The Makefile never sources `.env*` files — the key comes only from the caller's environment.
- **Isolation (AC 6, 8):** root `jest.config.mjs` untouched (`**/src/**/*.test.ts`), so `npm test` cannot pick up e2e; no hook, no workflow change (3.5 owns CI). `files` = `dist`, `schemas` → nothing from `e2e/` packs.
- **Fixture changes from findings (decision):** fixtures are monotonic — appends add facts, never contradict loaded ones — because the schema has no rule for superseding state (deferred). Knowledge boundary is a two-step leak/withhold gate; the append path is covered by the core scenario.
- **Findings deferred** (deferred-work.md): per-test deadline too tight for sequential assertions on reasoning judges; report attributes the "first failed assertion" to an *expected*-false verdict (AD-13) — observed in a real failure; no state-supersession rule in `coherent.md`; reasoning-disabled judge unreliable; e2e typecheck not in PR lane. The 1.4 deferral entry was updated (CJS half closed).
- **Not done (scope):** bundler-inlined schema walk (no bundler here), Story 3.4 docker conformance, Story 3.5 CI lane, README/docs set (3.6).

### File List

- `Makefile`
- `e2e/jest.config.mjs` (new)
- `e2e/tsconfig.json` (new)
- `e2e/crucible.config.json` (new)
- `e2e/core/.gitkeep` (deleted), `e2e/ext/.gitkeep` (deleted)
- `e2e/core/stateful-coherence.test.ts` (new), `e2e/core/fixtures/room-booking.json` (new)
- `e2e/core/cjs-build.test.cts` (new), `e2e/core/fixtures/cjs-smoke.json` (new)
- `e2e/ext/coherent-conformance.test.ts` (new)
- `e2e/ext/knowledge-boundary.test.ts` (new), `e2e/ext/fixtures/knowledge-boundary.json` (new)
- `e2e/ext/failure-report.test.ts` (new)
- `e2e/ext/fixtures/projects/failure-report/crucible.config.json`, `scenario.json`, `deliberate-failure.scenario.ts` (new)
- `e2e/ext/debug-trace.test.ts` (new)
- `e2e/ext/fixtures/projects/debug-trace/crucible.config.json`, `scenario.json`, `debug-trace.scenario.ts` (new)
- `e2e/test/gate.enum.ts`, `child-project.enum.ts`, `report-line.enum.ts`, `trace-line.enum.ts`, `verbosity-override.enum.ts` (new)
- `e2e/test/jest-outcome.ts`, `jest-process.util.ts`, `trace-pattern.util.ts` (new)
- `docs/judge-models.md`
- `_bmad-output/implementation-artifacts/3-3-prove-it-end-to-end-locally.md` (new)
- `_bmad-output/implementation-artifacts/deferred-work.md`
- `_bmad-output/implementation-artifacts/sprint-status.yaml`

### Change Log

- 2026-11-13: Story 3.3 implemented — fixture-driven e2e against the built package and real OpenRouter (`make e2e-core` / `e2e-ext` / `e2e`), CJS build check, deliberate-failure and debug-trace child projects, missing-key guard. Status → review.
