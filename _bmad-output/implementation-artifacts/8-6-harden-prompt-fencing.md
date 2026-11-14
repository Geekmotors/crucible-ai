---
baseline_commit: cdd6ac2
---

# Story 8.6: Harden prompt fencing against forged sections

Status: done

## Story

As a developer testing a system that an adversary can steer,
I want a reply that tries to close a fenced section and forge a new one to be neutralised whatever its line endings,
so that the system under test cannot rewrite the judge's prompt.

## Acceptance Criteria

1. **Rule.** For content placed in a fenced section (`STATE`, `RESPONSE`, `CLAIM`, `TARGET`, and also `TYPE` / `MODE`, which go through the same fencing), every line — content split, for the check only, on every line break: `\r\n`, `\n`, `\r`, U+2028, U+2029 and U+0085 (NEL) — that equals `<<<` or `>>>` after trimming surrounding white space is neutralised by prefixing one U+0020. The original separators and all other content are kept byte-for-byte.
2. **Parity.** The TypeScript payload builder (`PayloadAssembler`), the jq conformance builder (`payload-sections.jq`) and the payload fixtures (`spec/payload/coherent.json`, `extract.json`) implement the same rule. New fixture cases for CRLF, CR, U+2028, U+2029, NEL, padded fences (spaces, tab, other trim white space) and lookalikes that stay unchanged; existing cases that pinned the old gap updated; goldens regenerated (`make spec-goldens`), `make spec-goldens-check` passes.
3. **Docs.** `spec/README.md` fencing contract states the exact rule (break set, white-space set, neutralisation form, examples); `docs/instruction-schema.md` "what the judge receives" and "Line endings" updated; CHANGELOG `## Unreleased` → `### Fixed` (security hardening, no API change). `schemas/*.md` unchanged (the system prompt's "prefixed with a single space" stays true).
4. **Conformance.** `make conformance` passes on the default judge before merge — run by Jack (live, Docker), not by the dev agent.
5. **Ordering.** Lands before Story 8.5 removes the TypeScript conformance e2e.
6. **Gate.** `npm run lint && npm run format:check && npm run typecheck && npm test && npm run build && npm run verify:pack && npx tsc --noEmit -p e2e && make spec-goldens-check` pass.

## Tasks / Subtasks

- [x] Fixtures first (red): update `payload-coherent-crlf-response`, `-lone-cr-response`, `-unicode-separators`, `-already-indented-fence`, `-fence-lookalikes`, `payload-extract-crlf-response`; add new cases (AC 1, 2)
- [x] TS `PayloadAssembler.neutralizeFences` (green) (AC 1, 2)
- [x] jq `neutralize_fences` (green for `make spec-goldens-check` fixture agreement) (AC 2)
- [x] `make spec-goldens`; `make spec-goldens-check` (AC 2)
- [x] README fencing contract + "Line breaks in values" cross-reference; docs/instruction-schema.md; CHANGELOG (AC 3)
- [x] Gate (AC 6)

## Dev Notes

### Current state (read before touching)

- `src/core/payload-assembler.util.ts`: `PayloadAssembler.assemble(state, sections)`; `neutralizeFences` splits content on `\n` only and prefixes one space to a piece exactly equal to `<<<` / `>>>`; joins with `\n`. Section shape `HEADER\n<<<\n<content>\n>>>`, sections joined by `\n\n`, optional STATE first. Only the neutralisation changes.
- `e2e/ext/conformance/payload-sections.jq`: `neutralize_fences` mirrors TS (`split("\n")`, exact compare, `" " + .`). Used by the live conformance harness (`conformance.sh`) and by `spec-goldens.sh` (`payload_golden`, `fixture_mismatches` — the check also proves jq agrees with every hand-written payload fixture).
- Fixtures run in TS through `src/core/payload-assembler.util.spec-fixtures.test.ts` → `PayloadFixtureHarness` (real `Judge`/`Extractor` with `EchoJudge`). No unit test edits needed: the fixtures are the tests.
- Old gap pinned by `payload-coherent-crlf-response`, `payload-coherent-lone-cr-response`, `payload-coherent-unicode-separators`, `payload-extract-crlf-response` (8.2 deferred-work entry). `payload-coherent-already-indented-fence` and `payload-coherent-fence-lookalikes` pin ` >>>` / `<<< ` as unchanged — these change under the new rule.
- `schemas/coherent.md` / `extract.md` rule 3: "Any content line consisting solely of `<<<` or `>>>` must be prefixed with a single space by the assembler". Still true; do not edit (would change the system prompt).
- `e2e/ext/fixtures/*-conformance.json` hold no `>>>`; payload goldens should regenerate unchanged — check.

### Rule (decided)

- **Break set (check only):** U+000A, U+000D, U+2028, U+2029, U+0085. `\r\n` is one break; treating it as `\r` + `\n` gives the same result (the empty piece between never matches), so implementations may split on any single break character.
- **White space trimmed for the check:** the ECMAScript `String.prototype.trim` set minus the break characters: U+0009, U+000B, U+000C, U+0020, U+00A0, U+1680, U+2000–U+200A, U+202F, U+205F, U+3000, U+FEFF. Listed explicitly (no `\s`, no Unicode-version-dependent classes) so TS and jq (Oniguruma) match exactly.
- **Neutralisation:** a matching line gets one leading U+0020; its own padding and the separators around it are kept. Unconditional — a line already starting with white space (` >>>`) still gains a space, because it still trims to a fence. Result: no content line, under any of the breaks, starts with `<<<`/`>>>` and trims to a fence, so only the assembler's own fence lines are unindented fence lines.
- Not white space (unchanged): U+200B, U+2060, U+180E, U+001C–U+001F; `>>>x`, `>>> >>>`, `>>>>`, `>> >`.

### Implementation sketch

- TS: `content.replace(LINE, (line) => FENCE_LINE.test(line) ? ` ${line}` : line)` with `LINE = /[^\n\r  \u0085]+/g`, `FENCE_LINE = /^[<ws>]*(?:<<<|>>>)[<ws>]*$/` as private static members.
- jq: `gsub("(?<line>[^<breaks>]+)"; if .line | test("\\A[<ws>]*(?:<<<|>>>)[<ws>]*\\z") then " " + .line else .line end)`. Use `\A`/`\z` (Oniguruma `^`/`$` are line anchors). Build the classes from jq string escapes (` ` etc.). jq 1.7.1 local; Docker image uses alpine:3.22 jq (1.8.x) — keep to features stable in both (`gsub` with named capture, `test`).

### Testing standards

- CLAUDE.md: TDD red-green-refactor; fixtures are functional tests; no new loose helpers; no comments; named exports at end; `type` not `interface`.

### References

- [Source: _bmad-output/planning-artifacts/epics.md#Story 8.6]
- [Source: _bmad-output/implementation-artifacts/deferred-work.md — 8.2 deferred fencing entries]
- [Source: _bmad-output/implementation-artifacts/8-2-spec-payloads-and-reports.md — fencing gap]
- [Source: spec/README.md#payload / coherent — Fencing]
- [Source: docs/instruction-schema.md — what the judge receives]

### Review Findings

Code review 2026-11-14 (Blind Hunter, Edge Case Hunter, Acceptance Auditor).

- [x] [Review][Patch] VT/FF were padding, so ` \v>>>\f` became a bare `>>>` line for any reader splitting on VT/FF (UAX #14 BK, Python `splitlines`); U+001C–U+001E likewise. Break set widened to the Python `splitlines` set (U+000A–U+000D, U+001C–U+001E, U+0085, U+2028, U+2029); VT/FF removed from padding.
- [x] [Review][Patch] Invisible characters beside or inside a marker (`\u200b>>>`, `>\u200b>>`, bidi, tag characters) were not neutralised. Decision: remove Unicode `Default_Ignorable_Code_Point` (frozen explicit list, incl. astral tags) for the check only, then trim padding; output keeps them. U+FEFF moves from padding to the invisible set (same effect).
- [x] [Review][Patch] jq `gsub` with named capture was quadratic in line count (21.6 s for 40k lines; `match("g")` also quadratic in jq 1.7.1). Rewritten with nested literal `split`/`join` per break and a single `test` per line (marker interleaved with invisible class); linear.
- [x] [Review][Patch] ESLint `no-control-regex` / `no-misleading-character-class` on the new classes: TS builds classes from code-point range tables (`LINE_BREAK_RANGES`, `INVISIBLE_RANGES`, `PADDING_RANGES`) with the `u` flag.
- [x] [Review][Patch] Raw invisible characters in fixture JSON replaced by `\uXXXX` escapes.
- [x] [Review][Patch] Fixtures: invisible-beside, invisible-inside, control-characters-beside (unchanged), VT/FF/FS/GS/RS breaks; look-alikes extended (`<<<>>>`, combining mark, fullwidth, single guillemet, heavy angle).
- [x] [Review][Patch] Docs: README fencing contract (4 steps, exact sets, one-space rule incl. already-indented lines, known limits); instruction-schema lead sentence no longer says "solely"; CHANGELOG lists TYPE/MODE, says prompt-injection hardening, notes ports/recorded payloads.
- [x] [Review][Defer] Look-alike brackets, other marker lengths, marker + text on one line, combining marks: documented limits (deferred-work).
- [x] [Review][Defer] One space is positional, not an escape; random per-request fences would be stronger (deferred-work).
- [x] [Review][Defer] epics.md 8.6 AC lists the old break set (deferred-work).
- AC 4 (`make conformance`, live, jq 1.8.x in Docker) still open for Jack.

## Dev Agent Record

### Agent Model Used

Claude Opus 5.5 (claude-opus-5-5)

### Debug Log References

- Red: 15 payload fixtures failed in TS (`payload-assembler.util.spec-fixtures.test.ts`) and the same 15 in `make spec-goldens-check` (jq disagreement) before the builders changed; lookalike and invisible-character cases passed (they pin non-change).
- Green: TS then jq; `make spec-goldens` regenerated goldens with no diff (conformance cases hold no fence markers).
- jq verified locally on 1.7.1 (`jq-1.7.1-apple`) only. Docker image (alpine:3.22, jq 1.8.x) not run — no Docker in this session; the jq code uses only `gsub` with a named capture, `test`, `\A` / `\z` and literal code points in classes, all unchanged between 1.7.1 and 1.8.

### Completion Notes List

- Rule: split for the check on U+000A, U+000D, U+2028, U+2029, U+0085 (`\r\n` one break); trim the ECMAScript trim set minus breaks (U+0009, U+000B, U+000C, U+0020, U+00A0, U+1680, U+2000–U+200A, U+202F, U+205F, U+3000, U+FEFF); a line equal to `<<<`/`>>>` after trimming gets one leading U+0020; padding and separators kept. Unconditional, so ` >>>` → `  >>>` (old fixture changed) and the mapping stays injective.
- TS: `PayloadAssembler` replaces each maximal run of non-break characters via private static regexes (`LINE`, `PADDING`, `FENCE_LINE`). jq: `neutralize_fences` uses `gsub` over the same classes.
- Fixtures: updated `payload-coherent-crlf-response`, `-lone-cr-response`, `-unicode-separators`, `-already-indented-fence`, `-fence-lookalikes` (padded entries moved out, `>>>x`, `>>> >>>`, `<<< <<<` added), `payload-extract-crlf-response`; new `payload-coherent-space-padded-fence`, `-tab-padded-fence`, `-unicode-padded-fence`, `-invisible-non-white-space`, `-crlf-forged-claim-section`, `-crlf-fence-first-and-last`, `-next-line-separator`, `-mixed-separators`, `-separator-fence-in-fact`, `-separator-fence-in-claim`, `payload-extract-separator-forged-type-in-target`.
- Docs: spec/README fencing contract rewritten (rule, sets, examples), "Line breaks in values" note; docs/instruction-schema.md fencing bullet, removed the "Line endings" gap; CHANGELOG `## Unreleased` → Fixed; deferred-work entries marked resolved. `schemas/*.md` unchanged.
- AC 4 (`make conformance`) left to Jack (live). Gate passed: 38 suites, 1395 tests; `make spec-goldens-check` current.

### File List

- src/core/payload-assembler.util.ts
- e2e/ext/conformance/payload-sections.jq
- spec/payload/coherent.json
- spec/payload/extract.json
- spec/README.md
- docs/instruction-schema.md
- CHANGELOG.md
- _bmad-output/implementation-artifacts/8-6-harden-prompt-fencing.md
- _bmad-output/implementation-artifacts/deferred-work.md
- _bmad-output/implementation-artifacts/sprint-status.yaml

## Change Log

- 2026-11-14: Fencing neutralises fence-only lines under every line break and with surrounding white space (TS, jq, fixtures, docs).
- 2026-11-14: Code review: wider break set (VT, FF, U+001C–U+001E), invisible characters ignored for the check, linear jq builder, escaped fixtures, docs and known limits.
