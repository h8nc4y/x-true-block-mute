# AI_REVIEW_TRIAGE

> **ARCHIVED (2026-06-13)**: この文書は ChatGPT 承認制ガバナンス時代の歴史的記録です。「Claude findings remain advisory; ChatGPT is the decision-maker」を含む triage ルールは現在無効です。現行の運用ルールは [`AGENTS.md`](../AGENTS.md)、現行タスクは [`TASKS_BACKLOG.md`](../TASKS_BACKLOG.md)、経緯は [`DECISION_LOG.md`](DECISION_LOG.md) の 2026-06-13 決定を参照してください。本文は CL-AUDIT 出典の追跡のため凍結保存しています。

## Status

ChatGPT triage has been performed for the Claude Code review findings referenced by the current Codex task.

This file records the triage decisions and implementation scope provided to Codex. Claude findings remain advisory; ChatGPT is the decision-maker.

## Triage rules

- Claude findings are advisory.
- ChatGPT is the decision-maker for review triage.
- Codex must implement only tasks that ChatGPT explicitly approves.
- Deferred items must not be implemented unless ChatGPT later approves them.
- Rejected items must not be implemented unless ChatGPT later changes the decision.
- Codex must not treat Claude severity labels as implementation approval.
- Codex must preserve project phase boundaries unless ChatGPT explicitly expands scope.
- Findings involving secrets, OAuth credentials, raw X data, paid APIs, or production infrastructure must be handled under the repository safety policy before implementation.

## Approved findings

- Finding ID: CL-AUDIT-001
- Reason for approval: ChatGPT approved endpoint path privacy hardening.
- Scope: Harden F1-A endpoint path masking and unsafe detection for handle-like path identifiers.
- Implementation task: COD-01
- Acceptance criteria: Non-allowlisted endpoint path segments do not preserve raw identifiers; unsafe detector flags intentionally unmasked handle-like path segments; existing F1-A safety fixtures still pass.
- Validation: `node tests/scripts/verify-f1a-observation-safety.mjs`, `node tests/scripts/verify-f1a-main-hook-simulator.mjs`, `node tests/scripts/evaluate-f1-observation.mjs tests/fixtures/f1-a-masked-summary.fixture.json`
- Priority: P1

- Finding ID: CL-AUDIT-003
- Reason for approval: ChatGPT approved storage load-order hardening.
- Scope: Reduce fragile initial-evaluation dependency on `ResearchF1A`; add static ordering checks where ordering is required.
- Implementation task: COD-03
- Acceptance criteria: `storage.js` resolves `ResearchF1A` lazily for research normalization; manifest/popup script order remains explicit; storage schema and behavior remain unchanged.
- Validation: `node tests/scripts/verify-phase1-static.mjs`
- Priority: P1

- Finding ID: CL-AUDIT-005
- Reason for approval: ChatGPT approved defensive privacy ignore patterns.
- Scope: Add conservative `.gitignore` patterns for HAR, screenshots, raw/masked summaries, and exported observation artifacts.
- Implementation task: COD-02
- Acceptance criteria: Privacy-sensitive local artifacts are ignored; legitimate tracked fixtures are not broken.
- Validation: Git diff review and `git status --short`.
- Priority: P2

## Partially approved findings

- Finding ID: CL-AUDIT-002
- Reason for partial approval: ChatGPT approved documentation clarification only.
- Scope: State current real-DOM limitations clearly in docs.
- Implementation task: COD-05
- Acceptance criteria: Docs state current handle extraction is for synthetic/local Phase 1 verification, real X DOM author identity is not guaranteed, quote/embedded target handling is not production-complete, and real-DOM author matching remains Phase 2 work.
- Out of scope: content-script real-DOM matching logic changes.
- Validation: Docs diff review.
- Priority: P2

- Finding ID: CL-AUDIT-004
- Reason for partial approval: ChatGPT approved env/argument portability and explicit skip behavior only.
- Scope: Replace hard-coded machine-specific external audit paths with opt-in env vars and/or CLI args.
- Implementation task: COD-04
- Acceptance criteria: Default no-env audit passes with explicit skip reasons for optional external checks; external config/rules contents are summarized only and not printed raw.
- Out of scope: exposing raw external contents or requiring repo-external files for normal verification.
- Validation: `node tests/scripts/audit-operational-alignment.mjs`
- Priority: P2

## Later approved maintenance findings

- Finding ID: CL-AUDIT-008
- Reason for approval: ChatGPT approved low-risk content-script scope and dead-code cleanup after PR #2 merged.
- Scope: Exclude the normal Phase 1 filter content script from F1-A settings pages while preserving the research bridge, and remove unused original-card expando state if safe.
- Implementation task: MAINT-02
- Acceptance criteria: Research bridge still matches `/settings/blocked/all` and `/settings/muted/all`; normal filter content script excludes those pages; no new permissions are added; unused `__xTbmOriginalCard` state is absent.
- Out of scope: MutationObserver behavior changes, teardown implementation, F1-A bridge removal, Phase 2 behavior, and real-DOM author matching.
- Validation: `node tests/scripts/verify-phase1-static.mjs`
- Priority: P3

- Finding ID: CL-AUDIT-009
- Reason for approval: ChatGPT approved consistency checks only, not production-code single-source refactoring.
- Scope: Add static guards for duplicated message constants and MAIN-world masking allowlists.
- Implementation task: MAINT-01
- Acceptance criteria: `research-background.js` message constants match `src/shared/constants.js`; MAIN-world hook and `observation-utils.js` safe schema and endpoint segment allowlists stay aligned.
- Out of scope: Refactoring MAIN-world hook production code into shared isolated-world utilities.
- Validation: `node tests/scripts/verify-phase1-static.mjs`, `node tests/scripts/verify-f1a-observation-safety.mjs`
- Priority: P3

- Finding ID: CL-AUDIT-010
- Reason for approval: ChatGPT approved README phase/status clarity cleanup.
- Scope: Clarify that the project is currently Phase 1 / Phase 1.5 research/prototype, describe the settings-page bridge ownership, and keep future Phase 2 work clearly out of scope.
- Implementation task: MAINT-03
- Acceptance criteria: README separates current status from future or unimplemented functionality.
- Out of scope: Product behavior changes.
- Validation: Docs diff review and `node tests/scripts/audit-operational-alignment.mjs`
- Priority: P3

## Deferred findings

- Finding ID: CL-AUDIT-006
- Reason for deferral: ChatGPT triage marked this finding as deferred.
- Information needed: Future ChatGPT approval and task scope.
- Revisit condition: ChatGPT explicitly approves a new task.

- Finding ID: CL-AUDIT-007
- Reason for deferral: ChatGPT triage marked this finding as deferred.
- Information needed: Future ChatGPT approval and task scope.
- Revisit condition: ChatGPT explicitly approves a new task.

- Finding ID: CL-AUDIT-011
- Reason for deferral: ChatGPT triage marked this finding as deferred.
- Information needed: Future ChatGPT approval and task scope.
- Revisit condition: ChatGPT explicitly approves a new task.

## Rejected findings

No rejected findings were provided in the current ChatGPT triage summary.

Template for future rejected items:

```text
- Finding ID:
- Reason for rejection:
- Risk accepted:
- Notes:
```

## Open questions

- ChatGPT did not approve production F1-A sync, F1-B, F1-C OAuth/API, F1-D import UI, Chrome Web Store preparation, real-DOM author matching changes, MutationObserver behavior changes, teardown implementation, package setup, or CI setup for this task.
- Live X/manual verification results remain unavailable in this repository context.
