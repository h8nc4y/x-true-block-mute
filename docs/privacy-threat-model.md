# Privacy and threat model

## Status

Prepared by Codex on 2026-05-31 for the Phase 2 readiness gate. This document records current privacy boundaries and expected threats for the local prototype. It is not a security audit of live X or Chrome Web Store distribution.

Update (2026-06-14, M7): the F1-A research MAIN-world injection and the `scripting` permission have been retired from the shipped extension. The offline research-evaluation artifacts (`observation-utils.js`, `main-world-hook.js`, the evaluator, the masked-summary fixture, and `docs/decisions/f1-source-selection.md`) are retained in the repository as the decision record but are excluded from the packaged extension. `xtbmF1AResearch` is no longer written by the shipped extension; the research and production-entry data classes must remain separate in any future re-introduction. The references below to the MAIN-world hook now describe the production sync capture hook (a declarative `world:"MAIN"` content script), not a dynamically injected research hook.

## Assets to protect

- X/Twitter account identity and relationship data.
- Blocked and muted account lists.
- Cookie, CSRF token, Authorization header, OAuth token, and browser session state.
- Raw X responses, HAR files, screenshots, post bodies, display names, raw handles, and raw user IDs.
- Local extension storage values that could reveal private moderation choices.
- User-provided masked summaries.
- Repository docs, fixtures, logs, PR descriptions, review comments, and issue comments.

## Trust boundaries

| Boundary | Current handling | Risk |
| --- | --- | --- |
| Chrome extension runtime | MV3 extension loaded locally by a human. | Mis-scoped permissions can expose more data than intended. |
| `chrome.storage.sync` | Stores `xtbmSettings`. | Settings sync may reveal user preferences across browsers. |
| `chrome.storage.local` normal data | Stores migrated legacy/manual rows in `xtbmBaseEntries`, synthetic rows in `xtbmSyntheticEntries` (legacy fallback in `xtbmLegacySyntheticEntries`), production rows in active `xtbmSyncEntries:<generation>`, field-separated sync state, and non-sensitive generation/migration metadata. Retired `xtbmEntries` is removed as one key after commit. | Production entries could reveal block/mute targets if mishandled; stale cross-context writes must not resurrect deleted entries, delete a newer generation, publish an incomplete legacy migration, or overwrite a fresh domain with an old full-object snapshot. |
| Retired `chrome.storage.local` research data | `xtbmF1AResearch` is retained only as a historical/research data class; the shipped extension no longer writes it. | Future research re-introduction must keep masked observations separate from production entries. |
| MAIN-world hook | Production sync capture runs as a declarative settings-page `world:"MAIN"` content script. | Page-context hooks can accidentally capture or expose sensitive response data if URL and endpoint gates drift. |
| Clipboard | Popup may copy masked summaries only. | Users could accidentally copy raw data if UI or docs are unclear. |
| Repository docs and fixtures | Should contain only synthetic data, masked summaries, and policy text. | Committing raw data would create persistent leakage. |
| External services | Not used in this pass. | OAuth/API/cloud usage can expose tokens or incur cost. |

## Storage boundary

The repository handles four distinct local entry domains. They must remain separate.

**Research observation (`xtbmF1AResearch`)** — masked only. It should contain masked structure only, such as endpoint class, top-level keys, shape path, field presence, counts, and hook continuity markers. No raw value is ever stored here. This is the only class collected during F1-A live evaluation.

**Legacy/manual compatibility rows (`xtbmBaseEntries`)** — non-sync, non-synthetic rows retained from the retired single-key store. Current shipped code exports no full-replacement entry writer; future manual-entry features must define their own concurrency contract before writing this domain.

**Synthetic entries (`xtbmSyntheticEntries`)** — deterministic test identities only. Seed/clear operations write this dedicated key and never rewrite a production sync shard or `xtbmBaseEntries`. Existing legacy synthetic rows are copied to the separate `xtbmLegacySyntheticEntries` fallback during migration; the current dedicated key wins whenever it exists.

**Production entries (`xtbmSyncEntries:<generation>`, with legacy rows migrated from `xtbmEntries`)** — the user's own block/mute list, stored locally for the sole purpose of filtering. From Phase 2 (M4) onward, this store holds the user's own raw `user_id` and `handle` values in `chrome.storage.local` on the user's device. This is intentional and necessary for the extension's purpose: the user's list cannot be matched against timeline authors without it. The raw values stay inside device storage only — they are never written to docs, fixtures, logs, commits, clipboard, screenshots, or any off-device destination, and the extension sends no data off the device.

`xtbmSyncGeneration` contains only one opaque active generation ID and is updated only by clear operations; an absent/null marker maps to the fixed initial shard. It contains no user ID, handle, text, timestamp, credential, or response data. Active-pointer replacement is the deletion linearization point: an already in-flight settings-page write remains confined to its retired shard and can clean only that shard. A transient retired-shard cleanup failure does not block the active generation; the next clear snapshots the shard prefix, re-reads the live pointer, and retries every snapshot key except the live active key.

`xtbmSyncMigrated` is a non-sensitive boolean commit marker. `xtbmBaseEntries`, `xtbmLegacySyntheticEntries`, and the initial sync shard are written before this marker is published; if any domain write or the commit fails, the whole legacy `xtbmEntries` store remains authoritative and a later mutation retries the migration. After commit, cleanup removes only the retired key itself. It never writes a filtered stale snapshot back to a current base, synthetic store, or sync shard.

`xtbmSyncEnabled` and `xtbmSyncLastSyncedAt` split the two sync-state fields so separate JavaScript contexts cannot overwrite each other's full-object snapshot. Existing `xtbmSyncState` data remains a read-only migration fallback. `xtbmSettings` is for user settings only and stays in `chrome.storage.sync`; the base, synthetic/fallback, entry shards, sync-state fields, and generation/migration metadata are kept in `chrome.storage.local` and are not synced across devices.

The production sync design is approved and implemented for the F1-A path. Future research or data-source work must still keep masked/research observations separate from production-entry storage until a new user-approved scope explicitly promotes that path.

## Clipboard boundary

Allowed:

- Masked summary generated by the popup.
- Aggregate counts.
- Safe structural field names needed for F1-A viability review.

Forbidden:

- Raw X response body.
- Cookie, CSRF token, Authorization header, OAuth token, or browser session value.
- Raw user ID, raw handle, display name, profile text, post body, or media URL.
- HAR files or screenshots containing account data.

## Docs, logs, and PR boundary

Repository docs, fixtures, logs, pull requests, and issue comments must not include secrets, OAuth credentials, Cookies, raw X response bodies, raw user IDs, raw handles, display names, post bodies, or personal screenshots.

If a file appears to contain secrets or real account data, report only the file path and risk category. Do not print the value.

## MAIN-world hook risks

The production MAIN-world hook is high-risk because it wraps `fetch` and `XMLHttpRequest` in the page context on X settings-list pages. Current mitigations:

- Declarative content scripts limit the sync bridge and MAIN-world hook to `/settings/blocked/all` and `/settings/muted/all` on x.com/twitter.com.
- The normal timeline content script excludes those settings pages.
- The hook gates response-body reads behind the actual settings pathname and exact x.com/twitter.com GraphQL operation pathname (`/i/api/graphql/<query-id>/BlockedAccounts|MutedAccounts`) before calling `clone().text()` or `responseText`; operation-like text in a query/fragment or another origin is rejected.
- Successful XHR responses are read when `readystatechange` reaches DONE, before a later page `load` listener can reopen the same object and replace the eligible request URL with the next request's metadata.
- XHR status 0 and non-2xx responses are rejected at DONE before the hook accesses `responseText`; network errors and aborts therefore do not become sync input.
- The hook posts only `sync-entries` (`user_id`, `handle`, `listKind`) or `sync-complete` (`listKind` only); cursor values, display names, post bodies, and raw response bodies do not leave the page context.
- The ISOLATED bridge persists only when local sync is enabled and keeps staging/reconcile safety checks separate from the MAIN-world wrapper.

Remaining risks:

- Explicit teardown is intentionally not used for the declarative production hook; idempotency, dependency ordering, and long-lived SPA behavior must remain covered by local lifecycle tests.
- X endpoint shape and Chrome Web Store review result can change outside this repository and remain 未確認 until safely re-verified.
- Human reports or future research summaries may still accidentally include sensitive data if the reporting rules are ignored.

## Permission boundary

Current permissions:

- `storage`

`scripting` was used only by the retired F1-A research MAIN-world injection and has been removed (M7); the shipped extension requests `storage` only. Production sync uses a declarative `world:"MAIN"` content script, which needs no `scripting` permission.

Current host permissions:

- `https://x.com/*`
- `https://twitter.com/*`

Forbidden unless later explicitly approved by the user:

- `webRequest`
- `cookies`
- `tabs`
- `activeTab`
- `<all_urls>`
- `https://api.x.com/*`

Any permission expansion must include a written rationale, threat-model update, manual verification plan, and rollback path.

## Threats and mitigations

| Threat | Impact | Current mitigation | Remaining gap |
| --- | --- | --- | --- |
| Raw X response is copied or committed. | Persistent privacy leak. | Popup/docs say masked summary only; evaluator detects unsafe signals. | Human reporting can still make mistakes. |
| Research, synthetic, legacy cleanup, or base operations overwrite production entries. | Unreviewed data source, incorrect filtering, or loss of a fresh domain write. | `xtbmF1AResearch` remains retired/masked; current base, synthetic, and production sync use separate keys; legacy cleanup uses whole-key remove; the full-replacement entry API is not exported. | Future data classes or manual-entry writers must preserve dedicated storage domains or add a coordinator/CAS-equivalent contract. |
| Permissions expand silently. | Wider access to user data. | Static checks assert allowed permissions. | Review must catch manifest changes. |
| Live X verification exposes account data. | Account/session exposure. | Claude Code drives the user's own Chrome under consent; no credentials are received; only masked observations leave the page; x.com tabs are not screenshotted or scraped. | Masking must hold; `unsafe_summary` stops and deletes the summary. |
| Clipboard leaks sensitive content. | User may paste secrets elsewhere. | Copy flow is intended for masked summary only; masked summary goes to a gitignored temp path and through the `unsafe_summary` gate first. | Needs care during real masked-summary collection. |
| Production entries leak off-device. | Block/mute list exposure. | `xtbmSyncEntries:<generation>` raw values stay in `chrome.storage.local` only; no network egress; not synced across devices. | Future code must preserve local-only storage. |
| An in-flight settings-page write resurrects entries after popup/options deletion. | A user-requested local deletion appears to succeed but stale block/mute targets return. | `xtbmSyncGeneration` advances atomically; stale-generation writes are rejected and only their retired shard is emptied. | Future storage changes must preserve the timeout-bounded four-context deletion-priority and consecutive-clear regressions. |
| Retired-shard cleanup fails transiently. | Inactive raw entries can remain in local storage after the logical deletion point. | Active reads ignore retired shards, active upserts continue, and the next clear repeats a prefix snapshot while excluding the re-read live active key. | A context terminated between a stale write and its cleanup can delay physical removal until the next clear; do not claim synchronous physical erasure beyond the tested completion path. |
| Legacy entry migration is interrupted. | Publishing migration completion too early could hide the only copy of production, synthetic, or manual entries. | Base, legacy-synthetic fallback, and initial shard writes all precede `xtbmSyncMigrated`; domain/commit failures leave the whole legacy store authoritative and retryable. Cleanup then removes only the retired whole key. | Future schema migrations must retain the same publish-after-all-durable-writes and no-stale-full-object-writeback rules. |
| Multiple settings contexts upsert the same active generation simultaneously. | One same-generation read-modify-write could overwrite another. | Current settings flow and context-local lane reduce the normal occurrence; generation sharding isolates clear from upsert. | General multi-writer linearizability would require a single coordinator or operation log and is not claimed by this focused fix. |

## Human reporting rules

When reporting Chrome or X observations, include only:

- Whether Chrome Load unpacked succeeded.
- Whether popup controls appeared.
- Whether local synthetic fixture behavior matched expected local docs.
- Aggregate counts from masked summaries.
- Evaluator status and safe structural notes.

Do not include raw account identifiers, raw handles, display names, post text, screenshots, HAR files, Cookies, tokens, OAuth credentials, raw response bodies, or personal account data.

## Future data-source and permission gate

The current approved production source is F1-A settings-page sync with local-only production-entry storage. Any future source path, permission expansion, or off-device operation is blocked until the user confirms:

1. Which new source path is approved: F1-B, F1-D, API/OAuth, or another path.
2. What data may be stored and how it differs from current `user_id` / `handle` / `listKind` entries.
3. Whether all data stays local-only.
4. How deletion, reset, and rollback work.
5. Which validation commands and manual checks are required.
6. Whether additional permissions are allowed and how they are justified.
7. Whether a human has completed the necessary Chrome or Chrome Web Store verification.
