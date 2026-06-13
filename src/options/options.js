(function () {
  "use strict";

  const namespace = globalThis.XTrueBlockMute;
  const { STORAGE_KEYS, SYNC_SOURCE, SYNTHETIC_SOURCE, Storage } = namespace;

  const syncedBlockedCount = document.querySelector("#synced-blocked-count");
  const syncedMutedCount = document.querySelector("#synced-muted-count");
  const syntheticCount = document.querySelector("#synthetic-count");
  const syncedList = document.querySelector("#synced-list");
  const syncedEmpty = document.querySelector("#synced-empty");
  const clearSyncedButton = document.querySelector("#options-clear-synced");
  const clearSyntheticButton = document.querySelector("#options-clear-synthetic");
  const message = document.querySelector("#options-message");
  let busy = false;

  function formatCount(count) {
    return `${count}件`;
  }

  function formatSyncedAt(isoString) {
    if (!isoString) {
      return "";
    }
    const date = new Date(isoString);
    if (Number.isNaN(date.getTime())) {
      return "";
    }
    return new Intl.DateTimeFormat("ja-JP", {
      dateStyle: "short",
      timeStyle: "short"
    }).format(date);
  }

  function setBusy(isBusy) {
    busy = isBusy;
    clearSyncedButton.disabled = isBusy;
    clearSyntheticButton.disabled = isBusy;
  }

  function setMessage(text) {
    message.textContent = text;
  }

  function isSyncedEntry(entry) {
    return entry.source === SYNC_SOURCE;
  }

  function listKindLabel(listKind) {
    return listKind === "muted" ? "ミュート" : "ブロック";
  }

  // Synced entries sort blocked-first then muted; ties keep insertion order via
  // a stable index so the rendered list is deterministic.
  function compareSyncedEntries(a, b) {
    const order = { blocked: 0, muted: 1 };
    const aRank = order[a.listKind] ?? 2;
    const bRank = order[b.listKind] ?? 2;
    if (aRank !== bRank) {
      return aRank - bRank;
    }
    return a.__index - b.__index;
  }

  function buildSyncedListItem(entry) {
    const item = document.createElement("li");

    const badge = document.createElement("span");
    badge.className =
      entry.listKind === "muted" ? "list-kind-badge muted" : "list-kind-badge blocked";
    badge.textContent = listKindLabel(entry.listKind);
    item.appendChild(badge);

    const handle = document.createElement("span");
    if (entry.handle) {
      handle.className = "synced-handle";
      handle.textContent = `@${entry.handle}`;
    } else {
      handle.className = "synced-handle unknown";
      handle.textContent = "（handle 不明・ID のみ）";
    }
    item.appendChild(handle);

    const formattedTime = formatSyncedAt(entry.syncedAt);
    if (formattedTime) {
      const time = document.createElement("span");
      time.className = "synced-time";
      time.textContent = formattedTime;
      item.appendChild(time);
    }

    return item;
  }

  async function render() {
    const entryStore = await Storage.getEntryStore();
    const entries = entryStore.entries;

    const syncedBlocked = entries.filter(
      (entry) => isSyncedEntry(entry) && entry.listKind === "blocked"
    ).length;
    const syncedMuted = entries.filter(
      (entry) => isSyncedEntry(entry) && entry.listKind === "muted"
    ).length;
    const synthetic = entries.filter((entry) => entry.source === SYNTHETIC_SOURCE).length;

    syncedBlockedCount.textContent = formatCount(syncedBlocked);
    syncedMutedCount.textContent = formatCount(syncedMuted);
    syntheticCount.textContent = formatCount(synthetic);

    const syncedEntries = entries
      .filter(isSyncedEntry)
      .map((entry, index) => ({ ...entry, __index: index }))
      .sort(compareSyncedEntries);

    syncedList.textContent = "";
    for (const entry of syncedEntries) {
      syncedList.appendChild(buildSyncedListItem(entry));
    }

    syncedEmpty.hidden = syncedEntries.length > 0;
  }

  clearSyncedButton.addEventListener("click", async () => {
    setBusy(true);
    setMessage("");
    try {
      await Storage.clearSyncedEntries();
      await render();
      setMessage("同期で取り込んだブロック・ミュートデータを消しました。");
    } catch (_error) {
      setMessage("同期データの削除に失敗しました。");
    } finally {
      setBusy(false);
    }
  });

  clearSyntheticButton.addEventListener("click", async () => {
    setBusy(true);
    setMessage("");
    try {
      await Storage.clearSyntheticEntries();
      await render();
      setMessage("ローカル確認用のテストデータを消しました。");
    } catch (_error) {
      setMessage("テストデータの削除に失敗しました。");
    } finally {
      setBusy(false);
    }
  });

  render().catch(() => {
    setMessage("Chrome 拡張として読み込んでいない、または storage を読めない可能性があります。");
  });

  if (globalThis.chrome && chrome.storage && chrome.storage.onChanged) {
    const watchedKeys = [STORAGE_KEYS.ENTRIES, STORAGE_KEYS.SYNC_STATE];
    chrome.storage.onChanged.addListener((changes, areaName) => {
      if (busy) {
        return;
      }
      if (areaName !== "local" && areaName !== "sync") {
        return;
      }
      const changedRelevantKey = watchedKeys.some((key) =>
        Object.prototype.hasOwnProperty.call(changes, key)
      );
      if (!changedRelevantKey) {
        return;
      }
      render().catch(() => {});
    });
  }
})();
