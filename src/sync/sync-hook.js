(function () {
  "use strict";

  // Production sync capture hook (M4), MAIN world. It wraps fetch / XMLHttpRequest
  // on the settings pages and, only for the block/mute list endpoints, extracts
  // the user's own [{user_id, handle, listKind}] entries via SyncCapture and posts
  // them to the ISOLATED bridge. It reads the response body in-page (the allowed
  // production data flow for the user's own list) but extracts only id/handle —
  // never display names, post bodies, or cursor values.
  //
  // The posted message contains the user's own list ids/handles. It is sent with
  // an explicit same-origin target so only x.com/twitter.com listeners receive it;
  // the data originated from X's own response, so this adds no exposure to X. The
  // ISOLATED bridge is responsible for gating whether anything is persisted.

  function installSyncHook(messageSource) {
    if (window.__xTbmSyncHookInstalled) {
      return;
    }
    const SyncCapture = globalThis.XTrueBlockMute && globalThis.XTrueBlockMute.SyncCapture;
    if (!SyncCapture) {
      // sync-capture.js must be injected before this hook.
      return;
    }
    window.__xTbmSyncHookInstalled = true;

    const originalFetch = window.fetch;
    const originalOpen = XMLHttpRequest.prototype.open;

    function requestUrlFromInput(input) {
      if (typeof input === "string") {
        return input;
      }
      if (input && typeof input.url === "string") {
        return input.url;
      }
      return String(input || location.href);
    }

    function isSettingsListPage() {
      // クエリ文字列内の偽 settings パスではなく、実際の pathname だけで判定する。
      try {
        const pageUrl = new URL(String(location.href || ""), location.origin);
        return /^\/settings\/(?:blocked|muted)\/all$/i.test(pageUrl.pathname);
      } catch (_error) {
        return false;
      }
    }

    function shouldReadListResponse(url) {
      return isSettingsListPage() && Boolean(SyncCapture.listKindFromUrl(url));
    }

    function postEntries(listKind, entries) {
      if (!entries || entries.length === 0) {
        return;
      }
      window.postMessage(
        { source: messageSource, kind: "sync-entries", listKind, entries },
        location.origin
      );
    }

    function postComplete(listKind) {
      window.postMessage(
        { source: messageSource, kind: "sync-complete", listKind },
        location.origin
      );
    }

    function handleResponse(url, bodyText, status) {
      const listKind = SyncCapture.listKindFromUrl(url);
      if (!listKind) {
        return;
      }
      if (typeof status === "number" && (status < 200 || status >= 300)) {
        return;
      }
      let json;
      try {
        json = JSON.parse(bodyText);
      } catch (_error) {
        return;
      }
      if (json && Array.isArray(json.errors) && json.errors.length > 0) {
        return;
      }
      const entries = SyncCapture.extractSyncEntries(json, listKind);
      if (entries.length > 0) {
        postEntries(listKind, entries);
        return;
      }
      if (SyncCapture.hasBottomCursor(json)) {
        // Bottom-cursor pages with no users are the narrowest synthetic signal we can
        // use for list-tail completion without sending cursor values to the bridge.
        postComplete(listKind);
      }
    }

    window.fetch = function wrappedFetch(input, init) {
      const result = originalFetch.apply(this, arguments);
      const url = requestUrlFromInput(input);
      // Gate before clone().text() so off-settings and non-list X responses are never read by this hook.
      if (shouldReadListResponse(url)) {
        result
          .then((response) =>
            response.clone().text().then((text) => handleResponse(url, text, response.status))
          )
          .catch(() => {});
      }
      return result;
    };

    XMLHttpRequest.prototype.open = function wrappedOpen(method, url) {
      this.__xTbmSyncUrl = requestUrlFromInput(url);
      this.__xTbmSyncShouldRead = shouldReadListResponse(this.__xTbmSyncUrl);
      if (!this.__xTbmSyncLoadEndAttached) {
        // 同じ XHR インスタンスで open() が再実行されても、loadend listener は一度だけ登録する。
        this.__xTbmSyncLoadEndAttached = true;
        this.addEventListener("loadend", function onLoadEnd() {
          try {
            // Avoid touching responseText unless this XHR started on a settings list endpoint.
            if (!this.__xTbmSyncShouldRead) {
              return;
            }
            const body = this.responseType === "json" ? JSON.stringify(this.response) : this.responseText;
            handleResponse(this.__xTbmSyncUrl, body || "", this.status);
          } catch (_error) {
            /* ignore unreadable responses */
          }
        });
      }
      return originalOpen.apply(this, arguments);
    };
  }

  globalThis.XTrueBlockMuteSyncHook = { installSyncHook };

  // Auto-install when injected as a declarative MAIN-world content script. The
  // literal must match SYNC_MESSAGE_SOURCE in src/shared/constants.js (asserted
  // by verify-phase1-static.mjs). MAIN-world scripts cannot read the ISOLATED
  // namespace constant, so the source is duplicated here intentionally.
  installSyncHook("x-tbm:sync:capture");
})();
