# Deferred findings register

## Status

Prepared by Codex on 2026-05-31 for Phase 2 readiness coordination. This register records known deferred work without approving implementation.

## Rule

Deferred items are not tasks. Codex must not implement any item in this register unless ChatGPT later moves it into `docs/AI_REVIEW_TRIAGE.md` approved findings and `docs/CODEX_TASKS.md` approved task queue.

## Deferred review findings

| ID | Area | Current handling | Why deferred | Required before implementation |
| --- | --- | --- | --- | --- |
| CL-AUDIT-006 | MutationObserver / card processing performance | Existing Phase 1 path remains. | Not approved in the current gate pass. | ChatGPT approval, concrete performance issue, acceptance criteria, local tests. |
| CL-AUDIT-007 | MAIN-world hook lifecycle / teardown | Research scaffold remains non-production. | Hook teardown and SPA continuity are live-behavior sensitive. | Human Chrome confirmation, F1-A viability decision, threat-model update. |
| CL-AUDIT-011 | Packaging / CI / distribution readiness | No package, CI, or store workflow added. | Explicitly out of scope for the current docs-only gate pass. | ChatGPT approval, target distribution decision, safe CI design. |

## Deferred product and architecture items

| ID | Area | Current handling | Why deferred | Required before implementation |
| --- | --- | --- | --- | --- |
| PHASE2-F1A-SYNC | Production F1-A sync | Captured responses are not written to `xtbmEntries`. | Live endpoint shape and safe storage design are 未確認. | `f1a_viable` live masked summary, ChatGPT approval, privacy update, rollback path. |
| PHASE2-F1B-DOM | F1-B DOM extraction | Not implemented. | Real-DOM author matching and privacy behavior are 未確認. | Human-approved real-DOM research plan and test fixtures. |
| PHASE2-F1C-API | F1-C X API / OAuth | Not implemented. | OAuth/API integration is outside current scope and may require external credentials. | Explicit user approval, OAuth/privacy design, cost and API policy review. |
| PHASE2-F1D-IMPORT | F1-D import UI | Not implemented. | UX and import format are not decided. | ChatGPT product decision, import schema, validation and deletion behavior. |
| PHASE2-REAL-DOM-MATCH | Real-DOM author matching | Synthetic `data-user-id` / `data-handle` path remains. | Real X DOM can mix author, quote, embedded, profile, and related-link data. | Real-DOM research plan, safe fixtures, human-confirmed observations. |
| PHASE2-MUTATION-REWRITE | MutationObserver rewrite | Current observer remains. | No approved implementation task yet. | Measurable bug/performance issue and scoped implementation plan. |
| PHASE2-HOOK-PRODUCTION | MAIN-world hook productionization | Research-only hook remains. | Hook teardown, idempotency, and SPA navigation are not proven. | Live masked-summary gate, lifecycle design, safety tests. |
| DIST-CHROME-STORE | Chrome Web Store preparation | Not started. | Product, privacy, package, icon, listing, and review requirements are undecided. | Distribution decision, privacy policy, package/release checklist. |
| OPS-DEPLOY | Cloudflare/Vercel/dashboard/deploy work | Not applicable to current extension gate. | User explicitly excluded deployment and external dashboards. | Separate approved ops task. |

## Stop conditions

Stop and return to ChatGPT before implementing a deferred item if it would require:

- Real X login or live X access by Codex.
- OAuth, Cookies, tokens, or secrets.
- Raw X response, HAR, screenshot, raw user ID, raw handle, display name, or post body handling.
- New permissions such as `webRequest`, `cookies`, `tabs`, `activeTab`, `<all_urls>`, or `https://api.x.com/*`.
- CI/package setup, Chrome Web Store preparation, deploy, or external dashboards.
- Paid services or external APIs.

## Minimum future approval packet

Before any deferred item becomes a Codex task, ChatGPT should provide:

- Finding or task ID.
- Reason for approval.
- Exact scope.
- Files likely affected.
- Acceptance criteria.
- Validation commands.
- Privacy constraints.
- Out-of-scope list.
- Whether human Chrome Load unpacked confirmation is complete.

## Human blockers

- Chrome Load unpacked confirmation is 未確認.
- Popup human confirmation is 未確認.
- Real X DOM behavior is 未確認.
- F1-A live endpoint shape and pagination are 未確認.
- F1-A masked summary from a real account is not available in this repository.

## Next minimum step

Complete the local human Chrome Load unpacked checklist in `docs/manual-popup-verification.md`, then return the result to ChatGPT for triage before any deferred Phase 2 implementation.
