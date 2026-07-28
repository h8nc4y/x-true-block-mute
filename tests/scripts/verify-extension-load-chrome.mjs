// verify-extension-load-chrome.mjs
//
// M2 automated verification (TB-002): loads the unpacked extension into a real
// Chromium and drives it over raw CDP (no npm dependencies) to confirm:
//   1. The extension loads without manifest errors (a chrome-extension target appears).
//   2. The popup renders in real extension context (#filter-state === "状態: 有効",
//      which only happens when chrome.storage is readable inside the extension).
//   3. Seeding synthetic data updates the popup (#entry-count "0件" -> "2件").
//   4. The synthetic fixture filters cards: placeholder=2, hidden=2, off=0, clear=0.
//   5. XHR EventTarget preserves registration order even when the later listener uses capture.
//   6. The options page stays readable and horizontally contained at three viewport sizes.
//   7. Every synthetic page stays free of runtime exceptions, console errors, and failed requests.
//
// Why a cached Chromium instead of the installed Chrome: branded Chrome 137+
// disables --load-extension, which is the most likely cause of the earlier
// Codex "ERR_FILE_NOT_FOUND / no service worker target" failure. Playwright's
// cached open-source Chromium keeps the flag working.
//
// Screenshots are written to tmp/ (gitignored, synthetic data only). The script
// is non-interactive and always terminates: every wait is bounded and a global
// watchdog performs the same browser-tree/profile cleanup before exiting. It
// never opens x.com/twitter.com or reads any real account data.

import { spawn } from "node:child_process";
import { createHash } from "node:crypto";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

const scriptDir = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(scriptDir, "..", "..");
const tmpDir = path.join(repoRoot, "tmp");
const scriptStartedAt = Date.now();

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
const OPTIONS_VIEWPORTS = [
  { name: "phone", width: 390, height: 844 },
  { name: "tablet", width: 768, height: 1024 },
  { name: "desktop", width: 1280, height: 900 }
];
const MAX_DIAGNOSTICS_PER_KIND = 20;
const MAX_TRACKED_REQUESTS = 200;
const WATCHDOG_MS = boundedDuration(process.env.XTBM_WATCHDOG_MS, 120000, 250, 120000);
const BROWSER_CLOSE_TIMEOUT_MS = 1000;
const CHILD_EXIT_GRACE_MS = 750;
const TASKKILL_TIMEOUT_MS = boundedDuration(
  process.env.XTBM_TASKKILL_TIMEOUT_MS,
  2500,
  100,
  2500
);
const TASKKILL_EXIT_GRACE_MS = 500;
// Browser.close、2回までのtaskkill helper、child exit、profile削除の
// 各上限を合計しても先に切れないcleanup専用watchdogを置く。
const WATCHDOG_CLEANUP_TIMEOUT_MS = 15000;
const FORCE_WATCHDOG = process.env.XTBM_FORCE_WATCHDOG === "1";
const FORCE_BROWSER_CLOSE_TIMEOUT = process.env.XTBM_FORCE_BROWSER_CLOSE_TIMEOUT === "1";
const FORCE_WATCHDOG_RACE = process.env.XTBM_FORCE_WATCHDOG_RACE === "1";
const FORCE_CLEANUP_STATUS_FAILURE =
  process.env.XTBM_FORCE_CLEANUP_STATUS_FAILURE === "1";
const FORCE_TASKKILL_TIMEOUT = process.env.XTBM_FORCE_TASKKILL_TIMEOUT === "1";
const FORCE_TASKKILL_NONZERO = process.env.XTBM_FORCE_TASKKILL_NONZERO === "1";
const FORCE_HELPER_SPAWN_ERROR = process.env.XTBM_FORCE_HELPER_SPAWN_ERROR === "1";
const FORCE_HELPER_AFTER_SPAWN_ERROR =
  process.env.XTBM_FORCE_HELPER_AFTER_SPAWN_ERROR === "1";
const FORCE_HELPER_KILL_ERROR = process.env.XTBM_FORCE_HELPER_KILL_ERROR === "1";

// mainのfinallyとwatchdogが同時に到達しても、同じcleanup Promiseを共有する。
// watchdogがprocess.exitする前にも必ずこの参照を経由させる。
let activeCleanup = null;
// watchdog callbackが始まった時点でterminal failureを固定する。cleanup完了時に
// main側の継続が先に再開しても、このlatchを再確認してexit 0を禁止する。
let watchdogTriggered = false;

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

function boundedDuration(rawValue, fallback, minimum, maximum) {
  const parsed = Number.parseInt(String(rawValue || ""), 10);
  if (!Number.isFinite(parsed)) {
    return fallback;
  }
  return Math.min(maximum, Math.max(minimum, parsed));
}

async function settleWithin(promise, timeoutMs) {
  let timer;
  try {
    return await Promise.race([
      Promise.resolve(promise).then(
        (value) => ({ status: "ok", value }),
        (error) => ({ status: "error", error: sanitizeDiagnosticText(error?.message || error) })
      ),
      new Promise((resolve) => {
        timer = setTimeout(() => resolve({ status: "timeout" }), timeoutMs);
      })
    ]);
  } finally {
    clearTimeout(timer);
  }
}

function waitForChildExit(child, timeoutMs) {
  if (!child || child.exitCode !== null || child.signalCode) {
    return Promise.resolve(true);
  }
  return new Promise((resolve) => {
    let settled = false;
    const finish = (exited) => {
      if (settled) {
        return;
      }
      settled = true;
      clearTimeout(timer);
      child.removeListener("exit", onExit);
      resolve(exited);
    };
    const onExit = () => finish(true);
    const timer = setTimeout(() => finish(false), timeoutMs);
    child.once("exit", onExit);
  });
}

function runBoundedHelper(
  executable,
  args,
  timeoutMs,
  { forceAfterSpawnError = false, forceKillError = false } = {}
) {
  return new Promise((resolve) => {
    let settled = false;
    let timedOut = false;
    let stderrLength = 0;
    let helperSpawned = false;
    let postSpawnErrorCode = null;
    let killRetryAttempted = false;
    let timeoutTimer;
    let exitGraceTimer;
    let finalExitTimer;
    let postSpawnErrorTimer;
    let helper;

    const helperHasExited = () =>
      Boolean(helper && (helper.exitCode !== null || helper.signalCode !== null));

    // helperのstderr本文はsecret/pathを含み得るため保持せず、長さだけ数える。
    const finish = ({ status, exitCode = null, signal = null, errorCode = null }) => {
      if (settled) {
        return;
      }
      settled = true;
      clearTimeout(timeoutTimer);
      clearTimeout(exitGraceTimer);
      clearTimeout(finalExitTimer);
      clearTimeout(postSpawnErrorTimer);
      const spawnNeverStarted =
        !helperSpawned && !Number.isInteger(helper?.pid);
      resolve({
        status,
        exitCode,
        signal,
        errorCode,
        helperSpawned,
        postSpawnErrorCode,
        killRetryAttempted,
        // ChildProcess.killedはsignal送信の事実にすぎないため終了証拠に使わない。
        // pre-spawn失敗以外はexitCode / signalCode / exit eventだけで判定する。
        helperExited:
          (status === "spawn-error" && spawnNeverStarted) || helperHasExited(),
        stderrRedacted: stderrLength > 0 ? `[redacted:${stderrLength} chars]` : ""
      });
    };

    const handleHelperError = (error) => {
      const started = helperSpawned || Number.isInteger(helper?.pid);
      if (!started) {
        finish({ status: "spawn-error", errorCode: error?.code || "SPAWN_ERROR" });
        return;
      }
      // spawn後のkill/error eventではsettleしない。実exitまたは2段の
      // bounded graceが終わるまでhelperExited=falseを維持する。
      postSpawnErrorCode ||= error?.code || "POST_SPAWN_ERROR";
    };

    const signalHelper = ({ syntheticFailure = false, retry = false } = {}) => {
      if (retry) {
        killRetryAttempted = true;
      }
      if (syntheticFailure) {
        const error = new Error("synthetic post-spawn kill failure");
        error.code = "SYNTHETIC_KILL_ERROR";
        helper.emit("error", error);
        return;
      }
      try {
        // retryでも同じ起動済みhelperのexact PIDにだけsignalする。
        const sent = retry
          ? process.kill(helper.pid, "SIGKILL")
          : helper.kill("SIGKILL");
        if (sent === false) {
          const error = new Error("helper kill returned false");
          error.code = "KILL_RETURNED_FALSE";
          handleHelperError(error);
        }
      } catch (error) {
        handleHelperError(error);
      }
    };

    try {
      helper = spawn(executable, args, {
        stdio: ["ignore", "ignore", "pipe"],
        windowsHide: true
      });
    } catch (error) {
      finish({ status: "spawn-error", errorCode: error?.code || "SPAWN_THROW" });
      return;
    }

    helper.once("spawn", () => {
      helperSpawned = true;
      if (forceAfterSpawnError) {
        postSpawnErrorTimer = setTimeout(() => {
          const error = new Error("synthetic post-spawn helper error");
          error.code = "SYNTHETIC_AFTER_SPAWN_ERROR";
          helper.emit("error", error);
        }, 10);
      }
    });
    helper.stderr?.on("data", (chunk) => {
      stderrLength += Buffer.byteLength(chunk);
    });
    helper.on("error", handleHelperError);
    helper.once("exit", (exitCode, signal) => {
      finish({
        status: timedOut ? "timeout" : exitCode === 0 ? "ok" : "nonzero",
        exitCode,
        signal
      });
    });
    helper.once("close", (exitCode, signal) => {
      finish({
        status: timedOut ? "timeout" : exitCode === 0 ? "ok" : "nonzero",
        exitCode,
        signal
      });
    });

    timeoutTimer = setTimeout(() => {
      timedOut = true;
      signalHelper({ syntheticFailure: forceKillError });
      exitGraceTimer = setTimeout(() => {
        if (helperHasExited()) {
          finish({
            status: "timeout",
            exitCode: helper.exitCode,
            signal: helper.signalCode
          });
          return;
        }

        // 最初のkillまたはそのerror後も生存する場合だけ、exact helper PIDへ
        // 1回再送し、さらにboundedにexit/signalを待つ。
        signalHelper({ retry: true });
        finalExitTimer = setTimeout(
          () =>
            finish({
              status: "timeout",
              exitCode: helper.exitCode,
              signal: helper.signalCode
            }),
          TASKKILL_EXIT_GRACE_MS
        );
      }, TASKKILL_EXIT_GRACE_MS);
    }, timeoutMs);
  });
}

function realTaskkillCommand(child) {
  return {
    executable: process.env.SystemRoot
      ? path.join(process.env.SystemRoot, "System32", "taskkill.exe")
      : "taskkill.exe",
    args: ["/PID", String(child.pid), "/T", "/F"]
  };
}

async function runTaskkill(child, forcedMode = "none") {
  if (
    forcedMode === "timeout" ||
    forcedMode === "after-spawn-error" ||
    forcedMode === "kill-error"
  ) {
    // 実taskkillを止めず、同じbounded helper runnerだけを意図的にtimeoutさせる。
    return runBoundedHelper(
      process.execPath,
      ["-e", "process.title='xtbm-taskkill-timeout';setTimeout(()=>{},10000)"],
      TASKKILL_TIMEOUT_MS,
      {
        forceAfterSpawnError: forcedMode === "after-spawn-error",
        forceKillError: forcedMode === "kill-error"
      }
    );
  }
  if (forcedMode === "nonzero") {
    return runBoundedHelper(
      process.execPath,
      ["-e", "process.stderr.write('synthetic helper failure');process.exit(23)"],
      TASKKILL_TIMEOUT_MS
    );
  }
  if (forcedMode === "spawn-error") {
    return runBoundedHelper(
      path.join(os.tmpdir(), "xtbm-missing-taskkill-helper.exe"),
      [],
      TASKKILL_TIMEOUT_MS
    );
  }
  const { executable, args } = realTaskkillCommand(child);
  return runBoundedHelper(executable, args, TASKKILL_TIMEOUT_MS);
}

async function terminateProcessTree(child) {
  const result = {
    taskkillStatus: "not-applicable",
    taskkillExitCode: null,
    taskkillErrorCode: null,
    taskkillHelperSpawned: false,
    taskkillPostSpawnErrorCode: null,
    taskkillKillRetryAttempted: false,
    taskkillHelperExited: true,
    taskkillStderrRedacted: "",
    taskkillFallbackStatus: "not-run",
    taskkillFallbackExitCode: null,
    taskkillFallbackErrorCode: null,
    taskkillFallbackHelperSpawned: false,
    taskkillFallbackPostSpawnErrorCode: null,
    taskkillFallbackKillRetryAttempted: false,
    taskkillFallbackHelperExited: true,
    taskkillFallbackStderrRedacted: "",
    childExited: false
  };
  if (!child || child.exitCode !== null || child.signalCode) {
    result.childExited = true;
    return result;
  }

  // WindowsのChromiumは複数processを持つため、parentだけでなくtaskkill /Tを
  // bounded helperとして実行し、timeout・exit code・helper終了を別々に記録する。
  if (process.platform === "win32") {
    const forcedMode = FORCE_TASKKILL_TIMEOUT
      ? "timeout"
      : FORCE_TASKKILL_NONZERO
        ? "nonzero"
        : FORCE_HELPER_SPAWN_ERROR
          ? "spawn-error"
          : FORCE_HELPER_AFTER_SPAWN_ERROR
            ? "after-spawn-error"
            : FORCE_HELPER_KILL_ERROR
              ? "kill-error"
              : "none";
    const taskkill = await runTaskkill(child, forcedMode);
    result.taskkillStatus = taskkill.status;
    result.taskkillExitCode = taskkill.exitCode;
    result.taskkillErrorCode = taskkill.errorCode;
    result.taskkillHelperSpawned = taskkill.helperSpawned;
    result.taskkillPostSpawnErrorCode = taskkill.postSpawnErrorCode;
    result.taskkillKillRetryAttempted = taskkill.killRetryAttempted;
    result.taskkillHelperExited = taskkill.helperExited;
    result.taskkillStderrRedacted = taskkill.stderrRedacted;

    // 最初のhelperが失敗しても実Chromium treeを残さない。self-testの疑似helper
    // または実taskkill失敗後に、実taskkillをもう1回だけboundedに実行する。
    if (taskkill.status !== "ok" || !taskkill.helperExited) {
      const fallback = await runTaskkill(child);
      result.taskkillFallbackStatus = fallback.status;
      result.taskkillFallbackExitCode = fallback.exitCode;
      result.taskkillFallbackErrorCode = fallback.errorCode;
      result.taskkillFallbackHelperSpawned = fallback.helperSpawned;
      result.taskkillFallbackPostSpawnErrorCode = fallback.postSpawnErrorCode;
      result.taskkillFallbackKillRetryAttempted = fallback.killRetryAttempted;
      result.taskkillFallbackHelperExited = fallback.helperExited;
      result.taskkillFallbackStderrRedacted = fallback.stderrRedacted;
    }
  } else {
    try {
      child.kill("SIGKILL");
    } catch {
      // 直前に終了したraceは後続のexit確認で成功扱いにする。
    }
  }

  result.childExited = await waitForChildExit(child, TASKKILL_TIMEOUT_MS);
  if (!result.childExited) {
    // taskkill /Tとfallbackの双方が失敗した場合も、parent handleへ最後の
    // bounded killを行う。結果は必ずsummaryに残してfalse greenを防ぐ。
    try {
      child.kill("SIGKILL");
    } catch {
      // 直前に終了したraceは次のexit確認で判定する。
    }
    result.childExited = await waitForChildExit(child, CHILD_EXIT_GRACE_MS);
  }
  return result;
}

async function removeUserDataDirectory(userDataDir) {
  // Windows file lockの解放に短い猶予を与えるが、試行回数は固定する。
  for (let attempt = 0; attempt < 3; attempt += 1) {
    try {
      fs.rmSync(userDataDir, { recursive: true, force: true });
      if (!fs.existsSync(userDataDir)) {
        return true;
      }
    } catch {
      // 次のbounded retryへ進む。
    }
    await sleep(100);
  }
  return !fs.existsSync(userDataDir);
}

function createBrowserCleanup({ child, userDataDir, getCdp }) {
  let cleanupPromise = null;
  return function cleanup() {
    if (cleanupPromise) {
      return cleanupPromise;
    }

    cleanupPromise = (async () => {
      const summary = {
        browserClose: "not-connected",
        treeTerminateAttempted: false,
        taskkillStatus: "not-run",
        taskkillExitCode: null,
        taskkillErrorCode: null,
        taskkillHelperSpawned: false,
        taskkillPostSpawnErrorCode: null,
        taskkillKillRetryAttempted: false,
        taskkillHelperExited: true,
        taskkillStderrRedacted: "",
        taskkillFallbackStatus: "not-run",
        taskkillFallbackExitCode: null,
        taskkillFallbackErrorCode: null,
        taskkillFallbackHelperSpawned: false,
        taskkillFallbackPostSpawnErrorCode: null,
        taskkillFallbackKillRetryAttempted: false,
        taskkillFallbackHelperExited: true,
        taskkillFallbackStderrRedacted: "",
        childExited: false,
        profileRemoved: false,
        cleanupFailures: [],
        cleanupComplete: false
      };
      const cdp = getCdp();
      if (cdp) {
        // review用self-testでは応答遅延を有限に模擬し、timeout後のtree killを通す。
        const mustForceCloseTimeout =
          FORCE_BROWSER_CLOSE_TIMEOUT ||
          FORCE_WATCHDOG_RACE ||
          FORCE_TASKKILL_TIMEOUT ||
          FORCE_TASKKILL_NONZERO ||
          FORCE_HELPER_SPAWN_ERROR ||
          FORCE_HELPER_AFTER_SPAWN_ERROR ||
          FORCE_HELPER_KILL_ERROR;
        const closeRequest = mustForceCloseTimeout
          ? sleep(BROWSER_CLOSE_TIMEOUT_MS + 500)
          : cdp.send("Browser.close").catch((error) => {
              throw error;
            });
        const closeResult = await settleWithin(closeRequest, BROWSER_CLOSE_TIMEOUT_MS);
        summary.browserClose = closeResult.status;
      }

      // Browser.closeが失敗・timeoutしてもfinally相当の後段を止めない。
      summary.childExited = await waitForChildExit(child, CHILD_EXIT_GRACE_MS);
      if (!summary.childExited) {
        summary.treeTerminateAttempted = true;
        const termination = await terminateProcessTree(child);
        Object.assign(summary, termination);
      }
      const profileRemoved = await removeUserDataDirectory(userDataDir);
      // normal cleanup false-greenを再現する自己試験では、実際のdirectoryを
      // 消した後にstatusだけを失敗へ固定し、残存物を作らず終了判定を検証する。
      summary.profileRemoved = FORCE_CLEANUP_STATUS_FAILURE ? false : profileRemoved;

      if (cdp && summary.browserClose !== "ok") {
        summary.cleanupFailures.push(`browserClose:${summary.browserClose}`);
      }
      if (
        summary.treeTerminateAttempted &&
        process.platform === "win32" &&
        (summary.taskkillStatus !== "ok" || !summary.taskkillHelperExited)
      ) {
        summary.cleanupFailures.push(`taskkill:${summary.taskkillStatus}`);
      }
      if (
        summary.taskkillFallbackStatus !== "not-run" &&
        (summary.taskkillFallbackStatus !== "ok" || !summary.taskkillFallbackHelperExited)
      ) {
        summary.cleanupFailures.push(`taskkillFallback:${summary.taskkillFallbackStatus}`);
      }
      if (!summary.childExited) {
        summary.cleanupFailures.push("childExited:false");
      }
      if (!summary.profileRemoved) {
        summary.cleanupFailures.push("profileRemoved:false");
      }
      summary.cleanupComplete = summary.cleanupFailures.length === 0;
      return summary;
    })();
    return cleanupPromise;
  };
}

// ---------------------------------------------------------------------------
// Minimal CDP client over Node's global WebSocket.
// ---------------------------------------------------------------------------
class Cdp {
  constructor(ws) {
    this.ws = ws;
    this.nextId = 0;
    this.pending = new Map();
    this.diagnosticsBySession = new Map();
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
        return;
      }
      if (msg.method && msg.sessionId) {
        this.captureDiagnosticEvent(msg);
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

  // about:blank で attach した直後からsession単位で記録を開始し、別pageの
  // console/network eventを混ぜない。配列とrequest mapには上限を設ける。
  registerDiagnostics(sessionId, label) {
    this.diagnosticsBySession.set(sessionId, {
      label,
      requests: new Map(),
      runtimeExceptionCount: 0,
      consoleErrorCount: 0,
      failedRequestCount: 0,
      runtimeExceptions: [],
      consoleErrors: [],
      failedRequests: []
    });
  }

  getDiagnostics(sessionId) {
    const state = this.diagnosticsBySession.get(sessionId);
    if (!state) {
      return {
        label: "unknown",
        runtimeExceptionCount: 0,
        consoleErrorCount: 0,
        failedRequestCount: 0,
        runtimeExceptions: [],
        consoleErrors: [],
        failedRequests: []
      };
    }
    return {
      label: state.label,
      runtimeExceptionCount: state.runtimeExceptionCount,
      consoleErrorCount: state.consoleErrorCount,
      failedRequestCount: state.failedRequestCount,
      runtimeExceptions: [...state.runtimeExceptions],
      consoleErrors: [...state.consoleErrors],
      failedRequests: [...state.failedRequests]
    };
  }

  captureDiagnosticEvent({ method, params = {}, sessionId }) {
    const state = this.diagnosticsBySession.get(sessionId);
    if (!state) {
      return;
    }

    // request本文やquery値は保持せず、失敗時の安全なpath表示に必要なURLだけを
    // requestIdへ一時対応付けする。正常完了後は直ちに破棄する。
    if (method === "Network.requestWillBeSent") {
      if (state.requests.size >= MAX_TRACKED_REQUESTS) {
        state.requests.delete(state.requests.keys().next().value);
      }
      state.requests.set(params.requestId, sanitizeDiagnosticUrl(params.request?.url));
      return;
    }
    if (method === "Network.loadingFinished") {
      state.requests.delete(params.requestId);
      return;
    }
    if (method === "Network.loadingFailed") {
      state.failedRequestCount += 1;
      pushBounded(state.failedRequests, {
        url: state.requests.get(params.requestId) || "<unknown>",
        errorText: sanitizeDiagnosticText(params.errorText),
        type: sanitizeDiagnosticText(params.type),
        canceled: Boolean(params.canceled),
        blockedReason: sanitizeDiagnosticText(params.blockedReason)
      });
      state.requests.delete(params.requestId);
      return;
    }

    // uncaught exceptionはpageerror相当、error-level console/logだけを失敗証拠にする。
    if (method === "Runtime.exceptionThrown") {
      state.runtimeExceptionCount += 1;
      pushBounded(
        state.runtimeExceptions,
        sanitizeDiagnosticText(
          params.exceptionDetails?.exception?.description ||
            params.exceptionDetails?.text ||
            "unknown runtime exception"
        )
      );
      return;
    }
    if (method === "Runtime.consoleAPICalled" && params.type === "error") {
      state.consoleErrorCount += 1;
      pushBounded(
        state.consoleErrors,
        sanitizeDiagnosticText(
          (params.args || [])
            .map((arg) => arg.value ?? arg.description ?? arg.type ?? "")
            .join(" ")
        )
      );
      return;
    }
    if (method === "Log.entryAdded" && params.entry?.level === "error") {
      state.consoleErrorCount += 1;
      pushBounded(state.consoleErrors, sanitizeDiagnosticText(params.entry.text));
    }
  }
}

function pushBounded(list, value) {
  if (list.length < MAX_DIAGNOSTICS_PER_KIND) {
    list.push(value);
  }
}

function sanitizeDiagnosticText(value) {
  return String(value || "").replace(/\s+/g, " ").trim().slice(0, 500);
}

function sanitizeDiagnosticUrl(value) {
  try {
    const url = new URL(String(value || ""));
    return `${url.protocol}//${url.host}${url.pathname}`.slice(0, 500);
  } catch {
    return String(value || "").split(/[?#]/, 1)[0].slice(0, 500);
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

async function openPage(cdp, url, { label = "page", viewport } = {}) {
  // blank targetへ先にattachして各domainを有効化し、navigation開始直後の
  // pageerror / console error / loadingFailedを取りこぼさない。
  const { targetId } = await cdp.send("Target.createTarget", { url: "about:blank" });
  const { sessionId } = await cdp.send("Target.attachToTarget", { targetId, flatten: true });
  cdp.registerDiagnostics(sessionId, label);
  await cdp.send("Runtime.enable", {}, sessionId);
  await cdp.send("Page.enable", {}, sessionId);
  await cdp.send("Log.enable", {}, sessionId);
  await cdp.send("Network.enable", {}, sessionId);
  if (viewport) {
    await cdp.send(
      "Emulation.setDeviceMetricsOverride",
      {
        width: viewport.width,
        height: viewport.height,
        deviceScaleFactor: 1,
        mobile: false
      },
      sessionId
    );
  }
  const navigation = await cdp.send("Page.navigate", { url }, sessionId);
  if (navigation.errorText) {
    throw new Error(`navigation failed for ${label}: ${navigation.errorText}`);
  }
  await pollValue(
    async () => {
      try {
        const readyState = await evaluate(cdp, sessionId, "document.readyState");
        return { ok: readyState === "complete", value: readyState };
      } catch (error) {
        return { ok: false, value: error.message };
      }
    },
    { timeout: 12000, desc: `${label} document.readyState=complete` }
  );
  return { targetId, sessionId };
}

function pngDimensions(buffer) {
  if (
    buffer.length < 24 ||
    buffer.toString("ascii", 1, 4) !== "PNG"
  ) {
    return null;
  }
  return {
    width: buffer.readUInt32BE(16),
    height: buffer.readUInt32BE(20)
  };
}

async function captureScreenshot(
  cdp,
  sessionId,
  file,
  { fullPage = false, viewportWidth = 0 } = {}
) {
  try {
    const params = {
      format: "png",
      fromSurface: true,
      captureBeyondViewport: fullPage
    };
    if (fullPage) {
      const metrics = await cdp.send("Page.getLayoutMetrics", {}, sessionId);
      const contentSize = metrics.cssContentSize || metrics.contentSize;
      const layoutViewport = metrics.cssLayoutViewport || metrics.layoutViewport;
      params.clip = {
        x: 0,
        y: 0,
        // 縦scrollbarがあるとcontent widthはviewportより約15px狭くなる。
        // 指定viewport幅を証拠画像へ残しつつ、長いpage全体をcaptureする。
        width: Math.ceil(Math.max(contentSize.width, layoutViewport.clientWidth, viewportWidth)),
        height: Math.ceil(Math.max(contentSize.height, layoutViewport.clientHeight)),
        scale: 1
      };
    }
    const { data } = await cdp.send("Page.captureScreenshot", params, sessionId);
    const image = Buffer.from(data, "base64");
    fs.writeFileSync(file, image);
    console.log(`  note  screenshot saved: ${path.relative(repoRoot, file)}`);
    return { file, ...pngDimensions(image) };
  } catch (error) {
    console.log(`  note  screenshot skipped: ${error.message}`);
    return null;
  }
}

async function checkPageDiagnostics(cdp, page, label) {
  // load完了直後のCDP event配送を短く待つ。固定100msで、pollingや待機ループは増やさない。
  await sleep(100);
  const diagnostics = cdp.getDiagnostics(page.sessionId);
  check(
    diagnostics.runtimeExceptionCount === 0,
    `${label}: runtime/page errors = 0`,
    JSON.stringify(diagnostics.runtimeExceptions)
  );
  check(
    diagnostics.consoleErrorCount === 0,
    `${label}: console errors = 0`,
    JSON.stringify(diagnostics.consoleErrors)
  );
  check(
    diagnostics.failedRequestCount === 0,
    `${label}: failed requests = 0`,
    JSON.stringify(diagnostics.failedRequests)
  );
  return diagnostics;
}

async function probeOptionsViewport(cdp, sessionId) {
  return evaluate(
    cdp,
    sessionId,
    `(() => {
      const inspect = (selector) => {
        const element = document.querySelector(selector);
        if (!element) {
          return { exists: false, visible: false, text: "", fontSize: 0, width: 0, height: 0, withinWidth: false };
        }
        const rect = element.getBoundingClientRect();
        const style = getComputedStyle(element);
        return {
          exists: true,
          visible:
            style.display !== "none" &&
            style.visibility !== "hidden" &&
            rect.width > 0 &&
            rect.height > 0,
          text: (element.textContent || "").replace(/\\s+/g, " ").trim(),
          fontSize: Number.parseFloat(style.fontSize) || 0,
          width: rect.width,
          height: rect.height,
          withinWidth: rect.left >= -0.5 && rect.right <= window.innerWidth + 0.5
        };
      };
      const documentScrollWidth = Math.max(
        document.documentElement.scrollWidth,
        document.body ? document.body.scrollWidth : 0
      );
      return {
        innerWidth: window.innerWidth,
        innerHeight: window.innerHeight,
        documentScrollWidth,
        bodyFontSize: Number.parseFloat(getComputedStyle(document.body).fontSize) || 0,
        heading: inspect("h1"),
        privacyHeading: inspect("#privacy-title"),
        privacyStatementPresent: (document.body.textContent || "").includes("外部サーバーへは送信されません"),
        buttons: [
          inspect("#options-clear-synced"),
          inspect("#options-clear-synthetic")
        ],
        blocked: document.querySelector("#synced-blocked-count")?.textContent || "",
        muted: document.querySelector("#synced-muted-count")?.textContent || "",
        synthetic: document.querySelector("#synthetic-count")?.textContent || "",
        emptyShown: (() => {
          const element = document.querySelector("#synced-empty");
          return Boolean(element) && element.offsetParent !== null;
        })()
      };
    })()`
  );
}

async function verifyDiagnosticCollector(cdp) {
  // 実pageの「0件」がcollector未接続によるfalse-greenでないことを、専用sessionで
  // console error・uncaught exception・localhost失敗requestを意図的に発生させて確認する。
  const page = await openPage(cdp, "about:blank", { label: "diagnostic self-test" });
  try {
    await evaluate(
      cdp,
      page.sessionId,
      `(() => {
        console.error("__xtbm_synthetic_console_probe__");
        setTimeout(() => {
          throw new Error("__xtbm_synthetic_runtime_probe__");
        }, 0);
        fetch("http://127.0.0.1:65534/__xtbm_synthetic_network_probe__").catch(() => {});
        return true;
      })()`
    );
    const diagnostics = await pollValue(
      async () => {
        const value = cdp.getDiagnostics(page.sessionId);
        return {
          ok:
            value.runtimeExceptionCount >= 1 &&
            value.consoleErrorCount >= 1 &&
            value.failedRequestCount >= 1,
          value
        };
      },
      { timeout: 5000, interval: 50, desc: "diagnostic self-test events" }
    );
    check(
      diagnostics.runtimeExceptionCount >= 1,
      "diagnostic collector captures runtime/page errors",
      JSON.stringify(diagnostics.runtimeExceptions)
    );
    check(
      diagnostics.consoleErrorCount >= 1,
      "diagnostic collector captures console errors",
      JSON.stringify(diagnostics.consoleErrors)
    );
    check(
      diagnostics.failedRequestCount >= 1,
      "diagnostic collector captures failed requests",
      JSON.stringify(diagnostics.failedRequests)
    );
  } finally {
    await cdp.send("Target.closeTarget", { targetId: page.targetId }).catch(() => {});
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

// The extension ships no background service worker (research + scripting were
// retired in M7), so there is no service-worker target to discover. The unpacked
// id is deterministic from the absolute path and is confirmed by the popup
// actually rendering below.
function findExtensionId(repoRoot) {
  return { id: computeExtensionId(repoRoot), source: "computed" };
}

// Chromium's deterministic unpacked-extension id: sha256 of the absolute path,
// first 32 hex nibbles mapped 0-f -> a-p. On Windows Chromium hashes the path as
// UTF-16LE (wide chars); elsewhere as UTF-8. Verified by loading the popup.
function computeExtensionId(absPath) {
  const bytes = process.platform === "win32" ? Buffer.from(absPath, "utf16le") : Buffer.from(absPath, "utf8");
  const hash = createHash("sha256").update(bytes).digest("hex");
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
  const cleanup = createBrowserCleanup({
    child,
    userDataDir,
    getCdp: () => cdp
  });
  activeCleanup = cleanup;

  try {
    const { port, wsPath } = await waitForDevToolsPort(userDataDir);
    const browserWsUrl = `ws://127.0.0.1:${port}${wsPath || ""}`;
    const ws = await connect(browserWsUrl);
    cdp = new Cdp(ws);

    // mainが先にcleanup待ちへ入り、その途中でwatchdogが発火するraceを再現する。
    // watchdog timerより少し前にreturnし、共有cleanup完了後の成功経路を検査する。
    if (FORCE_WATCHDOG_RACE) {
      console.log(`watchdog race self-test Chromium PID: ${child.pid}`);
      console.log(`watchdog race self-test profile: ${userDataDir}`);
      const elapsedMs = Date.now() - scriptStartedAt;
      await sleep(Math.max(0, WATCHDOG_MS - elapsedMs - 50));
      return;
    }

    // watchdog経路の自己試験では、実際のChromium起動後に有限時間だけ待つ。
    // PIDとprofile pathは、試験後に残存ゼロを外側から照合するためだけに出す。
    if (FORCE_WATCHDOG) {
      console.log(`watchdog self-test Chromium PID: ${child.pid}`);
      console.log(`watchdog self-test profile: ${userDataDir}`);
      await sleep(WATCHDOG_MS + WATCHDOG_CLEANUP_TIMEOUT_MS + 2000);
      throw new Error("watchdog self-test did not exit within its bounded window");
    }

    // cleanup statusとtaskkill helperの異常注入は機能probeを省略し、正常な
    // main returnからfinallyだけを通してterminal failureへ接続できるかを測る。
    if (
      FORCE_CLEANUP_STATUS_FAILURE ||
      FORCE_TASKKILL_TIMEOUT ||
      FORCE_TASKKILL_NONZERO ||
      FORCE_HELPER_SPAWN_ERROR ||
      FORCE_HELPER_AFTER_SPAWN_ERROR ||
      FORCE_HELPER_KILL_ERROR
    ) {
      console.log(`cleanup failure self-test Chromium PID: ${child.pid}`);
      console.log(`cleanup failure self-test profile: ${userDataDir}`);
      return;
    }

    // --- Check 0: diagnostics fail closed instead of reporting false zero ---
    await verifyDiagnosticCollector(cdp);

    // --- Check 1: extension id (deterministic; popup render below proves load) ---
    const { id: extensionId, source } = findExtensionId(repoRoot);
    check(Boolean(extensionId), "extension id derived from unpacked path", source);
    console.log(`  note  extension id: ${extensionId} (source: ${source})`);

    // --- Check 2 & 3: popup renders and seeding updates the count -------
    const popupUrl = `chrome-extension://${extensionId}/src/popup/popup.html`;
    const popup = await openPage(cdp, popupUrl, { label: "popup" });

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

    // v1.1: the local sample/test-data panel (incl. #seed-synthetic and #entry-count)
    // is hidden from end users, so seed the extension's storage programmatically via
    // the Storage API in the popup's extension context instead of clicking the button.
    const seededCount = await evaluate(
      cdp,
      popup.sessionId,
      "window.XTrueBlockMute.Storage.seedSyntheticEntries().then(() => window.XTrueBlockMute.Storage.getEntryStore()).then((store) => store.entries.length)",
      true
    ).catch((error) => `ERROR: ${error.message}`);
    check(seededCount === 2, "seeding sample data persists 2 synthetic entries", String(seededCount));

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

    // The dev-only sample/test-data panel must be hidden from end users (gated off
    // by LOCAL_TEST_UI_ENABLED). offsetParent === null confirms it is not rendered.
    const devPanelHidden = await evaluate(
      cdp,
      popup.sessionId,
      "(() => { const el = document.querySelector(\"[aria-labelledby='local-test-title']\"); return Boolean(el) && el.offsetParent === null; })()"
    );
    check(devPanelHidden === true, "dev-only sample-data panel is hidden from end users", String(devPanelHidden));
    await checkPageDiagnostics(cdp, popup, "popup");

    // --- Check 4: synthetic fixture filters cards -----------------------
    const fixtureUrl = pathToFileURL(
      path.join(repoRoot, "tests", "fixtures", "home-timeline.html")
    ).href;
    const fixture = await openPage(cdp, fixtureUrl, { label: "home fixture" });

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

    // XHR自身がevent targetのため、後から登録したcapture listenerは先行listenerを追い越さない。
    // 実X通信は行わず、合成readystatechangeを手動dispatchして再入対策の前提だけを実測する。
    const xhrListenerOrder = await evaluate(
      cdp,
      fixture.sessionId,
      `(() => {
        const xhr = new XMLHttpRequest();
        const order = [];
        xhr.addEventListener("readystatechange", () => order.push("normal"));
        xhr.addEventListener("readystatechange", () => order.push("capture"), true);
        xhr.dispatchEvent(new Event("readystatechange"));
        return order.join(",");
      })()`
    );
    check(
      xhrListenerOrder === "normal,capture",
      "XHR target preserves an earlier normal readystatechange listener before later capture",
      String(xhrListenerOrder)
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
    await checkPageDiagnostics(cdp, fixture, "home fixture");

    // --- Check 5: real-DOM-shaped author matching (M5) ------------------
    const realDomUrl = pathToFileURL(path.join(repoRoot, "tests", "fixtures", "real-dom-timeline.html")).href;
    const realDom = await openPage(cdp, realDomUrl, { label: "real-DOM fixture" });
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
      " reservedHashtag: Boolean(document.querySelector('[data-test-id=\\'card-reserved-hashtag\\']'))," +
      " reservedIntent: Boolean(document.querySelector('[data-test-id=\\'card-reserved-intent\\']'))," +
      " reservedLists: Boolean(document.querySelector('[data-test-id=\\'card-reserved-lists\\']'))," +
      " reservedCommunities: Boolean(document.querySelector('[data-test-id=\\'card-reserved-communities\\']'))," +
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
    check(realDomResult.reservedHashtag === true, "real-DOM: /hashtag route is not treated as an author", realDomResult);
    check(realDomResult.reservedIntent === true, "real-DOM: /intent route is not treated as an author", realDomResult);
    check(realDomResult.reservedLists === true, "real-DOM: /lists route is not treated as an author", realDomResult);
    check(
      realDomResult.reservedCommunities === true,
      "real-DOM: /communities route is not treated as an author",
      realDomResult
    );
    await checkPageDiagnostics(cdp, realDom, "real-DOM fixture");

    // --- Check 6: options page renders responsively in extension context -
    // The popup already seeded 2 synthetic entries into this profile and no real
    // sync ran. 各viewportを独立sessionで開き、storage表示、横overflow、
    // 主要text/controlのreadability、browser diagnosticsを同時に検証する。
    const optionsUrl = `chrome-extension://${extensionId}/src/options/options.html`;
    for (const viewport of OPTIONS_VIEWPORTS) {
      const label = `options ${viewport.name} ${viewport.width}x${viewport.height}`;
      const options = await openPage(cdp, optionsUrl, { label, viewport });
      const probe = await pollValue(
        async () => {
          const value = await probeOptionsViewport(cdp, options.sessionId);
          return { ok: value.synthetic === "2件", value };
        },
        { timeout: 8000, desc: `${label} storage-backed UI` }
      ).catch((error) => ({ error: error.message }));

      check(
        probe.innerWidth === viewport.width && probe.innerHeight === viewport.height,
        `${label}: exact viewport applied`,
        JSON.stringify({ innerWidth: probe.innerWidth, innerHeight: probe.innerHeight })
      );
      check(
        probe.documentScrollWidth <= probe.innerWidth,
        `${label}: no horizontal overflow`,
        JSON.stringify({ scrollWidth: probe.documentScrollWidth, innerWidth: probe.innerWidth })
      );
      check(
        probe.heading?.visible &&
          probe.heading.withinWidth &&
          probe.heading.fontSize >= 20 &&
          probe.heading.text.includes("TrueBlock & Mute 設定"),
        `${label}: primary heading is readable`,
        JSON.stringify(probe.heading)
      );
      check(
        probe.privacyHeading?.visible &&
          probe.privacyHeading.withinWidth &&
          probe.privacyHeading.fontSize >= 16 &&
          probe.privacyStatementPresent,
        `${label}: privacy explanation is readable`,
        JSON.stringify({
          heading: probe.privacyHeading,
          statementPresent: probe.privacyStatementPresent
        })
      );
      check(
        probe.bodyFontSize >= 14,
        `${label}: base text is at least 14px`,
        String(probe.bodyFontSize)
      );
      check(
        probe.buttons?.length === 2 &&
          probe.buttons.every(
            (button) =>
              button.visible &&
              button.withinWidth &&
              button.fontSize >= 14 &&
              button.height >= 40 &&
              button.text.length > 0
          ),
        `${label}: management controls are readable and usable`,
        JSON.stringify(probe.buttons)
      );
      check(
        probe.blocked === "0件" && probe.muted === "0件" && probe.synthetic === "2件",
        `${label}: storage counts render`,
        JSON.stringify({ blocked: probe.blocked, muted: probe.muted, synthetic: probe.synthetic })
      );
      check(
        probe.emptyShown === true,
        `${label}: empty state renders when no synced entries exist`,
        String(probe.emptyShown)
      );

      const screenshot = await captureScreenshot(
        cdp,
        options.sessionId,
        path.join(tmpDir, `tb002-options-${viewport.name}-${viewport.width}x${viewport.height}.png`),
        { fullPage: true, viewportWidth: viewport.width }
      );
      check(
        screenshot?.width === viewport.width && screenshot.height >= viewport.height,
        `${label}: full-page screenshot captured at viewport width`,
        JSON.stringify(screenshot)
      );
      await checkPageDiagnostics(cdp, options, label);
    }
  } finally {
    const cleanupSummary = await cleanup();
    console.log(`  note  cleanup: ${JSON.stringify(cleanupSummary)}`);
    if (!cleanupSummary.cleanupComplete) {
      const cleanupFailure = `browser cleanup incomplete: ${cleanupSummary.cleanupFailures.join(", ")}`;
      failures.push(cleanupFailure);
      console.error(`  FAIL  ${cleanupFailure}`);
    }
    if (activeCleanup === cleanup) {
      activeCleanup = null;
    }
  }
}

const watchdog = setTimeout(async () => {
  watchdogTriggered = true;
  console.error(`watchdog: ${WATCHDOG_MS}ms elapsed; starting bounded cleanup`);
  const cleanupResult = activeCleanup
    ? await settleWithin(activeCleanup(), WATCHDOG_CLEANUP_TIMEOUT_MS)
    : { status: "error", error: "browser cleanup was not registered" };
  const cleanupDetail =
    cleanupResult.status === "ok" ? cleanupResult.value : cleanupResult;
  console.error(`watchdog cleanup: ${JSON.stringify(cleanupDetail)}`);
  process.exit(1);
}, WATCHDOG_MS);
if (typeof watchdog.unref === "function") {
  watchdog.unref();
}

main()
  .then(() => {
    clearTimeout(watchdog);
    // watchdog発火後はcleanup Promiseのcontinuation順に関係なくterminal failure。
    // この再確認をprocess.exitと同じ同期turnで行い、exit 0との競合を閉じる。
    if (watchdogTriggered) {
      console.error("\nExtension load verification FAILED: watchdog terminal failure; exit 0 suppressed");
      process.exit(1);
    }
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
