(function () {
  "use strict";

  const namespace = (globalThis.XTrueBlockMute = globalThis.XTrueBlockMute || {});
  const SCHEMA_VERSION = namespace.SCHEMA_VERSION || 1;
  const MAX_OBSERVATIONS = namespace.RESEARCH_F1A ? namespace.RESEARCH_F1A.MAX_OBSERVATIONS : 60;
  const MASKED_KEY = "<masked-key>";
  const SENSITIVE_KEY = "<sensitive-key>";

  const SAFE_SCHEMA_KEYS = new Set([
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
  const SENSITIVE_TEXT_PATTERN = /(authorization|auth[_-]?token|bearer\s+|cookie|csrf|ct0|oauth|password|secret|set-cookie|token)/i;
  const SENSITIVE_KEY_PATTERN = /(^|[_-])(authorization|auth|cookie|csrf|ct0|oauth|password|secret|token)($|[_-])/i;
  const RAW_HANDLE_PATTERN = /(^|[^\w])@[A-Za-z0-9_]{1,15}($|[^\w])/;
  const LONG_ID_PATTERN = /\b\d{10,}\b/;
  const ALLOWED_OBSERVATION_KEYS = new Set([
    "arrayHints",
    "count",
    "endpointClass",
    "fieldPresence",
    "handleLike",
    "hookRunId",
    "method",
    "observations",
    "observedAt",
    "pageKind",
    "paginationLike",
    "queryKeys",
    "requestKind",
    "responseKind",
    "schemaVersion",
    "shapePaths",
    "sourceKind",
    "statusClass",
    "summaryKind",
    "topLevelKeys",
    "updatedAt",
    "userIdLike"
  ]);

  function asArray(value) {
    return Array.isArray(value) ? value : [];
  }

  function clipString(value, fallback, limit) {
    return typeof value === "string" && value ? value.slice(0, limit) : fallback;
  }

  function isSensitiveKey(key) {
    return SENSITIVE_KEY_PATTERN.test(String(key));
  }

  function sanitizeSchemaKey(key) {
    const text = String(key || "");
    if (!text) {
      return MASKED_KEY;
    }
    if (isSensitiveKey(text)) {
      return SENSITIVE_KEY;
    }
    if (/^\d+$/.test(text) || /^@/.test(text) || /^[a-f0-9]{16,}$/i.test(text) || text.length > 48) {
      return MASKED_KEY;
    }
    if (SAFE_SCHEMA_KEYS.has(text)) {
      return text;
    }
    const lower = text.toLowerCase();
    for (const safeKey of SAFE_SCHEMA_KEYS) {
      if (safeKey.toLowerCase() === lower) {
        return safeKey;
      }
    }
    return MASKED_KEY;
  }

  function sanitizeQueryKey(key) {
    const text = String(key || "");
    if (!text) {
      return MASKED_KEY;
    }
    if (isSensitiveKey(text)) {
      return SENSITIVE_KEY;
    }
    if (/^[A-Za-z][A-Za-z0-9_.-]{0,48}$/.test(text)) {
      return text;
    }
    return MASKED_KEY;
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
      .join(".")
      .slice(0, 160);
  }

  function sanitizeEndpointClass(value) {
    const text = clipString(value, "unknown", 260);
    if (SENSITIVE_TEXT_PATTERN.test(text)) {
      return "sensitive-endpoint";
    }
    try {
      const url = new URL(text);
      const keys = Array.from(url.searchParams.keys()).map(sanitizeQueryKey).sort();
      const query = keys.length ? `?${keys.map((key) => `${key}=<masked>`).join("&")}` : "";
      const pathname = url.pathname
        .split("/")
        .map((segment) => {
          if (!segment) {
            return "";
          }
          if (/^\d+$/.test(segment) || /^@/.test(segment) || /^[a-f0-9]{16,}$/i.test(segment) || segment.length > 48) {
            return "<masked>";
          }
          return segment.slice(0, 80);
        })
        .join("/");
      return `${url.origin}${pathname}${query}`.slice(0, 260);
    } catch (_error) {
      return text.replace(/[?&]([^=]+)=([^&]+)/g, (_match, key) => `?${sanitizeQueryKey(key)}=<masked>`).slice(0, 260);
    }
  }

  function normalizeFieldPresence(value) {
    const incoming = value && typeof value === "object" ? value : {};
    return {
      userIdLike: Boolean(incoming.userIdLike),
      handleLike: Boolean(incoming.handleLike),
      cursorLike: Boolean(incoming.cursorLike || incoming.paginationLike),
      paginationLike: Boolean(incoming.paginationLike || incoming.cursorLike)
    };
  }

  function normalizeObservation(value) {
    if (!value || typeof value !== "object") {
      return null;
    }
    const copyStrings = (items, limit, itemLimit, transform) =>
      asArray(items)
        .filter((item) => typeof item === "string")
        .slice(0, limit)
        .map((item) => transform(item).slice(0, itemLimit));
    const pageKind = ["blocked", "muted"].includes(value.pageKind) ? value.pageKind : "unknown";
    const requestKind = ["fetch", "xhr", "navigation", "lifecycle"].includes(value.requestKind)
      ? value.requestKind
      : "unknown";

    return {
      schemaVersion: SCHEMA_VERSION,
      observedAt: clipString(value.observedAt, new Date().toISOString(), 40),
      pageKind,
      requestKind,
      method: clipString(value.method, "GET", 12).toUpperCase(),
      endpointClass: sanitizeEndpointClass(value.endpointClass || "unknown"),
      statusClass: clipString(value.statusClass, "unknown", 12),
      responseKind: clipString(value.responseKind, "unknown", 24),
      hookRunId: clipString(value.hookRunId, "unknown", 80),
      sourceKind: clipString(value.sourceKind, "unknown", 24),
      topLevelKeys: copyStrings(value.topLevelKeys, 30, 80, sanitizeSchemaKey),
      shapePaths: copyStrings(value.shapePaths, 80, 160, sanitizeShapePath),
      queryKeys: copyStrings(value.queryKeys, 30, 80, sanitizeQueryKey),
      arrayHints: asArray(value.arrayHints)
        .slice(0, 20)
        .map((hint) => ({
          path: sanitizeShapePath(hint && typeof hint.path === "string" ? hint.path : "unknown"),
          count: Number.isFinite(hint && hint.count) ? Math.max(0, Math.min(9999, Math.trunc(hint.count))) : 0
        })),
      fieldPresence: normalizeFieldPresence(value.fieldPresence)
    };
  }

  function normalizeState(value) {
    const incoming = value && typeof value === "object" ? value : {};
    const observations = asArray(incoming.observations).map(normalizeObservation).filter(Boolean).slice(-MAX_OBSERVATIONS);
    return {
      schemaVersion: SCHEMA_VERSION,
      enabled: typeof incoming.enabled === "boolean" ? incoming.enabled : false,
      observations,
      updatedAt: typeof incoming.updatedAt === "string" ? incoming.updatedAt : null
    };
  }

  function createExportSummary(state) {
    const normalized = normalizeState(state);
    return {
      schemaVersion: SCHEMA_VERSION,
      summaryKind: "masked-f1a-observation",
      generatedAt: new Date().toISOString(),
      observations: normalized.observations
    };
  }

  function findUnsafeSummarySignals(value) {
    const signals = [];
    const seen = new WeakSet();

    function visit(node, path) {
      if (!node || typeof node !== "object") {
        if (typeof node === "string") {
          if (SENSITIVE_TEXT_PATTERN.test(node)) {
            signals.push(`${path}: sensitive text`);
          }
          if (RAW_HANDLE_PATTERN.test(node)) {
            signals.push(`${path}: raw handle-looking text`);
          }
          if (LONG_ID_PATTERN.test(node) && !path.endsWith(".observedAt") && !path.endsWith(".updatedAt")) {
            signals.push(`${path}: long numeric id-looking text`);
          }
        }
        return;
      }
      if (seen.has(node)) {
        return;
      }
      seen.add(node);
      for (const [key, child] of Object.entries(node)) {
        const childPath = `${path}.${key}`;
        if (!ALLOWED_OBSERVATION_KEYS.has(key) && isSensitiveKey(key)) {
          signals.push(`${childPath}: prohibited key`);
        }
        if (["rawResponse", "body", "payload", "headers", "cookie", "authorization", "token", "csrf", "user_id", "handle", "screen_name", "display_name", "text"].includes(key)) {
          signals.push(`${childPath}: raw-field key`);
        }
        visit(child, childPath);
      }
    }

    visit(value, "$");
    return Array.from(new Set(signals)).slice(0, 20);
  }

  function pageSignals(observations, pageKind) {
    const pageObservations = observations.filter((observation) => observation.pageKind === pageKind);
    return {
      count: pageObservations.length,
      hasEndpoint: pageObservations.some(
        (observation) => observation.endpointClass && !["unknown", "unparseable-url", "sensitive-endpoint"].includes(observation.endpointClass)
      ),
      hasShape: pageObservations.some((observation) => observation.topLevelKeys.length > 0 || observation.shapePaths.length > 0),
      hasIdentity: pageObservations.some(
        (observation) => observation.fieldPresence.userIdLike || observation.fieldPresence.handleLike
      ),
      hasPagination: pageObservations.some(
        (observation) =>
          observation.fieldPresence.paginationLike ||
          observation.shapePaths.some((path) => /(cursor|next|hasMore|has_more)/i.test(path)) ||
          observation.queryKeys.some((key) => /(cursor|next)/i.test(key))
      ),
      hookRunIds: Array.from(new Set(pageObservations.map((observation) => observation.hookRunId).filter((id) => id && id !== "unknown")))
    };
  }

  function evaluateObservationSummary(value, options = {}) {
    const unsafeSignals = findUnsafeSummarySignals(value);
    if (unsafeSignals.length > 0) {
      return {
        status: "unsafe_summary",
        unsafeSignals,
        missing: [],
        recommendation: "raw 値が混入している可能性があるため、この summary は貼らずに削除してください。"
      };
    }

    const input = Array.isArray(value) ? { observations: value } : value;
    const state = normalizeState(input);
    if (state.observations.length === 0) {
      return {
        status: "unknown",
        unsafeSignals: [],
        missing: ["observations"],
        recommendation: "masked observation がありません。F1-A 捕捉検証を有効化して blocked / muted を再確認してください。"
      };
    }

    const blocked = pageSignals(state.observations, "blocked");
    const muted = pageSignals(state.observations, "muted");
    const hasFixtureSource = state.observations.some((observation) => observation.sourceKind === "fixture");
    const mutedHookRunIds = new Set(muted.hookRunIds);
    const sharedHookRun = blocked.hookRunIds.some((id) => mutedHookRunIds.has(id));
    const missing = [];
    if (!blocked.count) missing.push("blocked observation");
    if (!muted.count) missing.push("muted observation");
    if (!blocked.hasEndpoint) missing.push("blocked endpoint");
    if (!muted.hasEndpoint) missing.push("muted endpoint");
    if (!blocked.hasShape) missing.push("blocked response shape");
    if (!muted.hasShape) missing.push("muted response shape");
    if (!blocked.hasIdentity) missing.push("blocked user_id-like or handle-like signal");
    if (!muted.hasIdentity) missing.push("muted user_id-like or handle-like signal");
    if (!blocked.hasPagination) missing.push("blocked pagination or completion signal");
    if (!muted.hasPagination) missing.push("muted pagination or completion signal");
    if (!sharedHookRun) missing.push("SPA navigation continuity signal");

    if (missing.length > 0) {
      return {
        status: "f1a_insufficient",
        unsafeSignals: [],
        missing,
        blocked,
        muted,
        recommendation: "不足項目があるため、F1-A primary は未採用です。F1-B または F1-D fallback を検討してください。"
      };
    }

    return {
      status: options.mode === "live" && !hasFixtureSource ? "f1a_viable" : "fixture_pass",
      unsafeSignals: [],
      missing: [],
      blocked,
      muted,
      recommendation:
        options.mode === "live" && !hasFixtureSource
          ? "masked 実測条件は満たしています。Phase 2 では review risk と保守性を確認してから F1-A primary を採用してください。"
          : "fixture 上の条件は満たしています。実 X の masked summary なしでは F1-A primary とは判定しません。"
    };
  }

  namespace.ResearchF1A = {
    createExportSummary,
    evaluateObservationSummary,
    findUnsafeSummarySignals,
    normalizeObservation,
    normalizeState,
    sanitizeEndpointClass,
    sanitizeQueryKey,
    sanitizeSchemaKey,
    sanitizeShapePath
  };
})();
