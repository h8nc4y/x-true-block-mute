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
      callback({ [key]: stores[name][key] });
    },
    set(next, callback) {
      for (const [key, value] of Object.entries(next)) {
        stores[name][key] = value;
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
}

main()
  .then(() => {
    if (failures.length > 0) {
      console.error(`\nStorage sync schema verification FAILED: ${failures.length} check(s) failed`);
      process.exit(1);
    }
    console.log("\nStorage sync schema verification passed");
  })
  .catch((error) => {
    console.error(`\nStorage sync schema verification ERROR: ${error.message}`);
    process.exit(1);
  });
