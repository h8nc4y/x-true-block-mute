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

async function loadResearchF1A() {
  const context = createContext({
    console,
    Date,
    URL
  });
  context.globalThis = context;
  new Script(await readText("src/shared/constants.js"), { filename: "src/shared/constants.js" }).runInContext(context);
  new Script(await readText("src/research/f1-a/observation-utils.js"), {
    filename: "src/research/f1-a/observation-utils.js"
  }).runInContext(context);
  return context.XTrueBlockMute.ResearchF1A;
}

const ResearchF1A = await loadResearchF1A();
const rawLookingObservation = {
  observedAt: "2026-05-21T00:00:00.000Z",
  pageKind: "blocked",
  requestKind: "fetch",
  method: "GET",
  endpointClass:
    "https://x.com/i/api/graphql/12345678901234567890/BlockedAccounts?cursor=raw-cursor-value&auth_token=synthetic-sensitive-value",
  statusClass: "2xx",
  responseKind: "json",
  hookRunId: "hook-test",
  topLevelKeys: ["data", "12345678901234567890", "@raw_handle"],
  shapePaths: ["$.data.users.12345678901234567890.id_str", "$.data.users.@raw_handle.screen_name"],
  queryKeys: ["cursor", "auth_token"],
  arrayHints: [{ path: "$.data.users.12345678901234567890", count: 1 }],
  fieldPresence: { userIdLike: true, handleLike: true, cursorLike: true }
};

const normalized = ResearchF1A.normalizeObservation(rawLookingObservation);
const normalizedText = JSON.stringify(normalized);
assert(!normalizedText.includes("12345678901234567890"), "long numeric id-like values must be masked");
assert(!normalizedText.includes("@raw_handle"), "raw handle-looking keys must be masked");
assert(!normalizedText.includes("raw-cursor-value"), "query values must be masked");
assert(!normalizedText.includes("synthetic-sensitive-value"), "token values must be masked");
assert(normalized.fieldPresence.paginationLike, "cursorLike should imply paginationLike");

const unsafe = ResearchF1A.evaluateObservationSummary({
  observations: [
    {
      pageKind: "blocked",
      requestKind: "fetch",
      rawResponse: { user_id: "12345678901234567890", screen_name: "@raw_handle" }
    }
  ]
});
assert(unsafe.status === "unsafe_summary", "raw-looking summary must be rejected");

const fixture = JSON.parse(await readText("tests/fixtures/f1-a-masked-summary.fixture.json"));
const fixtureResult = ResearchF1A.evaluateObservationSummary(fixture);
assert(fixtureResult.status === "fixture_pass", "fixture should pass only as fixture_pass");

const liveResult = ResearchF1A.evaluateObservationSummary(fixture, { mode: "live" });
assert(liveResult.status === "fixture_pass", "fixture source must not become f1a_viable even in live mode");

const liveLikeSummary = {
  observations: fixture.observations.map((observation) => ({ ...observation, sourceKind: "unknown" }))
};
const liveLikeResult = ResearchF1A.evaluateObservationSummary(liveLikeSummary, { mode: "live" });
assert(liveLikeResult.status === "f1a_viable", "live mode can return f1a_viable for complete non-fixture masked summary");

const insufficient = ResearchF1A.evaluateObservationSummary({
  observations: fixture.observations.filter((observation) => observation.pageKind === "blocked")
});
assert(insufficient.status === "f1a_insufficient", "missing muted observation must be insufficient");
assert(insufficient.missing.includes("muted observation"), "insufficient result should list missing muted observation");

console.log("F1-A observation safety verification passed");
