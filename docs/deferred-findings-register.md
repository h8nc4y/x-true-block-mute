# Deferred findings register

## Status

Prepared by Codex on 2026-05-31 for Phase 2 readiness coordination. Updated 2026-06-19 for the v1.1 / M7 tracker alignment. This register records known deferred work without approving implementation.

## Rule

Deferred items are not tasks. They are implemented only after the user approves them in chat and they are promoted into `TASKS_BACKLOG.md`. Several items below have since been approved and completed as the P2 roadmap (M1–M7) in `TASKS_BACKLOG.md`; this register stays as the rationale and status record.

## Deferred review findings

| ID | Area | Current handling | Why deferred | Required before implementation |
| --- | --- | --- | --- | --- |
| CL-AUDIT-006 | MutationObserver / card processing performance | Resolved in M5 (P2-013): SPA rescan, missed-post prevention, and detached replacement pruning landed in `a0538ae`. | Historical audit finding; no open implementation task remains. | n/a unless a new measurable performance or correctness issue is found. |
| CL-AUDIT-007 | MAIN-world hook lifecycle / teardown | Resolved as the original research-scaffold audit item; production sync now uses declarative settings-page `world:"MAIN"` content scripts. | Historical audit finding; ongoing hook idempotency/SPA vigilance is tracked separately as `PHASE2-HOOK-PRODUCTION`. | n/a for this finding; use `PHASE2-HOOK-PRODUCTION` for future hook-specific work. |
| CL-AUDIT-011 | Packaging / CI / distribution readiness | Package, listing assets, privacy policy, and store submission prep are resolved in M7; CI remains absent. | Store submission is owner-side and `.github/workflows` changes remain a §9 gate. | User approval before workflow changes or release automation. |

## Deferred product and architecture items

| ID | Area | Current handling | Why deferred | Required before implementation |
| --- | --- | --- | --- | --- |
| PHASE2-F1A-SYNC | Production F1-A sync | Resolved in M4 (P2-008/P2-009b): after `f1a_viable` approval, settings-page GraphQL responses are reduced to `user_id` / `handle` / `listKind` only and merged into local `xtbmEntries`; raw response, cursor, display name, and body remain out of storage. Historical guard: Captured responses are not written to `xtbmEntries` before M4 approval. | Completed by the approved F1-A primary path and reconciliation implementation. | n/a unless a new data source or permission model is proposed. |
| PHASE2-F1B-DOM | F1-B DOM extraction | Closed as current fallback: not implemented because F1-A is `f1a_viable` and selected for v1.1 sync. | Reopen only if a new product/data-source decision supersedes F1-A. | User-approved research plan, safe fixtures, privacy update, and acceptance criteria. |
| PHASE2-F1C-API | F1-C X API / OAuth | Not implemented. | Closed (not pursued); F1-A accuracy path is preferred. | n/a — closed by 2026-06-13 decision. |
| PHASE2-F1D-IMPORT | F1-D import UI | Closed as current fallback: not implemented because F1-A is `f1a_viable` and selected for v1.1 sync. | Reopen only if manual import becomes a new product requirement. | User product decision, import schema, validation and deletion behavior. |
| PHASE2-REAL-DOM-MATCH | Real-DOM author matching | Resolved in M5 (P2-012): `e137d04` limits author-handle extraction to the top-level User-Name area and handles quote/embed separation defensively. | Completed as part of v1.1 real-DOM filtering. | n/a unless X changes DOM semantics and a new safe fixture/research plan is needed. |
| PHASE2-MUTATION-REWRITE | MutationObserver rewrite | Resolved for current scope in M5 (P2-013): `a0538ae` prevents missed posts, prunes detached replacements, and survives SPA navigation. | Completed for the current known issue set; avoid speculative rewrites without evidence. | New measurable bug/performance issue and scoped implementation plan. |
| PHASE2-HOOK-PRODUCTION | MAIN-world hook productionization | Production declarative settings-page hook is shipped; 2026-06-19 hardening gates response-body reads behind settings-list-page and list-endpoint checks. Idempotency, explicit teardown assumptions, and SPA navigation remain watch-items. | Not a launch blocker, but future code review should stay bounded to safety and lifecycle behavior. | Local safety tests, no new permissions, no raw response handling, and no product data-source change. |
| DIST-CHROME-STORE | Chrome Web Store preparation | M7 preparation is done and owner submitted the item for review; review result remains 未確認. | Public submission/re-submission is a §9 gate handled by the owner. | Review result or rejection reason, then scoped fix/rollback plan if needed. |
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

The original M2/M3/M5 blockers below are resolved by the P2 roadmap unless marked otherwise:

- Chrome Load unpacked and popup confirmation: resolved in M2 by `tests/scripts/verify-extension-load-chrome.mjs`.
- Real X DOM behavior: resolved in M5 by quote-aware author matching and SPA rescan work; report only aggregate/safe facts.
- F1-A live endpoint shape and pagination: resolved in M3 as `f1a_viable`; raw response/cursor values remain forbidden.
- A real-account masked summary: collected/evaluated during M3 without committing raw identifiers.
- Chrome Web Store review result: 未確認; owner-side review/approval flow remains outside this register.

## Next minimum step

While Chrome Web Store review is pending, the next agent-safe work is documentation consistency, local check maintenance, and bounded review of `PHASE2-HOOK-PRODUCTION` without changing permissions or product data sources.
