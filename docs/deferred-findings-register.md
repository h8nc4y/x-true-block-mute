# Deferred findings register

## Status

Prepared by Codex on 2026-05-31 for Phase 2 readiness coordination. Updated 2026-07-21 for the published v1.1.1 state and the 2026-07-15 review queue. This register records the rationale and gate state for known findings; implementation status is tracked in `TASKS_BACKLOG.md`.

## Rule

Deferred items are not tasks. They are implemented only after the user approves them in chat and they are promoted into `TASKS_BACKLOG.md`. Several items below have since been approved and completed as the P2 roadmap (M1–M7) in `TASKS_BACKLOG.md`; this register stays as the rationale and status record.

## Deferred review findings

| ID | Area | Current handling | Why deferred | Required before implementation |
| --- | --- | --- | --- | --- |
| CL-AUDIT-006 | MutationObserver / card processing performance | Resolved in M5 (P2-013): SPA rescan, missed-post prevention, and detached replacement pruning landed in `a0538ae`. | Historical audit finding; no open implementation task remains. | n/a unless a new measurable performance or correctness issue is found. |
| CL-AUDIT-007 | MAIN-world hook lifecycle / teardown | Resolved as the original research-scaffold audit item; production sync now uses declarative settings-page `world:"MAIN"` content scripts. | Historical audit finding; ongoing hook idempotency/SPA vigilance is tracked separately as `PHASE2-HOOK-PRODUCTION`. | n/a for this finding; use `PHASE2-HOOK-PRODUCTION` for future hook-specific work. |
| CL-AUDIT-011 | Packaging / CI / distribution readiness | Package, listing assets, privacy policy, and store submission prep are resolved in M7; local `scripts/check-all.mjs` runs the static 10-check harness; CI remains absent. | Store submission is owner-side and `.github/workflows` changes remain a §9 gate. | User approval before workflow changes or release automation. |
| REVIEW-2026-07-05-SYNC-COMPLETE | Sync completion / reconcile robustness (PHASE2-HOOK-PRODUCTION follow-up) | **Resolved 2026-07-06.** Completion detection was tightened from `hasBottomCursor` to `SyncCapture.isListTailResponse` (`sync-capture.js` / `sync-hook.js`): a page is the tail only when it carries a Bottom cursor AND has zero non-cursor timeline entries. A mid-list page with 0 extractable users but a non-cursor item entry (a suspended-account run or an intermediate loading page) is no longer mistaken for the tail, so `sync-complete` no longer fires prematurely and reconcile can no longer wipe still-blocked/muted accounts. Regression fixtures added to `verify-sync-extraction.mjs` (unit) and `verify-sync-hook.mjs` (a 0-user + item + Bottom-cursor page posts no `sync-complete`; TDD-confirmed the old body fired one). The masked live re-verification below could not be completed (the Chrome MCP `javascript_tool` runs in a world isolated from the page's `fetch`/`performance`, so GraphQL response structure was unobservable), so the fix was deliberately chosen to be safe **independent of X's exact terminal-page shape** — it only makes completion stricter (fewer false completions), never looser; if X ever leaves an item on the true tail the effect degrades to additive-only (over-filtering, no data loss). | n/a — resolved. | If reconcile of un-blocks ever appears to stop working (additive-only degradation), a masked live re-verification of X's terminal-page shape (structure counts only, no raw values) would confirm whether the tail carries item entries and whether the strict gate needs a follow-up. |
| REVIEW-2026-07-15-SYNC-STAGING | Reconcile 後の sync staging lifecycle | `TASKS_BACKLOG.md` に昇格済み。reconcile 成功後も staging が残り、同一ページで解除済み対象を再混入させる候補所見を最上位で synthetic 再現する。 | 実行レビュー未実施の読取所見だったため、コード変更前に失敗テストで妥当性を確定する。 | `verify-sync-bridge.mjs` の synthetic 回帰、snapshot 比較を含む最小修正、静的10本 PASS。新権限・live X・raw 値は不要。 |
| REVIEW-2026-07-15-STORAGE-LANE | コンテキスト間 storage read-modify-write 競合 | `TASKS_BACKLOG.md` に検証候補として昇格済み。現行 API 境界で popup 削除と設定ページ upsert の競合を再現できるかを先に確認する。 | confidence 中で、世代トークン導入が別の復活・取りこぼしを生まない設計証明が必要。 | synthetic concurrency fixture、削除優先規則、既存 schema/同期回帰、静的10本 PASS。 |
| REVIEW-2026-07-15-RESERVED-PATHS | Profile reserved path の誤 handle 判定 | `TASKS_BACKLOG.md` に低 confidence の検証候補として昇格済み。synthetic author URL で到達可能性を確認する。 | User-Name 領域限定の現行抽出では指摘パスが著者候補にならない可能性があり、推測だけで予約語を増やさない。 | 実 X を読まない synthetic fixture、誤判定の再現、既存 quote/embed 回帰、静的10本 PASS。 |

## Deferred product and architecture items

| ID | Area | Current handling | Why deferred | Required before implementation |
| --- | --- | --- | --- | --- |
| PHASE2-F1A-SYNC | Production F1-A sync | Resolved in M4 (P2-008/P2-009b): after `f1a_viable` approval, settings-page GraphQL responses are reduced to `user_id` / `handle` / `listKind` only and merged into local `xtbmEntries`; raw response, cursor, display name, and body remain out of storage. Historical guard: Captured responses are not written to `xtbmEntries` before M4 approval. | Completed by the approved F1-A primary path and reconciliation implementation. | n/a unless a new data source or permission model is proposed. |
| PHASE2-F1B-DOM | F1-B DOM extraction | Closed as current fallback: not implemented because F1-A is `f1a_viable` and selected for v1.1 sync. | Reopen only if a new product/data-source decision supersedes F1-A. | User-approved research plan, safe fixtures, privacy update, and acceptance criteria. |
| PHASE2-F1C-API | F1-C X API / OAuth | Not implemented. | Closed (not pursued); F1-A accuracy path is preferred. | n/a — closed by 2026-06-13 decision. |
| PHASE2-F1D-IMPORT | F1-D import UI | Closed as current fallback: not implemented because F1-A is `f1a_viable` and selected for v1.1 sync. | Reopen only if manual import becomes a new product requirement. | User product decision, import schema, validation and deletion behavior. |
| PHASE2-REAL-DOM-MATCH | Real-DOM author matching | Resolved in M5 (P2-012): `e137d04` limits author-handle extraction to the top-level User-Name area and handles quote/embed separation defensively. | Completed as part of v1.1 real-DOM filtering. | n/a unless X changes DOM semantics and a new safe fixture/research plan is needed. |
| PHASE2-MUTATION-REWRITE | MutationObserver rewrite | Resolved for current scope in M5 (P2-013): `a0538ae` prevents missed posts, prunes detached replacements, and survives SPA navigation. | Completed for the current known issue set; avoid speculative rewrites without evidence. | New measurable bug/performance issue and scoped implementation plan. |
| PHASE2-HOOK-PRODUCTION | MAIN-world hook productionization | Production declarative settings-page hook is shipped; 2026-06-19 hardening gates response-body reads behind settings-list-page and list-endpoint checks, 2026-06-21 hardening uses URL pathname-only settings detection with same-document settings SPA characterization, 2026-06-27 reconciliation completion is narrowed to no-user Bottom cursor pages, 2026-06-28 local lifecycle tests cover off-settings XHR reads plus retry after a transient missing `SyncCapture` dependency, 2026-06-30 local lifecycle tests/guard prevent duplicate processing when the same XHR object is reopened before `loadend`, and 2026-06-30 explicit teardown support restores `fetch` / `XMLHttpRequest.open`, clears the installed guard, avoids body reads for in-flight and uninstalled requests, and keeps reinstall possible. | Not a launch blocker, but future code review should stay bounded to safety and lifecycle behavior. | Local safety tests, no new permissions, no raw response handling, and no product data-source change. |
| DIST-CHROME-STORE | Chrome Web Store distribution | Resolved 2026-07-06: the item passed review and is published (v1.1.1, store page last updated 2026-06-18, owner-confirmed). | Any re-submission/update remains a §9 gate handled by the owner. | Owner approval before any store update; agents prepare fixes/zip only. |
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
- Chrome Web Store review result: resolved — published 2026-06-18 (owner-confirmed 2026-07-06); store operations remain owner-side.

## Next minimum step

With the extension published, the next agent-safe work is post-publication operations (`docs/review-response-playbook.md` §3–§4), documentation consistency, local check maintenance, and bounded review of `PHASE2-HOOK-PRODUCTION` without changing permissions or product data sources.
