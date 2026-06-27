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
  constructor(body, status = 200, { onText } = {}) {
    this.body = body;
    this.status = status;
    this.onText = onText;
  }
  clone() {
    return new FakeResponse(this.body, this.status, { onText: this.onText });
  }
  text() {
    if (this.onText) {
      this.onText();
    }
    return Promise.resolve(this.body);
  }
}

function createFakeXMLHttpRequestClass() {
  return class FakeXMLHttpRequest {
    constructor() {
      this.listeners = {};
      this.responseType = "";
      this._responseText = "";
      this.onResponseTextRead = null;
      this.status = 200;
    }
    get responseText() {
      if (this.onResponseTextRead) {
        this.onResponseTextRead();
      }
      return this._responseText;
    }
    set responseText(value) {
      this._responseText = value;
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
  };
}

const blockedBody = await readText("tests/fixtures/blocked-timeline-response.fixture.json");
const graphQLErrorBody = JSON.stringify({
  errors: [{ message: "Rate limit exceeded", code: 88 }],
  data: { viewer: null }
});
const transientBlockedBody = JSON.stringify({
  data: { viewer: { timeline: { timeline: { instructions: [] } } } }
});
const topOnlyBlockedBody = JSON.stringify({
  data: {
    viewer: {
      timeline: {
        timeline: {
          instructions: [
            {
              type: "TimelineAddEntries",
              entries: [
                {
                  entryId: "cursor-top-only",
                  content: {
                    entryType: "TimelineTimelineCursor",
                    cursorType: "Top",
                    value: "synthetic-top-only"
                  }
                }
              ]
            }
          ]
        }
      }
    }
  }
});
const emptyBlockedBody = JSON.stringify({
  data: {
    viewer: {
      timeline: {
        timeline: {
          instructions: [
            {
              type: "TimelineAddEntries",
              entries: [
                {
                  entryId: "cursor-top-empty",
                  content: {
                    entryType: "TimelineTimelineCursor",
                    cursorType: "Top",
                    value: "synthetic-empty-top"
                  }
                },
                {
                  entryId: "cursor-bottom-empty",
                  content: {
                    entryType: "TimelineTimelineCursor",
                    cursorType: "Bottom",
                    value: "synthetic-empty-bottom"
                  }
                }
              ]
            }
          ]
        }
      }
    }
  }
});
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
let nonListTextReadCount = 0;
let nonListXhrTextReadCount = 0;
let offSettingsXhrTextReadCount = 0;
let offSettingsListTextReadCount = 0;
let queryOnlySettingsPathTextReadCount = 0;
const location = { origin: "https://x.com", href: "https://x.com/settings/blocked/all" };
const windowObject = {
  fetch: (url) => {
    const text = String(url || "");
    if (/BlockedAccounts/.test(text) && /error/.test(text)) return Promise.resolve(new FakeResponse(graphQLErrorBody));
    if (/BlockedAccounts/.test(text) && /transient/.test(text)) return Promise.resolve(new FakeResponse(transientBlockedBody));
    if (/BlockedAccounts/.test(text) && /top-only/.test(text)) return Promise.resolve(new FakeResponse(topOnlyBlockedBody));
    if (/BlockedAccounts/.test(text) && /non-2xx/.test(text)) return Promise.resolve(new FakeResponse(blockedBody, 503));
    if (/BlockedAccounts/.test(text) && /tail/.test(text)) return Promise.resolve(new FakeResponse(emptyBlockedBody));
    if (/BlockedAccounts/.test(text) && /query-settings-path/.test(text)) {
      return Promise.resolve(
        new FakeResponse(blockedBody, 200, {
          onText: () => {
            queryOnlySettingsPathTextReadCount += 1;
          }
        })
      );
    }
    if (/BlockedAccounts/.test(text) && /off-settings/.test(text)) {
      return Promise.resolve(
        new FakeResponse(blockedBody, 200, {
          onText: () => {
            offSettingsListTextReadCount += 1;
          }
        })
      );
    }
    if (/BlockedAccounts/.test(text)) return Promise.resolve(new FakeResponse(blockedBody));
    if (/MutedAccounts/.test(text)) return Promise.resolve(new FakeResponse(mutedBody));
    return Promise.resolve(
      new FakeResponse('{"data":{"home":{"entries":[]}}}', 200, {
        onText: () => {
          nonListTextReadCount += 1;
        }
      })
    );
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
  XMLHttpRequest: createFakeXMLHttpRequestClass()
});
context.globalThis = context;

new Script(await readText("src/sync/sync-capture.js"), { filename: "src/sync/sync-capture.js" }).runInContext(context);
const originalFetch = context.window.fetch;
const originalXhrOpen = context.XMLHttpRequest.prototype.open;

new Script(await readText("src/sync/sync-hook.js"), { filename: "src/sync/sync-hook.js" }).runInContext(context);
const fetchAfterAutoInstall = context.window.fetch;
const xhrOpenAfterAutoInstall = context.XMLHttpRequest.prototype.open;
check(fetchAfterAutoInstall !== originalFetch, "sync hook auto-install wraps fetch once");
check(xhrOpenAfterAutoInstall !== originalXhrOpen, "sync hook auto-install wraps XMLHttpRequest.open once");

context.XTrueBlockMuteSyncHook.installSyncHook("x-tbm:sync:capture");
check(context.window.fetch === fetchAfterAutoInstall, "installSyncHook does not wrap fetch more than once");
check(
  context.XMLHttpRequest.prototype.open === xhrOpenAfterAutoInstall,
  "installSyncHook does not wrap XMLHttpRequest.open more than once"
);

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

const beforeOffSettings = messages.length;
location.href = "https://x.com/home";
await context.window.fetch("https://x.com/i/api/graphql/abc/BlockedAccounts?case=off-settings");
await flush();
await flush();
check(messages.length === beforeOffSettings, "off-settings list endpoint posts no sync message", messages.length - beforeOffSettings);
check(offSettingsListTextReadCount === 0, "off-settings list endpoint response body is not read", offSettingsListTextReadCount);

const beforeQueryOnlySettingsPath = messages.length;
location.href = "https://x.com/home?next=/settings/blocked/all";
await context.window.fetch("https://x.com/i/api/graphql/abc/BlockedAccounts?case=query-settings-path");
await flush();
await flush();
check(
  messages.length === beforeQueryOnlySettingsPath,
  "query-only settings path posts no sync message",
  messages.length - beforeQueryOnlySettingsPath
);
check(
  queryOnlySettingsPathTextReadCount === 0,
  "query-only settings path response body is not read",
  queryOnlySettingsPathTextReadCount
);
location.href = "https://x.com/settings/blocked/all";

// 2. Non-list endpoint -> ignored
await context.window.fetch("https://x.com/i/api/graphql/abc/HomeTimeline?variables=x");
await flush();
await flush();
const total = messages.filter((m) => m.message.source === "x-tbm:sync:capture").length;
check(total === 1, "non-list endpoint produces no sync message", total);
check(nonListTextReadCount === 0, "non-list fetch response body is not read", nonListTextReadCount);

// 3. Muted endpoint via XHR after same-document settings SPA navigation.
location.href = "https://x.com/settings/muted/all?src=spa";
const xhr = new context.XMLHttpRequest();
xhr.open("GET", "https://x.com/i/api/graphql/abc/MutedAccounts?variables=x");
xhr.responseText = mutedBody;
xhr.dispatch("loadend");
await flush();
const mutedMsgs = messages.filter((m) => m.message.source === "x-tbm:sync:capture" && m.message.listKind === "muted");
check(mutedMsgs.length === 1, "one muted sync-entries message posted (XHR)", mutedMsgs.length);
check((mutedMsgs[0]?.message.entries || []).length === 1, "muted message carries the 1 user entry");
check(!JSON.stringify(mutedMsgs[0]?.message || {}).includes("synthetic-muted-cursor"), "muted cursor value must not leave the page");
location.href = "https://x.com/settings/blocked/all";

const xhrHome = new context.XMLHttpRequest();
xhrHome.open("GET", "https://x.com/i/api/graphql/abc/HomeTimeline?variables=x");
xhrHome.responseText = '{"data":{"home":{"entries":[]}}}';
xhrHome.onResponseTextRead = () => {
  nonListXhrTextReadCount += 1;
};
xhrHome.dispatch("loadend");
await flush();
check(nonListXhrTextReadCount === 0, "non-list XHR response body is not read", nonListXhrTextReadCount);

const beforeOffSettingsXhr = messages.length;
location.href = "https://x.com/home";
const xhrOffSettings = new context.XMLHttpRequest();
xhrOffSettings.open("GET", "https://x.com/i/api/graphql/abc/BlockedAccounts?case=off-settings-xhr");
xhrOffSettings.responseText = blockedBody;
xhrOffSettings.onResponseTextRead = () => {
  offSettingsXhrTextReadCount += 1;
};
xhrOffSettings.dispatch("loadend");
await flush();
check(
  messages.length === beforeOffSettingsXhr,
  "off-settings list XHR posts no sync message",
  messages.length - beforeOffSettingsXhr
);
check(
  offSettingsXhrTextReadCount === 0,
  "off-settings list XHR response body is not read",
  offSettingsXhrTextReadCount
);
location.href = "https://x.com/settings/blocked/all";

// 4. Top-only cursor page -> ignored, not treated as full-list completion
const beforeTopOnly = messages.length;
await context.window.fetch("https://x.com/i/api/graphql/abc/BlockedAccounts?case=top-only");
await flush();
await flush();
check(messages.length === beforeTopOnly, "top-only cursor page posts no sync-complete", messages.length - beforeTopOnly);

// 5. Empty tail page -> completion signal only, no entries/cursor leakage
await context.window.fetch("https://x.com/i/api/graphql/abc/BlockedAccounts?cursor=tail");
await flush();
await flush();
const completeMsgs = messages.filter((m) => m.message.source === "x-tbm:sync:capture" && m.message.kind === "sync-complete");
check(completeMsgs.length === 1, "empty blocked tail posts one sync-complete message", completeMsgs.length);
check(completeMsgs[0]?.message.listKind === "blocked", "sync-complete is tagged blocked", completeMsgs[0]?.message.listKind);
check(!("entries" in (completeMsgs[0]?.message || {})), "sync-complete carries no entries property");
const blockedEntryMsgCount = messages.filter(
  (m) => m.message.source === "x-tbm:sync:capture" && m.message.kind === "sync-entries" && m.message.listKind === "blocked"
).length;
check(blockedEntryMsgCount === 1, "empty blocked tail posts no additional sync-entries", blockedEntryMsgCount);
check(!JSON.stringify(completeMsgs[0]?.message || {}).includes("synthetic-empty-bottom"), "empty tail cursor value must not leave the page");

// 6. GraphQL error envelope -> ignored, no completion/reconcile signal
const beforeGraphQLError = messages.length;
await context.window.fetch("https://x.com/i/api/graphql/abc/BlockedAccounts?case=error");
await flush();
await flush();
check(messages.length === beforeGraphQLError, "GraphQL error envelope posts no sync message", messages.length);

// 7. Transient empty/malformed timeline body without cursor entries -> ignored
const beforeTransient = messages.length;
await context.window.fetch("https://x.com/i/api/graphql/abc/BlockedAccounts?case=transient");
await flush();
await flush();
check(messages.length === beforeTransient, "empty body without timeline entries posts no sync-complete", messages.length);

// 8. Non-2xx list response -> ignored
const beforeNon2xx = messages.length;
await context.window.fetch("https://x.com/i/api/graphql/abc/BlockedAccounts?case=non-2xx");
await flush();
await flush();
check(messages.length === beforeNon2xx, "non-2xx list response posts no sync message", messages.length);

// 9. Injection order resilience -> missing SyncCapture must not poison the install guard.
// Declarative content scripts list sync-capture before sync-hook, but this regression keeps
// the lifecycle contract explicit: a transient missing dependency leaves the hook retryable.
const deferredMessages = [];
let deferredListTextReadCount = 0;
const deferredLocation = { origin: "https://x.com", href: "https://x.com/settings/blocked/all" };
const deferredContext = createContext({
  console,
  JSON,
  URL,
  location: deferredLocation,
  window: {
    fetch: () =>
      Promise.resolve(
        new FakeResponse(blockedBody, 200, {
          onText: () => {
            deferredListTextReadCount += 1;
          }
        })
      ),
    postMessage: (message, targetOrigin) => {
      deferredMessages.push({ message, targetOrigin });
    }
  },
  XMLHttpRequest: createFakeXMLHttpRequestClass()
});
deferredContext.globalThis = deferredContext;
const deferredOriginalFetch = deferredContext.window.fetch;
const deferredOriginalXhrOpen = deferredContext.XMLHttpRequest.prototype.open;
new Script(await readText("src/sync/sync-hook.js"), { filename: "src/sync/sync-hook.js" }).runInContext(
  deferredContext
);
check(
  deferredContext.window.fetch === deferredOriginalFetch,
  "missing SyncCapture leaves fetch unwrapped",
  deferredContext.window.fetch.name
);
check(
  deferredContext.XMLHttpRequest.prototype.open === deferredOriginalXhrOpen,
  "missing SyncCapture leaves XMLHttpRequest.open unwrapped"
);
check(!deferredContext.window.__xTbmSyncHookInstalled, "missing SyncCapture does not mark sync hook installed");

new Script(await readText("src/sync/sync-capture.js"), { filename: "src/sync/sync-capture.js" }).runInContext(
  deferredContext
);
deferredContext.XTrueBlockMuteSyncHook.installSyncHook("x-tbm:sync:capture");
check(deferredContext.window.fetch !== deferredOriginalFetch, "sync hook can install after SyncCapture becomes available");
check(
  deferredContext.XMLHttpRequest.prototype.open !== deferredOriginalXhrOpen,
  "sync hook wraps XMLHttpRequest.open after deferred install"
);
await deferredContext.window.fetch("https://x.com/i/api/graphql/abc/BlockedAccounts?case=deferred-install");
await flush();
await flush();
check(deferredListTextReadCount === 1, "deferred install reads eligible list response once", deferredListTextReadCount);
check(
  deferredMessages.filter((m) => m.message.source === "x-tbm:sync:capture" && m.message.kind === "sync-entries")
    .length === 1,
  "deferred install posts one sync-entries message",
  deferredMessages
);

if (failures.length > 0) {
  console.error(`\nSync hook verification FAILED: ${failures.length} check(s) failed`);
  process.exit(1);
}
console.log("\nSync hook verification passed");
