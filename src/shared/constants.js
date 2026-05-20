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
    ENTRIES: "xtbmEntries"
  });

  namespace.DEFAULT_SETTINGS = Object.freeze({
    schemaVersion: namespace.SCHEMA_VERSION,
    enabled: true,
    displayMode: namespace.DISPLAY_MODES.PLACEHOLDER
  });

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
