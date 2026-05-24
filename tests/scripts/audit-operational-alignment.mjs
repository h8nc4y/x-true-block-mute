import { access, readFile } from "node:fs/promises";
import { constants as fsConstants } from "node:fs";
import vm from "node:vm";

const root = new URL("../../", import.meta.url);
const globalConfig = "D:/Agent/Codex/.codex/config.toml";
const globalCostGuard = "D:/Agent/Codex/.codex/rules/cost-guard.rules";

async function readText(path) {
  return readFile(new URL(path, root), "utf8");
}

async function exists(path) {
  try {
    await access(path, fsConstants.F_OK);
    return true;
  } catch (_error) {
    return false;
  }
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

function summarizeExternalText(text) {
  const lines = text.split(/\r?\n/);
  return {
    lines: lines.length,
    hasCostKeyword: /cost|guard|billing|paid/i.test(text),
    hasNoWaitKeyword: /wait|tail|watch|sleep|interactive|prompt/i.test(text),
    hasProjectDocKeyword: /AGENTS|project_doc|fallback/i.test(text),
    bracketBalanceHint:
      (text.match(/[\[{]/g) || []).length === (text.match(/[\]}]/g) || []).length ? "ok" : "unbalanced"
  };
}

function stripRuleComments(text) {
  return text
    .split(/\r?\n/)
    .filter((line) => !line.trimStart().startsWith("#"))
    .join("\n");
}

function collectPrefixRuleBodies(text) {
  const source = stripRuleComments(text);
  const bodies = [];
  let cursor = 0;

  while (cursor < source.length) {
    const start = source.indexOf("prefix_rule(", cursor);
    if (start === -1) break;

    let depth = 1;
    let quote = null;
    let escaped = false;
    let end = start + "prefix_rule(".length;

    for (; end < source.length; end += 1) {
      const char = source[end];

      if (quote) {
        if (escaped) {
          escaped = false;
        } else if (char === "\\") {
          escaped = true;
        } else if (char === quote) {
          quote = null;
        }
        continue;
      }

      if (char === "\"" || char === "'") {
        quote = char;
      } else if (char === "(") {
        depth += 1;
      } else if (char === ")") {
        depth -= 1;
        if (depth === 0) break;
      }
    }

    if (depth !== 0) {
      throw new Error("unterminated prefix_rule block");
    }

    bodies.push(source.slice(start + "prefix_rule(".length, end));
    cursor = end + 1;
  }

  return bodies;
}

function parsePrefixRuleBody(body) {
  const expression = `({${body.replace(/(^|\n)\s*([A-Za-z_][A-Za-z0-9_]*)\s*=/g, "$1$2:")}\n})`;
  return vm.runInNewContext(expression, Object.create(null), { timeout: 1000 });
}

function commandTokens(command) {
  return command.trim().split(/\s+/).filter(Boolean);
}

function patternPartMatches(part, token) {
  if (Array.isArray(part)) {
    return part.some((candidate) => patternPartMatches(candidate, token));
  }
  if (typeof part !== "string") return false;
  return token === part || token.startsWith(part) || token.includes(part);
}

function patternMatchesCommand(pattern, command) {
  if (!Array.isArray(pattern)) return false;
  const tokens = commandTokens(command);
  if (tokens.length < pattern.length) return false;

  return pattern.every((part, index) => patternPartMatches(part, tokens[index] ?? ""));
}

function validateCostGuardRules(text) {
  const errors = [];
  const bodies = collectPrefixRuleBodies(text);

  for (const [index, body] of bodies.entries()) {
    let rule;
    try {
      rule = parsePrefixRuleBody(body);
    } catch (error) {
      errors.push(`rule ${index + 1} parse failed: ${error.message}`);
      continue;
    }

    if (!Array.isArray(rule.pattern) || rule.pattern.length === 0) {
      errors.push(`rule ${index + 1} has invalid pattern`);
    }
    if (!["allow", "prompt", "forbidden"].includes(rule.decision)) {
      errors.push(`rule ${index + 1} has invalid decision: ${rule.decision}`);
    }
    if (!Array.isArray(rule.match) || rule.match.length === 0) {
      errors.push(`rule ${index + 1} has no match examples`);
      continue;
    }

    for (const example of rule.match) {
      if (typeof example !== "string") {
        errors.push(`rule ${index + 1} has non-string match example`);
      } else if (!patternMatchesCommand(rule.pattern, example)) {
        errors.push(`rule ${index + 1} example does not match pattern: ${example}`);
      }
    }
  }

  return {
    parsedRules: bodies.length,
    validationErrors: errors.length,
    errors
  };
}

const failures = [];
const agents = await readText("AGENTS.md");
const readme = await readText("README.md");
const researchDoc = await readText("docs/research/f1-a-main-world-hook.md");
const decisionDoc = await readText("docs/decisions/f1-source-selection.md");
const popupHtml = await readText("src/popup/popup.html");
const evaluator = await readText("tests/scripts/evaluate-f1-observation.mjs");
const safetyTest = await readText("tests/scripts/verify-f1a-observation-safety.mjs");
const fixture = parseJson(await readText("tests/fixtures/f1-a-masked-summary.fixture.json"), "masked summary fixture", failures);
const manifest = parseJson(await readText("manifest.json"), "manifest", failures);

assertIncludes(
  agents,
  [
    "人間の X ログイン",
    "masked summary",
    "GitHub issue コメント",
    "remote が未設定",
    "入力待ちループ",
    "raw X response",
    "GoogleChrome / modern-web-guidance"
  ],
  "AGENTS.md",
  failures
);
assertIncludes(
  readme + researchDoc + decisionDoc,
  ["f1a_viable", "fixture_pass", "unsafe_summary", "tmp\\masked-summary.json", "raw response", "remote が未設定"],
  "docs",
  failures
);
assertIncludes(
  popupHtml,
  ["開発用", "本番同期ではありません", "masked summary のみ", "raw response はコピーしません"],
  "popup UI",
  failures
);
assertIncludes(evaluator, ["--live", "fixture_pass", "f1a_viable", "unsafe_summary"], "evaluator", failures);
assertIncludes(safetyTest, ["synthetic-sensitive-value", "raw-looking summary must be rejected"], "safety test", failures);
assertRegex(researchDoc, /Codex はログイン待ち、masked summary 入力待ち、DevTools Network 本文待ちをしない/, "research doc no-wait", failures);

if (manifest) {
  const permissions = JSON.stringify(manifest.permissions);
  const hosts = JSON.stringify(manifest.host_permissions);
  if (permissions !== JSON.stringify(["storage", "scripting"])) {
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

const globalConfigExists = await exists(globalConfig);
const globalCostGuardExists = await exists(globalCostGuard);
const external = {
  globalConfigExists,
  globalCostGuardExists,
  localAgentMdExists: await exists(new URL("AGENT.md", root)),
  localCodexConfigExists: await exists(new URL(".codex/config.toml", root))
};
if (globalConfigExists) {
  external.globalConfig = summarizeExternalText(await readFile(globalConfig, "utf8"));
}
if (globalCostGuardExists) {
  const globalCostGuardText = await readFile(globalCostGuard, "utf8");
  external.globalCostGuard = summarizeExternalText(globalCostGuardText);
  external.costGuardRules = validateCostGuardRules(globalCostGuardText);
  for (const error of external.costGuardRules.errors) {
    failures.push(`cost-guard.rules ${error}`);
  }
}

if (failures.length > 0) {
  console.error(JSON.stringify({ status: "failed", failures, external }, null, 2));
  process.exit(1);
}

console.log(JSON.stringify({ status: "passed", external }, null, 2));
