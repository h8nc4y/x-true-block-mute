# ClaudeCode 司令塔 引き継ぎ — x-true-block-mute (post-Fable5)

本書は **2026-07-08 以降、または Fable5 の利用上限到達後**に有効な引き継ぎ文書。
旧 Fable5 版は `docs/archive/`（`CLAUDECODE_FABLE5_HANDOFF.md` / `CLAUDECODE_FABLE5_PROMPT.md`）に
履歴として保持する。読み替え: 「Fable5」→「司令塔モデル」。
テンプレ正本は codex-global-context repo の `templates/agent-handoff-prompt.md`。

## 役割分担（モデル固定名を使わない）

- **司令塔**: Claude Opus 4.8 role。要件再定義・設計判断・レビュー・実装委譲文作成を担当。
- **実装**: `mcp__codex__codex`（通常タスク）/ `mcp__codex-deep__codex`（難所のみ、xhigh）。
- **並列調査・機械的作業**: Sonnet 5 subagent（Agent tool 経由）。
- **フロントエンド/UI**: `frontend-developer` subagent。本 repo は Chrome 拡張 popup / options UI を持つため、
  UI 文言・レイアウト変更が必要な場合はここへ委譲する。

固定モデル名（Fable5 等）をゴールや運用ルールの恒常記述に使わない。役割名で書くこと。

## 調査範囲と注意（引き継ぎ時点の限界）

- 根拠は local git 状態、repo 内 README / AGENTS.md / CODEX_HANDOFF.md / TASKS_BACKLOG.md / docs、
  読み取り専用の把握のみ。
- 外部API、GitHub Actions 実行、CI、Chrome Web Store 審査キュー、実 X 挙動は本書作成時点で未確認。
- `*.p12`、`*.pem`、`*.pfx`、`.env*`、`auth.json`、raw block/mute データ、実 user_id/handle、
  実アカウントのスクリーンショットや本文は読んでいない・書いていない。
- 既存資料は現状把握の材料であり、要件定義の最終正本ではない。市場・仕様（Chrome Web Store ポリシー等）は
  陳腐化を疑って再確認すること。

## プロジェクト概要

X（旧Twitter）向け Chrome 拡張。ユーザー自身のブロック・ミュート一覧に由来するアカウントの投稿・引用・
埋め込みをローカルでフィルタする。データは端末内 `chrome.storage.local` / `chrome.storage.sync` のみに
保存し、外部送信なし。権限は `storage` と `x.com` / `twitter.com` の `host_permissions` のみ（`scripting`
は M7 で retire 済み）。

## 現在地

v1.1.1 として production sync・real-DOM author matching・reconciliation・packaging まで実装済みで、
**Chrome Web Store で公開済み**（2026-06-18 公開・2026-07-06 オーナー確認）。フェーズは公開後運用。
詳細な検証状況（M2〜M7 の実施内容、実アカウント件数確認など）は `README.md` の「検証状況」節、
所見の解決状況は `docs/deferred-findings-register.md`、過去レビューの判断記録は
`docs/archive/review-2026-07-05.md` を参照。

## 主要ファイル（reading order）

1. `AGENTS.md` — Codex 側運用ポリシー（Claude Code とルール共有元、不変条件）
2. `CODEX_HANDOFF.md` — 現況メモ、§11 残タスク
3. `TASKS_BACKLOG.md` — タスク一覧
4. `README.md` — repo概要、検証状況、manifest 権限、storage schema
5. `docs/README.md` — docs 索引（現行資料と `docs/archive/` の分離）
6. `docs/requirements-v2-2026-07.md` — 要件定義書 v2（オーナー確認質問含む）
7. `docs/review-response-playbook.md` — 公開後運用 runbook
8. `docs/privacy-threat-model.md` — プライバシー脅威モデル
9. `docs/deferred-findings-register.md` — 所見台帳（解決状況の正）
10. `manifest.json` — 現行権限の実体確認

## 次アクション候補

1. **公開後運用**: 不具合報告への対応（`docs/review-response-playbook.md` §3 のフロー。一次判断 48h・
   修正版作成 14 日）。報告から raw handle / user_id / スクショは受け取らない。
2. オーナー未回答質問（`docs/requirements-v2-2026-07.md` §7 の Q3〜Q7）の回答が来たら、要件確定・
   v1.2 タスク起票・掲載文言改善に反映。回答前に v1.2（警告 UI 等）へ着手しない（§9④ ゲート）。
3. Chrome / Manifest V3 の仕様変更（権限ポリシー、レビューガイドライン更新）を
   `modern-web-guidance` 等で再確認し、影響があれば `docs/privacy-threat-model.md` を更新。
4. 実 X DOM 構造の変化（author matching・quote/embed 分離ロジック）の検知はオーナーの日常利用が
   一次センサー（playbook §3）。破損報告が来たら synthetic fixture 化して回帰に追加。

## Stop only when（費用・外部リスクの境界）

有料API/有料クラウド/課金、OAuth/secret/token入力、実ユーザー/実データの外部送信、Chrome Web Store への
再提出・公開判断、または人間の意思決定なしには進めない product 判断が必要なときだけ止まる。実 X 環境での
検証や masked observation 収集は、既存のユーザー承認範囲（設定ページ限定・password/MFA/Cookie/token を
受け取らない）を超える場合は必ず止まる。

## 委譲時の注意

Codex へ委譲する際は self-contained spec（対象ファイル・受け入れ条件・検証コマンド・書き込み許可範囲）を
渡し、`multi-agent-delegation` skill の規律（再委譲禁止文言・成果物の実在検証）に従う。本 repo は
**public** のため、委譲プロンプト・レビュー・PR本文のいずれにもローカル絶対パス、実 user_id/handle、
実アカウントの内容を含めない。UI 変更を伴う委譲は `frontend-developer` subagent 経由とし、Japanese-first UI
・アクセシビリティ・レスポンシブ確認を経てから完了とする。

---

履歴はこちら: [`docs/archive/CLAUDECODE_FABLE5_HANDOFF.md`](./archive/CLAUDECODE_FABLE5_HANDOFF.md) /
[`docs/archive/CLAUDECODE_FABLE5_PROMPT.md`](./archive/CLAUDECODE_FABLE5_PROMPT.md)
