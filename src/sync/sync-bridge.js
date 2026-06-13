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
    const data = event.data;
    if (!data || data.source !== SYNC_MESSAGE_SOURCE) {
      return;
    }
    const listKind = data.listKind;

    if (data.kind === "sync-entries") {
      const entries = Array.isArray(data.entries) ? data.entries : [];
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
