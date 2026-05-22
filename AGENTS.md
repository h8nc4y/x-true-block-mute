# AGENTS.md

## Project Rules

- ユーザー向け報告は日本語を主にする。
- 秘密情報、OAuth 資格情報、Cookie、実データ、個人データを読まない、記録しない、コミットしない。
- テスト結果、コマンド結果、commit hash、PR URL、デプロイ URL を捏造しない。未確認のものは未確認と書く。
- この repo-local `AGENTS.md` は、グローバルの Codex 運用ルール、Codex config、cost guard rules を前提にした差分ルールとして扱う。
- 人間の X ログイン、masked summary 貼り付け、GitHub issue コメント、PR review、checkpoint、安全確認を開発開始条件にしない。必要なら未確認として記録し、fixture / simulator / evaluator / docs のローカル作業へ戻る。
- 入力待ちループは禁止する。`read`、`pause`、`select`、対話式プロンプト待ち、`tail -f`、`watch`、`while true`、`sleep infinity`、foreground dev server で待機しない。
- remote が未設定なら push / PR は推測せず、local commit と報告で完了してよい。
- Chrome 拡張の権限は最小限に保つ。Phase 0 では `host_permissions` の `https://x.com/*` と `https://twitter.com/*` だけを使う。
- Phase 0 では DOM フィルタ、ストレージ、popup 動作、content script、background service worker、F1 取得処理を追加しない。
- Phase 1 以降の機能を追加するときは、権限追加の理由と手動確認手順を README または関連ドキュメントに残す。
- Phase 1 では `storage` permission、静的 `content_scripts`、`action.default_popup` までに留める。
- Phase 1 では synthetic fixture を優先し、X 実 DOM の user_id 取得や F1-A / F1-B / F1-C / F1-D の一覧取得処理を追加しない。
- Phase 1.5 / 1.6 の F1-A research では `storage` と `scripting` だけを使い、`host_permissions` は `https://x.com/*` と `https://twitter.com/*` を維持する。
- `webRequest`、`cookies`、`tabs`、`activeTab`、`<all_urls>`、`https://api.x.com/*` は追加しない。必要性が見つかっても今回追加せず、未確認または将来判断として docs に残す。
- F1-A research で扱うのは masked observation / masked summary のみ。raw X response、Cookie、CSRF token、Authorization header、OAuth token、raw user_id、raw handle、表示名、本文、HAR、screenshot を storage、clipboard、fixture、docs、log、commit に含めない。
- popup の research UI は日本語中心にし、「開発用」「本番同期ではありません」「masked summary のみ」「raw response はコピーしない」を非プログラマーにも分かる形で表示する。
- 実 X ログインページの確認が必要な場合、Codex はログイン待ちをしない。blocked / muted の endpoint、shape、pagination、injection timing、SPA continuity は未確認として扱い、local simulator と evaluator の検証へ戻る。
- `tests/scripts/evaluate-f1-observation.mjs` の `fixture_pass` は実測根拠ではない。`f1a_viable` 以外では F1-A primary に進まず、F1-B / F1-D fallback 条件を確認する。
- production F1 sync、captured response から `xtbmEntries` への登録、F1-B / F1-C / F1-D 実装、OAuth、X API 連携はこの research scope では実装しない。
- Web UI を変更した場合は、可能な範囲で Chrome / Browser / Playwright / headless smoke を使い、実施できた viewport や未確認理由を報告する。
- GoogleChrome / modern-web-guidance は frontend 判断で迷う場合だけ利用候補にする。query に secret、token、OAuth、実データ、個人情報を含めない。
- Google Cloud / Firebase / Gemini など Google 公式 skill は、その領域に関係する task のみ優先する。この repo の F1-A research では原則不要。
