# x-true-block-mute

## Current status

この repository は現在 **Phase 2 実装段階**です。Phase 1 / Phase 1.5（local MV3 shell・popup・storage・synthetic fixture・F1-A research scaffold）は完了し、Phase 2 の production 機能が実装済みです。

- **production sync 実装済み**: 宣言的 `world:"MAIN"` content script（`/settings/blocked/all`・`/settings/muted/all` 限定）が、ユーザー自身のブロック・ミュート一覧 GraphQL 応答から `user_id`（rest_id）/ `handle`（screen_name）/ `listKind` のみを抽出し、ISOLATED bridge 経由で `chrome.storage.local` の `xtbmEntries` に取り込みます。raw response・cursor 値・表示名・本文は保存しません。実アカウントで blocked 234件 / muted 50件の取り込みを確認済み（件数のみ・2026-06-13）。
- **reconciliation 実装済み**: 一覧の末尾（完全同期）に到達したときだけ当該 listKind を全置換し、解除済みアカウントを除去します。部分取得時は追加のみです（完全同期検出 = 抽出0件、`Storage.replaceSyncedListKind()`）。
- **real-DOM author matching 実装済み**: 通常 content script が投稿カードの User-Name 領域に限定して投稿者を判定し、quote / embed の混在を分離します（引用カードは host 投稿を残したままその場で隠します）。実 TL で誤判定なく動作することを確認済み（M5）。
- popup から同期の有効化・ブロック / ミュート件数・最終同期時刻の確認・同期データ削除ができます。F1-A 観測メモ（開発用）は本番では非表示です（dev フラグ `RESEARCH_UI_ENABLED`、既定 false）。
- 残作業: 非エンジニア向け UX 仕上げ（M6）と Chrome Web Store 提出準備（M7: icons / version / zip / プライバシーポリシー / 掲載文 / `scripting` 権限の retire）。

X/Twitter でブロック・ミュート済みアカウント由来の情報露出（RT・引用経由を含む）を減らすことを目指す Chrome 拡張です。データはすべて端末ローカル保存・外部送信なし・権限最小（`storage` + `scripting` + x.com / twitter.com host）を維持します。

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

## Phase 1 の real DOM 制限

現在の content script の handle 抽出は、synthetic fixture とローカル Phase 1 確認のためのものです。実 X DOM では、投稿カード内のリンクや埋め込み要素が必ず投稿者本人を示すとは限りません。

- 実 X DOM の author identity は保証していません。
- quote / embedded target / profile card / 関連リンクの扱いは production-complete ではありません。
- 実 DOM で安全に投稿者を判定する author matching は Phase 2 以降の作業です。
- この Phase 1 / Phase 1.5 task では real-DOM 著者判定ロジックを変更しません。

## Phase 1.5 の範囲

- F1-A feasibility investigation のため、`/settings/blocked/all` と `/settings/muted/all` に限定した研究用 bridge を追加する
- `chrome.scripting.executeScript` の `world: "MAIN"` で `fetch` / `XMLHttpRequest` hook を入れる
- hook は raw response、Cookie、CSRF token、token、raw user_id、raw handle、表示名、本文を保存しない
- sanitized observation は `xtbmF1AResearch` に保存し、通常の `xtbmEntries` には混ぜない
- popup に `F1-A 観測メモ（開発用）`、観測件数、ブロック / ミュート別の件数、安全な要約コピー、削除操作を追加する
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
4. `D:\Agent\Codex\Projects\012_x-true-block-mute\` を選択する。
5. `x-true-block-mute` が表示され、manifest エラーが出ていないことを確認する。
6. 拡張アイコンの popup を開き、`通常フィルタ`、`ローカル確認用データ`、`ブロック・ミュート同期` が表示されることを確認する（`F1-A 観測メモ（開発用）` は本番では非表示。開発時に確認する場合は `src/shared/constants.js` の `RESEARCH_UI_ENABLED` を `true` にして拡張を再読み込みする）。
7. 初心者向けの確認は `docs/manual-popup-verification.md` の手順に沿って行う。

## 設定ページ（オプション）

popup の `詳細設定・プライバシー` から設定ページ（`src/options/options.html`、`options_ui` で登録）を開けます。設定ページでは次を確認・操作できます。

- プライバシー説明: データは端末内（`chrome.storage.local`）のみに保存され外部送信なし、取り込むのは user_id・handle・listKind のみ、権限は `storage` と x.com / twitter.com host のみ。
- フィルタ対象の一覧（透明性）: 同期で取り込んだブロック / ミュート対象の件数と一覧、ローカル確認用データの件数。
- 管理: 同期データの削除、テストデータの削除。
- 「うまく同期できないとき」のトラブルシュート手順（P2-015 のエラー日本語ガイダンス）。

## 現在の manifest 権限

宣言している権限は次だけです。

- `permissions`
  - `storage`

- `host_permissions`
  - `https://x.com/*`
  - `https://twitter.com/*`

`storage` は popup・options・content script が設定、synthetic test data、本番同期で取り込んだブロック・ミュート対象（`xtbmEntries`）、同期状態（`xtbmSyncState`）を共有するために使います。本番同期は宣言的 `world:"MAIN"` content script で行うため `scripting` を必要としません。F1-A research の動的注入だけが `scripting` を使っていましたが、M7 で research を retire し `scripting` 権限を削除しました。研究の評価用スクリプト・テスト・判断記録（`docs/decisions/f1-source-selection.md`）はリポジトリに残しますが、出荷パッケージには含めません。

`webRequest`、`cookies`、`tabs`、`activeTab`、`<all_urls>`、`https://api.x.com/*`、`scripting` は宣言していません。

## Storage schema

`chrome.storage.sync`:

- key: `xtbmSettings`
- value: `{ schemaVersion: 1, enabled: boolean, displayMode: "hidden" | "placeholder" | "off" }`

`chrome.storage.local`:

- key: `xtbmEntries`
- value: `{ schemaVersion: 1, entries: Entry[], lastSyntheticUpdatedAt: string | null }`
- `Entry.user_id` は存在する場合の primary key として扱う
- `Entry.handle` は補助キーとして扱う
- `Entry.listKind` は `"blocked" | "muted" | null`。同期で取得した一覧の種別を表す（schema v2 で追加。旧データ読み込み時は `null`）
- `Entry.syncedAt` は同期で書き込んだ ISO 文字列、または `null`（schema v2 で追加）
- Phase 1 synthetic entries は `source: "phase1-synthetic"` と `idResolutionStatus` を持つ
- 本番同期で取り込むユーザー自身のブロック・ミュート対象は `source: "f1a-sync"` を持つ。`Storage.upsertSyncedEntries()` が user_id 優先（handle 補助）で重複排除し、`Storage.replaceSyncedListKind()` が完全同期時に当該 listKind を全置換して解除済みアカウントを除去（部分取得時は追加のみ）、`Storage.clearSyncedEntries()` が同期分のみ削除する。これらは端末内 `chrome.storage.local` に限り、docs / commit には raw 値を出さない（詳細は `docs/privacy-threat-model.md`）
- key: `xtbmF1AResearch`
- value: `{ schemaVersion: 1, enabled: boolean, observations: Observation[], updatedAt: string | null }`
- `xtbmF1AResearch.observations` は endpoint class、top-level key、shape path、field presence、count、hook continuity marker だけを持つ masked research summary
- raw response body、header、Cookie、CSRF token、Authorization header、OAuth token、raw user_id、raw handle、表示名、本文は schema 外

## Synthetic fixture での手動確認

X にログインせず、実アカウントの投稿内容や Cookie を読まずに確認できます。

1. 拡張 popup を開き、`ローカル確認用データ` の `テストデータを入れる` を押す。
2. `登録済みの対象` が `0件` 以外になったことを確認する。
3. `tests/fixtures/home-timeline.html` をブラウザで開く。
4. `説明だけ表示` を押す。
5. 非対象の投稿だけ本文が残り、user_id 対象と handle-only 対象の投稿本文が中立プレースホルダに置き換わることを確認する。
6. `完全に隠す` を押す。
7. 対象投稿カードが表示領域から消え、非対象投稿が残ることを確認する。
8. `何もしない` を押す。
9. 置換済みカードが復元され、対象投稿本文が再表示されることを確認する。
10. popup の `テストデータを消す` を押す。
11. 対象投稿が処理されない状態に戻ることを確認する。

popup で見る場所、件数の意味、貼ってよい情報、貼ってはいけない情報は `docs/manual-popup-verification.md` にまとめています。

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
node tests/scripts/verify-docs-consistency.mjs
```

運用ルール（`AGENTS.md`）と docs の整合も次で確認します。

```powershell
node tests/scripts/audit-operational-alignment.mjs
```

`evaluate-f1-observation.mjs` は `--live` を付けた場合だけ、条件充足時に `f1a_viable` を返します。`--live` なしでは fixture 扱いのため、条件が揃っても `fixture_pass` です。

実 X の masked summary を評価する場合:

```powershell
node tests/scripts/evaluate-f1-observation.mjs --live path\to\masked-summary.json
```

`unsafe_summary` が出た場合は raw 値が混入している可能性があるため、その summary は共有せず削除します。`f1a_insufficient` の場合は F1-A primary に進まず、F1-B または F1-D fallback を検討します。

## Phase 1.5 research docs

- `docs/manual-popup-verification.md`
- `docs/local-chrome-synthetic-verification.md`
- `docs/phase2-readiness-gates.md`
- `docs/privacy-threat-model.md`
- `docs/deferred-findings-register.md`
- `docs/research/f1-a-main-world-hook.md`
- `docs/decisions/f1-source-selection.md`

## Claude Code operation notes

運用ルールの正本は `AGENTS.md` です。2026-06-13 のガバナンス変更（`docs/DECISION_LOG.md`）以降の要点:

- 報告は日本語、冒頭に日本時間 `YYYY/MM/DD HH:MM:SS`。テスト結果・commit hash・URL を捏造しない。
- タスクはユーザーがチャットで直接承認したものを実装する。ChatGPT 承認制は廃止。
- ユーザー同意の下、Claude Code は Chrome MCP でログイン済み Chrome を操作し、設定ページ限定で masked observation を収集してよい。password / MFA / Cookie / token は受け取らない。x.com / twitter.com タブではスクリーンショット・DOM テキスト・network response を読み取らない。
- Chrome Load unpacked / popup / synthetic fixture の確認は Playwright/CDP 自動化で実施してよい。
- 入力待ちループ、対話式 CLI 待機、foreground dev server で待機しない。検証スクリプトは必ず終了する。
- 権限は `storage` + `scripting` + x.com/twitter.com host に保つ。追加が必要なら理由・脅威モデル更新・rollback をユーザー承認と共に docs に残す。

## 検証状況

2026-06-13 以降、ユーザー承認の下で Claude Code が自動検証（Chrome Load unpacked は Playwright/CDP、live X は Chrome MCP の masked observation）を実施しました。

- Chrome の `Load unpacked` / popup 動作 / synthetic + 実DOM フィルタは `tests/scripts/verify-extension-load-chrome.mjs`（実 Chromium CDP）で自動検証済み（M2 / M5）。
- 実 X 画面での F1-A endpoint / response shape / pagination / identity は M3 の live masked summary 評価で `f1a_viable` を確認済み。production sync は実アカウントで件数のみ確認済み（M4、blocked 234 / muted 50）。
- 実 X DOM の投稿者判定は User-Name 領域限定 + quote / embed 分離で実装・確認済み（M5）。同期の主キー `user_id`（rest_id）と補助キー handle（screen_name）は一覧 GraphQL 応答から取得する。
- 残: Chrome Web Store 提出（M7）の審査結果は未確認。

## プライバシーポリシー

プライバシーポリシーは `docs/privacy-policy.md`（日英併記）と、ホスティング用の自己完結
HTML `docs/privacy-policy.html` にあります。Chrome Web Store 提出には公開 URL が必要です。

公開前のユーザー作業:

1. `docs/privacy-policy.md` と `docs/privacy-policy.html` の連絡先プレースホルダ（`[ADD YOUR CONTACT EMAIL BEFORE PUBLISHING]` / `[公開前に連絡先メールアドレスを記入してください]`）に連絡先メールを記入する。
2. `docs/privacy-policy.html` をホストする（例: リポジトリ設定で GitHub Pages を `/docs` から有効化すると `https://<user>.github.io/<repo>/privacy-policy.html` で公開される）。
3. その URL をストア掲載情報のプライバシーポリシー欄に設定する（`docs/store-listing.md` 参照）。

## パッケージング（Chrome Web Store 用）

出荷用 zip は allowlist 方式で、拡張に必要なファイルだけを同梱します（research のオフライン証跡・tests・docs・scripts・`*.md`・`icons/icon.svg` は除外）。

```powershell
node scripts/build-package.mjs        # dist/TrueBlock-Mute-v<version>.zip を生成
node tests/scripts/verify-package.mjs # allowlist 完全性・禁止パス不在・ZIP 妥当性を検証
```

`dist/` は gitignore 済みです。アイコンは `node scripts/make-icons.mjs` で `icons/icon.svg` から再生成できます。

## 関係性の表明

このプロジェクトは X Corp.、Twitter、または Chrome Web Store レビュアーと提携、承認、公式接続されたものではありません。
