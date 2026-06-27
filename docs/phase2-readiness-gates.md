# Phase 2 readiness gates

## Status

Prepared by Codex on 2026-05-31 from local repository inspection and the original GATE-00 through GATE-05 scope. Updated 2026-06-27 to reflect the v1.1 / M7 state and the current autonomous-user-instruction wording.

This document is a readiness gate and historical decision record. Current status statements below supersede the original pre-Phase-2 uncertainty, but they are still not permission to change product scope, permissions, data source, or distribution flow without the active human gates.

## Purpose

Phase 2 should not begin until the project has a clear local baseline, privacy boundary, deferred-finding register, and repeatable docs consistency check. These gates keep the project reviewable under the current operating rule (2026-06-13):

- The user remains the approval authority for human-gated changes. Within the current user-authorized autonomous loop, Codex / Claude Code may implement local docs, tests, and code-health tasks.
- Claude Code may automate Chrome Load unpacked / popup / fixture verification (Playwright/CDP) and may drive live X masked-observation collection through the Chrome MCP under user consent.
- The agent never receives or stores credentials (password, MFA, Cookie, token) and never reads raw X responses; only masked observations leave the page.
- Chrome Web Store distribution is the final goal; readiness work is in scope. F1-C (OAuth/API) is closed; F1-B/F1-D are closed fallback options unless a new human-approved source decision supersedes F1-A.

## Current confirmed baseline

- The repository is a Chrome Manifest V3 extension for reducing exposure to blocked or muted X/Twitter accounts.
- The current phase is v1.1 / M7 Chrome Web Store review wait; Phase 2 production sync and filtering are implemented.
- Manifest permissions are limited to `storage`.
- Host permissions are limited to `https://x.com/*` and `https://twitter.com/*`.
- Local synthetic fixture, production sync extraction, bridge, storage schema, and packaging verification paths exist.
- `xtbmF1AResearch` remains separate from normal `xtbmEntries`; research UI and dynamic `scripting` injection are retired from the shipped extension.
- `fixture_pass` from `tests/scripts/evaluate-f1-observation.mjs` is fixture-only evidence and is not proof that F1-A is viable on live X.

## Gate summary

| Gate | Name | Required before Phase 2 | Current status |
| --- | --- | --- | --- |
| GATE-00 | Post-merge baseline confirmation | `main` baseline, branch, diff, local static checks, and merged review context are known. | Done. |
| GATE-01 | Phase 2 readiness gate | This document exists and separates allowed local work from deferred implementation. | Done; retained as historical gate record. |
| GATE-02 | Privacy and threat model | Sensitive data, storage, clipboard, docs, logs, and permission boundaries are documented. | Done in `docs/privacy-threat-model.md`; updated through M7. |
| GATE-03 | Deferred findings register | Deferred Claude/user/ChatGPT items are listed without auto-implementation. | Done in `docs/deferred-findings-register.md`; resolved items are marked. |
| GATE-04 | Docs consistency verification | A local script checks that core docs and permission boundaries stay aligned. | Done in `tests/scripts/verify-docs-consistency.mjs`. |
| GATE-05 | Coordination docs update | Governance and tasks are recorded in `AGENTS.md` and `TASKS_BACKLOG.md` (the ChatGPT-era coordination docs were retired). | Done. |

## Chrome Load unpacked gate

Before browser-dependent changes are accepted, this must hold:

1. Chrome can Load unpacked this repository without manifest errors.
2. The popup opens and renders in extension context.
3. The popup shows normal filter controls.
4. The popup shows local synthetic fixture controls.
5. The shipped popup does not expose the retired F1-A research memo area.
6. The UI clearly separates local synthetic test data from production sync.
7. No real X login, X account data, Cookie, token, raw response, HAR, or personal screenshot is required for this check.

Current status: M2 完了（2026-06-13） and refreshed through M7. `node tests/scripts/verify-extension-load-chrome.mjs` (Playwright Chromium + raw CDP, no npm deps) passed for extension load, popup, options, synthetic fixture filtering, and the storage-only/background-less package state. Screenshots use synthetic data only and are written to `tmp/` (gitignored). The branded installed Chrome 137+ disables `--load-extension`, so the cached open-source Chromium is used. Chrome Web Store review result remains 未確認.

## Synthetic fixture gate

Keep the local synthetic fixture path healthy:

```powershell
node tests/scripts/verify-phase1-static.mjs
node tests/scripts/verify-f1a-observation-safety.mjs
node tests/scripts/verify-f1a-main-hook-simulator.mjs
node tests/scripts/evaluate-f1-observation.mjs tests/fixtures/f1-a-masked-summary.fixture.json
node tests/scripts/verify-docs-consistency.mjs
```

The synthetic fixture may confirm local parsing and safety boundaries. It does not confirm live X DOM structure, real author matching, SPA continuity, endpoint behavior, or production sync feasibility.

## F1-A masked-summary gate

F1-A was selected as the primary source after live masked-summary evaluation in M3. Under the 2026-06-13 governance change, Claude Code may collect masked summaries by driving the user's logged-in Chrome through the Chrome MCP (masked observations only; no raw response, Cookie, or token). The user consents to the session and performs the login; the agent never receives credentials. Future live checks must still pass the same `unsafe_summary` gate before any summary is shared.

Expected evaluator outcomes:

- `f1a_viable`: Historical live evidence allowed F1-A to become the v1.1 primary path; any new source/scope-changing implementation still requires user approval.
- `f1a_insufficient`: Do not proceed with F1-A primary; consider F1-B or F1-D fallback.
- `unsafe_summary`: Stop. Do not share or commit the summary. Delete or quarantine it according to human instructions.
- `fixture_pass`: Fixture-only evidence. This must not be used as live F1-A proof.

## Source selection gate

Phase 2 source selection is decided for v1.1: F1-A settings-page sync is the primary path.

- F1-A: Settings-page observed response shape, masked summary only for validation; production extraction stores only `user_id` / `handle` / `listKind` locally.
- F1-B: Real DOM extraction. Closed as a fallback for now because F1-A is viable and less UI-fragile for list acquisition.
- F1-C: X API / OAuth. Deferred and out of current scope.
- F1-D: Human import UI. Closed as a fallback for now; revisit only with a new product decision.

No new source should be implemented until the user approves the selected source, scope, acceptance criteria, and validation commands. F1-B/F1-D remain closed fallbacks for the current v1.1 path, and F1-C remains closed.

## Stop conditions for future source/permission changes

These remain hard stops even under the 2026-06-13 governance change. Stop and return to the user if the next step would require:

- Receiving or storing credentials: password, MFA, Cookie, CSRF token, Authorization header, or OAuth token.
- Reading or storing, anywhere outside the user's own `xtbmEntries` device storage, a raw user ID, raw handle, display name, post body, raw X response, HAR, or personal screenshot.
- Capturing or reading raw X response bodies during live verification (only masked observations may leave the page).
- Adding `webRequest`, `cookies`, `tabs`, `activeTab`, `<all_urls>`, or `https://api.x.com/*` without a written rationale, threat-model update, and user approval.
- Sending any user data off the device (the extension stays local-only).

## Human approval required

User approval is required before:

- Changing manifest permissions or host permissions.
- Adopting a new source (F1-B/F1-D/other) or changing what production sync writes into `xtbmEntries`.
- Submitting to the Chrome Web Store (developer registration, payment, and final submission are performed by the user).
- Any deploy, external dashboard, or paid-service usage.

Within these bounds, Codex / Claude Code may implement current user-authorized local work. Chrome verification and live X verification still follow the masked-observation and human-gate rules above.

## Next minimum step

The next minimum step is owner-side Chrome Web Store review tracking. Agent-safe work while review is pending is limited to documentation consistency, local validation maintenance, and scoped code health work that does not change permissions, data source, privacy posture, or distribution state.
