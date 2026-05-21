(function () {
  "use strict";

  importScripts("../research/f1-a/main-world-hook.js");

  const MESSAGE_INJECT = "x-tbm:f1a:inject-main-hook";
  const PAGE_MESSAGE_SOURCE = "x-tbm:f1a:main-world-hook";
  const SETTINGS_PATHS = new Set(["/settings/blocked/all", "/settings/muted/all"]);

  function isAllowedSettingsUrl(urlText) {
    try {
      const url = new URL(urlText);
      return (url.hostname === "x.com" || url.hostname === "twitter.com") && SETTINGS_PATHS.has(url.pathname);
    } catch (_error) {
      return false;
    }
  }

  chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
    if (!message || message.type !== MESSAGE_INJECT) {
      return false;
    }
    if (!sender.tab || !Number.isInteger(sender.tab.id) || !isAllowedSettingsUrl(sender.url || "")) {
      sendResponse({ ok: false, reason: "unsupported-sender" });
      return false;
    }

    chrome.scripting.executeScript(
      {
        target: { tabId: sender.tab.id, frameIds: [sender.frameId || 0] },
        world: "MAIN",
        func: globalThis.XTrueBlockMuteF1AMainWorldHook.installMainWorldHook,
        args: [PAGE_MESSAGE_SOURCE]
      },
      () => {
        const error = chrome.runtime.lastError;
        sendResponse({ ok: !error, reason: error ? error.message : "injected" });
      }
    );
    return true;
  });
})();
