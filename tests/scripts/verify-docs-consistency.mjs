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
  handoff: "CODEX_HANDOFF.md"
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
  JSON.stringify(manifest.permissions) === JSON.stringify(["storage"]),
  "manifest permissions must stay limited to storage (scripting was retired in M7)"
);
assert(
  JSON.stringify(manifest.host_permissions) === JSON.stringify(["https://x.com/*", "https://twitter.com/*"]),
  "manifest host_permissions must stay limited to x.com and twitter.com"
);

// ハンドオフは次の自走の入口なので、古い承認制や古い現状を再導入しない。
for (const value of [
  "現行のユーザー指示",
  "Chrome Web Store: 提出済み・審査結果待ち",
  "permissions: [\"storage\"]",
  "PHASE2-HOOK-PRODUCTION",
  "中央 dev-log",
  "agmsg"
]) {
  assertIncludes(entries.handoff, value, `CODEX_HANDOFF.md must mention current handoff invariant: ${value}`);
}

for (const staleText of [
  "既存の `AGENTS.md` のガバナンス節（「ユーザーがチャットで承認したタスクのみ実装」）",
  "バックログ表より git 履歴・README「現在の状況」・`manifest.json` を信頼",
  "あなたは Vault に直接書けないため",
  "AGENTS.md`（旧・本書で更新）",
  "Chromium 検証は Opus/人間に依頼",
  "TASKS_BACKLOG.md`（陳腐化注意",
  "Chromium・Opus/人間実行",
  "要 Opus/人間",
  "D:\\Agent\\Codex\\Projects"
]) {
  assert(!entries.handoff.includes(staleText), `CODEX_HANDOFF.md still contains stale text: ${staleText}`);
}

const handoffFenceCount = entries.handoff.match(/```/g)?.length ?? 0;
assert(handoffFenceCount % 2 === 0, "CODEX_HANDOFF.md must have balanced Markdown fences");

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
  files.handoff,
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

assertIncludes(entries.gates, "must not be used as live F1-A proof", "gates must distinguish fixture_pass from live evidence");
assertIncludes(entries.gates, "verify-extension-load-chrome.mjs", "gates must reference the M2 Chrome verification script");
assertIncludes(entries.threat, "Do not include raw account identifiers", "threat model must document raw-data reporting boundary");
assertIncludes(entries.deferred, "Captured responses are not written to `xtbmEntries`", "deferred register must keep production sync out of current scope");

console.log("Docs consistency verification passed");
