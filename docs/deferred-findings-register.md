# Deferred findings register

## Status

Prepared by Codex on 2026-05-31 for Phase 2 readiness coordination. Updated 2026-07-23 for the published v1.1.1 state and the 2026-07-15 review queue. This register records the rationale and gate state for known findings; implementation status is tracked in `TASKS_BACKLOG.md`.

## Rule

Deferred items are not tasks. They are implemented only after the user approves them in chat and they are promoted into `TASKS_BACKLOG.md`. Several items below have since been approved and completed as the P2 roadmap (M1–M7) in `TASKS_BACKLOG.md`; this register stays as the rationale and status record.

## Deferred review findings

| ID | Area | Current handling | Why deferred | Required before implementation |
| --- | --- | --- | --- | --- |
| CL-AUDIT-006 | MutationObserver / card processing performance | Resolved in M5 (P2-013): SPA rescan, missed-post prevention, and detached replacement pruning landed in `a0538ae`. | Historical audit finding; no open implementation task remains. | n/a unless a new measurable performance or correctness issue is found. |
| CL-AUDIT-007 | MAIN-world hook lifecycle / teardown | Resolved as the original research-scaffold audit item; production sync now uses declarative settings-page `world:"MAIN"` content scripts. | Historical audit finding; ongoing hook idempotency/SPA vigilance is tracked separately as `PHASE2-HOOK-PRODUCTION`. | n/a for this finding; use `PHASE2-HOOK-PRODUCTION` for future hook-specific work. |
| CL-AUDIT-011 | Packaging / CI / distribution readiness | Package, listing assets, privacy policy, and store submission prep are resolved in M7; local `scripts/check-all.mjs` runs the static 10-check harness; CI remains absent. | Store submission is owner-side and `.github/workflows` changes remain a §9 gate. | User approval before workflow changes or release automation. |
| REVIEW-2026-07-05-SYNC-COMPLETE | Sync completion / reconcile robustness (PHASE2-HOOK-PRODUCTION follow-up) | **Resolved 2026-07-06.** Completion detection was tightened from `hasBottomCursor` to `SyncCapture.isListTailResponse` (`sync-capture.js` / `sync-hook.js`): a page is the tail only when it carries a Bottom cursor AND has zero non-cursor timeline entries. A mid-list page with 0 extractable users but a non-cursor item entry (a suspended-account run or an intermediate loading page) is no longer mistaken for the tail, so `sync-complete` no longer fires prematurely and reconcile can no longer wipe still-blocked/muted accounts. Regression fixtures added to `verify-sync-extraction.mjs` (unit) and `verify-sync-hook.mjs` (a 0-user + item + Bottom-cursor page posts no `sync-complete`; TDD-confirmed the old body fired one). The masked live re-verification below could not be completed (the Chrome MCP `javascript_tool` runs in a world isolated from the page's `fetch`/`performance`, so GraphQL response structure was unobservable), so the fix was deliberately chosen to be safe **independent of X's exact terminal-page shape** — it only makes completion stricter (fewer false completions), never looser; if X ever leaves an item on the true tail the effect degrades to additive-only (over-filtering, no data loss). | n/a — resolved. | If reconcile of un-blocks ever appears to stop working (additive-only degradation), a masked live re-verification of X's terminal-page shape (structure counts only, no raw values) would confirm whether the tail carries item entries and whether the strict gate needs a follow-up. |
| REVIEW-2026-07-15-SYNC-STAGING | Reconcile 後の sync staging lifecycle | **Resolved 2026-07-21 in PR #41.** TDD で同一ページ再同期時の残留を再現。reconcile 後の無条件 clear は tail-only 部分ページによる削り落としを招くため退け、cursor 無し initial request の正常応答だけが固定 `sync-start` を送り、bridge が該当 listKind の staging を新しい全走査へ切り替える。pagination は前回完全集合を保持し、request variables / cursor 値は送らない。 | n/a — resolved. X の request 形状が変わり開始検出できない場合は、staging 保持による過剰フィルタ側へ安全に劣化する。 | `verify-sync-hook.mjs` / `verify-sync-bridge.mjs` / 静的10本で回帰を維持。新権限・live X・raw 値は不要。 |
| REVIEW-2026-07-15-STORAGE-LANE | コンテキスト間 storage read-modify-write 競合 | **Resolved for the reproduced deletion/state paths on 2026-07-23 in PR #42.** 独立 VM 2〜4 context で、popup clear 後の stale upsert、連続 clear 中の古い sweep と最新 shard、legacy cleanup 中の fresh base + sync、`enabled` / `lastSyncedAt` の両 write order、retired cleanup の一時失敗を再現。同期行を generation 別 shard、base / synthetic を専用 key、同期状態を field 別 key へ分離した。旧 single-key は全 domain 書込み後だけ commit flag を公開し、途中失敗では legacy を authoritative に保つ。commit 後は stale full-object set ではなく whole-key remove する。 | 同一 active generation へ複数 settings context が同時 upsert する一般的な RMW は単一 service worker / operation log なしには linearizable と主張しない。今回の popup clear 対象では clear 専用 active pointer が削除の linearization point になり、cleanup 一時失敗も active generation を停止しない。full-replacement entry API は公開しない。 | timeout 付き `verify-storage-sync-schema.mjs` の2〜4 context競合、両 state write order、移行 shard/base/commit 失敗、base/synthetic/sync domain 分離、raw retired shard、cleanup retry、静的10本 runner timeout、既存 schema/同期回帰を維持。複数 settings tab の実害が合成再現された場合だけ coordinator / operation-log 設計へ昇格する。 |
| REVIEW-2026-07-15-RESERVED-PATHS | Profile reserved path の誤 handle 判定 | **Resolved 2026-07-24 by synthetic-only TDD.** User-Name 領域の `/hashtag` / `/intent` / `/lists` / `/communities` と同名 target で4カードの誤置換を RED 再現し、4語を `PROFILE_RESERVED_PATHS` へ追加した。 | 実 X・raw 値を使わず到達性を確認した。既知 route を列挙する境界は維持し、推測だけで予約語を追加しない。 | `verify-phase1-static.mjs` が予約集合を固定。`verify-extension-load-chrome.mjs` が予約 path 4件の表示維持と既存 author 2件＋quote 1件の置換を headless Chromium で確認。静的10本 PASS。 |
| REVIEW-2026-07-25-SYNC-ENDPOINT-PATH | MAIN-world hook の list endpoint 判定 | **Resolved 2026-07-25 by synthetic-only TDD.** `listKindFromUrl()` が URL 全体の operation 名を部分一致していたため、設定ページ上の無関係な GraphQL URLでも query 値に `BlockedAccounts` / `MutedAccounts` があれば本文読取へ進む RED を再現。許可 origin を x.com / twitter.com、pathname を `/i/api/graphql/<query-id>/BlockedAccounts|MutedAccounts` に厳密化した。 | 実 X・raw response・新権限を使わず、既存の確認済み GraphQL URL 契約だけを狭めた。X が operation pathname を変更した場合は本文を読まない追加-only 側へ安全に劣化する。 | `verify-sync-extraction.mjs` が query-only operation / `api.x.com` 拒否と相対 list URL を、`verify-sync-hook.mjs` が無関係な応答本文を読まないことを固定する。 |

## Deferred product and architecture items

| ID | Area | Current handling | Why deferred | Required before implementation |
| --- | --- | --- | --- | --- |
| PHASE2-F1A-SYNC | Production F1-A sync | Resolved in M4 (P2-008/P2-009b): after `f1a_viable` approval, settings-page GraphQL responses are reduced to `user_id` / `handle` / `listKind` only and merged into local production-entry storage (legacy `xtbmEntries`; current active `xtbmSyncEntries:<generation>`); raw response, cursor, display name, and body remain out of storage. Historical guard: Captured responses are not written to production-entry storage before M4 approval. | Completed by the approved F1-A primary path and reconciliation implementation. | n/a unless a new data source or permission model is proposed. |
| PHASE2-F1B-DOM | F1-B DOM extraction | Closed as current fallback: not implemented because F1-A is `f1a_viable` and selected for v1.1 sync. | Reopen only if a new product/data-source decision supersedes F1-A. | User-approved research plan, safe fixtures, privacy update, and acceptance criteria. |
| PHASE2-F1C-API | F1-C X API / OAuth | Not implemented. | Closed (not pursued); F1-A accuracy path is preferred. | n/a — closed by 2026-06-13 decision. |
| PHASE2-F1D-IMPORT | F1-D import UI | Closed as current fallback: not implemented because F1-A is `f1a_viable` and selected for v1.1 sync. | Reopen only if manual import becomes a new product requirement. | User product decision, import schema, validation and deletion behavior. |
| PHASE2-REAL-DOM-MATCH | Real-DOM author matching | Resolved in M5 (P2-012): `e137d04` limits author-handle extraction to the top-level User-Name area and handles quote/embed separation defensively. | Completed as part of v1.1 real-DOM filtering. | n/a unless X changes DOM semantics and a new safe fixture/research plan is needed. |
| PHASE2-MUTATION-REWRITE | MutationObserver rewrite | Resolved for current scope in M5 (P2-013): `a0538ae` prevents missed posts, prunes detached replacements, and survives SPA navigation. | Completed for the current known issue set; avoid speculative rewrites without evidence. | New measurable bug/performance issue and scoped implementation plan. |
| PHASE2-HOOK-PRODUCTION | MAIN-world hook productionization | Production declarative settings-page hook is shipped; 2026-06-19 hardening gates response-body reads behind settings-list-page and list-endpoint checks, 2026-06-21 hardening uses URL pathname-only settings detection with same-document settings SPA characterization, 2026-06-27 reconciliation completion is narrowed to no-user Bottom cursor pages, 2026-06-28 local lifecycle tests cover off-settings XHR reads plus retry after a transient missing `SyncCapture` dependency, 2026-06-30 local lifecycle tests/guard prevent duplicate processing when the same XHR object is reopened before `loadend`, 2026-06-30 explicit teardown support restores `fetch` / `XMLHttpRequest.open`, clears the installed guard, avoids body reads for in-flight and uninstalled requests, and keeps reinstall possible, 2026-07-21 PR #41 adds a cursor-free initial-request `sync-start` boundary so same-page full resync can drop stale staging without letting pagination refetches wipe valid entries, 2026-07-25 hardening restricts list recognition to exact x.com/twitter.com GraphQL operation pathnames instead of URL-wide operation-name matching, 2026-07-26 synthetic TDD makes XHR listener ownership hook-generation-local so an object reused after reinstall is processed once by the current hook while stale listeners remain inactive; inactive generations retained by foreign `fetch` / `open` wrappers now delegate the request once but bypass URL evaluation and callback / listener registration, preventing noop work from accumulating without overwriting those wrappers, and 2026-07-27 synthetic TDD moves successful XHR processing to DONE `readystatechange` so a later page `load` listener cannot reopen the object and overwrite the eligible response's URL before it is read. | Not a launch blocker, but future code review should stay bounded to safety and lifecycle behavior. | Local safety tests, no new permissions, no raw response handling, and no product data-source change. |
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

With the extension published and all three 2026-07-15 review findings resolved by local synthetic verification, the next agent-safe work is post-publication operations, documentation consistency, and local check maintenance. Do not change permissions or product data sources.
