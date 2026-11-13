---
baseline_commit: 6dde23e
---

# Story 3.4: Language-agnostic judge conformance (spike)

Status: done

## Story

As a library author,
I want the judge exercised directly from a container with no TypeScript involved — CLIs installed, a checked-in JSON payload copied in, `curl` against the provider,
so that the schema's language-agnostic claim is a repeatable conformance check, not a one-time design validation, paving the way for a core schema pack outside the TS framework.

**Spike — deliverables over fixed ACs; explicitly allowed to spawn follow-up stories.** [Source: epics.md#Story 3.4]

## Acceptance Criteria (spike exit)

1. **Container with no TS in the loop.** A minimal image (alpine + `curl` + `jq` + CA certificates, POSIX `sh`) is built from a checked-in Dockerfile. The image holds the checked-in conformance fixture (`e2e/ext/fixtures/coherent-conformance.json`), the schema (`schemas/coherent.md`) and the judge config (`e2e/crucible.config.json`), copied in at build time. No Node, no TypeScript, no `src/` or `dist/` file reaches the image or the build context. [Epic 3.4 AC 1]
2. **Payload assembled from the schema's documentation only.** The harness builds the request exactly as `schemas/coherent.md` "Payload assembly" documents it: the schema file verbatim as the system message; the user message = `STATE` (omitted when there is no state), `RESPONSE`, `CLAIM`, each header on its own line, content fenced by `<<<` / `>>>` lines, fence-only content lines prefixed by one space. Anything the doc leaves open is recorded as a doc gap (and fixed in the doc if it is a pure documentation gap). `src/core/payload-assembler.util.ts` is consulted only *after* the harness is built, to find gaps — never as the source. [Task brief; FR6, AD-1]
3. **Real provider, same judge as e2e.** The harness curls OpenRouter chat completions with the model and `meta` of `e2e/crucible.config.json` (`deepseek/deepseek-v4-flash-0731`, `reasoning.effort: "low"`), parses the reply with `jq` as strict JSON `{verdict: boolean, reasoning: string}`, and compares the verdict with each case's `expected`. [Epic 3.4 AC 1, AR6]
4. **Repeatable conformance check.** Each case runs `CONFORMANCE_REPS` times (default 3). The harness prints a per-case matrix (verdict matches, JSON compliance) plus call count and cost, and exits non-zero on any verdict mismatch, non-compliant reply or transport error; exit 2 when the key is missing. A dry mode prints the assembled payloads without network or key. [Task brief]
5. **`make conformance`.** A Makefile target with the same missing-key guard as `e2e-core` (`e2e-key`, exit 2 before building) builds the image and runs it. The key reaches the container only at runtime (`docker run --env OPENROUTER_API_KEY`); no build arg, `ENV`, layer or build-context file contains it. TLS works behind the corporate proxy without disabling verification. [AR10, NFR1]
6. **Matrix matches Story 1.3.** A real run gives 4 cases × 3 reps with every verdict equal to the fixture expectation (coherent-separation → true, incoherent-separation → false, knowledge-boundary-leak → false, stateless-refusal → true) and 12/12 strict-JSON replies. [Epic 3.4 AC 1; spec-1-3 Spike Exit]
7. **Findings recorded** in this file: fixture format fit for a conformance suite, payload-assembly-doc completeness gaps (and any schema text change, with reason), where the harness should live long-term. [Epic 3.4 AC 2]
8. **Follow-ups proposed** (e.g. schema pack extraction, cross-shell conformance suite). [Epic 3.4 AC 3]
9. **Not shipped, no secrets, gates green.** `npm pack --dry-run` lists no new file; the OpenRouter key-prefix count in the diff and new files is 0; `docker history --no-trunc` of the image contains no key; `npm run lint && npm run format:check && npm run typecheck && npm test && npm run build` green. If `schemas/coherent.md` changes, `make e2e-core` is run once and stays green.
10. **Spend bounded.** ≤ ~120 live judge calls for the whole story; call count and cost reported.

## Tasks / Subtasks

- [x] Task 1: Harness (AC 2, 3, 4)
  - [x] 1.1 `e2e/ext/conformance/coherent-payload.jq` — the doc's assembly rules as jq defs (sections, order, fences, neutralisation).
  - [x] 1.2 `e2e/ext/conformance/conformance.sh` — POSIX sh: dry mode (`payloads`), key guard, request body (`meta` + `model` + messages), `curl` with key via `--config -` (not argv), strict JSON check, matrix, cost, exit codes.
- [x] Task 2: Image (AC 1, 5)
  - [x] 2.1 `e2e/ext/conformance/Dockerfile` (pinned alpine, non-root, entrypoint the harness).
  - [x] 2.2 `e2e/ext/conformance/Dockerfile.dockerignore` — allowlist so the build context is only the five inputs (keeps `.env.dev.local` out of the daemon entirely).
- [x] Task 3: `make conformance` (AC 5) — `e2e-key` guard → `docker build` → `docker run --env OPENROUTER_API_KEY`, optional host CA bundle mounted read-only.
- [x] Task 4: Doc-completeness check (AC 2, 7) — after the harness works, diff its payloads against the TS assembler offline (scratch only, not committed) on the fixture cases plus edge cases (fence lines, multi-line facts, empty state); fix pure doc gaps in `schemas/coherent.md`; if changed, `make e2e-core` once.
- [x] Task 5: Real run (AC 6, 10) — dry payload check, one smoke rep, then the 3-rep matrix.
- [x] Task 6: Gates + secret scans (AC 9).
- [x] Task 7: Findings, follow-ups, self-review triage log (AC 7, 8).

## Dev Notes

### Current state (read before changing anything)

- `schemas/coherent.md` "Payload assembly": system prompt = "this entire document"; user message sections `STATE` / `RESPONSE` / `CLAIM` in order, uppercase header on its own line, content between `<<<` and `>>>` lines; `STATE` omitted when empty, one fact per line; fence-only content lines prefixed with one space. Output contract: exactly one JSON object `{verdict, reasoning}`, no fences, no prose.
- `e2e/ext/fixtures/coherent-conformance.json` — 4 cases `{id, expected, state[], response, claim}` (Story 1.3). Already consumed by `e2e/ext/coherent-conformance.test.ts` through the public API (Story 3.3) — keep the format unchanged so one fixture drives both the TS e2e and the shell harness.
- `e2e/crucible.config.json` — `provider: openrouter`, `model: deepseek/deepseek-v4-flash-0731`, `meta.reasoning.effort: "low"`. Default reasoning blew the 3.3 deadline; reasoning disabled was unreliable (docs/judge-models.md) — reuse this config as the harness's judge config, copied into the image.
- `Makefile` — `e2e-key` guard (exit 2, actionable message), `E2E_NODE_OPTIONS ?= … --use-system-ca` for the corporate TLS proxy. The Makefile never sources `.env*`.
- `OpenRouterAdapter` request body = `{...meta, model, messages:[system, user]}` (`src/providers/openrouter.ts`) — the harness mirrors it (provider wire shape is not a schema concern; the body shape comes from the e2e config + OpenRouter's chat-completions API).
- `Judge.parseReply` strips code fences before `JSON.parse` (tolerant); the harness measures the *schema's* stricter contract (no fences) — format compliance, Story 1.3 style.

### Design decisions (settled — user away)

- **Placement: `e2e/ext/conformance/`.** It is an extended, real-provider, manually run check like the rest of `e2e/ext` (AR10 split); it reuses `e2e/ext/fixtures/coherent-conformance.json` and `e2e/crucible.config.json` without copying; it is outside `files` so it never ships; Jest's e2e `testMatch` only matches `*.test.{ts,cts}` so nothing here is picked up. Long term it moves with the schema pack (see Findings).
- **jq for assembly, sh for orchestration.** Assembly needs exact string handling (newlines, quotes, unicode); doing it in jq avoids shell word-splitting and `printf` escapes. The jq defs live in their own file so the doc → code mapping is one screen and a second shell/language can be diffed against the dry-mode output.
- **Key handling.** Key passed only as `docker run --env OPENROUTER_API_KEY` (name only, value from the caller's env); inside the container it goes to curl through `--config -` on stdin, never argv. Build context is an allowlist (`Dockerfile.dockerignore`), so no `.env*` file is sent to the daemon.
- **TLS.** No `-k`/`--insecure`. The harness appends an optional extra CA bundle mounted at `/etc/conformance/extra-ca.pem` to the image's `ca-certificates` bundle. `make conformance` exports the macOS system keychain roots when `CONFORMANCE_CA_BUNDLE` is unset (the same trust Node's `--use-system-ca` uses for e2e); elsewhere it mounts nothing or the given bundle.
- **Accounting.** The harness adds `usage: {include: true}` to read per-call `usage.cost` (docs/judge-models.md wire finding). It is reporting only; it does not change the judgment.

### Testing rules

Spike: harness is shell + jq, not `src/` behavior — TDD/no-stub rules apply to `src/` and there is no `src/` change. If a `src/` change looks needed, propose it as a follow-up. The real run is the test. No CLAUDE.md TS rules apply to `.sh`/`.jq`, but keep: no comments needed to understand it, named constants for repeated literals.

### Previous story intelligence (3.3)

- `--use-system-ca` needed for Node behind the corporate proxy; the container needs the equivalent CA trust.
- Low reasoning effort ≈ 4–5 s/call — 12 sequential calls ≈ 1 min.
- 3.3 deferred: no state-supersession rule in `coherent.md`; fixture matrix is deliberately easy (1.3 caveat). Not in scope here; relevant to fixture-format findings.

### References

- [Source: _bmad-output/planning-artifacts/epics.md#Story 3.4]
- [Source: _bmad-output/implementation-artifacts/spec-1-3-coherent-instruction-schema-spike.md]
- [Source: schemas/coherent.md#Payload assembly]
- [Source: e2e/ext/fixtures/coherent-conformance.json, e2e/crucible.config.json, Makefile]
- [Source: _bmad-output/implementation-artifacts/3-3-prove-it-end-to-end-locally.md, deferred-work.md]
- [Source: docs/judge-models.md]


## Dev Agent Record

### Agent Model Used

Claude Opus 5.5 (claude-opus-5-5), unattended (user away — decisions recorded here).

### Debug Log References

- **Dry payloads vs TS (offline, zero spend).** `conformance.sh payloads` output was diffed byte for byte against `PayloadAssembler.assemble` (scratch script, not committed) on the 4 fixture cases plus 5 edge cases: fence-only lines in state/response/claim, a header-like `CLAIM` line inside the response, a multi-line state fact, empty strings, CRLF content, unicode/quotes/shell metacharacters. Identical (1,676 bytes). The image's `payloads` output has the same hash as the local one.
- **Strict-JSON check (offline).** `strict_verdict` accepts the exact object (any key order, surrounding whitespace) and rejects code fences, string verdict, extra keys, two objects, leading prose.
- **TLS.** Host curl/Node see the corporate proxy certificate (issuer `ns-swg.ca.estimateone.au.goskope.com`; Node: `SELF_SIGNED_CERT_IN_CHAIN`). The local Docker runtime is OrbStack, which injects the host trust store into every container at start (`/etc/ssl/certs/orbstack-root.crt`, rebuilt `ca-certificates.crt`), so curl in the container verified without help. To prove the portable path (Docker Desktop, plain Linux): inside the container, a bundle of only the pristine Mozilla roots fails (`000`), the same bundle plus the macOS keychain export succeeds (`200`). `make conformance` therefore pipes the keychain roots (or `CONFORMANCE_CA_BUNDLE`) to the container on stdin; the harness appends them to the image bundle. Verification is never disabled (no `-k`).
- **Key safety.** `make conformance` without the key → `e2e-key` exit 2 before `docker build`. Harness without the key → exit 2. Bad key → `ERRORED … http 401`, exit 1. Build context is 412 B (allowlist `Dockerfile.dockerignore`; no `.env*` reaches the daemon). `docker history --no-trunc` and `docker image inspect` have no key prefix and no `OPENROUTER_API_KEY`. Inside the container the key goes to curl through `--config -` (stdin), never argv.
- **Negative live check.** One case with a flipped expectation → `FAIL … verdict true, expected false`, reply printed, exit 1.
- **Live calls (all `deepseek/deepseek-v4-flash-0731`, `reasoning.effort: low`):** smoke 4 calls ($0.000498) + matrix 12 ($0.001285) + negative 1 ($0.000084) + `make e2e-core` after the schema edit ~10 (not metered per call; ≈ $0.001–0.005 at the 3.3 rates) = **27 billed judge calls, ≈ $0.004–0.007** (+1 unbilled 401). Cap 120.
- **Gates:** lint, format:check, typecheck, unit 350/350 (15 suites, unchanged), build green. `npm pack --dry-run` = LICENSE, README.md, package.json, dist/*, schemas/* — nothing new. `make e2e-core` 2/2 green after the schema edit.

### Completion Notes List

- **No `src/` change.** Spike deliverables are shell, jq, Dockerfile, Makefile and a schema text clarification.
- **Harness design.** `e2e/ext/conformance/coherent-payload.jq` holds the doc's rules as jq defs (`neutralize_fences`, `section`, `coherent_payload`, `coherent_request`, `strict_verdict`); `conformance.sh` (POSIX sh, busybox-tested) runs `payloads` (dry, prints every assembled user message — a reference other assemblers can diff against) or `run` (default): per case, build the body once with `jq --rawfile` (schema verbatim) + judge config, curl `CONFORMANCE_REPS` times, check strict JSON, compare verdicts, print a per-call line and a per-case matrix, total calls and `usage.cost`; exit 0 all conform, 1 any mismatch / non-compliant / errored call, 2 usage or missing key.
- **Image.** `alpine:3.22` + `ca-certificates curl jq`, runs as `nobody`, entrypoint the harness. Copies in `schemas/coherent.md`, `e2e/crucible.config.json`, `e2e/ext/fixtures/coherent-conformance.json` (the same files the TS e2e uses — no copies in the repo).
- **`make conformance`.** `e2e-key` → `conformance-image` (`docker build -f e2e/ext/conformance/Dockerfile .`) → `docker run --rm -i --env OPENROUTER_API_KEY --env CONFORMANCE_REPS …` with the CA roots on stdin. Knobs: `CONFORMANCE_REPS` (3), `CONFORMANCE_CA_BUNDLE`, `CONFORMANCE_IMAGE`.
- **Matrix (AC 6) — matches Story 1.3:**

  | Case | Expected | Verdict matches | Strict JSON | Errored |
  | --- | --- | --- | --- | --- |
  | coherent-separation | true | 3/3 | 3/3 | 0 |
  | incoherent-separation | false | 3/3 | 3/3 | 0 |
  | knowledge-boundary-leak | false | 3/3 | 3/3 | 0 |
  | stateless-refusal | true | 3/3 | 3/3 | 0 |

  Latency 1.0–5.1 s per call; 12 calls $0.001285. The 4-call smoke before it was also 4/4.

## Findings

### Fixture format fit for a conformance suite

- **Fits as-is for verdict conformance.** `{id, expected, state[], response, claim}` maps one-to-one onto the doc's sections; the same file drives the TS e2e (`e2e/ext/coherent-conformance.test.ts`) and this harness with no adapter. Keep it.
- **Missing for a real suite:**
  1. *Schema binding* — the file does not say which schema (`coherent`) or schema version it targets. A pack needs `schema` + `version` at the top.
  2. *Golden payload vectors* — no expected assembled user message per case. Without them, assembler conformance needs a live call (or a TS reference, as here). With them any implementation (sh, Python, Go, TS) proves assembly offline at zero spend; only verdict conformance needs the provider.
  3. *Edge cases* — no fence-only lines, header look-alikes, multi-line facts, empty strings, CRLF. These are assembly cases (deterministic), so they belong in the golden vectors, not the live matrix.
  4. *Gate per case* — reps/threshold live in the harness (3, all must pass). An easy-only matrix is fine at 100%; ambiguous/adversarial cases (1.3 caveat, 3.3 supersession deferral) will need a per-case or per-suite threshold.

### Payload-assembly-doc completeness gaps

Method: every choice the jq assembler had to make was listed and checked against the doc text; the result was then diffed against `src/core/payload-assembler.util.ts`. (Caveat: the TS assembler was read during story preparation, before the harness was built, so the "guess" list was audited deliberately rather than discovered blind.) Before the fix the doc did **not** determine:

1. Whether the YAML frontmatter is part of the system prompt ("this entire document" — file or rendered body?). TS sends the file byte for byte.
2. What separates sections (TS: one empty line) and whether anything precedes/follows (TS: nothing, no trailing newline).
3. How a state fact that itself contains line breaks is written ("one per line" contradicts it; TS joins facts with `\n`, so such a fact spans several lines).
4. The line-break convention (`\n`).

All four are pure documentation gaps — the TS behaviour was already fixed, the doc just did not say it — so **`schemas/coherent.md` "Payload assembly" was changed**: rule 1 now says "frontmatter included, byte for byte"; the `STATE` bullet says facts are in supplied order, joined by a single line break, a multi-line fact keeps its breaks; new rule 4 says line breaks are `\n`, gives the exact section layout, one empty line between sections, nothing before the first header or after the last `>>>`. This changes the system prompt (the doc *is* the prompt), so `make e2e-core` was re-run: 2/2 green; the 3-rep matrix above ran on the changed schema.

Not fixed (behaviour, not documentation):

5. **CRLF fence escape.** A content line `>>>\r` is not "solely `>>>`" under the doc rule, so neither the doc nor TS neutralises it; a model may read it as a fence. Deciding (normalise CRLF, or neutralise lines that are a fence after trimming `\r`) changes `src/` → follow-up.
6. **Wire shape is not in the schema.** Message roles (system + user), the request body (`{...meta, model, messages}`), no `response_format`/temperature — taken from the OpenRouter adapter and the e2e config. Correct that the schema stays provider-agnostic, but a schema pack needs a short "provider binding" note next to it.
7. **Reply parsing tolerance.** The schema demands no code fences; `Judge.parseReply` strips them anyway. The harness measures the strict contract (12/12). Leniency is a library choice; a pack should say whether conformance means strict or tolerant parsing (recommend strict for conformance, tolerant at runtime).

`docs/judge-validation-runs.md` reproduces the 2026-09-14 schema verbatim as the record of that run; it is a historical snapshot and was left unchanged on purpose.

### Where the harness should live

- **Now: `e2e/ext/conformance/`.** Real-provider, manual, never shipped — the same lane as the rest of `e2e/ext` (AR10); it reuses the e2e fixture and judge config in place; `files` = `dist`, `schemas` keeps it out of the package; e2e Jest `testMatch` cannot pick it up.
- **Later: with the schemas, in a language-agnostic schema pack** (`schemas/coherent.md` + `coherent.conformance.json` + golden payload vectors + this sh/jq runner as the reference conformance implementation). The TS package then consumes the pack and its unit tests check `PayloadAssembler` against the vectors; any other binding does the same. The image is the zero-dependency way to run it.

## Follow-up stories (proposed)

1. **Golden payload vectors (small, high value).** Add expected assembled user messages (incl. the edge cases above) next to the conformance fixture; a TS unit test checks `PayloadAssembler` against them (functional, provider-free); `conformance.sh payloads` diffs against them; the offline part can run in the PR lane (zero spend).
2. **Schema pack extraction.** Move `schemas/*.md` + fixtures + vectors + reference runner into a versioned, language-agnostic pack (`schema`/`version` in fixtures, provider-binding note, strict-vs-tolerant parsing statement); TS consumes it.
3. **Cross-shell / cross-language conformance suite.** Run the vectors through bash, zsh, busybox sh and at least one non-JS reference assembler (e.g. Python) in CI; live verdict matrix stays manual or main-lane.
4. **CRLF fence neutralisation** (schema rule + `PayloadAssembler`, TDD) — gap 5.
5. **Harder matrix** — ambiguous/adversarial and state-supersession cases with a per-case gate (merges the 1.3 caveat and 3.3 supersession deferral).
6. **Harness hardening** — retry 429/5xx with backoff like AR7, pin the base image by digest; optionally add `make conformance` to the 3.5 main lane (+12 calls per merge).

### File List

- `e2e/ext/conformance/conformance.sh` (new)
- `e2e/ext/conformance/coherent-payload.jq` (new)
- `e2e/ext/conformance/Dockerfile` (new)
- `e2e/ext/conformance/Dockerfile.dockerignore` (new)
- `Makefile` (`conformance`, `conformance-image`)
- `schemas/coherent.md` (Payload assembly clarified — doc gaps 1–4)
- `_bmad-output/implementation-artifacts/3-4-language-agnostic-judge-conformance-spike.md` (new)
- `_bmad-output/implementation-artifacts/deferred-work.md`
- `_bmad-output/implementation-artifacts/sprint-status.yaml`

### Change Log

- 2026-11-13: Story 3.4 spike — dockerised sh/jq judge conformance harness (`make conformance`), real 4×3 matrix green, schema payload-assembly doc gaps fixed, findings and follow-ups recorded. Status → done.

### Review Triage Log

Self-review 2026-11-13 against the spike exit ACs (spike: deliverables over fixed ACs; no adversarial review pass).

- AC 1 met: alpine + curl + jq, no Node in the image (`command -v node` empty), build context = 5 allowlisted files.
- AC 2 met: assembled from the doc; TS diff only afterwards; 4 doc gaps fixed, 3 behaviour/wire gaps recorded.
- AC 3–6 met: same model/meta as `e2e/crucible.config.json`; strict JSON with jq; 4×3 matrix 12/12 verdicts and 12/12 strict JSON; exit codes checked live (0, 1 mismatch, 1 errored, 2 missing key/bad reps).
- AC 7–8 met: Findings and Follow-up sections above.
- AC 9–10 met: gates green, pack unchanged, no key in diff/new files/image history, `make e2e-core` green after the schema edit; 27 billed calls ≈ under $0.01.
- [x] [Patch][Low] `CONFORMANCE_REPS` was not validated (non-numeric broke the loop with a shell error). Fixed: exit 2 with a message.
- [x] [Defer] No retry on 429/5xx, base image tag not digest-pinned → follow-up 6.
- [x] [Defer] CRLF fence escape → follow-up 4.
- Rejected: harness adds `usage: {include: true}` that the TS adapter does not send — accounting only, does not affect the judgment.
- Rejected: `docker run --interactive` with no CA on stdin (Linux CI) — empty stdin appends nothing; verified the run path does not block.
