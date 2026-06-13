// make-screenshots.mjs
//
// Chrome Web Store asset capture for the MV3 extension. This uses the same
// raw-CDP-over-global-WebSocket plumbing as tests/scripts/verify-extension-load-chrome.mjs:
// no npm dependencies, bounded waits, a 120s watchdog, and a temporary profile.
// It opens only bundled synthetic fixtures and extension pages.

import { spawn } from "node:child_process";
import { createHash } from "node:crypto";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

const scriptDir = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(scriptDir, "..");
const assetsDir = path.join(repoRoot, "store-assets");

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

const viewport = Object.freeze({
  width: 1280,
  height: 800,
  deviceScaleFactor: 1,
  mobile: false
});
const clip = Object.freeze({ x: 0, y: 0, width: 1280, height: 800, scale: 1 });

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

// Chromium's deterministic unpacked-extension id: sha256 of the absolute path,
// first 32 hex nibbles mapped 0-f -> a-p. On Windows Chromium hashes the path as
// UTF-16LE (wide chars); elsewhere as UTF-8. The extension has no background
// service worker, so the id is computed from the loaded path.
function computeExtensionId(absPath) {
  const bytes = process.platform === "win32" ? Buffer.from(absPath, "utf16le") : Buffer.from(absPath, "utf8");
  const hash = createHash("sha256").update(bytes).digest("hex");
  let id = "";
  for (let i = 0; i < 32; i += 1) {
    id += String.fromCharCode(97 + parseInt(hash[i], 16));
  }
  return id;
}

async function click(cdp, sessionId, selector) {
  const ok = await evaluate(
    cdp,
    sessionId,
    `(() => {
      const el = document.querySelector(${JSON.stringify(selector)});
      if (!el) return false;
      el.click();
      return true;
    })()`
  );
  if (!ok) {
    throw new Error(`selector not found: ${selector}`);
  }
}

async function waitForText(cdp, sessionId, selector, expected, desc) {
  return pollValue(
    async () => {
      const value = await evaluate(cdp, sessionId, `document.querySelector(${JSON.stringify(selector)})?.textContent || ""`);
      return { ok: value === expected, value };
    },
    { timeout: 10000, desc }
  );
}

async function waitForFilterState(cdp, sessionId) {
  return pollValue(
    async () => {
      const value = await evaluate(cdp, sessionId, "document.querySelector('#filter-state')?.textContent || ''");
      return { ok: Boolean(value && value !== "状態を読み込み中"), value };
    },
    { timeout: 12000, desc: "popup #filter-state to settle" }
  );
}

async function setViewport(cdp, sessionId) {
  await cdp.send("Emulation.setDeviceMetricsOverride", viewport, sessionId);
}

function displayPath(file) {
  return path.relative(repoRoot, file).split(path.sep).join("/");
}

async function capturePng(cdp, sessionId, file) {
  await setViewport(cdp, sessionId);
  const { data } = await cdp.send("Page.captureScreenshot", { format: "png", clip }, sessionId);
  fs.writeFileSync(file, Buffer.from(data, "base64"));
  console.log(`wrote ${displayPath(file)}`);
}

async function prepareProfile(cdp, extensionId) {
  const popupUrl = `chrome-extension://${extensionId}/src/popup/popup.html`;
  const popup = await openPage(cdp, popupUrl);
  await waitForFilterState(cdp, popup.sessionId);

  await click(cdp, popup.sessionId, "#seed-synthetic");
  await waitForText(cdp, popup.sessionId, "#entry-count", "2件", "popup #entry-count to reach 2件");

  await click(cdp, popup.sessionId, "input[name='display-mode'][value='placeholder']");
  await pollValue(
    async () => {
      const value = await evaluate(cdp, popup.sessionId, "document.querySelector(\"input[name='display-mode'][value='placeholder']\")?.checked");
      return { ok: value === true, value };
    },
    { timeout: 5000, desc: "placeholder display mode to persist" }
  );

  await click(cdp, popup.sessionId, "#sync-enabled");
  await pollValue(
    async () => {
      const value = await evaluate(cdp, popup.sessionId, "document.querySelector('#sync-enabled')?.checked");
      return { ok: value === true, value };
    },
    { timeout: 5000, desc: "sync toggle to persist as checked" }
  );
}

async function captureTimeline(cdp, file) {
  const fixtureUrl = pathToFileURL(path.join(repoRoot, "tests", "fixtures", "home-timeline.html")).href;
  const page = await openPage(cdp, fixtureUrl);
  await setViewport(cdp, page.sessionId);
  await pollValue(
    async () => {
      const value = await evaluate(
        cdp,
        page.sessionId,
        "Boolean(window.XTrueBlockMute && window.XTrueBlockMute.ContentScript)"
      );
      return { ok: value === true, value };
    },
    { timeout: 8000, desc: "fixture scripts to load" }
  );
  await click(cdp, page.sessionId, '[data-fixture-action="placeholder"]');
  await pollValue(
    async () => {
      const value = await evaluate(cdp, page.sessionId, "document.querySelectorAll('[data-x-tbm-replacement]').length");
      return { ok: value === 2, value };
    },
    { timeout: 5000, desc: "fixture placeholder mode to replace 2 cards" }
  );
  await capturePng(cdp, page.sessionId, file);
}

async function captureOptions(cdp, extensionId, file) {
  const optionsUrl = `chrome-extension://${extensionId}/src/options/options.html`;
  const page = await openPage(cdp, optionsUrl);
  await setViewport(cdp, page.sessionId);
  await waitForText(cdp, page.sessionId, "#synthetic-count", "2件", "options #synthetic-count to read 2件");
  await capturePng(cdp, page.sessionId, file);
}

async function capturePopup(cdp, extensionId, file) {
  const popupUrl = `chrome-extension://${extensionId}/src/popup/popup.html`;
  const page = await openPage(cdp, popupUrl);
  await setViewport(cdp, page.sessionId);
  await waitForFilterState(cdp, page.sessionId);
  await capturePng(cdp, page.sessionId, file);
}

async function main() {
  if (!fs.existsSync(chromeBinary)) {
    throw new Error(
      `Chromium binary not found: ${chromeBinary}\n` +
        "Set XTBM_CHROME_PATH to a Chromium/Chrome-for-Testing build that supports --load-extension."
    );
  }

  fs.mkdirSync(assetsDir, { recursive: true });
  const userDataDir = fs.mkdtempSync(path.join(os.tmpdir(), "xtbm-store-assets-"));

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

    const extensionId = computeExtensionId(repoRoot);
    console.log(`Extension id: ${extensionId}`);

    await prepareProfile(cdp, extensionId);
    await captureTimeline(cdp, path.join(assetsDir, "store-1-timeline.png"));
    await captureOptions(cdp, extensionId, path.join(assetsDir, "store-2-options.png"));
    await capturePopup(cdp, extensionId, path.join(assetsDir, "store-3-popup.png"));
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
    console.log("\nStore asset capture passed");
    process.exit(0);
  })
  .catch((error) => {
    clearTimeout(watchdog);
    console.error(`\nStore asset capture ERROR: ${error.message}`);
    process.exit(1);
  });
