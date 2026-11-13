---
baseline_commit: 13efc50
---

# Story 3.5: e2e-core on merge to main

Status: done

## Story

As a library author,
I want `make e2e-core` to run in CI when changes merge to main,
so that the real-inference critical path is continuously verified without spending on every PR.

[Source: epics.md#Story 3.5; ARCHITECTURE-SPINE.md AD-12 (amended)]

## Acceptance Criteria

1. **Main lane runs e2e-core after the PR-lane gates.** On a push to `main`, the `ci` workflow runs lint + typecheck + unit (+ build) on the Node 22/24 matrix, then — only if all of that is green — a separate job runs `make e2e-core` against real OpenRouter with the `OPENROUTER_API_KEY` repository secret. [Epic 3.5 AC 1, AD-12]
2. **PR lane stays provider-free.** `pull_request` runs (same-repo and fork) never schedule the e2e job and never reference the secret; the workflow never uses `pull_request_target`. The secret is exposed only through the `env` of the e2e job's steps that need it — no workflow-level or job-level `env` carrying it. [Epic 3.5 AC 2, AD-12]
3. **Loud failure, never a silent skip.** A failing e2e run turns the main-lane workflow red. A missing or empty `OPENROUTER_API_KEY` secret on the main lane fails the job red with an actionable `::error::` annotation that names the secret and where to add it (Settings → Secrets and variables → Actions) — the job does not skip or pass. [Epic 3.5 AC 3; Task brief]
4. **Visible status badge.** `README.md` shows the `ci` workflow status badge for `main`, linking to the workflow's `main` runs. [Epic 3.5 AC 3]
5. **Permitted secrets unchanged.** The only secret referenced under `.github/` is `OPENROUTER_API_KEY` (the npm credential arrives with Story 3.7). No key value appears anywhere in the repo or diff. [Epic 3.5 AC 4, AD-12, NFR1]
6. **Spend and runtime bounded.** Overlapping main pushes never run e2e in parallel, and an e2e run that has started is never cancelled mid-flight; superseded PR runs still cancel. The e2e job has a `timeout-minutes` cap. [Task brief]
7. **Hardened job.** Minimal `permissions` (`contents: read`), `actions/checkout` with `persist-credentials: false`, action versions pinned consistently with the existing workflow, no `${{ }}` expression of untrusted input inside any `run:` script. [Security]
8. **Validated and green.** The workflow passes `actionlint` (docker `rhysd/actionlint`); `npm run lint && npm run format:check && npm run typecheck && npm test && npm run build` green. No `src/` change.

## Tasks / Subtasks

- [x] Task 1: Main-lane job in `.github/workflows/ci.yml` (AC 1, 2, 3, 6, 7)
  - [x] 1.1 Concurrency: keep the workflow-level group; `cancel-in-progress` true only for `pull_request` (PR runs supersede; main runs queue).
  - [x] 1.2 Add `workflow_dispatch` trigger (manual rerun on `main`, e.g. right after the secret is provisioned).
  - [x] 1.3 `e2e-core` job: `needs: unit`, `if:` main ref and push/dispatch event, Node 24, `timeout-minutes: 15`, job-level `permissions: contents: read`, job-level concurrency group `e2e-core-main` (`cancel-in-progress: false`).
  - [x] 1.4 Steps: checkout (`persist-credentials: false`) → preflight secret check (`::error::`, exit 1) → setup-node (npm cache) → `npm ci` → `make e2e-core`; secret only in the env of the preflight and `make` steps.
- [x] Task 2: README CI badge for `main` (AC 4).
- [x] Task 3: Validate — `actionlint` via docker, YAML parse, secret-reference grep, key-prefix grep (AC 5, 7, 8).
- [x] Task 4: Gates (AC 8).
- [x] Task 5: Self-review (AC + security), Review Triage Log, deferred-work updates for 3.5-tagged items.

## Dev Notes

### Current state (read before changing anything)

- `.github/workflows/ci.yml` — `on: pull_request` + `push: branches: [main]`; workflow `permissions: contents: read`; concurrency `ci-${{ github.workflow }}-${{ github.ref }}`, `cancel-in-progress: true`; one job `unit` (matrix node 22/24): `actions/checkout@v4`, `actions/setup-node@v4` (`cache: npm`), `npm ci`, lint, typecheck, test, build. Preserve every one of these steps and the matrix — the PR lane must be byte-for-byte behaviourally the same.
- `Makefile` — `e2e-core: e2e-build` → `e2e-build: e2e-key` (exit 2 when `OPENROUTER_API_KEY` is empty, local-oriented message), `npm run build`, `npx tsc --noEmit -p e2e`, then Jest over `e2e/core/` with `NODE_OPTIONS="$(E2E_NODE_OPTIONS)"`, `E2E_NODE_OPTIONS ?= --experimental-vm-modules --use-system-ca`. On ubuntu the system-CA flag just uses the OS store (harmless); it needs Node ≥ 22.15 / 23.8 (deferred-work 3.3 review) — setup-node `24` is well past that.
- `e2e/core/` — `stateful-coherence.test.ts` (3-run gate, a handful of judge calls) and `cjs-build.test.cts` (CJS build loads). Jest `testTimeout: 120000`. Judge config `e2e/crucible.config.json` (`deepseek/deepseek-v4-flash-0731`, `reasoning.effort: "low"`). A full `make e2e` is ~25 judge calls, well under $0.10 (Story 3.3); e2e-core is a subset.
- `README.md` — no badge today; title `# Crucible`.

### Design decisions (settled — user away)

- **Same workflow, separate job** (not a new workflow file). AD-12 describes one CI with two lanes; the badge of `ci.yml` on `main` then reflects lint + typecheck + unit + e2e-core together, so a red e2e is red on the README badge. `needs: unit` gives "gates, then e2e" ordering for free and no spend when unit is red.
- **Gate:** `if: (github.event_name == 'push' || github.event_name == 'workflow_dispatch') && github.ref == 'refs/heads/main'`. `pull_request` never matches, so PR builds never reach a step that references the secret (fork PRs additionally get no secrets from GitHub). `pull_request_target` is never used — it would run with secrets in the base-repo context.
- **Node 24 for e2e.** Single version: e2e verifies the real-provider path, not Node compatibility (the unit matrix already covers 22 and 24). 24 is the Active LTS (22 is in maintenance), is what a fresh install picks up, and is far beyond the 22.15 floor `--use-system-ca` needs in `NODE_OPTIONS`.
- **Missing secret = red with instructions.** A dedicated preflight step emits `::error title=OPENROUTER_API_KEY secret missing::…` and exits 1 *before* `npm ci`, instead of relying on `make e2e-key`'s local-oriented "export from .env.dev.local" message (that guard stays as the second line of defence). Not `if: secrets…` skipping — a skipped job is green-ish and silent.
- **Concurrency:** workflow-level `cancel-in-progress: ${{ github.event_name == 'pull_request' }}` — superseded PR pushes still cancel; main runs queue instead of killing an in-flight e2e (which would waste the calls already made and leave a "cancelled", not red, result). GitHub keeps at most one pending run per group, so a burst of merges collapses to "current + latest": bounded spend, and the newest main commit (which contains the earlier ones) is always verified. The job-level group `e2e-core-main` (`cancel-in-progress: false`) additionally serialises e2e across push and manual-dispatch runs.
- **`workflow_dispatch`: yes.** Lets Jack verify the lane once right after adding the secret without a dummy commit. Only users with write access can dispatch, the e2e job still requires `refs/heads/main`, and one dispatch costs one unit matrix + one e2e-core (a few cents at most). A dispatch on another branch runs unit only.
- **`timeout-minutes: 15`** on the e2e job — npm ci + build + e2e typecheck + two Jest files with 120 s per-test timeouts; 15 min caps a hung provider without false timeouts.
- **`persist-credentials: false`** on the e2e job's checkout: the job holds a provider secret, so no `GITHUB_TOKEN` is left in `.git/config` for build scripts/dependencies to read.
- **Action pins:** `@v4` tags, same as the existing job (consistency). SHA pinning across the workflow is a separate hardening decision (recorded in deferred-work).
- **No `make conformance` on the main lane.** AD-12 names only `make e2e-core`; the 3.4 harness is a spike with known hardening gaps (no 429/5xx retry, base image not digest-pinned — deferred-work), would add a docker build and +12 judge calls per merge, and belongs to `e2e/ext` (manual tier). Revisit with the schema-pack follow-up.
- **No `npm run format:check` added to the PR lane** — out of scope for this story (PR lane must stay as is).

### Security checklist

- Secret only in step-level `env` of the preflight and `make e2e-core` steps; never echoed; GitHub masks it in logs.
- No `${{ github.event.* }}` / head-ref / PR-title expressions in any `run:`.
- `permissions: contents: read` (workflow and job).
- Secret references under `.github/`: exactly `secrets.OPENROUTER_API_KEY`.

### Testing

No `src/` behaviour → no unit tests (CLAUDE.md TDD applies to `src/`; CI yaml exempt). Validation = `actionlint` + YAML parse + greps + gates. The lane itself can only be proven by a real push to `main` with the secret set (Jack, post-merge).

### References

- [Source: _bmad-output/planning-artifacts/epics.md#Story 3.5]
- [Source: _bmad-output/planning-artifacts/architecture/architecture-crucible-ai-2026-08-10/ARCHITECTURE-SPINE.md#AD-12]
- [Source: _bmad-output/implementation-artifacts/deferred-work.md — 3.3 e2e typecheck item, 3.3 review `--use-system-ca` item, 3.4 harness hardening item]
- [Source: _bmad-output/implementation-artifacts/3-3-prove-it-end-to-end-locally.md — missing-key abort, spend]
- [Source: _bmad-output/implementation-artifacts/3-4-language-agnostic-judge-conformance-spike.md — follow-up 6]
- [Source: .github/workflows/ci.yml, Makefile, e2e/jest.config.mjs, e2e/crucible.config.json]

## Dev Agent Record

### Agent Model Used

Claude Opus 5.5 (claude-opus-5-5), unattended (user away — decisions recorded in Dev Notes).

### Debug Log References

- `docker run --rm -v "$PWD:/repo" -w /repo rhysd/actionlint:latest -no-color -verbose` (actionlint 1.7.12, bundled shellcheck) → 0 errors, exit 0.
- `js-yaml` parse: triggers `pull_request`, `push`, `workflow_dispatch`; jobs `unit`, `e2e-core`; gate expression as designed.
- Preflight step script extracted from the YAML and run in bash: unset key → `::error title=OPENROUTER_API_KEY secret missing::…`, exit 1; key set → exit 0.
- `grep secrets.` under `.github/` → only `secrets.OPENROUTER_API_KEY` (2 step-level env refs); `pull_request_target` → none; OpenRouter key-prefix count in diff/new files → 0.
- Gates: lint, format:check, typecheck, test (15 suites / 350 tests), build — all green. No `src/` change.

### Completion Notes List

- Ultimate context engine analysis completed - comprehensive developer guide created.
- `ci.yml`: new `e2e-core` job (`needs: unit`, main push/dispatch only, Node 24, 15 min, `contents: read`, job concurrency `e2e-core-main` no-cancel, checkout without persisted credentials). Secret preflight before checkout fails red with repo-settings instructions; secret otherwise only in the `make e2e-core` step env.
- Workflow concurrency now cancels in-progress runs only for `pull_request`; main runs queue (at most one pending), so started e2e runs finish and bursts coalesce.
- `workflow_dispatch` added for a manual main-lane run after the secret is provisioned.
- README `ci` badge for `main`.
- Not run here: the live main lane itself — needs the `OPENROUTER_API_KEY` repo secret (Jack) and a push/dispatch on `main`. **Follow-up (not a blocker): Jack adds the secret, then runs the workflow once via Actions → ci → Run workflow on `main` (or merges) and confirms the badge is green.**
- `make conformance` deliberately not on the main lane (see Dev Notes).
- deferred-work: 3.3 e2e-typecheck and `--use-system-ca` items marked closed for the main lane; new 3.5 items (SHA-pin actions, PR-lane format:check, stale spine seed comment).

### File List

- `.github/workflows/ci.yml` (modified)
- `README.md` (modified — CI badge)
- `_bmad-output/implementation-artifacts/3-5-e2e-core-on-merge-to-main.md` (new)
- `_bmad-output/implementation-artifacts/deferred-work.md` (modified)
- `_bmad-output/implementation-artifacts/sprint-status.yaml` (modified)

### Change Log

- 2026-11-13: Story 3.5 — main-lane `e2e-core` job in `ci.yml` (secret-scoped, loud on missing secret, serialised, time-boxed), PR-only cancel-in-progress, `workflow_dispatch`, README badge. Status → done (live verification pending secret provisioning).

### Review Triage Log

Self-review 2026-11-13 against ACs + security (no adversarial review pass).

- AC 1 met: `e2e-core` `needs: unit` (whole 22/24 matrix incl. build), runs `make e2e-core` (build → e2e typecheck → Jest e2e/core) with the repo secret.
- AC 2 met: `if:` excludes `pull_request`; no `pull_request_target`; secret only in step-level env of two steps, none at workflow/job level; fork PRs also receive no secrets from GitHub.
- AC 3 met: missing/empty secret → `::error::` annotation + exit 1 (red), verified locally; e2e failure → job red → workflow red. `make e2e-key` remains a second guard.
- AC 4 met: README badge `ci.yml/badge.svg?branch=main`, linking to main runs.
- AC 5 met: only `secrets.OPENROUTER_API_KEY` referenced; no key in repo/diff.
- AC 6 met: workflow `cancel-in-progress` only for PRs; job group `e2e-core-main` no-cancel; `timeout-minutes: 15`.
- AC 7 met: `contents: read` workflow + job; `persist-credentials: false`; `@v4` pins as existing; no `${{ }}` in any `run:` (only in `env:`/`with:`/`if:`).
- AC 8 met: actionlint clean, gates green, no `src/` change.
- [x] [Patch][Low] Secret preflight placed before checkout/`npm ci` so a missing secret fails in seconds without spending runner time on install.
- [x] [Defer] Actions pinned by tag, not SHA → deferred-work (do with 3.7 publish workflow).
- [x] [Defer] PR lane lacks `format:check`; spine seed "local-only" comment stale → deferred-work.
- Accepted: `npm ci` lifecycle scripts run without the secret (step-scoped), but `make e2e-core` executes dependency code (build, Jest) with the key in env — inherent to running e2e; mitigated by lockfile `npm ci`, main-only trigger, write-access-only dispatch.
- Accepted: a queued (pending) main run that is superseded shows "cancelled", not red — the newer run verifies a superset commit.
- Rejected: skipping the job when the secret is absent (`if: secrets…`) — silent green-ish result, violates AC 3.
