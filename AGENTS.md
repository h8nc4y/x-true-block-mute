# AGENTS.md

## Project Rules

- ユーザー向け報告は日本語を主にする。
- 秘密情報、OAuth 資格情報、Cookie、実データ、個人データを読まない、記録しない、コミットしない。
- テスト結果、コマンド結果、commit hash、PR URL、デプロイ URL を捏造しない。未確認のものは未確認と書く。
- Chrome 拡張の権限は最小限に保つ。Phase 0 では `host_permissions` の `https://x.com/*` と `https://twitter.com/*` だけを使う。
- Phase 0 では DOM フィルタ、ストレージ、popup 動作、content script、background service worker、F1 取得処理を追加しない。
- Phase 1 以降の機能を追加するときは、権限追加の理由と手動確認手順を README または関連ドキュメントに残す。
- Phase 1 では `storage` permission、静的 `content_scripts`、`action.default_popup` までに留める。
- Phase 1 では synthetic fixture を優先し、X 実 DOM の user_id 取得や F1-A / F1-B / F1-C / F1-D の一覧取得処理を追加しない。
