(function () {
  "use strict";

  const namespace = globalThis.XTrueBlockMute;
  const { DISPLAY_MODES, Storage, STORAGE_KEYS } = namespace;

  const enabledInput = document.querySelector("#enabled");
  const modeInputs = Array.from(document.querySelectorAll("input[name='display-mode']"));
  const filterState = document.querySelector("#filter-state");
  const entryCount = document.querySelector("#entry-count");
  const lastSyntheticUpdate = document.querySelector("#last-synthetic-update");
  const localTestSummary = document.querySelector("#local-test-summary");
  const seedButton = document.querySelector("#seed-synthetic");
  const clearButton = document.querySelector("#clear-synthetic");
  const syncEnabledInput = document.querySelector("#sync-enabled");
  const syncBlockedCount = document.querySelector("#sync-blocked-count");
  const syncMutedCount = document.querySelector("#sync-muted-count");
  const syncLast = document.querySelector("#sync-last");
  const clearSyncedButton = document.querySelector("#clear-synced");
  const openOptionsButton = document.querySelector("#open-options");
  const message = document.querySelector("#message");
  let busy = false;

  function formatDateTime(isoString, emptyLabel = "未投入") {
    if (!isoString) {
      return emptyLabel;
    }
    const date = new Date(isoString);
    if (Number.isNaN(date.getTime())) {
      return "未確認";
    }
    return new Intl.DateTimeFormat("ja-JP", {
      dateStyle: "short",
      timeStyle: "medium"
    }).format(date);
  }

  function formatCount(count) {
    return `${count}件`;
  }

  function describeLocalTest(entryStore) {
    if (entryStore.entries.length === 0) {
      return "テストデータは未投入です。ローカル fixture を確認する前に「テストデータを入れる」を押してください。";
    }
    return "テストデータが入っています。README の synthetic fixture を開くと、対象投稿の表示変化を確認できます。";
  }

  function setBusy(isBusy) {
    busy = isBusy;
    seedButton.disabled = isBusy;
    clearButton.disabled = isBusy;
    enabledInput.disabled = isBusy;
    syncEnabledInput.disabled = isBusy;
    clearSyncedButton.disabled = isBusy;
    for (const input of modeInputs) {
      input.disabled = isBusy;
    }
  }

  function setMessage(text) {
    message.textContent = text;
  }

  function countSyncedByListKind(entryStore, listKind) {
    return entryStore.entries.filter((entry) => entry.source === "f1a-sync" && entry.listKind === listKind).length;
  }

  async function render() {
    const [settings, entryStore, syncState] = await Promise.all([
      Storage.getSettings(),
      Storage.getEntryStore(),
      Storage.getSyncState()
    ]);
    syncEnabledInput.checked = syncState.enabled;
    syncBlockedCount.textContent = formatCount(countSyncedByListKind(entryStore, "blocked"));
    syncMutedCount.textContent = formatCount(countSyncedByListKind(entryStore, "muted"));
    syncLast.textContent = formatDateTime(syncState.lastSyncedAt, "未同期");
    enabledInput.checked = settings.enabled;
    for (const input of modeInputs) {
      input.checked = input.value === settings.displayMode;
    }
    filterState.textContent = settings.enabled ? "状態: 有効" : "状態: 停止中";
    entryCount.textContent = formatCount(entryStore.entries.length);
    lastSyntheticUpdate.textContent = formatDateTime(entryStore.lastSyntheticUpdatedAt);
    localTestSummary.textContent = describeLocalTest(entryStore);
  }

  async function updateSettings(patch) {
    const current = await Storage.getSettings();
    await Storage.setSettings({ ...current, ...patch });
    await render();
  }

  enabledInput.addEventListener("change", () => {
    updateSettings({ enabled: enabledInput.checked }).catch(() => setMessage("設定の保存に失敗しました。"));
  });

  for (const input of modeInputs) {
    input.addEventListener("change", () => {
      if (!input.checked || !Object.values(DISPLAY_MODES).includes(input.value)) {
        return;
      }
      updateSettings({ displayMode: input.value }).catch(() => setMessage("表示モードの保存に失敗しました。"));
    });
  }

  seedButton.addEventListener("click", async () => {
    setBusy(true);
    setMessage("");
    try {
      await Storage.seedSyntheticEntries();
      await render();
      setMessage("ローカル確認用のテストデータを入れました。fixture ページで表示の変化を確認してください。");
    } catch (_error) {
      setMessage("テストデータ投入に失敗しました。");
    } finally {
      setBusy(false);
    }
  });

  clearButton.addEventListener("click", async () => {
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

  syncEnabledInput.addEventListener("change", async () => {
    setBusy(true);
    setMessage("");
    try {
      await Storage.setSyncEnabled(syncEnabledInput.checked);
      await render();
      setMessage(
        syncEnabledInput.checked
          ? "同期を有効にしました。「ブロック一覧を開く」から一覧を一番下まで表示してください。"
          : "同期を停止しました。取り込み済みのデータは残ります。"
      );
    } catch (_error) {
      setMessage("同期設定の保存に失敗しました。");
    } finally {
      setBusy(false);
    }
  });

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

  openOptionsButton.addEventListener("click", () => {
    if (chrome.runtime && chrome.runtime.openOptionsPage) {
      chrome.runtime.openOptionsPage();
    }
  });

  render().catch(() => {
    filterState.textContent = "状態: 読み込み失敗";
    localTestSummary.textContent = "Chrome 拡張として読み込んでいない、または storage を読めない可能性があります。";
    setMessage("状態の読み込みに失敗しました。Chrome 拡張として読み込んでいるか確認してください。");
  });

  if (globalThis.chrome && chrome.storage && chrome.storage.onChanged) {
    const watchedKeys = [
      STORAGE_KEYS.SETTINGS,
      STORAGE_KEYS.ENTRIES,
      STORAGE_KEYS.SYNC_STATE
    ];
    chrome.storage.onChanged.addListener((changes, areaName) => {
      if (busy) {
        return;
      }
      if (areaName !== "local" && areaName !== "sync") {
        return;
      }
      const changedRelevantKey = watchedKeys.some((key) => Object.prototype.hasOwnProperty.call(changes, key));
      if (!changedRelevantKey) {
        return;
      }
      render().catch(() => {});
    });
  }
})();
