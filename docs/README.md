# docs 索引

現行資料の分類索引です。エージェント・人間ともに、まずここから目的の資料へ辿ってください。歴史的スナップショットは [`docs/archive/`](./archive/README.md) に分離しています。

## ガバナンス・引き継ぎ（リポジトリ root）

| ファイル | 役割 |
| --- | --- |
| `../AGENTS.md` | 全エージェント共通の不変条件（データ保護・権限最小化・報告規律）。最優先 |
| `../CODEX_HANDOFF.md` | Codex（自律主開発者）の引き継ぎ正本。現状・自走ループ・4ゲート・次の一手 |
| `../TASKS_BACKLOG.md` | タスクトラッカー（P2 系列は全完了。変更履歴の要約付き） |
| `../README.md` | 製品概要・検証コマンド・storage schema・公開状態 |
| `CLAUDECODE_HANDOFF.md` | Claude Code 引き継ぎ（互換名。冒頭に固定分掌廃止の注記あり） |

## 要件・市場・運用（公開後フェーズの主資料）

| ファイル | 役割 |
| --- | --- |
| `requirements-v2-2026-07.md` | 要件定義書 v2。価値仮説・成功指標・非目標・v1.2 候補仕様・オーナー確認質問 |
| `research/market-2026-07.md` | 市場・競合・CWS 審査動向の調査メモ（2026-07 時点） |
| `review-response-playbook.md` | 審査対応テンプレ・却下理由別対応表・公開後運用 runbook（不具合報告→修正リリース） |
| `store-listing.md` | ストア掲載文・permissions justification・データ使用フォーム回答 |
| `privacy-policy.md` / `privacy-policy.html` | プライバシーポリシー（日英併記・ホスティング用 HTML） |

## プライバシー・検証・設計判断（機械検査対象を含む）

以下は検証ハーネス（`verify-docs-consistency.mjs` / `audit-operational-alignment.mjs`）が語彙・整合を監視する資料です。**編集後は必ず `node scripts/check-all.mjs` を再実行**してください。

| ファイル | 役割 |
| --- | --- |
| `privacy-threat-model.md` | プライバシー脅威モデル（raw 値の境界・禁止権限） |
| `deferred-findings-register.md` | 保留・解決済み所見の台帳（CL-AUDIT / PHASE2 系 ID） |
| `phase2-readiness-gates.md` | Phase 2 移行時のゲート定義（f1a_viable 判定等・履歴込み） |
| `decisions/f1-source-selection.md` | データソース選定（F1-A primary）の決定記録 |
| `research/f1-a-main-world-hook.md` | F1-A MAIN-world hook の調査記録・資格情報境界 |
| `manual-popup-verification.md` | popup の手動確認手順（非エンジニア向け） |
| `local-chrome-synthetic-verification.md` | ローカル Chromium での synthetic 検証手順 |
