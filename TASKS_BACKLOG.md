# TASKS_BACKLOG

## Status

最終更新: 2026-06-12

このファイルは、Codex goal「残タスクを棚卸しして優先順に整理し、上位から1件ずつ実装・検証・commitまで自走で完了させる」のための backlog です。

既存の `docs/CODEX_TASKS.md` は ChatGPT-approved task queue 専用の source of truth です。そこには未承認・deferred・human blocker を混ぜないため、この goal 固有の棚卸し結果は本ファイルに分離します。

## Inventory sources

| 情報源 | 結果 |
| --- | --- |
| `docs/CODEX_TASKS.md` | COD / MAINT / VERIFY / GATE queue はすべて implemented と記録済み。 |
| `README.md` / `docs/` | Phase 2、live X、production sync、F1-B/F1-C/F1-D、Chrome Web Store などは未実装または未確認。ただし現行 docs では deferred / out of scope / human confirmation required。 |
| `AGENTS.md` | real X login、raw X response、OAuth、Cookie、tokens、追加権限、production F1 sync は現在 scope 外。 |
| code `TODO` / `FIXME` | `rg -n "TODO|FIXME" README.md docs src tests AGENTS.md manifest.json` は該当なし。 |
| tests / checks | local Node checks は pass。live X / Chrome Load unpacked human check は未確認。 |
| git status | closeout 開始時点で `main...origin/main`、未コミット差分なし。 |
| local branches | `main` に未マージ表示の local branches が4本あるが、diff stat は現在の `main` から大量削除方向の stale historical branch と判断。 |
| GitHub issues | `gh issue list --limit 100 --state open --json number,title,labels,url` は `[]`。 |

## Backlog

| ID | タスク名 | 出典 | 優先度 | 規模 | 状態 |
| --- | --- | --- | --- | --- | --- |
| TB-001 | 残タスク棚卸しと backlog 作成 | user goal / `docs/CODEX_TASKS.md` / README / docs / tests / git / GitHub issues | 高 | S | done |
| TB-002 | Chrome Load unpacked と popup の人間確認 | `README.md` 未確認事項、`docs/phase2-readiness-gates.md`、`docs/manual-popup-verification.md`、`docs/local-chrome-synthetic-verification.md` | 高 | S | skip: Codex 自動化では拡張 popup を安定確認済みにできず、人間 Chrome 確認が必要。local fixture / Node checks は pass。 |
| TB-003 | F1-A live masked summary で endpoint / shape / pagination / injection timing / SPA continuity を評価 | `README.md` 未確認事項、`docs/research/f1-a-main-world-hook.md`、`docs/decisions/f1-source-selection.md` | 高 | L | skip: real X login または user-supplied safe masked summary と ChatGPT approval が必要。Codex は live X data を収集・保存しない。 |
| TB-004 | Phase 2 source selection と production F1-A / F1-B / F1-D / real-DOM matching 実装 | `README.md` 未実装事項、`docs/deferred-findings-register.md`、`docs/phase2-readiness-gates.md` | 中 | L | skip: 明示的に deferred / out of scope。ChatGPT-approved scope と validation packet が必要。 |
| TB-005 | F1-C X API / OAuth 連携の再検討 | `README.md`、`docs/deferred-findings-register.md`、`docs/decisions/f1-source-selection.md` | 低 | L | skip: OAuth、token policy、pricing、外部 API 承認が必要。現在 scope 外。 |
| TB-006 | Chrome Web Store / package / CI / distribution readiness | `docs/deferred-findings-register.md` CL-AUDIT-011、`README.md` 未実装事項 | 低 | M | skip: distribution decision と approved CI/package scope が必要。現在 scope 外。 |
| TB-007 | local stale branches の扱い確認 | `git branch --no-merged main --no-color`、`git diff --stat main..<branch>` | 低 | S | done: 4 branch は stale historical branch と判断。user/local branch 保全のため merge / delete は実施しない。 |
| TB-008 | Claude Code 引き継ぎ用 closeout 文書化 | closeout goal / `HANDOFF.md` | 高 | S | done: `HANDOFF.md` を repo root に作成し、現状・経緯・残課題・検証結果・branch 状況を記録。 |

## Validation evidence

2026-06-11 の棚卸しで実行した local checks:

- `node tests/scripts/verify-phase1-static.mjs` -> pass
- `node tests/scripts/verify-f1a-observation-safety.mjs` -> pass
- `node tests/scripts/verify-f1a-main-hook-simulator.mjs` -> pass
- `node tests/scripts/verify-docs-consistency.mjs` -> pass
- `node tests/scripts/evaluate-f1-observation.mjs tests/fixtures/f1-a-masked-summary.fixture.json` -> `fixture_pass`
- `node tests/scripts/audit-operational-alignment.mjs` -> `passed` with optional external checks skipped because paths were not provided
- `gh issue list --limit 100 --state open --json number,title,labels,url` -> `[]`

2026-06-12 の closeout で実行した local checks:

- `node tests/scripts/verify-phase1-static.mjs` -> pass
- `node tests/scripts/verify-f1a-observation-safety.mjs` -> pass
- `node tests/scripts/verify-f1a-main-hook-simulator.mjs` -> pass
- `node tests/scripts/verify-docs-consistency.mjs` -> pass
- `node tests/scripts/evaluate-f1-observation.mjs tests/fixtures/f1-a-masked-summary.fixture.json` -> `fixture_pass`
- `node tests/scripts/audit-operational-alignment.mjs` -> `passed` with optional external checks skipped because paths were not provided
- `git diff --check` -> pass
- `gh issue list --limit 100 --state open --json number,title,labels,url` -> `[]`

## Done criteria

本 backlog の実装可能な local task は完了済みです。残る項目は human confirmation、live X evidence、OAuth/API、または ChatGPT-approved future scope が必要なため skip として明示しました。
