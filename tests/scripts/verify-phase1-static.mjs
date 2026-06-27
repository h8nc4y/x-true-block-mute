import { readFile } from "node:fs/promises";
import { Script } from "node:vm";

const root = new URL("../../", import.meta.url);
// observation-utils.js and main-world-hook.js are RETAINED as offline F1-A
// research-evidence files (exercised by verify-f1a-*.mjs); they are no longer
// shipped (not in the manifest, excluded from the package). research-background.js
// and content-bridge.js were deleted when the research injection + `scripting`
// permission were retired (M7).
const requiredFiles = [
  "manifest.json",
  "src/shared/constants.js",
  "src/research/f1-a/observation-utils.js",
  "src/storage/storage.js",
  "src/content/content-script.js",
  "src/content/content-script.css",
  "src/research/f1-a/main-world-hook.js",
  "src/sync/sync-capture.js",
  "src/sync/sync-hook.js",
  "src/sync/sync-bridge.js",
  "src/popup/popup.html",
  "src/popup/popup.css",
  "src/popup/popup.js",
  "src/options/options.html",
  "src/options/options.css",
  "src/options/options.js",
  "tests/fixtures/home-timeline.html",
  "tests/fixtures/f1-a-local-simulator.html",
  "tests/fixtures/f1-a-masked-summary.fixture.json",
  "tests/scripts/evaluate-f1-observation.mjs",
  "tests/scripts/audit-operational-alignment.mjs",
  "tests/scripts/verify-f1a-main-hook-simulator.mjs",
  "tests/scripts/verify-f1a-observation-safety.mjs"
];
const prohibitedValues = [
  "scripting",
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
  JSON.stringify(manifest.permissions) === JSON.stringify(["storage"]),
  "shipped extension must request only the storage permission (scripting retired in M7)"
);
assert(
  JSON.stringify(manifest.host_permissions) === JSON.stringify(["https://x.com/*", "https://twitter.com/*"]),
  "host_permissions must remain limited to x.com and twitter.com"
);
assert(manifest.action?.default_popup === "src/popup/popup.html", "popup must be registered");
assert(
  !("background" in manifest),
  "the research background service worker must be removed (no scripting injection)"
);
assert(Array.isArray(manifest.content_scripts) && manifest.content_scripts.length === 3, "expect settings ISOLATED sync bridge, normal filter, and production sync MAIN content scripts");
assert(
  manifest.content_scripts[0].run_at === "document_start" &&
    manifest.content_scripts[0].js.includes("src/storage/storage.js") &&
    manifest.content_scripts[0].js.includes("src/sync/sync-bridge.js") &&
    !manifest.content_scripts[0].js.includes("src/research/f1-a/observation-utils.js") &&
    !manifest.content_scripts[0].js.includes("src/research/f1-a/content-bridge.js"),
  "settings ISOLATED script runs at document_start with storage + sync-bridge and no research modules"
);
assert(
  manifest.content_scripts[1].run_at === "document_idle" &&
    manifest.content_scripts[1].js.includes("src/storage/storage.js") &&
    manifest.content_scripts[1].js.includes("src/content/content-script.js") &&
    !manifest.content_scripts[1].js.includes("src/research/f1-a/observation-utils.js"),
  "normal filter content script runs at document_idle with storage and no research modules"
);
const settingsPageMatches = [
  "https://x.com/settings/blocked/all*",
  "https://x.com/settings/muted/all*",
  "https://twitter.com/settings/blocked/all*",
  "https://twitter.com/settings/muted/all*"
];
assertSameStringArray(manifest.content_scripts[0].matches, settingsPageMatches, "settings ISOLATED script must stay limited to settings pages");
assert(
  !("exclude_matches" in manifest.content_scripts[0]),
  "settings ISOLATED script must keep settings page access without exclude_matches"
);
assertSameStringArray(
  manifest.content_scripts[1].exclude_matches,
  settingsPageMatches,
  "normal filter content script must exclude the settings pages that the ISOLATED sync script handles"
);
assert(
  manifest.content_scripts[0].js.includes("src/sync/sync-bridge.js") &&
    manifest.content_scripts[0].js.indexOf("src/storage/storage.js") <
      manifest.content_scripts[0].js.indexOf("src/sync/sync-bridge.js"),
  "sync bridge must run in the settings-page ISOLATED content script after storage"
);
assert(
  manifest.content_scripts[2].world === "MAIN" &&
    manifest.content_scripts[2].run_at === "document_start" &&
    manifest.content_scripts[2].js.includes("src/sync/sync-hook.js") &&
    manifest.content_scripts[2].js.indexOf("src/sync/sync-capture.js") <
      manifest.content_scripts[2].js.indexOf("src/sync/sync-hook.js"),
  "production sync capture must run as a MAIN-world content script with sync-capture before sync-hook"
);
assertSameStringArray(
  manifest.content_scripts[2].matches,
  settingsPageMatches,
  "production sync MAIN content script must stay limited to settings pages"
);
assert(
  manifest.minimum_chrome_version === "111",
  "declarative world: MAIN content scripts require minimum_chrome_version 111"
);

// M7: store-ready name, version, and icon set.
assert(manifest.name === "TrueBlock & Mute", "manifest name must be the store brand name");
assert(/^\d+\.\d+\.\d+$/.test(manifest.version), "manifest version must be semver (e.g. 1.0.0)");
const iconSizes = ["16", "32", "48", "128"];
assert(
  manifest.icons && iconSizes.every((s) => manifest.icons[s] === `icons/icon-${s}.png`),
  "manifest must declare 16/32/48/128 icons under icons/"
);
assert(
  manifest.action?.default_icon && iconSizes.every((s) => manifest.action.default_icon[s] === `icons/icon-${s}.png`),
  "action must declare a matching default_icon set"
);
for (const s of iconSizes) {
  await readText(`icons/icon-${s}.png`);
}

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

const constantsScript = await readText("src/shared/constants.js");
const mainWorldHookScript = await readText("src/research/f1-a/main-world-hook.js");
const observationUtilsScript = await readText("src/research/f1-a/observation-utils.js");
const storageScript = await readText("src/storage/storage.js");
// The research injection + `scripting` permission were retired (M7). The shipped
// storage no longer carries the research observation API.
assert(!storageScript.includes("getResearchF1A"), "shipped storage must not retain the research observation API");
assert(!storageScript.includes("appendF1AResearchObservation"), "shipped storage must not retain research observation writes");
// observation-utils.js and main-world-hook.js remain as offline research-evidence
// files; assert they stay internally safe and aligned with each other.
assert(mainWorldHookScript.includes("window.fetch"), "research hook must wrap fetch");
assert(mainWorldHookScript.includes("XMLHttpRequest.prototype.open"), "research hook must wrap XMLHttpRequest");
assert(mainWorldHookScript.includes("window.postMessage"), "MAIN world research hook must use page messaging instead of chrome APIs");
assert(mainWorldHookScript.includes("hookRunId"), "MAIN world research hook must tag observations for continuity checks");
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

const syncHookScript = await readText("src/sync/sync-hook.js");
const syncCaptureScript = await readText("src/sync/sync-capture.js");
const syncBridgeScript = await readText("src/sync/sync-bridge.js");
const syncSourceMatch = constantsScript.match(/SYNC_MESSAGE_SOURCE\s*=\s*"([^"]+)"/);
assert(syncSourceMatch, "constants must define SYNC_MESSAGE_SOURCE");
assert(
  syncHookScript.includes(`installSyncHook("${syncSourceMatch[1]}")`),
  "sync-hook auto-install source must match constants SYNC_MESSAGE_SOURCE"
);
assert(syncHookScript.includes("SyncCapture") && syncHookScript.includes("window.fetch"), "sync-hook must use SyncCapture and wrap fetch");
const chromeApiPattern = /chrome\.(storage|runtime|scripting|tabs|cookies|webRequest|action)\b/;
assert(!chromeApiPattern.test(syncHookScript), "MAIN-world sync hook must not call chrome.* APIs");
assert(!chromeApiPattern.test(syncCaptureScript), "MAIN-world sync capture must not call chrome.* APIs");
assert(syncBridgeScript.includes("upsertSyncedEntries") && syncBridgeScript.includes("getSyncState"), "sync bridge must gate persistence on sync state");

const popupHtml = await readText("src/popup/popup.html");
const popupScripts = Array.from(popupHtml.matchAll(/<script src="([^"]+)"><\/script>/g)).map((match) => match[1]);
assert(
  popupScripts.indexOf("../storage/storage.js") < popupScripts.indexOf("popup.js") &&
    !popupScripts.includes("../research/f1-a/observation-utils.js"),
  "popup must load storage before popup.js and must not load research observation-utils"
);
assert(popupHtml.includes("ローカル確認用データ"), "popup must label local test data clearly");
assert(popupHtml.includes("ブロック・ミュート同期"), "popup must expose the production sync section");
assert(popupHtml.includes("詳細設定・プライバシー"), "popup must link to the options page");
assert(
  !popupHtml.includes("research-panel") && !popupHtml.includes("F1-A 観測メモ"),
  "popup must not ship the retired research panel"
);

// M6: options page (entries 管理 / プライバシー説明) registered and self-consistent.
assert(
  manifest.options_ui?.page === "src/options/options.html" && manifest.options_ui?.open_in_tab === true,
  "manifest must register the options page (open_in_tab)"
);
const optionsHtml = await readText("src/options/options.html");
const optionsScripts = Array.from(optionsHtml.matchAll(/<script src="([^"]+)"><\/script>/g)).map((match) => match[1]);
assert(
  optionsScripts.indexOf("../storage/storage.js") < optionsScripts.indexOf("options.js") &&
    !optionsScripts.includes("../research/f1-a/observation-utils.js"),
  "options page must load storage before options.js and must not load research observation-utils"
);
for (const needle of [
  "TrueBlock & Mute 設定",
  "プライバシー",
  "外部サーバーへは送信されません",
  "フィルタ対象",
  "うまく同期できないとき"
]) {
  assert(optionsHtml.includes(needle), `options page must include: ${needle}`);
}
const optionsScript = await readText("src/options/options.js");
assert(
  optionsScript.includes("clearSyncedEntries") && optionsScript.includes("getEntryStore"),
  "options page must read entries and offer a synced clear"
);
assert(!optionsScript.includes(".innerHTML"), "options page must not inject user data via innerHTML");

console.log("Phase 1.5 static verification passed");
