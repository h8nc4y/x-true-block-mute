import { readFile } from "node:fs/promises";
import { Script } from "node:vm";

const root = new URL("../../", import.meta.url);
const requiredFiles = [
  "manifest.json",
  "src/shared/constants.js",
  "src/storage/storage.js",
  "src/content/content-script.js",
  "src/content/content-script.css",
  "src/popup/popup.html",
  "src/popup/popup.css",
  "src/popup/popup.js",
  "tests/fixtures/home-timeline.html"
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
assert(manifest.permissions.length === 1 && manifest.permissions[0] === "storage", "only storage permission is allowed");
assert(
  JSON.stringify(manifest.host_permissions) === JSON.stringify(["https://x.com/*", "https://twitter.com/*"]),
  "host_permissions must remain limited to x.com and twitter.com"
);
assert(manifest.action?.default_popup === "src/popup/popup.html", "popup must be registered");
assert(Array.isArray(manifest.content_scripts) && manifest.content_scripts.length === 1, "one static content script block is expected");
assert(!manifest.background, "background service worker is out of Phase 1 scope");

const manifestText = JSON.stringify(manifest);
for (const value of prohibitedValues) {
  assert(!manifestText.includes(value), `prohibited permission or host found: ${value}`);
}

for (const file of requiredFiles) {
  await readText(file);
}

for (const file of requiredFiles.filter((file) => file.endsWith(".js") || file.endsWith(".mjs"))) {
  new Script(await readText(file), { filename: file });
}

const contentScript = await readText("src/content/content-script.js");
assert(contentScript.includes("MutationObserver"), "content script must use MutationObserver");
assert(contentScript.includes("data-user-id"), "synthetic user_id fixture attribute must be supported");
assert(contentScript.includes("data-handle"), "synthetic handle fixture attribute must be supported");
assert(!contentScript.includes("fetch("), "F1/API fetch path must not be added in Phase 1");
assert(!contentScript.includes("XMLHttpRequest"), "XHR hook path must not be added in Phase 1");

console.log("Phase 1 static verification passed");
