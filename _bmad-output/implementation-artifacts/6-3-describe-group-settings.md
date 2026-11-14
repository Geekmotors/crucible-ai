---
baseline_commit: 17fdf01
---

# Story 6.3: Group settings with `crucible.describe`

Status: done

## Story

As a developer with many tests that share run settings,
I want to declare them once on a group,
so that each `crucible.it()` only states what differs.

Jack's decisions (2026-11-14), not to be re-litigated:

- API: `crucible.describe(name, fn)` and `crucible.describe(name, options, fn)`; `options` takes the same fields as `crucible.it()` options (`RunOptions`). Registers a real Jest `describe` with the given name; every `crucible.it()` registered inside (at any depth) inherits.
- Resolution, per field, last wins: built-in default → config `testDefaults` → outer `crucible.describe` → inner `crucible.describe` → the `it`'s own options (a trailing timeout number counts as the `it`'s `testTimeout`). Fields merge independently. Plain Jest `describe` nested inside/around keeps inheritance working. A `crucible.it()` outside any `crucible.describe` behaves exactly as today.
- Default `testTimeout` formula is computed from the RESOLVED runs, unless a `testTimeout` is declared at any level (then the nearest declared wins). Explicit in tests and docs.
- An `it`-level trailing timeout plus `testTimeout` in the SAME `it`'s options stays a usage error; a describe-level `testTimeout` plus an `it`-level trailing timeout is NOT an error (the `it` wins).
- Validation: same rules as `crucible.it()` options (usage error at collection, never clamped); missing/non-function callback → usage; async callback (returns a thenable) → usage. Describe options validated eagerly at `crucible.describe` call time.
- Implementation: settings stack pushed/popped around the (synchronous) callback; `crucible.it` reads the effective scope at registration time. Stack + merge logic runner-neutral in `src/core/` (no Jest imports); Jest `describe` registration only in `src/bindings/jest.ts` — the seam the Vitest adapter reuses. Stack popped even when the callback throws; siblings never leak.
- Types: `describe` overloads on `CrucibleSurface` with JSDoc; type test `e2e/test/crucible-describe-typing.util.ts`. `crucible` stays `Readonly<...>`.
- Docs: `docs/api.md` (new section, "five functions" sentence), `docs/runs-and-threshold.md` (precedence chain), README "Group settings" example, getting-started if natural, CHANGELOG `## Unreleased` → Added. Not breaking.
- No live e2e fixture needed; unit tests through the Jest binding with fake registrars.

## Acceptance Criteria

1. **Registers a group.** `crucible.describe(name, fn)` / `crucible.describe(name, options, fn)` registers one Jest `describe` named `name` whose callback runs `fn`; every `crucible.it()` inside, at any depth, inherits `options`.
2. **Per-field last-wins chain.** built-in → `testDefaults` → outer describe → inner describe → `it` options (trailing timeout = `it`'s `testTimeout`). A field one level leaves unset comes from further up.
3. **Timeout formula.** With no `testTimeout` declared at any level the test timeout is `30000 + 1000 × (resolved runs − 1)`; a `testTimeout` declared anywhere (config, describe, it) wins over the formula, nearest declared first.
4. **Timeout conflicts.** Trailing timeout + `testTimeout` in the same `it` options → `usage`. Describe `testTimeout` + `it` trailing timeout → allowed, `it` wins.
5. **Plain describe.** Plain Jest `describe` blocks inside or around `crucible.describe` keep inheritance.
6. **Isolation.** Settings never leak to siblings or to tests after the group; the scope is restored even when the callback throws (the error propagates).
7. **Validation.** Invalid describe options (same rules as `it`), a missing or non-function callback, a surplus argument, or an async callback → `usage` error at collection; options validated before anything is registered.
8. **Runner-neutral.** Settings stack and merge live in `src/core/` with no Jest import; Jest specifics only in `src/bindings/jest.ts`.
9. **Types.** `CrucibleSurface.describe` overloads with JSDoc; type test covers valid and invalid forms.
10. **Docs + CHANGELOG** (api, runs-and-threshold, README, getting-started), not breaking.

## Tasks / Subtasks

- [x] Task 1 (AC 2, 3, 6, 7, 8): `src/core/group-settings.ts` (`GroupSettings`): `declare(options, body)` validates eagerly (RunOptionsValidator, subject `crucible.describe options`; body must be a function) and returns a scoped callback that pushes the layer, runs the body, rejects a thenable return as `usage`, pops in `finally`; `inherit(own)` overlays layers then own, per defined field. TDD in `group-settings.test.ts`, asserting resolved options via `RunOptionsResolver`.
- [x] Task 2 (AC 1, 4, 5, 6, 7): `JestBinding.group(name, optionsOrBody, body?)` + lazy global `describe` registrar (usage if missing); `register` merges own options through `GroupSettings.inherit` after the same-`it` timeout check. Fake `DescribeRegistrarFake` in `src/bindings/test/`. TDD in `jest.test.ts` (run counts, runner deadline via `ManualTimer`, nested plain describe, siblings, throwing callback, validation).
- [x] Task 3 (AC 1, 9): `crucible.describe` in `src/api/crucible.ts`; overloads + JSDoc in `crucible-surface.ts`; `e2e/test/crucible-describe-typing.util.ts`.
- [x] Task 4 (AC 10): docs + CHANGELOG.
- [x] Task 5: full gate.

### Review Findings

Code review 2026-11-14 (Blind Hunter, Edge Case Hunter, Acceptance Auditor).

- [ ] [Review][Decision] Async-callback rule lives in runner-neutral core — Vitest supports async suite callbacks; keep the sync-only rule in `GroupSettings` (shared limit) or move the thenable check into the Jest binding when the Vitest adapter lands.
- [ ] [Review][Decision] One settings stack per loaded module instance — mixing `index.cjs` and `index.js`, or `jest.isolateModules`, gives `crucible.describe` and `crucible.it` different stacks and inheritance silently disappears (same as config/state today); document or detect.
- [x] [Review][Patch] Async callback's promise never handled — a later rejection became an unhandledRejection; now absorbed with a no-op catch [src/core/group-settings.ts]
- [x] [Review][Patch] Callback returning a non-thenable value silently accepted (Jest rejects this) — now `usage` [src/core/group-settings.ts]
- [x] [Review][Patch] Surplus argument after options + callback silently dropped (AC7) — now `usage` [src/bindings/jest.ts, src/api/crucible.ts]
- [x] [Review][Patch] Group options kept by reference — mutation after validation reached tests; layer is now a copy [src/core/group-settings.ts]
- [x] [Review][Patch] Missing callback reported as an options error — callback now checked first [src/core/group-settings.ts]
- [x] [Review][Patch] `inferenceTimeout` inheritance untested [src/core/group-settings.test.ts]
- [x] [Review][Patch] Test-rule fixes: magic literals → enums (`InvalidTestDefault`, `GroupName`, `GroupBodyResult`), multi-purpose/identity tests split, harness `instanceof` assertion dropped [src/core/group-settings.test.ts, src/bindings/jest.test.ts, src/core/test/group-settings-harness.util.ts]
- [x] [Review][Patch] Docs: async/return-value behaviour, sync-prefix registration, absorbed rejection, and Jest `describe.skip`/`.only`/`.each` interplay (verified in a real-Jest scratch smoke) [docs/api.md, docs/runs-and-threshold.md, CHANGELOG.md, src/api/crucible-surface.ts]
- [x] [Review][Patch] (Story 6.2 bug) A missing config file refused with EPERM/EACCES/ENOTDIR was a `config` error; boundary now separates existence (lstat) from readability [src/core/file-system-config-boundary.ts, src/core/node-config-file-system.ts, src/core/config-file-system.ts]
- [x] [Review][Defer] No in-repo real-Jest fixture for `crucible.describe` — behaviour rests on `DescribeRegistrarFake`; manual smoke only (story said no live fixture) — deferred
- [x] [Review][Defer] `NodeProjectFiles.exists` (init) treats any stat error as "exists" — in a sandbox refusing lookups, `init` would report an existing file — deferred, out of 6.3 scope

## Dev Notes

### Current state (read before touching)

- `src/bindings/jest.ts` — `JestBinding(runner, registrar = lazyJestRegistrar)`. `register(name, optsOrBody, bodyOrTimeout?, timeout?)` → `normalize` (validates own opts, two bodies, missing body, surplus, trailing timeout + `testTimeout` conflict, merges trailing timeout into `testTimeout`) → `registrar(name, () => runner.execute(body, opts), runner.ceilingFor(opts))`. Registration must not read config (`testDefaults` supplier is called only in `execute`).
- `src/core/runner.ts` — `ceilingFor(declared)`: Jest timeout = declared `testTimeout` + 5000 margin (capped), else timer max. `execute(body, opts)` resolves `opts` over `testDefaults()` via `RunOptionsResolver`; runner deadline = resolved `testTimeout`.
- `src/core/run-options-resolver.util.ts` — per field `opts ?? defaults ?? built-in`; `testTimeout` built-in = `TimeBudget.testTimeoutFor(resolved runs)`. So passing the describe-merged options as the `it`'s declared options gives exactly the decided chain and timeout formula with no resolver change.
- `src/core/run-options-validator.util.ts` — `violation(candidate, subject)`; reusable for describe options.
- `src/api/crucible.ts` — frozen `crucible: Readonly<CrucibleSurface>`; one `JestBinding` per process via `CompositionRoot` → one `GroupSettings` stack.
- `src/api/crucible-surface.ts` — JSDoc'd overloads (JSDoc allowed only in `src/api/`).

### Design

- Merge: describe layers + own options are combined into one declared `RunOptions` at registration, then the runner resolves it over `testDefaults` as today. Because the describe `testTimeout` becomes part of the declared options, `ceilingFor` keeps the Jest timeout above the runner deadline.
- Jest-circus runs describe callbacks synchronously and does not catch their errors (the file fails), so a stack is sound; an async callback would register its `it`s after the pop → reject it.
- Overlay skips `undefined` fields so `{ runs: undefined }` never erases an outer value.

### Must preserve

- Every existing `crucible.it` form and usage error; behaviour outside a group unchanged; no config read at registration.

### Testing

- Outcomes only: executed body count, runner deadline expiry (`ManualTimer`), registered Jest timeout, error kind, registration count. Fakes one per file; literals in enums; harness classes.

### References

- [Source: _bmad-output/planning-artifacts/epics.md#Epic 6, Story 6.3]
- [Source: _bmad-output/implementation-artifacts/6-1-sensible-defaults.md]
- [Source: _bmad-output/implementation-artifacts/6-2-commented-config-and-init.md]
- [Source: CLAUDE.md]

## Dev Agent Record

### Agent Model Used

Claude Opus 5.5 (claude-opus-5-5)

### Debug Log References

### Completion Notes List

- Ultimate context engine analysis completed - comprehensive developer guide created
- **TDD.** `group-settings.test.ts` red (module missing) → `GroupSettings` green (28 tests). Binding group tests red (21 failing: `group` missing) → `JestBinding.group` green. Mutation check: moving the pop out of `finally` fails 3 tests (throwing callback / nested usage error). Type test `e2e/test/crucible-describe-typing.util.ts` red (`describe` missing on `CrucibleSurface`) → green after overloads + build.
- **Core (runner-neutral):** `src/core/group-settings.ts` — `GroupSettings.declare(options, body)` validates eagerly (`RunOptionsValidator`, same rules as `it`; body must be a function) and returns a scoped callback that pushes the layer, runs the body, rejects a thenable return as `usage`, pops in `finally`; `inherit(own)` overlays layers then own, skipping `undefined` fields. No Jest import.
- **Jest layer:** `JestBinding.group(name, optionsOrBody, body?)` + lazy global `describe` registrar; `register` merges the `it`'s own options through `inherit` *after* the same-`it` trailing-timeout/`testTimeout` conflict check, so a group `testTimeout` + `it` trailing timeout is allowed (it wins). The merged options feed `runner.ceilingFor` (Jest backstop covers a group `testTimeout`) and `runner.execute` (resolved over `testDefaults` as before) — resolver unchanged, so the timeout formula uses resolved runs unless a `testTimeout` is declared anywhere (nearest wins). Registration still never reads config.
- **API:** `crucible.describe` on the frozen `crucible`; two JSDoc'd overloads on `CrucibleSurface`; `it`/`RunOptions` JSDoc now mention the enclosing group. No new exported type. Not breaking.
- **Smoke (manual, scratch dir, built dist, no judge calls):** real Jest — `crucible.describe('group', { runs: 3 })` → plain `describe` → `crucible.it` ran its body 3 times; `crucible.describe('bad', async () => {})` failed the suite with the usage error.
- **Docs:** api.md (new section, "six functions"), runs-and-threshold.md (options table, precedence list, new "Group settings" section with chain + timeout interaction, timeout and backstop wording), README "Group settings", getting-started §6, configuration.md `testDefaults` row, docs/README index, CHANGELOG Unreleased → Added.
- **Gate:** `npm run lint && npm run format:check && npm run typecheck && npm test && npm run build && npm run verify:pack && npx tsc --noEmit -p e2e` → exit 0 (665 tests, 25 suites; 12 packed files).

### File List

- CHANGELOG.md
- README.md
- docs/README.md
- docs/api.md
- docs/configuration.md
- docs/getting-started.md
- docs/runs-and-threshold.md
- e2e/test/crucible-describe-typing.util.ts (new)
- src/api/crucible-surface.ts
- src/api/crucible.ts
- src/api/run-options.ts
- src/bindings/jest.ts
- src/bindings/jest.test.ts
- src/bindings/test/describe-registrar.fake.ts (new)
- src/bindings/test/jest-harness.util.ts
- src/core/group-settings.ts (new)
- src/core/group-settings.test.ts (new)
- src/core/test/group-settings-harness.util.ts (new)
- src/core/test/late-rejection.fake.ts (new, review)
- src/core/test/group-body-result.enum.ts (new, review)
- src/core/test/settle.util.ts (new, review)
- src/bindings/test/group-name.enum.ts (new, review)
- src/core/config-file-system.ts (new, review)
- src/core/node-config-file-system.ts (new, review)
- src/core/file-system-config-boundary.ts (review)
- src/core/file-system-config-boundary.test.ts (new, review)
- src/core/test/config-boundary-harness.util.ts (new, review)
- src/core/test/scripted-file-system.fake.ts (new, review)
- src/core/test/errno-code.enum.ts (new, review)
- src/core/test/project-dir.enum.ts (new, review)
- _bmad-output/implementation-artifacts/6-3-describe-group-settings.md (new)
- _bmad-output/implementation-artifacts/sprint-status.yaml

## Change Log

- 2026-11-14: Story 6.3 implemented — `crucible.describe` group settings (runner-neutral `GroupSettings` stack, Jest `describe` in the binding), types, docs. Gate green (665 tests). Status → review.
- 2026-11-14: Code review — patches applied (async rejection absorbed, return-value/surplus-argument usage errors, options copied, test-rule fixes, docs), plus Story 6.2 config-boundary fix (missing file refused with EPERM/EACCES/ENOTDIR is absent). Gate green (683 tests).
