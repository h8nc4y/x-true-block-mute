# x-true-block-mute

X/Twitter でブロック・ミュート済みアカウント由来の情報露出を減らすことを目指す Chrome 拡張です。

Phase 1 では、Chrome に「Load unpacked」で読み込める Manifest V3 拡張として、popup、`chrome.storage`、静的 content script、synthetic fixture による最小 DOM フィルタを用意します。Phase 1.5 では、F1-A 採用判断のための研究用 `MAIN` world hook scaffold と docs を追加します。X 実 DOM の user_id 安定取得と本番用の F1-A / F1-B / F1-C / F1-D 一覧取得処理は未実装です。

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
- 本番用の `MAIN` world `fetch` / `XMLHttpRequest` hook
- `webRequest`、`cookies`、`tabs`、`activeTab`、`<all_urls>`、`https://api.x.com/*`
- import/export、options page

## Phase 1.5 の範囲

- F1-A feasibility investigation のため、`/settings/blocked/all` と `/settings/muted/all` に限定した研究用 bridge を追加する
- `chrome.scripting.executeScript` の `world: "MAIN"` で `fetch` / `XMLHttpRequest` hook を入れる
- hook は raw response、Cookie、CSRF token、token、raw user_id、raw handle、表示名、本文を保存しない
- sanitized observation は `xtbmF1AResearch` に保存し、通常の `xtbmEntries` には混ぜない
- popup に `Phase 1.5 research / 開発用` の有効化、masked 観測数、削除操作を追加する
- popup から判定用の `masked summary` をコピーできる
- `tests/scripts/evaluate-f1-observation.mjs` で masked summary を機械判定できる
- F1-A 採用条件と fallback 方針を docs に残す

## Phase 1.5 で実装しないこと

- 本番用 block / mute list sync
- captured response から `xtbmEntries` へ登録する処理
- F1-B DOM extraction
- F1-C X API / OAuth
- F1-D import UI
- raw X response、HAR、screenshot、Cookie、CSRF token、OAuth token、raw user_id、raw handle の保存

## ローカルで Chrome に読み込む手順

1. Chrome で `chrome://extensions` を開く。
2. 右上の `Developer mode` を有効にする。
3. `Load unpacked` をクリックする。
4. `D:\Codex\Projects\012_x-true-block-mute\` を選択する。
5. `x-true-block-mute` が表示され、manifest エラーが出ていないことを確認する。
6. 拡張アイコンの popup を開き、フィルタ、表示モード、登録件数が表示されることを確認する。

## 現在の manifest 権限

Phase 1.5 で宣言している権限は次だけです。

- `permissions`
  - `storage`
  - `scripting`

- `host_permissions`
  - `https://x.com/*`
  - `https://twitter.com/*`

`storage` は popup と content script が Phase 1 の設定、synthetic test data、Phase 1.5 の sanitized research observation を共有するために使います。`scripting` は設定ページ限定の研究用 `MAIN` world hook 注入に使います。

`webRequest`、`cookies`、`tabs`、`activeTab`、`<all_urls>`、`https://api.x.com/*` は追加していません。

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
- key: `xtbmF1AResearch`
- value: `{ schemaVersion: 1, enabled: boolean, observations: Observation[], updatedAt: string | null }`
- `xtbmF1AResearch.observations` は endpoint class、top-level key、shape path、field presence、count、hook continuity marker だけを持つ masked research summary
- raw response body、header、Cookie、CSRF token、Authorization header、OAuth token、raw user_id、raw handle、表示名、本文は schema 外

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

Phase 1.5 の研究用検証では次も使います。

```powershell
node tests/scripts/verify-f1a-observation-safety.mjs
node tests/scripts/verify-f1a-main-hook-simulator.mjs
node tests/scripts/evaluate-f1-observation.mjs tests/fixtures/f1-a-masked-summary.fixture.json
```

`evaluate-f1-observation.mjs` は `--live` を付けた場合だけ、条件充足時に `f1a_viable` を返します。`--live` なしでは fixture 扱いのため、条件が揃っても `fixture_pass` です。

実 X の masked summary を評価する場合:

```powershell
node tests/scripts/evaluate-f1-observation.mjs --live path\to\masked-summary.json
```

`unsafe_summary` が出た場合は raw 値が混入している可能性があるため、その summary は共有せず削除します。`f1a_insufficient` の場合は F1-A primary に進まず、F1-B または F1-D fallback を検討します。

## Phase 1.5 research docs

- `docs/research/f1-a-main-world-hook.md`
- `docs/decisions/f1-source-selection.md`

## 未確認事項

- Chrome UI の `Load unpacked` 手動確認は未確認です。
- X 実 DOM から安定して `user_id` を取得できるかは未確認です。
- 実 X 画面での F1-A endpoint、response shape、pagination、injection timing、SPA navigation 維持は未確認です。

## 関係性の表明

このプロジェクトは X Corp.、Twitter、または Chrome Web Store レビュアーと提携、承認、公式接続されたものではありません。
