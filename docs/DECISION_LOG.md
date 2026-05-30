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

## Initial decisions

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
- Status: Active
- Related files: `docs/CLAUDE_REVIEW.md`, `docs/AI_REVIEW_TRIAGE.md`, `docs/CODEX_TASKS.md`
- Related review findings: None yet.

### 2026-05-29: Claude Code is used as an independent reviewer

- Date: 2026-05-29
- Decision: Claude Code will be used for independent review only unless the user explicitly instructs otherwise.
- Context: The planned workflow asks Claude to review the repository without editing it.
- Options considered: Claude as reviewer only; Claude as direct implementer.
- Rationale: Keeping review and implementation separate reduces accidental scope drift and preserves ChatGPT triage authority.
- Consequences: Claude findings should be pasted into `docs/CLAUDE_REVIEW.md` or returned to ChatGPT, then triaged before Codex implementation.
- Status: Active
- Related files: `docs/CLAUDE_REVIEW.md`, `docs/AI_REVIEW_TRIAGE.md`
- Related review findings: None yet.

### 2026-05-29: Codex implements only ChatGPT-approved tasks

- Date: 2026-05-29
- Decision: Codex must implement only tasks approved through ChatGPT triage.
- Context: Claude may produce advisory findings, but those findings are not automatically accepted.
- Options considered: Implement all Claude findings; implement only approved findings; implement only high-severity findings.
- Rationale: User instructions define ChatGPT as commander and require accepted/deferred/rejected triage.
- Consequences: `docs/CODEX_TASKS.md` should be populated from approved findings in `docs/AI_REVIEW_TRIAGE.md`, not directly from Claude notes.
- Status: Active
- Related files: `docs/AI_REVIEW_TRIAGE.md`, `docs/CODEX_TASKS.md`
- Related review findings: None yet.

### 2026-05-29: Claude review findings are not automatically accepted

- Date: 2026-05-29
- Decision: Claude review findings remain advisory until ChatGPT triages them.
- Context: The future review may contain correct findings, preference-based suggestions, future-scope ideas, or findings that conflict with current phase boundaries.
- Options considered: Auto-accept all findings; auto-accept by severity; require explicit ChatGPT decision.
- Rationale: Explicit triage keeps product scope, risk tolerance, and implementation priority under ChatGPT/user control.
- Consequences: Each finding should receive an approved, deferred, or rejected status before Codex works on it.
- Status: Active
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

- Whether these docs should be committed to Git.
- Which branch should be reviewed by Claude Code.
- Whether Claude should review the whole repository or a diff.
- Whether a secrets/config audit should be performed before external review.
- Which issues are MVP-blocking.
- Whether lack of CI/package scripts is MVP-blocking or later hygiene.
- Whether F1-A should remain deferred until live masked observations exist.
- Whether Chrome Web Store review readiness is in scope for the next review pass.
