# BearTrace G001 implementation contract (historical Phase 1)

현재 저장소의 전체 운영 계약은 `README.md`, `docs/ai-authoring.md`, `docs/operations.md`를 따릅니다. 아래 문서는 초기 Ledger/Projection 구현 당시의 완료 기준을 보존한 기록입니다.

This repository-local document mirrors the binding parts of the approved BearTrace MVP plan for the sandboxed implementation worker. It does not replace the canonical planning artifacts maintained outside this repository.

## Outcome

Implement a Git/Markdown personal learning ledger and deterministic projection CLI. G001 excludes the dashboard, GitHub Actions, deployment, remote services, commits, pushes, and pull requests.

## Invariants

1. Git-tracked Markdown is canonical; generated outputs are disposable.
2. Learning Sessions preserve attempts, mistakes, corrections, and feedback but never grant capability.
3. Only valid, user-approved Evidence grants the explicitly named capabilities.
4. A negative AI assessment may become Evidence only when the user approves it and supplies a nonblank override rationale; the original assessment remains canonical.
5. Historical achievement is immutable; current per-capability freshness is derived separately.
6. Recall is a delayed validation context, not a blanket capability or renewal.
7. Topic splits/merges do not transfer old Evidence automatically.
8. Identical inputs and explicit `asOf` produce byte-identical JSON.
9. Projection output is metadata-only and never contains Markdown bodies, AI rationale, override rationale, secrets, or absolute paths.

## Records

All records use strict YAML frontmatter and a nonempty Markdown body where required.

### Topic

Required: schema version, globally stable `id`, title, ISO calendar `created_at`, purpose, nonempty key questions, nonempty topic-specific validation criteria. Optional: tags, related Topic IDs, supersedes/superseded-by/split/merge lineage. IDs are immutable.

### Artifact

Required: schema version, stable ID, artifact kind, title, ISO calendar date, nonempty Topic IDs, source descriptor. Markdown body is canonical learning material but excluded from projection.

### Learning Session

Required: schema version, stable ID, Topic ID, ISO calendar date, nonempty activity kinds, outcome (`in_progress`, `promoted`, `rejected`, `abandoned`), and a body preserving attempts/feedback. Optional source Artifact IDs and resulting Evidence IDs. If Session and Evidence reference each other, lineage must be consistent. A failed recall is represented as a Session and never changes capability timestamps.

### Evidence

Required: schema version, stable ID, Topic ID, Session ID, ISO calendar date, nonempty explicit capabilities, `validation_context` (`initial`, `recall`, `application`, `other`), AI assessment (`sufficient`, `insufficient`) plus rationale, `user_approved: true`, rubric results, and a nonempty concise proof body. If assessment is `insufficient`, require nonblank `override_rationale`; do not allow meaningless override data for `sufficient`. For `validation_context: recall`, require nonempty `retested_capabilities`, each a subset of the Evidence capabilities; only that set refreshes freshness. Optional correction/supersession links must remain acyclic.

### Capabilities

Use `review`, `explain`, `transfer`, and `apply`. Capability order is not a prerequisite ladder.

## Validation

- Reject missing and unknown frontmatter fields, malformed IDs, duplicate capabilities, invalid enums, impossible or non-ISO dates, and missing required bodies.
- Reject globally duplicate stable IDs, unknown Topic/Artifact/Session/Evidence/relationship references, Session/Evidence Topic mismatch, inconsistent resulting-Evidence lineage, self-reference, and correction/supersession cycles.
- Diagnostics carry a stable error code, normalized repository-relative path, and useful message. Aggregate safe errors in one run.
- A Topic split creates no implicit capability on new Topics.

## Projection

- Pure domain functions take parsed records, config, and explicit `asOf`; they never read wall clock, locale, or filesystem order.
- Stable-sort source records and emitted arrays by date then ID and stable-sort object keys during JSON serialization.
- Per Topic expose artifact/session/evidence metadata, last activity, explicit capability profile, historical attainment, current freshness, missing capabilities, next recall, summary labels, and `done_for_current_cycle`.
- Artifact existence derives `COLLECTED`; substantive review derives `REVIEWED`; explain Evidence derives `EXPLAINED`; explain+transfer derives `UNDERSTOOD`; apply derives `APPLIED`; delayed successful revalidation of required DONE capabilities derives `RETAINED`. Labels summarize but never impose prerequisites.
- `done_for_current_cycle` is validated explain plus transfer regardless of apply.
- Default recall intervals are 7, 30, and 90 days, configurable. Use latest successful relevant validation. A failed recall Session preserves history and leaves/marks relevant capability due or unverified. A successful recall updates only `retested_capabilities`.
- Projection includes schema/build version and `asOf`. The CLI reports record counts, output path, and checksum without logging bodies or secrets.

## Repository/tooling

- pnpm workspace, strict TypeScript, Zod, gray-matter, Vitest.
- Suggested packages: `packages/domain` for schemas/parser/validation/projection and `packages/cli` for filesystem adapter, commands, serializer.
- Commands must include `pnpm validate`, `pnpm build:projection`, `pnpm test`, and typecheck/build equivalents.
- Prepare the workspace so a later React/Vite app can consume static JSON without importing filesystem code.
- Provide authoring templates, representative valid examples, and focused invalid fixtures.

## Required tests

- Minimal valid records and every schema/lineage failure above.
- Artifact only changes collection, not capability.
- Session only changes activity, not capability.
- Each Evidence advances only named capability; apply can exist out of order.
- Explain+transfer gives DONE/UNDERSTOOD.
- Negative assessment without override fails; valid user override succeeds.
- Failed recall preserves timestamps/history; delayed partial recall refreshes only named dimensions.
- Topic split inherits nothing.
- Filesystem loader/CLI exit status and relative-path diagnostics.
- Randomized traversal and repeated build produce byte-identical JSON/checksum.
- Projection/body secret sentinels and absolute paths are absent.

## Stop condition

From a clean install, all tests and typechecks pass; validation accepts examples; two projection builds for the same `asOf` have identical bytes/checksums; output is metadata-only. Report any gap instead of guessing or weakening a requirement.
