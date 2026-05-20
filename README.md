# x-true-block-mute

X/Twitter でブロック・ミュート済みアカウント由来の情報露出を減らすことを目指す Chrome 拡張です。

Phase 0 では、Chrome に「Load unpacked」で読み込める Manifest V3 の最小雛形だけを用意します。まだユーザー画面やページ内容には何も作用しません。

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

## ローカルで Chrome に読み込む手順

1. Chrome で `chrome://extensions` を開く。
2. 右上の `Developer mode` を有効にする。
3. `Load unpacked` をクリックする。
4. `D:\Codex\Projects\012_x-true-block-mute\` を選択する。
5. `x-true-block-mute` が表示され、manifest エラーが出ていないことを確認する。

## 現在の manifest 権限

Phase 0 で宣言している権限は次だけです。

- `host_permissions`
  - `https://x.com/*`
  - `https://twitter.com/*`

`permissions` はまだ宣言していません。ストレージ、タブ操作、スクリプト注入、ネットワーク監視などは後続フェーズで必要性を確認してから追加します。

## 関係性の表明

このプロジェクトは X Corp.、Twitter、または Chrome Web Store レビュアーと提携、承認、公式接続されたものではありません。

