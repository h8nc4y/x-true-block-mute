(function () {
  "use strict";

  const namespace = (globalThis.XTrueBlockMute = globalThis.XTrueBlockMute || {});
  const {
    DEFAULT_SETTINGS,
    DISPLAY_MODES,
    LIST_KINDS,
    RESEARCH_F1A,
    SCHEMA_VERSION,
    STORAGE_KEYS,
    SYNC_SOURCE,
    SYNTHETIC_ENTRIES,
    SYNTHETIC_SOURCE
  } = namespace;

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

  function getResearchF1A() {
    const research = namespace.ResearchF1A;
    if (
      !research ||
      typeof research.normalizeObservation !== "function" ||
      typeof research.normalizeState !== "function"
    ) {
      throw new Error("ResearchF1A is unavailable; load observation-utils.js before storage.js");
    }
    return research;
  }

  function normalizeResearchObservation(value) {
    return getResearchF1A().normalizeObservation(value);
  }

  function normalizeResearchState(value) {
    return getResearchF1A().normalizeState(value);
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

  async function seedSyntheticEntries() {
    const current = await getEntryStore();
    const nonSynthetic = current.entries.filter((entry) => entry.source !== SYNTHETIC_SOURCE);
    const store = {
      schemaVersion: SCHEMA_VERSION,
      entries: nonSynthetic.concat(clone(SYNTHETIC_ENTRIES)),
      lastSyntheticUpdatedAt: new Date().toISOString()
    };
    return setEntryStore(store);
  }

  async function clearSyntheticEntries() {
    const current = await getEntryStore();
    const store = {
      schemaVersion: SCHEMA_VERSION,
      entries: current.entries.filter((entry) => entry.source !== SYNTHETIC_SOURCE),
      lastSyntheticUpdatedAt: null
    };
    return setEntryStore(store);
  }

  // Merge a freshly synced batch of the user's own block/mute list into the
  // normal entry store. Matching prefers the stable user_id and falls back to handle,
  // so a handle-only entry is upgraded in place (not duplicated) once a user_id
  // becomes available. This is additive only: accounts that disappeared from the
  // list are NOT removed here. Full-list reconciliation (handling un-blocks)
  // depends on whether the source can read the complete list and is deferred to
  // the production sync step after the F1 source is chosen.
  async function upsertSyncedEntries(incomingEntries, syncedAt = new Date().toISOString()) {
    const current = await getEntryStore();
    const byUserId = new Map();
    const byHandle = new Map();
    for (const entry of current.entries) {
      if (entry.user_id) {
        byUserId.set(entry.user_id, entry);
      }
      if (entry.handle) {
        byHandle.set(entry.handle, entry);
      }
    }

    const incoming = Array.isArray(incomingEntries) ? incomingEntries : [];
    for (const raw of incoming) {
      const candidate = normalizeEntry({ ...raw, source: SYNC_SOURCE, syncedAt });
      if (!candidate) {
        continue;
      }
      const match =
        (candidate.user_id && byUserId.get(candidate.user_id)) ||
        (candidate.handle && byHandle.get(candidate.handle)) ||
        null;
      if (match) {
        if (candidate.user_id) {
          match.user_id = candidate.user_id;
          byUserId.set(candidate.user_id, match);
        }
        if (candidate.handle) {
          match.handle = candidate.handle;
          byHandle.set(candidate.handle, match);
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
          byUserId.set(candidate.user_id, candidate);
        }
        if (candidate.handle) {
          byHandle.set(candidate.handle, candidate);
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

  async function clearSyncedEntries() {
    const current = await getEntryStore();
    const store = {
      schemaVersion: SCHEMA_VERSION,
      entries: current.entries.filter((entry) => entry.source !== SYNC_SOURCE),
      lastSyntheticUpdatedAt: current.lastSyntheticUpdatedAt
    };
    return setEntryStore(store);
  }

  async function getF1AResearchState() {
    return normalizeResearchState(await getArea("local", STORAGE_KEYS.F1A_RESEARCH));
  }

  async function setF1AResearchEnabled(enabled) {
    const current = await getF1AResearchState();
    const nextState = {
      ...current,
      enabled: Boolean(enabled),
      updatedAt: new Date().toISOString()
    };
    await setArea("local", STORAGE_KEYS.F1A_RESEARCH, nextState);
    return nextState;
  }

  async function clearF1AResearchObservations() {
    const current = await getF1AResearchState();
    const nextState = {
      schemaVersion: SCHEMA_VERSION,
      enabled: current.enabled,
      observations: [],
      updatedAt: new Date().toISOString()
    };
    await setArea("local", STORAGE_KEYS.F1A_RESEARCH, nextState);
    return nextState;
  }

  async function appendF1AResearchObservation(observation) {
    const normalizedObservation = normalizeResearchObservation(observation);
    if (!normalizedObservation) {
      return getF1AResearchState();
    }
    const current = await getF1AResearchState();
    if (!current.enabled) {
      return current;
    }
    const nextState = {
      schemaVersion: SCHEMA_VERSION,
      enabled: true,
      observations: current.observations.concat(normalizedObservation).slice(-RESEARCH_F1A.MAX_OBSERVATIONS),
      updatedAt: new Date().toISOString()
    };
    await setArea("local", STORAGE_KEYS.F1A_RESEARCH, nextState);
    return nextState;
  }

  namespace.Storage = {
    appendF1AResearchObservation,
    clearF1AResearchObservations,
    clearSyncedEntries,
    clearSyntheticEntries,
    getF1AResearchState,
    getEntryStore,
    getSettings,
    normalizeHandle,
    normalizeEntryStore,
    normalizeResearchState,
    normalizeSettings,
    seedSyntheticEntries,
    setEntryStore,
    setF1AResearchEnabled,
    setSettings,
    upsertSyncedEntries
  };
})();
