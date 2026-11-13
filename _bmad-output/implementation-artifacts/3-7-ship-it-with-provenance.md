---
baseline_commit: 858694a462249b979b4dacf69b81a6dec86d120f
---

# Story 3.7: Ship it with provenance

Status: done

## Story

As a library author,
I want a tag-triggered publish pipeline,
so that every npm release is built, tested, and attested reproducibly.

## Acceptance Criteria

1. **Given** a `v*` tag pushed to GitHub, **when** the publish workflow runs, **then** it runs lint + format:check + typecheck + unit, builds dual ESM+CJS via tsdown, and publishes `crucible-ai` to npm with provenance via npm Trusted Publishing (OIDC), falling back to an `NPM_TOKEN` secret when no trusted publisher is configured (AR10, AD-12).
2. The workflow refuses to publish when the tag does not equal `v<package.json version>`, or when the tagged commit is not on `main`.
3. Only the publish job holds `id-token: write`; workflow default is `contents: read`. No `OPENROUTER_API_KEY`, no `pull_request_target`, actions pinned by commit SHA.
4. The published package exposes one `crucible` namespace (plus `CrucibleError`, `CrucibleVerdictError` and their public types), ships `schemas/`, declares Jest as a peer dependency, `engines.node >=22`; `exports` resolves ESM, CJS and both type flavours.
5. `npm pack` contents are verified by an allowlist script that fails the PR lane and the publish job on any leak: only `dist/`, `schemas/*.md`, `README.md`, `LICENSE`, `package.json` — no e2e, fixtures, configs, `docs/`, `.env*`.
6. README on npm shows the current `crucible.it()` API; its examples compile against the built `dist`; its doc links are absolute GitHub URLs; package.json carries `repository` / `homepage` / `bugs` (repository URL must match the GitHub repo exactly — provenance verification depends on it).
7. `RELEASING.md` documents the one-time npm setup (first publish, trusted publisher config, token fallback) and the per-release steps (`make e2e` before tagging, version bump, tag push).
8. Gates green: `npm run lint && npm run format:check && npm run typecheck && npm test && npm run build`; actionlint clean on both workflows; doc examples compile.

## Tasks / Subtasks

- [x] Task 1: Public surface decision (AC 4) — remove `ProviderAdapter`, `CompletionRequest`, `FailureClass` from `src/api/crucible.ts` / `src/index.ts`; update `docs/api.md` row. Verify via typecheck + build + `dist/index.d.ts` inspection (no unit test: CLAUDE.md forbids export-surface tests).
- [x] Task 2: package.json metadata (AC 4, 6) — `repository`, `homepage`, `bugs`, `keywords`, `publishConfig { access: public, provenance: true }`, `files: ["dist", "schemas/*.md"]` (drops `schemas/.gitkeep`).
- [x] Task 3: `scripts/verify-pack.mjs` (AC 5) — runs `npm pack --dry-run --json`, fails on any file outside the allowlist or any missing required file; `npm run verify:pack` script.
- [x] Task 4: `.github/workflows/publish.yml` (AC 1–3) — `verify` job (no id-token) + `publish` job (`id-token: write`, environment `npm`).
- [x] Task 5: ci.yml (AC 3, 5) — SHA-pin actions, add `format:check` and `verify:pack` to the unit job; `.github/dependabot.yml` for github-actions updates.
- [x] Task 6: README absolute links (AC 6); compile README/docs examples against dist (3.6 scratchpad harness approach).
- [x] Task 7: `RELEASING.md` (AC 7).
- [x] Task 8: Gates + actionlint (docker `rhysd/actionlint`) + `npm pack --dry-run`; deferred-work cleanup; Review Triage Log.

## Dev Notes

### Scope & hard limits

Release-engineering story. No runtime `src/` behaviour change; the only `src/` edit is removing three type re-exports (type-only, surface change — verified by typecheck/build, not by unit tests per CLAUDE.md "testing import/export surface" ban). **Never** run `npm publish` (any form), `npm login`, create/push tags, push, or touch npm/GitHub settings. Use `npm pack --dry-run` only. The first real publish is Jack's manual action.

### Current state (files touched)

- `package.json` — v0.1.0, `type: module`, `exports` `.` → import (`dist/index.d.ts`, `dist/index.js`) / require (`dist/index.d.cts`, `dist/index.cjs`); `files: [dist, schemas]`; `peerDependencies.jest ^30.0.0`; `engines.node >=22`; `prepublishOnly` runs lint+typecheck+test+build; `prepare: husky`. No repository/homepage/bugs.
- `.github/workflows/ci.yml` (3.5) — `unit` matrix 22/24 (npm ci, lint, typecheck, test, build), `e2e-core` main-only with `OPENROUTER_API_KEY`. Actions by major tag `@v4`. Preserve both lanes exactly; additions only.
- `src/index.ts` re-exports from `src/api/crucible.ts` only (CLAUDE.md: entry re-exports only from `src/api/`).
- `README.md` — relative `docs/*.md` links (break on npmjs.com: `docs/` not shipped). `*.md` is prettier-ignored.
- Current `npm pack --dry-run`: LICENSE, README.md, dist/index.{cjs,js,d.ts,d.cts}, package.json, schemas/.gitkeep, schemas/coherent.md (~32 kB).

### Architecture compliance

- AD-12 / AR10: `v*` tag → unit gate → `npm publish` with provenance, Trusted Publishing (OIDC) or `NPM_TOKEN` fallback. Permitted CI secrets: exactly the npm credential + `OPENROUTER_API_KEY` (main lane only). Convention: `make e2e` locally before tagging (spine review M-2: e2e is a convention, not enforced — RELEASING.md makes it an explicit checklist step).
- AR11: one `crucible` namespace; Jest peer, never dependency; engines >=22; tsdown dual build.
- AD-11: schemas ship in the package, versioned by package version.
- Spine Structural Seed: `.github/workflows/publish.yml (tag → npm, OIDC)`.

### Trusted Publishing facts (from knowledge, 2025–2026; uncertainty recorded)

- Requires npm CLI **≥ 11.5.1** and a GitHub-hosted runner; job needs `permissions: id-token: write`. npm auto-detects the OIDC environment and exchanges the token at publish time; if no trusted publisher matches, it falls back to the token in `.npmrc` (`NODE_AUTH_TOKEN`, written by setup-node's `registry-url`).
- Provenance is generated automatically under trusted publishing; `--provenance` is still passed explicitly so the token fallback also attests. Provenance requires a public repo (it is) and `package.json` `repository.url` matching the GitHub repo.
- Trusted publisher config (npmjs.com → package → Settings → Trusted Publisher) names: org/user `jackula83`, repo `crucible-ai`, workflow filename `publish.yml`, optional environment (`npm`). It can only be configured once the package exists → the **first** publish needs a token (or a manual local publish). Uncertain whether npm now allows pre-claiming; RELEASING.md covers both paths.
- Pin the npm CLI explicitly in the publish job (`npm install -g npm@11.21.2`) rather than depending on the version bundled with the Node image.

### Decisions (unattended — user away)

1. **Provider types removed from the public surface.** No public registration path exists; removing later is breaking, adding later is not. Nothing public references them (`crucible`, errors, `RunOptions`, `TestBody` do not).
2. **`crucible.it` overloads stay deferred.** A body-less call already fails at registration with `usage`; tightening the type later only rejects calls that already throw, so it is not a practical breaking change. Keeps this story release-only.
3. **Docs do not ship.** README links become absolute GitHub URLs (`blob/main/docs/...`); `repository` also added.
4. **SHA-pin all actions** in both workflows (publish holds publish credentials; e2e holds `OPENROUTER_API_KEY`), with `.github/dependabot.yml` keeping pins fresh. Version comments after SHAs are Dependabot's update anchor, not prose.
5. **`format:check` added to the PR lane** (cheap; closes 3.5 deferral).
6. **Two-job publish.** `verify` (no OIDC) runs the gates; `publish` (OIDC, environment `npm`) does `npm ci --ignore-scripts`, build, pack verification, `npm publish --provenance --access public --ignore-scripts` — no third-party install scripts run while `id-token: write` is held, and `prepublishOnly` does not redundantly re-run the gates.
7. **Tag guards:** tag must equal `v${version}`; tagged commit must be an ancestor of `origin/main`.
8. **Pack allowlist** runs in the PR lane too, so leakage is caught before a tag exists.

### Testing

No `src/` behaviour → no new unit tests. Verification: full gate, `npm pack --dry-run` + `verify:pack`, actionlint via docker, README/docs example compile against `dist` (3.6 harness approach: scratchpad extractor + `tsc`, not committed).

### References

- `_bmad-output/planning-artifacts/epics.md` — Story 3.7, AR10, AR11
- `_bmad-output/planning-artifacts/architecture/architecture-crucible-ai-2026-08-10/ARCHITECTURE-SPINE.md` — AD-11, AD-12, Consistency Conventions, Stack, Structural Seed
- `_bmad-output/implementation-artifacts/deferred-work.md` — 3.5 SHA-pin / format:check; 3.6 provider types, `crucible.it` typing, README links
- `_bmad-output/implementation-artifacts/3-6-learn-it-from-the-docs-alone.md` — example type-check harness
- `.github/workflows/ci.yml`, `package.json`, `src/api/crucible.ts`, `docs/api.md`

## Dev Agent Record

### Agent Model Used

Claude Opus 5.5 (claude-opus-5-5)

### Debug Log References

- `npm ci --ignore-scripts` + `npm run build` + `verify:pack` run in a scratchpad copy of the repo: the build works without install scripts, which the publish job relies on.
- `verify:pack` negative control: a stray `dist/leak.map` made it exit 1 with `unexpected file in tarball`.
- actionlint (docker `rhysd/actionlint:latest`, v1.7.12, shellcheck included): 0 errors in `ci.yml` and `publish.yml`.
- Action SHAs resolved with `gh api repos/<action>/git/matching-refs/tags/v4.`: checkout v4.4.0 = `11d5960a…`, setup-node v4.4.0 = `49933ea5…`. Both are lightweight tags pointing at commits.

### Completion Notes List

- Ultimate context engine analysis completed - comprehensive developer guide created
- Public surface: removed the `ProviderAdapter`, `CompletionRequest` and `FailureClass` type re-exports from `src/api/crucible.ts` and `src/index.ts`, and dropped their row from `docs/api.md`. `dist/index.d.ts` now exports only `crucible`, `CrucibleError`, `CrucibleVerdictError`, `CrucibleErrorKind`, `RunOptions`, `TestBody` and `VerdictOutcome`. Per CLAUDE.md there are no unit tests for export-surface changes; verified by typecheck, build, the e2e typecheck, and a negative compile (`import type { ProviderAdapter }` gives TS2305).
- package.json: added `repository` (must match GitHub for provenance), `homepage`, `bugs`, `keywords`, `publishConfig { access: public, provenance: true }` and the `verify:pack` script. `files` narrowed to `["dist", "schemas/*.md"]`, which drops `schemas/.gitkeep`. `exports`, `peerDependencies.jest`, `engines` are unchanged and confirmed.
- `scripts/verify-pack.mjs`: a `PackVerifier` class. It runs `npm pack --dry-run --json --ignore-scripts` and fails on any file outside the allowlist (`package.json`, `README.md`, `LICENSE`, `dist/*.{js,cjs,d.ts,d.cts}`, `schemas/*.md`) or any missing required file. It runs in the CI unit lane and in both publish jobs.
- `.github/workflows/publish.yml`: a `verify` matrix (22/24) with no OIDC, which checks the tag matches the version and the commit is on main, then runs ci, lint, format:check, typecheck, test, build and verify:pack. A `publish` job (environment `npm`, `id-token: write`, repository guard, no npm cache) installs npm 11.21.2, runs `npm ci --ignore-scripts`, build and verify:pack, then `npm publish --provenance --access public --ignore-scripts` with `NODE_AUTH_TOKEN: secrets.NPM_TOKEN` as the fallback. Actions are SHA-pinned. No OPENROUTER key, no `pull_request_target`, and no `${{ }}` interpolation inside `run:`.
- ci.yml: actions SHA-pinned, and `format:check` and `verify:pack` added to the unit job. Both lanes are otherwise unchanged. Added `.github/dependabot.yml` (github-actions, weekly).
- README: all `docs/` links are absolute `https://github.com/jackula83/crucible-ai/blob/main/docs/...` URLs, and every target exists. Example compile: the scratchpad extractor took 14 ```ts blocks from README.md and docs/*.md and compiled them against the freshly built `dist/index.d.ts` with `tsc` (strict, lib es2022). Exit 0. 3 signature-notation blocks were skipped. A negative control (unknown option `retries`, removed provider type) produced 2 errors.
- `RELEASING.md` covers the pipeline, the one-time setup (first publish via an `NPM_TOKEN` granular token, then the Trusted Publisher config with jackula83 / crucible-ai / publish.yml / environment npm, token revocation, optional reviewer, tag ruleset), the per-release steps (`make e2e`, version bump PR, push the single tag), checks and recovery.
- Gates: lint, format:check, typecheck, unit (15 suites / 350 tests), build, verify:pack and the e2e typecheck are all green.
- Follow-up, not a blocker: the actual first publish is Jack's manual action per RELEASING.md (recorded in deferred-work).

### File List

- `.github/workflows/publish.yml` (new)
- `.github/workflows/ci.yml` (modified)
- `.github/dependabot.yml` (new)
- `scripts/verify-pack.mjs` (new)
- `RELEASING.md` (new)
- `package.json` (modified)
- `README.md` (modified)
- `docs/api.md` (modified)
- `src/api/crucible.ts` (modified)
- `src/index.ts` (modified)
- `_bmad-output/implementation-artifacts/deferred-work.md` (modified)
- `_bmad-output/implementation-artifacts/sprint-status.yaml` (modified)
- `_bmad-output/implementation-artifacts/3-7-ship-it-with-provenance.md` (new)

### Change Log

- 2026-11-13: Story 3.7 implemented: tag-triggered publish workflow with OIDC and token fallback, pack allowlist, provider types dropped from the public surface, npm metadata, absolute README links, SHA-pinned actions plus Dependabot, format:check in the PR lane, RELEASING.md.

### Review Triage Log

Self-review against the ACs and supply-chain security (unattended).

| # | Finding | Triage | Action |
| --- | --- | --- | --- |
| 1 | AC 1: lint, format, typecheck, unit, dual build and provenance publish via OIDC with token fallback | Met | `publish.yml` verify and publish jobs |
| 2 | AC 2: tag/version mismatch or tag not on main must not publish | Met | Two guard steps in `verify`, and `publish` needs `verify`. Guards use `$GITHUB_REF_NAME`/`$GITHUB_SHA` env vars, quoted, so a crafted tag name cannot inject into the script |
| 3 | AC 3: least privilege | Met | Workflow default is `contents: read`. `id-token: write` is granted only on `publish`. `persist-credentials: false` in both. No OPENROUTER secret, no `pull_request_target`. Actions SHA-pinned |
| 4 | Install scripts or a poisoned cache running while the OIDC token is available | Fixed by design | The publish job uses `npm ci --ignore-scripts`, no `cache: npm`, and `npm publish --ignore-scripts`. The gates run in the unprivileged `verify` job |
| 5 | A fork or a mirror running the publish job | Fixed | `if: github.repository == 'jackula83/crucible-ai'` |
| 6 | Anyone with write access can push a `v*` tag | Mitigated (doc) | RELEASING.md recommends an `npm` environment reviewer and a `v*` tag ruleset. Both are GitHub settings and not touched here |
| 7 | AC 4: one namespace, schemas ship, Jest peer, engines >=22, exports ESM/CJS/types | Met | `dist/index.d.ts` checked. The provider types were removed (decision 1) |
| 8 | AC 5: pack leakage | Met | Allowlist script runs in the PR lane and twice in publish. The negative control fails. `.gitkeep` is no longer shipped |
| 9 | AC 6: npm README | Met | Absolute links, `repository` field present, examples compile against dist. The links resolve once the story stack is merged to main, and the tag-on-main guard forces that before any publish |
| 10 | AC 7: RELEASING.md | Met | |
| 11 | AC 8: gates and actionlint | Met | |
| 12 | `publishConfig.provenance: true` makes a local `npm publish` fail | Accepted (intended) | Documented. Every publish goes through CI with attestation |
| 13 | Trusted-publishing details (npm ≥ 11.5.1, OIDC before token, trusted publisher needs an existing package) come from knowledge, not a live run | Deferred | Recorded in deferred-work. Confirmed on the first real publish |
| 14 | `npm install -g npm@11.21.2` has no integrity pin | Deferred (low) | Recorded in deferred-work |
| 15 | `crucible.it` permissive typing | Deferred (decision 2) | Not a practical breaking change to tighten later |
