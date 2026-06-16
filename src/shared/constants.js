(function () {
  "use strict";

  const namespace = (globalThis.XTrueBlockMute = globalThis.XTrueBlockMute || {});

  namespace.SCHEMA_VERSION = 1;
  namespace.DISPLAY_MODES = Object.freeze({
    HIDDEN: "hidden",
    PLACEHOLDER: "placeholder",
    OFF: "off"
  });

  namespace.STORAGE_KEYS = Object.freeze({
    SETTINGS: "xtbmSettings",
    ENTRIES: "xtbmEntries",
    F1A_RESEARCH: "xtbmF1AResearch",
    SYNC_STATE: "xtbmSyncState"
  });

  // Production sync (M4): the MAIN-world capture hook posts extracted list
  // entries to the ISOLATED bridge under this page-message source.
  namespace.SYNC_MESSAGE_SOURCE = "x-tbm:sync:capture";

  namespace.RESEARCH_F1A = Object.freeze({
    MESSAGE_INJECT: "x-tbm:f1a:inject-main-hook",
    PAGE_MESSAGE_SOURCE: "x-tbm:f1a:main-world-hook",
    MAX_OBSERVATIONS: 60
  });

  namespace.DEFAULT_SETTINGS = Object.freeze({
    schemaVersion: namespace.SCHEMA_VERSION,
    enabled: true,
    displayMode: namespace.DISPLAY_MODES.PLACEHOLDER
  });

  // Production block/mute list entries captured by an F1 source carry this source
  // tag so they can be refreshed or cleared independently of synthetic test data.
  namespace.SYNC_SOURCE = "f1a-sync";
  namespace.LIST_KINDS = Object.freeze({
    BLOCKED: "blocked",
    MUTED: "muted"
  });

  // Dev-only: the local sample/test-data panel is hidden for end users; flip to
  // true and reload to use it.
  namespace.LOCAL_TEST_UI_ENABLED = false;

  namespace.SYNTHETIC_SOURCE = "phase1-synthetic";
  namespace.SYNTHETIC_ENTRIES = Object.freeze([
    {
      user_id: "phase1-user-001",
      handle: "phase1_user_id_target",
      source: namespace.SYNTHETIC_SOURCE,
      idResolutionStatus: "synthetic-user-id",
      label: "Phase 1 user_id target"
    },
    {
      user_id: null,
      handle: "phase1_handle_target",
      source: namespace.SYNTHETIC_SOURCE,
      idResolutionStatus: "handle-only",
      label: "Phase 1 handle-only target"
    }
  ]);
})();
