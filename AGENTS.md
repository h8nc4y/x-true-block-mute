# AGENTS.md

## Project Rules

このファイルは x-true-block-mute リポジトリの共通運用ルールです。Codex の自律開発では現行のユーザー指示とハンドオフを優先し、本ファイルはデータ保護・権限境界・検証報告の不変条件を補完します。2026-06-13 のガバナンス変更により、ユーザー本人がチャットで直接承認したタスクを Claude Code が実装します。旧 ChatGPT 承認制は廃止されました。

### 承認と進め方

- ユーザー向け報告は日本語を主にし、冒頭に日本時間 `YYYY/MM/DD HH:MM:SS` を付ける。
- タスクはユーザーがチャットで承認したものを実装する。大きな方針変更（権限追加、Phase 移行、配布、外部送信）は着手前にユーザー承認を取る。
- 最終目的は Chrome Web Store での一般配布。想定利用者は非エンジニアで、複雑な操作を要求しない。
- 現行タスクは `TASKS_BACKLOG.md`、ロードマップは同ファイルの M1〜M7 を参照する。

### データ保護（最重要・不変）

- 秘密情報、OAuth 資格情報、Cookie、CSRF token、Authorization header、password、MFA code、実データ、個人データを読まない・記録しない・コミットしない。
- raw X response、HAR、DevTools Network 本文、個人情報を含む screenshot、raw user_id、raw handle、表示名、本文を clipboard、fixture、docs、log、commit に含めない。
- F1-A research が扱うのは masked observation / masked summary のみ。raw 値は含めない。
- production の `xtbmEntries` には、ユーザー自身のブロック・ミュートリストとして user_id / handle を端末内 `chrome.storage.local` にローカル保存する（同期目的上必須）。この raw 値は端末内 storage に限り、docs / fixture / log / commit / clipboard には出さない。境界の詳細は `docs/privacy-threat-model.md`。
- `tests/scripts/evaluate-f1-observation.mjs` が `unsafe_summary` を返したら処理を停止し、その summary を削除する。

### live X 検証（Claude Code が実施可）

- ユーザーの同意の下、Claude Code は Chrome MCP でユーザーのログイン済み Chrome を操作し、設定ページ（`/settings/blocked/all`、`/settings/muted/all`）限定で masked observation を収集してよい。
- エージェントは password、MFA、Cookie、token を受け取らない。ログインはユーザー自身が行う。
- x.com / twitter.com のタブでは、スクリーンショット、DOM テキストの読み取り、network response の読み取りを行わない。`javascript_tool` の戻り値は数値・boolean・固定ラベルに限る。
- masked summary はクリップボード経由で `tmp\masked-summary.json` のような gitignore 済み一時パスに置き、`evaluate-f1-observation.mjs --live` の `unsafe_summary` 判定を最初に通す。
- Chrome Load unpacked / popup / synthetic fixture の確認は Playwright/CDP 自動化で実施してよい。

### 権限最小化

- manifest の `permissions` は `storage` のみ、`host_permissions` は `https://x.com/*` と `https://twitter.com/*` までに保つ。`scripting` は M7 で retire 済みであり、本番同期は宣言的 `world:"MAIN"` content script で行う。
- `webRequest`、`cookies`、`tabs`、`activeTab`、`<all_urls>`、`https://api.x.com/*` は追加しない。将来必要性が出た場合は、理由・脅威モデル更新・手動確認手順・rollback をユーザー承認と共に docs に残してから追加する。
- `scripting`、`webRequest`、`cookies`、`tabs`、`activeTab`、`<all_urls>`、`https://api.x.com/*` などの権限再追加は、理由・脅威モデル更新・手動確認手順・rollback をユーザー承認と共に docs に残してから行う。

### 報告と検証

- テスト結果、コマンド結果、commit hash、PR URL、デプロイ URL を捏造しない。未確認のものは「未確認」と書く。
- 対話式 CLI、foreground dev server、入力待ちループ（`read`、`pause`、`select`、`tail -f`、`watch`、`while true`、`sleep infinity` 等）で待機しない。検証スクリプトは必ず終了する。
- remote が未設定なら push / PR は推測せず、local commit と報告で完了してよい。
- popup の research UI は日本語中心にし、「開発用」「本番同期ではありません」「masked summary のみ」を非プログラマーにも分かる形で表示する。production build からは research UI を除去または非表示化する。

### ツール利用の注意

- Web UI を変更した場合は、可能な範囲で Chrome / Playwright / headless smoke で確認し、実施できた viewport や未確認理由を報告する。query に secret、token、OAuth、実データ、個人情報を含めない。
