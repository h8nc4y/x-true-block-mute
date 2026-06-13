# Phase 2 readiness gates

## Status

Prepared by Codex on 2026-05-31 from local repository inspection and ChatGPT-approved GATE-00 through GATE-05 scope.

This document is a readiness gate, not approval to implement Phase 2. It must not be treated as evidence that Chrome Load unpacked, popup human confirmation, real X login, real X DOM behavior, or F1-A live endpoints have been verified.

## Purpose

Phase 2 should not begin until the project has a clear local baseline, privacy boundary, deferred-finding register, and repeatable docs consistency check. These gates keep the project reviewable under the current operating rule (2026-06-13, see `docs/DECISION_LOG.md`):

- The user is the approval authority. Tasks approved by the user in chat are implemented by Claude Code.
- Claude Code may automate Chrome Load unpacked / popup / fixture verification (Playwright/CDP) and may drive live X masked-observation collection through the Chrome MCP under user consent.
- The agent never receives or stores credentials (password, MFA, Cookie, token) and never reads raw X responses; only masked observations leave the page.
- Chrome Web Store distribution is the final goal; readiness work is in scope. F1-C (OAuth/API) is closed; F1-B/F1-D remain fallbacks if F1-A is not viable.

## Current confirmed baseline

- The repository is a Chrome Manifest V3 extension for reducing exposure to blocked or muted X/Twitter accounts.
- The current phase is Phase 1 / Phase 1.5 research and prototype work.
- Manifest permissions are limited to `storage` and `scripting`.
- Host permissions are limited to `https://x.com/*` and `https://twitter.com/*`.
- Local synthetic fixture and F1-A masked-summary evaluator paths exist.
- `xtbmF1AResearch` is separate from normal `xtbmEntries`.
- `fixture_pass` from `tests/scripts/evaluate-f1-observation.mjs` is fixture-only evidence and is not proof that F1-A is viable on live X.

## Gate summary

| Gate | Name | Required before Phase 2 | Current status |
| --- | --- | --- | --- |
| GATE-00 | Post-merge baseline confirmation | `main` baseline, branch, diff, local static checks, and merged review context are known. | Prepared in this pass. |
| GATE-01 | Phase 2 readiness gate | This document exists and separates allowed local work from deferred implementation. | Prepared in this pass. |
| GATE-02 | Privacy and threat model | Sensitive data, storage, clipboard, docs, logs, and permission boundaries are documented. | Prepared in `docs/privacy-threat-model.md`. |
| GATE-03 | Deferred findings register | Deferred Claude/user/ChatGPT items are listed without auto-implementation. | Prepared in `docs/deferred-findings-register.md`. |
| GATE-04 | Docs consistency verification | A local script checks that core docs and permission boundaries stay aligned. | Prepared in `tests/scripts/verify-docs-consistency.mjs`. |
| GATE-05 | Coordination docs update | `docs/CODEX_TASKS.md` and `docs/DECISION_LOG.md` record this gate pass. | Prepared in this pass. |

## Chrome Load unpacked gate

Before any Phase 2 implementation depends on browser behavior, a human should confirm:

1. Chrome can Load unpacked this repository without manifest errors.
2. The extension icon opens the popup.
3. The popup shows normal filter controls.
4. The popup shows local synthetic fixture controls.
5. The popup shows the F1-A research memo area.
6. The UI clearly says this is not production sync.
7. No real X login, X account data, Cookie, token, raw response, HAR, or personal screenshot is required for this check.

Current status: 未確認. The Chrome Load unpacked confirmation has not been completed yet. Under the 2026-06-13 governance change, Claude Code may perform it through Playwright/CDP automation (M2); until that run finishes, treat it as 未確認.

## Synthetic fixture gate

Before Phase 2 relies on filtering behavior, keep the local synthetic fixture path healthy:

```powershell
node tests/scripts/verify-phase1-static.mjs
node tests/scripts/verify-f1a-observation-safety.mjs
node tests/scripts/verify-f1a-main-hook-simulator.mjs
node tests/scripts/evaluate-f1-observation.mjs tests/fixtures/f1-a-masked-summary.fixture.json
node tests/scripts/verify-docs-consistency.mjs
```

The synthetic fixture may confirm local parsing and safety boundaries. It does not confirm live X DOM structure, real author matching, SPA continuity, endpoint behavior, or production sync feasibility.

## F1-A masked-summary gate

F1-A can be considered for primary use after a live masked-summary evaluation. Under the 2026-06-13 governance change, Claude Code may collect the masked summary by driving the user's logged-in Chrome through the Chrome MCP (masked observations only; no raw response, Cookie, or token). The user consents to the session and performs the login; the agent never receives credentials.

Expected evaluator outcomes:

- `f1a_viable`: F1-A may be considered further, but still requires user approval before implementation.
- `f1a_insufficient`: Do not proceed with F1-A primary; consider F1-B or F1-D fallback.
- `unsafe_summary`: Stop. Do not share or commit the summary. Delete or quarantine it according to human instructions.
- `fixture_pass`: Fixture-only evidence. This must not be used as live F1-A proof.

## Source selection gate

Phase 2 source selection remains undecided.

- F1-A: Settings-page observed response shape, masked summary only. Live viability is 未確認.
- F1-B: Real DOM extraction. Deferred because real-DOM author matching is 未確認 and privacy-sensitive.
- F1-C: X API / OAuth. Deferred and out of current scope.
- F1-D: Human import UI. Deferred as a possible privacy-preserving fallback.

No Phase 2 source should be implemented until the user approves the selected source, scope, acceptance criteria, and validation commands. The current preference is F1-A primary if the live evaluation is viable, with F1-B/F1-D as fallbacks; F1-C is closed.

## Stop conditions before Phase 2

These remain hard stops even under the 2026-06-13 governance change. Stop and return to the user if the next step would require:

- Receiving or storing credentials: password, MFA, Cookie, CSRF token, Authorization header, or OAuth token.
- Reading or storing, anywhere outside the user's own `xtbmEntries` device storage, a raw user ID, raw handle, display name, post body, raw X response, HAR, or personal screenshot.
- Capturing or reading raw X response bodies during live verification (only masked observations may leave the page).
- Adding `webRequest`, `cookies`, `tabs`, `activeTab`, `<all_urls>`, or `https://api.x.com/*` without a written rationale, threat-model update, and user approval.
- Sending any user data off the device (the extension stays local-only).

## Human approval required

User approval is required before:

- Changing manifest permissions or host permissions.
- Adopting a Phase 2 source (F1-A/F1-B/F1-D) as primary and writing production sync into `xtbmEntries`.
- Submitting to the Chrome Web Store (developer registration, payment, and final submission are performed by the user).
- Any deploy, external dashboard, or paid-service usage.

Within these bounds, Claude Code implements the tasks the user has approved in chat, including Chrome and live X verification.

## Next minimum step

The next minimum step is the M2 Chrome Load unpacked and popup verification — automated by Claude Code via Playwright/CDP, with `docs/manual-popup-verification.md` as the reference checklist. Results are reported as actually measured.
