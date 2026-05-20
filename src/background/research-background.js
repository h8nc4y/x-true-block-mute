(function () {
  "use strict";

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

  function installMainWorldHook(pageMessageSource) {
    if (window.__xTbmF1AMainWorldHookInstalled) {
      return;
    }
    window.__xTbmF1AMainWorldHookInstalled = true;

    const originalFetch = window.fetch;
    const originalOpen = XMLHttpRequest.prototype.open;
    const userIdKeys = new Set(["user_id", "userid", "id_str", "rest_id"]);
    const handleKeys = new Set(["screen_name", "screenname", "handle", "username", "user_name"]);
    const cursorKeys = new Set(["cursor", "next_cursor", "nextcursor", "bottom", "top"]);

    function getPageKind() {
      if (location.pathname === "/settings/blocked/all") {
        return "blocked";
      }
      if (location.pathname === "/settings/muted/all") {
        return "muted";
      }
      return "unknown";
    }

    function maskPath(pathname) {
      return pathname
        .split("/")
        .map((segment) => {
          if (!segment) {
            return "";
          }
          if (/^\d+$/.test(segment) || /^[a-f0-9]{16,}$/i.test(segment) || segment.length > 36) {
            return "<masked>";
          }
          return segment;
        })
        .join("/");
    }

    function summarizeUrl(urlText) {
      try {
        const url = new URL(urlText, location.href);
        const queryKeys = Array.from(url.searchParams.keys()).sort();
        const querySuffix = queryKeys.length ? `?${queryKeys.map((key) => `${key}=<masked>`).join("&")}` : "";
        return {
          endpointClass: `${url.origin}${maskPath(url.pathname)}${querySuffix}`,
          queryKeys
        };
      } catch (_error) {
        return {
          endpointClass: "unparseable-url",
          queryKeys: []
        };
      }
    }

    function isJsonLikeResponse(response, bodyText) {
      const contentType = response && response.headers && response.headers.get("content-type");
      return (contentType && contentType.includes("json")) || /^[\s\n\r]*[\[{]/.test(bodyText);
    }

    function statusClass(status) {
      return Number.isFinite(status) && status > 0 ? `${Math.floor(status / 100)}xx` : "unknown";
    }

    function scanShape(value) {
      const topLevelKeys = [];
      const shapePaths = [];
      const arrayHints = [];
      const fieldPresence = {
        userIdLike: false,
        handleLike: false,
        cursorLike: false
      };
      const seen = new WeakSet();

      function checkKey(rawKey, path) {
        const key = String(rawKey).toLowerCase();
        const normalized = key.replace(/[^a-z0-9_]/g, "");
        const pathText = path.toLowerCase();
        if (userIdKeys.has(normalized) || (normalized === "id" && pathText.includes("user"))) {
          fieldPresence.userIdLike = true;
        }
        if (handleKeys.has(normalized)) {
          fieldPresence.handleLike = true;
        }
        if (cursorKeys.has(normalized) || normalized.includes("cursor")) {
          fieldPresence.cursorLike = true;
        }
      }

      function visit(node, path, depth) {
        if (shapePaths.length >= 80 || depth > 6 || node === null || typeof node !== "object") {
          return;
        }
        if (seen.has(node)) {
          return;
        }
        seen.add(node);

        if (Array.isArray(node)) {
          arrayHints.push({ path, count: node.length });
          if (node.length > 0) {
            visit(node[0], `${path}[]`, depth + 1);
          }
          return;
        }

        const keys = Object.keys(node).slice(0, 40);
        if (path === "$") {
          topLevelKeys.push(...keys);
        }
        for (const key of keys) {
          const childPath = `${path}.${key}`;
          shapePaths.push(childPath);
          checkKey(key, childPath);
          visit(node[key], childPath, depth + 1);
        }
      }

      visit(value, "$", 0);
      return {
        topLevelKeys: topLevelKeys.slice(0, 30),
        shapePaths: shapePaths.slice(0, 80),
        arrayHints: arrayHints.slice(0, 20),
        fieldPresence
      };
    }

    function postObservation(base, shapeSummary) {
      window.postMessage(
        {
          source: pageMessageSource,
          observation: {
            ...base,
            ...shapeSummary,
            observedAt: new Date().toISOString(),
            pageKind: getPageKind()
          }
        },
        location.origin
      );
    }

    async function inspectFetchResponse(input, init, response) {
      const method = (init && init.method) || (input && input.method) || "GET";
      const urlText = typeof input === "string" ? input : input && input.url;
      const urlSummary = summarizeUrl(urlText || location.href);
      const base = {
        requestKind: "fetch",
        method: String(method).toUpperCase(),
        endpointClass: urlSummary.endpointClass,
        queryKeys: urlSummary.queryKeys,
        statusClass: statusClass(response && response.status),
        responseKind: "unknown"
      };

      try {
        const clone = response.clone();
        const bodyText = await clone.text();
        if (!isJsonLikeResponse(response, bodyText)) {
          postObservation(base, {
            responseKind: "non-json",
            topLevelKeys: [],
            shapePaths: [],
            arrayHints: [],
            fieldPresence: { userIdLike: false, handleLike: false, cursorLike: false }
          });
          return;
        }
        const json = JSON.parse(bodyText);
        postObservation({ ...base, responseKind: "json" }, scanShape(json));
      } catch (_error) {
        postObservation(base, {
          responseKind: "unreadable",
          topLevelKeys: [],
          shapePaths: [],
          arrayHints: [],
          fieldPresence: { userIdLike: false, handleLike: false, cursorLike: false }
        });
      }
    }

    window.fetch = function wrappedFetch(input, init) {
      const result = originalFetch.apply(this, arguments);
      result.then((response) => inspectFetchResponse(input, init, response)).catch(() => {});
      return result;
    };

    XMLHttpRequest.prototype.open = function wrappedOpen(method, url) {
      this.__xTbmF1ARequest = {
        method: String(method || "GET").toUpperCase(),
        url: String(url || location.href)
      };
      this.addEventListener("loadend", function onLoadEnd() {
        const request = this.__xTbmF1ARequest || { method: "GET", url: location.href };
        const urlSummary = summarizeUrl(request.url);
        const base = {
          requestKind: "xhr",
          method: request.method,
          endpointClass: urlSummary.endpointClass,
          queryKeys: urlSummary.queryKeys,
          statusClass: statusClass(this.status),
          responseKind: "unknown"
        };
        try {
          const contentType = this.getResponseHeader("content-type") || "";
          const responseValue = this.responseType === "json" ? this.response : this.responseText;
          if (this.responseType && this.responseType !== "json" && this.responseType !== "text") {
            postObservation({ ...base, responseKind: this.responseType }, scanShape({}));
            return;
          }
          if (this.responseType === "json") {
            postObservation({ ...base, responseKind: "json" }, scanShape(responseValue));
            return;
          }
          if (!contentType.includes("json") && !/^[\s\n\r]*[\[{]/.test(responseValue || "")) {
            postObservation({ ...base, responseKind: "non-json" }, scanShape({}));
            return;
          }
          postObservation({ ...base, responseKind: "json" }, scanShape(JSON.parse(responseValue)));
        } catch (_error) {
          postObservation({ ...base, responseKind: "unreadable" }, scanShape({}));
        }
      });
      return originalOpen.apply(this, arguments);
    };
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
        func: installMainWorldHook,
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
