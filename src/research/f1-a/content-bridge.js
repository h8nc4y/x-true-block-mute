(function () {
  "use strict";

  const namespace = globalThis.XTrueBlockMute;
  const { RESEARCH_F1A, Storage } = namespace;
  const SETTINGS_PATHS = new Set(["/settings/blocked/all", "/settings/muted/all"]);
  let pendingWrite = Promise.resolve();

  function isSettingsResearchPage() {
    return (location.hostname === "x.com" || location.hostname === "twitter.com") && SETTINGS_PATHS.has(location.pathname);
  }

  function listenForMainWorldObservations() {
    window.addEventListener("message", (event) => {
      if (event.source !== window || event.origin !== location.origin) {
        return;
      }
      const data = event.data;
      if (!data || data.source !== RESEARCH_F1A.PAGE_MESSAGE_SOURCE || !data.observation) {
        return;
      }
      pendingWrite = pendingWrite
        .then(() => Storage.appendF1AResearchObservation(data.observation))
        .catch(() => {});
    });
  }

  async function requestMainWorldInjectionIfEnabled() {
    if (!isSettingsResearchPage()) {
      return;
    }
    const state = await Storage.getF1AResearchState();
    if (!state.enabled) {
      return;
    }
    chrome.runtime.sendMessage({ type: RESEARCH_F1A.MESSAGE_INJECT }, () => {
      // Injection result is intentionally not logged. The popup/docs explain how to verify masked observations.
    });
  }

  listenForMainWorldObservations();
  requestMainWorldInjectionIfEnabled().catch(() => {});
})();
