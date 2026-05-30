# CODEX_TASKS

## Status

ChatGPT-approved tasks COD-00〜COD-05 have been implemented in the current Codex pass.

## Source of truth

This file should be generated from `docs/AI_REVIEW_TRIAGE.md` approved and partially approved items only.

Claude suggestions, raw review notes, or unresolved questions are not implementation authority. ChatGPT-approved items are the source of truth for Codex work.

## Rules for Codex

- Implement only approved tasks.
- Do not implement unapproved Claude suggestions.
- Do not change product requirements unless explicitly instructed.
- Preserve repository phase boundaries unless ChatGPT approves a scope change.
- Do not expose secrets.
- Do not read, store, log, commit, or report OAuth credentials, Cookies, tokens, raw X responses, raw account identifiers, HAR files, screenshots containing personal data, or real user data.
- Do not run interactive commands.
- Use non-interactive commands with timeouts for commands that could hang.
- Do not run foreground dev servers, watchers, infinite loops, or unbounded waits.
- Do not invent validation results.
- Report changed files and commands run.
- If validation is skipped, report the reason as `未確認`.
- Stop before paid APIs, paid services, OAuth/login, secret entry, real-data external transmission, production infrastructure changes, or permission blockers.

## Task template

Copy this template for future ChatGPT-approved tasks.

### Task ID

### Priority

P0 / P1 / P2 / P3

### Source finding

Claude finding ID or ChatGPT decision reference.

### Goal

### Scope

### Files likely affected

### Implementation plan

### Acceptance criteria

### Validation commands

### Out of scope

### Risks

### Completion notes

## Approved task queue

### COD-00

### Priority

P1

### Source finding

ChatGPT review-coordination triage.

### Goal

Update review coordination docs so they reflect completed Claude review and ChatGPT triage.

### Scope

`docs/AI_REVIEW_TRIAGE.md`, `docs/CODEX_TASKS.md`, `docs/DECISION_LOG.md`, and `docs/CLAUDE_REVIEW.md` status if needed.

### Files likely affected

`docs/AI_REVIEW_TRIAGE.md`, `docs/CODEX_TASKS.md`, `docs/DECISION_LOG.md`, `docs/CLAUDE_REVIEW.md`

### Implementation plan

Record only actual ChatGPT triage decisions and task scope.

### Acceptance criteria

Docs show approved, partially approved, and deferred findings without inventing new Claude results.

### Validation commands

Docs diff review.

### Out of scope

Inventing missing Claude evidence or changing product behavior.

### Risks

Raw Claude review details may be incomplete if not pasted into the repo file.

### Completion notes

Implemented in this Codex pass. Review coordination docs now record completed Claude review, ChatGPT triage, and the COD-00〜COD-05 task scope without expanding into deferred findings.

### COD-01

### Priority

P1

### Source finding

CL-AUDIT-001

### Goal

Harden F1-A endpoint path privacy.

### Scope

Endpoint path masking, unsafe detection, and local safety tests.

### Files likely affected

`src/research/f1-a/main-world-hook.js`, `src/research/f1-a/observation-utils.js`, `tests/scripts/verify-f1a-observation-safety.mjs`

### Implementation plan

Mask non-allowlisted endpoint path segments and reject intentionally unmasked handle-like path segments in summaries.

### Acceptance criteria

Non-allowlisted path segments cannot preserve raw identifiers; intentionally unmasked handle-like path segments are unsafe; existing fixtures still pass.

### Validation commands

`node tests/scripts/verify-f1a-observation-safety.mjs`, `node tests/scripts/verify-f1a-main-hook-simulator.mjs`, `node tests/scripts/evaluate-f1-observation.mjs tests/fixtures/f1-a-masked-summary.fixture.json`

### Out of scope

Live X verification and production F1-A sync.

### Risks

Endpoint path over-masking can reduce research detail, but is safer for privacy.

### Completion notes

Implemented in this Codex pass. Endpoint path masking now uses allowlisted path segments, and safety verification covers handle-like path masking and intentionally unmasked path rejection.

### COD-02

### Priority

P2

### Source finding

CL-AUDIT-005

### Goal

Add defensive privacy-sensitive artifact ignore patterns.

### Scope

`.gitignore`

### Files likely affected

`.gitignore`

### Implementation plan

Add conservative patterns for HAR, screenshots, raw/masked summaries, and observation exports. Preserve legitimate fixtures.

### Acceptance criteria

Privacy-sensitive local artifacts are ignored without breaking legitimate fixtures.

### Validation commands

`git status --short`, diff review.

### Out of scope

Blanket-ignore all JSON or all image assets.

### Risks

Future legitimate assets may need explicit negation patterns.

### Completion notes

Implemented in this Codex pass. `.gitignore` now includes conservative privacy-sensitive artifact patterns and preserves the legitimate F1-A masked fixture.

### COD-03

### Priority

P1

### Source finding

CL-AUDIT-003

### Goal

Reduce storage load-order fragility.

### Scope

`src/storage/storage.js`, `tests/scripts/verify-phase1-static.mjs`

### Files likely affected

`src/storage/storage.js`, `tests/scripts/verify-phase1-static.mjs`

### Implementation plan

Resolve `ResearchF1A` lazily at call time and statically verify required script ordering in manifest and popup.

### Acceptance criteria

`ResearchF1A` is not destructured at storage initial evaluation; required load order is checked; storage schema is preserved.

### Validation commands

`node tests/scripts/verify-phase1-static.mjs`

### Out of scope

Changing storage keys or schema.

### Risks

If script order is wrong, research storage calls should fail clearly rather than during initial evaluation.

### Completion notes

Implemented in this Codex pass. Storage resolves `ResearchF1A` lazily at call time, and static verification checks manifest/popup script order.

### COD-04

### Priority

P2

### Source finding

CL-AUDIT-004

### Goal

Make `audit-operational-alignment.mjs` portable.

### Scope

Replace hard-coded external paths with env/CLI opt-in and explicit skip reasons.

### Files likely affected

`tests/scripts/audit-operational-alignment.mjs`, `README.md`

### Implementation plan

Default to skipped optional external checks unless env vars or CLI args provide paths. Summarize external files without printing raw contents.

### Acceptance criteria

Default no-env audit passes with explicit skip reasons; optional external content is summarized only.

### Validation commands

`node tests/scripts/audit-operational-alignment.mjs`

### Out of scope

Requiring repo-external files for normal verification or exposing raw external config contents.

### Risks

Default audit coverage is narrower but more honest and portable.

### Completion notes

Implemented in this Codex pass. Default audit execution reports explicit skip reasons for optional external checks, and opt-in paths are configured through env vars or CLI args.

### COD-05

### Priority

P2

### Source finding

CL-AUDIT-002

### Goal

Document real-DOM limitation without changing real-DOM matching logic.

### Scope

`README.md`, `docs/research/f1-a-main-world-hook.md`

### Files likely affected

`README.md`, `docs/research/f1-a-main-world-hook.md`

### Implementation plan

Clarify synthetic/local Phase 1 handle extraction, real X DOM author identity uncertainty, quote/embedded target limitations, and Phase 2 ownership.

### Acceptance criteria

Docs include the approved limitation statements and no content-script logic changes are made for this item.

### Validation commands

Docs diff review.

### Out of scope

Real-DOM author matching logic changes and MutationObserver behavior changes.

### Risks

Docs may need more detail after future live X verification.

### Completion notes

Implemented in this Codex pass. README and F1-A research docs now state the approved real-DOM limitation boundaries.

## Completed tasks

- COD-00: Implemented.
- COD-01: Implemented.
- COD-02: Implemented.
- COD-03: Implemented.
- COD-04: Implemented.
- COD-05: Implemented.
