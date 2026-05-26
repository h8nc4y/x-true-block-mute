(function () {
  "use strict";

  const namespace = (globalThis.XTrueBlockMute = globalThis.XTrueBlockMute || {});
  const { DISPLAY_MODES, STORAGE_KEYS, Storage } = namespace;

  const CARD_SELECTORS = [
    "[data-x-tbm-post-card]",
    "[data-testid='tweet']",
    "article[role='article']",
    "article"
  ].join(",");
  const ROOT_SELECTORS = [
    "[data-testid='primaryColumn']",
    "main[role='main']",
    "main",
    "body"
  ].join(",");
  const PROFILE_RESERVED_PATHS = new Set([
    "home",
    "explore",
    "notifications",
    "messages",
    "i",
    "settings",
    "search",
    "compose"
  ]);

  let settings = namespace.DEFAULT_SETTINGS;
  let targetUserIds = new Set();
  let targetHandles = new Set();
  let scheduled = false;
  let observer = null;
  const replacements = new Map();

  function queryCards(root) {
    if (!root || root.nodeType !== Node.ELEMENT_NODE) {
      return [];
    }
    const element = root;
    const cards = [];
    if (element.matches && element.matches(CARD_SELECTORS)) {
      cards.push(element);
    }
    if (element.querySelectorAll) {
      cards.push(...element.querySelectorAll(CARD_SELECTORS));
    }
    return cards;
  }

  function normalizeHandle(handle) {
    return Storage.normalizeHandle(handle);
  }

  function extractHandleFromLink(card) {
    const links = card.querySelectorAll("a[href]");
    for (const link of links) {
      let url;
      try {
        url = new URL(link.getAttribute("href"), location.origin);
      } catch (_error) {
        continue;
      }
      if (url.origin !== location.origin) {
        continue;
      }
      const firstPart = url.pathname.split("/").filter(Boolean)[0];
      const handle = normalizeHandle(firstPart);
      if (handle && /^[a-z0-9_]{1,15}$/.test(handle) && !PROFILE_RESERVED_PATHS.has(handle)) {
        return handle;
      }
    }
    return "";
  }

  function getCardIdentity(card) {
    const userId =
      card.getAttribute("data-user-id") ||
      card.getAttribute("data-x-tbm-user-id") ||
      "";
    const handle =
      card.getAttribute("data-handle") ||
      card.getAttribute("data-x-tbm-handle") ||
      extractHandleFromLink(card);

    return {
      userId: userId.trim(),
      handle: normalizeHandle(handle)
    };
  }

  function isTargetCard(card) {
    const identity = getCardIdentity(card);
    return Boolean(
      (identity.userId && targetUserIds.has(identity.userId)) ||
        (identity.handle && targetHandles.has(identity.handle))
    );
  }

  function createReplacement(kind) {
    const replacement = document.createElement("div");
    replacement.dataset.xTbmReplacement = kind;
    replacement.className = kind === DISPLAY_MODES.HIDDEN ? "x-tbm-hidden-marker" : "x-tbm-placeholder";
    replacement.setAttribute("role", kind === DISPLAY_MODES.HIDDEN ? "none" : "note");
    replacement.textContent =
      kind === DISPLAY_MODES.HIDDEN
        ? ""
        : "この投稿は x-true-block-mute の Phase 1 テストデータに一致したため、内容を表示していません。";
    return replacement;
  }

  function replaceCard(card, mode) {
    if (!card.parentNode || replacements.has(card)) {
      return;
    }
    const replacement = createReplacement(mode);
    replacements.set(card, replacement);
    replacement.__xTbmOriginalCard = card;
    card.replaceWith(replacement);
  }

  function restoreAll() {
    for (const [card, replacement] of Array.from(replacements.entries())) {
      if (replacement.parentNode) {
        replacement.replaceWith(card);
      }
      replacements.delete(card);
    }
  }

  function processCard(card) {
    if (card.dataset.xTbmReplacement) {
      return;
    }
    if (!settings.enabled || settings.displayMode === DISPLAY_MODES.OFF) {
      return;
    }
    if (!isTargetCard(card)) {
      return;
    }
    replaceCard(card, settings.displayMode);
  }

  function processRoot(root) {
    if (!settings.enabled || settings.displayMode === DISPLAY_MODES.OFF) {
      restoreAll();
      return;
    }
    for (const card of queryCards(root)) {
      processCard(card);
    }
  }

  function scheduleProcess(root) {
    if (scheduled) {
      return;
    }
    scheduled = true;
    window.setTimeout(() => {
      scheduled = false;
      processRoot(root || document.querySelector(ROOT_SELECTORS) || document.body);
    }, 80);
  }

  function rebuildTargets(entryStore) {
    targetUserIds = new Set();
    targetHandles = new Set();
    for (const entry of entryStore.entries) {
      if (entry.user_id) {
        targetUserIds.add(entry.user_id);
        continue;
      }
      if (entry.handle) {
        targetHandles.add(normalizeHandle(entry.handle));
      }
    }
  }

  async function reloadState() {
    const [nextSettings, entryStore] = await Promise.all([Storage.getSettings(), Storage.getEntryStore()]);
    settings = nextSettings;
    rebuildTargets(entryStore);
    restoreAll();
    scheduleProcess(document.querySelector(ROOT_SELECTORS) || document.body);
  }

  function startObserver() {
    observer = new MutationObserver((mutations) => {
      for (const mutation of mutations) {
        for (const node of mutation.addedNodes) {
          if (node.nodeType === Node.ELEMENT_NODE) {
            scheduleProcess(node);
          }
        }
      }
    });
    observer.observe(document.querySelector(ROOT_SELECTORS) || document.body, {
      childList: true,
      subtree: true
    });
  }

  function listenForStorageChanges() {
    if (!chrome.storage || !chrome.storage.onChanged) {
      return;
    }
    chrome.storage.onChanged.addListener((changes, areaName) => {
      if (
        (areaName === "sync" && changes[STORAGE_KEYS.SETTINGS]) ||
        (areaName === "local" && changes[STORAGE_KEYS.ENTRIES])
      ) {
        reloadState().catch(() => {});
      }
    });
  }

  async function init() {
    await reloadState();
    startObserver();
    listenForStorageChanges();
  }

  init().catch(() => {});

  namespace.ContentScript = {
    getCardIdentity,
    isTargetCard,
    processRoot,
    reloadState,
    stop() {
      if (observer) {
        observer.disconnect();
      }
      restoreAll();
    }
  };
})();
