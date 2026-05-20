# x-true-block-mute

X/Twitter でブロック・ミュート済みアカウント由来の情報露出を減らすことを目指す Chrome 拡張です。

Phase 1 では、Chrome に「Load unpacked」で読み込める Manifest V3 拡張として、popup、`chrome.storage`、静的 content script、synthetic fixture による最小 DOM フィルタを用意します。X 実 DOM の user_id 安定取得と F1-A / F1-B / F1-C / F1-D の一覧取得処理は未実装です。

## Phase 0 の範囲

- Chrome Manifest V3 の `manifest.json` を作成する
- 対象予定ドメインとして `https://x.com/*` と `https://twitter.com/*` の `host_permissions` を宣言する
- ローカル読み込み手順と開発上の注意を文書化する

## Phase 0 で実装しないこと

- DOM フィルタ
- ストレージ層
- popup の表示や操作
- content script
- background service worker
- F1-A、F1-B、F1-C、F1-D の取得処理
- `webRequest`、`cookies`、`tabs`、`activeTab`、`<all_urls>`、`https://api.x.com/*` などの追加権限

## Phase 1 の範囲

- popup でフィルタ ON/OFF、表示モード、登録件数、最終 synthetic test-data 更新時刻を表示する
- popup から決定的な Phase 1 synthetic test data を `chrome.storage.local` へ投入、削除する
- 設定を `chrome.storage.sync` に保存する
- content script がホーム TL 相当の投稿カードを監視し、`data-user-id` または `data-handle` が登録対象に一致したカードを処理する
- 表示モードとして `hidden`、`placeholder`、`off` を扱う
- `tests/fixtures/home-timeline.html` でログイン不要の synthetic 確認を行う

## Phase 1 で実装しないこと

- F1-A / F1-B / F1-C / F1-D の一覧取得処理
- X API 連携、OAuth、Cookie、CSRF token、実アカウントデータ取得
- `MAIN` world の `fetch` / `XMLHttpRequest` hook
- `webRequest`、`cookies`、`tabs`、`activeTab`、`scripting`、`<all_urls>`、`https://api.x.com/*`
- background service worker
- import/export、options page

## ローカルで Chrome に読み込む手順

1. Chrome で `chrome://extensions` を開く。
2. 右上の `Developer mode` を有効にする。
3. `Load unpacked` をクリックする。
4. `D:\Codex\Projects\012_x-true-block-mute\` を選択する。
5. `x-true-block-mute` が表示され、manifest エラーが出ていないことを確認する。
6. 拡張アイコンの popup を開き、フィルタ、表示モード、登録件数が表示されることを確認する。

## 現在の manifest 権限

Phase 1 で宣言している権限は次だけです。

- `permissions`
  - `storage`

- `host_permissions`
  - `https://x.com/*`
  - `https://twitter.com/*`

`storage` は popup と content script が Phase 1 の設定と synthetic test data を共有するために使います。タブ操作、スクリプト注入、ネットワーク監視などは追加していません。

## Storage schema

`chrome.storage.sync`:

- key: `xtbmSettings`
- value: `{ schemaVersion: 1, enabled: boolean, displayMode: "hidden" | "placeholder" | "off" }`

`chrome.storage.local`:

- key: `xtbmEntries`
- value: `{ schemaVersion: 1, entries: Entry[], lastSyntheticUpdatedAt: string | null }`
- `Entry.user_id` は存在する場合の primary key として扱う
- `Entry.handle` は補助キーとして扱う
- Phase 1 synthetic entries は `source: "phase1-synthetic"` と `idResolutionStatus` を持つ

## Synthetic fixture での手動確認

X にログインせず、実アカウントの投稿内容や Cookie を読まずに確認できます。

1. `tests/fixtures/home-timeline.html` をブラウザで開く。
2. `プレースホルダ` を押す。
3. 非対象の投稿だけ本文が残り、user_id 対象と handle-only 対象の投稿本文が中立プレースホルダに置き換わることを確認する。
4. `完全非表示` を押す。
5. 対象投稿カードが表示領域から消え、非対象投稿が残ることを確認する。
6. `オフ` を押す。
7. 置換済みカードが復元され、対象投稿本文が再表示されることを確認する。
8. `テストデータ削除` を押す。
9. 対象投稿が処理されない状態に戻ることを確認する。

## Static validation

Node.js が使える環境では次を実行します。

```powershell
node tests/scripts/verify-phase1-static.mjs
```

この検証では manifest の権限、必須ファイル、JavaScript 構文、Phase 1 禁止事項の一部を確認します。

## 未確認事項

- Chrome UI の `Load unpacked` 手動確認は未確認です。
- X 実 DOM から安定して `user_id` を取得できるかは未確認です。
- 実 X 画面でのフィルタ挙動は Phase 1.5 以降で、実データを保存・ログ出力しない手順を別途決めて確認します。

## 関係性の表明

このプロジェクトは X Corp.、Twitter、または Chrome Web Store レビュアーと提携、承認、公式接続されたものではありません。
