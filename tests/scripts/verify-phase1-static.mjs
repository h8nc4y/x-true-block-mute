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
    manifest.content_scripts[0].js.includes("src/research/f1-a/content-bridge.js"),
  "research bridge must run at document_start"
);
assert(
  manifest.content_scripts[1].run_at === "document_idle" &&
    manifest.content_scripts[1].js.includes("src/research/f1-a/observation-utils.js") &&
    manifest.content_scripts[1].js.includes("src/content/content-script.js"),
  "normal Phase 1 content script must remain document_idle"
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

const backgroundScript = await readText("src/background/research-background.js");
const bridgeScript = await readText("src/research/f1-a/content-bridge.js");
const mainWorldHookScript = await readText("src/research/f1-a/main-world-hook.js");
const observationUtilsScript = await readText("src/research/f1-a/observation-utils.js");
const storageScript = await readText("src/storage/storage.js");
assert(backgroundScript.includes('world: "MAIN"'), "research injection must target MAIN world");
assert(backgroundScript.includes("main-world-hook.js"), "background must import the tested main world hook");
assert(mainWorldHookScript.includes("window.fetch"), "research hook must wrap fetch");
assert(mainWorldHookScript.includes("XMLHttpRequest.prototype.open"), "research hook must wrap XMLHttpRequest");
assert(mainWorldHookScript.includes("window.postMessage"), "MAIN world hook must use page messaging instead of chrome APIs");
assert(mainWorldHookScript.includes("hookRunId"), "MAIN world hook must tag observations for continuity checks");
assert(!backgroundScript.includes("chrome.storage"), "MAIN world hook path must not use chrome.storage");
assert(bridgeScript.includes("appendF1AResearchObservation"), "bridge must persist only normalized research observations");
assert(storageScript.includes("F1A_RESEARCH"), "research storage must be separate from xtbmEntries");
assert(storageScript.includes("ResearchF1A.normalizeObservation"), "research storage must use the shared masked observation normalizer");
assert(observationUtilsScript.includes("evaluateObservationSummary"), "observation evaluator must be available");
assert(observationUtilsScript.includes("findUnsafeSummarySignals"), "unsafe summary detection must be available");
assert(!storageScript.includes("xtbmEntries") || storageScript.includes("xtbmF1AResearch"), "research observations must not be mixed into xtbmEntries");

const popupHtml = await readText("src/popup/popup.html");
assert(popupHtml.includes("masked summary をコピー"), "popup must expose masked summary copy flow");
assert(popupHtml.includes("本番同期ではありません"), "popup must label research flow as non-production sync");
assert(popupHtml.includes("raw response はコピーしません"), "popup must explicitly say raw response is not copied");

console.log("Phase 1.5 static verification passed");
