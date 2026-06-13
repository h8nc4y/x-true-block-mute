// verify-sync-hook.mjs
//
// Offline test for the production sync capture hook (src/sync/sync-hook.js).
// Loads sync-capture.js + sync-hook.js into a node:vm context with fake
// fetch / XMLHttpRequest and asserts that list-endpoint responses post extracted
// entries while non-list responses are ignored, and that cursor values and
// display names never leave the page. No npm deps; always terminates.

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
function flush() {
  return new Promise((resolve) => setImmediate(resolve));
}

class FakeResponse {
  constructor(body) {
    this.body = body;
  }
  clone() {
    return new FakeResponse(this.body);
  }
  text() {
    return Promise.resolve(this.body);
  }
}

class FakeXMLHttpRequest {
  constructor() {
    this.listeners = {};
    this.responseType = "";
    this.responseText = "";
  }
  addEventListener(type, listener) {
    (this.listeners[type] = this.listeners[type] || []).push(listener);
  }
  getResponseHeader() {
    return "application/json";
  }
  open(method, url) {
    this.method = method;
    this.url = url;
  }
  dispatch(type) {
    for (const listener of this.listeners[type] || []) {
      listener.call(this);
    }
  }
}

const blockedBody = await readText("tests/fixtures/blocked-timeline-response.fixture.json");
const mutedBody = JSON.stringify({
  data: {
    viewer: {
      timeline: {
        timeline: {
          instructions: [
            {
              type: "TimelineAddEntries",
              entries: [
                {
                  entryId: "user-8000000000000000001",
                  content: {
                    itemContent: { user_results: { result: { rest_id: "8000000000000000001", legacy: { screen_name: "synthetic_muted_a", name: "Synthetic Muted A" } } } }
                  }
                },
                { entryId: "cursor-bottom-MMM", content: { entryType: "TimelineTimelineCursor", cursorType: "Bottom", value: "synthetic-muted-cursor" } }
              ]
            }
          ]
        }
      }
    }
  }
});

const messages = [];
const location = { origin: "https://x.com", href: "https://x.com/settings/blocked/all" };
const windowObject = {
  fetch: (url) => {
    const text = String(url || "");
    if (/BlockedAccounts/.test(text)) return Promise.resolve(new FakeResponse(blockedBody));
    if (/MutedAccounts/.test(text)) return Promise.resolve(new FakeResponse(mutedBody));
    return Promise.resolve(new FakeResponse('{"data":{"home":{"entries":[]}}}'));
  },
  postMessage: (message, targetOrigin) => {
    messages.push({ message, targetOrigin });
  }
};

const context = createContext({
  console,
  JSON,
  URL,
  location,
  window: windowObject,
  XMLHttpRequest: FakeXMLHttpRequest
});
context.globalThis = context;

new Script(await readText("src/sync/sync-capture.js"), { filename: "src/sync/sync-capture.js" }).runInContext(context);
new Script(await readText("src/sync/sync-hook.js"), { filename: "src/sync/sync-hook.js" }).runInContext(context);

context.XTrueBlockMuteSyncHook.installSyncHook("x-tbm:sync:capture");
context.XTrueBlockMuteSyncHook.installSyncHook("x-tbm:sync:capture"); // idempotency

// 1. List endpoint (fetch) -> entries posted
await context.window.fetch("https://x.com/i/api/graphql/abc/BlockedAccounts?variables=x");
await flush();
await flush();
const blockedMsgs = messages.filter((m) => m.message.source === "x-tbm:sync:capture" && m.message.listKind === "blocked");
check(blockedMsgs.length === 1, "one blocked sync-entries message posted", blockedMsgs.length);
const blockedEntries = blockedMsgs[0]?.message.entries || [];
check(blockedEntries.length === 2, "blocked message carries the 2 user entries", blockedEntries.length);
check(blockedEntries.every((e) => e.listKind === "blocked"), "blocked entries tagged listKind blocked");
const blockedStr = JSON.stringify(blockedMsgs[0]?.message || {});
check(blockedStr.includes("9000000000000000001"), "entries intentionally include the user's own ids (production flow)");
check(!blockedStr.includes("synthetic-bottom-cursor"), "cursor value must not leave the page");
check(!blockedStr.includes("Synthetic Blocked"), "display names must not leave the page");

// 2. Non-list endpoint -> ignored
await context.window.fetch("https://x.com/i/api/graphql/abc/HomeTimeline?variables=x");
await flush();
await flush();
const total = messages.filter((m) => m.message.source === "x-tbm:sync:capture").length;
check(total === 1, "non-list endpoint produces no sync message", total);

// 3. Muted endpoint via XHR
const xhr = new context.XMLHttpRequest();
xhr.open("GET", "https://x.com/i/api/graphql/abc/MutedAccounts?variables=x");
xhr.responseText = mutedBody;
xhr.dispatch("loadend");
await flush();
const mutedMsgs = messages.filter((m) => m.message.source === "x-tbm:sync:capture" && m.message.listKind === "muted");
check(mutedMsgs.length === 1, "one muted sync-entries message posted (XHR)", mutedMsgs.length);
check((mutedMsgs[0]?.message.entries || []).length === 1, "muted message carries the 1 user entry");
check(!JSON.stringify(mutedMsgs[0]?.message || {}).includes("synthetic-muted-cursor"), "muted cursor value must not leave the page");

if (failures.length > 0) {
  console.error(`\nSync hook verification FAILED: ${failures.length} check(s) failed`);
  process.exit(1);
}
console.log("\nSync hook verification passed");
