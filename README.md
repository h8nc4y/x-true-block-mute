# x-true-block-mute

## Current status

この repository は現在 Phase 1 / Phase 1.5 の research / prototype 段階です。

- Phase 1 は local MV3 extension shell、popup、storage、synthetic fixture、通常 content-script filter path を扱います。
- Phase 1.5 は `/settings/blocked/all` と `/settings/muted/all` で masked observation を集める F1-A research scaffold を扱います。
- 通常の Phase 1 filter content script は X/Twitter ページに広く一致しますが、F1-A settings pages からは除外し、research bridge がそのページを担当します。
- synthetic home-timeline-style fixture が現在の local verification surface です。real X DOM author matching は未実装で、この phase の範囲外です。
- Production block/mute list sync、F1-B/F1-C/F1-D、OAuth/API integration、Chrome Web Store preparation、live X verification は未実装です。

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
6. 拡張アイコンの popup を開き、`通常フィルタ`、`ローカル確認用データ`、`F1-A 観測メモ（開発用）` が表示されることを確認する。
7. 初心者向けの確認は `docs/manual-popup-verification.md` の手順に沿って行う。

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

## 未確認事項

2026-06-13 以降、これらは Claude Code が自動検証（Chrome Load unpacked は Playwright/CDP、live X は Chrome MCP）で確認できますが、実施前の現時点では未確認です。

- Chrome の `Load unpacked` と popup 動作は未確認（M2 で自動検証予定）。
- X 実 DOM から安定して `user_id` を取得できるかは未確認。実 DOM の投稿者判定、quote / embedded target の除外、関連リンク混在時の handle 判定も未確認（M3 / M5）。
- 実 X 画面での F1-A endpoint、response shape、pagination、injection timing、SPA navigation 維持は未確認（M3 の live masked summary 評価で判定）。

## 関係性の表明

このプロジェクトは X Corp.、Twitter、または Chrome Web Store レビュアーと提携、承認、公式接続されたものではありません。
