# ClaudeCode 司令塔 引き継ぎ — x-true-block-mute (post-Fable5)

本書は **2026-07-08 以降、または Fable5 の利用上限到達後**に有効な引き継ぎ文書。
旧 `docs/CLAUDECODE_FABLE5_HANDOFF.md` / `docs/CLAUDECODE_FABLE5_PROMPT.md` は
削除せず履歴として保持する。読み替え: 「Fable5」→「司令塔モデル」。
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

v1.1.1 として production sync・real-DOM author matching・reconciliation・packaging・store 提出資料まで
実装済み。**Chrome Web Store 審査結果待ち**が主残タスク。詳細な検証状況（M2〜M7 の実施内容、実アカウント
件数確認など）は `README.md` の「検証状況」節、既知の問題・レビュー指摘は `docs/review-2026-07-05.md` /
`docs/deferred-findings-register.md` を参照。

## 主要ファイル（reading order）

1. `AGENTS.md` — Codex 側運用ポリシー（Claude Code とルール共有元、不変条件）
2. `CODEX_HANDOFF.md` — 現況メモ、§11 残タスク
3. `TASKS_BACKLOG.md` — タスク一覧
4. `README.md` — repo概要、検証状況、manifest 権限、storage schema
5. `docs/privacy-threat-model.md` — プライバシー脅威モデル
6. `docs/phase2-readiness-gates.md` — Phase 2 gate
7. `docs/review-2026-07-05.md` — 直近レビュー結果
8. `docs/deferred-findings-register.md` — 先送り事項register
9. `manifest.json` — 現行権限の実体確認

## 次アクション候補

1. **クリティカルパス**: Chrome Web Store 審査結果の確認。承認済みなら公開後の実ユーザーフィードバック対応、
   却下なら理由別修正（manifest 権限・プライバシーポリシー文言・store-listing 記載などを再点検）。
2. 審査中の zip が現行 v1.1.1 と一致するかの確認（未確認事項として README に明記済み）。
3. `docs/deferred-findings-register.md` に残る先送り事項の優先度再評価。
4. Chrome / Manifest V3 の仕様変更（権限ポリシー、レビューガイドライン更新）を
   `modern-web-guidance` 等で再確認し、影響があれば `docs/privacy-threat-model.md` を更新。
5. 実 X DOM 構造の変化（author matching・quote/embed 分離ロジック）を定期的に synthetic fixture と
   実データで再検証する運用が必要か検討。

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

履歴はこちら: [`docs/CLAUDECODE_FABLE5_HANDOFF.md`](./CLAUDECODE_FABLE5_HANDOFF.md) /
[`docs/CLAUDECODE_FABLE5_PROMPT.md`](./CLAUDECODE_FABLE5_PROMPT.md)
