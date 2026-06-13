# REVIEW_BRIEF

> **ARCHIVED (2026-06-13)**: この文書は ChatGPT 承認制ガバナンス時代のレビュー文脈の歴史的記録です。「ChatGPT remains responsible for accepting/deferring/rejecting」を含む前提は現在無効です。現行の運用ルールは [`AGENTS.md`](../AGENTS.md)、現行タスクは [`TASKS_BACKLOG.md`](../TASKS_BACKLOG.md)、経緯は [`DECISION_LOG.md`](DECISION_LOG.md) の 2026-06-13 決定を参照してください。本文は凍結保存しています。

## Status

This file was prepared by Codex from local repository inspection for ChatGPT and a future Claude Code review. It may contain inferences.

Confirmed facts:

- This checkout is a Git repository at `D:\Agent\Codex\Projects\012_x-true-block-mute`.
- The current branch during inspection was `feat/popup-japanese-guidance`.
- `git status --short` and `git diff --stat` produced no output before these review documents were created.
- The repository contains a Chrome Manifest V3 extension scaffold with popup, storage, content script, background service worker, F1-A research code, fixtures, and Node-based verification scripts.

Inferred assumptions:

- The project is intended to reduce information exposure from X/Twitter accounts that the user has blocked or muted.
- The current implementation is still research/prototype stage and not production-ready for real block/mute list synchronization.
- Claude Code should review the repository as an independent reviewer, while ChatGPT remains responsible for accepting, deferring, or rejecting review findings.

## Project summary

`x-true-block-mute` appears to be a Chrome MV3 extension project for X/Twitter. The current repo supports a local/synthetic Phase 1 flow that can hide or replace timeline-like cards matching stored synthetic entries, plus a Phase 1.5 F1-A research scaffold that investigates whether X settings-page internal responses can be safely summarized without saving raw account data.

The repository is deliberately narrow about permissions and data handling. Existing docs and tests repeatedly state that OAuth, X API access, Cookie/CSRF/token capture, raw response storage, and production F1 synchronization are out of scope for the current phase.

## Repository identity

- Repository/folder name: `012_x-true-block-mute` / `x-true-block-mute`
- Current branch: `feat/popup-japanese-guidance`
- Remote: `origin` points to `https://github.com/h8nc4y/x-true-block-mute.git`
- Working tree before these docs: no uncommitted changes were reported by `git status --short`
- Important top-level directories:
  - `src/`: extension source code
  - `tests/`: local fixtures and Node verification scripts
  - `docs/`: manual verification, research, and decision documentation
  - `.codegraph/`: local CodeGraph index, ignored by Git
  - `tmp/`: local ignored temporary workspace
- Important config files:
  - `manifest.json`: Chrome MV3 extension manifest
  - `.gitignore`: ignores logs, temp/build/dependency outputs, `.codegraph/`, and local secrets/data paths
  - `AGENTS.md`: repo-local Codex operating and safety rules

## Intended goal

Confirmed goal from `README.md`: create a Chrome extension that aims to reduce exposure to information from blocked or muted X/Twitter accounts.

Inferred near-term goal: keep building through small research phases, with synthetic fixture validation first, then decide whether F1-A can become a Phase 2 source for block/mute list synchronization.

Uncertain or deferred goals:

- Whether Phase 2 should use F1-A, F1-B, F1-D, or another source path.
- Whether the project will target Chrome Web Store publication.
- Whether the extension should ever connect to X API/OAuth; current docs keep this out of scope.

## Target users

Confirmed or likely operators:

- The project owner/developer running the extension locally in Chrome.
- ChatGPT and Codex, coordinating implementation and review triage.
- Claude Code, acting later as an independent reviewer.

Inferred target users if the product matures:

- Non-programmer users in Japan who want clearer behavior around blocked/muted X accounts.
- Reviewers who need plain Japanese explanations of permissions, data boundaries, and manual verification steps.

## Primary use cases

- Load the unpacked MV3 extension in Chrome for local/manual verification.
- Use the popup to toggle the normal filter, choose display mode, and seed/clear synthetic local test data.
- Verify synthetic timeline filtering with `tests/fixtures/home-timeline.html`.
- Enable F1-A research mode for a human-run logged-in X settings-page observation.
- Copy only a masked summary from the popup for later evaluation.
- Evaluate masked summaries using local Node scripts.
- Preserve AI review context across ChatGPT, Claude Code, and Codex.

## Non-goals

Current non-goals supported by repository evidence:

- Do not implement production block/mute list sync in the current research scope.
- Do not save raw X responses, HAR files, screenshots, Cookies, CSRF tokens, OAuth tokens, raw user IDs, raw handles, display names, or post text.
- Do not add `webRequest`, `cookies`, `tabs`, `activeTab`, `<all_urls>`, or `https://api.x.com/*`.
- Do not implement F1-B, F1-C, or F1-D production flows in the current scope.
- Do not treat fixture results as live X evidence.

Unclear:

- Long-term non-goals for distribution, monetization, supported browsers, and Chrome Web Store review strategy are not yet fully documented.

## Current implementation status

Implemented or likely implemented:

- MV3 `manifest.json` with `storage` and `scripting` permissions.
- Host permissions limited to `https://x.com/*` and `https://twitter.com/*`.
- Popup UI files under `src/popup/`.
- Shared constants and storage wrapper under `src/shared/` and `src/storage/`.
- Normal content script with MutationObserver-based card processing for synthetic data attributes and handle extraction.
- Separate F1-A research storage key `xtbmF1AResearch`.
- Research background service worker that can inject a MAIN-world hook through `chrome.scripting.executeScript`.
- F1-A content bridge and MAIN-world hook scaffold.
- Local fixtures and Node verification scripts.
- Manual popup verification doc, F1-A research doc, and F1 source decision doc.

Partially implemented:

- F1-A feasibility path: scaffold, sanitizer/evaluator, and docs exist, but live X endpoint/shape/pagination/timing are not confirmed.
- Popup research UI: present for masked observations, but its real-X usefulness depends on human verification.
- Validation: static and simulator scripts exist; no package manager config or CI workflow was found during inspection.

Missing or unclear:

- No `package.json`, lockfile, lint config, typecheck config, build config, or CI workflow was found.
- No production-ready list synchronization path is implemented.
- No real X logged-in verification result is recorded in repository docs.
- No Chrome Web Store publication package or review narrative was found.

Broken or risky, if evidence exists:

- README/AGENTS docs state live Chrome UI load and real X F1-A behavior are unconfirmed.
- F1-A depends on private X page internals and MAIN-world network hook behavior, which are likely brittle and review-sensitive.
- Rendered browser verification was not run while creating this brief; current repo docs require UI checks to be reported honestly when performed.

## Architecture overview

Major components:

- `manifest.json`: declares MV3 metadata, popup, background service worker, and two content-script entries.
- Popup layer: `src/popup/popup.html`, `src/popup/popup.css`, and `src/popup/popup.js` present Japanese UI for normal filter settings, local synthetic test data, and F1-A research notes.
- Shared namespace: source files attach to `globalThis.XTrueBlockMute` rather than using an npm bundler.
- Storage layer: `src/storage/storage.js` normalizes settings, synthetic entries, and F1-A research observations, using `chrome.storage.sync` and `chrome.storage.local`.
- Normal filter content script: `src/content/content-script.js` watches timeline-like cards, matches against `data-user-id`, `data-handle`, or link-derived handles, and applies hidden/placeholder/off behavior.
- F1-A research path:
  - `src/research/f1-a/content-bridge.js` runs on blocked/muted settings pages at `document_start`.
  - `src/background/research-background.js` injects `src/research/f1-a/main-world-hook.js` into the MAIN world.
  - `src/research/f1-a/main-world-hook.js` wraps `window.fetch` and `XMLHttpRequest.prototype.open` for sanitized structural observations.
  - `src/research/f1-a/observation-utils.js` normalizes, redacts, summarizes, and evaluates observations.
- Tests/fixtures:
  - `tests/fixtures/home-timeline.html` supports local synthetic UI filtering checks.
  - `tests/fixtures/f1-a-local-simulator.html` and `f1-a-masked-summary.fixture.json` support F1-A local validation.
  - `tests/scripts/*.mjs` provide static, safety, simulator, evaluator, and operational alignment checks.

Data flow:

1. Popup writes settings to `xtbmSettings` and synthetic entries to `xtbmEntries`.
2. Normal content script reads settings and entries, watches DOM changes, and hides/replaces matching cards.
3. Popup can enable F1-A research in `xtbmF1AResearch`.
4. F1-A bridge requests MAIN-world injection only on blocked/muted settings pages.
5. MAIN-world hook emits sanitized observations through `window.postMessage`.
6. Bridge appends normalized observations to `xtbmF1AResearch`.
7. Popup exports a masked summary for local evaluation.

External integrations:

- Browser extension APIs: `chrome.storage`, `chrome.scripting`, MV3 background service worker, content scripts.
- Target sites by host permission: `x.com` and `twitter.com`.
- No database, backend service, cloud deployment, OAuth, or paid external API was found.

## Tech stack

- Language: JavaScript
- Runtime/tooling: Chrome Manifest V3 extension APIs; Node.js for verification scripts
- UI: plain HTML/CSS/JavaScript popup
- Storage: `chrome.storage.sync` and `chrome.storage.local`
- Testing/validation: local Node `.mjs` scripts, Node `vm`, synthetic HTML/JSON fixtures
- Deployment target: local unpacked Chrome extension; no package/deployment config found
- Repository tooling: Git, CodeGraph local index

## Important files and directories

- `README.md`: phase scope, local load steps, permissions, storage schema, validation commands, known unknowns.
- `AGENTS.md`: repo-local safety and autonomy constraints, including data-handling and permission boundaries.
- `manifest.json`: MV3 permissions, target matches, popup/background/content script registration.
- `.gitignore`: confirms docs are not ignored while secrets, temp data, dependencies, and `.codegraph/` are ignored.
- `src/shared/constants.js`: storage keys, display modes, schema version, synthetic entries.
- `src/storage/storage.js`: settings, entry store, synthetic seed/clear, and F1-A research storage API.
- `src/content/content-script.js`: normal DOM filtering behavior.
- `src/popup/`: Japanese popup UI and controls.
- `src/background/research-background.js`: F1-A MAIN-world hook injection path.
- `src/research/f1-a/`: F1-A bridge, hook, and observation utilities.
- `tests/scripts/verify-phase1-static.mjs`: static checks for manifest, permissions, required files, and research boundaries.
- `tests/scripts/verify-f1a-observation-safety.mjs`: sanitizer/evaluator safety checks.
- `tests/scripts/verify-f1a-main-hook-simulator.mjs`: local fetch/XHR hook simulator.
- `tests/scripts/evaluate-f1-observation.mjs`: masked summary evaluator.
- `tests/scripts/audit-operational-alignment.mjs`: repo/global operations alignment check.
- `docs/manual-popup-verification.md`: plain Japanese manual popup verification flow and data-sharing boundaries.
- `docs/research/f1-a-main-world-hook.md`: F1-A research design, unconfirmed live observations, and manual verification template.
- `docs/decisions/f1-source-selection.md`: F1-A/F1-B/F1-C/F1-D decision criteria and defer decision.

## Validation commands

Install:

- No install command was found. No `package.json` or lockfile was found during inspection.

Lint:

- No lint command or lint config was found.

Typecheck:

- No typecheck command or TypeScript config was found.

Test / static validation:

```powershell
node tests/scripts/verify-phase1-static.mjs
node tests/scripts/verify-f1a-observation-safety.mjs
node tests/scripts/verify-f1a-main-hook-simulator.mjs
node tests/scripts/evaluate-f1-observation.mjs tests/fixtures/f1-a-masked-summary.fixture.json
node tests/scripts/audit-operational-alignment.mjs
```

Build:

- No build command was found.

Dev server:

- No dev server command was found. The README documents loading the extension manually through Chrome `Load unpacked`.

Note: this brief lists commands supported by repository evidence. It does not claim those commands were run as part of creating this file.

## Known risks and review focus

Requirement ambiguity:

- Phase boundaries are documented, but the exact MVP for production usefulness is still undecided.
- F1-A/F1-B/F1-D selection remains deferred.

Architecture risk:

- Global namespace script loading must stay ordered correctly in MV3 content scripts and popup.
- MAIN-world injection crosses a sensitive browser-extension boundary.
- F1-A relies on private X internals and may be fragile.

Security/privacy risk:

- The project must keep raw X response data, tokens, Cookies, account IDs, handles, display names, and post text out of storage, logs, docs, fixtures, and commits.
- `scripting` permission and MAIN-world network wrapping need careful justification and user-visible boundaries.

Data handling:

- Claude should inspect whether sanitizer/evaluator code actually prevents raw-looking values from being persisted or exported.
- Confirm `xtbmF1AResearch` remains separate from `xtbmEntries`.

Auth/permissions:

- Confirm no forbidden permissions or broad hosts were added.
- Confirm no OAuth/API/token flow is hidden in source or docs.

Testing gaps:

- No CI workflow was found.
- Validation relies on local Node scripts and fixtures.
- Live X behavior remains unconfirmed by design.

UX/UI issues:

- Popup is Japanese-first and aimed at non-programmers; review copy clarity, disabled states, and safe wording.
- Rendered Chrome popup verification is currently documented but not proven in this brief.

Deployment/config risk:

- No release packaging or Chrome Web Store submission config was found.
- `.gitignore` blocks local secret/data paths, but Claude should still audit for accidental sensitive artifacts.

AI-generated-code risk:

- The repo is being developed through ChatGPT/Codex and will be reviewed by Claude. Review should focus on evidence-backed findings and avoid turning inferred future scope into immediate implementation requirements.

## Questions for ChatGPT before Claude review

- Should Claude review the whole repository or only the diff since a specific branch/commit?
- Is `feat/popup-japanese-guidance` the intended branch for review?
- Should Claude focus on security/privacy first, product requirements first, or implementation correctness first?
- Should Claude treat Phase 2 source selection as out of scope unless it affects current safety?
- Are live X manual verification results available, or should Claude assume live behavior is still `未確認`?
- Should Claude flag lack of CI/package scripts as MVP-blocking or as later project hygiene?
- Should Claude inspect for accidental secrets/config data before reviewing code quality?

## Questions for Claude reviewer

- Do the current manifest permissions match the stated Phase 1.5 scope?
- Can any raw X value, token, handle, user ID, display name, body text, HAR, screenshot, or credential-like value reach storage, clipboard, docs, fixtures, logs, or console output?
- Is the F1-A MAIN-world hook idempotent and limited enough for research-only use?
- Are popup controls and Japanese labels clear for non-programmer operators?
- Are storage schema normalization and fallback behavior robust against malformed values?
- Does `content-script.js` avoid unintended profile/link matching or false positives in synthetic and likely real DOM contexts?
- Are the local verification scripts meaningful, deterministic, and aligned with README/AGENTS constraints?
- What should be treated as an approved bug/risk now versus a future Phase 2 decision?

## Source evidence

- `README.md`: project purpose, phase scope, permissions, storage schema, validation commands, known unknowns, and operation notes.
- `AGENTS.md`: repository safety rules, data-handling restrictions, phase boundaries, and non-interactive operation constraints.
- `manifest.json`: MV3 registration, permissions, hosts, content scripts, popup, and background service worker.
- `.gitignore`: ignored temp/build/dependency/secret paths and confirmation that requested docs are not ignored.
- `src/shared/constants.js`: storage keys, display modes, schema version, synthetic entries.
- `src/storage/storage.js`: storage APIs and separation of settings, entries, and F1-A research state.
- `src/content/content-script.js`: synthetic fixture-oriented DOM filtering behavior.
- `src/popup/popup.js`, `src/popup/popup.html`, `src/popup/popup.css`: popup UI controls, copy flow, and Japanese wording.
- `src/background/research-background.js`: research-only MAIN-world injection path.
- `src/research/f1-a/content-bridge.js`: settings-page bridge from page messages to storage.
- `src/research/f1-a/main-world-hook.js`: fetch/XHR wrapping and sanitized observation emission.
- `src/research/f1-a/observation-utils.js`: observation normalization, unsafe summary detection, export summary, and evaluator logic.
- `tests/scripts/*.mjs`: static, safety, simulator, evaluator, and operational alignment checks.
- `tests/fixtures/*`: synthetic timeline and F1-A masked summary fixtures.
- `docs/manual-popup-verification.md`: manual popup verification and safe/unsafe reporting guidance.
- `docs/research/f1-a-main-world-hook.md`: F1-A research scope, local verification, manual verification template, known unknowns.
- `docs/decisions/f1-source-selection.md`: deferred F1 source decision and fallback criteria.
- Git commands: repository root, branch, remote, recent commits, status, and diff state.
- CodeGraph: local index reported 13 JavaScript files, 120 nodes, and 207 edges.
