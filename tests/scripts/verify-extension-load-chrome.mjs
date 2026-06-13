// verify-extension-load-chrome.mjs
//
// M2 automated verification (TB-002): loads the unpacked extension into a real
// Chromium and drives it over raw CDP (no npm dependencies) to confirm:
//   1. The extension loads without manifest errors (a chrome-extension target appears).
//   2. The popup renders in real extension context (#filter-state === "状態: 有効",
//      which only happens when chrome.storage is readable inside the extension).
//   3. Seeding synthetic data updates the popup (#entry-count "0件" -> "2件").
//   4. The synthetic fixture filters cards: placeholder=2, hidden=2, off=0, clear=0.
//
// Why a cached Chromium instead of the installed Chrome: branded Chrome 137+
// disables --load-extension, which is the most likely cause of the earlier
// Codex "ERR_FILE_NOT_FOUND / no service worker target" failure. Playwright's
// cached open-source Chromium keeps the flag working.
//
// Screenshots are written to tmp/ (gitignored, synthetic data only). The script
// is non-interactive and always terminates: every wait is bounded and a global
// watchdog force-exits after 120s. It never opens x.com/twitter.com or reads any
// real account data.

import { spawn } from "node:child_process";
import { createHash } from "node:crypto";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

const scriptDir = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(scriptDir, "..", "..");
const tmpDir = path.join(repoRoot, "tmp");

const chromeBinary =
  process.env.XTBM_CHROME_PATH ||
  path.join(
    os.homedir(),
    "AppData",
    "Local",
    "ms-playwright",
    "chromium-1223",
    "chrome-win64",
    "chrome.exe"
  );
const headless = process.env.XTBM_HEADLESS === "1";

const failures = [];
function check(condition, label, detail) {
  if (condition) {
    console.log(`  PASS  ${label}`);
  } else {
    failures.push(label);
    console.log(`  FAIL  ${label}${detail ? ` -> ${detail}` : ""}`);
  }
}

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

// ---------------------------------------------------------------------------
// Minimal CDP client over Node's global WebSocket.
// ---------------------------------------------------------------------------
class Cdp {
  constructor(ws) {
    this.ws = ws;
    this.nextId = 0;
    this.pending = new Map();
    ws.addEventListener("message", (event) => {
      let msg;
      try {
        msg = JSON.parse(event.data);
      } catch {
        return;
      }
      if (msg.id !== undefined && this.pending.has(msg.id)) {
        const { resolve, reject } = this.pending.get(msg.id);
        this.pending.delete(msg.id);
        if (msg.error) {
          reject(new Error(`${msg.error.message || "CDP error"} (${JSON.stringify(msg.error)})`));
        } else {
          resolve(msg.result);
        }
      }
    });
  }

  send(method, params = {}, sessionId) {
    const id = ++this.nextId;
    const payload = sessionId ? { id, method, params, sessionId } : { id, method, params };
    return new Promise((resolve, reject) => {
      this.pending.set(id, { resolve, reject });
      this.ws.send(JSON.stringify(payload));
    });
  }
}

function connect(url) {
  return new Promise((resolve, reject) => {
    const ws = new WebSocket(url);
    ws.addEventListener("open", () => resolve(ws));
    ws.addEventListener("error", () => reject(new Error(`failed to connect to ${url}`)));
  });
}

async function evaluate(cdp, sessionId, expression, awaitPromise = false) {
  const result = await cdp.send(
    "Runtime.evaluate",
    { expression, returnByValue: true, awaitPromise },
    sessionId
  );
  if (result.exceptionDetails) {
    const ex = result.exceptionDetails;
    throw new Error(`eval exception: ${ex.exception?.description || ex.text || "unknown"}`);
  }
  return result.result?.value;
}

async function pollValue(fn, { timeout = 10000, interval = 200, desc = "condition" } = {}) {
  const start = Date.now();
  let last;
  while (Date.now() - start < timeout) {
    last = await fn();
    if (last && last.ok) {
      return last.value;
    }
    await sleep(interval);
  }
  throw new Error(`timeout waiting for ${desc}; last seen: ${JSON.stringify(last?.value)}`);
}

async function openPage(cdp, url) {
  const { targetId } = await cdp.send("Target.createTarget", { url });
  const { sessionId } = await cdp.send("Target.attachToTarget", { targetId, flatten: true });
  await cdp.send("Runtime.enable", {}, sessionId);
  await cdp.send("Page.enable", {}, sessionId);
  return { targetId, sessionId };
}

async function captureScreenshot(cdp, sessionId, file) {
  try {
    const { data } = await cdp.send("Page.captureScreenshot", { format: "png" }, sessionId);
    fs.writeFileSync(file, Buffer.from(data, "base64"));
    console.log(`  note  screenshot saved: ${path.relative(repoRoot, file)}`);
  } catch (error) {
    console.log(`  note  screenshot skipped: ${error.message}`);
  }
}

function waitForDevToolsPort(userDataDir, timeout = 25000) {
  const file = path.join(userDataDir, "DevToolsActivePort");
  const start = Date.now();
  return (async () => {
    while (Date.now() - start < timeout) {
      if (fs.existsSync(file)) {
        const lines = fs.readFileSync(file, "utf8").split("\n");
        if (lines[0]?.trim()) {
          return { port: lines[0].trim(), wsPath: (lines[1] || "").trim() };
        }
      }
      await sleep(150);
    }
    throw new Error("DevToolsActivePort was not created; Chromium did not start");
  })();
}

async function findExtensionId(cdp, timeout = 15000) {
  const start = Date.now();
  let seen = [];
  while (Date.now() - start < timeout) {
    const { targetInfos } = await cdp.send("Target.getTargets");
    seen = targetInfos.map((t) => `${t.type}:${t.url}`);
    for (const t of targetInfos) {
      const m = /^chrome-extension:\/\/([a-p]{32})\/.*research-background\.js/.exec(t.url);
      if (m) {
        return { id: m[1], source: "service_worker" };
      }
    }
    for (const t of targetInfos) {
      const m = /^chrome-extension:\/\/([a-p]{32})\//.exec(t.url);
      if (m) {
        return { id: m[1], source: t.type };
      }
    }
    await sleep(300);
  }
  return { id: null, source: "not_found", seen };
}

// Chromium's deterministic unpacked-extension id (sha256 of the absolute path,
// first 32 hex nibbles mapped 0-f -> a-p). Used only as a fallback and always
// verified by actually loading the popup.
function computeExtensionId(absPath) {
  const hash = createHash("sha256").update(absPath).digest("hex");
  let id = "";
  for (let i = 0; i < 32; i += 1) {
    id += String.fromCharCode(97 + parseInt(hash[i], 16));
  }
  return id;
}

async function main() {
  if (!fs.existsSync(chromeBinary)) {
    throw new Error(
      `Chromium binary not found: ${chromeBinary}\n` +
        "Set XTBM_CHROME_PATH to a Chromium/Chrome-for-Testing build that supports --load-extension."
    );
  }
  fs.mkdirSync(tmpDir, { recursive: true });
  const userDataDir = fs.mkdtempSync(path.join(os.tmpdir(), "xtbm-tb002-"));

  const args = [
    `--user-data-dir=${userDataDir}`,
    `--load-extension=${repoRoot}`,
    `--disable-extensions-except=${repoRoot}`,
    "--remote-debugging-port=0",
    "--no-first-run",
    "--no-default-browser-check",
    "--disable-sync",
    "--disable-background-networking",
    "--allow-file-access-from-files",
    "--window-size=1280,900"
  ];
  if (headless) {
    args.push("--headless=new");
  }

  console.log(`Chromium: ${chromeBinary}`);
  console.log(`Extension: ${repoRoot}`);
  console.log(`Mode: ${headless ? "headless=new" : "headful"}`);

  const child = spawn(chromeBinary, args, { stdio: "ignore" });
  let cdp;
  const cleanup = async () => {
    try {
      if (cdp) {
        await cdp.send("Browser.close").catch(() => {});
      }
    } catch {
      /* ignore */
    }
    try {
      child.kill();
    } catch {
      /* ignore */
    }
    try {
      fs.rmSync(userDataDir, { recursive: true, force: true });
    } catch {
      /* ignore (Windows file locks); temp dir is under os.tmpdir() */
    }
  };

  try {
    const { port, wsPath } = await waitForDevToolsPort(userDataDir);
    const browserWsUrl = `ws://127.0.0.1:${port}${wsPath || ""}`;
    const ws = await connect(browserWsUrl);
    cdp = new Cdp(ws);

    // --- Check 1: extension loads ---------------------------------------
    let { id: extensionId, source, seen } = await findExtensionId(cdp);
    if (!extensionId) {
      extensionId = computeExtensionId(repoRoot);
      source = "computed-fallback";
      console.log(`  note  no extension target found; trying computed id ${extensionId}`);
      console.log(`  note  targets seen: ${(seen || []).join(", ") || "none"}`);
    }
    check(Boolean(extensionId), "extension loaded (chrome-extension target or computed id)", source);
    console.log(`  note  extension id: ${extensionId} (source: ${source})`);

    // --- Check 2 & 3: popup renders and seeding updates the count -------
    const popupUrl = `chrome-extension://${extensionId}/src/popup/popup.html`;
    const popup = await openPage(cdp, popupUrl);

    const filterState = await pollValue(
      async () => {
        const value = await evaluate(
          cdp,
          popup.sessionId,
          "document.querySelector('#filter-state')?.textContent || ''"
        );
        return { ok: value && value !== "状態を読み込み中", value };
      },
      { timeout: 12000, desc: "popup #filter-state to settle" }
    ).catch((error) => `ERROR: ${error.message}`);
    check(filterState === "状態: 有効", 'popup renders in extension context (#filter-state = "状態: 有効")', String(filterState));

    const initialCount = await evaluate(
      cdp,
      popup.sessionId,
      "document.querySelector('#entry-count')?.textContent || ''"
    );
    check(initialCount === "0件", "fresh profile starts with 0 entries", String(initialCount));

    await evaluate(cdp, popup.sessionId, "document.querySelector('#seed-synthetic').click()");
    const seededCount = await pollValue(
      async () => {
        const value = await evaluate(
          cdp,
          popup.sessionId,
          "document.querySelector('#entry-count')?.textContent || ''"
        );
        return { ok: value === "2件", value };
      },
      { timeout: 6000, desc: "popup #entry-count to reach 2件" }
    ).catch((error) => `ERROR: ${error.message}`);
    check(seededCount === "2件", "seeding synthetic data updates popup to 2件", String(seededCount));

    await captureScreenshot(cdp, popup.sessionId, path.join(tmpDir, "tb002-popup-screenshot.png"));

    // --- Check 3b: popup sync controls render and the toggle persists ---
    const syncInfo = await evaluate(
      cdp,
      popup.sessionId,
      "({ hasToggle: Boolean(document.querySelector('#sync-enabled')), last: document.querySelector('#sync-last')?.textContent || '', blocked: document.querySelector('#sync-blocked-count')?.textContent || '' })"
    );
    check(syncInfo.hasToggle === true, "popup shows the sync toggle", syncInfo);
    check(syncInfo.last === "未同期", "sync status starts as 未同期", syncInfo.last);
    check(syncInfo.blocked === "0件", "synced blocked count starts at 0件", syncInfo.blocked);
    await evaluate(cdp, popup.sessionId, "document.querySelector('#sync-enabled').click()");
    const syncToggled = await pollValue(
      async () => {
        const value = await evaluate(cdp, popup.sessionId, "document.querySelector('#sync-enabled').checked");
        return { ok: value === true, value };
      },
      { timeout: 5000, desc: "sync toggle to persist as checked" }
    ).catch((error) => `ERROR: ${error.message}`);
    check(syncToggled === true, "enabling sync persists (checkbox stays checked after render)", String(syncToggled));

    // --- Check 4: synthetic fixture filters cards -----------------------
    const fixtureUrl = pathToFileURL(
      path.join(repoRoot, "tests", "fixtures", "home-timeline.html")
    ).href;
    const fixture = await openPage(cdp, fixtureUrl);

    // Wait for the fixture's bundled scripts to be ready.
    await pollValue(
      async () => {
        const value = await evaluate(
          cdp,
          fixture.sessionId,
          "Boolean(window.XTrueBlockMute && window.XTrueBlockMute.ContentScript)"
        );
        return { ok: value === true, value };
      },
      { timeout: 8000, desc: "fixture scripts to load" }
    );

    const replacementCount = (sessionId) =>
      evaluate(
        cdp,
        sessionId,
        "document.querySelectorAll('[data-x-tbm-replacement]').length"
      );

    const runFixtureMode = async (action, expected) => {
      await evaluate(
        cdp,
        fixture.sessionId,
        `document.querySelector('[data-fixture-action="${action}"]').click()`
      );
      const value = await pollValue(
        async () => {
          const count = await replacementCount(fixture.sessionId);
          return { ok: count === expected, value: count };
        },
        { timeout: 4000, desc: `fixture ${action} to reach ${expected} replacements` }
      ).catch(() => replacementCount(fixture.sessionId));
      check(value === expected, `fixture ${action} -> ${expected} replaced card(s)`, String(value));
      return value;
    };

    await runFixtureMode("placeholder", 2);
    await captureScreenshot(cdp, fixture.sessionId, path.join(tmpDir, "tb002-fixture-screenshot.png"));
    await runFixtureMode("hidden", 2);
    await runFixtureMode("off", 0);
    await runFixtureMode("placeholder", 2); // re-apply after off proves toggling works
    await runFixtureMode("clear", 0);

    // --- Check 5: real-DOM-shaped author matching (M5) ------------------
    const realDomUrl = pathToFileURL(path.join(repoRoot, "tests", "fixtures", "real-dom-timeline.html")).href;
    const realDom = await openPage(cdp, realDomUrl);
    await pollValue(
      async () => {
        const value = await evaluate(
          cdp,
          realDom.sessionId,
          "Boolean(window.XTrueBlockMute && window.XTrueBlockMute.ContentScript)"
        );
        return { ok: value === true, value };
      },
      { timeout: 8000, desc: "real-dom fixture scripts to load" }
    );
    const realDomProbe =
      "({ replaced: document.querySelectorAll('[data-x-tbm-replacement]').length," +
      " card1: Boolean(document.querySelector('[data-test-id=\\'card-1\\']'))," +
      " card2: Boolean(document.querySelector('[data-test-id=\\'card-2\\']'))," +
      " card3: Boolean(document.querySelector('[data-test-id=\\'card-3\\']'))," +
      " card4: Boolean(document.querySelector('[data-test-id=\\'card-4\\']'))," +
      " card5: Boolean(document.querySelector('[data-test-id=\\'card-5\\']'))," +
      " card3Quote: Boolean(document.querySelector('[data-test-id=\\'card-3\\'] [data-x-tbm-replacement]')) })";
    await evaluate(cdp, realDom.sessionId, "document.querySelector('[data-fixture-action=\"hidden\"]').click()");
    const realDomResult = await pollValue(
      async () => {
        const value = await evaluate(cdp, realDom.sessionId, realDomProbe);
        return { ok: value.replaced === 3, value };
      },
      { timeout: 5000, desc: "real-dom hidden to replace 2 author cards + 1 quoted card" }
    ).catch(() => evaluate(cdp, realDom.sessionId, realDomProbe));
    await captureScreenshot(cdp, realDom.sessionId, path.join(tmpDir, "tb002-realdom-screenshot.png"));
    check(realDomResult.replaced === 3, "real-DOM: 2 author cards + 1 quoted card replaced", realDomResult);
    check(realDomResult.card1 === false, "real-DOM: card-1 (User-Name author = target) hidden", realDomResult);
    check(realDomResult.card4 === false, "real-DOM: card-4 (avatar-only author = target) hidden", realDomResult);
    check(realDomResult.card2 === true, "real-DOM: card-2 (safe author) kept", realDomResult);
    check(realDomResult.card3 === true, "real-DOM: card-3 (safe author) kept as a post", realDomResult);
    check(realDomResult.card3Quote === true, "real-DOM: card-3's quoted target card is hidden in place", realDomResult);
    check(realDomResult.card5 === true, "real-DOM: card-5 mentions target but safe author -> kept", realDomResult);
  } finally {
    await cleanup();
  }
}

const watchdog = setTimeout(() => {
  console.error("watchdog: 120s elapsed, forcing exit");
  process.exit(1);
}, 120000);
if (typeof watchdog.unref === "function") {
  watchdog.unref();
}

main()
  .then(() => {
    clearTimeout(watchdog);
    if (failures.length > 0) {
      console.error(`\nExtension load verification FAILED: ${failures.length} check(s) failed`);
      process.exit(1);
    }
    console.log("\nExtension load verification passed");
    process.exit(0);
  })
  .catch((error) => {
    clearTimeout(watchdog);
    console.error(`\nExtension load verification ERROR: ${error.message}`);
    process.exit(1);
  });
