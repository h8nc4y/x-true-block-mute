# Deferred findings register

## Status

Prepared by Codex on 2026-05-31 for Phase 2 readiness coordination. Updated 2026-06-13 for the governance change. This register records known deferred work without approving implementation.

## Rule

Deferred items are not tasks. They are implemented only after the user approves them in chat and they are promoted into `TASKS_BACKLOG.md`. Several items below have since been approved as the P2 roadmap (M1–M7) in `TASKS_BACKLOG.md`; this register stays as the rationale record.

## Deferred review findings

| ID | Area | Current handling | Why deferred | Required before implementation |
| --- | --- | --- | --- | --- |
| CL-AUDIT-006 | MutationObserver / card processing performance | Existing Phase 1 path remains. | Folded into M5 (P2-013). | User approval, concrete performance issue, acceptance criteria, local tests. |
| CL-AUDIT-007 | MAIN-world hook lifecycle / teardown | Research scaffold remains non-production. | Hook teardown and SPA continuity are live-behavior sensitive. | Chrome confirmation, F1-A viability decision, threat-model update. |
| CL-AUDIT-011 | Packaging / CI / distribution readiness | No package, CI, or store workflow added. | Approved as M7 (P2-017–P2-021). | User approval, target distribution decision, safe CI design. |

## Deferred product and architecture items

| ID | Area | Current handling | Why deferred | Required before implementation |
| --- | --- | --- | --- | --- |
| PHASE2-F1A-SYNC | Production F1-A sync | Captured responses are not written to `xtbmEntries` (until M4). | Live endpoint shape pending M3; approved as M4 (P2-008) if `f1a_viable`. | `f1a_viable` live masked summary, user approval, privacy update, rollback path. |
| PHASE2-F1B-DOM | F1-B DOM extraction | Not implemented. | Fallback (M4', P2-011) only if F1-A is `f1a_insufficient`. | User-approved real-DOM research plan and test fixtures. |
| PHASE2-F1C-API | F1-C X API / OAuth | Not implemented. | Closed (not pursued); F1-A accuracy path is preferred. | n/a — closed by 2026-06-13 decision. |
| PHASE2-F1D-IMPORT | F1-D import UI | Not implemented. | Fallback (M4', P2-011) only if F1-A is `f1a_insufficient`. | User product decision, import schema, validation and deletion behavior. |
| PHASE2-REAL-DOM-MATCH | Real-DOM author matching | Synthetic `data-user-id` / `data-handle` path remains. | Approved as M5 (P2-012); real X DOM can mix author, quote, embedded, profile, and related-link data. | Real-DOM research plan, safe fixtures, user-confirmed observations. |
| PHASE2-MUTATION-REWRITE | MutationObserver rewrite | Current observer remains. | No approved implementation task yet. | Measurable bug/performance issue and scoped implementation plan. |
| PHASE2-HOOK-PRODUCTION | MAIN-world hook productionization | Research-only hook remains. | Hook teardown, idempotency, and SPA navigation are not proven. | Live masked-summary gate, lifecycle design, safety tests. |
| DIST-CHROME-STORE | Chrome Web Store preparation | Not started. | Approved as M7; this is the final goal. | Privacy policy, package/release checklist; developer registration, payment, and final submission performed by the user. |
| OPS-DEPLOY | Cloudflare/Vercel/dashboard/deploy work | Not applicable to current extension gate. | Out of scope; the extension is local-only with no backend. | Separate approved ops task. |

## Stop conditions

Stop and return to the user before implementing a deferred item if it would require:

- Receiving or storing credentials: password, MFA, Cookies, tokens, or secrets.
- Handling, off the user's own device storage, a raw X response, HAR, screenshot, raw user ID, raw handle, display name, or post body.
- New permissions such as `webRequest`, `cookies`, `tabs`, `activeTab`, `<all_urls>`, or `https://api.x.com/*` without rationale, threat-model update, and user approval.
- Any off-device data egress, deploy, external dashboard, paid service, or external API.

## Minimum approval record

When the user approves a deferred item, capture in `TASKS_BACKLOG.md`:

- Finding or task ID.
- Exact scope and milestone.
- Files likely affected.
- Acceptance criteria.
- Validation commands.
- Privacy constraints.
- Out-of-scope list.

## Verification blockers (現状)

These are verifiable by Claude Code (M2 Playwright/CDP, M3 Chrome MCP) but remain 未確認 until those runs complete:

- Chrome Load unpacked and popup confirmation is 未確認 (M2).
- Real X DOM behavior is 未確認 (M5).
- F1-A live endpoint shape and pagination are 未確認 (M3).
- A real-account masked summary is not yet collected in this repository.

## Next minimum step

Run the M2 Chrome Load unpacked verification (Playwright/CDP, using `docs/manual-popup-verification.md` as the checklist), then proceed to M3 live masked-summary evaluation. Report results as actually measured.
