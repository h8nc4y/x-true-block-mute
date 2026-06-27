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

  async function getSettings() {
    return normalizeSettings(await getArea("sync", STORAGE_KEYS.SETTINGS));
  }

  async function setSettings(nextSettings) {
    const settings = normalizeSettings(nextSettings);
    await setArea("sync", STORAGE_KEYS.SETTINGS, settings);
    return settings;
  }

  async function getEntryStore() {
    return normalizeEntryStore(await getArea("local", STORAGE_KEYS.ENTRIES));
  }

  async function setEntryStore(nextStore) {
    const store = normalizeEntryStore(nextStore);
    await setArea("local", STORAGE_KEYS.ENTRIES, store);
    return store;
  }

  async function seedSyntheticEntriesCore() {
    const current = await getEntryStore();
    const nonSynthetic = current.entries.filter((entry) => entry.source !== SYNTHETIC_SOURCE);
    const store = {
      schemaVersion: SCHEMA_VERSION,
      entries: nonSynthetic.concat(clone(SYNTHETIC_ENTRIES)),
      lastSyntheticUpdatedAt: new Date().toISOString()
    };
    return setEntryStore(store);
  }

  async function seedSyntheticEntries() {
    return runExclusive(seedSyntheticEntriesCore);
  }

  async function clearSyntheticEntriesCore() {
    const current = await getEntryStore();
    const store = {
      schemaVersion: SCHEMA_VERSION,
      entries: current.entries.filter((entry) => entry.source !== SYNTHETIC_SOURCE),
      lastSyntheticUpdatedAt: null
    };
    return setEntryStore(store);
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
  async function upsertSyncedEntriesCore(incomingEntries, syncedAt = new Date().toISOString()) {
    const current = await getEntryStore();
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
    return setEntryStore(store);
  }

  async function upsertSyncedEntries(incomingEntries, syncedAt = new Date().toISOString()) {
    return runExclusive(() => upsertSyncedEntriesCore(incomingEntries, syncedAt));
  }

  async function clearSyncedEntriesCore() {
    const current = await getEntryStore();
    const store = {
      schemaVersion: SCHEMA_VERSION,
      entries: current.entries.filter((entry) => entry.source !== SYNC_SOURCE),
      lastSyntheticUpdatedAt: current.lastSyntheticUpdatedAt
    };
    return setEntryStore(store);
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
    const current = await getEntryStore();
    const retained = current.entries.filter(
      (entry) => !(entry.source === SYNC_SOURCE && entry.listKind === kind)
    );
    await setEntryStore({
      schemaVersion: SCHEMA_VERSION,
      entries: retained,
      lastSyntheticUpdatedAt: current.lastSyntheticUpdatedAt
    });
    return upsertSyncedEntriesCore(incomingEntries, syncedAt);
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
    return normalizeSyncState(await getArea("local", STORAGE_KEYS.SYNC_STATE));
  }

  async function setSyncEnabled(enabled) {
    const current = await getSyncState();
    const next = { ...current, enabled: Boolean(enabled) };
    await setArea("local", STORAGE_KEYS.SYNC_STATE, next);
    return next;
  }

  async function markSynced(syncedAt = new Date().toISOString()) {
    const current = await getSyncState();
    const next = { ...current, lastSyncedAt: syncedAt };
    await setArea("local", STORAGE_KEYS.SYNC_STATE, next);
    return next;
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
    setEntryStore,
    setSettings,
    setSyncEnabled,
    upsertSyncedEntries
  };
})();
