// verify-sync-extraction.mjs
//
// Offline test for the M4 production sync capture extractor
// (src/sync/sync-capture.js). Loads the MAIN-world-safe module into a node:vm
// context and runs it against a synthetic X-timeline-shaped response fixture.
// No npm dependencies; always terminates.

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

const context = createContext({ console });
context.globalThis = context;
new Script(await readText("src/sync/sync-capture.js"), { filename: "src/sync/sync-capture.js" }).runInContext(context);
const { SyncCapture } = context.XTrueBlockMute;

// listKindFromUrl
check(SyncCapture.listKindFromUrl("https://x.com/i/api/graphql/abc/BlockedAccounts?x=1") === "blocked", "BlockedAccounts URL -> blocked");
check(SyncCapture.listKindFromUrl("https://x.com/i/api/graphql/abc/MutedAccounts?x=1") === "muted", "MutedAccounts URL -> muted");
check(SyncCapture.listKindFromUrl("https://x.com/i/api/graphql/abc/HomeTimeline") === null, "non-list URL -> null");

// normalizeHandle
check(SyncCapture.normalizeHandle("@Foo_Bar") === "foo_bar", "handle normalized (strip @, lowercase)");

// extraction against the synthetic timeline fixture
const fixture = JSON.parse(await readText("tests/fixtures/blocked-timeline-response.fixture.json"));
const entries = SyncCapture.extractSyncEntries(fixture, "blocked");

check(entries.length === 2, "extracts exactly the two user entries (cursors excluded)", entries.length);

const a = entries.find((e) => e.user_id === "9000000000000000001");
check(Boolean(a), "user A captured by rest_id");
check(a && a.handle === "synthetic_blocked_a", "user A handle from legacy.screen_name", a && a.handle);
check(a && a.listKind === "blocked", "user A listKind tagged blocked", a && a.listKind);

const b = entries.find((e) => e.user_id === "9000000000000000002");
check(Boolean(b), "user B captured by rest_id");
check(b && b.handle === "synthetic_blocked_b", "user B handle from core.screen_name, normalized", b && b.handle);

// cursor entries must not appear as users (no cursor value leaks into entries)
const serialized = JSON.stringify(entries);
check(!serialized.includes("synthetic-bottom-cursor"), "cursor value must not appear in entries");
check(!serialized.includes("synthetic-top-cursor"), "top cursor value must not appear in entries");
check(!serialized.includes("Synthetic Blocked"), "display names must not appear in entries");

function timelineUserEntry(entryId, restId, screenName) {
  return {
    entryId,
    content: {
      entryType: "TimelineTimelineItem",
      itemContent: {
        itemType: "TimelineUser",
        user_results: { result: { rest_id: restId, legacy: { screen_name: screenName } } }
      }
    }
  };
}

function timelineResponse(entriesForList, extraViewerFields = {}) {
  return {
    data: {
      viewer: {
        timeline: { timeline: { instructions: [{ entries: entriesForList }] } },
        ...extraViewerFields
      }
    }
  };
}

// dedupe: feeding the same response twice through extraction is per-call, but a
// response repeating a user collapses to one entry.
const dupFixture = timelineResponse([
  timelineUserEntry("user-111-a", "111", "dup"),
  timelineUserEntry("user-111-b", "111", "dup")
]);
check(SyncCapture.extractSyncEntries(dupFixture, "muted").length === 1, "duplicate rest_id within list entries collapses to one");

// GraphQL responses can carry unrelated user objects outside the list timeline.
// リスト instruction 配下ではない user-like object は、候補の見た目が一致しても保存対象にしない。
const mixedUsersFixture = timelineResponse([timelineUserEntry("user-777", "777", "list_member")], {
  globalObjects: {
    users: {
      "999": { rest_id: "999", legacy: { screen_name: "not_in_blocked_list" } }
    }
  },
  user: { result: { rest_id: "888", legacy: { screen_name: "viewer_account" } } }
});
const mixedUsers = SyncCapture.extractSyncEntries(mixedUsersFixture, "blocked");
check(mixedUsers.length === 1, "unrelated non-list user objects are ignored", mixedUsers);
check(mixedUsers[0] && mixedUsers[0].user_id === "777", "list timeline user remains captured", mixedUsers[0]);

if (failures.length > 0) {
  console.error(`\nSync extraction verification FAILED: ${failures.length} check(s) failed`);
  process.exit(1);
}
console.log("\nSync extraction verification passed");
