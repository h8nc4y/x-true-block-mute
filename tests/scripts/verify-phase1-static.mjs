import { readFile } from "node:fs/promises";
import { Script } from "node:vm";

const root = new URL("../../", import.meta.url);
const requiredFiles = [
  "manifest.json",
  "src/shared/constants.js",
  "src/research/f1-a/observation-utils.js",
  "src/storage/storage.js",
  "src/background/research-background.js",
  "src/content/content-script.js",
  "src/content/content-script.css",
  "src/research/f1-a/content-bridge.js",
  "src/research/f1-a/main-world-hook.js",
  "src/popup/popup.html",
  "src/popup/popup.css",
  "src/popup/popup.js",
  "tests/fixtures/home-timeline.html",
  "tests/fixtures/f1-a-local-simulator.html",
  "tests/fixtures/f1-a-masked-summary.fixture.json",
  "tests/scripts/evaluate-f1-observation.mjs",
  "tests/scripts/audit-operational-alignment.mjs",
  "tests/scripts/verify-f1a-main-hook-simulator.mjs",
  "tests/scripts/verify-f1a-observation-safety.mjs"
];
const prohibitedValues = [
  "webRequest",
  "cookies",
  "tabs",
  "activeTab",
  "<all_urls>",
  "https://api.x.com/*"
];

async function readText(path) {
  return readFile(new URL(path, root), "utf8");
}

function assert(condition, message) {
  if (!condition) {
    throw new Error(message);
  }
}

function assertSameStringArray(actual, expected, message) {
  assert(JSON.stringify(actual) === JSON.stringify(expected), message);
}

function extractQuotedStrings(text) {
  return Array.from(text.matchAll(/"([^"]+)"/g)).map((match) => match[1]);
}

function extractSetStrings(text, name) {
  const pattern = new RegExp(`const ${name} = new Set\\(\\[([\\s\\S]*?)\\]\\);`);
  const match = text.match(pattern);
  assert(match, `missing Set definition: ${name}`);
  return extractQuotedStrings(match[1]).sort();
}

function extractMappedStringArray(text, name) {
  const pattern = new RegExp(`const ${name} = new Map\\(\\s*\\[([\\s\\S]*?)\\]\\.map`);
  const match = text.match(pattern);
  assert(match, `missing mapped string array definition: ${name}`);
  return extractQuotedStrings(match[1]).sort();
}

function extractSharedResearchConstant(text, name) {
  const match = text.match(new RegExp(`${name}:\\s*"([^"]+)"`));
  assert(match, `missing shared research constant: ${name}`);
  return match[1];
}

function extractLocalConstant(text, name) {
  const match = text.match(new RegExp(`const ${name} = "([^"]+)"`));
  assert(match, `missing local constant: ${name}`);
  return match[1];
}

const manifest = JSON.parse(await readText("manifest.json"));
assert(manifest.manifest_version === 3, "manifest_version must remain 3");
assert(Array.isArray(manifest.permissions), "permissions must be declared");
assert(
  JSON.stringify(manifest.permissions) === JSON.stringify(["storage", "scripting"]),
  "Phase 1.5 may use only storage and scripting permissions"
);
assert(
  JSON.stringify(manifest.host_permissions) === JSON.stringify(["https://x.com/*", "https://twitter.com/*"]),
  "host_permissions must remain limited to x.com and twitter.com"
);
assert(manifest.action?.default_popup === "src/popup/popup.html", "popup must be registered");
assert(Array.isArray(manifest.content_scripts) && manifest.content_scripts.length === 2, "Phase 1.5 expects normal and research content scripts");
assert(
  manifest.background?.service_worker === "src/background/research-background.js",
  "Phase 1.5 research background service worker must be registered"
);
assert(
  manifest.content_scripts[0].run_at === "document_start" &&
    manifest.content_scripts[0].js.includes("src/research/f1-a/observation-utils.js") &&
    manifest.content_scripts[0].js.indexOf("src/research/f1-a/observation-utils.js") <
      manifest.content_scripts[0].js.indexOf("src/storage/storage.js") &&
    manifest.content_scripts[0].js.includes("src/research/f1-a/content-bridge.js"),
  "research bridge must run at document_start with observation-utils before storage"
);
assert(
  manifest.content_scripts[1].run_at === "document_idle" &&
    manifest.content_scripts[1].js.includes("src/research/f1-a/observation-utils.js") &&
    manifest.content_scripts[1].js.indexOf("src/research/f1-a/observation-utils.js") <
      manifest.content_scripts[1].js.indexOf("src/storage/storage.js") &&
    manifest.content_scripts[1].js.includes("src/content/content-script.js"),
  "normal Phase 1 content script must remain document_idle with observation-utils before storage"
);
const settingsPageMatches = [
  "https://x.com/settings/blocked/all*",
  "https://x.com/settings/muted/all*",
  "https://twitter.com/settings/blocked/all*",
  "https://twitter.com/settings/muted/all*"
];
assertSameStringArray(manifest.content_scripts[0].matches, settingsPageMatches, "research bridge must stay limited to settings pages");
assert(
  !("exclude_matches" in manifest.content_scripts[0]),
  "research bridge must keep settings page access without exclude_matches"
);
assertSameStringArray(
  manifest.content_scripts[1].exclude_matches,
  settingsPageMatches,
  "normal filter content script must exclude settings pages while research bridge keeps them"
);

const manifestText = JSON.stringify(manifest);
for (const value of prohibitedValues) {
  assert(!manifestText.includes(value), `prohibited permission or host found: ${value}`);
}

for (const file of requiredFiles) {
  await readText(file);
}

for (const file of requiredFiles.filter((file) => file.endsWith(".js"))) {
  new Script(await readText(file), { filename: file });
}

const contentScript = await readText("src/content/content-script.js");
assert(contentScript.includes("MutationObserver"), "content script must use MutationObserver");
assert(contentScript.includes("data-user-id"), "synthetic user_id fixture attribute must be supported");
assert(contentScript.includes("data-handle"), "synthetic handle fixture attribute must be supported");
assert(!contentScript.includes("fetch("), "production content script must not fetch F1/API data");
assert(!contentScript.includes("XMLHttpRequest"), "production content script must not hook XHR");
assert(!contentScript.includes("__xTbmOriginalCard"), "content script must not keep unused original-card expando state");

const backgroundScript = await readText("src/background/research-background.js");
const constantsScript = await readText("src/shared/constants.js");
const bridgeScript = await readText("src/research/f1-a/content-bridge.js");
const mainWorldHookScript = await readText("src/research/f1-a/main-world-hook.js");
const observationUtilsScript = await readText("src/research/f1-a/observation-utils.js");
const storageScript = await readText("src/storage/storage.js");
assert(
  extractLocalConstant(backgroundScript, "MESSAGE_INJECT") ===
    extractSharedResearchConstant(constantsScript, "MESSAGE_INJECT"),
  "background MESSAGE_INJECT must match shared RESEARCH_F1A constant"
);
assert(
  extractLocalConstant(backgroundScript, "PAGE_MESSAGE_SOURCE") ===
    extractSharedResearchConstant(constantsScript, "PAGE_MESSAGE_SOURCE"),
  "background PAGE_MESSAGE_SOURCE must match shared RESEARCH_F1A constant"
);
assert(backgroundScript.includes('world: "MAIN"'), "research injection must target MAIN world");
assert(backgroundScript.includes("main-world-hook.js"), "background must import the tested main world hook");
assert(mainWorldHookScript.includes("window.fetch"), "research hook must wrap fetch");
assert(mainWorldHookScript.includes("XMLHttpRequest.prototype.open"), "research hook must wrap XMLHttpRequest");
assert(mainWorldHookScript.includes("window.postMessage"), "MAIN world hook must use page messaging instead of chrome APIs");
assert(mainWorldHookScript.includes("hookRunId"), "MAIN world hook must tag observations for continuity checks");
assert(!backgroundScript.includes("chrome.storage"), "MAIN world hook path must not use chrome.storage");
assert(bridgeScript.includes("appendF1AResearchObservation"), "bridge must persist only normalized research observations");
assert(storageScript.includes("F1A_RESEARCH"), "research storage must be separate from xtbmEntries");
assert(
  storageScript.includes("getResearchF1A().normalizeObservation"),
  "research storage must use the shared masked observation normalizer"
);
assert(storageScript.includes("function getResearchF1A()"), "storage must resolve ResearchF1A lazily at call time");
assert(!/\bResearchF1A,\s*\n/.test(storageScript), "storage must not destructure ResearchF1A at initial evaluation time");
assert(observationUtilsScript.includes("evaluateObservationSummary"), "observation evaluator must be available");
assert(observationUtilsScript.includes("findUnsafeSummarySignals"), "unsafe summary detection must be available");
assertSameStringArray(
  extractSetStrings(mainWorldHookScript, "safeSchemaKeys"),
  extractSetStrings(observationUtilsScript, "SAFE_SCHEMA_KEYS"),
  "MAIN world hook and observation-utils SAFE_SCHEMA_KEYS must stay aligned"
);
assertSameStringArray(
  extractMappedStringArray(mainWorldHookScript, "safeEndpointPathSegments"),
  extractMappedStringArray(observationUtilsScript, "SAFE_ENDPOINT_PATH_SEGMENTS"),
  "MAIN world hook and observation-utils endpoint segment allowlists must stay aligned"
);
assert(!storageScript.includes("xtbmEntries") || storageScript.includes("xtbmF1AResearch"), "research observations must not be mixed into xtbmEntries");

const popupHtml = await readText("src/popup/popup.html");
const popupScripts = Array.from(popupHtml.matchAll(/<script src="([^"]+)"><\/script>/g)).map((match) => match[1]);
assert(
  popupScripts.indexOf("../research/f1-a/observation-utils.js") < popupScripts.indexOf("../storage/storage.js"),
  "popup must load observation-utils before storage"
);
assert(popupHtml.includes("ローカル確認用データ"), "popup must label local test data clearly");
assert(popupHtml.includes("次に確認すること"), "popup must explain the next verification step");
assert(popupHtml.includes("ブロック / ミュート"), "popup must separate blocked and muted observation counts");
assert(popupHtml.includes("安全な要約をコピー（masked summary）"), "popup must expose masked summary copy flow");
assert(popupHtml.includes("本番同期ではありません"), "popup must label research flow as non-production sync");
assert(popupHtml.includes("raw response はコピーしません"), "popup must explicitly say raw response is not copied");

console.log("Phase 1.5 static verification passed");
