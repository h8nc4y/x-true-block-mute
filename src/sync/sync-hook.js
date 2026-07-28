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

  let installedHook = null;

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
    const hookState = { originalFetch, originalOpen, wrappedFetch: null, wrappedOpen: null, active: true };
    // XHR object側の公開flagではなく、hook世代ごとにlistener所有を追跡する。
    // これによりuninstall前からあるXHRを再install後に再利用しても、現世代の
    // listenerを1回だけ追加でき、旧世代listenerはinactiveのまま無害化される。
    const observedXhrs = new WeakSet();
    // request単位のURL・読取可否・処理済み状態はhook世代内に閉じる。
    // XHR object上の公開expandoを使わず、次のopenや旧世代へ状態を漏らさない。
    const xhrRequestStates = new WeakMap();

    function isCurrentHook() {
      return installedHook === hookState && hookState.active;
    }

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

    function isInitialListRequest(url) {
      // X の pagination cursor 値は保存・送信せず、variables JSON に cursor key が
      // 無い初回要求だけを新しい全走査の境界として扱う。解析不能時は reset しない。
      try {
        const requestUrl = new URL(String(url || ""), location.origin);
        const rawVariables = requestUrl.searchParams.get("variables");
        if (!rawVariables || rawVariables.length > 100000) {
          return false;
        }
        const variables = JSON.parse(rawVariables);
        if (!variables || typeof variables !== "object" || Array.isArray(variables)) {
          return false;
        }
        if (Object.prototype.hasOwnProperty.call(variables, "cursor")) {
          return false;
        }
        // JSON text 内の nested cursor key も安全側で pagination 扱いに倒す。
        return !/"cursor"\s*:/.test(rawVariables);
      } catch (_error) {
        return false;
      }
    }

    function postStart(listKind) {
      // bridge へ渡すのは固定シグナルと listKind だけ。request variables や
      // cursor 値を page world の外へ持ち出さない。
      window.postMessage(
        { source: messageSource, kind: "sync-start", listKind },
        location.origin
      );
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
      if (isInitialListRequest(url)) {
        // 正常な初回応答を確認してから reset し、失敗要求で既存 staging を失わない。
        postStart(listKind);
      }
      const entries = SyncCapture.extractSyncEntries(json, listKind);
      if (entries.length > 0) {
        postEntries(listKind, entries);
        return;
      }
      if (SyncCapture.isListTailResponse(json)) {
        // 末尾ページ(cursor のみ + Bottom cursor)に限って完了を通知する。0ユーザー
        // でも非 cursor の item entry が残る中間ページ(凍結アカウント連続など)は
        // 末尾扱いしない — 誤った reconcile で同期済みリストを削らないための厳格判定。
        // cursor value は送らず、完了シグナル(listKind のみ)だけを bridge へ渡す。
        postComplete(listKind);
      }
    }

    function wrappedFetch(input, init) {
      const result = originalFetch.apply(this, arguments);
      // 外部wrapper経由で旧世代が呼ばれても、native/次wrapperのrequestだけは
      // 維持し、uninstall済み世代では入力getter評価やcallback追加を行わない。
      if (!isCurrentHook()) {
        return result;
      }
      const url = requestUrlFromInput(input);
      // Gate before clone().text() so off-settings and non-list X responses are never read by this hook.
      if (shouldReadListResponse(url)) {
        result
          .then((response) => {
            // uninstall後に解決したin-flight fetchでは、本文を読む前に停止する。
            if (!isCurrentHook()) {
              return undefined;
            }
            return response.clone().text().then((text) => {
              if (isCurrentHook()) {
                handleResponse(url, text, response.status);
              }
            });
          })
          .catch(() => {});
      }
      return result;
    }

    function processCompletedXhr(xhr) {
      const requestState = xhrRequestStates.get(xhr);
      if (
        !requestState ||
        requestState.handled ||
        xhr.readyState !== 4 ||
        !isCurrentHook() ||
        !requestState.shouldRead
      ) {
        return;
      }

      // network error / abort でも一時的に DONE 通知は発生する。status 0 や
      // non-2xx は本文へ触れる前に拒否し、失敗応答を同期入力にしない。
      const status = xhr.status;
      if (typeof status === "number" && (status < 200 || status >= 300)) {
        requestState.handled = true;
        return;
      }

      // responseText getterや抽出処理が再入しても二重処理しないよう、本文読取より先に確定する。
      requestState.handled = true;
      const body = xhr.responseType === "json" ? JSON.stringify(xhr.response) : xhr.responseText;
      handleResponse(requestState.url, body || "", status);
    }

    function wrappedOpen(method, url) {
      // 外部wrapperが旧世代の関数を保持していても、uninstall済み世代は
      // URL評価やlistener登録をせず、その世代が捕捉した次のopenへ素通しする。
      if (!isCurrentHook()) {
        return originalOpen.apply(this, arguments);
      }

      // 先行するページlistenerがDONE中に同じXHRを再openした場合、originalOpenが
      // responseを初期化する前に直前requestを処理する。通常のDONE listenerで既に
      // 処理済みならhandledで無害なno-opになる。
      try {
        processCompletedXhr(this);
      } catch (_error) {
        /* ignore unreadable responses */
      }

      const requestUrl = requestUrlFromInput(url);
      const nextRequestState = {
        url: requestUrl,
        shouldRead: shouldReadListResponse(requestUrl),
        handled: false
      };
      try {
        if (!observedXhrs.has(this)) {
          // 外部addEventListener wrapperがlistener登録の前後どちらでthrowしたかは
          // 判別できない。登録を試す前に所有済みとし、曖昧な再試行による重複を防ぐ。
          observedXhrs.add(this);
          // 同じhook世代ではXHRを何度openしてもlistenerを1つに保つ。再install時は
          // 新しいWeakSetになるため、世代をまたいだXHR再利用だけ現listenerを追加する。
          // 成功応答は load より前の DONE readystatechange で処理する。ページ側の
          // load listener が同じXHRを次requestへopenし直すと、loadend時点では
          // URL/responseが次requestへ再初期化済みになり得るため、対応付けを先に確定する。
          this.addEventListener("readystatechange", function onReadyStateChange() {
            try {
              processCompletedXhr(this);
            } catch (_error) {
              /* ignore unreadable responses */
            }
          });
        }
        // listener登録が完了するまで次requestを公開しない。外部wrapperが登録時に
        // callbackを同期実行・throwしても、そのURLで旧DONE本文を処理させない。
        xhrRequestStates.set(this, nextRequestState);
        return originalOpen.apply(this, arguments);
      } catch (error) {
        // listener登録失敗やmethod/URL検査なら旧responseが残り、外部wrapperなら
        // native open済みで新responseへ進んでいる可能性がある。判別できないため、
        // 今回setしたstateを所有している場合だけ破棄し、本文読取をfail closedにする。
        if (xhrRequestStates.get(this) === nextRequestState) {
          xhrRequestStates.delete(this);
        }
        throw error;
      }
    }

    hookState.wrappedFetch = wrappedFetch;
    hookState.wrappedOpen = wrappedOpen;
    window.fetch = wrappedFetch;
    XMLHttpRequest.prototype.open = wrappedOpen;
    installedHook = hookState;
  }

  function uninstallSyncHook() {
    if (!installedHook) {
      window.__xTbmSyncHookInstalled = false;
      return;
    }

    installedHook.active = false;
    const { originalFetch, originalOpen, wrappedFetch, wrappedOpen } = installedHook;
    // 他の拡張やページスクリプトがさらにwrapしている場合は、その所有物を上書きしない。
    if (window.fetch === wrappedFetch) {
      window.fetch = originalFetch;
    }
    if (XMLHttpRequest.prototype.open === wrappedOpen) {
      XMLHttpRequest.prototype.open = originalOpen;
    }
    installedHook = null;
    window.__xTbmSyncHookInstalled = false;
  }

  globalThis.XTrueBlockMuteSyncHook = { installSyncHook, uninstallSyncHook };

  // Auto-install when injected as a declarative MAIN-world content script. The
  // literal must match SYNC_MESSAGE_SOURCE in src/shared/constants.js (asserted
  // by verify-phase1-static.mjs). MAIN-world scripts cannot read the ISOLATED
  // namespace constant, so the source is duplicated here intentionally.
  installSyncHook("x-tbm:sync:capture");
})();
