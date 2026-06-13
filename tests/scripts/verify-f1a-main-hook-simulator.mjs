import { readFile } from "node:fs/promises";
import { Script, createContext } from "node:vm";

const root = new URL("../../", import.meta.url);

async function readText(path) {
  return readFile(new URL(path, root), "utf8");
}

function assert(condition, message) {
  if (!condition) {
    throw new Error(message);
  }
}

function flushAsyncInspection() {
  return new Promise((resolve) => setImmediate(resolve));
}

class FakeResponse {
  constructor(body, status = 200, contentType = "application/json") {
    this.body = body;
    this.status = status;
    this.contentType = contentType;
    this.headers = {
      get: (name) => (String(name).toLowerCase() === "content-type" ? this.contentType : "")
    };
  }

  clone() {
    return new FakeResponse(this.body, this.status, this.contentType);
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
    this.status = 0;
    this.contentType = "application/json";
  }

  addEventListener(type, listener) {
    this.listeners[type] = this.listeners[type] || [];
    this.listeners[type].push(listener);
  }

  getResponseHeader(name) {
    return String(name).toLowerCase() === "content-type" ? this.contentType : "";
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

const messages = [];
const locationState = {
  origin: "https://x.com",
  href: "https://x.com/settings/blocked/all",
  pathname: "/settings/blocked/all"
};
const syntheticJson = JSON.stringify({
  data: {
    users: [
      {
        rest_id: "12345678901234567890",
        legacy: {
          screen_name: "raw_handle_value_should_not_be_saved",
          name: "Raw Display Name Should Not Be Saved"
        }
      }
    ],
    next_cursor: "raw-cursor-value-should-not-be-saved"
  }
});

// A GraphQL-timeline-style body whose only pagination signal is a cursor entry
// nested deep inside instructions[].entries[] as the LAST element — exactly the
// shape the shallow shapePath scan cannot reach. The raw id/handle/cursor values
// must never appear in the emitted observation.
const timelineCursorJson = JSON.stringify({
  data: {
    user: {
      result: {
        timeline: {
          timeline: {
            instructions: [
              {
                type: "TimelineAddEntries",
                entries: [
                  {
                    entryId: "user-001",
                    sortIndex: "1000",
                    content: {
                      itemContent: {
                        user_results: {
                          result: { rest_id: "12345678901234567890", legacy: { screen_name: "raw_handle_value_should_not_be_saved" } }
                        }
                      }
                    }
                  },
                  {
                    entryId: "cursor-bottom-DEEP",
                    sortIndex: "0",
                    content: {
                      entryType: "TimelineTimelineCursor",
                      __typename: "TimelineTimelineCursor",
                      cursorType: "Bottom",
                      value: "deep-cursor-value-should-not-be-saved"
                    }
                  }
                ]
              }
            ]
          }
        }
      }
    }
  }
});

const windowObject = {
  fetch: (url) => {
    const text = String(url || "");
    if (text.includes("DeepTL")) {
      return Promise.resolve(new FakeResponse(timelineCursorJson));
    }
    return Promise.resolve(new FakeResponse(syntheticJson));
  },
  postMessage: (message, targetOrigin) => {
    messages.push({ message, targetOrigin });
  }
};
const context = createContext({
  console,
  Date,
  Math,
  URL,
  XMLHttpRequest: FakeXMLHttpRequest,
  location: locationState,
  window: windowObject
});
context.globalThis = context;

new Script(await readText("src/research/f1-a/main-world-hook.js"), {
  filename: "src/research/f1-a/main-world-hook.js"
}).runInContext(context);

context.XTrueBlockMuteF1AMainWorldHook.installMainWorldHook("x-tbm:f1a:main-world-hook");
context.XTrueBlockMuteF1AMainWorldHook.installMainWorldHook("x-tbm:f1a:main-world-hook");

await context.window.fetch("https://x.com/i/api/graphql/12345678901234567890/BlockedAccounts?cursor=raw-cursor-value");
await flushAsyncInspection();
await flushAsyncInspection();
assert(messages.length === 1, "fetch should produce one observation and idempotency should prevent double wrapping");

locationState.pathname = "/settings/muted/all";
locationState.href = "https://x.com/settings/muted/all";
const xhr = new context.XMLHttpRequest();
xhr.open("GET", "https://x.com/i/api/graphql/12345678901234567890/MutedAccounts?cursor=raw-cursor-value");
xhr.status = 200;
xhr.responseText = syntheticJson;
xhr.dispatch("loadend");
assert(messages.length === 2, "XHR should produce a second observation");

const observations = messages.map((entry) => entry.message.observation);
const output = JSON.stringify(observations);
assert(!output.includes("12345678901234567890"), "hook observations must not include raw id-like values");
assert(!output.includes("raw_handle_value_should_not_be_saved"), "hook observations must not include raw handle values");
assert(!output.includes("Raw Display Name Should Not Be Saved"), "hook observations must not include display names");
assert(!output.includes("raw-cursor-value"), "hook observations must not include raw cursor values");
assert(observations[0].pageKind === "blocked", "fetch observation should be blocked");
assert(observations[1].pageKind === "muted", "XHR observation should be muted");
assert(observations[0].fieldPresence.userIdLike, "fetch observation should detect user_id-like fields");
assert(observations[0].fieldPresence.handleLike, "fetch observation should detect handle-like fields");
assert(observations[0].fieldPresence.paginationLike, "fetch observation should detect pagination-like fields");
assert(observations[0].hookRunId === observations[1].hookRunId, "same hookRunId should support SPA continuity evaluation");

// Deep timeline cursor: pagination signal is only reachable by the dedicated
// deep detector (nested past the shapePath depth limit, last array element).
await context.window.fetch("https://x.com/i/api/graphql/aaa/BlockedAccounts?DeepTL=1&variables=x");
await flushAsyncInspection();
await flushAsyncInspection();
assert(messages.length === 3, "deep timeline cursor fetch should produce a third observation");
const deep = messages[2].message.observation;
const deepOutput = JSON.stringify(deep);
assert(deep.fieldPresence.paginationLike === true, "deep nested timeline cursor (last entry) must set paginationLike");
assert(!deepOutput.includes("12345678901234567890"), "deep observation must not include raw id");
assert(!deepOutput.includes("raw_handle_value_should_not_be_saved"), "deep observation must not include raw handle");
assert(!deepOutput.includes("deep-cursor-value-should-not-be-saved"), "deep observation must not include raw cursor value");

console.log("F1-A MAIN world hook simulator verification passed");
