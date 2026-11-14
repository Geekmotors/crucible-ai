---
baseline_commit: 0ac16b51eb470fac7d578be7c492b05840cbf0a0
---

# Story 7.2: `crucible.it` and `crucible.describe` as a generic runner wrapper

Status: done

## Story

As a developer used to Jest's `only`, `skip`, `todo` and `each`,
I want every variant of the runner's `it` and `describe` on `crucible.it` and `crucible.describe`,
so that I focus, skip, plan and parameterise inference tests exactly as I do other tests.

## Acceptance Criteria

1. **Generic wrapper.** `crucible.it` / `crucible.describe` are built by a runner-neutral wrapper (recursive `Proxy`) over the runner's own `it` / `describe`, parameterised by a small runner spec (variant tree, blocked properties, how the runner takes name/test/timeout and name/callback). A property path (`only`, `skip`, `todo`, `each`, `only.each`, `skip.each`) yields a wrapped version of the runner's same path; calling it strips Crucible options, wraps the body with the gate (or the describe callback with the group settings scope), supplies the computed timeout (test variants) and forwards to the runner's same function, called on its owner. The functions a call returns (`each(table)`) are wrapped the same way.
2. **Supported.** `crucible.it`, `.only`, `.skip`, `.todo`, `.each`, `.only.each`, `.skip.each`; `crucible.describe`, `.only`, `.skip`, `.each`, `.only.each`, `.skip.each`. `todo` is body-less and passes straight through (no options).
3. **each.** `crucible.it.each(table)(name, [options,] async (t, ...row) => ..., [timeout])`: the runner's `each` formats names and spreads row values; the gate forwards them after `t`. `crucible.describe.each(table)(name, [options,] (...row) => ...)`: callback wrapped with the settings scope, row values forwarded. Array rows and object rows both work.
4. **Blocked.** `failing`, `concurrent` (and any chain through them) and any unknown string property are a `usage` error on access; runner properties are never forwarded unless in the spec's variant tree. Function built-ins (`call`, `apply`, `bind`, `length`, `name`, symbols) keep working.
5. **Forms & validation.** Every test variant takes exactly today's four `crucible.it` forms, every group variant today's two `crucible.describe` forms, with the same `usage` errors. One runner-neutral validator (`DeclarationForms`) replaces the duplicated JestBinding/Gate validation; `crucible.gate` uses it too (same forms and errors as today). Registration stays inert (no config read); argument errors come before the runner lookup.
6. **Timeouts.** Wrapped test variants pass the computed timeout (resolved `testTimeout` + margin, capped) to the runner; trailing timeout rules unchanged.
7. **Compatibility.** Existing behaviour and tests of `crucible.it` / `crucible.describe` stay green and unchanged in meaning (harness adapted to the wrapper); the hand-written registration paths are removed.
8. **Types.** Every supported variant typed with JSDoc (hand-written call-signature types in `src/api/`), `crucible` stays `Readonly`, blocked variants absent from the types. `each` infers tuple rows (spread after `t`), single values and object rows. Type tests per variant in `e2e/test/` (valid + invalid incl. row typing).
9. **e2e.** New live scenario using `crucible.it.each` and `crucible.describe.each` (runs 1 / threshold 1, ≤ 4 judge calls), plus `it.skip` / `it.todo` (no judge calls). Not run live here.
10. **Docs.** docs/api.md: variants section (supported, blocked and why — `failing` is ambiguous under pass-rate gates, `concurrent` conflicts with already-concurrent runs and deadlines) replacing the "no `.only/.skip/.each`" notes; README short `crucible.it.each` example; CHANGELOG `## Unreleased` → Added. Not breaking.

## Tasks / Subtasks

- [x] `DeclarationForms` (core util): `test(subject, args, acceptsTimeout)` → `{ opts, body }` (trailing timeout merged into `testTimeout`), `group(args)` → `{ options, callback }`; same errors as today (AC 5)
- [x] `Gate.wrap` on `DeclarationForms` (no timeout slot); `GroupSettings.declare` returns a callback forwarding row args (AC 3, 5)
- [x] `RunnerSpec` types (core): `VariantNode { call: 'register' | 'passthrough' | 'table', variants }`, `RunnerFamily { subject, kind, locate, node }`, spec `{ test, group, blocked, testArguments, groupArguments }` (AC 1)
- [x] `RunnerWrapper` (core): Proxy nodes; get → variant / blocked usage / function built-in / unknown usage; apply → register (test: forms + gate.declare + timeout; group: forms + gate.group), passthrough, table (wrap returned registrar) (AC 1–6)
- [x] `JestBinding` → Jest runner spec over injected globals (default `globalThis`), lazy lookup with today's usage error (AC 1)
- [x] Composition root + `src/api` types `CrucibleIt`, `CrucibleDescribe` (+ registrars/tables) with JSDoc; surface uses them; entry exports (AC 8)
- [x] Unit tests with a fake runner (`src/core/test/fake-runner.fake.ts`): runs focused/skipped/todo, each array/object rows, name formatting, chains, blocked/unknown, describe variants with settings inheritance; jest.test.ts kept, harness adapted (AC 1–7)
- [x] Type tests `e2e/test/crucible-variants-typing.util.ts` (AC 8)
- [x] e2e `e2e/core/runner-variants.test.ts` + fixture (AC 9)
- [x] Docs + CHANGELOG (AC 10)

### Review Findings

- [ ] [Review][Decision] RunnerWrapper has no test file beside it — wrapper behaviour is tested through the Jest spec in `src/bindings/jest.test.ts` with the fake in `src/bindings/test/`. Recommend adding `src/core/runner-wrapper.test.ts` with a runner-neutral fake spec in 7.3, when a second spec exists, keeping jest.test.ts as the Jest-spec suite.
- [ ] [Review][Decision] Blocked reasons (`failing`, `concurrent`) are Crucible policy but live in the Jest adapter — recommend moving the reason text to a core constant in 7.3 so the Vitest spec maps `fails`/`concurrent` onto it.
- [x] [Review][Patch] Unknown properties threw usage errors on tooling probes (`then`, `toJSON`, `asymmetricMatch`, `_isMockFunction`, `prototype`) — now: variants → wrapped; blocked → usage; Function built-ins → target; variant names in the wrong place or runner variants Crucible does not wrap → usage; anything else → undefined [src/core/runner-wrapper.ts]
- [x] [Review][Patch] Proxy target showed as `[Function: target]` — named after its path (`crucible.it.only`) [src/core/runner-wrapper.ts]
- [x] [Review][Patch] No `has` trap — `'each' in crucible.it` now true for supported variants [src/core/runner-wrapper.ts]
- [x] [Review][Patch] Blocked list shared by both families with test-only reasons — now per family; describe has none [src/core/runner-spec.ts, src/bindings/jest.ts]
- [x] [Review][Patch] Group validation split across DeclarationForms and GroupSettings, messages fixed to `crucible.describe` — options and callback validated in `DeclarationForms.group`; GroupSettings takes the subject for its return-value checks [src/core/declaration-forms.util.ts, src/core/group-settings.ts, src/core/gate.ts]
- [x] [Review][Patch] Argument tightening not in CHANGELOG — Breaking entry added; docs/api.md unknown-property and todo wording corrected [CHANGELOG.md, docs/api.md]
- [x] [Review][Patch] `readonly` in test helper type [src/bindings/test/jest-harness.util.ts]
- [x] [Review][Patch] Type tests missed tagged templates, describe.each row typing and absent describe variants [e2e/test/crucible-variants-typing.util.ts]
- [x] [Review][Defer] No `ownKeys`/`getOwnPropertyDescriptor` traps (`Object.keys(crucible.it)` is empty) [src/core/runner-wrapper.ts] — deferred, cosmetic
- [x] [Review][Defer] Runtime variant tree and public types can drift (proxy cast to `CrucibleIt`) [src/api/crucible.ts] — deferred, type tests cover the current tree
- [x] [Review][Defer] Trailing timeout `null` is a usage error (Jest treats it as default) [src/core/declaration-forms.util.ts] — deferred, pre-existing
- [x] [Review][Defer] Expected row names in tests repeat the TestName templates (`counts ${...}`) [src/bindings/jest.test.ts] — deferred, low

## Dev Notes

### Current state (read before touching)

- `src/bindings/jest.ts` — `JestBinding(gate, registrar, groupRegistrar)`: `register(name, optsOrBody, bodyOrTimeout?, timeout?)` normalizes the four forms (usage: two bodies, missing body, surplus after timeout, trailing timeout + `testTimeout`, invalid timeout via `RunOptionsResolver.validate` subject `crucible.it options`) then `gate.declare(opts, body)` → `registrar(name, test, timeout)`. `group(name, optsOrBody, body?, ...surplus)` → surplus check → `gate.group` → `groupRegistrar`. Lazy `globalThis.it/describe` lookups throw `usage` when missing.
- `src/core/gate.ts` — `wrap(optsOrBody, body?, ...surplus)`: its own copy of the form validation (no timeout slot; subject `crucible.gate options`); `declare(own, body)` → `{ test, timeout }` (inherits group settings at call time; `test` declares zero params and forwards runner args after `t`); `group(options, body)` → `GroupSettings.declare`.
- `src/core/group-settings.ts` — `declare(options, body)` checks callback is a function, validates options, returns `() => collect(layer, body)`; sync-only, nothing returned.
- `src/api/crucible.ts` — frozen `crucible`; `it`/`describe` call `compositionRoot.jestBinding()`.

### Design

- Proxy target per node: an arrow function (no non-configurable `prototype`, so no invariant clashes). `get`: variant → child node; blocked → `usage` naming the reason; symbol or `key in target` → `Reflect.get(target, key)` (so `call/apply/bind` route back through the `apply` trap); else `usage` (unknown). `set`/`defineProperty`/`deleteProperty` refuse.
- `apply`: validate first, then locate the runner function (lazily, path walked from the family root; a missing path is `usage`), then `Reflect.apply(fn, owner, spec.testArguments(name, test, timeout))`.
- Subject for messages = the path (`crucible.it.only.each`), options subject `"<path> options"`; base path keeps today's `crucible.it options`.
- `DeclarationForms.test`: `[first, ...rest]`; first function → body (second function = two bodies); else validate options, second must be a function; the slot after the body is the timeout when accepted; any defined argument after that is `usage`; a timeout with `testTimeout` in the same options is `usage`; merged timeout re-validated.

### Must preserve

- Every existing jest binding, gate, group-settings and api test (meaning unchanged). Registration inert. Missing global `it`/`describe` → `usage`.

### Testing

- Fake runner: callable `it`/`describe` objects with `only/skip/todo/each/failing/concurrent`; `run()` executes like a runner (focus, skip, todo, nested describe names, `%s`/`$key` formatting) and returns results; tests assert outcomes (results, body run counts, names, error kind). One fake per file, enums for literals, harness class, no comments.

### References

- [Source: _bmad-output/planning-artifacts/epics.md#Epic 7, Story 7.2]
- [Source: _bmad-output/implementation-artifacts/7-1-gate-and-run-context.md]
- [Source: _bmad-output/implementation-artifacts/6-3-describe-group-settings.md]
- [Source: _bmad-output/implementation-artifacts/deferred-work.md] (sync-only describe in core; Jest default timeout note)
- [Source: CLAUDE.md]

## Dev Agent Record

### Agent Model Used

Claude Opus 5.5 (claude-opus-5-5)

### Debug Log References

### Completion Notes List

- Ultimate context engine analysis completed - comprehensive developer guide created
- **TDD.** `declaration-forms.util.test.ts` red (module missing) → `DeclarationForms` green (30). Group-settings row-forwarding test red → `GroupSettings.declare` returns `(...args) => collect(...)` green. Variant tests (fake runner) red (wrapper/spec missing) → `RunnerSpec`, `RunnerWrapper`, `JestBinding.spec()` green. Existing jest binding tests kept, only the harness/type references changed (`BindingUnderTest` = wrapped `it`/`describe` over the old `RegistrarFake`/`DescribeRegistrarFake` as globals).
- **Validator.** `DeclarationForms.test` (four forms + trailing timeout), `.gate` (no timeout slot), `.group` (two forms, positional/surplus only; callback + options still checked by `GroupSettings.declare`). `Gate.wrap(...args)` and the wrapper both use it; the JestBinding/Gate duplicates are gone. Subject in messages is the variant path (`crucible.it.only.each options`); base path unchanged (`crucible.it options`, `crucible.gate options`). Slight tightening: any defined argument after the last slot is `usage` (before, a 5th `crucible.it` argument was ignored).
- **Wrapper.** `RunnerWrapper(gate, spec)`: `test()`/`group()` return a recursive `Proxy` over an arrow target. `get`: variant in the node → memoised child; `spec.blocked` → `usage` with the reason; symbols and function built-ins (`call`, `apply`, `bind`, `length`, ...) → target; anything else → `usage` listing the supported variants. `set`/`defineProperty`/`deleteProperty` refuse. `apply`: `register` (validate → `gate.declare` or `gate.group` → locate lazily → `Reflect.apply(fn, owner, spec.testArguments(name, test, timeout))`), `passthrough` (`todo`), `table` (call runner's `each`, wrap the returned registrar as a register node). Missing runner function at a path → `usage`.
- **Spec.** `RunnerSpec { test, group: { subject, locate, node }, blocked, testArguments, groupArguments }`, `VariantNode { call, variants }`. `JestBinding(globals = globalThis).spec()` supplies Jest's tree (it: only/skip → each, todo, each; describe: only/skip → each, each), blocked `failing`/`concurrent` with reasons, and the lazy global lookup with today's usage error.
- **Types.** `src/api/crucible-it.ts` (`CrucibleIt`, `TestRegistrar` with the four documented overloads, `TestVariant`, `TestTable` with tuple-row / single-value-or-object / tagged-template overloads, `RowTestRegistrar`, `RowTestBody`) and `src/api/crucible-describe.ts` (same for groups). `CrucibleSurface.it: CrucibleIt`, `.describe: CrucibleDescribe`; `CrucibleIt`/`CrucibleDescribe` exported from the entry point. Type tests `e2e/test/crucible-variants-typing.util.ts`.
- **Real Jest smoke (scratchpad, not committed, no judge calls):** built dist under real Jest: `it.each` array/object rows with runs 2, `describe.each` inheriting runs 3, `it.skip`, `describe.skip`, `it.todo`, `it.only.each`, `describe.only`, blocked `failing` — all as expected. The new e2e file also collects under real Jest + ts-jest (6 tests; ran with `-t` on skip/todo only, so no judge calls).
- **e2e.** `e2e/core/runner-variants.test.ts` + fixture: `crucible.it.each` (2 rows, extract) and `crucible.describe.each` (2 groups, coherent with `t.facts`), runs 1 / threshold 1 → 4 judge calls; plus `it.skip`, `it.todo`. Not run live.
- **Docs.** api.md variants section (supported, blocked and why), notes replaced, types table; README "Focus, skip and parameterise"; CHANGELOG Unreleased → Added.
- **Deviation from Dev Notes:** the fake runner lives in `src/bindings/test/fake-runner.fake.ts` and the variant tests in `src/bindings/jest.test.ts` (they drive the core wrapper through the real Jest spec over fake globals, keeping core tests free of binding imports).
- **Gate:** `npm run lint && npm run format:check && npm run typecheck && npm test && npm run build && npm run verify:pack && npx tsc --noEmit -p e2e` → exit 0 (873 tests, 29 suites).

### File List
- CHANGELOG.md
- README.md
- docs/api.md
- e2e/core/runner-variants.test.ts (new)
- e2e/core/fixtures/runner-variants.json (new)
- e2e/test/crucible-variants-typing.util.ts (new)
- src/index.ts
- src/api/crucible.ts
- src/api/crucible-surface.ts
- src/api/crucible-it.ts (new)
- src/api/crucible-describe.ts (new)
- src/bindings/jest.ts
- src/bindings/jest.test.ts
- src/bindings/test/jest-harness.util.ts
- src/bindings/test/fake-runner.fake.ts (new)
- src/bindings/test/runner-property.enum.ts (new)
- src/bindings/test/test-name.enum.ts (new)
- src/bindings/test/test-status.enum.ts (new)
- src/core/declaration-forms.util.ts (new)
- src/core/declaration-forms.util.test.ts (new)
- src/core/gate.ts
- src/core/group-settings.ts
- src/core/group-settings.test.ts
- src/core/runner-spec.ts (new)
- src/core/runner-wrapper.ts (new)
- src/core/test/declaration-forms-harness.util.ts (new)
- src/core/test/declaration-subject.enum.ts (new)
- src/core/test/invalid-declaration.enum.ts (new)
- _bmad-output/implementation-artifacts/7-2-generic-runner-wrapper.md (new)
- _bmad-output/implementation-artifacts/sprint-status.yaml

## Change Log

- 2026-11-14: Story 7.2 implemented — generic runner wrapper (`RunnerWrapper` + `RunnerSpec`), Jest spec, unified `DeclarationForms` validator, `crucible.it`/`crucible.describe` variants (only/skip/todo/each and chains), types, e2e scenario, docs/CHANGELOG. Gate green (873 tests). Status → review.
