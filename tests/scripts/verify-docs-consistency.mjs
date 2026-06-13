import { readFile } from "node:fs/promises";

const root = new URL("../../", import.meta.url);

const files = {
  readme: "README.md",
  manifest: "manifest.json",
  manual: "docs/manual-popup-verification.md",
  localChrome: "docs/local-chrome-synthetic-verification.md",
  gates: "docs/phase2-readiness-gates.md",
  threat: "docs/privacy-threat-model.md",
  deferred: "docs/deferred-findings-register.md",
  triage: "docs/AI_REVIEW_TRIAGE.md",
  codexTasks: "docs/CODEX_TASKS.md",
  decisionLog: "docs/DECISION_LOG.md"
};

const forbiddenPermissions = [
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

function assertIncludes(text, value, message) {
  assert(text.includes(value), message ?? `missing text: ${value}`);
}

const entries = Object.fromEntries(
  await Promise.all(Object.entries(files).map(async ([key, path]) => [key, await readText(path)]))
);

const manifest = JSON.parse(entries.manifest);
assert(
  JSON.stringify(manifest.permissions) === JSON.stringify(["storage", "scripting"]),
  "manifest permissions must stay limited to storage and scripting"
);
assert(
  JSON.stringify(manifest.host_permissions) === JSON.stringify(["https://x.com/*", "https://twitter.com/*"]),
  "manifest host_permissions must stay limited to x.com and twitter.com"
);

const manifestText = JSON.stringify(manifest);
for (const value of forbiddenPermissions) {
  assert(!manifestText.includes(value), `manifest must not include forbidden permission or host: ${value}`);
  assertIncludes(entries.readme, value, `README must document forbidden boundary: ${value}`);
  assertIncludes(entries.threat, value, `threat model must document forbidden boundary: ${value}`);
}

for (const path of [
  files.gates,
  files.threat,
  files.deferred,
  "tests/scripts/verify-docs-consistency.mjs"
]) {
  assertIncludes(entries.readme, path, `README must reference ${path}`);
}

const localOnlyDocs = `${entries.manual}\n${entries.localChrome}\n${entries.gates}`;
for (const value of [
  "Load unpacked",
  "popup",
  "synthetic fixture",
  "未確認",
  "real X",
  "x.com",
  "twitter.com"
]) {
  assertIncludes(localOnlyDocs, value, `local verification docs must mention ${value}`);
}

for (const value of [
  "F1-A masked-summary gate",
  "f1a_viable",
  "unsafe_summary",
  "f1a_insufficient",
  "fixture_pass",
  "F1-B",
  "F1-D",
  "Human approval required",
  "Chrome Web Store"
]) {
  assertIncludes(entries.gates, value, `Phase 2 gates must mention ${value}`);
}

for (const value of [
  "xtbmEntries",
  "xtbmF1AResearch",
  "must remain separate",
  "MAIN-world hook",
  "scripting",
  "Forbidden unless later explicitly approved",
  "Human reporting rules"
]) {
  assertIncludes(entries.threat, value, `privacy threat model must mention ${value}`);
}

for (const value of [
  "CL-AUDIT-006",
  "CL-AUDIT-007",
  "CL-AUDIT-011",
  "PHASE2-F1A-SYNC",
  "PHASE2-F1B-DOM",
  "PHASE2-F1C-API",
  "PHASE2-F1D-IMPORT",
  "PHASE2-REAL-DOM-MATCH",
  "DIST-CHROME-STORE"
]) {
  assertIncludes(entries.deferred, value, `deferred findings register must mention ${value}`);
}

const coordinationDocs = `${entries.codexTasks}\n${entries.decisionLog}`;
for (const value of ["GATE-00", "GATE-01", "GATE-02", "GATE-03", "GATE-04", "GATE-05"]) {
  assertIncludes(coordinationDocs, value, `coordination docs must mention ${value}`);
}

assertIncludes(entries.codexTasks, "VERIFY-00 through VERIFY-05 were implemented in PR #5", "CODEX_TASKS must preserve VERIFY historical status");
assertIncludes(entries.decisionLog, "Phase 2 remains gated", "DECISION_LOG must record the Phase 2 gate decision");
assertIncludes(entries.gates, "must not be used as live F1-A proof", "gates must distinguish fixture_pass from live evidence");
assertIncludes(entries.gates, "Chrome Load unpacked confirmation has not been completed", "gates must keep Chrome confirmation status honest");
assertIncludes(entries.threat, "Do not include raw account identifiers", "threat model must document raw-data reporting boundary");
assertIncludes(entries.deferred, "Captured responses are not written to `xtbmEntries`", "deferred register must keep production sync out of current scope");

// 2026-06-13 governance change guards: the ChatGPT-era coordination docs stay archived,
// not silently restored as current rules.
assertIncludes(entries.codexTasks, "ARCHIVED (2026-06-13)", "CODEX_TASKS must keep its archived banner");
assertIncludes(entries.triage, "ARCHIVED (2026-06-13)", "AI_REVIEW_TRIAGE must keep its archived banner");
assertIncludes(entries.decisionLog, "2026-06-13: User-direct approval replaces ChatGPT-commander governance", "DECISION_LOG must record the governance change");

console.log("Docs consistency verification passed");
