# CHATGPT_HANDOFF

## Status

Prepared by Codex for upload or paste into ChatGPT.

Update on 2026-05-30: this pre-review handoff has been superseded by the pasted Claude Code review and ChatGPT triage recorded in `docs/CLAUDE_REVIEW.md`, `docs/AI_REVIEW_TRIAGE.md`, and `docs/CODEX_TASKS.md`.

This file remains useful as historical pre-review repository context, but it should not be treated as the current source of truth for review status.

## How this file should be used

Historical use: attach or paste this file into ChatGPT and ask ChatGPT to create a Claude Code prompt for an independent read-only review.

Current use after 2026-05-30: prefer `docs/CLAUDE_REVIEW.md`, `docs/AI_REVIEW_TRIAGE.md`, and `docs/CODEX_TASKS.md`. Do not ask Claude Code to review again unless ChatGPT explicitly decides a second review pass is needed.

ChatGPT should remain the commander. Claude Code should review the repository and produce advisory findings only. Codex should not implement Claude suggestions unless ChatGPT explicitly approves them through triage.

## Repository identity

- Repository/folder name: `012_x-true-block-mute` / `x-true-block-mute`
- Local path inspected by Codex: `D:\Agent\Codex\Projects\012_x-true-block-mute`
- Current branch during this handoff: `feat/popup-japanese-guidance`
- Remote: `origin` points to `https://github.com/h8nc4y/x-true-block-mute.git`
- Working tree status before this file was created: five untracked review coordination docs:
  - `docs/AI_REVIEW_TRIAGE.md`
  - `docs/CLAUDE_REVIEW.md`
  - `docs/CODEX_TASKS.md`
  - `docs/DECISION_LOG.md`
  - `docs/REVIEW_BRIEF.md`
- Important top-level directories:
  - `src/`: Chrome extension source code
  - `tests/`: local fixtures and Node validation scripts
  - `docs/`: review coordination docs, manual verification docs, research notes, and decision notes
  - `.codegraph/`: local CodeGraph index, ignored by Git
  - `tmp/`: ignored local temporary workspace
- Important config files:
  - `manifest.json`: Chrome Manifest V3 extension manifest
  - `.gitignore`: ignores logs, temp/build/dependency outputs, `.codegraph/`, and local secret/data paths
  - `AGENTS.md`: repo-local Codex operating and safety rules

## Project summary

`x-true-block-mute` appears to be a Chrome Manifest V3 extension project for X/Twitter. Its stated goal is to reduce information exposure from accounts that the user has blocked or muted.

The current repository is a prototype/research-stage implementation. Phase 1 supports a local/synthetic flow with popup controls, `chrome.storage`, a static content script, and a synthetic timeline fixture. Phase 1.5 adds a research-only F1-A MAIN-world hook scaffold to investigate whether X settings-page internal responses can be summarized safely without storing raw account data.

The repository repeatedly documents strict data boundaries: no OAuth, no X API integration, no Cookie/CSRF/token capture, no raw response storage, no raw user IDs/handles/display names/post text in storage/docs/logs/fixtures, and no production F1 sync in the current scope.

## Confirmed facts

- The repo contains `README.md`, `AGENTS.md`, `manifest.json`, `.gitignore`, `src/`, `tests/`, `docs/`, `tmp/`, and `.codegraph/`.
- `manifest.json` declares Manifest V3, extension name `x-true-block-mute`, permissions `storage` and `scripting`, and host permissions for `https://x.com/*` and `https://twitter.com/*`.
- `manifest.json` registers popup UI at `src/popup/popup.html`.
- `manifest.json` registers `src/background/research-background.js` as background service worker.
- `manifest.json` registers one content-script path for blocked/muted settings pages at `document_start` and another broader X/Twitter content script at `document_idle`.
- `README.md` states that X real DOM stable `user_id` acquisition and production F1-A/F1-B/F1-C/F1-D list acquisition are not implemented.
- `README.md` documents local Chrome `Load unpacked` verification steps.
- `README.md` documents local Node validation scripts.
- `docs/research/f1-a-main-world-hook.md` states that live logged-in X blocked/muted endpoint/shape/pagination/timing are unconfirmed.
- `docs/decisions/f1-source-selection.md` records F1 source selection as `defer decision`.
- `docs/manual-popup-verification.md` tells operators not to paste raw response, HAR, DevTools Network body, Cookie, CSRF token, Authorization header, OAuth token, password, MFA code, `.env`, credentials, auth/session files, or personal account data.
- No `package.json`, lockfile, lint config, typecheck config, build config, or CI workflow was found during prior review brief inspection.
- Claude Code review has been pasted into `docs/CLAUDE_REVIEW.md`.
- ChatGPT has triaged Claude findings into approved, partially approved, and deferred items in `docs/AI_REVIEW_TRIAGE.md`.

## Inferred assumptions

- The product is meant for Japanese non-programmer users or operators if it matures beyond local development.
- The current implementation should be treated as research/prototype work, not production-ready privacy tooling.
- Phase 2 source selection is not decided and should not be assumed by Claude.
- Claude Code should focus on evidence-backed review findings rather than expanding scope into implementation.
- The review coordination docs are intended to be tracked in Git unless the user chooses local-only governance notes.

## Current goal

Current coordination goal: implement only ChatGPT-approved COD-00〜COD-05 tasks and keep deferred Claude findings out of scope.

Current product goal, based on repository docs: continue toward a Chrome extension that reduces exposure to blocked/muted X/Twitter accounts while preserving strict privacy, permission, and phase-scope boundaries.

## Target users and use cases

Likely users/operators:

- The project owner/developer loading the extension locally in Chrome.
- ChatGPT coordinating decisions and triage.
- Codex implementing only ChatGPT-approved tasks.
- Claude Code acting as an independent reviewer.
- Future Japanese non-programmer users if the extension becomes a product.

Main workflows:

- Load the extension through Chrome `Load unpacked`.
- Use popup controls for normal filter on/off, display mode, and synthetic test data.
- Verify synthetic timeline behavior with `tests/fixtures/home-timeline.html`.
- Use F1-A research mode only for human-run logged-in X settings-page observations.
- Copy masked summaries only, then evaluate them locally with Node scripts.
- Route Claude review findings through ChatGPT before Codex implementation.

## Current implementation status

Implemented or likely implemented:

- MV3 extension manifest.
- Popup UI under `src/popup/`.
- Shared constants under `src/shared/constants.js`.
- Storage abstraction under `src/storage/storage.js`.
- Normal DOM filtering content script under `src/content/content-script.js`.
- F1-A research background service worker under `src/background/research-background.js`.
- F1-A content bridge, MAIN-world hook, and observation utilities under `src/research/f1-a/`.
- Local fixtures and validation scripts under `tests/`.
- Manual verification, research, decision, and AI review coordination docs under `docs/`.

Partially implemented:

- F1-A feasibility path exists as scaffold and local validation tooling, but live X evidence is not recorded.
- Popup research UI can show/copy masked summaries, but real-X usefulness is still unconfirmed.
- Validation exists as local Node scripts, but no package-manager scripts or CI config were found.

Missing or unclear:

- Production block/mute list sync.
- F1-B DOM extraction implementation.
- F1-C X API/OAuth implementation.
- F1-D import UI implementation.
- Release packaging and Chrome Web Store submission plan.
- CI, lint, typecheck, build, and dependency-management setup.
- Confirmed live Chrome UI manual verification results.

Risky or broken areas if evidence exists:

- Live X endpoint/shape/pagination/timing/SPA continuity are explicitly unconfirmed.
- F1-A relies on private X internals and MAIN-world network hook behavior.
- `scripting` permission and network hook review posture may be sensitive for Chrome Web Store review.
- The project must continue preventing raw X/account/auth data from entering storage, clipboard, fixtures, docs, logs, or commits.

## Architecture and tech stack

- Language: plain JavaScript.
- UI: plain HTML/CSS/JavaScript Chrome extension popup.
- Extension platform: Chrome Manifest V3.
- Storage: `chrome.storage.sync` for settings and `chrome.storage.local` for entries/research state.
- Normal filtering path:
  1. Popup writes settings and synthetic entries.
  2. Content script reads settings/entries.
  3. MutationObserver watches timeline-like cards.
  4. Matching cards are hidden, replaced with a placeholder, or left alone depending on display mode.
- F1-A research path:
  1. Popup toggles F1-A research state.
  2. Settings-page content bridge asks background service worker for MAIN-world injection.
  3. Background injects `main-world-hook.js` with `chrome.scripting.executeScript`.
  4. MAIN-world hook wraps `fetch` and `XMLHttpRequest` enough to emit sanitized structural observations.
  5. Content bridge stores normalized observations in `xtbmF1AResearch`.
  6. Popup exports masked summary only.
- Database: none found.
- Backend/cloud services: none found.
- External services/APIs: target web pages are X/Twitter; no X API/OAuth integration found.
- Tests/validation: Node `.mjs` scripts and synthetic fixtures.
- Build tools: none found.
- Deployment hints: local unpacked Chrome extension only; no deployment config found.

## Important files for ChatGPT

- `README.md`: project purpose, phases, permissions, storage schema, validation commands, and known unknowns.
- `AGENTS.md`: repo-local safety constraints and phase boundaries.
- `manifest.json`: authoritative extension permissions and content-script registration.
- `.gitignore`: confirms ignored temp/secret/build/dependency paths.
- `src/shared/constants.js`: schema version, storage keys, display modes, synthetic entries.
- `src/storage/storage.js`: storage normalization and separation of settings, entries, and F1-A research state.
- `src/content/content-script.js`: normal DOM filtering logic.
- `src/popup/popup.html`, `src/popup/popup.css`, `src/popup/popup.js`: popup UI and masked summary copy flow.
- `src/background/research-background.js`: MAIN-world hook injection request handling.
- `src/research/f1-a/content-bridge.js`: bridge from page messages to extension storage.
- `src/research/f1-a/main-world-hook.js`: research-only fetch/XHR observation hook.
- `src/research/f1-a/observation-utils.js`: observation masking, unsafe summary detection, and evaluator logic.
- `tests/scripts/verify-phase1-static.mjs`: static manifest/scope checks.
- `tests/scripts/verify-f1a-observation-safety.mjs`: sanitizer/evaluator safety checks.
- `tests/scripts/verify-f1a-main-hook-simulator.mjs`: local MAIN-world hook simulator.
- `tests/scripts/evaluate-f1-observation.mjs`: masked summary evaluator.
- `tests/scripts/audit-operational-alignment.mjs`: repo/global operation alignment audit.
- `tests/fixtures/home-timeline.html`: synthetic timeline fixture.
- `tests/fixtures/f1-a-masked-summary.fixture.json`: non-live masked summary fixture.
- `docs/manual-popup-verification.md`: manual verification and safe reporting guidance.
- `docs/research/f1-a-main-world-hook.md`: F1-A research design and unknowns.
- `docs/decisions/f1-source-selection.md`: F1 source selection criteria and defer decision.

## Review coordination files

- `docs/REVIEW_BRIEF.md`: Main context packet prepared by Codex. It separates confirmed facts from inferred assumptions and lists architecture, status, risks, validation commands, review questions, and source evidence.
- `docs/CLAUDE_REVIEW.md`: Contains the pasted Claude Code review and a findings table with ChatGPT triage status.
- `docs/AI_REVIEW_TRIAGE.md`: Records ChatGPT-approved, partially approved, and deferred findings.
- `docs/CODEX_TASKS.md`: Records COD-00〜COD-05 as the current Codex implementation scope.
- `docs/DECISION_LOG.md`: Records that ChatGPT remains commander, Claude is reviewer, Codex implements only approved tasks, Claude findings are not automatically accepted, and this pass is limited to COD-00〜COD-05.

## Known risks and review focus

Claude Code should review:

- Goal and requirement alignment:
  - Are Phase 1 / Phase 1.5 boundaries clear and respected?
  - Are non-goals documented strongly enough?
- Architecture:
  - Is the global namespace script-loading approach robust?
  - Is the extension split cleanly between popup, storage, content script, background, and research code?
- Implementation quality:
  - Are storage normalization, DOM matching, MutationObserver behavior, and UI states reliable?
  - Is F1-A hook idempotency and message handling safe enough for research-only use?
- Tests:
  - Are validation scripts meaningful and deterministic?
  - What gaps remain because there is no CI/package script setup?
- Security/privacy:
  - Can raw X/account/auth data leak into storage, clipboard, fixtures, docs, logs, or commits?
  - Are forbidden permissions absent?
- Secret handling:
  - Are `.gitignore` and docs enough to avoid accidental secret capture?
  - Should a dedicated secret/config audit be run before external review?
- UX/UI:
  - Is Japanese popup wording clear for non-programmers?
  - Are warnings around masked summary and raw response understandable?
- Deployment and operations:
  - Is the lack of packaging/CI acceptable at this stage?
  - What would be required before Chrome Web Store or broader release?
- AI-generated-code risks:
  - Are there overbroad abstractions, unverified assumptions, or documentation claims not backed by code?
  - Are Claude findings likely to include future-scope suggestions that ChatGPT should defer rather than approve?

## Validation commands discovered

The following commands are supported by repository documentation. This handoff does not claim they were run unless listed in the next section.

```powershell
node tests/scripts/verify-phase1-static.mjs
node tests/scripts/verify-f1a-observation-safety.mjs
node tests/scripts/verify-f1a-main-hook-simulator.mjs
node tests/scripts/evaluate-f1-observation.mjs tests/fixtures/f1-a-masked-summary.fixture.json
node tests/scripts/audit-operational-alignment.mjs
```

No repository-supported install, lint, typecheck, build, or dev-server command was found.

## Commands run by Codex for this handoff

Safe local inspection only:

- `Select-String` over Codex memory for repo-specific context: found prior notes about Phase 1, Phase 1.5/1.6, popup guidance, and private repo flow. Current repository files were treated as source of truth.
- `Get-Content` for `verification-before-completion` and `google-eng-practices` skills: used as process guidance for evidence-backed final reporting.
- `Test-Path docs/CHATGPT_HANDOFF.md`: result was `False` before creation.
- `git status --short`: showed five untracked review coordination docs before this file was created.
- `git branch --show-current`: returned `feat/popup-japanese-guidance`.
- `git log --oneline -n 5`: showed recent commits `1bb8fbb feat:improve-japanese-popup-guidance`, `d5b6aa5 docs:align-codex-operations-and-github-auth-diagnostics`, and `ff9b124 chore: initialize mv3 extension skeleton`.
- `Get-ChildItem -Force`: confirmed top-level directories and files.
- `Get-ChildItem -Path docs -Recurse -File`: listed existing docs and sizes.
- `Get-Content docs/REVIEW_BRIEF.md`: inspected the previously prepared review brief.
- `Get-Content docs/CLAUDE_REVIEW.md docs/AI_REVIEW_TRIAGE.md docs/CODEX_TASKS.md docs/DECISION_LOG.md`: inspected coordination file state.
- `Select-String` over `README.md`, `docs/manual-popup-verification.md`, `docs/research/f1-a-main-world-hook.md`, and `docs/decisions/f1-source-selection.md`: confirmed phase scope, permissions, validation commands, F1-A unknowns, and data-safety boundaries.
- `git check-ignore -v docs/CHATGPT_HANDOFF.md`: no output, meaning this file is not ignored by Git.

No source code, tests, configuration, dependencies, deployment files, commits, pushes, PRs, external API calls, package installs, migrations, or dev servers were used for this handoff.

## Remaining uncertainties

- Claude Code review is complete for the current pass, but any future second review pass would require a new ChatGPT decision.
- ChatGPT triage exists for CL-AUDIT-001〜CL-AUDIT-011, but only COD-00〜COD-05 are in current implementation scope.
- `docs/REVIEW_BRIEF.md` and related coordination docs are currently untracked unless the user later stages/commits them.
- Live Chrome `Load unpacked` manual verification is documented but not confirmed in this handoff.
- Live X logged-in F1-A behavior is未確認.
- Phase 2 source selection remains deferred.
- It is undecided whether Claude should review the full repository, only the current branch, or a specific diff.
- It is undecided whether a secrets/config audit should precede Claude review.
- It is undecided whether lack of CI/package scripts is MVP-blocking or later hygiene.

## Requested next action for ChatGPT

Historical pre-review request:

```text
Please review this handoff and create a Claude Code prompt for an independent read-only review. Claude should evaluate the project goal, requirements, current implementation, architecture, tests, security, UX/UI, and produce findings that ChatGPT can later triage before Codex implements anything.
```

Current post-triage request:

```text
Please review the Codex implementation report for COD-00〜COD-05, confirm whether the approved scope was followed, and decide whether any deferred Claude findings should be promoted into a future task.
```
