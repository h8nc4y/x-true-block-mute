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
