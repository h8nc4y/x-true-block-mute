// verify-storage-sync-schema.mjs
//
// Exercises the schema-v2 sync helpers in src/storage/storage.js without a
// browser: constants.js, observation-utils.js, and storage.js are loaded into a
// node:vm context with an in-memory chrome.storage stub (the same approach as
// verify-f1a-main-hook-simulator.mjs). No npm dependencies; always terminates.
//
// It verifies that upsertSyncedEntries merges the user's own block/mute list with
// user_id-primary / handle-fallback dedupe, that handle-only entries are upgraded
// in place once a user_id appears, that synthetic test data is never disturbed by
// sync, and that clearSyncedEntries removes only synced entries.

import { readFile } from "node:fs/promises";
import { Script, createContext } from "node:vm";

const root = new URL("../../", import.meta.url);

async function readText(path) {
  return readFile(new URL(path, root), "utf8");
}

const failures = [];
const SUITE_TIMEOUT_MS = 20_000;
// 未解決 Promise だけでは Node の event loop を保持しないため、ref 付き watchdog で
// standalone 実行も false-green / 無期限待機のどちらにもならないようにする。
const suiteWatchdog = setTimeout(() => {
  console.error(`\nStorage sync schema verification TIMEOUT after ${SUITE_TIMEOUT_MS} ms`);
  process.exit(1);
}, SUITE_TIMEOUT_MS);

function check(condition, label, detail) {
  if (condition) {
    console.log(`  PASS  ${label}`);
  } else {
    failures.push(label);
    console.log(`  FAIL  ${label}${detail !== undefined ? ` -> ${JSON.stringify(detail)}` : ""}`);
  }
}

// In-memory chrome.storage stub (synchronous callbacks, like the fixture).
const stores = { local: {}, sync: {} };
function area(name) {
  return {
    get(key, callback) {
      if (key === null) {
        callback(cloneStored(stores[name]));
        return;
      }
      callback({ [key]: stores[name][key] });
    },
    set(next, callback) {
      for (const [key, value] of Object.entries(next)) {
        stores[name][key] = value;
      }
      callback();
    },
    remove(keyOrKeys, callback) {
      for (const key of Array.isArray(keyOrKeys) ? keyOrKeys : [keyOrKeys]) {
        delete stores[name][key];
      }
      callback();
    }
  };
}
const chrome = {
  runtime: { lastError: null },
  storage: { local: area("local"), sync: area("sync") }
};

const context = createContext({ console, Date, URL, chrome });
context.globalThis = context;

for (const file of [
  "src/shared/constants.js",
  "src/research/f1-a/observation-utils.js",
  "src/storage/storage.js"
]) {
  new Script(await readText(file), { filename: file }).runInContext(context);
}

const { Storage, SYNC_SOURCE, SYNTHETIC_SOURCE } = context.XTrueBlockMute;

function findByUserId(entries, userId) {
  return entries.find((entry) => entry.user_id === userId);
}
function findByHandle(entries, handle) {
  return entries.find((entry) => entry.handle === handle);
}
function countBySource(entries, source) {
  return entries.filter((entry) => entry.source === source).length;
}

function cloneStored(value) {
  return value === undefined ? undefined : JSON.parse(JSON.stringify(value));
}

async function withTimeout(promise, label, timeoutMs = 1500) {
  let timer;
  try {
    return await Promise.race([
      promise,
      new Promise((_, reject) => {
        timer = setTimeout(() => reject(new Error(`timeout waiting for ${label}`)), timeoutMs);
      })
    ]);
  } finally {
    clearTimeout(timer);
  }
}

function createGate(label) {
  let reachedResolve;
  let releaseResolve;
  return {
    label,
    reached: new Promise((resolve) => {
      reachedResolve = resolve;
    }),
    released: new Promise((resolve) => {
      releaseResolve = resolve;
    }),
    hit(detail) {
      reachedResolve(detail);
      return this.released;
    },
    release() {
      releaseResolve();
    }
  };
}

async function loadStorageContext(actor, actorChrome) {
  const actorContext = createContext({ console, Date, URL, chrome: actorChrome });
  actorContext.globalThis = actorContext;
  for (const file of ["src/shared/constants.js", "src/storage/storage.js"]) {
    new Script(await readText(file), { filename: `${actor}:${file}` }).runInContext(actorContext);
  }
  return actorContext.XTrueBlockMute.Storage;
}

async function verifyLegacyStorageMigration() {
  const legacyStores = {
    local: {
      xtbmEntries: {
        schemaVersion: 1,
        entries: [
          {
            user_id: "legacy-sync",
            handle: "legacy_sync",
            source: SYNC_SOURCE,
            listKind: "blocked"
          },
          {
            user_id: "legacy-synthetic",
            handle: "legacy_synthetic",
            source: SYNTHETIC_SOURCE
          },
          {
            user_id: "legacy-manual",
            handle: "legacy_manual",
            source: "manual"
          }
        ],
        lastSyntheticUpdatedAt: "2026-07-01T00:00:00.000Z"
      },
      xtbmSyncState: {
        schemaVersion: 1,
        enabled: true,
        lastSyncedAt: "2026-07-01T01:00:00.000Z"
      }
    },
    sync: {}
  };

  function legacyArea(name) {
    return {
      get(key, callback) {
        if (key === null) {
          callback(cloneStored(legacyStores[name]));
          return;
        }
        callback({ [key]: cloneStored(legacyStores[name][key]) });
      },
      set(next, callback) {
        Object.assign(legacyStores[name], cloneStored(next));
        callback();
      },
      remove(keyOrKeys, callback) {
        for (const key of Array.isArray(keyOrKeys) ? keyOrKeys : [keyOrKeys]) {
          delete legacyStores[name][key];
        }
        callback();
      }
    };
  }

  const legacyStorage = await loadStorageContext("legacy", {
    runtime: { lastError: null },
    storage: {
      local: legacyArea("local"),
      sync: legacyArea("sync")
    }
  });

  let store = await withTimeout(legacyStorage.getEntryStore(), "legacy pre-migration read");
  check(
    findByUserId(store.entries, "legacy-sync")?.source === SYNC_SOURCE,
    "legacy xtbmEntries sync rows remain readable before the first mutation"
  );
  let state = await withTimeout(legacyStorage.getSyncState(), "legacy sync-state read");
  check(
    state.enabled === true && state.lastSyncedAt === "2026-07-01T01:00:00.000Z",
    "legacy xtbmSyncState remains a read fallback",
    state
  );

  await withTimeout(
    legacyStorage.upsertSyncedEntries([
      { user_id: "migrated-new", handle: "migrated_new", listKind: "muted" }
    ]),
    "legacy migration upsert"
  );
  const generation = legacyStores.local.xtbmSyncGeneration?.generation || "initial";
  store = await withTimeout(legacyStorage.getEntryStore(), "legacy post-migration read");
  check(
    legacyStores.local.xtbmSyncMigrated === true &&
      findByUserId(store.entries, "legacy-sync")?.source === SYNC_SOURCE &&
      findByUserId(store.entries, "migrated-new")?.source === SYNC_SOURCE,
    "the first sync mutation moves legacy rows into the active generation"
  );
  check(
    legacyStores.local.xtbmEntries === undefined &&
      countBySource(
        legacyStores.local.xtbmLegacySyntheticEntries?.entries || [],
        SYNTHETIC_SOURCE
      ) === 1 &&
      findByUserId(store.entries, "legacy-synthetic")?.source === SYNTHETIC_SOURCE &&
      findByUserId(
        legacyStores.local.xtbmBaseEntries?.entries || [],
        "legacy-manual"
      )?.source === "manual" &&
      findByUserId(store.entries, "legacy-manual")?.source === "manual" &&
      countBySource(
        legacyStores.local[`xtbmSyncEntries:${generation}`]?.entries || [],
        SYNC_SOURCE
      ) === 2,
    "legacy migration removes the retired whole key after separating synthetic and sync rows"
  );

  await withTimeout(legacyStorage.setSyncEnabled(false), "legacy state disable");
  await withTimeout(
    legacyStorage.markSynced("2026-07-02T00:00:00.000Z"),
    "legacy state timestamp"
  );
  state = await withTimeout(legacyStorage.getSyncState(), "migrated sync-state read");
  check(
    state.enabled === false && state.lastSyncedAt === "2026-07-02T00:00:00.000Z",
    "field-separated sync state overrides the legacy fallback after migration",
    state
  );
}

async function verifyLegacyClearPreservesNonSyncDomains() {
  const legacyStores = {
    local: {
      xtbmEntries: {
        schemaVersion: 1,
        entries: [
          {
            user_id: "clear-legacy-sync",
            handle: "clear_legacy_sync",
            source: SYNC_SOURCE,
            listKind: "muted"
          },
          {
            user_id: "clear-legacy-synthetic",
            handle: "clear_legacy_synthetic",
            source: SYNTHETIC_SOURCE
          },
          {
            user_id: "clear-legacy-manual",
            handle: "clear_legacy_manual",
            source: "manual"
          }
        ],
        lastSyntheticUpdatedAt: "2026-07-01T02:00:00.000Z"
      }
    },
    sync: {}
  };

  function legacyArea(name) {
    return {
      get(key, callback) {
        if (key === null) {
          callback(cloneStored(legacyStores[name]));
          return;
        }
        callback({ [key]: cloneStored(legacyStores[name][key]) });
      },
      set(next, callback) {
        Object.assign(legacyStores[name], cloneStored(next));
        callback();
      },
      remove(keyOrKeys, callback) {
        for (const key of Array.isArray(keyOrKeys) ? keyOrKeys : [keyOrKeys]) {
          delete legacyStores[name][key];
        }
        callback();
      }
    };
  }

  const legacyStorage = await loadStorageContext("legacy-clear", {
    runtime: { lastError: null },
    storage: {
      local: legacyArea("local"),
      sync: legacyArea("sync")
    }
  });
  await withTimeout(
    legacyStorage.clearSyncedEntries(),
    "legacy clear with domain migration"
  );
  const store = await withTimeout(
    legacyStorage.getEntryStore(),
    "legacy clear final read"
  );
  check(
    !findByUserId(store.entries, "clear-legacy-sync") &&
      findByUserId(store.entries, "clear-legacy-synthetic")?.source === SYNTHETIC_SOURCE &&
      findByUserId(store.entries, "clear-legacy-manual")?.source === "manual" &&
      legacyStores.local.xtbmEntries === undefined &&
      legacyStores.local.xtbmSyncMigrated === true,
    "clear migrates legacy non-sync domains before deleting legacy production rows",
    { entries: store.entries, rawKeys: Object.keys(legacyStores.local) }
  );
}

// popup と settings page は別 JavaScript context なので、同一 object の
// read-modify-write は context-local lane では守れない。旧/新双方の state key 書込みを
// 指定順に固定し、field 別 top-level key なら両更新が独立に残ることを確認する。
async function verifyCrossContextSyncStateConcurrency() {
  const sharedStores = { local: {}, sync: {} };
  const queuedStateWrites = [];
  let stateWriteOrder = ["popup", "bridge"];
  let queueStateWrites = false;

  function sharedArea(name, actor) {
    return {
      get(key, callback) {
        Promise.resolve().then(() => {
          if (key === null) {
            callback(cloneStored(sharedStores[name]));
            return;
          }
          callback({ [key]: cloneStored(sharedStores[name][key]) });
        });
      },
      set(next, callback) {
        Promise.resolve().then(() => {
          const stateKeys = [
            "xtbmSyncState",
            "xtbmSyncEnabled",
            "xtbmSyncLastSyncedAt"
          ];
          if (queueStateWrites && stateKeys.some((key) => Object.hasOwn(next, key))) {
            queuedStateWrites.push({ actor, next, callback });
            if (queuedStateWrites.length === 2) {
              const batch = queuedStateWrites.splice(0, 2);
              for (const expectedActor of stateWriteOrder) {
                const operation = batch.find((item) => item.actor === expectedActor);
                if (!operation) {
                  throw new Error(`missing queued legacy write for ${expectedActor}`);
                }
                Object.assign(sharedStores[name], cloneStored(operation.next));
                operation.callback();
              }
            }
            return;
          }
          Object.assign(sharedStores[name], cloneStored(next));
          callback();
        });
      },
      remove(keyOrKeys, callback) {
        Promise.resolve().then(() => {
          for (const key of Array.isArray(keyOrKeys) ? keyOrKeys : [keyOrKeys]) {
            delete sharedStores[name][key];
          }
          callback();
        });
      }
    };
  }

  async function load(actor) {
    const actorChrome = {
      runtime: { lastError: null },
      storage: {
        local: sharedArea("local", actor),
        sync: sharedArea("sync", actor)
      }
    };
    return loadStorageContext(actor, actorChrome);
  }

  const popupStorage = await load("popup");
  const bridgeStorage = await load("bridge");
  await withTimeout(popupStorage.setSyncEnabled(true), "state-order setup");
  queueStateWrites = true;
  await withTimeout(
    Promise.all([
      bridgeStorage.markSynced("2026-07-05T00:00:00.000Z"),
      popupStorage.setSyncEnabled(false)
    ]),
    "cross-context sync-state writes"
  );

  const state = await withTimeout(popupStorage.getSyncState(), "state-order final read");
  check(state.enabled === false, "cross-context markSynced does not resurrect the disabled toggle", state);
  check(
    state.lastSyncedAt === "2026-07-05T00:00:00.000Z",
    "cross-context setSyncEnabled does not drop lastSyncedAt",
    state
  );
  check(
    sharedStores.local.xtbmSyncEnabled === false &&
      sharedStores.local.xtbmSyncLastSyncedAt === "2026-07-05T00:00:00.000Z",
    "sync-state writers persist separate top-level keys",
    sharedStores.local
  );

  // 逆順では旧 full-object 実装が新しい lastSyncedAt を落とす。field 分離なら
  // enabled と timestamp のどちらを最後に書いても両方が残る。
  queueStateWrites = false;
  await withTimeout(popupStorage.setSyncEnabled(true), "reverse-state setup");
  queueStateWrites = true;
  stateWriteOrder = ["bridge", "popup"];
  await withTimeout(
    Promise.all([
      bridgeStorage.markSynced("2026-07-06T00:00:00.000Z"),
      popupStorage.setSyncEnabled(false)
    ]),
    "reverse cross-context sync-state writes"
  );
  const reverseState = await withTimeout(
    popupStorage.getSyncState(),
    "reverse-state final read"
  );
  check(
    reverseState.enabled === false &&
      reverseState.lastSyncedAt === "2026-07-06T00:00:00.000Z",
    "reverse write order preserves both disabled state and the newest timestamp",
    reverseState
  );
}

// old upsert の shard write と世代再確認を別々に停止する。clear 後に old write を
// 戻し、その検査前に第三 context の fresh write を成功させても、old cleanup は
// 旧世代 shard だけを空にして fresh shard を保持しなければならない。
async function verifyCrossContextSyncedClearWins() {
  const sharedStores = { local: {}, sync: {} };
  let oldSetGate = null;
  let oldGenerationGetGate = null;

  function sharedArea(name, actor) {
    return {
      get(key, callback) {
        Promise.resolve().then(async () => {
          if (key === null) {
            callback(cloneStored(sharedStores[name]));
            return;
          }
          if (actor === "old" && key === "xtbmSyncGeneration" && oldGenerationGetGate) {
            const gate = oldGenerationGetGate;
            oldGenerationGetGate = null;
            await gate.hit(key);
          }
          callback({ [key]: cloneStored(sharedStores[name][key]) });
        });
      },
      set(next, callback) {
        Promise.resolve().then(async () => {
          const [key] = Object.keys(next);
          if (
            actor === "old" &&
            key.startsWith("xtbmSyncEntries:") &&
            oldSetGate
          ) {
            const gate = oldSetGate;
            oldSetGate = null;
            await gate.hit(key);
          }
          Object.assign(sharedStores[name], cloneStored(next));
          callback();
        });
      },
      remove(keyOrKeys, callback) {
        Promise.resolve().then(() => {
          for (const key of Array.isArray(keyOrKeys) ? keyOrKeys : [keyOrKeys]) {
            delete sharedStores[name][key];
          }
          callback();
        });
      }
    };
  }

  async function load(actor) {
    const actorChrome = {
      runtime: { lastError: null },
      storage: {
        local: sharedArea("local", actor),
        sync: sharedArea("sync", actor)
      }
    };
    return loadStorageContext(actor, actorChrome);
  }

  const popupStorage = await load("popup");
  const oldStorage = await load("old");
  const freshStorage = await load("fresh");

  await withTimeout(
    oldStorage.upsertSyncedEntries([
      { user_id: "cross-context-old", handle: "cross_context_old", listKind: "blocked" }
    ]),
    "cross-context setup upsert"
  );
  const oldGeneration = sharedStores.local.xtbmSyncGeneration?.generation || "initial";

  const pausedOldSet = createGate("old shard set");
  oldSetGate = pausedOldSet;
  const inFlightUpsert = oldStorage.upsertSyncedEntries([
    { user_id: "cross-context-stale", handle: "cross_context_stale", listKind: "blocked" }
  ]);
  await withTimeout(pausedOldSet.reached, pausedOldSet.label);

  await withTimeout(popupStorage.clearSyncedEntries(), "cross-context popup clear");
  const freshGeneration = sharedStores.local.xtbmSyncGeneration.generation;
  check(oldGeneration !== freshGeneration, "clear advances the active sync generation");

  const pausedOldGenerationGet = createGate("old generation recheck");
  oldGenerationGetGate = pausedOldGenerationGet;
  pausedOldSet.release();
  await withTimeout(pausedOldGenerationGet.reached, pausedOldGenerationGet.label);

  await withTimeout(
    freshStorage.upsertSyncedEntries([
      { user_id: "cross-context-fresh", handle: "cross_context_fresh", listKind: "blocked" }
    ]),
    "cross-context fresh upsert"
  );
  let store = await withTimeout(
    popupStorage.getEntryStore(),
    "cross-context pre-cleanup read"
  );
  check(
    findByUserId(store.entries, "cross-context-fresh")?.source === SYNC_SOURCE,
    "a fresh post-clear write is visible before stale cleanup",
    store.entries
  );

  pausedOldGenerationGet.release();
  let inFlightError = null;
  try {
    await withTimeout(inFlightUpsert, "superseded old upsert");
  } catch (error) {
    inFlightError = error;
  }
  check(
    inFlightError?.message === "sync entry write was superseded by a concurrent clear",
    "the superseded settings upsert rejects before sync state can be marked",
    inFlightError?.message
  );

  store = await withTimeout(
    popupStorage.getEntryStore(),
    "cross-context final read"
  );
  check(
    !findByUserId(store.entries, "cross-context-stale") &&
      findByUserId(store.entries, "cross-context-fresh")?.source === SYNC_SOURCE,
    "stale cleanup removes only the retired shard and preserves the fresh shard",
    store.entries
  );
  check(
    countBySource(
      sharedStores.local[`xtbmSyncEntries:${oldGeneration}`]?.entries || [],
      SYNC_SOURCE
    ) === 0,
    "the retired raw shard is empty after the stale writer finishes",
    sharedStores.local[`xtbmSyncEntries:${oldGeneration}`]
  );
}

// shard 保存後の最初の世代検査を通過しても、legacy cleanup 中に clear が入れば
// old operation は成功扱いにならない。bridge が後続の markSynced を実行しないよう
// 最終世代検査で reject する窓を、独立 context と停止可能な whole-key remove で固定する。
async function verifyClearDuringLegacyScrubRejectsStaleWrite() {
  const sharedStores = {
    local: {
      xtbmEntries: {
        schemaVersion: 1,
        entries: [
          {
            user_id: "post-commit-legacy",
            handle: "post_commit_legacy",
            source: SYNC_SOURCE,
            listKind: "blocked"
          }
        ],
        lastSyntheticUpdatedAt: null
      },
      xtbmSyncGeneration: { generation: "stable-generation" },
      xtbmSyncMigrated: true,
      "xtbmSyncEntries:stable-generation": {
        schemaVersion: 1,
        entries: [],
        lastSyntheticUpdatedAt: null
      }
    },
    sync: {}
  };
  let oldScrubGate = null;

  function sharedArea(name, actor) {
    return {
      get(key, callback) {
        Promise.resolve().then(() => {
          if (key === null) {
            callback(cloneStored(sharedStores[name]));
            return;
          }
          callback({ [key]: cloneStored(sharedStores[name][key]) });
        });
      },
      set(next, callback) {
        Promise.resolve().then(() => {
          Object.assign(sharedStores[name], cloneStored(next));
          callback();
        });
      },
      remove(keyOrKeys, callback) {
        Promise.resolve().then(async () => {
          const keys = Array.isArray(keyOrKeys) ? keyOrKeys : [keyOrKeys];
          if (actor === "old" && keys.includes("xtbmEntries") && oldScrubGate) {
            const gate = oldScrubGate;
            oldScrubGate = null;
            await gate.hit("remove:xtbmEntries");
          }
          for (const key of keys) {
            delete sharedStores[name][key];
          }
          callback();
        });
      }
    };
  }

  async function load(actor) {
    return loadStorageContext(actor, {
      runtime: { lastError: null },
      storage: {
        local: sharedArea("local", actor),
        sync: sharedArea("sync", actor)
      }
    });
  }

  const oldStorage = await load("old");
  const popupStorage = await load("popup");
  const pausedLegacyScrub = createGate("old legacy whole-key cleanup");
  oldScrubGate = pausedLegacyScrub;
  const inFlightUpsert = oldStorage.upsertSyncedEntries([
    { user_id: "post-commit-stale", handle: "post_commit_stale", listKind: "blocked" }
  ]);
  await withTimeout(pausedLegacyScrub.reached, pausedLegacyScrub.label);

  await withTimeout(
    popupStorage.clearSyncedEntries(),
    "post-first-assert popup clear"
  );
  pausedLegacyScrub.release();
  let inFlightError = null;
  try {
    await withTimeout(inFlightUpsert, "post-assert stale upsert");
  } catch (error) {
    inFlightError = error;
  }

  const store = await withTimeout(
    popupStorage.getEntryStore(),
    "post-first-assert final read"
  );
  check(
    inFlightError?.message === "sync entry write was superseded by a concurrent clear" &&
      !findByUserId(store.entries, "post-commit-stale"),
    "a clear during legacy cleanup rejects the stale upsert after its first generation check",
    { error: inFlightError?.message, entries: store.entries }
  );
}

// clear A の prefix snapshot を停止し、clear B と G2 fresh upsert を先に完了する。
// A は snapshot 後に live pointer を読むため、G2 key を cleanup 対象へ含めてはならない。
async function verifyConcurrentClearsPreserveLatestShard() {
  const sharedStores = { local: {}, sync: {} };
  let clearAGetAllGate = null;

  function sharedArea(name, actor) {
    return {
      get(key, callback) {
        Promise.resolve().then(async () => {
          if (key === null) {
            if (actor === "clear-a" && clearAGetAllGate) {
              const gate = clearAGetAllGate;
              clearAGetAllGate = null;
              await gate.hit(key);
            }
            callback(cloneStored(sharedStores[name]));
            return;
          }
          callback({ [key]: cloneStored(sharedStores[name][key]) });
        });
      },
      set(next, callback) {
        Promise.resolve().then(() => {
          Object.assign(sharedStores[name], cloneStored(next));
          callback();
        });
      },
      remove(keyOrKeys, callback) {
        Promise.resolve().then(() => {
          for (const key of Array.isArray(keyOrKeys) ? keyOrKeys : [keyOrKeys]) {
            delete sharedStores[name][key];
          }
          callback();
        });
      }
    };
  }

  async function load(actor) {
    return loadStorageContext(actor, {
      runtime: { lastError: null },
      storage: {
        local: sharedArea("local", actor),
        sync: sharedArea("sync", actor)
      }
    });
  }

  const setupStorage = await load("setup");
  const clearAStorage = await load("clear-a");
  const clearBStorage = await load("clear-b");
  const freshStorage = await load("fresh-after-clear-b");
  await withTimeout(
    setupStorage.upsertSyncedEntries([
      { user_id: "double-clear-old", handle: "double_clear_old", listKind: "blocked" }
    ]),
    "concurrent-clear setup upsert"
  );

  const pausedGetAll = createGate("clear A prefix snapshot");
  clearAGetAllGate = pausedGetAll;
  const clearA = clearAStorage.clearSyncedEntries();
  await withTimeout(pausedGetAll.reached, pausedGetAll.label);

  await withTimeout(clearBStorage.clearSyncedEntries(), "newer clear completion");
  const latestGeneration = sharedStores.local.xtbmSyncGeneration.generation;
  await withTimeout(
    freshStorage.upsertSyncedEntries([
      { user_id: "double-clear-fresh", handle: "double_clear_fresh", listKind: "blocked" }
    ]),
    "newest generation fresh upsert"
  );
  pausedGetAll.release();
  await withTimeout(clearA, "older clear completion");

  const store = await withTimeout(
    setupStorage.getEntryStore(),
    "concurrent-clear final read"
  );
  check(
    sharedStores.local.xtbmSyncGeneration.generation === latestGeneration &&
      findByUserId(store.entries, "double-clear-fresh")?.source === SYNC_SOURCE,
    "an older clear sweep preserves the latest generation and its fresh write",
    store.entries
  );
  check(
    findByUserId(
      sharedStores.local[`xtbmSyncEntries:${latestGeneration}`]?.entries || [],
      "double-clear-fresh"
    )?.source === SYNC_SOURCE,
    "the latest generation remains present in raw storage after the older sweep"
  );
}

// 初回 migration は shard 保存が成功するまで commit flag を公開しない。
// 合成 set failure 後も legacy 行が可視で、同じ process 内の再試行で移送できる。
async function verifyLegacyMigrationFailureRecovery() {
  const sharedStores = {
    local: {
      xtbmEntries: {
        schemaVersion: 1,
        entries: [
          {
            user_id: "migration-legacy",
            handle: "migration_legacy",
            source: SYNC_SOURCE,
            listKind: "muted"
          }
        ],
        lastSyntheticUpdatedAt: null
      }
    },
    sync: {}
  };
  const runtime = { lastError: null };
  let failInitialShardSet = true;
  let failBaseSet = true;
  let failMigrationCommit = true;

  function failingArea(name) {
    return {
      get(key, callback) {
        Promise.resolve().then(() => {
          if (key === null) {
            callback(cloneStored(sharedStores[name]));
            return;
          }
          callback({ [key]: cloneStored(sharedStores[name][key]) });
        });
      },
      set(next, callback) {
        Promise.resolve().then(() => {
          if (failInitialShardSet && Object.hasOwn(next, "xtbmSyncEntries:initial")) {
            failInitialShardSet = false;
            runtime.lastError = { message: "synthetic initial-shard write failure" };
            callback();
            runtime.lastError = null;
            return;
          }
          if (failBaseSet && Object.hasOwn(next, "xtbmBaseEntries")) {
            failBaseSet = false;
            runtime.lastError = { message: "synthetic base migration failure" };
            callback();
            runtime.lastError = null;
            return;
          }
          if (failMigrationCommit && Object.hasOwn(next, "xtbmSyncMigrated")) {
            failMigrationCommit = false;
            runtime.lastError = { message: "synthetic migration-commit failure" };
            callback();
            runtime.lastError = null;
            return;
          }
          Object.assign(sharedStores[name], cloneStored(next));
          callback();
        });
      },
      remove(keyOrKeys, callback) {
        for (const key of Array.isArray(keyOrKeys) ? keyOrKeys : [keyOrKeys]) {
          delete sharedStores[name][key];
        }
        callback();
      }
    };
  }

  const migrationStorage = await loadStorageContext("migration-recovery", {
    runtime,
    storage: {
      local: failingArea("local"),
      sync: failingArea("sync")
    }
  });

  let migrationError = null;
  try {
    await withTimeout(
      migrationStorage.upsertSyncedEntries([
        { user_id: "migration-new", handle: "migration_new", listKind: "muted" }
      ]),
      "failing initial-shard migration"
    );
  } catch (error) {
    migrationError = error;
  }
  let store = await withTimeout(
    migrationStorage.getEntryStore(),
    "post-shard-failure legacy read"
  );
  check(
    migrationError?.message === "synthetic initial-shard write failure" &&
      findByUserId(store.entries, "migration-legacy")?.source === SYNC_SOURCE &&
      sharedStores.local.xtbmSyncMigrated !== true,
    "a failed initial shard write leaves legacy rows visible and migration uncommitted",
    store.entries
  );

  let baseError = null;
  try {
    await withTimeout(
      migrationStorage.upsertSyncedEntries([
        { user_id: "migration-new", handle: "migration_new", listKind: "muted" }
      ]),
      "failing base-domain migration"
    );
  } catch (error) {
    baseError = error;
  }
  store = await withTimeout(
    migrationStorage.getEntryStore(),
    "post-base-failure legacy read"
  );
  check(
    baseError?.message === "synthetic base migration failure" &&
      findByUserId(store.entries, "migration-legacy")?.source === SYNC_SOURCE &&
      sharedStores.local.xtbmSyncMigrated !== true,
    "a failed base-domain write leaves legacy rows authoritative and migration uncommitted",
    store.entries
  );

  let commitError = null;
  try {
    await withTimeout(
      migrationStorage.upsertSyncedEntries([
        { user_id: "migration-new", handle: "migration_new", listKind: "muted" }
      ]),
      "failing migration commit"
    );
  } catch (error) {
    commitError = error;
  }
  store = await withTimeout(
    migrationStorage.getEntryStore(),
    "post-commit-failure legacy read"
  );
  check(
    commitError?.message === "synthetic migration-commit failure" &&
      findByUserId(store.entries, "migration-legacy")?.source === SYNC_SOURCE &&
      sharedStores.local.xtbmSyncMigrated !== true,
    "a failed migration commit still leaves the legacy source authoritative",
    store.entries
  );

  await withTimeout(
    migrationStorage.upsertSyncedEntries([
      { user_id: "migration-new", handle: "migration_new", listKind: "muted" }
    ]),
    "migration retry"
  );
  store = await withTimeout(
    migrationStorage.getEntryStore(),
    "post-retry migrated read"
  );
  const migratedLegacyRows = store.entries.filter(
    (entry) => entry.user_id === "migration-legacy"
  );
  const migratedNewRows = store.entries.filter(
    (entry) => entry.user_id === "migration-new"
  );
  check(
    sharedStores.local.xtbmSyncMigrated === true &&
      migratedLegacyRows.length === 1 &&
      migratedLegacyRows[0]?.source === SYNC_SOURCE &&
      migratedNewRows.length === 1 &&
      migratedNewRows[0]?.source === SYNC_SOURCE,
    "retry commits one copy each of the legacy row and new row after migration failure",
    store.entries
  );
}

// synthetic と production sync は別 top-level key を更新する。options の synthetic
// clear/seed と settings upsert/legacy whole-key cleanup を交差させても互いの成功済み行を消さない。
async function verifySyntheticAndSyncDomainsStaySeparated() {
  async function createSharedContexts(initialLocal = {}) {
    const sharedStores = { local: cloneStored(initialLocal), sync: {} };
    let syntheticSetGate = null;
    let legacyScrubGate = null;

    function sharedArea(name, actor) {
      return {
        get(key, callback) {
          Promise.resolve().then(() => {
            if (key === null) {
              callback(cloneStored(sharedStores[name]));
              return;
            }
            callback({ [key]: cloneStored(sharedStores[name][key]) });
          });
        },
        set(next, callback) {
          Promise.resolve().then(async () => {
            const [key] = Object.keys(next);
            if (actor === "options" && key === "xtbmSyntheticEntries" && syntheticSetGate) {
              const gate = syntheticSetGate;
              syntheticSetGate = null;
              await gate.hit(key);
            }
            Object.assign(sharedStores[name], cloneStored(next));
            callback();
          });
        },
        remove(keyOrKeys, callback) {
          Promise.resolve().then(async () => {
            const keys = Array.isArray(keyOrKeys) ? keyOrKeys : [keyOrKeys];
            if (
              actor === "settings" &&
              keys.includes("xtbmEntries") &&
              legacyScrubGate
            ) {
              const gate = legacyScrubGate;
              legacyScrubGate = null;
              await gate.hit("remove:xtbmEntries");
            }
            for (const key of keys) {
              delete sharedStores[name][key];
            }
            callback();
          });
        }
      };
    }

    async function load(actor) {
      return loadStorageContext(actor, {
        runtime: { lastError: null },
        storage: {
          local: sharedArea("local", actor),
          sync: sharedArea("sync", actor)
        }
      });
    }

    return {
      sharedStores,
      load,
      gateSyntheticSet(gate) {
        syntheticSetGate = gate;
      },
      gateLegacyScrub(gate) {
        legacyScrubGate = gate;
      }
    };
  }

  const split = await createSharedContexts();
  const optionsStorage = await split.load("options");
  const settingsStorage = await split.load("settings");
  await withTimeout(optionsStorage.seedSyntheticEntries(), "domain synthetic setup");
  await withTimeout(
    settingsStorage.upsertSyncedEntries([
      { user_id: "domain-old", handle: "domain_old", listKind: "blocked" }
    ]),
    "domain sync setup"
  );

  const pausedSyntheticClear = createGate("synthetic clear write");
  split.gateSyntheticSet(pausedSyntheticClear);
  const syntheticClear = optionsStorage.clearSyntheticEntries();
  await withTimeout(pausedSyntheticClear.reached, pausedSyntheticClear.label);
  await withTimeout(
    settingsStorage.upsertSyncedEntries([
      { user_id: "domain-fresh", handle: "domain_fresh", listKind: "blocked" }
    ]),
    "fresh sync during synthetic clear"
  );
  pausedSyntheticClear.release();
  await withTimeout(syntheticClear, "synthetic clear completion");

  let store = await withTimeout(
    settingsStorage.getEntryStore(),
    "domain separation final read"
  );
  check(
    countBySource(store.entries, SYNTHETIC_SOURCE) === 0 &&
      findByUserId(store.entries, "domain-fresh")?.source === SYNC_SOURCE,
    "synthetic clear cannot overwrite a fresh production sync shard",
    store.entries
  );

  const legacy = await createSharedContexts({
    xtbmEntries: {
      schemaVersion: 1,
      entries: [
        {
          user_id: "domain-legacy",
          handle: "domain_legacy",
          source: SYNC_SOURCE,
          listKind: "muted"
        }
      ],
      lastSyntheticUpdatedAt: null
    }
  });
  const legacySettings = await legacy.load("settings");
  const legacyOptions = await legacy.load("options");
  const pausedLegacyScrub = createGate("legacy whole-key cleanup");
  legacy.gateLegacyScrub(pausedLegacyScrub);
  const migration = legacySettings.upsertSyncedEntries([
    { user_id: "domain-migrated", handle: "domain_migrated", listKind: "muted" }
  ]);
  await withTimeout(pausedLegacyScrub.reached, pausedLegacyScrub.label);
  await withTimeout(
    legacyOptions.seedSyntheticEntries(),
    "synthetic seed during legacy cleanup"
  );
  pausedLegacyScrub.release();
  await withTimeout(migration, "legacy migration completion");

  store = await withTimeout(
    legacySettings.getEntryStore(),
    "legacy cleanup domain read"
  );
  check(
    countBySource(store.entries, SYNTHETIC_SOURCE) === 2 &&
      findByUserId(store.entries, "domain-legacy")?.source === SYNC_SOURCE &&
      findByUserId(store.entries, "domain-migrated")?.source === SYNC_SOURCE,
    "legacy whole-key cleanup cannot erase a concurrently seeded synthetic domain",
    store.entries
  );
}

// legacy cleanup は専用 base / sync shard を一切書き戻さず、旧 single-key 全体を
// remove するだけにする。cleanup 停止中の fresh base + fresh sync を両方残す。
async function verifyLegacyCleanupCannotOverwriteDedicatedDomains() {
  const sharedStores = {
    local: {
      xtbmEntries: {
        schemaVersion: 1,
        entries: [
          {
            user_id: "domain-manual-old",
            handle: "domain_manual_old",
            source: "manual"
          },
          {
            user_id: "domain-sync-old",
            handle: "domain_sync_old",
            source: SYNC_SOURCE,
            listKind: "blocked"
          }
        ],
        lastSyntheticUpdatedAt: null
      }
    },
    sync: {}
  };
  let cleanupGate = null;

  function sharedArea(name, actor) {
    return {
      get(key, callback) {
        Promise.resolve().then(() => {
          if (key === null) {
            callback(cloneStored(sharedStores[name]));
            return;
          }
          callback({ [key]: cloneStored(sharedStores[name][key]) });
        });
      },
      set(next, callback) {
        Promise.resolve().then(async () => {
          if (
            actor === "migration" &&
            Object.hasOwn(next, "xtbmEntries") &&
            cleanupGate
          ) {
            const gate = cleanupGate;
            cleanupGate = null;
            await gate.hit("set:xtbmEntries");
          }
          Object.assign(sharedStores[name], cloneStored(next));
          callback();
        });
      },
      remove(keyOrKeys, callback) {
        Promise.resolve().then(async () => {
          const keys = Array.isArray(keyOrKeys) ? keyOrKeys : [keyOrKeys];
          if (
            actor === "migration" &&
            keys.includes("xtbmEntries") &&
            cleanupGate
          ) {
            const gate = cleanupGate;
            cleanupGate = null;
            await gate.hit("remove:xtbmEntries");
          }
          for (const key of keys) {
            delete sharedStores[name][key];
          }
          callback();
        });
      }
    };
  }

  async function load(actor) {
    return loadStorageContext(actor, {
      runtime: { lastError: null },
      storage: {
        local: sharedArea("local", actor),
        sync: sharedArea("sync", actor)
      }
    });
  }

  const migrationStorage = await load("migration");
  const freshStorage = await load("fresh");
  const manualArea = sharedArea("local", "manual");
  const pausedCleanup = createGate("legacy whole-key cleanup");
  cleanupGate = pausedCleanup;
  const migration = migrationStorage.upsertSyncedEntries([
    { user_id: "domain-sync-migrated", handle: "domain_sync_migrated", listKind: "blocked" }
  ]);
  await withTimeout(pausedCleanup.reached, pausedCleanup.label);

  await withTimeout(
    new Promise((resolve) => {
      manualArea.set({
        xtbmBaseEntries: {
          schemaVersion: 1,
          entries: [
            {
              user_id: "domain-manual-old",
              handle: "domain_manual_old",
              source: "manual"
            },
            {
              user_id: "domain-manual-new",
              handle: "domain_manual_new",
              source: "manual"
            }
          ],
          lastSyntheticUpdatedAt: null
        }
      }, resolve);
    }),
    "fresh dedicated base write"
  );
  await withTimeout(
    freshStorage.upsertSyncedEntries([
      { user_id: "domain-sync-fresh", handle: "domain_sync_fresh", listKind: "muted" }
    ]),
    "fresh sync write during legacy cleanup"
  );
  pausedCleanup.release();
  await withTimeout(migration, "legacy whole-key cleanup completion");

  const store = await withTimeout(
    freshStorage.getEntryStore(),
    "dedicated domains final read"
  );
  check(
    typeof migrationStorage.setEntryStore === "undefined" &&
      findByUserId(store.entries, "domain-manual-old")?.source === "manual" &&
      findByUserId(store.entries, "domain-manual-new")?.source === "manual" &&
      findByUserId(store.entries, "domain-sync-migrated")?.source === SYNC_SOURCE &&
      findByUserId(store.entries, "domain-sync-fresh")?.source === SYNC_SOURCE &&
      sharedStores.local.xtbmEntries === undefined,
    "legacy whole-key cleanup preserves fresh dedicated base and sync domains",
    { entries: store.entries, rawKeys: Object.keys(sharedStores.local) }
  );
}

// clear の marker 更新後に retired shard cleanup が一度失敗しても、新世代の
// upsert は停止しない。次の clear が retired shard を同じ key で再処理できる。
async function verifyClearCleanupRecovery() {
  const sharedStores = { local: {}, sync: {} };
  const runtime = { lastError: null };
  let failCleanupGeneration = null;

  function failingArea(name) {
    return {
      get(key, callback) {
        Promise.resolve().then(() => {
          if (key === null) {
            callback(cloneStored(sharedStores[name]));
            return;
          }
          callback({ [key]: cloneStored(sharedStores[name][key]) });
        });
      },
      set(next, callback) {
        Promise.resolve().then(() => {
          Object.assign(sharedStores[name], cloneStored(next));
          callback();
        });
      },
      remove(keyOrKeys, callback) {
        Promise.resolve().then(() => {
          const keys = Array.isArray(keyOrKeys) ? keyOrKeys : [keyOrKeys];
          if (
            failCleanupGeneration &&
            keys.includes(`xtbmSyncEntries:${failCleanupGeneration}`)
          ) {
            failCleanupGeneration = null;
            runtime.lastError = { message: "synthetic retired-shard cleanup failure" };
            callback();
            runtime.lastError = null;
            return;
          }
          for (const key of keys) {
            delete sharedStores[name][key];
          }
          callback();
        });
      }
    };
  }

  const recoveryStorage = await loadStorageContext("recovery", {
    runtime,
    storage: {
      local: failingArea("local"),
      sync: failingArea("sync")
    }
  });
  await withTimeout(
    recoveryStorage.upsertSyncedEntries([
      { user_id: "cleanup-old", handle: "cleanup_old", listKind: "muted" }
    ]),
    "cleanup-recovery setup upsert"
  );
  const oldGeneration = sharedStores.local.xtbmSyncGeneration?.generation || "initial";
  failCleanupGeneration = oldGeneration;

  let clearError = null;
  try {
    await withTimeout(
      recoveryStorage.clearSyncedEntries(),
      "failing retired-shard cleanup"
    );
  } catch (error) {
    clearError = error;
  }
  check(
    clearError?.message === "synthetic retired-shard cleanup failure",
    "clear reports a transient retired-shard cleanup failure",
    clearError?.message
  );

  await withTimeout(
    recoveryStorage.upsertSyncedEntries([
      { user_id: "cleanup-fresh", handle: "cleanup_fresh", listKind: "muted" }
    ]),
    "post-cleanup-failure fresh upsert"
  );
  let store = await withTimeout(
    recoveryStorage.getEntryStore(),
    "post-cleanup-failure read"
  );
  check(
    findByUserId(store.entries, "cleanup-fresh")?.source === SYNC_SOURCE,
    "a failed retired-shard cleanup does not strand or block the active generation",
    store.entries
  );

  await withTimeout(recoveryStorage.clearSyncedEntries(), "cleanup retry clear");
  store = await withTimeout(
    recoveryStorage.getEntryStore(),
    "post-cleanup-retry read"
  );
  check(
    countBySource(store.entries, SYNC_SOURCE) === 0,
    "a later clear resumes cleanup and removes the active synced entries"
  );
  check(
    countBySource(
      sharedStores.local[`xtbmSyncEntries:${oldGeneration}`]?.entries || [],
      SYNC_SOURCE
    ) === 0,
    "the retry idempotently empties the previously retired raw shard"
  );
}

async function main() {
  // --- baseline -------------------------------------------------------
  let store = await Storage.getEntryStore();
  check(store.entries.length === 0, "fresh entry store is empty", store.entries.length);

  // --- synthetic seed gets the new fields as null (v1 -> v2 migration) -
  await Storage.seedSyntheticEntries();
  store = await Storage.getEntryStore();
  check(store.entries.length === 2, "seedSyntheticEntries adds 2 entries", store.entries.length);
  check(
    store.entries.every((e) => e.listKind === null && e.syncedAt === null),
    "synthetic entries default listKind and syncedAt to null"
  );
  check(countBySource(store.entries, SYNTHETIC_SOURCE) === 2, "synthetic entries keep their source tag");

  // --- first sync batch ----------------------------------------------
  await Storage.upsertSyncedEntries([
    { user_id: "u1", handle: "Alice", listKind: "blocked" },
    { handle: "@Bob", listKind: "muted" }
  ]);
  store = await Storage.getEntryStore();
  check(store.entries.length === 4, "sync adds 2 entries alongside synthetic", store.entries.length);

  const alice = findByUserId(store.entries, "u1");
  check(alice?.source === SYNC_SOURCE, "synced entry carries the f1a-sync source");
  check(alice?.handle === "alice", "handle is normalized to lowercase without @", alice?.handle);
  check(alice?.listKind === "blocked", "blocked listKind is preserved", alice?.listKind);
  check(typeof alice?.syncedAt === "string" && alice.syncedAt.length > 0, "syncedAt is stamped", alice?.syncedAt);

  const bob = findByHandle(store.entries, "bob");
  check(bob?.user_id === null && bob?.listKind === "muted", "handle-only muted entry is stored", bob);

  // --- dedupe by user_id: re-sync u1 with a renamed handle ------------
  await Storage.upsertSyncedEntries([{ user_id: "u1", handle: "alice_renamed", listKind: "blocked" }]);
  store = await Storage.getEntryStore();
  check(store.entries.length === 4, "re-syncing an existing user_id does not duplicate", store.entries.length);
  check(findByUserId(store.entries, "u1")?.handle === "alice_renamed", "handle change is applied in place");

  // --- handle-only entry is upgraded when a user_id appears -----------
  await Storage.upsertSyncedEntries([{ user_id: "u2", handle: "bob", listKind: "muted" }]);
  store = await Storage.getEntryStore();
  check(store.entries.length === 4, "handle-only entry upgrades in place, not duplicated", store.entries.length);
  check(findByHandle(store.entries, "bob")?.user_id === "u2", "bob is upgraded with a user_id");

  // --- same account can exist independently in blocked and muted ------
  await Storage.upsertSyncedEntries([{ user_id: "u_dual", handle: "dual", listKind: "muted" }]);
  await Storage.upsertSyncedEntries([{ user_id: "u_dual", handle: "dual", listKind: "blocked" }]);
  store = await Storage.getEntryStore();
  const dualEntries = store.entries.filter(
    (entry) => entry.source === SYNC_SOURCE && entry.user_id === "u_dual" && entry.handle === "dual"
  );
  check(dualEntries.length === 2, "same user_id+handle can be stored once per listKind", dualEntries);
  check(
    dualEntries.filter((entry) => entry.listKind === "blocked").length === 1,
    "same account has one blocked synced entry"
  );
  check(
    dualEntries.filter((entry) => entry.listKind === "muted").length === 1,
    "same account has one muted synced entry"
  );

  // --- invalid listKind is rejected ----------------------------------
  await Storage.upsertSyncedEntries([{ user_id: "u3", handle: "carol", listKind: "garbage" }]);
  store = await Storage.getEntryStore();
  check(findByUserId(store.entries, "u3")?.listKind === null, "unknown listKind normalizes to null");

  // --- empty / malformed incoming entries are skipped ----------------
  const before = (await Storage.getEntryStore()).entries.length;
  await Storage.upsertSyncedEntries([{}, { user_id: "", handle: "" }, null]);
  store = await Storage.getEntryStore();
  check(store.entries.length === before, "malformed sync entries are skipped", store.entries.length);

  // --- dedupe within a single incoming batch -------------------------
  await Storage.upsertSyncedEntries([
    { user_id: "u9", handle: "dup" },
    { user_id: "u9", handle: "dup_final" }
  ]);
  store = await Storage.getEntryStore();
  check(
    store.entries.filter((e) => e.user_id === "u9").length === 1,
    "duplicate user_id within one batch collapses to one entry"
  );
  check(findByUserId(store.entries, "u9")?.handle === "dup_final", "last value in the batch wins");

  // --- clear synced entries leaves synthetic intact ------------------
  await Storage.clearSyncedEntries();
  store = await Storage.getEntryStore();
  check(countBySource(store.entries, SYNC_SOURCE) === 0, "clearSyncedEntries removes all synced entries");
  check(countBySource(store.entries, SYNTHETIC_SOURCE) === 2, "synthetic entries survive a synced clear");

  // --- sync state ----------------------------------------------------
  let sync = await Storage.getSyncState();
  check(sync.enabled === false && sync.lastSyncedAt === null, "fresh sync state is disabled with no timestamp", sync);
  await Storage.setSyncEnabled(true);
  sync = await Storage.getSyncState();
  check(sync.enabled === true, "setSyncEnabled(true) persists");
  await Storage.markSynced("2026-06-13T10:00:00.000Z");
  sync = await Storage.getSyncState();
  check(sync.lastSyncedAt === "2026-06-13T10:00:00.000Z", "markSynced records lastSyncedAt", sync.lastSyncedAt);
  check(sync.enabled === true, "markSynced preserves enabled");
  await Storage.setSyncEnabled(false);
  sync = await Storage.getSyncState();
  check(sync.enabled === false && sync.lastSyncedAt === "2026-06-13T10:00:00.000Z", "setSyncEnabled(false) preserves lastSyncedAt", sync);

  // --- replace one synced listKind after a complete sync -------------
  await Storage.clearSyncedEntries();
  await Storage.upsertSyncedEntries([
    { user_id: "b1", handle: "blk1", listKind: "blocked" },
    { user_id: "b2", handle: "blk2", listKind: "blocked" },
    { user_id: "m1", handle: "mut1", listKind: "muted" }
  ]);
  store = await Storage.getEntryStore();
  check(countBySource(store.entries, SYNC_SOURCE) === 3, "replace setup adds 3 synced entries");

  await Storage.replaceSyncedListKind("blocked", [
    { user_id: "b1", handle: "blk1", listKind: "blocked" },
    { user_id: "b3", handle: "blk3", listKind: "blocked" }
  ]);
  store = await Storage.getEntryStore();
  check(!findByUserId(store.entries, "b2"), "replaceSyncedListKind drops stale blocked b2");
  check(findByUserId(store.entries, "b1")?.listKind === "blocked", "replaceSyncedListKind retains blocked b1");
  const b3 = findByUserId(store.entries, "b3");
  check(b3?.listKind === "blocked", "replaceSyncedListKind adds fresh blocked b3", b3);
  check(findByUserId(store.entries, "m1")?.listKind === "muted", "replaceSyncedListKind leaves muted m1 untouched");
  check(countBySource(store.entries, SYNTHETIC_SOURCE) === 2, "replaceSyncedListKind preserves synthetic entries");
  check(typeof b3?.syncedAt === "string" && b3.syncedAt.length > 0, "replaceSyncedListKind stamps b3 syncedAt", b3?.syncedAt);

  await Storage.replaceSyncedListKind("muted", []);
  store = await Storage.getEntryStore();
  check(!findByUserId(store.entries, "m1"), "empty complete muted replace removes muted m1");
  check(findByUserId(store.entries, "b1")?.listKind === "blocked", "empty muted replace leaves blocked b1 untouched");

  const beforeInvalidReplace = store.entries.length;
  await Storage.replaceSyncedListKind("garbage", [{ user_id: "z1", handle: "z" }]);
  store = await Storage.getEntryStore();
  check(store.entries.length === beforeInvalidReplace, "invalid replace listKind is a no-op", store.entries.length);
  check(!findByUserId(store.entries, "z1"), "invalid replace listKind does not add incoming z1");

  // --- legacy single-key storage migrates without data loss -----------
  await verifyLegacyStorageMigration();
  await verifyLegacyClearPreservesNonSyncDomains();

  // --- cross-context sync-state writes keep independent fields --------
  await verifyCrossContextSyncStateConcurrency();

  // --- cross-context clear beats stale upsert without deleting fresh ---
  await verifyCrossContextSyncedClearWins();

  // --- clear after the first generation check still rejects stale work -
  await verifyClearDuringLegacyScrubRejectsStaleWrite();

  // --- an older clear sweep cannot delete the latest clear generation --
  await verifyConcurrentClearsPreserveLatestShard();

  // --- failed initial migration stays retryable -----------------------
  await verifyLegacyMigrationFailureRecovery();

  // --- synthetic/base and production-sync domains do not cross-write --
  await verifySyntheticAndSyncDomainsStaySeparated();

  // --- legacy cleanup removes only its retired whole key ---------------
  await verifyLegacyCleanupCannotOverwriteDedicatedDomains();

  // --- transient retired-shard cleanup is recoverable ------------------
  await verifyClearCleanupRecovery();
}

main()
  .then(() => {
    clearTimeout(suiteWatchdog);
    if (failures.length > 0) {
      console.error(`\nStorage sync schema verification FAILED: ${failures.length} check(s) failed`);
      process.exit(1);
    }
    console.log("\nStorage sync schema verification passed");
  })
  .catch((error) => {
    clearTimeout(suiteWatchdog);
    console.error(`\nStorage sync schema verification ERROR: ${error.message}`);
    process.exit(1);
  });
