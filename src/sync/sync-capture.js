(function () {
  "use strict";

  // Production sync capture (M4). Unlike the F1-A research hook (which emits only
  // masked structure), this extracts the user's OWN block/mute list so it can be
  // stored locally in the active xtbmSyncEntries:<generation> shard for filtering.
  // Legacy xtbmEntries is only a pre-migration read source. It reads raw rest_id /
  // screen_name VALUES — this is the allowed production data flow (the user's own
  // list, kept on the user's device). It never extracts display names, post
  // bodies, or cursor values, and it only runs against the list endpoints.
  //
  // This module is MAIN-world safe (no chrome.* APIs) so it can be injected into
  // the page context alongside the capture hook and unit-tested in isolation.

  const namespace = (globalThis.XTrueBlockMute = globalThis.XTrueBlockMute || {});

  function normalizeHandle(handle) {
    if (typeof handle !== "string") {
      return "";
    }
    return handle.replace(/^@/, "").trim().toLowerCase();
  }

  // Derive which list a response belongs to from its request URL. The list
  // GraphQL operations are BlockedAccounts / MutedAccounts.
  function listKindFromUrl(url) {
    const text = String(url || "");
    if (/BlockedAccounts/i.test(text)) {
      return "blocked";
    }
    if (/MutedAccounts/i.test(text)) {
      return "muted";
    }
    return null;
  }

  function readScreenName(userObject) {
    if (typeof userObject.screen_name === "string") {
      return userObject.screen_name;
    }
    if (userObject.legacy && typeof userObject.legacy.screen_name === "string") {
      return userObject.legacy.screen_name;
    }
    // Newer X user objects expose screen_name under `core`.
    if (userObject.core && typeof userObject.core.screen_name === "string") {
      return userObject.core.screen_name;
    }
    return "";
  }

  function readRestId(node) {
    if (typeof node.rest_id === "string") {
      return node.rest_id;
    }
    if (typeof node.id_str === "string") {
      return node.id_str;
    }
    if (typeof node.user_id === "string") {
      return node.user_id;
    }
    return "";
  }

  // Walk a (already gated) list-endpoint response and collect one entry per
  // distinct user. Cursor entries carry no rest_id and are skipped naturally.
  function extractSyncEntries(json, listKind) {
    const entries = [];
    const seen = new Set();
    const visited = new WeakSet();
    let budget = 20000;

    function addUser(restId, screenName) {
      const userId = typeof restId === "string" ? restId.trim() : "";
      const handle = normalizeHandle(screenName);
      if (!userId && !handle) {
        return;
      }
      const key = userId ? `id:${userId}` : `handle:${handle}`;
      if (seen.has(key)) {
        return;
      }
      seen.add(key);
      entries.push({
        user_id: userId || null,
        handle: handle || null,
        listKind: listKind || null
      });
    }

    function userResultFromItemContent(itemContent) {
      if (!itemContent || typeof itemContent !== "object") {
        return null;
      }
      // X の TimelineUser 以外に user_results が混ざった場合は、list 対象として扱わない。
      if (itemContent.itemType && itemContent.itemType !== "TimelineUser") {
        return null;
      }
      const userResults = itemContent.user_results;
      if (!userResults || typeof userResults !== "object") {
        return null;
      }
      return userResults.result && typeof userResults.result === "object" ? userResults.result : null;
    }

    function addFromTimelineEntry(entry) {
      if (!entry || typeof entry !== "object" || typeof entry.entryId !== "string") {
        return;
      }
      const content = entry.content;
      if (!content || typeof content !== "object") {
        return;
      }
      // list timeline item 以外の cursor/social context は、user-like 値を持っていても無視する。
      if (!content.entryType || content.entryType === "TimelineTimelineItem") {
        const result = userResultFromItemContent(content.itemContent);
        if (result) {
          addUser(readRestId(result), readScreenName(result));
        }
      }
      // Timeline module 形の保険。対象は module item 内の TimelineUser だけに限定する。
      if (Array.isArray(content.items)) {
        for (const item of content.items) {
          const itemResult = userResultFromItemContent(item && item.item && item.item.itemContent);
          if (itemResult) {
            addUser(readRestId(itemResult), readScreenName(itemResult));
          }
        }
      }
    }

    function walk(node, depth) {
      if (budget <= 0 || depth > 20 || node === null || typeof node !== "object" || visited.has(node)) {
        return;
      }
      visited.add(node);
      budget -= 1;
      if (Array.isArray(node)) {
        for (const item of node) {
          walk(item, depth + 1);
        }
        return;
      }
      // 応答全体の user-like object ではなく、list timeline の entries 配下だけを抽出対象にする。
      if (Array.isArray(node.entries)) {
        for (const entry of node.entries) {
          addFromTimelineEntry(entry);
        }
      }
      for (const key of Object.keys(node)) {
        walk(node[key], depth + 1);
      }
    }

    walk(json, 0);
    return entries;
  }

  function hasBottomCursor(json) {
    const visited = new WeakSet();
    let budget = 20000;

    function walk(node, depth) {
      if (budget <= 0 || depth > 20 || node === null || typeof node !== "object" || visited.has(node)) {
        return false;
      }
      visited.add(node);
      budget -= 1;
      // 完了判定は Top cursor や通常 entry ではなく、末尾方向の timeline cursor だけに絞る。
      if (
        String(node.entryType || "").toLowerCase() === "timelinetimelinecursor" &&
        String(node.cursorType || "").toLowerCase() === "bottom"
      ) {
        return true;
      }
      if (Array.isArray(node)) {
        for (const item of node) {
          if (walk(item, depth + 1)) {
            return true;
          }
        }
        return false;
      }
      for (const key of Object.keys(node)) {
        if (walk(node[key], depth + 1)) {
          return true;
        }
      }
      return false;
    }

    return walk(json, 0);
  }

  // 末尾ページの厳格判定。「Bottom cursor があり、かつ timeline の entries に
  // cursor 以外(item/module や entryType 無しの user entry)が1つも無い」ページ
  // だけを一覧の末尾とみなす。これにより、抽出ユーザーが0件でも item entry を
  // 持つ中間ページ(凍結アカウントの連続や中間ローディング等)を末尾と誤認して
  // sync-complete を早期発火し、reconcile が同期済みリストをまだ有効なアカウント
  // ごと削り落とす事故を防ぐ。真の末尾(cursor のみのページ)は従来どおり完了する。
  // 仮に X が末尾ページにも item を残す形式なら完了は発火せず「追加のみ」に劣化
  // する(＝過剰フィルタ側に倒れる=データ誤消去は起こさない安全側の失敗)。
  function isListTailResponse(json) {
    let sawBottomCursor = false;
    let nonCursorEntryCount = 0;
    const visited = new WeakSet();
    let budget = 20000;

    function classifyEntry(entry) {
      if (!entry || typeof entry !== "object" || typeof entry.entryId !== "string") {
        return;
      }
      const content = entry.content;
      if (!content || typeof content !== "object") {
        nonCursorEntryCount += 1;
        return;
      }
      if (String(content.entryType || "").toLowerCase() === "timelinetimelinecursor") {
        if (String(content.cursorType || "").toLowerCase() === "bottom") {
          sawBottomCursor = true;
        }
        return;
      }
      // cursor 以外の entry(item / module / entryType 無しの user entry)は
      // 「このページはまだ末尾ではない」証拠として数える。
      nonCursorEntryCount += 1;
    }

    function walk(node, depth) {
      if (budget <= 0 || depth > 20 || node === null || typeof node !== "object" || visited.has(node)) {
        return;
      }
      visited.add(node);
      budget -= 1;
      if (Array.isArray(node.entries)) {
        for (const entry of node.entries) {
          classifyEntry(entry);
        }
      }
      if (Array.isArray(node)) {
        for (const item of node) {
          walk(item, depth + 1);
        }
        return;
      }
      for (const key of Object.keys(node)) {
        walk(node[key], depth + 1);
      }
    }

    walk(json, 0);
    return sawBottomCursor && nonCursorEntryCount === 0;
  }

  namespace.SyncCapture = {
    extractSyncEntries,
    // hasBottomCursor は下位互換で保持(完了判定は isListTailResponse へ移行)。
    hasBottomCursor,
    isListTailResponse,
    listKindFromUrl,
    normalizeHandle
  };
})();
