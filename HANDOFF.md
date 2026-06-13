# HANDOFF

最終更新: 2026-06-12

> **2026-06-13 追記**: Codex から Claude Code への引き継ぎが完了しました。ガバナンスは「ユーザー本人がチャットで直接承認 → Claude Code が実装」へ変更され、ChatGPT 承認制は廃止されました（経緯は [`docs/DECISION_LOG.md`](docs/DECISION_LOG.md) の 2026-06-13 決定）。最終目的は Chrome Web Store での一般配布です。現行タスクは [`TASKS_BACKLOG.md`](TASKS_BACKLOG.md)、運用ルールは [`AGENTS.md`](AGENTS.md) を参照してください。以下の本文は引き継ぎ時点の歴史的記録です（「次にやるべき候補」は 2026-06-13 のロードマップ M1〜M7 に置き換わりました）。

## 目的

この repository は、X/Twitter でブロック・ミュート済みアカウント由来の情報露出を減らすことを目指す Chrome Manifest V3 拡張です。現時点では Phase 1 / Phase 1.5 の research / prototype 段階です。

Phase 1 は popup、storage、synthetic fixture、通常 content script filter path を扱います。Phase 1.5 は `/settings/blocked/all` と `/settings/muted/all` で masked observation を集める F1-A research scaffold を扱います。

## 現状サマリ

- default branch は `main`。closeout 開始時点で `main...origin/main`、未コミット差分なしでした。
- `TASKS_BACKLOG.md` には doing が残っていません。
- `docs/CODEX_TASKS.md` の COD / MAINT / VERIFY / GATE queue は実装済みとして記録されています。
- `TASKS_BACKLOG.md` では実装可能な local task は done、human / live X / OAuth / future approval が必要な項目は理由付き skip です。
- GitHub open issues は `[]` でした。
- live X、Chrome Load unpacked human confirmation、F1-A live endpoint、real DOM author matching は未確認です。
- `webRequest`、`cookies`、`tabs`、`activeTab`、`<all_urls>`、`https://api.x.com/*` は現在 scope 外です。
- closeout では新機能実装、依存追加、リファクタ、データ削除は行っていません。

## 完了タスクと commit

| commit | 内容 |
| --- | --- |
| `ff9b124` | MV3 extension skeleton 初期化。 |
| `d5b6aa5` | Codex operations と GitHub auth diagnostics の整備。 |
| `4dbe9cc` | repo operating policy の整合。 |
| `68297f4` | 日本語 popup guidance の改善。 |
| `6c62387` | maintenance findings 向け static guards 追加。 |
| `8404656` | local Chrome synthetic verification docs 追加。 |
| `3df7aa1` | Phase 2 readiness gates 定義。 |
| `0665230` | `TASKS_BACKLOG.md` 追加、残タスク棚卸し。 |

この `HANDOFF.md` と 2026-06-12 closeout 時点の `TASKS_BACKLOG.md` 更新を含む commit は、push 後に `git log -1 -- HANDOFF.md TASKS_BACKLOG.md` で確認してください。

## 未完了 / skip タスク

| ID | 状態 | 理由 |
| --- | --- | --- |
| `TB-002` | skip | Chrome Load unpacked と popup は人間確認が必要。Codex 自動化では拡張 popup を安定確認済みにできていません。 |
| `TB-003` | skip | F1-A live masked summary 評価には real X login または user-supplied safe masked summary と ChatGPT approval が必要です。Codex は live X data を収集・保存しません。 |
| `TB-004` | skip | Phase 2 source selection と production F1-A / F1-B / F1-D / real-DOM matching は deferred / out of scope です。 |
| `TB-005` | skip | F1-C X API / OAuth は OAuth、token policy、pricing、外部 API 承認が必要です。 |
| `TB-006` | skip | Chrome Web Store / package / CI は distribution decision と approved CI/package scope が必要です。 |

## 既知の問題・残懸念

- Chrome UI の `Load unpacked` 手動確認は未確認です。
- 実 X DOM から安定して `user_id` を取得できるかは未確認です。
- 実 X 画面での F1-A endpoint、response shape、pagination、injection timing、SPA navigation 維持は未確認です。
- `tests/scripts/evaluate-f1-observation.mjs` の `fixture_pass` は synthetic fixture evidence であり、F1-A live viability ではありません。
- local stale branches が4本あります。差分は現在の `main` に対して大量削除方向で、historical branch と判断しています。merge / delete はしていません。

## 検証結果

2026-06-12 closeout 時点:

| command | result |
| --- | --- |
| `node tests/scripts/verify-phase1-static.mjs` | `Phase 1.5 static verification passed` |
| `node tests/scripts/verify-f1a-observation-safety.mjs` | `F1-A observation safety verification passed` |
| `node tests/scripts/verify-f1a-main-hook-simulator.mjs` | `F1-A MAIN world hook simulator verification passed` |
| `node tests/scripts/verify-docs-consistency.mjs` | `Docs consistency verification passed` |
| `node tests/scripts/evaluate-f1-observation.mjs tests/fixtures/f1-a-masked-summary.fixture.json` | `fixture_pass` |
| `node tests/scripts/audit-operational-alignment.mjs` | `passed`; optional external checks skipped because paths were not provided |
| `git diff --check` | pass |
| `gh issue list --limit 100 --state open --json number,title,labels,url` | `[]` |

## セットアップ・テスト・ビルド

依存 install は不要です。Node.js が使える環境で次を実行します。

```powershell
node tests/scripts/verify-phase1-static.mjs
node tests/scripts/verify-f1a-observation-safety.mjs
node tests/scripts/verify-f1a-main-hook-simulator.mjs
node tests/scripts/verify-docs-consistency.mjs
node tests/scripts/evaluate-f1-observation.mjs tests/fixtures/f1-a-masked-summary.fixture.json
node tests/scripts/audit-operational-alignment.mjs
```

Chrome 手動確認は `docs/manual-popup-verification.md` に従ってください。実 X、Cookie、token、raw response、HAR、個人情報を含む screenshot は使わないでください。

## ブランチ状況

closeout 時点の local branches:

- `main`: default branch。remote `origin/main` と同期対象。
- `backup/feat-popup-guidance-before-readiness-cleanup`: `main` 比で `24 files changed, 45 insertions(+), 3432 deletions(-)`。
- `feature/phase-1-dom-filter-storage-popup`: `main` 比で `37 files changed, 79 insertions(+), 5987 deletions(-)`。
- `research/phase-1-5-f1-a-investigation`: `main` 比で `35 files changed, 370 insertions(+), 5443 deletions(-)`。
- `research/phase-1-6-f1-observation-readiness`: `main` 比で `29 files changed, 137 insertions(+), 4003 deletions(-)`。

これら4本は stale historical branch と判断し、merge / delete / push はしていません。必要なら Claude Code 側で内容確認後に明示的に整理してください。

## 次にやるべき候補

1. `docs/manual-popup-verification.md` に沿って、人間が Chrome Load unpacked と popup を確認する。
2. user-supplied safe masked summary が用意できた場合だけ、`node tests/scripts/evaluate-f1-observation.mjs --live <masked-summary.json>` を実行して F1-A gate を評価する。
3. ChatGPT が Phase 2 source selection / F1-B / F1-D / package-CI のいずれかを明示承認した場合だけ、`docs/AI_REVIEW_TRIAGE.md` と `docs/CODEX_TASKS.md` に approved task として追加してから実装する。
