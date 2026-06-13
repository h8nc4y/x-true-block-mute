(function () {
  "use strict";

  // Production sync bridge (M4), ISOLATED world. It listens for the MAIN-world
  // capture hook's same-origin messages and persists the user's own list entries
  // into xtbmEntries — but only when sync is enabled. The MAIN hook always posts;
  // this bridge is the gate that decides whether anything is stored, mirroring
  // the research bridge's enabled-gating. It uses chrome.storage via Storage and
  // never forwards the captured ids anywhere off-device.

  const namespace = globalThis.XTrueBlockMute;
  if (!namespace || !namespace.Storage || !namespace.SYNC_MESSAGE_SOURCE) {
    return;
  }
  const { Storage, SYNC_MESSAGE_SOURCE } = namespace;

  window.addEventListener("message", (event) => {
    if (event.source !== window) {
      return;
    }
    const data = event.data;
    if (!data || data.source !== SYNC_MESSAGE_SOURCE || data.kind !== "sync-entries") {
      return;
    }
    const entries = Array.isArray(data.entries) ? data.entries : [];
    if (entries.length === 0) {
      return;
    }
    Storage.getSyncState()
      .then((state) => {
        if (!state.enabled) {
          return undefined;
        }
        return Storage.upsertSyncedEntries(entries).then(() => Storage.markSynced());
      })
      .catch(() => {});
  });
})();
