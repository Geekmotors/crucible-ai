---
baseline_commit: 70745191cc50ee2e92f30e55b6a17827dfe18441
---

# Story 7.3: Run on Vitest

Status: done

## Story

As a developer whose project uses Vitest,
I want `import { crucible } from 'crucible-ai/vitest'` to give me the same API,
so that I can use Crucible without switching test runners.

## Acceptance Criteria

1. **Entry point.** `crucible-ai/vitest` (package `exports` subpath, `import` + `require`, each with `types`; built by tsdown) exports the same `crucible` API object, `CrucibleError`, `CrucibleVerdictError` and types as the root. Its wrapper is driven by a Vitest runner spec over `test` and `describe` imported from `vitest` (an injected source, not `globalThis`: Vitest globals are off by default). The root entry stays the Jest one and is unchanged.
2. **Shared core.** The API object is built by one factory that takes a runner spec; both entries call it. No duplicated core (composition root, gate, wrapper, validation, settings).
3. **Dependencies.** `vitest` `^5.1.0` is a devDependency and an optional peer; `jest` becomes an optional peer too (`peerDependenciesMeta`). The `crucible-ai/vitest` bundle imports `vitest` as an external; the root bundle never imports `vitest` (checked by `verify:pack`).
4. **Variants.** `crucible.it`: `only`, `skip`, `todo`, `each`, `for`, `skipIf(cond)`, `runIf(cond)`, plus `only.each`, `only.for`, `skip.each`, `skip.for` (chains built from a modifier list). `skipIf`/`runIf` return a registrar (table-style node). `crucible.describe`: `only`, `skip`, `todo`, `each`, `for`, `skipIf`, `runIf` and the same chains. Blocked with `usage`: `it.fails`, `it.concurrent` (same reasons as Jest's `failing`/`concurrent`), `describe.concurrent`, `describe.shuffle`, `describe.sequential` (they change scheduling/order assumptions). Unknown properties follow the 7.2 property rule.
5. **Context.** Non-table Vitest calls pass the test context first: dropped, so `crucible.it` bodies get `(t)` only. `each` spreads rows with no context: forwarded after `t`. `for` passes `(row, context)`: forwarded as `(t, row)`. Group callbacks get only their row values (Vitest's `describe(name, fn)` passes `test` to `fn`: dropped). Plain Vitest `test(name, crucible.gate(...))` bodies get `(t, vitestContext)` — documented.
6. **Group settings on Vitest.** Vitest collects `describe` callbacks after the enclosing callback returns, so the settings stack alone loses nesting. The Vitest spec reports the runner's current group path; settings are keyed by group, so nested `crucible.describe` and plain `describe` inside a `crucible.describe` inherit as on Jest. Async/thenable describe callbacks stay a `usage` error on Vitest (consistent across runners) — documented.
7. **Timeouts.** The computed timeout is Vitest's third argument `(name, fn, timeout)` for every test variant (`for` included).
8. **7.2 follow-ups.** `src/core/runner-wrapper.test.ts` with a runner-neutral fake spec; the `failing`/`concurrent` block reasons are a core constant used by both specs.
9. **Types.** Vitest-specific `CrucibleIt`/`CrucibleDescribe` (with `for`, `skipIf`, `runIf`, `describe.todo`) with JSDoc, exported from `crucible-ai/vitest` under the same names; `crucible` stays `Readonly`. Type tests in `e2e/`.
10. **Tests.** Unit tests for the Vitest spec over a fake Vitest `test`/`describe` (one fake per file): routing, context dropping, `for` row shape, `skipIf`/`runIf`, blocked properties, settings inheritance with deferred collection. No real Vitest in unit tests.
11. **e2e.** `e2e/vitest/` project with its own `vitest.config.ts`, a Makefile target that `make e2e` runs, importing the built package entry like the Jest e2e (package self-reference). Scenarios: `crucible.it` with `t.facts` + `coherent`; `crucible.it.each` with `extract`; `crucible.describe` group inheriting runs; plain Vitest `test` + `crucible.gate`. Runs 1 / threshold 1, ≤ 5 judge calls. Not run live here.
12. **Docs.** README (Requirements: Jest 30 or Vitest 5; "Using Vitest"), `docs/getting-started.md`, `docs/api.md` (Vitest variants and differences: context argument, blocked describe modifiers, async describe, timeouts, watch-mode cost), `docs/gotchas.md`, CHANGELOG `## Unreleased` → Added (optional-peer change noted). Not breaking for Jest users.

## Tasks / Subtasks

- [x] Core constant `BlockedReason` (inverted outcome, concurrent, scheduling); Jest spec uses it (AC 8)
- [x] `VariantNode.forward` (`all` | `none` | `first`) and `VariantNode.returns` (node of the registrar a table call returns); wrapper applies forwarding to test and group callbacks (AC 4, 5)
- [x] `runner-wrapper.test.ts` + runner-neutral fake spec in `src/core/test/` (AC 8)
- [x] `GroupSettings` optional group path: settings keyed by the runner's current group when the runner reports one; stack otherwise (AC 6)
- [x] `RunnerSpec.groupPath?`; composition root passes it to the gate's `GroupSettings` (AC 6)
- [x] `VitestBinding` spec over an injected `{ test, describe, currentGroup }` source; variant tree built from modifier/table lists; blocked map (AC 4, 5, 7)
- [x] `CompositionRoot` moved to core and parameterised by spec; `CrucibleApi.build(spec)` factory in `src/api`; root `crucible` and Vitest `crucible` both built by it (AC 1, 2)
- [x] Vitest API types + surface; `src/vitest.ts` entry; package.json exports/peers; tsdown entries; verify-pack (AC 1, 3, 9)
- [x] Unit tests: Vitest spec over `VitestFake` (AC 10)
- [x] e2e project + Makefile + type tests (AC 9, 11)
- [x] Docs + CHANGELOG (AC 12)

### Review Findings

Code review 2026-11-14 (Blind Hunter, Edge Case Hunter, Acceptance Auditor + packaging/real-Vitest probes from a packed tarball in a scratch project, no judge calls).

- [ ] [Review][Decision] `CrucibleApi` (internal factory) lives in `src/api/` — the spec's task list puts it there; CLAUDE.md says internals stay out of `src/api/`. Recommendation: keep (it builds the public object from `src/api` surface types; moving it to `src/core` would make core import api types).
- [ ] [Review][Decision] `exports["./vitest"].require` kept — `dist/vitest.cjs` always throws Vitest's own "cannot be imported in a CommonJS module" error (Vitest's `require` condition is a throwing stub), but the `.d.cts` types let TypeScript projects in CommonJS mode (`module: node16`) type-check; verified both. Recommendation: keep, documented in gotchas.
- [x] [Review][Patch] Silent fallback to 10 runs when Vitest's suite chain can't be read — `GroupSettings` now fails a group callback with `usage` when the runner reports a path but no enclosing group [src/core/group-settings.ts]
- [x] [Review][Patch] Plain `describe.concurrent` / `describe.shuffle` / `sequence.concurrent` leaked into Crucible tests — tests register with `{ timeout, concurrent: false }`, groups with `{ concurrent: false, shuffle: false }` (verified on real Vitest 5.1) [src/bindings/vitest.ts]
- [x] [Review][Patch] Vitest fake: top-level current suite had a parent link real Vitest lacks; no options-second signature, concurrency or shuffle model [src/bindings/test/vitest-runner.fake.ts]
- [x] [Review][Patch] Timeout unit test covered 3 variants via positional indexes — now one case per variant (only, skip, skipIf, runIf, each, for, only.each, skip.for) [src/bindings/vitest.test.ts]
- [x] [Review][Patch] No unit test for describe modifier chains (`describe.only.each`, `describe.skip.for`) [src/bindings/vitest.test.ts]
- [x] [Review][Patch] GroupSettings pushed the unused stack on Vitest too (two stores) [src/core/group-settings.ts]
- [x] [Review][Patch] e2e group scenario could burn 10 judge calls on an inheritance regression — a judge-free probe test runs first and the judged test asserts the probe ran once before calling the judge; inline describe name moved to the fixture [e2e/vitest/core-scenarios.test.ts]
- [x] [Review][Patch] e2e `testTimeout: 120000` masked timeout forwarding [e2e/vitest/vitest.config.ts]
- [x] [Review][Patch] `verify:pack` missed `import "vitest"` / `import("vitest")` [scripts/verify-pack.mjs]
- [x] [Review][Patch] Lockfile root lacked the `vitest` peer and `peerDependenciesMeta` [package-lock.json]
- [x] [Review][Patch] Vitest 5 needs Node 22.12+; docs said 22 [README.md, docs/getting-started.md]
- [x] [Review][Patch] Type tests missing `describe.sequential`, `skipIf(...).each`, `each(...).only` [e2e/test/crucible-vitest-typing.util.ts]
- [x] [Review][Patch] Unused `groups` state in the neutral runner fake; missing return type on `VitestBindingHarness.over` [src/core/test/neutral-runner.fake.ts, src/bindings/test/vitest-harness.util.ts]
- [x] [Review][Patch] Docs: timeout now passed as Vitest's `timeout` option; inherited scheduling and unsupported-Vitest behaviour; CJS note; CHANGELOG states `skipIf`/`runIf` return a plain registrar [docs/api.md, docs/gotchas.md, CHANGELOG.md]
- [x] [Review][Defer] `crucible.it`/`describe` from `crucible-ai/vitest` outside a Vitest run surface Vitest's raw `TypeError` instead of a `CrucibleError` [src/core/runner-wrapper.ts] — deferred, low value
- [x] [Review][Defer] A plain suite Vitest runs concurrently (e.g. `sequence.concurrent`) can still run alongside another suite holding Crucible tests; Crucible only opts out its own tests/groups [src/bindings/vitest.ts] — deferred, documented
- [x] [Review][Defer] `errorFrom` duplicated across four harnesses [src/**/test/*-harness.util.ts] — deferred, pre-existing pattern
- [x] [Review][Defer] Hand-built expected row names / inline error literals / run counters in binding tests [src/bindings/vitest.test.ts] — deferred, mirrors pre-existing jest.test.ts (7.2 defer)
- [x] [Review][Defer] Transitive tsdown/rolldown bumps in package-lock.json ride along — deferred, verify intent before merge
- [x] [Review][Defer] Binding harness re-wires Gate/GroupSettings instead of using CompositionRoot [src/bindings/test/vitest-harness.util.ts] — deferred, pre-existing harness pattern

## Dev Notes

### Current state (read before touching)

- `src/core/runner-wrapper.ts` — recursive Proxy per variant node; `register` (forms → `gate.declare`/`gate.group` → `spec.testArguments`/`groupArguments`), `passthrough`, `table` (wraps the returned registrar as a fixed `REGISTRAR` node with no variants). Property rule: variant → child; blocked → usage; function built-ins → target; known variant name or runner function property → usage; else `undefined`.
- `src/core/runner-spec.ts` — `VariantNode { call, variants }`, `RunnerFamily { subject, locate, node, blocked }`, `RunnerSpec { test, group, testArguments, groupArguments }`.
- `src/bindings/jest.ts` — `JestBinding(globals = globalThis).spec()`; Jest variant tree and blocked reasons live here today.
- `src/core/gate.ts` — `declare(own, body)` inherits group settings at declaration; gated test `(...args) => runner.execute(run => body(t, ...args))` forwards every runner argument.
- `src/core/group-settings.ts` — a synchronous layer stack pushed while a describe callback runs; rejects thenables/returned values.
- `src/api/crucible.ts` — `CompositionRoot` (lazy judge/extractor/gate/wrapper, config read lazily) + frozen `crucible`; wrapper hard-wired to `new JestBinding().spec()`.

### Vitest 5.1 facts (from `node_modules/vitest/dist/chunks/run.*.js`)

- `test(name, fn, timeout)` — number third argument is the timeout; an object third argument throws (removed in v4). Handler is called with the test context.
- `test.each(cases)(name, fn, timeout)` — handler gets `...items` (array-only tables) or the row, no context. `test.for(cases)(name, fn, timeout)` — handler gets `(item, context)`; a numeric third argument is the timeout at runtime (types omit it).
- `each`, `for`, `skipIf`, `runIf` use `this` (chain context): call them on their owner.
- `skipIf`/`runIf` exist only on the root; they return a chain.
- `describe(name, factory)`: the factory runs later, during collection, as `factory(test)`, inside `runWithSuite(collector)`; children are collected after the parent factory returns. `TestRunner.getCurrentSuite()` returns the current collector; `collector.suite.suite` is the parent suite.
- Chain keys: test `concurrent, skip, only, todo, fails`; describe `concurrent, shuffle, skip, only, todo`. `describe.each` handler gets row items, `describe.for` the row.

### Must preserve

Every existing test; root entry behaviour (Jest) unchanged; registration inert; `crucible.gate` unchanged.

### Testing

Fakes one per file under the area's `test/`, enums for literals, harness classes, outcome assertions only. `VitestFake` emulates deferred describe collection, contexts, `each`/`for` shapes, `skipIf`/`runIf`, focus/skip/todo, and a run that reports results.

### References

- [Source: _bmad-output/planning-artifacts/epics.md#Epic 7, Story 7.3]
- [Source: _bmad-output/implementation-artifacts/7-2-generic-runner-wrapper.md#Review Findings]
- [Source: _bmad-output/implementation-artifacts/deferred-work.md] (6.3 sync-only describe; 7.2 decisions)
- [Source: CLAUDE.md]

## Dev Agent Record

### Agent Model Used

Claude Opus 5.5 (claude-opus-5-5)

### Debug Log References

### Completion Notes List

- Ultimate context engine analysis completed - comprehensive developer guide created
- **TDD.** `runner-wrapper.test.ts` (neutral fake spec) red on forwarding (3 failing) → `VariantNode.forward` / `returns` in the wrapper green. Group-settings deferred-collection tests red (2) → `GroupSettings(path?)` green. `vitest.test.ts` red (module missing) → `VitestBinding` green (39). `crucible-api.test.ts` red (module missing) → `CompositionRoot` moved to core + `CrucibleApi.build(spec)` green.
- **Blocked reasons.** `src/core/blocked-reason.enum.ts` (`InvertedOutcome`, `ConcurrentTests`, `GroupScheduling`); Jest and Vitest specs map onto it.
- **Wrapper.** `VariantNode.forward` (`all` default | `none` | `first`) decides which runner arguments reach the gated test / group callback; `VariantNode.returns` is the node of the registrar a `table` call returns (default: the old plain registrar).
- **Groups on Vitest.** Vitest runs `describe` factories during collection, after the enclosing factory returns, so the stack loses nesting. `RunnerSpec.groupPath` (Vitest: `TestRunner.getCurrentSuite()` → `collector.suite` → `.suite` chain) keys each `crucible.describe` layer by its Vitest suite; `inherit` overlays the layers on the current path. Jest has no path → unchanged stack. Nested `crucible.describe` and plain `describe` in between inherit.
- **Vitest spec.** Test: register (forward none) with `only`/`skip` (built from a modifier list, each with `each`/`for`), `each` (rows spread), `for` (row only), `skipIf`/`runIf` (table → registrar, forward none), `todo` passthrough. Describe: same shape, `each`/`for` forward all, root/modifiers forward none (drops Vitest's `factory(test)` argument). Blocked: `it.fails`, `it.concurrent`, `describe.concurrent`/`shuffle`/`sequential`. Timeout third argument everywhere.
- **API factory.** `src/core/composition-root.ts` (was in `src/api/crucible.ts`) takes the spec and gives the gate `new GroupSettings(spec.groupPath)`. `src/api/crucible-api.ts` `CrucibleApi.build<It, Describe>(spec)` builds the frozen object; `src/api/crucible.ts` (Jest) and `src/api/crucible-vitest.ts` (Vitest: `test`, `describe`, `TestRunner` from `vitest`) both call it. Surface split: `CrucibleCoreSurface` + `CrucibleSurface` / `VitestCrucibleSurface`.
- **Package.** `exports["./vitest"]` (import/require + types), `peerDependencies` `jest ^30`, `vitest ^5.1.0`, both optional; `vitest ^5.1.0` devDependency; tsdown builds both entries in one config (shared chunk) with `vitest` external; `verify:pack` requires `dist/vitest.*` and checks only the vitest entries import `vitest`.
- **Real Vitest smoke (new scratch dir, no judge calls):** plain body got no extra args, `each` rows spread, `for` row whole + no context, `skipIf(true)` skipped, `runIf(true)` ran, nested `crucible.describe` and plain `describe` inside both ran 3 runs (inherited), `describe.each` rows forwarded, gate on plain `test` got the context, blocked access threw, Vitest test timeout = 7000 + 5000 for plain/for/each/skipIf.
- **e2e.** `e2e/vitest/` (config + `core-scenarios.test.ts` + fixture), 5 judge calls; `make e2e-vitest` (part of `make e2e`, also added to the CI main lane). Collection checked with a non-matching `-t` filter (5 tests collected, none run). Not run live.
- **Gate:** `npm run lint && npm run format:check && npm run typecheck && npm test && npm run build && npm run verify:pack && npx tsc --noEmit -p e2e` → exit 0 (944 tests, 32 suites).

### File List

- .github/workflows/ci.yml
- CHANGELOG.md
- Makefile
- README.md
- docs/api.md
- docs/getting-started.md
- docs/gotchas.md
- package.json
- package-lock.json
- scripts/verify-pack.mjs
- tsdown.config.ts
- e2e/test/crucible-vitest-typing.util.ts (new)
- e2e/vitest/vitest.config.ts (new)
- e2e/vitest/core-scenarios.test.ts (new)
- e2e/vitest/fixtures/core-scenarios.json (new)
- src/vitest.ts (new)
- src/api/crucible.ts
- src/api/crucible-api.ts (new)
- src/api/crucible-api.test.ts (new)
- src/api/crucible-core-surface.ts (new)
- src/api/crucible-surface.ts
- src/api/crucible-vitest.ts (new)
- src/api/vitest-crucible-describe.ts (new)
- src/api/vitest-crucible-it.ts (new)
- src/api/vitest-crucible-surface.ts (new)
- src/bindings/jest.ts
- src/bindings/vitest.ts (new)
- src/bindings/vitest.test.ts (new)
- src/bindings/test/vitest-argument.enum.ts (new)
- src/bindings/test/vitest-harness.util.ts (new)
- src/bindings/test/vitest-property.enum.ts (new)
- src/bindings/test/vitest-runner.fake.ts (new)
- src/core/blocked-reason.enum.ts (new)
- src/core/composition-root.ts (new)
- src/core/group-settings.ts
- src/core/group-settings.test.ts
- src/core/runner-spec.ts
- src/core/runner-wrapper.ts
- src/core/runner-wrapper.test.ts (new)
- src/core/test/deferred-groups.fake.ts (new)
- src/core/test/group-settings-harness.util.ts
- src/core/test/neutral-name.enum.ts (new)
- src/core/test/neutral-property.enum.ts (new)
- src/core/test/neutral-runner.fake.ts (new)
- src/core/test/runner-argument.enum.ts (new)
- src/core/test/runner-wrapper-harness.util.ts (new)
- _bmad-output/implementation-artifacts/7-3-vitest-adapter.md (new)
- _bmad-output/implementation-artifacts/deferred-work.md
- _bmad-output/implementation-artifacts/sprint-status.yaml

## Change Log

- 2026-11-14: Story 7.3 implemented — `crucible-ai/vitest` entry over a Vitest runner spec, shared API factory and composition root, group settings keyed by the runner's group path, forwarding policy per variant node, core blocked reasons, runner-neutral wrapper tests, e2e Vitest project, docs/CHANGELOG. Gate green (944 tests). Status → review.

### Review decisions (2026-11-14, delegated)

- `CrucibleApi` stays in `src/api/` (moving it into core would make core import API types).
- Keep the `require` condition for `./vitest` (types for CommonJS-mode TypeScript; runtime throws Vitest's own error — documented in gotchas).
- Keep forcing `concurrent: false` / `shuffle: false` on Crucible tests and groups (enforces the blocked-variant rule; documented).
- Lockfile: transitive version changes from installing vitest are within declared ranges; gate and live e2e pass on them.
