(function () {
  "use strict";

  const namespace = globalThis.XTrueBlockMute;
  const { DISPLAY_MODES, ResearchF1A, Storage } = namespace;

  const enabledInput = document.querySelector("#enabled");
  const modeInputs = Array.from(document.querySelectorAll("input[name='display-mode']"));
  const filterState = document.querySelector("#filter-state");
  const entryCount = document.querySelector("#entry-count");
  const lastSyntheticUpdate = document.querySelector("#last-synthetic-update");
  const localTestSummary = document.querySelector("#local-test-summary");
  const seedButton = document.querySelector("#seed-synthetic");
  const clearButton = document.querySelector("#clear-synthetic");
  const researchEnabledInput = document.querySelector("#f1a-research-enabled");
  const researchStatus = document.querySelector("#f1a-research-status");
  const researchObservationCount = document.querySelector("#f1a-observation-count");
  const researchPageCounts = document.querySelector("#f1a-page-counts");
  const researchUpdatedAt = document.querySelector("#f1a-updated-at");
  const researchNextStep = document.querySelector("#f1a-next-step");
  const copyResearchButton = document.querySelector("#copy-f1a-research");
  const clearResearchButton = document.querySelector("#clear-f1a-research");
  const researchSummaryOutput = document.querySelector("#f1a-summary-output");
  const syncEnabledInput = document.querySelector("#sync-enabled");
  const syncBlockedCount = document.querySelector("#sync-blocked-count");
  const syncMutedCount = document.querySelector("#sync-muted-count");
  const syncLast = document.querySelector("#sync-last");
  const clearSyncedButton = document.querySelector("#clear-synced");
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

  function summarizePageKinds(observations) {
    return observations.reduce(
      (summary, observation) => {
        if (observation.pageKind === "blocked") {
          summary.blocked += 1;
        } else if (observation.pageKind === "muted") {
          summary.muted += 1;
        } else {
          summary.unknown += 1;
        }
        return summary;
      },
      { blocked: 0, muted: 0, unknown: 0 }
    );
  }

  function describeLocalTest(entryStore) {
    if (entryStore.entries.length === 0) {
      return "テストデータは未投入です。ローカル fixture を確認する前に「テストデータを入れる」を押してください。";
    }
    return "テストデータが入っています。README の synthetic fixture を開くと、対象投稿の表示変化を確認できます。";
  }

  function describeResearchNextStep(researchState, pageCounts) {
    if (!researchState.enabled) {
      return "実 X の確認をする人だけ「F1-A 観測を開始」を入れます。ローカル確認だけなら停止中のままで問題ありません。";
    }
    if (researchState.observations.length === 0) {
      return "観測メモはまだ 0件です。対象ページ外、未ログイン、またはページ再読み込み前なら異常ではありません。";
    }
    if (pageCounts.blocked > 0 && pageCounts.muted > 0) {
      return "ブロックとミュートの両方で観測があります。安全な要約だけをコピーし、raw response やアカウント名は共有しないでください。";
    }
    if (pageCounts.blocked > 0) {
      return "ブロック側だけ観測があります。必要ならミュート設定ページでも同じ手順を確認してください。";
    }
    if (pageCounts.muted > 0) {
      return "ミュート側だけ観測があります。必要ならブロック設定ページでも同じ手順を確認してください。";
    }
    return "観測メモはありますが、ページ種別は未判定です。安全な要約の詳細だけを確認し、raw response は共有しないでください。";
  }

  function setBusy(isBusy) {
    busy = isBusy;
    seedButton.disabled = isBusy;
    clearButton.disabled = isBusy;
    copyResearchButton.disabled = isBusy || copyResearchButton.dataset.hasObservations !== "true";
    clearResearchButton.disabled = isBusy;
    enabledInput.disabled = isBusy;
    researchEnabledInput.disabled = isBusy;
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
    const [settings, entryStore, researchState, syncState] = await Promise.all([
      Storage.getSettings(),
      Storage.getEntryStore(),
      Storage.getF1AResearchState(),
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
    researchEnabledInput.checked = researchState.enabled;
    const pageCounts = summarizePageKinds(researchState.observations);
    researchStatus.textContent = researchState.enabled ? "監視中" : "停止中";
    researchObservationCount.textContent = formatCount(researchState.observations.length);
    researchPageCounts.textContent = `${formatCount(pageCounts.blocked)} / ${formatCount(pageCounts.muted)}`;
    researchUpdatedAt.textContent = formatDateTime(researchState.updatedAt, "未記録");
    researchNextStep.textContent = describeResearchNextStep(researchState, pageCounts);
    copyResearchButton.dataset.hasObservations = researchState.observations.length > 0 ? "true" : "false";
    copyResearchButton.disabled = busy || researchState.observations.length === 0;
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

  researchEnabledInput.addEventListener("change", async () => {
    setBusy(true);
    setMessage("");
    try {
      await Storage.setF1AResearchEnabled(researchEnabledInput.checked);
      await render();
      setMessage(
        researchEnabledInput.checked
          ? "F1-A 観測を開始しました。対象ページを再読み込みしてください。"
          : "F1-A 観測を停止しました。"
      );
    } catch (_error) {
      setMessage("F1-A 観測設定の保存に失敗しました。");
    } finally {
      setBusy(false);
    }
  });

  clearResearchButton.addEventListener("click", async () => {
    setBusy(true);
    setMessage("");
    try {
      await Storage.clearF1AResearchObservations();
      await render();
      setMessage("観測メモを消しました。");
    } catch (_error) {
      setMessage("観測メモの削除に失敗しました。");
    } finally {
      setBusy(false);
    }
  });

  copyResearchButton.addEventListener("click", async () => {
    setBusy(true);
    setMessage("");
    try {
      const researchState = await Storage.getF1AResearchState();
      const summaryText = JSON.stringify(ResearchF1A.createExportSummary(researchState), null, 2);
      researchSummaryOutput.hidden = false;
      researchSummaryOutput.value = summaryText;
      researchSummaryOutput.select();
      if (navigator.clipboard && navigator.clipboard.writeText) {
        await navigator.clipboard.writeText(summaryText);
      } else {
        document.execCommand("copy");
      }
      setMessage("安全な要約（masked summary）をコピーしました。raw response は含みません。");
    } catch (_error) {
      setMessage("コピーに失敗しました。表示欄から安全な要約だけを手動でコピーしてください。");
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

  render().catch(() => {
    filterState.textContent = "状態: 読み込み失敗";
    localTestSummary.textContent = "Chrome 拡張として読み込んでいない、または storage を読めない可能性があります。";
    researchStatus.textContent = "読み込み失敗";
    researchNextStep.textContent = "Chrome の拡張機能画面から再読み込みし、もう一度 popup を開いてください。";
    setMessage("状態の読み込みに失敗しました。Chrome 拡張として読み込んでいるか確認してください。");
  });
})();
