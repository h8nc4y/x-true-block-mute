import { readFile } from "node:fs/promises";

const root = new URL("../../", import.meta.url);

async function readText(path) {
  return readFile(new URL(path, root), "utf8");
}

function assertIncludes(text, required, label, failures) {
  for (const needle of required) {
    if (!text.includes(needle)) {
      failures.push(`${label} missing: ${needle}`);
    }
  }
}

function assertRegex(text, regex, label, failures) {
  if (!regex.test(text)) {
    failures.push(`${label} missing pattern: ${regex}`);
  }
}

function parseJson(text, label, failures) {
  try {
    return JSON.parse(text);
  } catch (error) {
    failures.push(`${label} JSON parse failed: ${error.message}`);
    return null;
  }
}

const failures = [];
const agents = await readText("AGENTS.md");
const readme = await readText("README.md");
const popupManualDoc = await readText("docs/manual-popup-verification.md");
const researchDoc = await readText("docs/research/f1-a-main-world-hook.md");
const decisionDoc = await readText("docs/decisions/f1-source-selection.md");
const popupHtml = await readText("src/popup/popup.html");
const evaluator = await readText("tests/scripts/evaluate-f1-observation.mjs");
const safetyTest = await readText("tests/scripts/verify-f1a-observation-safety.mjs");
const fixture = parseJson(await readText("tests/fixtures/f1-a-masked-summary.fixture.json"), "masked summary fixture", failures);
const manifest = parseJson(await readText("manifest.json"), "manifest", failures);

// AGENTS.md must lock the current (2026-06-13) governance and privacy invariants.
assertIncludes(
  agents,
  [
    "raw X response",
    "masked observation",
    "ユーザー",
    "Chrome MCP",
    "捏造",
    "入力待ちループ",
    "Chrome Web Store",
    "password"
  ],
  "AGENTS.md",
  failures
);
// The combined user-facing docs must keep the masked-summary evaluator vocabulary and
// the privacy reporting boundary that protects raw account data.
assertIncludes(
  readme + popupManualDoc + researchDoc + decisionDoc,
  [
    "f1a_viable",
    "fixture_pass",
    "unsafe_summary",
    "tmp\\masked-summary.json",
    "raw response",
    "安全な要約をコピー（masked summary）",
    "観測メモ",
    "貼ってはいけない情報"
  ],
  "docs",
  failures
);
assertIncludes(
  readme,
  [
    "Current status",
    "Phase 2",
    "production sync",
    "real-DOM author matching",
    "reconciliation"
  ],
  "README current status",
  failures
);
// The shipped popup no longer carries the F1-A research panel (retired in M7);
// it must still label its local synthetic test data and expose the options page.
assertIncludes(
  popupHtml,
  [
    "ローカル確認用データ",
    "詳細設定・プライバシー"
  ],
  "popup UI",
  failures
);
assertIncludes(evaluator, ["--live", "fixture_pass", "f1a_viable", "unsafe_summary"], "evaluator", failures);
assertIncludes(safetyTest, ["synthetic-sensitive-value", "raw-looking summary must be rejected"], "safety test", failures);
// Live verification may be driven by Claude Code, but the agent never receives credentials
// and never reads raw response / DevTools body / HAR.
assertRegex(
  researchDoc,
  /エージェントは password、MFA、Cookie、token を受け取らない。raw response、DevTools Network 本文、HAR は読まない・保存しない/,
  "research doc credential boundary",
  failures
);

if (manifest) {
  const permissions = JSON.stringify(manifest.permissions);
  const hosts = JSON.stringify(manifest.host_permissions);
  if (permissions !== JSON.stringify(["storage"])) {
    failures.push(`manifest permissions changed: ${permissions}`);
  }
  if (hosts !== JSON.stringify(["https://x.com/*", "https://twitter.com/*"])) {
    failures.push(`manifest host_permissions changed: ${hosts}`);
  }
  const manifestText = JSON.stringify(manifest);
  for (const prohibited of ["webRequest", "cookies", "tabs", "activeTab", "<all_urls>", "https://api.x.com/*"]) {
    if (manifestText.includes(prohibited)) {
      failures.push(`manifest contains prohibited permission or host: ${prohibited}`);
    }
  }
}

if (fixture) {
  const fixtureText = JSON.stringify(fixture);
  for (const prohibited of ["raw_handle", "auth_token", "raw-cursor", "raw-secret"]) {
    if (fixtureText.includes(prohibited)) {
      failures.push(`masked fixture contains raw-looking test string: ${prohibited}`);
    }
  }
}

if (failures.length > 0) {
  console.error(JSON.stringify({ status: "failed", failures }, null, 2));
  process.exit(1);
}

console.log(JSON.stringify({ status: "passed" }, null, 2));
