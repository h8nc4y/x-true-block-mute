(function () {
  "use strict";

  const namespace = (globalThis.XTrueBlockMute = globalThis.XTrueBlockMute || {});
  const {
    DEFAULT_SETTINGS,
    DISPLAY_MODES,
    RESEARCH_F1A,
    SCHEMA_VERSION,
    STORAGE_KEYS,
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

  function normalizeEntry(entry) {
    if (!entry || typeof entry !== "object") {
      return null;
    }

    const userId = typeof entry.user_id === "string" && entry.user_id.trim() ? entry.user_id.trim() : null;
    const handle = normalizeHandle(entry.handle);
    if (!userId && !handle) {
      return null;
    }

    return {
      user_id: userId,
      handle: handle || null,
      source: typeof entry.source === "string" ? entry.source : "manual",
      idResolutionStatus: typeof entry.idResolutionStatus === "string" ? entry.idResolutionStatus : "unknown",
      label: typeof entry.label === "string" ? entry.label : ""
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

  function normalizeResearchObservation(value) {
    if (!value || typeof value !== "object") {
      return null;
    }
    const endpointClass = typeof value.endpointClass === "string" ? value.endpointClass.slice(0, 240) : "unknown";
    const observedAt = typeof value.observedAt === "string" ? value.observedAt : new Date().toISOString();
    const pageKind = ["blocked", "muted"].includes(value.pageKind) ? value.pageKind : "unknown";
    const requestKind = ["fetch", "xhr"].includes(value.requestKind) ? value.requestKind : "unknown";
    const method = typeof value.method === "string" ? value.method.slice(0, 12) : "GET";
    const responseKind = typeof value.responseKind === "string" ? value.responseKind.slice(0, 24) : "unknown";
    const statusClass = typeof value.statusClass === "string" ? value.statusClass.slice(0, 12) : "unknown";
    const copyStringArray = (items, limit, itemLimit) =>
      Array.isArray(items)
        ? items.filter((item) => typeof item === "string").slice(0, limit).map((item) => item.slice(0, itemLimit))
        : [];

    return {
      schemaVersion: SCHEMA_VERSION,
      observedAt,
      pageKind,
      requestKind,
      method,
      endpointClass,
      statusClass,
      responseKind,
      topLevelKeys: copyStringArray(value.topLevelKeys, 30, 80),
      shapePaths: copyStringArray(value.shapePaths, 80, 120),
      queryKeys: copyStringArray(value.queryKeys, 30, 80),
      arrayHints: Array.isArray(value.arrayHints)
        ? value.arrayHints.slice(0, 20).map((hint) => ({
            path: typeof hint.path === "string" ? hint.path.slice(0, 120) : "unknown",
            count: Number.isFinite(hint.count) ? Math.max(0, Math.min(9999, Math.trunc(hint.count))) : 0
          }))
        : [],
      fieldPresence: {
        userIdLike: Boolean(value.fieldPresence && value.fieldPresence.userIdLike),
        handleLike: Boolean(value.fieldPresence && value.fieldPresence.handleLike),
        cursorLike: Boolean(value.fieldPresence && value.fieldPresence.cursorLike)
      }
    };
  }

  function normalizeResearchState(value) {
    const incoming = value && typeof value === "object" ? value : {};
    const observations = Array.isArray(incoming.observations)
      ? incoming.observations.map(normalizeResearchObservation).filter(Boolean).slice(-RESEARCH_F1A.MAX_OBSERVATIONS)
      : [];

    return {
      schemaVersion: SCHEMA_VERSION,
      enabled: typeof incoming.enabled === "boolean" ? incoming.enabled : false,
      observations,
      updatedAt: typeof incoming.updatedAt === "string" ? incoming.updatedAt : null
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
    setSettings
  };
})();
