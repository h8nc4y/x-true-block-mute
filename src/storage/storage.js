(function () {
  "use strict";

  const namespace = (globalThis.XTrueBlockMute = globalThis.XTrueBlockMute || {});
  const {
    DEFAULT_SETTINGS,
    DISPLAY_MODES,
    LIST_KINDS,
    SCHEMA_VERSION,
    STORAGE_KEYS,
    SYNC_SOURCE,
    SYNTHETIC_ENTRIES,
    SYNTHETIC_SOURCE
  } = namespace;

  let entryWriteLane = Promise.resolve();

  function runExclusive(task) {
    const run = entryWriteLane.then(task, task);
    entryWriteLane = run.then(() => undefined, () => undefined);
    return run;
  }

  function hasChromeStorage() {
    return Boolean(globalThis.chrome && chrome.storage && chrome.storage.local && chrome.storage.sync);
  }

  function clone(value) {
    return JSON.parse(JSON.stringify(value));
  }

  function normalizeHandle(handle) {
    if (typeof handle !== "string") {
      return "";
    }
    return handle.replace(/^@/, "").trim().toLowerCase();
  }

  function normalizeSettings(value) {
    const incoming = value && typeof value === "object" ? value : {};
    const displayMode = Object.values(DISPLAY_MODES).includes(incoming.displayMode)
      ? incoming.displayMode
      : DEFAULT_SETTINGS.displayMode;

    return {
      schemaVersion: SCHEMA_VERSION,
      enabled: typeof incoming.enabled === "boolean" ? incoming.enabled : DEFAULT_SETTINGS.enabled,
      displayMode
    };
  }

  function normalizeListKind(value) {
    return value === LIST_KINDS.BLOCKED || value === LIST_KINDS.MUTED ? value : null;
  }

  function normalizeEntry(entry) {
    if (!entry || typeof entry !== "object") {
      return null;
    }

    const userId = typeof entry.user_id === "string" && entry.user_id.trim() ? entry.user_id.trim() : null;
    const handle = normalizeHandle(entry.handle);
    if (!userId && !handle) {
      return null;
    }

    // listKind and syncedAt are additive schema-v2 fields. Reading an older v1
    // entry simply defaults them to null, so normalization is the migration.
    return {
      user_id: userId,
      handle: handle || null,
      source: typeof entry.source === "string" ? entry.source : "manual",
      idResolutionStatus: typeof entry.idResolutionStatus === "string" ? entry.idResolutionStatus : "unknown",
      label: typeof entry.label === "string" ? entry.label : "",
      listKind: normalizeListKind(entry.listKind),
      syncedAt: typeof entry.syncedAt === "string" ? entry.syncedAt : null
    };
  }

  function normalizeEntryStore(value) {
    const incoming = value && typeof value === "object" ? value : {};
    const entries = Array.isArray(incoming.entries) ? incoming.entries.map(normalizeEntry).filter(Boolean) : [];

    return {
      schemaVersion: SCHEMA_VERSION,
      entries,
      lastSyntheticUpdatedAt:
        typeof incoming.lastSyntheticUpdatedAt === "string" ? incoming.lastSyntheticUpdatedAt : null
    };
  }

  function normalizeSyncGeneration(value) {
    const incoming = value && typeof value === "object" ? value : {};
    return {
      generation: typeof incoming.generation === "string" ? incoming.generation : null
    };
  }

  function sameActiveGeneration(left, right) {
    return left.generation === right.generation;
  }

  const INITIAL_SYNC_GENERATION = "initial";

  function createSyncGeneration() {
    if (globalThis.crypto && typeof globalThis.crypto.randomUUID === "function") {
      return globalThis.crypto.randomUUID();
    }
    return `${Math.random().toString(36).slice(2, 12)}-${Math.random().toString(36).slice(2, 12)}`;
  }

  function syncEntriesKey(generation) {
    return `${STORAGE_KEYS.SYNC_ENTRIES_PREFIX}${generation}`;
  }

  function activeSyncGeneration(syncGeneration) {
    return syncGeneration.generation || INITIAL_SYNC_GENERATION;
  }

  function mergeEntryStores(baseStore, syntheticStore, syncedStore) {
    const baseEntries = baseStore.entries.filter(
      (entry) => entry.source !== SYNTHETIC_SOURCE && entry.source !== SYNC_SOURCE
    );
    const syntheticEntries = syntheticStore.entries.filter(
      (entry) => entry.source === SYNTHETIC_SOURCE
    );
    const syncedEntries = syncedStore.entries.filter(
      (entry) => entry.source === SYNC_SOURCE
    );
    return {
      schemaVersion: SCHEMA_VERSION,
      entries: baseEntries.concat(syntheticEntries, syncedEntries),
      lastSyntheticUpdatedAt: syntheticStore.lastSyntheticUpdatedAt
    };
  }

  function mergeEntryDomainSnapshots({
    generation,
    migrated,
    rawLegacyStore,
    rawBaseStore,
    rawSyntheticStore,
    rawLegacySyntheticStore,
    syncedStore,
    allowLegacyProduction = true
  }) {
    const legacyStore = normalizeEntryStore(rawLegacyStore);
    const useLegacyDomains = !migrated;
    const baseStore = useLegacyDomains
      ? legacyStore
      : normalizeEntryStore(rawBaseStore);
    const syntheticStore = rawSyntheticStore !== undefined
      ? normalizeEntryStore(rawSyntheticStore)
      : useLegacyDomains
        ? legacyStore
        : normalizeEntryStore(rawLegacySyntheticStore);
    const productionStore = allowLegacyProduction && !generation.generation && !migrated
      ? legacyStore
      : syncedStore;
    return mergeEntryStores(baseStore, syntheticStore, productionStore);
  }

  function getArea(areaName, key) {
    return new Promise((resolve, reject) => {
      if (!hasChromeStorage()) {
        reject(new Error("chrome.storage is unavailable"));
        return;
      }
      chrome.storage[areaName].get(key, (result) => {
        const error = chrome.runtime && chrome.runtime.lastError;
        if (error) {
          reject(new Error(error.message));
          return;
        }
        resolve(result ? result[key] : undefined);
      });
    });
  }

  function setArea(areaName, key, value) {
    return new Promise((resolve, reject) => {
      if (!hasChromeStorage()) {
        reject(new Error("chrome.storage is unavailable"));
        return;
      }
      chrome.storage[areaName].set({ [key]: value }, () => {
        const error = chrome.runtime && chrome.runtime.lastError;
        if (error) {
          reject(new Error(error.message));
          return;
        }
        resolve();
      });
    });
  }

  function getAllArea(areaName) {
    return new Promise((resolve, reject) => {
      if (!hasChromeStorage()) {
        reject(new Error("chrome.storage is unavailable"));
        return;
      }
      chrome.storage[areaName].get(null, (result) => {
        const error = chrome.runtime && chrome.runtime.lastError;
        if (error) {
          reject(new Error(error.message));
          return;
        }
        resolve(result && typeof result === "object" ? result : {});
      });
    });
  }

  function removeArea(areaName, keyOrKeys) {
    return new Promise((resolve, reject) => {
      if (!hasChromeStorage()) {
        reject(new Error("chrome.storage is unavailable"));
        return;
      }
      chrome.storage[areaName].remove(keyOrKeys, () => {
        const error = chrome.runtime && chrome.runtime.lastError;
        if (error) {
          reject(new Error(error.message));
          return;
        }
        resolve();
      });
    });
  }

  async function getSettings() {
    return normalizeSettings(await getArea("sync", STORAGE_KEYS.SETTINGS));
  }

  async function setSettings(nextSettings) {
    const settings = normalizeSettings(nextSettings);
    await setArea("sync", STORAGE_KEYS.SETTINGS, settings);
    return settings;
  }

  async function getSyncGeneration() {
    return normalizeSyncGeneration(await getArea("local", STORAGE_KEYS.SYNC_GENERATION));
  }

  async function setSyncGeneration(nextGeneration) {
    const generation = normalizeSyncGeneration(nextGeneration);
    await setArea("local", STORAGE_KEYS.SYNC_GENERATION, generation);
    return generation;
  }

  async function getSyncMigrated() {
    return (await getArea("local", STORAGE_KEYS.SYNC_MIGRATED)) === true;
  }

  async function setSyncMigrated() {
    await setArea("local", STORAGE_KEYS.SYNC_MIGRATED, true);
  }

  async function getSyncedStore(generation) {
    if (!generation) {
      return normalizeEntryStore(null);
    }
    const stored = normalizeEntryStore(
      await getArea("local", syncEntriesKey(generation))
    );
    return {
      schemaVersion: SCHEMA_VERSION,
      entries: stored.entries.filter((entry) => entry.source === SYNC_SOURCE),
      lastSyntheticUpdatedAt: null
    };
  }

  async function setSyncedStore(generation, entries) {
    const store = normalizeEntryStore({
      schemaVersion: SCHEMA_VERSION,
      entries: Array.isArray(entries) ? entries : [],
      lastSyntheticUpdatedAt: null
    });
    const syncedStore = {
      schemaVersion: SCHEMA_VERSION,
      entries: store.entries.filter((entry) => entry.source === SYNC_SOURCE),
      lastSyntheticUpdatedAt: null
    };
    await setArea("local", syncEntriesKey(generation), syncedStore);
    return syncedStore;
  }

  async function discardSyncedStore(generation) {
    if (!generation) {
      return;
    }
    if (typeof chrome.storage.local.remove === "function") {
      await removeArea("local", syncEntriesKey(generation));
      return;
    }
    // 軽量 fixture の旧 stub 互換。実 Chrome では remove を使い空 key を蓄積しない。
    await setSyncedStore(generation, []);
  }

  async function discardRetiredSyncedStores() {
    // snapshot を先に取り、その後の live pointer を除外基準にする。後続 clear の
    // generation key は pointer 公開後にしか writer が作れないため、snapshot 後に
    // active になった future key を古い cleanup が削除することはない。
    const allLocalValues = await getAllArea("local");
    const liveGeneration = await getSyncGeneration();
    const liveActiveKey = syncEntriesKey(activeSyncGeneration(liveGeneration));
    const retiredKeys = Object.keys(allLocalValues).filter(
      (key) =>
        key.startsWith(STORAGE_KEYS.SYNC_ENTRIES_PREFIX) &&
        key !== liveActiveKey
    );
    if (retiredKeys.length === 0) {
      return;
    }
    if (typeof chrome.storage.local.remove === "function") {
      await removeArea("local", retiredKeys);
      return;
    }
    await Promise.all(
      retiredKeys.map((key) =>
        setArea("local", key, {
          schemaVersion: SCHEMA_VERSION,
          entries: [],
          lastSyntheticUpdatedAt: null
        })
      )
    );
  }

  async function assertActiveGeneration(expectedGeneration) {
    const current = await getSyncGeneration();
    if (sameActiveGeneration(expectedGeneration, current)) {
      return;
    }

    // 古い context の書込み先は世代固有 key なので、その key だけを空にする。
    // 現行世代の fresh write へ触れず、stale operation の最後の writer が後始末する。
    await discardSyncedStore(activeSyncGeneration(expectedGeneration));
    throw new Error("sync entry write was superseded by a concurrent clear");
  }

  async function getSyncedStoreForOperation(expectedGeneration) {
    const [rawLegacyStore, syncedStore, migrated] = await Promise.all([
      getArea("local", STORAGE_KEYS.ENTRIES),
      getSyncedStore(activeSyncGeneration(expectedGeneration)),
      getSyncMigrated()
    ]);
    await assertActiveGeneration(expectedGeneration);

    const legacyStore = normalizeEntryStore(rawLegacyStore);
    const legacyEntries = !expectedGeneration.generation && !migrated
      ? legacyStore.entries.filter((entry) => entry.source === SYNC_SOURCE)
      : [];
    return mergeExistingSyncedEntries(legacyEntries, syncedStore.entries);
  }

  async function getEntryStore() {
    // clear pointer / migration commit が読取り中に変わった場合だけ有限回リトライする。
    // 安定 snapshot を得られなければ production sync 行を返さず安全側へ倒す。
    for (let attempt = 0; attempt < 3; attempt += 1) {
      const [beforeGeneration, beforeMigrated] = await Promise.all([
        getSyncGeneration(),
        getSyncMigrated()
      ]);
      const [
        rawLegacyStore,
        rawBaseStore,
        rawSyntheticStore,
        rawLegacySyntheticStore,
        syncedStore
      ] = await Promise.all([
        getArea("local", STORAGE_KEYS.ENTRIES),
        getArea("local", STORAGE_KEYS.BASE_ENTRIES),
        getArea("local", STORAGE_KEYS.SYNTHETIC_ENTRIES),
        getArea("local", STORAGE_KEYS.LEGACY_SYNTHETIC_ENTRIES),
        getSyncedStore(activeSyncGeneration(beforeGeneration))
      ]);
      const [afterGeneration, afterMigrated] = await Promise.all([
        getSyncGeneration(),
        getSyncMigrated()
      ]);
      if (
        !sameActiveGeneration(beforeGeneration, afterGeneration) ||
        beforeMigrated !== afterMigrated
      ) {
        continue;
      }

      return mergeEntryDomainSnapshots({
        generation: beforeGeneration,
        migrated: beforeMigrated,
        rawLegacyStore,
        rawBaseStore,
        rawSyntheticStore,
        rawLegacySyntheticStore,
        syncedStore
      });
    }

    const [
      generation,
      migrated,
      rawLegacyStore,
      rawBaseStore,
      rawSyntheticStore,
      rawLegacySyntheticStore
    ] = await Promise.all([
      getSyncGeneration(),
      getSyncMigrated(),
      getArea("local", STORAGE_KEYS.ENTRIES),
      getArea("local", STORAGE_KEYS.BASE_ENTRIES),
      getArea("local", STORAGE_KEYS.SYNTHETIC_ENTRIES),
      getArea("local", STORAGE_KEYS.LEGACY_SYNTHETIC_ENTRIES)
    ]);
    return mergeEntryDomainSnapshots({
      generation,
      migrated,
      rawLegacyStore,
      rawBaseStore,
      rawSyntheticStore,
      rawLegacySyntheticStore,
      syncedStore: normalizeEntryStore(null),
      allowLegacyProduction: false
    });
  }

  async function stageLegacyEntryDomainsIfNeeded() {
    // legacy key を先に読み、その後 commit を確認する。別 context が commit→remove
    // まで完了した場合は migrated=true になるため、空 snapshot で専用領域を戻さない。
    const rawLegacyStore = await getArea("local", STORAGE_KEYS.ENTRIES);
    if (await getSyncMigrated()) {
      return false;
    }

    const store = normalizeEntryStore(rawLegacyStore);
    const baseStore = {
      schemaVersion: SCHEMA_VERSION,
      entries: store.entries.filter(
        (entry) => entry.source !== SYNTHETIC_SOURCE && entry.source !== SYNC_SOURCE
      ),
      lastSyntheticUpdatedAt: null
    };
    const syntheticStore = {
      schemaVersion: SCHEMA_VERSION,
      entries: store.entries.filter((entry) => entry.source === SYNTHETIC_SOURCE),
      lastSyntheticUpdatedAt: store.lastSyntheticUpdatedAt
    };
    // 現行 synthetic writer とは別の fallback key へ移すため、seed/clear と競合しても
    // fresh dedicated synthetic store を上書きしない。
    await setArea("local", STORAGE_KEYS.BASE_ENTRIES, baseStore);
    await setArea("local", STORAGE_KEYS.LEGACY_SYNTHETIC_ENTRIES, syntheticStore);
    return true;
  }

  async function publishLegacyMigration(expectedGeneration) {
    const staged = await stageLegacyEntryDomainsIfNeeded();
    if (staged) {
      await setSyncMigrated();
    }
    await assertActiveGeneration(expectedGeneration);
  }

  async function discardLegacyEntryStore() {
    if (typeof chrome.storage.local.remove === "function") {
      await removeArea("local", STORAGE_KEYS.ENTRIES);
      return;
    }
    // 古い軽量 stub でも read-modify-write はせず、retired key 全体を空にする。
    await setArea("local", STORAGE_KEYS.ENTRIES, normalizeEntryStore(null));
  }

  async function persistSyncedStoreForGeneration(nextStore, expectedGeneration) {
    const store = normalizeEntryStore(nextStore);
    await setSyncedStore(activeSyncGeneration(expectedGeneration), store.entries);
    await assertActiveGeneration(expectedGeneration);

    // sync shard と non-sync 専用領域が成功した後だけ commit を公開する。失敗時は
    // legacy xtbmEntries が authoritative なままなので、次回操作で同じ移行を再試行する。
    await publishLegacyMigration(expectedGeneration);
    // commit 後は旧 single-key を whole-key remove する。専用 base/synthetic/shard の
    // snapshot を書き戻さないため、別 context の fresh write を巻き戻さない。
    await discardLegacyEntryStore();
    // cleanup 中に clear が線形化した stale operation は成功扱いにしない。
    await assertActiveGeneration(expectedGeneration);
    return getEntryStore();
  }

  async function seedSyntheticEntriesCore() {
    const store = {
      schemaVersion: SCHEMA_VERSION,
      entries: clone(SYNTHETIC_ENTRIES),
      lastSyntheticUpdatedAt: new Date().toISOString()
    };
    await setArea("local", STORAGE_KEYS.SYNTHETIC_ENTRIES, store);
    return getEntryStore();
  }

  async function seedSyntheticEntries() {
    return runExclusive(seedSyntheticEntriesCore);
  }

  async function clearSyntheticEntriesCore() {
    const store = {
      schemaVersion: SCHEMA_VERSION,
      entries: [],
      lastSyntheticUpdatedAt: null
    };
    await setArea("local", STORAGE_KEYS.SYNTHETIC_ENTRIES, store);
    return getEntryStore();
  }

  async function clearSyntheticEntries() {
    return runExclusive(clearSyntheticEntriesCore);
  }

  function idKey(listKind, userId) {
    return `${listKind || ""}|${userId}`;
  }

  function handleKey(listKind, handle) {
    return `${listKind || ""}|${handle}`;
  }

  // Merge a freshly synced batch of the user's own block/mute list into the
  // normal entry store. Matching prefers the stable user_id and falls back to handle,
  // so a handle-only entry is upgraded in place (not duplicated) once a user_id
  // becomes available. This path is intentionally additive; full-list cleanup is
  // handled by replaceSyncedListKind() only after the sync bridge has staged a
  // non-empty complete-list capture for one listKind.
  function mergeSyncedEntries(current, incomingEntries, syncedAt) {
    const byUserId = new Map();
    const byHandle = new Map();
    for (const entry of current.entries) {
      if (entry.user_id) {
        byUserId.set(idKey(entry.listKind, entry.user_id), entry);
      }
      if (entry.handle) {
        byHandle.set(handleKey(entry.listKind, entry.handle), entry);
      }
    }

    const incoming = Array.isArray(incomingEntries) ? incomingEntries : [];
    for (const raw of incoming) {
      const candidate = normalizeEntry({ ...raw, source: SYNC_SOURCE, syncedAt });
      if (!candidate) {
        continue;
      }
      const match =
        (candidate.user_id && byUserId.get(idKey(candidate.listKind, candidate.user_id))) ||
        (candidate.handle && byHandle.get(handleKey(candidate.listKind, candidate.handle))) ||
        null;
      if (match) {
        if (candidate.user_id) {
          match.user_id = candidate.user_id;
          byUserId.set(idKey(candidate.listKind, candidate.user_id), match);
        }
        if (candidate.handle) {
          match.handle = candidate.handle;
          byHandle.set(handleKey(candidate.listKind, candidate.handle), match);
        }
        if (candidate.listKind) {
          match.listKind = candidate.listKind;
        }
        if (candidate.idResolutionStatus !== "unknown") {
          match.idResolutionStatus = candidate.idResolutionStatus;
        }
        match.source = SYNC_SOURCE;
        match.syncedAt = syncedAt;
      } else {
        current.entries.push(candidate);
        if (candidate.user_id) {
          byUserId.set(idKey(candidate.listKind, candidate.user_id), candidate);
        }
        if (candidate.handle) {
          byHandle.set(handleKey(candidate.listKind, candidate.handle), candidate);
        }
      }
    }

    const store = {
      schemaVersion: SCHEMA_VERSION,
      entries: current.entries,
      lastSyntheticUpdatedAt: current.lastSyntheticUpdatedAt
    };
    return store;
  }

  function mergeExistingSyncedEntries(...entryGroups) {
    const merged = {
      schemaVersion: SCHEMA_VERSION,
      entries: [],
      lastSyntheticUpdatedAt: null
    };
    // migration commit が失敗すると legacy と initial shard に同じ行が残る。
    // legacy → shard の順に再マージして、再試行時に重複させず shard 側の更新を残す。
    for (const entries of entryGroups) {
      for (const entry of entries) {
        mergeSyncedEntries(merged, [entry], entry.syncedAt);
      }
    }
    return merged;
  }

  async function upsertSyncedEntriesCore(incomingEntries, syncedAt = new Date().toISOString()) {
    const generation = await getSyncGeneration();
    const current = await getSyncedStoreForOperation(generation);
    const store = mergeSyncedEntries(current, incomingEntries, syncedAt);
    return persistSyncedStoreForGeneration(store, generation);
  }

  async function upsertSyncedEntries(incomingEntries, syncedAt = new Date().toISOString()) {
    return runExclusive(() => upsertSyncedEntriesCore(incomingEntries, syncedAt));
  }

  async function clearSyncedEntriesCore() {
    let current = await getSyncGeneration();
    if (!(await getSyncMigrated())) {
      // clear 前に legacy の non-sync 領域を専用 key へ durable にする。初期世代では
      // production 行も shard へ先に置き、commit 公開から pointer 更新まで読取を保つ。
      if (!current.generation) {
        const currentStore = await getSyncedStoreForOperation(current);
        await setSyncedStore(
          activeSyncGeneration(current),
          currentStore.entries
        );
        await assertActiveGeneration(current);
      }
      await publishLegacyMigration(current);
    }
    // migration 中に別 clear が勝った場合はその世代を current として扱う。
    current = await getSyncGeneration();
    const next = {
      generation: createSyncGeneration()
    };
    // この単一 marker write が削除の linearization point。以後の upsert は
    // 新世代へ書き、開始済みの旧 upsert は旧 shard だけを自己 cleanup する。
    await setSyncGeneration(next);
    await discardSyncedStore(activeSyncGeneration(current));
    // 過去の cleanup 失敗や途中終了で孤立した shard も prefix 列挙で回収する。
    // 一時失敗しても active pointer は新世代のままなので、次回 clear が再試行できる。
    await discardRetiredSyncedStores();
    await discardLegacyEntryStore();
    return getEntryStore();
  }

  async function clearSyncedEntries() {
    return runExclusive(clearSyncedEntriesCore);
  }

  // Reconcile a full sync of one list: drop every previously synced entry for
  // this listKind, then upsert the freshly captured set with the same
  // dedupe/normalize semantics as upsertSyncedEntries. This removes un-blocks /
  // un-mutes and must only be called when the COMPLETE list was captured (the
  // sync bridge gates this on reaching the tail). Synthetic data and the other
  // listKind's synced entries are left untouched. An empty `incomingEntries`
  // reconciles this listKind to empty (explicit complete clear).
  async function replaceSyncedListKindCore(listKind, incomingEntries, syncedAt = new Date().toISOString()) {
    const kind = normalizeListKind(listKind);
    if (!kind) {
      return getEntryStore();
    }
    const generation = await getSyncGeneration();
    const current = await getSyncedStoreForOperation(generation);
    current.entries = current.entries.filter(
      (entry) => !(entry.source === SYNC_SOURCE && entry.listKind === kind)
    );
    const store = mergeSyncedEntries(current, incomingEntries, syncedAt);
    return persistSyncedStoreForGeneration(store, generation);
  }

  async function replaceSyncedListKind(listKind, incomingEntries, syncedAt = new Date().toISOString()) {
    return runExclusive(() => replaceSyncedListKindCore(listKind, incomingEntries, syncedAt));
  }

  function normalizeSyncState(value) {
    const incoming = value && typeof value === "object" ? value : {};
    return {
      schemaVersion: SCHEMA_VERSION,
      enabled: typeof incoming.enabled === "boolean" ? incoming.enabled : false,
      lastSyncedAt: typeof incoming.lastSyncedAt === "string" ? incoming.lastSyncedAt : null
    };
  }

  async function getSyncState() {
    const [legacyValue, enabledValue, lastSyncedAtValue] = await Promise.all([
      getArea("local", STORAGE_KEYS.SYNC_STATE),
      getArea("local", STORAGE_KEYS.SYNC_ENABLED),
      getArea("local", STORAGE_KEYS.SYNC_LAST_SYNCED_AT)
    ]);
    const legacy = normalizeSyncState(legacyValue);
    return {
      schemaVersion: SCHEMA_VERSION,
      enabled: typeof enabledValue === "boolean" ? enabledValue : legacy.enabled,
      lastSyncedAt:
        typeof lastSyncedAtValue === "string" ? lastSyncedAtValue : legacy.lastSyncedAt
    };
  }

  async function setSyncEnabledCore(enabled) {
    await setArea("local", STORAGE_KEYS.SYNC_ENABLED, Boolean(enabled));
    return getSyncState();
  }

  async function markSyncedCore(syncedAt) {
    await setArea("local", STORAGE_KEYS.SYNC_LAST_SYNCED_AT, syncedAt);
    return getSyncState();
  }

  // enabled と lastSyncedAt は別 top-level key へ書く。context-local lane だけに
  // 頼らないため、popup の無効化と settings page の完了記録が重なっても
  // 一方の full-object snapshot で他方を巻き戻さない。旧 xtbmSyncState は読取互換。
  async function setSyncEnabled(enabled) {
    return runExclusive(() => setSyncEnabledCore(enabled));
  }

  async function markSynced(syncedAt = new Date().toISOString()) {
    return runExclusive(() => markSyncedCore(syncedAt));
  }

  namespace.Storage = {
    clearSyncedEntries,
    clearSyntheticEntries,
    getEntryStore,
    getSettings,
    getSyncState,
    markSynced,
    normalizeHandle,
    normalizeEntryStore,
    normalizeSettings,
    replaceSyncedListKind,
    seedSyntheticEntries,
    setSettings,
    setSyncEnabled,
    upsertSyncedEntries
  };
})();
