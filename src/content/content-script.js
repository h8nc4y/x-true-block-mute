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

  function handleFromLinks(links) {
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

  // Extract the post author's handle from the real X DOM. Scanning is scoped to
  // the author's User-Name / avatar region so quoted, embedded, and mentioned
  // accounts (which live elsewhere in the card) are not mistaken for the author.
  // The first User-Name in DOM order is the top-level author; a quoted tweet's
  // User-Name appears later/nested and is therefore ignored.
  function extractAuthorHandle(card) {
    const quotes = findQuoteContainers(card);
    const inQuote = (el) => quotes.some((quote) => quote.contains(el));
    let region =
      Array.from(card.querySelectorAll('[data-testid="User-Name"]')).find((el) => !inQuote(el)) || null;
    if (!region) {
      const avatar = card.querySelector('[data-testid="Tweet-User-Avatar"]');
      if (avatar && !inQuote(avatar)) {
        region = avatar;
      }
    }
    if (!region) {
      region =
        card.querySelector('[data-testid="User-Name"]') ||
        card.querySelector('[data-testid="Tweet-User-Avatar"]');
    }
    if (!region) {
      return "";
    }
    return handleFromLinks(region.querySelectorAll("a[href]"));
  }

  function getCardIdentity(card) {
    const userId =
      card.getAttribute("data-user-id") ||
      card.getAttribute("data-x-tbm-user-id") ||
      "";
    const handle =
      card.getAttribute("data-handle") ||
      card.getAttribute("data-x-tbm-handle") ||
      extractAuthorHandle(card);

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
        : "この投稿は、ブロックまたはミュート対象のアカウントによるものです（TrueBlock & Mute）。";
    return replacement;
  }

  function replaceCard(card, mode) {
    if (!card.parentNode || replacements.has(card)) {
      return;
    }
    const replacement = createReplacement(mode);
    replacements.set(card, replacement);
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

  function pruneDetachedReplacements() {
    for (const [card, replacement] of Array.from(replacements.entries())) {
      if (!replacement.isConnected) {
        replacements.delete(card);
      }
    }
  }

  // A quoted tweet is a clickable container (role="link") that holds its own
  // User-Name. The post author's User-Name lives outside any such container, so
  // these are exactly the embedded quotes. Keep only the outermost ones.
  function findQuoteContainers(card) {
    const candidates = Array.from(card.querySelectorAll('div[role="link"]')).filter((element) =>
      element.querySelector('[data-testid="User-Name"]')
    );
    return candidates.filter((element) => !candidates.some((other) => other !== element && other.contains(element)));
  }

  function extractQuoteHandle(quote) {
    const userName = quote.querySelector('[data-testid="User-Name"]');
    if (!userName) {
      return "";
    }
    return normalizeHandle(handleFromLinks(userName.querySelectorAll("a[href]")));
  }

  // When the post author is not a target, hide only the quoted card(s) whose
  // author is blocked/muted, leaving the safe author's own post intact.
  function processQuotedCards(card, mode) {
    for (const quote of findQuoteContainers(card)) {
      if (replacements.has(quote) || quote.dataset.xTbmReplacement) {
        continue;
      }
      const handle = extractQuoteHandle(quote);
      if (handle && targetHandles.has(handle)) {
        replaceCard(quote, mode);
      }
    }
  }

  function processCard(card) {
    if (card.dataset.xTbmReplacement) {
      return;
    }
    if (!settings.enabled || settings.displayMode === DISPLAY_MODES.OFF) {
      return;
    }
    if (isTargetCard(card)) {
      replaceCard(card, settings.displayMode);
      return;
    }
    processQuotedCards(card, settings.displayMode);
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

  function scheduleProcess() {
    if (scheduled) {
      return;
    }
    scheduled = true;
    window.setTimeout(() => {
      scheduled = false;
      pruneDetachedReplacements();
      processRoot(document.querySelector(ROOT_SELECTORS) || document.body);
    }, 80);
  }

  function rebuildTargets(entryStore) {
    targetUserIds = new Set();
    targetHandles = new Set();
    for (const entry of entryStore.entries) {
      // Register BOTH keys. Synced entries carry user_id and handle; the real X
      // timeline DOM exposes only the handle, so handle matching is required,
      // while the synthetic fixture matches by data-user-id.
      if (entry.user_id) {
        targetUserIds.add(entry.user_id);
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
    scheduleProcess();
  }

  function startObserver() {
    observer = new MutationObserver((mutations) => {
      for (const mutation of mutations) {
        let shouldSchedule = false;
        for (const node of mutation.addedNodes) {
          if (node.nodeType === Node.ELEMENT_NODE) {
            shouldSchedule = true;
            break;
          }
        }
        if (!shouldSchedule) {
          for (const node of mutation.removedNodes) {
            if (node.nodeType === Node.ELEMENT_NODE) {
              shouldSchedule = true;
              break;
            }
          }
        }
        if (shouldSchedule) {
          scheduleProcess();
          break;
        }
      }
    });
    observer.observe(document.body, {
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
