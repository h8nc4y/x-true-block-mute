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

    function postEntries(listKind, entries) {
      if (!entries || entries.length === 0) {
        return;
      }
      window.postMessage(
        { source: messageSource, kind: "sync-entries", listKind, entries },
        location.origin
      );
    }

    function handleResponse(url, bodyText) {
      const listKind = SyncCapture.listKindFromUrl(url);
      if (!listKind) {
        return;
      }
      let json;
      try {
        json = JSON.parse(bodyText);
      } catch (_error) {
        return;
      }
      postEntries(listKind, SyncCapture.extractSyncEntries(json, listKind));
    }

    window.fetch = function wrappedFetch(input, init) {
      const result = originalFetch.apply(this, arguments);
      const url = typeof input === "string" ? input : input && input.url;
      result
        .then((response) => response.clone().text().then((text) => handleResponse(url || location.href, text)))
        .catch(() => {});
      return result;
    };

    XMLHttpRequest.prototype.open = function wrappedOpen(method, url) {
      this.__xTbmSyncUrl = String(url || location.href);
      this.addEventListener("loadend", function onLoadEnd() {
        try {
          const body = this.responseType === "json" ? JSON.stringify(this.response) : this.responseText;
          handleResponse(this.__xTbmSyncUrl, body || "");
        } catch (_error) {
          /* ignore unreadable responses */
        }
      });
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
