# Phase 2 readiness gates

## Status

Prepared by Codex on 2026-05-31 from local repository inspection and ChatGPT-approved GATE-00 through GATE-05 scope.

This document is a readiness gate, not approval to implement Phase 2. It must not be treated as evidence that Chrome Load unpacked, popup human confirmation, real X login, real X DOM behavior, or F1-A live endpoints have been verified.

## Purpose

Phase 2 should not begin until the project has a clear local baseline, privacy boundary, deferred-finding register, and repeatable docs consistency check. These gates keep the project reviewable while preserving the current operating rule:

- ChatGPT is the commander for triage.
- Claude Code findings are advisory until ChatGPT approves them.
- Codex implements only ChatGPT-approved tasks.
- Real X, OAuth/API, production sync, packaging, CI, deployment, and Chrome Web Store work remain out of scope unless explicitly approved later.

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

Current status: 未確認. Codex has not performed this human Chrome Load unpacked confirmation in this pass.

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

F1-A can be considered for primary use only after ChatGPT approves a later live masked-summary evaluation path and the user supplies a safe masked summary. Codex must not collect real X data itself.

Expected evaluator outcomes:

- `f1a_viable`: F1-A may be considered further, but still requires ChatGPT approval before implementation.
- `f1a_insufficient`: Do not proceed with F1-A primary; consider F1-B or F1-D fallback.
- `unsafe_summary`: Stop. Do not share or commit the summary. Delete or quarantine it according to human instructions.
- `fixture_pass`: Fixture-only evidence. This must not be used as live F1-A proof.

## Source selection gate

Phase 2 source selection remains undecided.

- F1-A: Settings-page observed response shape, masked summary only. Live viability is 未確認.
- F1-B: Real DOM extraction. Deferred because real-DOM author matching is 未確認 and privacy-sensitive.
- F1-C: X API / OAuth. Deferred and out of current scope.
- F1-D: Human import UI. Deferred as a possible privacy-preserving fallback.

No Phase 2 source should be implemented until ChatGPT explicitly approves the selected source, scope, acceptance criteria, and validation commands.

## Stop conditions before Phase 2

Stop and return to ChatGPT/user if the next step would require:

- Real X login by Codex.
- Accessing `x.com` or `twitter.com` live pages from Codex.
- Reading or storing Cookie, CSRF token, Authorization header, OAuth token, raw user ID, raw handle, display name, post body, HAR, or personal screenshot.
- Adding `webRequest`, `cookies`, `tabs`, `activeTab`, `<all_urls>`, or `https://api.x.com/*`.
- Captured-response-to-`xtbmEntries` production sync.
- F1-B, F1-C, or F1-D implementation.
- Chrome Web Store preparation.
- Package setup, CI setup, deploy, or external dashboard operation.

## Human approval required

Human or ChatGPT approval is required before:

- Treating any Claude finding as approved implementation work.
- Starting real X verification.
- Using live masked summary evidence.
- Changing permissions or host permissions.
- Writing production sync.
- Creating package, CI, deployment, or store-distribution workflows.

## Next minimum step

The next minimum step is human Chrome Load unpacked and popup confirmation using `docs/manual-popup-verification.md`. The result should be returned to ChatGPT before Codex proceeds beyond local docs and fixture verification.
