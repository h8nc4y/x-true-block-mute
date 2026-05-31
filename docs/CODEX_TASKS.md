# CODEX_TASKS

## Status

ChatGPT-approved tasks COD-00 through COD-05 were implemented in PR #2. MAINT-00 through MAINT-04 were implemented in PR #4. VERIFY-00 through VERIFY-05 are implemented in the current local verification documentation pass.

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

## Maintenance follow-up task queue

### MAINT-00

### Priority

P3

### Source finding

Post-merge baseline verification requested by ChatGPT after PR #2.

### Goal

Verify `main` after PR #2 merge before starting additional maintenance work.

### Scope

Confirm `main` and `origin/main` are synchronized, PR #2 is merged, and the existing local validation commands still pass.

### Files likely affected

None.

### Implementation plan

Run the existing local verification commands on `main` before creating the maintenance branch.

### Acceptance criteria

`main...origin/main` is `0 0`, PR #2 is merged, working tree is clean, and existing local verification passes.

### Validation commands

`git rev-list --left-right --count main...origin/main`, `gh api repos/h8nc4y/x-true-block-mute/pulls/2`, existing Node verification commands, `git diff --check`.

### Out of scope

External dashboard checks, live X verification, and production deploy checks.

### Risks

Vercel / Cloudflare GitHub App check suites can remain queued even when no required PR checks are present.

### Completion notes

Implemented in this maintenance pass.

### MAINT-01

### Priority

P3

### Source finding

CL-AUDIT-009, later approved by ChatGPT for consistency checks only.

### Goal

Guard duplicated constants and MAIN-world masking allowlists from drifting.

### Scope

Add static assertions without refactoring production code into a single source.

### Files likely affected

`tests/scripts/verify-phase1-static.mjs`, `tests/scripts/verify-f1a-observation-safety.mjs`

### Implementation plan

Assert background message constants match shared constants; assert MAIN-world hook and observation-utils safe schema and endpoint segment allowlists match; add direct sanitizer guard assertions.

### Acceptance criteria

Static verification fails if duplicated constants or allowlists drift.

### Validation commands

`node tests/scripts/verify-phase1-static.mjs`, `node tests/scripts/verify-f1a-observation-safety.mjs`

### Out of scope

Refactoring isolated MAIN-world code into shared extension-world code.

### Risks

Tests intentionally preserve some duplication because MAIN-world isolation makes direct sharing risky at this phase.

### Completion notes

Implemented in this maintenance pass.

### MAINT-02

### Priority

P3

### Source finding

CL-AUDIT-008, later approved by ChatGPT for low-risk cleanup only.

### Goal

Reduce settings-page script overlap and remove unused content-script state.

### Scope

Exclude the normal Phase 1 filter content script from F1-A settings pages while preserving the research bridge, and remove unused `__xTbmOriginalCard` expando state.

### Files likely affected

`manifest.json`, `src/content/content-script.js`, `tests/scripts/verify-phase1-static.mjs`

### Implementation plan

Add `exclude_matches` to the normal content script for blocked/muted settings pages; keep the research bridge matches unchanged; remove unused expando assignment.

### Acceptance criteria

Research bridge still loads on settings pages; normal filter content script excludes those settings pages; no new permissions are added.

### Validation commands

`node tests/scripts/verify-phase1-static.mjs`

### Out of scope

MutationObserver redesign, teardown implementation, F1-A bridge removal, and real-DOM author matching.

### Risks

The normal filter will no longer run on the F1-A settings pages, which is intentional for this research phase.

### Completion notes

Implemented in this maintenance pass.

### MAINT-03

### Priority

P3

### Source finding

CL-AUDIT-010, later approved by ChatGPT for README clarity only.

### Goal

Clarify current project phase and implemented status.

### Scope

README status wording only.

### Files likely affected

`README.md`

### Implementation plan

Add a current status section describing Phase 1 / Phase 1.5 research/prototype state and unimplemented future work.

### Acceptance criteria

README separates current implemented behavior from future Phase 2 and production-sync work.

### Validation commands

Docs diff review, `node tests/scripts/audit-operational-alignment.mjs`.

### Out of scope

Product behavior changes.

### Completion notes

Implemented in this maintenance pass.

### MAINT-04

### Priority

P3

### Source finding

ChatGPT maintenance approval for review coordination docs.

### Goal

Record the new ChatGPT-approved maintenance scope and preserve deferred boundaries.

### Scope

`docs/AI_REVIEW_TRIAGE.md`, `docs/CODEX_TASKS.md`, `docs/DECISION_LOG.md`

### Implementation plan

Move CL-AUDIT-008/009/010 into later-approved maintenance scope; keep CL-AUDIT-006/007/011 and Phase 2 items deferred.

### Acceptance criteria

Docs show MAINT-00 through MAINT-04 without implying approval for Phase 2, production sync, CI/package setup, teardown, or MutationObserver redesign.

### Validation commands

Docs diff review.

### Out of scope

Inventing new Claude findings or changing Claude review content.

### Risks

Future agents must still read the task-specific approval, not just the old initial triage status.

### Completion notes

Implemented in this maintenance pass.

## Local verification task queue

### VERIFY-00

### Priority

P2

### Source finding

ChatGPT post-merge local verification request after PR #2 and PR #4.

### Goal

Confirm `main` baseline after PR #2 / PR #4 merge.

### Scope

Confirm local branch, sync state, PR merge state, HEAD, and clean working tree.

### Files likely affected

`docs/local-chrome-synthetic-verification.md`, `docs/CODEX_TASKS.md`, `docs/DECISION_LOG.md`

### Implementation plan

Run safe Git and GitHub read commands, then record the verified baseline.

### Acceptance criteria

`main...origin/main` is `0 0`, PR #2 and PR #4 are merged, and the local branch is `main`.

### Validation commands

`git status --short --branch`, `git branch --show-current`, `git rev-list --left-right --count main...origin/main`, `gh pr view 2 --json state,mergedAt,mergeCommit,url`, `gh pr view 4 --json state,mergedAt,mergeCommit,url`.

### Out of scope

Real X, deploy, dashboard checks, and production infrastructure.

### Risks

GitHub authentication may require the Windows keyring-capable execution path.

### Completion notes

Implemented in this verification pass.

### VERIFY-01

### Priority

P2

### Source finding

ChatGPT post-merge local verification request after PR #2 and PR #4.

### Goal

Re-run existing local Node verification on `main`.

### Scope

Run existing verification scripts only; do not add package scripts, dependencies, CI, lint, typecheck, or build setup.

### Files likely affected

`docs/local-chrome-synthetic-verification.md`

### Implementation plan

Run the existing Node scripts and record exact pass/fail status.

### Acceptance criteria

Existing local verification results are recorded without inventing test outcomes.

### Validation commands

`node tests/scripts/verify-phase1-static.mjs`, `node tests/scripts/verify-f1a-observation-safety.mjs`, `node tests/scripts/verify-f1a-main-hook-simulator.mjs`, `node tests/scripts/evaluate-f1-observation.mjs tests/fixtures/f1-a-masked-summary.fixture.json`, `node tests/scripts/audit-operational-alignment.mjs`, `git diff --check`.

### Out of scope

New test frameworks or package metadata.

### Risks

`fixture_pass` is not evidence of real X F1-A viability.

### Completion notes

Implemented in this verification pass.

### VERIFY-02

### Priority

P2

### Source finding

ChatGPT safe Chrome / Browser verification request.

### Goal

Attempt safe local Chrome verification without real X and without a logged-in Chrome profile.

### Scope

Use a `%TEMP%` Chrome profile, local file URLs, and synthetic fixture data only.

### Files likely affected

`docs/local-chrome-synthetic-verification.md`

### Implementation plan

Start Chrome with a temporary profile, attempt unpacked extension and popup verification, verify `tests/fixtures/home-timeline.html` through local synthetic controls where possible, and document any automation limits.

### Acceptance criteria

No real X URL is opened, no existing profile is used, synthetic fixture results are recorded, and unverified popup automation is clearly marked as unverified.

### Validation commands

Bounded local Chrome / DevTools Protocol checks with a temporary profile.

### Out of scope

Real X login, real X DOM, OAuth, raw X response, HAR, screenshot containing personal data, and Chrome Web Store preparation.

### Risks

Chrome unpacked extension popup automation can be unreliable from Codex without using a normal interactive profile.

### Completion notes

Implemented in this verification pass. Synthetic fixture was verified through local Chrome automation; extension popup automation remains unconfirmed and is documented for human Load unpacked verification.

### VERIFY-03

### Priority

P2

### Source finding

ChatGPT manual verification packet cleanup request.

### Goal

Keep manual Chrome Load unpacked and synthetic fixture steps current after PR #2 / PR #4.

### Scope

`docs/manual-popup-verification.md`

### Implementation plan

Clarify current scope, local-only flow, expected synthetic fixture behavior, and reportable / non-reportable information.

### Acceptance criteria

Manual steps are readable in Japanese, non-programmer-friendly, and explicitly exclude real X verification from this pass.

### Validation commands

Docs diff review.

### Out of scope

Changing popup behavior.

### Risks

Manual browser verification still requires a human to operate Chrome.

### Completion notes

Implemented in this verification pass.

### VERIFY-04

### Priority

P2

### Source finding

ChatGPT verification result document request.

### Goal

Record what was verified, what remains unverified, and the human checklist.

### Scope

`docs/local-chrome-synthetic-verification.md`

### Implementation plan

Add a small local verification result document covering baseline, Node checks, Chrome automation results, manual steps, reporting boundaries, and real X stop conditions.

### Acceptance criteria

The document separates confirmed results from unverified items and preserves raw-data / secret boundaries.

### Validation commands

Docs diff review.

### Out of scope

Claiming Chrome popup automation passed when it did not.

### Risks

The document can become stale after future Chrome or manifest changes.

### Completion notes

Implemented in this verification pass.

### VERIFY-05

### Priority

P2

### Source finding

ChatGPT coordination docs update request.

### Goal

Record the VERIFY scope and decision boundary in coordination docs.

### Scope

`docs/CODEX_TASKS.md`, `docs/DECISION_LOG.md`

### Implementation plan

Add VERIFY-00 through VERIFY-05 task records and a decision log entry for local-only Chrome / synthetic verification.

### Acceptance criteria

Docs do not imply real X, deploy, package, CI, new permissions, or Chrome Web Store work was performed.

### Validation commands

Docs diff review.

### Out of scope

Changing Claude triage decisions or implementing deferred findings.

### Risks

Future agents must distinguish local synthetic verification from live X validation.

### Completion notes

Implemented in this verification pass.

## Completed tasks

- COD-00: Implemented.
- COD-01: Implemented.
- COD-02: Implemented.
- COD-03: Implemented.
- COD-04: Implemented.
- COD-05: Implemented.
- MAINT-00: Implemented.
- MAINT-01: Implemented.
- MAINT-02: Implemented.
- MAINT-03: Implemented.
- MAINT-04: Implemented.
- VERIFY-00: Implemented.
- VERIFY-01: Implemented.
- VERIFY-02: Implemented.
- VERIFY-03: Implemented.
- VERIFY-04: Implemented.
- VERIFY-05: Implemented.
