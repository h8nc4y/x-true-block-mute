# 開発引き継ぎ — x-true-block-mute

> **2026-07-11 方針更新**: 開発領域の固定分掌は廃止済み。このファイル名は既存リンクとの
> 互換性のため残す。開発の主軸は Codex で、依頼範囲を end-to-end で担当する。
> 廃止済みの `codex` / `codex-deep` MCP bridge と `agmsg` は復活させない。

## 開発体制

- Codex が要件整理、Chrome拡張UI、実装、検証、文書化までを一貫して進める。
- Claude Code、subagent、外部レビューは必要時の実行手段であり、固定担当ではない。

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

委譲する場合は self-contained spec（対象ファイル・受け入れ条件・検証コマンド・書き込み許可範囲）を
渡し、成果物の実在と検証結果を主担当が確認する。本 repo は **public** のため、委譲プロンプト、レビュー、
PR本文にローカル絶対パス、実 user_id/handle、実アカウントの内容を含めない。UIは固定の委譲先を設けず、
Japanese-first UI・アクセシビリティ・レスポンシブ確認まで主担当が完遂する。

## 履歴資料への参照

旧 Fable5 期の引き継ぎ文書は [`docs/archive/CLAUDECODE_FABLE5_HANDOFF.md`](./archive/CLAUDECODE_FABLE5_HANDOFF.md) /
[`docs/archive/CLAUDECODE_FABLE5_PROMPT.md`](./archive/CLAUDECODE_FABLE5_PROMPT.md) に凍結保持（現在の指示ではない）。
