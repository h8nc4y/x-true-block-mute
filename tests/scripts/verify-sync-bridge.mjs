// verify-sync-bridge.mjs
//
// Offline test for the ISOLATED production sync bridge (src/sync/sync-bridge.js).
// Loads constants + observation-utils + storage + sync-bridge into a node:vm
// context with an in-memory chrome.storage and a fake window, then dispatches
// MAIN-world sync-entries messages and asserts that entries are persisted only
// when sync is enabled. No npm deps; always terminates.

import { readFile } from "node:fs/promises";
import { Script, createContext } from "node:vm";

const root = new URL("../../", import.meta.url);
async function readText(path) {
  return readFile(new URL(path, root), "utf8");
}
function flush() {
  return new Promise((resolve) => setImmediate(resolve));
}
async function flushStorage() {
  await flush();
  await flush();
  await flush();
  await flush();
}

const failures = [];
function check(condition, label, detail) {
  if (condition) {
    console.log(`  PASS  ${label}`);
  } else {
    failures.push(label);
    console.log(`  FAIL  ${label}${detail !== undefined ? ` -> ${JSON.stringify(detail)}` : ""}`);
  }
}

const stores = { local: {}, sync: {} };
function area(name) {
  return {
    get(key, callback) {
      Promise.resolve().then(() => callback({ [key]: stores[name][key] }));
    },
    set(next, callback) {
      Promise.resolve().then(() => {
        for (const [key, value] of Object.entries(next)) stores[name][key] = value;
        callback();
      });
    }
  };
}
const chrome = { runtime: { lastError: null }, storage: { local: area("local"), sync: area("sync") } };

const messageListeners = [];
const windowObject = {
  addEventListener(type, listener) {
    if (type === "message") messageListeners.push(listener);
  }
};
function dispatchMessage(data) {
  const event = { data, source: windowObject };
  for (const listener of messageListeners) listener(event);
}

const context = createContext({ console, Date, URL, chrome, window: windowObject });
context.globalThis = context;
for (const file of [
  "src/shared/constants.js",
  "src/research/f1-a/observation-utils.js",
  "src/storage/storage.js",
  "src/sync/sync-bridge.js"
]) {
  new Script(await readText(file), { filename: file }).runInContext(context);
}
const { Storage, SYNC_MESSAGE_SOURCE } = context.XTrueBlockMute;

const blockedEntries = [
  { user_id: "9000000000000000001", handle: "synthetic_blocked_a", listKind: "blocked" },
  { user_id: "9000000000000000002", handle: "synthetic_blocked_b", listKind: "blocked" }
];
const mutedEntry = { user_id: "8000000000000000001", handle: "synthetic_muted_a", listKind: "muted" };
const concurrentBlockedA = { user_id: "9000000000000000101", handle: "synthetic_blocked_concurrent_a", listKind: "blocked" };
const concurrentBlockedB = { user_id: "9000000000000000102", handle: "synthetic_blocked_concurrent_b", listKind: "blocked" };

async function main() {
  // sync-complete with empty staging is a safety no-op: never wipe an existing list
  await Storage.setSyncEnabled(true);
  await Storage.upsertSyncedEntries([
    { user_id: "7000000000000000001", handle: "preexisting_muted", listKind: "muted" }
  ]);
  let store = await Storage.getEntryStore();
  const beforeSafetyCount = store.entries.length;
  dispatchMessage({ source: SYNC_MESSAGE_SOURCE, kind: "sync-complete", listKind: "muted" });
  await flushStorage();
  store = await Storage.getEntryStore();
  check(store.entries.length === beforeSafetyCount, "empty staging completion does not change entry count", store.entries.length);
  check(
    store.entries.some((e) => e.user_id === "7000000000000000001" && e.listKind === "muted"),
    "empty staging completion keeps pre-existing muted entry"
  );
  await Storage.clearSyncedEntries();
  await Storage.setSyncEnabled(false);

  // sync disabled: messages are ignored
  dispatchMessage({ source: SYNC_MESSAGE_SOURCE, kind: "sync-entries", listKind: "blocked", entries: blockedEntries });
  await flushStorage();
  store = await Storage.getEntryStore();
  check(store.entries.length === 0, "sync disabled: nothing persisted", store.entries.length);

  // wrong source / kind ignored even when enabled
  await Storage.setSyncEnabled(true);
  dispatchMessage({ source: "someone-else", kind: "sync-entries", listKind: "blocked", entries: blockedEntries });
  dispatchMessage({ source: SYNC_MESSAGE_SOURCE, kind: "not-sync", entries: blockedEntries });
  await flushStorage();
  store = await Storage.getEntryStore();
  check(store.entries.length === 0, "foreign source / wrong kind ignored", store.entries.length);

  // sync enabled, correct message: entries persisted + lastSyncedAt set
  dispatchMessage({ source: SYNC_MESSAGE_SOURCE, kind: "sync-entries", listKind: "blocked", entries: blockedEntries });
  await flushStorage();
  store = await Storage.getEntryStore();
  check(store.entries.length === 2, "sync enabled: 2 entries persisted", store.entries.length);
  check(store.entries.every((e) => e.source === "f1a-sync" && e.listKind === "blocked"), "persisted entries tagged f1a-sync / blocked");
  const sync = await Storage.getSyncState();
  check(typeof sync.lastSyncedAt === "string", "lastSyncedAt recorded after a successful sync", sync.lastSyncedAt);

  // back-to-back async writes for the same listKind must not clobber each other
  dispatchMessage({ source: SYNC_MESSAGE_SOURCE, kind: "sync-entries", listKind: "blocked", entries: [concurrentBlockedA] });
  dispatchMessage({ source: SYNC_MESSAGE_SOURCE, kind: "sync-entries", listKind: "blocked", entries: [concurrentBlockedB] });
  await flushStorage();
  store = await Storage.getEntryStore();
  check(
    store.entries.some((e) => e.user_id === concurrentBlockedA.user_id) &&
      store.entries.some((e) => e.user_id === concurrentBlockedB.user_id),
    "back-to-back same-listKind sync-entries writes preserve both entries"
  );

  // a second message with a muted entry upserts alongside (additive)
  dispatchMessage({
    source: SYNC_MESSAGE_SOURCE,
    kind: "sync-entries",
    listKind: "muted",
    entries: [mutedEntry]
  });
  await flushStorage();
  store = await Storage.getEntryStore();
  check(store.entries.length === 5, "second list message upserts additively", store.entries.length);

  // full-list completion reconciles a staged listKind, removing stale synced rows only for that list
  await Storage.upsertSyncedEntries([
    { user_id: "9000000000000000003", handle: "synthetic_blocked_c", listKind: "blocked" }
  ]);
  store = await Storage.getEntryStore();
  check(
    store.entries.some((e) => e.user_id === "9000000000000000003"),
    "reconciliation precondition: stale blocked C is present"
  );
  dispatchMessage({ source: SYNC_MESSAGE_SOURCE, kind: "sync-entries", listKind: "blocked", entries: blockedEntries });
  await flushStorage();
  dispatchMessage({ source: SYNC_MESSAGE_SOURCE, kind: "sync-complete", listKind: "blocked" });
  await flushStorage();
  store = await Storage.getEntryStore();
  check(!store.entries.some((e) => e.user_id === "9000000000000000003"), "reconciliation removes stale blocked C");
  check(
    blockedEntries.every((expected) => store.entries.some((e) => e.user_id === expected.user_id && e.listKind === "blocked")),
    "reconciliation retains staged blocked A and B"
  );
  check(
    store.entries.some((e) => e.user_id === mutedEntry.user_id && e.listKind === "muted"),
    "reconciliation leaves muted entries untouched"
  );
}

main()
  .then(() => {
    if (failures.length > 0) {
      console.error(`\nSync bridge verification FAILED: ${failures.length} check(s) failed`);
      process.exit(1);
    }
    console.log("\nSync bridge verification passed");
  })
  .catch((error) => {
    console.error(`\nSync bridge verification ERROR: ${error.message}`);
    process.exit(1);
  });
