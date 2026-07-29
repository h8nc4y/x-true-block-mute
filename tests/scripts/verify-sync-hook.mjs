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
      this.onAddEventListener = null;
      this.status = 200;
      this.readyState = 0;
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
      // XHR自身がevent targetのため、capture指定の有無よりlistener登録順が先行する。
      // ページlistenerが先にある再入経路を、実Chromiumと同じ順序で合成する。
      if (this.onAddEventListener) {
        this.onAddEventListener(type, listener);
      }
      (this.listeners[type] = this.listeners[type] || []).push(listener);
    }
    getResponseHeader() {
      return "application/json";
    }
    open(method, url) {
      // WHATWG XHRのforbidden method検査は、既存response stateを初期化する前にthrowする。
      if (method === "CONNECT") {
        throw new SyntaxError("synthetic forbidden method");
      }
      this.method = method;
      this.url = url;
      this.readyState = 1;
    }
    dispatch(type) {
      for (const listener of this.listeners[type] || []) {
        listener.call(this);
      }
    }
    complete() {
      // WHATWG XHR の成功順序(DONE readystatechange → load → loadend)を合成する。
      this.readyState = 4;
      this.dispatch("readystatechange");
      this.dispatch("load");
      this.dispatch("loadend");
    }
    fail(eventType = "error") {
      // network error stepsはstatus 0のDONEを通知してからerror/abortとloadendへ進む。
      this.status = 0;
      this.readyState = 4;
      this.dispatch("readystatechange");
      this.dispatch(eventType);
      this.dispatch("loadend");
    }
    abort() {
      // 実ブラウザのabort()はerror steps後にDONEからUNSENT(0)へ戻し、
      // その最終遷移自体ではreadystatechangeを追加送出しない。
      this.fail("abort");
      this.readyState = 0;
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
// 0ユーザーだが item entry(user_results 空=凍結アカウント想定)を持つ中間ページ。
// Bottom cursor はあるが末尾ではないため、sync-complete を出してはならない。
const midSuspendedBlockedBody = JSON.stringify({
  data: {
    viewer: {
      timeline: {
        timeline: {
          instructions: [
            {
              type: "TimelineAddEntries",
              entries: [
                {
                  entryId: "user-suspended-mid",
                  content: {
                    entryType: "TimelineTimelineItem",
                    itemContent: { itemType: "TimelineUser", user_results: {} }
                  }
                },
                {
                  entryId: "cursor-bottom-mid",
                  content: {
                    entryType: "TimelineTimelineCursor",
                    cursorType: "Bottom",
                    value: "synthetic-mid-bottom"
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
let queryOnlyOperationTextReadCount = 0;
const location = { origin: "https://x.com", href: "https://x.com/settings/blocked/all" };
const windowObject = {
  fetch: (url) => {
    const text = String(url || "");
    if (/HomeTimeline/.test(text) && /query-operation-name/.test(text)) {
      return Promise.resolve(
        new FakeResponse(blockedBody, 200, {
          onText: () => {
            queryOnlyOperationTextReadCount += 1;
          }
        })
      );
    }
    if (/BlockedAccounts/.test(text) && /error/.test(text)) return Promise.resolve(new FakeResponse(graphQLErrorBody));
    if (/BlockedAccounts/.test(text) && /transient/.test(text)) return Promise.resolve(new FakeResponse(transientBlockedBody));
    if (/BlockedAccounts/.test(text) && /top-only/.test(text)) return Promise.resolve(new FakeResponse(topOnlyBlockedBody));
    if (/BlockedAccounts/.test(text) && /non-2xx/.test(text)) return Promise.resolve(new FakeResponse(blockedBody, 503));
    if (/BlockedAccounts/.test(text) && /mid-suspended/.test(text)) return Promise.resolve(new FakeResponse(midSuspendedBlockedBody));
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

// 1. cursor 無しの初回 list request -> sync-start の後に entries を通知する。
// request variables 自体や cursor 値は bridge へ送らない。
const initialBlockedVariables = encodeURIComponent(JSON.stringify({ count: 20 }));
await context.window.fetch(`https://x.com/i/api/graphql/abc/BlockedAccounts?variables=${initialBlockedVariables}`);
await flush();
await flush();
const blockedStartMsgs = messages.filter(
  (m) =>
    m.message.source === "x-tbm:sync:capture" &&
    m.message.kind === "sync-start" &&
    m.message.listKind === "blocked"
);
const blockedMsgs = messages.filter(
  (m) =>
    m.message.source === "x-tbm:sync:capture" &&
    m.message.kind === "sync-entries" &&
    m.message.listKind === "blocked"
);
check(blockedStartMsgs.length === 1, "initial blocked request posts one sync-start message", blockedStartMsgs.length);
check(blockedMsgs.length === 1, "one blocked sync-entries message posted", blockedMsgs.length);
check(
  messages.indexOf(blockedStartMsgs[0]) < messages.indexOf(blockedMsgs[0]),
  "sync-start is posted before the first entry batch"
);
check(!("entries" in (blockedStartMsgs[0]?.message || {})), "sync-start carries no entries property");
const blockedEntries = blockedMsgs[0]?.message.entries || [];
check(blockedEntries.length === 2, "blocked message carries the 2 user entries", blockedEntries.length);
check(blockedEntries.every((e) => e.listKind === "blocked"), "blocked entries tagged listKind blocked");
const blockedStr = JSON.stringify(blockedMsgs[0]?.message || {});
check(blockedStr.includes("9000000000000000001"), "entries intentionally include the user's own ids (production flow)");
check(!blockedStr.includes("synthetic-bottom-cursor"), "cursor value must not leave the page");
check(!blockedStr.includes("Synthetic Blocked"), "display names must not leave the page");
check(
  !JSON.stringify(blockedStartMsgs[0]?.message || {}).includes("variables"),
  "sync-start does not expose request variables"
);

// cursor 付き pagination request は新しい全走査ではない。entries は取り込むが、
// staging reset を起こす sync-start と request cursor 値は bridge へ出さない。
const beforePaginatedBlocked = messages.length;
const paginatedBlockedVariables = encodeURIComponent(
  JSON.stringify({ count: 20, cursor: "synthetic-request-cursor" })
);
await context.window.fetch(
  `https://x.com/i/api/graphql/abc/BlockedAccounts?variables=${paginatedBlockedVariables}`
);
await flush();
await flush();
const paginatedBlockedMessages = messages.slice(beforePaginatedBlocked);
check(
  paginatedBlockedMessages.filter((m) => m.message.kind === "sync-start").length === 0,
  "paginated blocked request posts no sync-start"
);
check(
  paginatedBlockedMessages.filter((m) => m.message.kind === "sync-entries").length === 1,
  "paginated blocked request still posts its entry batch"
);
check(
  !JSON.stringify(paginatedBlockedMessages).includes("synthetic-request-cursor"),
  "request cursor value must not leave the page"
);

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
check(total === 3, "non-list endpoint produces no sync message", total);
check(nonListTextReadCount === 0, "non-list fetch response body is not read", nonListTextReadCount);

// operation 名が query 値に現れるだけの無関係な GraphQL 応答も、本文読取前に落とす。
const beforeQueryOnlyOperation = messages.length;
await context.window.fetch(
  "https://x.com/i/api/graphql/abc/HomeTimeline?case=query-operation-name&next=BlockedAccounts"
);
await flush();
await flush();
check(
  messages.length === beforeQueryOnlyOperation,
  "query-only operation name posts no sync message",
  messages.length - beforeQueryOnlyOperation
);
check(
  queryOnlyOperationTextReadCount === 0,
  "query-only operation name response body is not read",
  queryOnlyOperationTextReadCount
);

// 3. Muted endpoint via XHR after same-document settings SPA navigation.
location.href = "https://x.com/settings/muted/all?src=spa";
const xhr = new context.XMLHttpRequest();
const initialMutedVariables = encodeURIComponent(JSON.stringify({ count: 20 }));
xhr.open("GET", `https://x.com/i/api/graphql/abc/MutedAccounts?variables=${initialMutedVariables}`);
xhr.responseText = mutedBody;
xhr.complete();
await flush();
const mutedStartMsgs = messages.filter(
  (m) =>
    m.message.source === "x-tbm:sync:capture" &&
    m.message.kind === "sync-start" &&
    m.message.listKind === "muted"
);
const mutedMsgs = messages.filter(
  (m) =>
    m.message.source === "x-tbm:sync:capture" &&
    m.message.kind === "sync-entries" &&
    m.message.listKind === "muted"
);
check(mutedStartMsgs.length === 1, "initial muted request posts one sync-start message", mutedStartMsgs.length);
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
xhrHome.complete();
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
xhrOffSettings.complete();
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

// 4. Reopened XHR object -> only one readystatechange listener may process the final request.
const beforeReopenedXhr = messages.length;
const reopenedXhr = new context.XMLHttpRequest();
reopenedXhr.open("GET", "https://x.com/i/api/graphql/abc/HomeTimeline?case=reopen-first");
reopenedXhr.open("GET", "https://x.com/i/api/graphql/abc/BlockedAccounts?case=reopen-final");
reopenedXhr.responseText = blockedBody;
reopenedXhr.complete();
await flush();
const reopenedXhrMsgs = messages
  .slice(beforeReopenedXhr)
  .filter(
    (m) =>
      m.message.source === "x-tbm:sync:capture" &&
      m.message.kind === "sync-entries" &&
      m.message.listKind === "blocked"
  );
check(reopenedXhrMsgs.length === 1, "reopened XHR object posts one sync-entries message", reopenedXhrMsgs.length);

// 5. hookより先に登録されたページの通常readystatechange listenerがDONEで
// 同じXHRを再openしても、最初のeligible responseをhookが先に処理する。
const beforeReadyStateReopenXhr = messages.length;
let readyStateReopenTextReadCount = 0;
const readyStateReopenXhr = new context.XMLHttpRequest();
readyStateReopenXhr.addEventListener("readystatechange", () => {
  if (readyStateReopenXhr.readyState === 4) {
    readyStateReopenXhr.open(
      "GET",
      "https://x.com/i/api/graphql/abc/HomeTimeline?case=readystatechange-reopen-next"
    );
  }
});
readyStateReopenXhr.open(
  "GET",
  "https://x.com/i/api/graphql/abc/BlockedAccounts?case=readystatechange-reopen-first"
);
readyStateReopenXhr.responseText = blockedBody;
readyStateReopenXhr.onResponseTextRead = () => {
  readyStateReopenTextReadCount += 1;
};
readyStateReopenXhr.complete();
await flush();
const readyStateReopenXhrMsgs = messages
  .slice(beforeReadyStateReopenXhr)
  .filter(
    (m) =>
      m.message.source === "x-tbm:sync:capture" &&
      m.message.kind === "sync-entries" &&
      m.message.listKind === "blocked"
  );
check(
  readyStateReopenTextReadCount === 1,
  "eligible XHR response is read before an earlier page readystatechange listener reopens the object",
  readyStateReopenTextReadCount
);
check(
  readyStateReopenXhrMsgs.length === 1,
  "eligible XHR response posts once before an earlier page readystatechange listener reopens the object",
  readyStateReopenXhrMsgs.length
);

// 6. originalOpenが同期throwしたrequest stateを残さず、直前のnon-list DONE本文を
// 失敗したeligible URLへ誤対応しない。
const beforeFailedOpenXhr = messages.length;
let failedOpenTextReadCount = 0;
let failedOpenThrew = false;
const failedOpenXhr = new context.XMLHttpRequest();
failedOpenXhr.open("GET", "https://x.com/i/api/graphql/abc/HomeTimeline?case=before-failed-open");
failedOpenXhr.responseText = blockedBody;
failedOpenXhr.onResponseTextRead = () => {
  failedOpenTextReadCount += 1;
};
failedOpenXhr.complete();
await flush();
try {
  failedOpenXhr.open(
    "CONNECT",
    "https://x.com/i/api/graphql/abc/BlockedAccounts?case=failed-open"
  );
} catch (error) {
  failedOpenThrew = error instanceof SyntaxError;
}
failedOpenXhr.open("GET", "https://x.com/i/api/graphql/abc/HomeTimeline?case=after-failed-open");
await flush();
const failedOpenXhrMsgs = messages
  .slice(beforeFailedOpenXhr)
  .filter((m) => m.message.source === "x-tbm:sync:capture");
check(failedOpenThrew, "forbidden XHR method preserves the original synchronous error");
check(
  failedOpenTextReadCount === 0,
  "failed eligible open does not make the previous non-list response readable",
  failedOpenTextReadCount
);
check(
  failedOpenXhrMsgs.length === 0,
  "failed eligible open does not post from the previous non-list response",
  failedOpenXhrMsgs.length
);

// 7. 初回listener登録が同期throwしてもprovisional stateを残さない。
// 登録済みか不明なため同じ世代では再登録せず、そのXHRだけをfail closedにする。
const beforeListenerThrowXhr = messages.length;
let listenerThrowTextReadCount = 0;
let listenerThrowPreservedError = false;
let listenerRegistrationAttempts = 0;
const listenerThrowXhr = new context.XMLHttpRequest();
listenerThrowXhr.readyState = 4;
listenerThrowXhr.responseText = blockedBody;
listenerThrowXhr.onResponseTextRead = () => {
  listenerThrowTextReadCount += 1;
};
listenerThrowXhr.onAddEventListener = (_type, listener) => {
  listenerRegistrationAttempts += 1;
  if (listenerRegistrationAttempts === 1) {
    // MAIN worldの外部wrapperがcallbackを同期実行してからthrowしても、
    // 次request stateはまだ公開されていないため旧bodyを新URLで処理しない。
    listener.call(listenerThrowXhr);
    throw new Error("synthetic addEventListener failure");
  }
};
try {
  listenerThrowXhr.open(
    "GET",
    "https://x.com/i/api/graphql/abc/BlockedAccounts?case=listener-registration-throw"
  );
} catch (error) {
  listenerThrowPreservedError = error.message === "synthetic addEventListener failure";
}
listenerThrowXhr.open(
  "GET",
  "https://x.com/i/api/graphql/abc/HomeTimeline?case=after-listener-registration-throw"
);
await flush();
const listenerThrowXhrMsgs = messages
  .slice(beforeListenerThrowXhr)
  .filter((m) => m.message.source === "x-tbm:sync:capture");
check(listenerThrowPreservedError, "XHR listener registration preserves its synchronous error");
check(
  listenerRegistrationAttempts === 1,
  "failed XHR listener registration is not retried with ambiguous ownership",
  listenerRegistrationAttempts
);
check(
  listenerThrowTextReadCount === 0,
  "failed XHR listener registration does not make the previous non-list response readable",
  listenerThrowTextReadCount
);
check(
  listenerThrowXhrMsgs.length === 0,
  "failed XHR listener registration posts no message from the previous non-list response",
  listenerThrowXhrMsgs.length
);

// 8. ページの load listener が同じ XHR を次 request へ開き直しても、
// 最初の eligible response は次 request の URL で上書きされる前に処理する。
const beforeLoadReopenXhr = messages.length;
let loadReopenTextReadCount = 0;
const loadReopenXhr = new context.XMLHttpRequest();
loadReopenXhr.addEventListener("load", () => {
  loadReopenXhr.open("GET", "https://x.com/i/api/graphql/abc/HomeTimeline?case=load-reopen-next");
});
loadReopenXhr.open("GET", "https://x.com/i/api/graphql/abc/BlockedAccounts?case=load-reopen-first");
loadReopenXhr.responseText = blockedBody;
loadReopenXhr.onResponseTextRead = () => {
  loadReopenTextReadCount += 1;
};
loadReopenXhr.complete();
await flush();
const loadReopenXhrMsgs = messages
  .slice(beforeLoadReopenXhr)
  .filter(
    (m) =>
      m.message.source === "x-tbm:sync:capture" &&
      m.message.kind === "sync-entries" &&
      m.message.listKind === "blocked"
  );
check(
  loadReopenTextReadCount === 1,
  "eligible XHR response is read before a page load listener reopens the object",
  loadReopenTextReadCount
);
check(
  loadReopenXhrMsgs.length === 1,
  "eligible XHR response posts once before a page load listener reopens the object",
  loadReopenXhrMsgs.length
);

// 9. network errorはDONEへ遷移してもstatus 0の本文を読まず、messageを送らない。
const beforeNetworkErrorXhr = messages.length;
let networkErrorTextReadCount = 0;
let networkErrorThrew = false;
const networkErrorXhr = new context.XMLHttpRequest();
networkErrorXhr.open("GET", "https://x.com/i/api/graphql/abc/BlockedAccounts?case=network-error");
networkErrorXhr.responseText = blockedBody;
networkErrorXhr.onResponseTextRead = () => {
  networkErrorTextReadCount += 1;
};
try {
  networkErrorXhr.fail();
} catch (_error) {
  networkErrorThrew = true;
}
await flush();
check(!networkErrorThrew, "network-error DONE is handled without throwing");
check(networkErrorTextReadCount === 0, "network-error XHR response body is not read", networkErrorTextReadCount);
check(messages.length === beforeNetworkErrorXhr, "network-error XHR posts no sync message");

// 7. abortは一時的なDONE通知後にUNSENTへ戻り、本文もmessageも残さない。
const beforeAbortedXhr = messages.length;
let abortedXhrTextReadCount = 0;
const abortedXhr = new context.XMLHttpRequest();
abortedXhr.open("GET", "https://x.com/i/api/graphql/abc/MutedAccounts?case=abort");
abortedXhr.responseText = mutedBody;
abortedXhr.onResponseTextRead = () => {
  abortedXhrTextReadCount += 1;
};
abortedXhr.abort();
await flush();
check(abortedXhr.readyState === 0, "aborted XHR returns to UNSENT readyState", abortedXhr.readyState);
check(abortedXhrTextReadCount === 0, "aborted XHR response body is not read", abortedXhrTextReadCount);
check(messages.length === beforeAbortedXhr, "aborted XHR posts no sync message");

// 8. Top-only cursor page -> ignored, not treated as full-list completion
const beforeTopOnly = messages.length;
await context.window.fetch("https://x.com/i/api/graphql/abc/BlockedAccounts?case=top-only");
await flush();
await flush();
check(messages.length === beforeTopOnly, "top-only cursor page posts no sync-complete", messages.length - beforeTopOnly);

// 9. Empty tail page -> completion signal only, no entries/cursor leakage
const beforeBottom = messages.length;
await context.window.fetch("https://x.com/i/api/graphql/abc/BlockedAccounts?cursor=tail");
await flush();
await flush();
const completeMsgs = messages.filter((m) => m.message.source === "x-tbm:sync:capture" && m.message.kind === "sync-complete");
check(completeMsgs.length === 1, "empty blocked tail posts one sync-complete message", completeMsgs.length);
check(completeMsgs[0]?.message.listKind === "blocked", "sync-complete is tagged blocked", completeMsgs[0]?.message.listKind);
check(!("entries" in (completeMsgs[0]?.message || {})), "sync-complete carries no entries property");
const blockedEntryMsgCount = messages.slice(beforeBottom).filter(
  (m) => m.message.source === "x-tbm:sync:capture" && m.message.kind === "sync-entries" && m.message.listKind === "blocked"
).length;
check(blockedEntryMsgCount === 0, "empty blocked tail posts no additional sync-entries", blockedEntryMsgCount);
check(!JSON.stringify(completeMsgs[0]?.message || {}).includes("synthetic-empty-bottom"), "empty tail cursor value must not leave the page");

// 6b. Mid-list page with 0 users but a non-cursor item entry (suspended run) ->
// NOT treated as the tail, so no sync-complete fires and reconcile cannot wipe the
// still-valid synced list from a premature completion.
const beforeMid = messages.length;
await context.window.fetch("https://x.com/i/api/graphql/abc/BlockedAccounts?case=mid-suspended");
await flush();
await flush();
const midCompleteMsgs = messages.slice(beforeMid).filter(
  (m) => m.message.source === "x-tbm:sync:capture" && m.message.kind === "sync-complete"
);
check(midCompleteMsgs.length === 0, "mid page with a non-cursor item entry posts no sync-complete (guards premature reconcile)", midCompleteMsgs.length);

// 7. GraphQL error envelope -> ignored, no completion/reconcile signal
const beforeGraphQLError = messages.length;
await context.window.fetch("https://x.com/i/api/graphql/abc/BlockedAccounts?case=error");
await flush();
await flush();
check(messages.length === beforeGraphQLError, "GraphQL error envelope posts no sync message", messages.length);

// 8. Transient empty/malformed timeline body without cursor entries -> ignored
const beforeTransient = messages.length;
await context.window.fetch("https://x.com/i/api/graphql/abc/BlockedAccounts?case=transient");
await flush();
await flush();
check(messages.length === beforeTransient, "empty body without timeline entries posts no sync-complete", messages.length);

// 9. Non-2xx list response -> ignored
const beforeNon2xx = messages.length;
await context.window.fetch("https://x.com/i/api/graphql/abc/BlockedAccounts?case=non-2xx");
await flush();
await flush();
check(messages.length === beforeNon2xx, "non-2xx list response posts no sync message", messages.length);

// 10. Injection order resilience -> missing SyncCapture must not poison the install guard.
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

// 11. 同じ宣言的scriptが同一documentで再評価されても、最初のhook APIを保持する。
// APIを上書きすると2回目のuninstallが初回世代を停止できず、再install後に本文読取と
// messageが世代数だけ重複するため、script評価単位でもidempotentであることを固定する。
let duplicateEvaluationTextReadCount = 0;
const duplicateEvaluationMessages = [];
const duplicateEvaluationLocation = {
  origin: "https://x.com",
  href: "https://x.com/settings/blocked/all"
};
const duplicateEvaluationContext = createContext({
  console,
  JSON,
  URL,
  location: duplicateEvaluationLocation,
  window: {
    fetch: () =>
      Promise.resolve(
        new FakeResponse(blockedBody, 200, {
          onText: () => {
            duplicateEvaluationTextReadCount += 1;
          }
        })
      ),
    postMessage: (message, targetOrigin) => {
      duplicateEvaluationMessages.push({ message, targetOrigin });
    }
  },
  XMLHttpRequest: createFakeXMLHttpRequestClass()
});
duplicateEvaluationContext.globalThis = duplicateEvaluationContext;
new Script(await readText("src/sync/sync-capture.js"), {
  filename: "src/sync/sync-capture.js"
}).runInContext(duplicateEvaluationContext);
const duplicateEvaluationOriginalFetch = duplicateEvaluationContext.window.fetch;
const duplicateEvaluationOriginalXhrOpen = duplicateEvaluationContext.XMLHttpRequest.prototype.open;
const duplicateEvaluationHookSource = await readText("src/sync/sync-hook.js");
new Script(duplicateEvaluationHookSource, { filename: "src/sync/sync-hook.js" }).runInContext(
  duplicateEvaluationContext
);
const firstEvaluationApi = duplicateEvaluationContext.XTrueBlockMuteSyncHook;
const firstEvaluationFetch = duplicateEvaluationContext.window.fetch;
const firstEvaluationXhrOpen = duplicateEvaluationContext.XMLHttpRequest.prototype.open;
new Script(duplicateEvaluationHookSource, { filename: "src/sync/sync-hook.js" }).runInContext(
  duplicateEvaluationContext
);
check(
  duplicateEvaluationContext.XTrueBlockMuteSyncHook === firstEvaluationApi,
  "duplicate script evaluation preserves the installed hook API"
);
check(
  duplicateEvaluationContext.window.fetch === firstEvaluationFetch,
  "duplicate script evaluation does not wrap fetch again"
);
check(
  duplicateEvaluationContext.XMLHttpRequest.prototype.open === firstEvaluationXhrOpen,
  "duplicate script evaluation does not wrap XMLHttpRequest.open again"
);
duplicateEvaluationContext.XTrueBlockMuteSyncHook.uninstallSyncHook();
check(
  duplicateEvaluationContext.window.fetch === duplicateEvaluationOriginalFetch,
  "duplicate script evaluation keeps fetch teardown ownership"
);
check(
  duplicateEvaluationContext.XMLHttpRequest.prototype.open === duplicateEvaluationOriginalXhrOpen,
  "duplicate script evaluation keeps XMLHttpRequest.open teardown ownership"
);
duplicateEvaluationContext.XTrueBlockMuteSyncHook.installSyncHook("x-tbm:sync:capture");
await duplicateEvaluationContext.window.fetch(
  "https://x.com/i/api/graphql/abc/BlockedAccounts?case=duplicate-evaluation-reinstall"
);
await flush();
await flush();
check(
  duplicateEvaluationTextReadCount === 1,
  "reinstall after duplicate script evaluation reads an eligible response once",
  duplicateEvaluationTextReadCount
);
check(
  duplicateEvaluationMessages.filter(
    (m) =>
      m.message.source === "x-tbm:sync:capture" &&
      m.message.kind === "sync-entries" &&
      m.message.listKind === "blocked"
  ).length === 1,
  "reinstall after duplicate script evaluation posts one sync-entries message",
  duplicateEvaluationMessages
);

// 12. Explicit teardown -> future requests are not wrapped, and the hook remains reinstallable.
let teardownListTextReadCount = 0;
let teardownXhrTextReadCount = 0;
const teardownMessages = [];
const teardownLocation = { origin: "https://x.com", href: "https://x.com/settings/blocked/all" };
const teardownContext = createContext({
  console,
  JSON,
  URL,
  location: teardownLocation,
  window: {
    fetch: () =>
      Promise.resolve(
        new FakeResponse(blockedBody, 200, {
          onText: () => {
            teardownListTextReadCount += 1;
          }
        })
      ),
    postMessage: (message, targetOrigin) => {
      teardownMessages.push({ message, targetOrigin });
    }
  },
  XMLHttpRequest: createFakeXMLHttpRequestClass()
});
teardownContext.globalThis = teardownContext;
new Script(await readText("src/sync/sync-capture.js"), { filename: "src/sync/sync-capture.js" }).runInContext(
  teardownContext
);
const teardownOriginalFetch = teardownContext.window.fetch;
const teardownOriginalXhrOpen = teardownContext.XMLHttpRequest.prototype.open;
new Script(await readText("src/sync/sync-hook.js"), { filename: "src/sync/sync-hook.js" }).runInContext(
  teardownContext
);
check(
  typeof teardownContext.XTrueBlockMuteSyncHook.uninstallSyncHook === "function",
  "sync hook exposes explicit uninstall"
);
check(teardownContext.window.fetch !== teardownOriginalFetch, "teardown scenario starts with wrapped fetch");
const beforeInFlightTeardownMessages = teardownMessages.length;
const inFlightTeardownFetch = teardownContext.window.fetch(
  "https://x.com/i/api/graphql/abc/BlockedAccounts?case=in-flight-before-uninstall"
);
const inFlightTeardownXhr = new teardownContext.XMLHttpRequest();
inFlightTeardownXhr.open("GET", "https://x.com/i/api/graphql/abc/BlockedAccounts?case=xhr-before-uninstall");
inFlightTeardownXhr.responseText = blockedBody;
inFlightTeardownXhr.onResponseTextRead = () => {
  teardownXhrTextReadCount += 1;
};
teardownContext.XTrueBlockMuteSyncHook.uninstallSyncHook();
check(teardownContext.window.fetch === teardownOriginalFetch, "uninstall restores original fetch");
check(
  teardownContext.XMLHttpRequest.prototype.open === teardownOriginalXhrOpen,
  "uninstall restores original XMLHttpRequest.open"
);
check(!teardownContext.window.__xTbmSyncHookInstalled, "uninstall clears installed guard");
inFlightTeardownXhr.complete();
await inFlightTeardownFetch;
await flush();
await flush();
check(
  teardownListTextReadCount === 0,
  "in-flight fetch scheduled before uninstall does not read after uninstall",
  teardownListTextReadCount
);
check(
  teardownXhrTextReadCount === 0,
  "in-flight XHR opened before uninstall does not read after uninstall",
  teardownXhrTextReadCount
);
check(
  teardownMessages.length === beforeInFlightTeardownMessages,
  "in-flight requests post no messages after uninstall",
  teardownMessages
);
await teardownContext.window.fetch("https://x.com/i/api/graphql/abc/BlockedAccounts?case=after-uninstall");
await flush();
await flush();
check(teardownListTextReadCount === 0, "uninstalled hook does not read eligible response bodies", teardownListTextReadCount);
check(teardownMessages.length === 0, "uninstalled hook posts no sync messages", teardownMessages);
teardownContext.XTrueBlockMuteSyncHook.installSyncHook("x-tbm:sync:capture");
await teardownContext.window.fetch("https://x.com/i/api/graphql/abc/BlockedAccounts?case=after-reinstall");
await flush();
await flush();
check(teardownListTextReadCount === 1, "reinstalled hook reads eligible response once", teardownListTextReadCount);
check(
  teardownMessages.filter((m) => m.message.source === "x-tbm:sync:capture" && m.message.kind === "sync-entries")
    .length === 1,
  "reinstalled hook posts one sync-entries message",
  teardownMessages
);

// uninstall前から存在するXHR objectも、再install後は現世代のlistenerを得る。
// 旧世代listenerはinactiveのままなので、本文読取とmessageはそれぞれ1回だけ。
const beforeReusedXhrMessages = teardownMessages.length;
inFlightTeardownXhr.open(
  "GET",
  "https://x.com/i/api/graphql/abc/BlockedAccounts?case=reused-xhr-after-reinstall"
);
inFlightTeardownXhr.responseText = blockedBody;
inFlightTeardownXhr.complete();
await flush();
check(
  teardownXhrTextReadCount === 1,
  "reinstalled hook reads a reused XHR response exactly once",
  teardownXhrTextReadCount
);
check(
  teardownMessages
    .slice(beforeReusedXhrMessages)
    .filter(
      (m) =>
        m.message.source === "x-tbm:sync:capture" &&
        m.message.kind === "sync-entries" &&
        m.message.listKind === "blocked"
    ).length === 1,
  "reinstalled hook posts one message for a reused XHR object",
  teardownMessages.slice(beforeReusedXhrMessages)
);

// 13. 外部wrapperが旧hookを保持していても、inactive世代は新規XHRへ
// noop listenerを追加しない。再install回数に比例するcallback蓄積を防ぐ。
let wrapperFetchTextReadCount = 0;
let foreignFetchCallCount = 0;
let wrapperFetchUrlReadCount = 0;
let wrapperXhrTextReadCount = 0;
let foreignOpenCallCount = 0;
const wrapperMessages = [];
const wrapperLocation = { origin: "https://x.com", href: "https://x.com/settings/blocked/all" };
const wrapperContext = createContext({
  console,
  JSON,
  URL,
  location: wrapperLocation,
  window: {
    fetch: () =>
      Promise.resolve(
        new FakeResponse(blockedBody, 200, {
          onText: () => {
            wrapperFetchTextReadCount += 1;
          }
        })
      ),
    postMessage: (message, targetOrigin) => {
      wrapperMessages.push({ message, targetOrigin });
    }
  },
  XMLHttpRequest: createFakeXMLHttpRequestClass()
});
wrapperContext.globalThis = wrapperContext;
new Script(await readText("src/sync/sync-capture.js"), { filename: "src/sync/sync-capture.js" }).runInContext(
  wrapperContext
);
new Script(await readText("src/sync/sync-hook.js"), { filename: "src/sync/sync-hook.js" }).runInContext(
  wrapperContext
);
const firstGenerationFetch = wrapperContext.window.fetch;
const firstGenerationOpen = wrapperContext.XMLHttpRequest.prototype.open;
function foreignFetch() {
  foreignFetchCallCount += 1;
  return firstGenerationFetch.apply(this, arguments);
}
function foreignOpen() {
  foreignOpenCallCount += 1;
  const result = firstGenerationOpen.apply(this, arguments);
  if (arguments[0] === "FOREIGN_THROW_AFTER_OPEN") {
    throw new Error("synthetic foreign wrapper failure after delegate");
  }
  return result;
}
wrapperContext.window.fetch = foreignFetch;
wrapperContext.XMLHttpRequest.prototype.open = foreignOpen;
wrapperContext.XTrueBlockMuteSyncHook.uninstallSyncHook();
check(wrapperContext.window.fetch === foreignFetch, "uninstall preserves a foreign fetch wrapper");
check(
  wrapperContext.XMLHttpRequest.prototype.open === foreignOpen,
  "uninstall preserves a foreign XMLHttpRequest.open wrapper"
);
wrapperContext.XTrueBlockMuteSyncHook.installSyncHook("x-tbm:sync:capture");
const wrapperFetchInput = {};
Object.defineProperty(wrapperFetchInput, "url", {
  enumerable: true,
  get() {
    wrapperFetchUrlReadCount += 1;
    return "https://x.com/i/api/graphql/abc/BlockedAccounts?case=foreign-fetch-wrapper-reinstall";
  }
});
await wrapperContext.window.fetch(wrapperFetchInput);
await flush();
await flush();
check(
  wrapperFetchUrlReadCount === 2,
  "inactive hook generation does not reevaluate fetch input through a foreign wrapper",
  wrapperFetchUrlReadCount
);
check(foreignFetchCallCount === 1, "reinstalled hook preserves one foreign fetch call", foreignFetchCallCount);
check(wrapperFetchTextReadCount === 1, "current hook reads the foreign-wrapped fetch once", wrapperFetchTextReadCount);
check(
  wrapperMessages.filter(
    (m) =>
      m.message.source === "x-tbm:sync:capture" &&
      m.message.kind === "sync-entries" &&
      m.message.listKind === "blocked"
  ).length === 1,
  "current hook posts one message through a foreign fetch wrapper",
  wrapperMessages
);
const beforeWrappedAgainXhrMessages = wrapperMessages.length;
const wrappedAgainXhr = new wrapperContext.XMLHttpRequest();
wrappedAgainXhr.open(
  "GET",
  "https://x.com/i/api/graphql/abc/BlockedAccounts?case=foreign-wrapper-reinstall"
);
wrappedAgainXhr.responseText = blockedBody;
wrappedAgainXhr.onResponseTextRead = () => {
  wrapperXhrTextReadCount += 1;
};
check(
  (wrappedAgainXhr.listeners.readystatechange || []).length === 1,
  "inactive hook generation does not add a stale readystatechange listener through a foreign wrapper",
  (wrappedAgainXhr.listeners.readystatechange || []).length
);
wrappedAgainXhr.complete();
await flush();
check(foreignOpenCallCount === 1, "reinstalled hook preserves one foreign open call", foreignOpenCallCount);
check(wrapperXhrTextReadCount === 1, "current hook reads the foreign-wrapped XHR once", wrapperXhrTextReadCount);
check(
  wrapperMessages
    .slice(beforeWrappedAgainXhrMessages)
    .filter(
      (m) =>
        m.message.source === "x-tbm:sync:capture" &&
        m.message.kind === "sync-entries" &&
        m.message.listKind === "blocked"
    ).length === 1,
  "current hook posts one message through a foreign XMLHttpRequest.open wrapper",
  wrapperMessages.slice(beforeWrappedAgainXhrMessages)
);

// 外部wrapperがnative相当のopenへ委譲した後でthrowした場合、旧request stateを
// 復元すると新しいnon-list responseを旧eligible URLへ誤対応する。stateを破棄してfail closedにする。
const beforeForeignThrowMessages = wrapperMessages.length;
let foreignThrowTextReadCount = 0;
let foreignThrowPreservedError = false;
const foreignThrowXhr = new wrapperContext.XMLHttpRequest();
foreignThrowXhr.open(
  "GET",
  "https://x.com/i/api/graphql/abc/BlockedAccounts?case=before-foreign-throw"
);
try {
  foreignThrowXhr.open(
    "FOREIGN_THROW_AFTER_OPEN",
    "https://x.com/i/api/graphql/abc/HomeTimeline?case=foreign-throw-after-open"
  );
} catch (error) {
  foreignThrowPreservedError = error.message === "synthetic foreign wrapper failure after delegate";
}
foreignThrowXhr.responseText = blockedBody;
foreignThrowXhr.onResponseTextRead = () => {
  foreignThrowTextReadCount += 1;
};
foreignThrowXhr.complete();
await flush();
check(foreignThrowPreservedError, "foreign open wrapper preserves its synchronous delegated error");
check(
  foreignThrowTextReadCount === 0,
  "foreign throw after delegate does not read the new non-list response through the previous eligible state",
  foreignThrowTextReadCount
);
check(
  wrapperMessages.length === beforeForeignThrowMessages,
  "foreign throw after delegate posts no message from the new non-list response",
  wrapperMessages.slice(beforeForeignThrowMessages)
);

if (failures.length > 0) {
  console.error(`\nSync hook verification FAILED: ${failures.length} check(s) failed`);
  process.exit(1);
}
console.log("\nSync hook verification passed");
