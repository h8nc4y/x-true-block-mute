(function () {
  "use strict";

  const namespace = globalThis.XTrueBlockMute;
  const { DISPLAY_MODES, Storage } = namespace;

  const enabledInput = document.querySelector("#enabled");
  const modeInputs = Array.from(document.querySelectorAll("input[name='display-mode']"));
  const entryCount = document.querySelector("#entry-count");
  const lastSyntheticUpdate = document.querySelector("#last-synthetic-update");
  const seedButton = document.querySelector("#seed-synthetic");
  const clearButton = document.querySelector("#clear-synthetic");
  const message = document.querySelector("#message");

  function formatDateTime(isoString) {
    if (!isoString) {
      return "未投入";
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

  function setBusy(isBusy) {
    seedButton.disabled = isBusy;
    clearButton.disabled = isBusy;
    enabledInput.disabled = isBusy;
    for (const input of modeInputs) {
      input.disabled = isBusy;
    }
  }

  function setMessage(text) {
    message.textContent = text;
  }

  async function render() {
    const [settings, entryStore] = await Promise.all([Storage.getSettings(), Storage.getEntryStore()]);
    enabledInput.checked = settings.enabled;
    for (const input of modeInputs) {
      input.checked = input.value === settings.displayMode;
    }
    entryCount.textContent = String(entryStore.entries.length);
    lastSyntheticUpdate.textContent = formatDateTime(entryStore.lastSyntheticUpdatedAt);
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
      setMessage("Phase 1 テストデータを投入しました。");
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
      setMessage("Phase 1 テストデータを削除しました。");
    } catch (_error) {
      setMessage("テストデータ削除に失敗しました。");
    } finally {
      setBusy(false);
    }
  });

  render().catch(() => setMessage("状態の読み込みに失敗しました。"));
})();
