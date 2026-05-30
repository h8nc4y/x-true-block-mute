(function () {
  "use strict";

  function installMainWorldHook(pageMessageSource) {
    if (window.__xTbmF1AMainWorldHookInstalled) {
      return;
    }
    window.__xTbmF1AMainWorldHookInstalled = true;

    const hookRunId = `hook-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
    const originalFetch = window.fetch;
    const originalOpen = XMLHttpRequest.prototype.open;
    const userIdKeys = new Set(["user_id", "userid", "id_str", "rest_id"]);
    const handleKeys = new Set(["screen_name", "screenname", "handle", "username", "user_name"]);
    const paginationKeys = new Set([
      "bottom",
      "cursor",
      "has_more",
      "hasmore",
      "next",
      "next_cursor",
      "nextcursor",
      "next_token",
      "nexttoken",
      "top"
    ]);
    const safeSchemaKeys = new Set([
      "__typename",
      "actions",
      "array",
      "blocked",
      "bottom",
      "clientEventInfo",
      "content",
      "count",
      "cursor",
      "data",
      "entries",
      "entryId",
      "errors",
      "features",
      "fieldToggles",
      "globalObjects",
      "handle",
      "has_more",
      "hasMore",
      "id",
      "id_str",
      "instructions",
      "itemContent",
      "itemType",
      "items",
      "legacy",
      "metadata",
      "muted",
      "name",
      "next",
      "next_cursor",
      "nextCursor",
      "next_token",
      "nextToken",
      "profile_image_url_https",
      "queryId",
      "rest_id",
      "result",
      "screen_name",
      "sortIndex",
      "timeline",
      "top",
      "type",
      "user",
      "user_id",
      "user_results",
      "users",
      "value"
    ]);
    const safeEndpointPathSegments = new Map(
      [
        "<masked>",
        "1.1",
        "2",
        "BlockedAccounts",
        "MutedAccounts",
        "all",
        "api",
        "blocked",
        "graphql",
        "i",
        "list",
        "lists",
        "muted",
        "settings",
        "timeline",
        "user",
        "users"
      ].map((segment) => [segment.toLowerCase(), segment])
    );
    const sensitiveKeyPattern = /(^|[_-])(authorization|auth|cookie|csrf|ct0|oauth|password|secret|token)($|[_-])/i;

    function getPageKind() {
      if (location.pathname === "/settings/blocked/all") {
        return "blocked";
      }
      if (location.pathname === "/settings/muted/all") {
        return "muted";
      }
      return "unknown";
    }

    function sanitizeSchemaKey(key) {
      const text = String(key || "");
      if (!text) {
        return "<masked-key>";
      }
      if (sensitiveKeyPattern.test(text)) {
        return "<sensitive-key>";
      }
      if (/^\d+$/.test(text) || /^@/.test(text) || /^[a-f0-9]{16,}$/i.test(text) || text.length > 48) {
        return "<masked-key>";
      }
      if (safeSchemaKeys.has(text)) {
        return text;
      }
      const lower = text.toLowerCase();
      for (const safeKey of safeSchemaKeys) {
        if (safeKey.toLowerCase() === lower) {
          return safeKey;
        }
      }
      return "<masked-key>";
    }

    function sanitizeShapePath(path) {
      return String(path || "$")
        .split(".")
        .map((part) => {
          if (part === "$" || part === "[]") {
            return part;
          }
          if (part.endsWith("[]")) {
            return `${sanitizeSchemaKey(part.slice(0, -2))}[]`;
          }
          return sanitizeSchemaKey(part);
        })
        .join(".");
    }

    function sanitizeQueryKey(key) {
      const text = String(key || "");
      if (!text) {
        return "<masked-key>";
      }
      if (sensitiveKeyPattern.test(text)) {
        return "<sensitive-key>";
      }
      if (/^[A-Za-z][A-Za-z0-9_.-]{0,48}$/.test(text)) {
        return text;
      }
      return "<masked-key>";
    }

    function decodePathSegment(segment) {
      try {
        return decodeURIComponent(segment);
      } catch (_error) {
        return segment;
      }
    }

    function sanitizeEndpointPathSegment(segment) {
      const text = decodePathSegment(String(segment || ""));
      if (!text) {
        return "";
      }
      if (text === "<masked>") {
        return "<masked>";
      }
      if (sensitiveKeyPattern.test(text)) {
        return "<sensitive>";
      }
      const allowed = safeEndpointPathSegments.get(text.toLowerCase());
      if (allowed) {
        return allowed;
      }
      return "<masked>";
    }

    function maskPath(pathname) {
      return pathname
        .split("/")
        .map(sanitizeEndpointPathSegment)
        .join("/");
    }

    function summarizeUrl(urlText) {
      try {
        const url = new URL(urlText, location.href);
        const queryKeys = Array.from(url.searchParams.keys()).map(sanitizeQueryKey).sort();
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
        cursorLike: false,
        paginationLike: false
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
        if (paginationKeys.has(normalized) || normalized.includes("cursor") || normalized.includes("next")) {
          fieldPresence.cursorLike = true;
          fieldPresence.paginationLike = true;
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
          arrayHints.push({ path: sanitizeShapePath(path), count: node.length });
          if (node.length > 0) {
            visit(node[0], `${path}[]`, depth + 1);
          }
          return;
        }

        const keys = Object.keys(node).slice(0, 40);
        if (path === "$") {
          topLevelKeys.push(...keys.map(sanitizeSchemaKey));
        }
        for (const key of keys) {
          const childPath = `${path}.${key}`;
          const safeChildPath = sanitizeShapePath(childPath);
          shapePaths.push(safeChildPath);
          checkKey(key, safeChildPath);
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

    function emptyShapeSummary() {
      return {
        topLevelKeys: [],
        shapePaths: [],
        arrayHints: [],
        fieldPresence: { userIdLike: false, handleLike: false, cursorLike: false, paginationLike: false }
      };
    }

    function postObservation(base, shapeSummary) {
      window.postMessage(
        {
          source: pageMessageSource,
          observation: {
            ...base,
            ...shapeSummary,
            hookRunId,
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
          postObservation({ ...base, responseKind: "non-json" }, emptyShapeSummary());
          return;
        }
        const json = JSON.parse(bodyText);
        postObservation({ ...base, responseKind: "json" }, scanShape(json));
      } catch (_error) {
        postObservation({ ...base, responseKind: "unreadable" }, emptyShapeSummary());
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
            postObservation({ ...base, responseKind: this.responseType }, emptyShapeSummary());
            return;
          }
          if (this.responseType === "json") {
            postObservation({ ...base, responseKind: "json" }, scanShape(responseValue));
            return;
          }
          if (!contentType.includes("json") && !/^[\s\n\r]*[\[{]/.test(responseValue || "")) {
            postObservation({ ...base, responseKind: "non-json" }, emptyShapeSummary());
            return;
          }
          postObservation({ ...base, responseKind: "json" }, scanShape(JSON.parse(responseValue)));
        } catch (_error) {
          postObservation({ ...base, responseKind: "unreadable" }, emptyShapeSummary());
        }
      });
      return originalOpen.apply(this, arguments);
    };
  }

  globalThis.XTrueBlockMuteF1AMainWorldHook = {
    installMainWorldHook
  };
})();
