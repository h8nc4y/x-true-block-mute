(function () {
  "use strict";

  // Production sync bridge (M4), ISOLATED world. Persists the user's own list
  // entries into xtbmEntries only when sync is enabled.
  //
  // Reconciliation (M4 / P2-009b): per-page-session staging accumulates every
  // entry captured for each listKind. When the MAIN hook signals it reached the
  // tail of a list ("sync-complete") and that listKind has a non-empty staging
  // set, the bridge replaces that listKind's synced set wholesale, so accounts
  // that left the list are removed. If nothing was staged this session (a stray
  // or premature completion), the bridge does nothing — a safety valve that
  // stops an empty/partial capture from wiping the user's synced list. Staging
  // is never cleared after a reconcile, so a re-scroll that re-fires completion
  // still carries the full captured set, not a partial re-accumulation.

  const namespace = globalThis.XTrueBlockMute;
  if (!namespace || !namespace.Storage || !namespace.SYNC_MESSAGE_SOURCE) {
    return;
  }
  const { Storage, SYNC_MESSAGE_SOURCE } = namespace;

  // listKind -> Map<dedupeKey, entry>; lives for the page's lifetime.
  const staging = new Map();
  // storage 境界へ渡す前に、MAIN hook 由来の3項目だけへ絞り直す。
  const USER_ID_PATTERN = /^[0-9]{1,30}$/;
  const HANDLE_PATTERN = /^[a-z0-9_]{1,15}$/;

  function normalizeListKind(value) {
    return value === "blocked" || value === "muted" ? value : null;
  }

  function currentPageListKind() {
    // 現在ページの pathname だけで listKind を決め、query 由来の偽パスを同期対象にしない。
    try {
      const pageUrl = new URL(String(location.href || ""), location.origin);
      if (/^\/settings\/blocked\/all$/i.test(pageUrl.pathname)) {
        return "blocked";
      }
      if (/^\/settings\/muted\/all$/i.test(pageUrl.pathname)) {
        return "muted";
      }
    } catch (_error) {
      // URL が読めない状態では page-origin message を保存対象にしない。
    }
    return null;
  }

  function acceptedMessageListKind(data) {
    // message の listKind と表示中ページが食い違う場合は、同一 origin でも破棄する。
    const listKind = normalizeListKind(data && data.listKind);
    if (!listKind || listKind !== currentPageListKind()) {
      return null;
    }
    return listKind;
  }

  function sanitizeSyncEntry(entry, listKind) {
    // page message は入力境界として扱い、余分な字段や壊れた値を storage 前に落とす。
    if (!entry || typeof entry !== "object") {
      return null;
    }
    if (entry.listKind !== undefined && entry.listKind !== listKind) {
      return null;
    }
    const userId = typeof entry.user_id === "string" ? entry.user_id.trim() : "";
    const handle = typeof entry.handle === "string" ? entry.handle.trim().toLowerCase() : "";
    if (userId && !USER_ID_PATTERN.test(userId)) {
      return null;
    }
    if (handle && !HANDLE_PATTERN.test(handle)) {
      return null;
    }
    if (!userId && !handle) {
      return null;
    }
    return { user_id: userId || null, handle: handle || null, listKind };
  }

  function sanitizeSyncEntries(listKind, entries) {
    if (!Array.isArray(entries)) {
      return [];
    }
    return entries.map((entry) => sanitizeSyncEntry(entry, listKind)).filter(Boolean);
  }

  function stageEntries(listKind, entries) {
    if (!listKind) {
      return;
    }
    let bucket = staging.get(listKind);
    if (!bucket) {
      bucket = new Map();
      staging.set(listKind, bucket);
    }
    for (const entry of entries) {
      if (!entry || typeof entry !== "object") {
        continue;
      }
      const userId = typeof entry.user_id === "string" ? entry.user_id.trim() : "";
      const handle = typeof entry.handle === "string" ? entry.handle.trim().toLowerCase() : "";
      if (!userId && !handle) {
        continue;
      }
      bucket.set(userId ? `id:${userId}` : `handle:${handle}`, entry);
    }
  }

  function stagedEntries(listKind) {
    const bucket = staging.get(listKind);
    return bucket ? Array.from(bucket.values()) : [];
  }

  window.addEventListener("message", (event) => {
    if (event.source !== window) {
      return;
    }
    if (event.origin && event.origin !== location.origin) {
      return;
    }
    const data = event.data;
    if (!data || data.source !== SYNC_MESSAGE_SOURCE) {
      return;
    }
    const listKind = acceptedMessageListKind(data);
    if (!listKind) {
      return;
    }

    if (data.kind === "sync-entries") {
      const entries = sanitizeSyncEntries(listKind, data.entries);
      if (entries.length === 0) {
        return;
      }
      // Stage unconditionally so the reconciliation set reflects the whole
      // session even if sync is toggled on mid-scroll; persistence is gated.
      stageEntries(listKind, entries);
      Storage.getSyncState()
        .then((state) => {
          if (!state.enabled) {
            return undefined;
          }
          return Storage.upsertSyncedEntries(entries).then(() => Storage.markSynced());
        })
        .catch(() => {});
      return;
    }

    if (data.kind === "sync-complete") {
      const staged = stagedEntries(listKind);
      if (staged.length === 0) {
        // Safety valve: never reconcile (never wipe) from an empty capture.
        return;
      }
      Storage.getSyncState()
        .then((state) => {
          if (!state.enabled) {
            return undefined;
          }
          return Storage.replaceSyncedListKind(listKind, staged).then(() => Storage.markSynced());
        })
        .catch(() => {});
    }
  });
})();
