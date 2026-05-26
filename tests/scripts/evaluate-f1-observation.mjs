import { readFile } from "node:fs/promises";
import { Script, createContext } from "node:vm";

const root = new URL("../../", import.meta.url);

function usage() {
  return [
    "Usage: node tests/scripts/evaluate-f1-observation.mjs [--live] <masked-summary.json>",
    "",
    "--live を付けた場合だけ、条件充足時に f1a_viable を返します。",
    "--live なしでは synthetic fixture として扱い、条件充足時も fixture_pass です。"
  ].join("\n");
}

async function readText(path) {
  return readFile(new URL(path, root), "utf8");
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

const args = process.argv.slice(2);
if (args.includes("--help") || args.length === 0) {
  console.log(usage());
  process.exit(0);
}

const live = args.includes("--live");
const fileArg = args.find((arg) => arg !== "--live");
if (!fileArg) {
  console.error(usage());
  process.exit(1);
}

let parsed;
try {
  parsed = JSON.parse(await readFile(fileArg, "utf8"));
} catch (error) {
  console.error(JSON.stringify({ status: "unsafe_summary", error: `JSON parse failed: ${error.message}` }, null, 2));
  process.exit(2);
}

const ResearchF1A = await loadResearchF1A();
const result = ResearchF1A.evaluateObservationSummary(parsed, { mode: live ? "live" : "fixture" });
console.log(JSON.stringify(result, null, 2));

if (result.status === "fixture_pass" || result.status === "f1a_viable") {
  process.exit(0);
}
if (result.status === "unsafe_summary") {
  process.exit(2);
}
process.exit(1);
