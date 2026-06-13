# DECISION_LOG

## Purpose

This file records important product, architecture, review, and AI coordination decisions over time.

It is intended to preserve context across ChatGPT, Codex, Claude Code, and future repository work. It should record real decisions and their rationale, not speculative product claims.

## Decision format

Use this template for new decisions.

```text
- Date:
- Decision:
- Context:
- Options considered:
- Rationale:
- Consequences:
- Status:
- Related files:
- Related review findings:
```

## Current decisions

### 2026-06-13: User-direct approval replaces ChatGPT-commander governance

- Date: 2026-06-13
- Decision: The repository moves from ChatGPT-commander governance to user-direct approval. The user approves tasks directly in chat and Claude Code implements them. Claude Code may perform live X verification by driving the user's already-logged-in Chrome through the Chrome MCP (collecting masked observations only), and may automate Chrome Load unpacked / popup / fixture verification through Playwright/CDP. The final goal is general distribution on the Chrome Web Store.
- Context: Development was handed off from Codex to Claude Code. The user clarified the final goal (Chrome Web Store distribution for non-engineers), chose the highest-accuracy acquisition path (F1-A primary if live evaluation is viable, otherwise F1-B/F1-D fallback), and replaced ChatGPT triage with their own direct approval.
- Options considered: Keep ChatGPT as commander with Claude advisory; switch to user-direct approval with Claude implementing; keep live X verification blocked.
- Rationale: A single approval authority (the user, in this chat) removes the indirection that previously blocked Phase 2, live X evaluation, and distribution work. Privacy invariants are preserved by tightening *how* live verification is done, not by forbidding it.
- Consequences: The prior ChatGPT-commander / Codex-approved-only / Claude-advisory decisions below are Superseded. Phase 2 (production sync, real-DOM author matching), Web Store preparation, and Claude-driven live X masked-observation collection are now in scope under user approval. The following invariants continue unchanged: no raw account data (Cookie, CSRF/Authorization/OAuth token, raw user_id, raw handle, display name, post body, HAR, personal screenshot) is read or stored or committed; permissions stay minimal (`storage` + `scripting`, host `x.com`/`twitter.com`); `unsafe_summary` stops processing and the summary is deleted; verification results are reported as actually measured, never fabricated. The local readiness gating from "Phase 2 remains gated" is replaced by user approval rather than ChatGPT approval.
- Status: Active
- Related files: `TASKS_BACKLOG.md`, `AGENTS.md`, `README.md`, `docs/phase2-readiness-gates.md`, `docs/privacy-threat-model.md`, `docs/deferred-findings-register.md`, `docs/decisions/f1-source-selection.md`, `tests/scripts/verify-docs-consistency.mjs`, `tests/scripts/audit-operational-alignment.mjs`
- Related review findings: None.

## Initial decisions

### 2026-05-31: Phase 2 remains gated by local readiness, privacy, and ChatGPT approval

- Date: 2026-05-31
- Decision: Codex may prepare GATE-00 through GATE-05 readiness documentation, but must not start Phase 2 implementation, real X verification, external API work, packaging, CI, deployment, or Chrome Web Store preparation in this pass.
- Context: The user is waiting for human Chrome Load unpacked verification and asked Codex to add Phase 2 readiness gates, a privacy/threat model, a deferred findings register, and a docs consistency verification script.
- Options considered: Start Phase 2 implementation immediately; perform real X or Chrome 실機 verification from Codex; create local readiness and governance docs only.
- Rationale: The repository still needs human Chrome Load unpacked / popup confirmation and ChatGPT triage before higher-risk implementation. Docs-only gates improve reviewability without exposing secrets, OAuth credentials, raw X data, account data, or production infrastructure.
- Consequences: `docs/phase2-readiness-gates.md`, `docs/privacy-threat-model.md`, `docs/deferred-findings-register.md`, and `tests/scripts/verify-docs-consistency.mjs` become the current local readiness packet. Phase 2, production sync, F1-B/F1-C/F1-D, real-DOM matching, package/CI, deploy, and Chrome Web Store work remain deferred.
- Status: Superseded by 2026-06-13 governance change (gating now by user approval, not ChatGPT; Phase 2 and Web Store work in scope)
- Related files: `docs/phase2-readiness-gates.md`, `docs/privacy-threat-model.md`, `docs/deferred-findings-register.md`, `tests/scripts/verify-docs-consistency.mjs`, `docs/CODEX_TASKS.md`
- Related review findings: CL-AUDIT-006, CL-AUDIT-007, CL-AUDIT-011

### 2026-05-31: Keep post-merge Chrome verification local-only before real X

- Date: 2026-05-31
- Decision: After PR #2 and PR #4, Codex may verify only the local Chrome extension loading path and synthetic fixture path, and must not proceed to real X verification in this pass.
- Context: ChatGPT approved VERIFY-00 through VERIFY-05 to prepare safe Chrome Load unpacked / popup / synthetic fixture verification after `main` reached `6c6238707bad4629a6074bf8eb107487893b9453`.
- Options considered: Proceed to real X login; use an existing logged-in Chrome profile; use a temporary Chrome profile and local fixture only; skip Chrome automation and only write manual docs.
- Rationale: Local-only verification improves confidence in the extension shell and fixture path without exposing account data, tokens, Cookies, raw X responses, HAR files, or personal screenshots.
- Consequences: Synthetic fixture behavior can be verified locally, but popup Load unpacked still needs human confirmation when Codex cannot reliably automate the extension context. Real X DOM, F1-A live endpoint checks, production sync, F1-B/F1-C/F1-D, package/CI work, deploy, and Chrome Web Store work remain out of scope.
- Status: Superseded by 2026-06-13 governance change (Claude Code may automate Chrome verification via Playwright/CDP and drive live X masked-observation collection via Chrome MCP)
- Related files: `docs/manual-popup-verification.md`, `docs/local-chrome-synthetic-verification.md`, `docs/CODEX_TASKS.md`
- Related review findings: None.

### 2026-05-31: ChatGPT approves low-risk maintenance follow-up after PR #2

- Date: 2026-05-31
- Decision: Codex may implement MAINT-00 through MAINT-04 as a low-risk maintenance follow-up on a new branch from `main`.
- Context: PR #2 was squash-merged into `main`, completing COD-00 through COD-05. ChatGPT then approved a smaller follow-up scope from previously deferred Claude findings.
- Options considered: Leave all remaining Claude findings deferred; implement only static consistency guards and documentation cleanup; move into Phase 2 implementation.
- Rationale: The approved work improves maintainability and reviewability without adding permissions, dependencies, CI/package setup, production sync, OAuth/API work, live X verification, or real-DOM author matching.
- Consequences: CL-AUDIT-008, CL-AUDIT-009, and CL-AUDIT-010 are partially approved only for MAINT-01 through MAINT-03. CL-AUDIT-006, CL-AUDIT-007, CL-AUDIT-011, Phase 2, production sync, F1-B/F1-C/F1-D, and Chrome Web Store work remain deferred.
- Status: Active
- Related files: `manifest.json`, `src/content/content-script.js`, `tests/scripts/verify-phase1-static.mjs`, `tests/scripts/verify-f1a-observation-safety.mjs`, `README.md`, `docs/AI_REVIEW_TRIAGE.md`, `docs/CODEX_TASKS.md`
- Related review findings: CL-AUDIT-008, CL-AUDIT-009, CL-AUDIT-010

### 2026-05-30: ChatGPT triage limits this implementation pass to COD-00〜COD-05

- Date: 2026-05-30
- Decision: Codex may implement only COD-00〜COD-05 from the ChatGPT-approved triage scope.
- Context: Claude Code review findings were triaged by ChatGPT before Codex implementation.
- Options considered: Implement all Claude findings; implement only approved and partially approved items; defer all review work.
- Rationale: The user instructed Codex not to implement Claude suggestions directly and to use ChatGPT triage as the decision authority.
- Consequences: Production F1-A sync, F1-B, F1-C OAuth/API, F1-D import UI, Chrome Web Store preparation, real-DOM author matching changes, MutationObserver changes, teardown implementation, package setup, and CI setup remain out of scope.
- Status: Active
- Related files: `docs/CLAUDE_REVIEW.md`, `docs/AI_REVIEW_TRIAGE.md`, `docs/CODEX_TASKS.md`
- Related review findings: CL-AUDIT-001, CL-AUDIT-002, CL-AUDIT-003, CL-AUDIT-004, CL-AUDIT-005

### 2026-05-29: ChatGPT remains commander for review triage

- Date: 2026-05-29
- Decision: ChatGPT remains the decision-maker for review triage.
- Context: The repository will later be reviewed by Claude Code, but Claude must not directly control Codex implementation.
- Options considered: Let Claude findings become tasks automatically; require ChatGPT to accept/defer/reject findings first.
- Rationale: The user explicitly requires ChatGPT to decide which findings are accepted, deferred, or rejected.
- Consequences: Codex must wait for ChatGPT-approved tasks before implementing review fixes.
- Status: Superseded by 2026-06-13 governance change (the user is now the approval authority)
- Related files: `docs/CLAUDE_REVIEW.md`, `docs/AI_REVIEW_TRIAGE.md`, `docs/CODEX_TASKS.md`
- Related review findings: None yet.

### 2026-05-29: Claude Code is used as an independent reviewer

- Date: 2026-05-29
- Decision: Claude Code will be used for independent review only unless the user explicitly instructs otherwise.
- Context: The planned workflow asks Claude to review the repository without editing it.
- Options considered: Claude as reviewer only; Claude as direct implementer.
- Rationale: Keeping review and implementation separate reduces accidental scope drift and preserves ChatGPT triage authority.
- Consequences: Claude findings should be pasted into `docs/CLAUDE_REVIEW.md` or returned to ChatGPT, then triaged before Codex implementation.
- Status: Superseded by 2026-06-13 governance change (Claude Code now implements user-approved tasks directly)
- Related files: `docs/CLAUDE_REVIEW.md`, `docs/AI_REVIEW_TRIAGE.md`
- Related review findings: None yet.

### 2026-05-29: Codex implements only ChatGPT-approved tasks

- Date: 2026-05-29
- Decision: Codex must implement only tasks approved through ChatGPT triage.
- Context: Claude may produce advisory findings, but those findings are not automatically accepted.
- Options considered: Implement all Claude findings; implement only approved findings; implement only high-severity findings.
- Rationale: User instructions define ChatGPT as commander and require accepted/deferred/rejected triage.
- Consequences: `docs/CODEX_TASKS.md` should be populated from approved findings in `docs/AI_REVIEW_TRIAGE.md`, not directly from Claude notes.
- Status: Superseded by 2026-06-13 governance change (current tasks live in `TASKS_BACKLOG.md` under user approval)
- Related files: `docs/AI_REVIEW_TRIAGE.md`, `docs/CODEX_TASKS.md`
- Related review findings: None yet.

### 2026-05-29: Claude review findings are not automatically accepted

- Date: 2026-05-29
- Decision: Claude review findings remain advisory until ChatGPT triages them.
- Context: The future review may contain correct findings, preference-based suggestions, future-scope ideas, or findings that conflict with current phase boundaries.
- Options considered: Auto-accept all findings; auto-accept by severity; require explicit ChatGPT decision.
- Rationale: Explicit triage keeps product scope, risk tolerance, and implementation priority under ChatGPT/user control.
- Consequences: Each finding should receive an approved, deferred, or rejected status before Codex works on it.
- Status: Superseded by 2026-06-13 governance change (the user approves findings directly in chat)
- Related files: `docs/CLAUDE_REVIEW.md`, `docs/AI_REVIEW_TRIAGE.md`
- Related review findings: None yet.

### 2026-05-29: Review coordination docs preserve context across AI tools

- Date: 2026-05-29
- Decision: The repository will use dedicated docs for review context, Claude review capture, ChatGPT triage, Codex task conversion, and decisions.
- Context: The project is developed through ChatGPT and Codex and will later involve Claude Code review.
- Options considered: Keep context only in chat; add durable repository docs.
- Rationale: Repository docs make the handoff reviewable, reduce prompt drift, and allow future agents to inspect the same source of truth.
- Consequences: The five AI coordination docs should be kept current when review cycles occur.
- Status: Active
- Related files: `docs/REVIEW_BRIEF.md`, `docs/CLAUDE_REVIEW.md`, `docs/AI_REVIEW_TRIAGE.md`, `docs/CODEX_TASKS.md`, `docs/DECISION_LOG.md`
- Related review findings: None yet.

## Open decisions

- Whether F1-A is viable as the primary source (pending the live masked-summary evaluation in M3; falls back to F1-B/F1-D if `f1a_insufficient`).
- Whether the declarative `content_scripts` `"world": "MAIN"` migration lets us drop the `scripting` permission (to be tested in M4).
- Whether an options page is needed for entry management and privacy disclosure, or the popup is sufficient (M6).
- Where to host the privacy policy URL required for Chrome Web Store submission (M7).

## Resolved decisions (2026-06-13)

- Chrome Web Store general distribution is the final goal; readiness work is in scope.
- F1-A (highest accuracy) is the preferred source, evaluated live before adoption; F1-B/F1-D are fallbacks. F1-C (X API / OAuth) is closed.
- These coordination docs are committed to Git and remain the durable handoff record.
- The user is the approval authority; Claude Code implements approved tasks and may automate Chrome and live X verification within the privacy invariants.
