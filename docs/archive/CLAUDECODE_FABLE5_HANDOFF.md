> 🗄 **履歴資料（2026-07-12 アーカイブ）**: `docs/CLAUDECODE_HANDOFF.md` に置き換え済み。現状把握には使わないこと。

# ClaudeCode Fable5 handoff - 012_x-true-block-mute

作成日時: 2026/07/02 08:30:54 JST  
配置: repo-local draft。公開・commit・PR化する前に、private context とローカル絶対パスが残っていないか確認すること。

## 調査範囲と注意

- 根拠は local git 状態、repo 内 README/HANDOFF/TASKS/docs、読み取り専用 subagent 調査。
- 外部API、GitHub live、CI、ブラウザ、テスト、Cloudflare、Chrome Web Store、Discord、Google、Anthropic、YouTube、X API は今回未確認。
- `*.p12`、`*.pem`、`*.pfx`、`.env*`、`auth.json` は読んでいない。
- raw log、cache、DB、state、queue、drafts、実データの中身は読んでいない。
- 既存のWeb調査/判断資材は repo 内資料の path map であり、Fable5 側で最新市場調査・最新仕様確認をやり直すこと。

## Repo handoff

## 012_x-true-block-mute

- 状態: `<repo-root>`; branch `docs/sync-check-all-handoff-state`; clean; latest `332a33b docs: sync check-all harness handoff state`
- 目的: X向けChrome拡張 TrueBlock & Mute。ブロック/ミュート済みアカウント由来の露出をローカルで減らす。
- 要件定義/要件相当: `TASKS_BACKLOG.md`, `CODEX_HANDOFF.md`, `README.md`
- Web調査/判断資材: `docs/research/f1-a-main-world-hook.md`, `docs/decisions/f1-source-selection.md`, `docs/phase2-readiness-gates.md`, `docs/store-listing.md`
- 設計書/UI: `CODEX_HANDOFF.md`, `docs/privacy-threat-model.md`, `docs/phase2-readiness-gates.md`, `docs/local-chrome-synthetic-verification.md`
- 完成までのタスク一覧: `TASKS_BACKLOG.md`, `CODEX_HANDOFF.md` §11, `docs/deferred-findings-register.md`
- 進捗: v1.1.1、production sync/filtering/package/store docs はほぼ完了。
- 残タスク/gate: Chrome Web Store 審査結果、実X再検証、workflow/release/tag、アップロード/再提出/公開、manifest権限変更、新データソース、OAuth/API、paid。
- Fable5 reading order: `AGENTS.md` → `CODEX_HANDOFF.md` → `TASKS_BACKLOG.md` → `docs/privacy-threat-model.md` → `docs/phase2-readiness-gates.md` → `manifest.json`
- Prompt addendum: UIあり。拡張popup/設定/警告の必要性を再検討する。raw block/mute 値、user_id、handle は端末内限定で docs/log/PR に出さない。

## Fable5 next action

1. `docs/CLAUDECODE_FABLE5_PROMPT.md` を読み、Fable5 の作業方針を確認する。
2. 上記の reading order に従って repo の正本資料を読む。
3. 既存要件をそのまま前提にせず、ユーザーへの質問から目的・市場・成功指標・非目標を再定義する。
4. UI が存在する repo では ClaudeDesign で wireframe または UI spec を作ってから実装へ進む。
5. 実装は Codex GPT5.5 XHIGH skill に依頼してよいが、Fable5 が受け入れ条件・対象ファイル・検証コマンド・gate を具体化してから渡す。