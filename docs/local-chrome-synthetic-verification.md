# ローカル Chrome / synthetic fixture 確認メモ

## Status

2026-05-31 に Codex が PR #2 / PR #4 merge 後の `main` で確認した結果です。

このメモは実 X 検証ではありません。`https://x.com` と `https://twitter.com` は開いていません。

## 2026-07-28 `POST-2026-07-28-BROWSER-EVIDENCE`（完了）

目的は、既存の `tests/scripts/verify-extension-load-chrome.mjs` が機能回帰だけでなく、options page の responsive layout とブラウザー実行時エラーも bounded に検知できるようにすることです。製品 UI、manifest 権限、データフロー、公開版は変更しません。

影響範囲は synthetic Chromium harness と、その不変条件を監視する既存の静的検証、現況資料だけです。実 X、ログイン済み profile、OAuth、Cookie、raw response、Chrome Web Store 操作は対象外です。

受け入れ条件:

- options page を `390x844`、`768x1024`、`1280x900` で実描画する。
- 各 viewport で `scrollWidth <= innerWidth` を満たし、見出し、プライバシー説明、管理ボタンが表示され、既定の本文・見出し・ボタン文字サイズと操作領域が読みやすさの下限を満たす。
- `Runtime.exceptionThrown`、error-level `Runtime.consoleAPICalled` / `Log.entryAdded`、`Network.loadingFailed` を session ごとに上限付きで収集し、synthetic 検証中は 0 件であることを確認する。response body は読まない。
- options page の3 viewport screenshot を `tmp/` に生成し、生成だけで合格にせず目視する。
- watchdog でも通常終了と同じ冪等 cleanup を通し、`Browser.close` を短時間で打ち切った場合は Chromium の process tree を明示終了して一時 profile を削除する。watchdog 発火、cleanup 不完了、`taskkill` timeout / nonzero は必ず非 0 終了へ接続する。
- 既存の popup、storage、fixture、real-DOM author / quote / reserved path 回帰を保つ。
- `node scripts/check-all.mjs`、`node tests/scripts/verify-extension-load-chrome.mjs`、package 検査、`git diff --check` を通す。

実測結果:

- `verify-phase1-static.mjs` に browser evidence の不変条件を追加し、実装前に `OPTIONS_VIEWPORTS` 欠落で意図した RED（exit 1）を確認した。
- headless Chromium の bounded run は 73 checks PASS。専用 session で synthetic runtime exception、console error、localhost failed request を各1件以上捕捉できることを先に確認し、popup、home fixture、real-DOM fixture、options 3 viewport の全 session では各カテゴリ 0 件だった。
- options page は `390x844`、`768x1024`、`1280x900` の各 viewport で、`innerWidth / innerHeight`、横 overflow なし、主要見出し、プライバシー説明、本文 14px 以上、管理ボタン 14px / 高さ40px以上、storage件数、empty state を確認した。
- full-page screenshot は `390x1606`、`768x1310`、`1280x1310` で生成し、3枚とも目視した。横切れ、重なり、読めない文字、操作不能に見える管理ボタンは確認されなかった。
- 独立レビューで、旧 watchdog が `process.exit(1)` へ直行して cleanup を迂回する P2 を検出した。修正後の再レビューでは、共有 cleanup の継続順によって通常側が先に exit 0 できる競合、通常 cleanup 不完了の false-green、`taskkill` helper の timeout / exit code 未評価を追加検出した。
- `watchdogTriggered`、cleanup failure 集約、taskkill 結果の静的契約を追加し、実装前の RED（exit 1）から GREEN を確認した。watchdog は発火時に terminal failure を latch し、main 成功側が cleanup 後に再確認する。
- main が先に cleanup 待ちへ入り、その途中で watchdog が発火する race 自己試験は、`exit 0 suppressed` を出して期待どおり exit 1。強制した profile status failure も通常成功経路から exit 1 へ接続した。各試験で実 PID と一時 profile は残存しなかった。
- `taskkill` は helper 自体を bounded に実行し、timeout 時は helper を強制終了して exit を確認する。primary timeout と exit 23 / stderr ありの2試験はいずれも結果を失敗へ集約して exit 1 とし、stderr 本文は保持せず文字数だけを redacted 表示した。実 `taskkill /T /F` fallback は成功し、helper、Chromium PID、一時 profile は残存しなかった。
- 追加レビューで、spawn 後の helper `error` を pre-spawn failure と誤分類し得る P3 を検出した。`spawn` event / PID の有無で状態を分離し、spawn 後 error は category を記録しても即 settle しない。`ChildProcess.killed` は終了証拠にせず、実 `exit` / `close` / `exitCode` / `signalCode`、または grace 後の exact helper PID への再送結果で判定する。
- pre-spawn `ENOENT`、spawn 後 error、初回 kill error の3自己試験は全て期待どおり exit 1。後2件は `helperSpawned=true` のまま実 exit まで待ち、kill error は `killRetryAttempted=true` を確認した。各 helper、Chromium PID、一時 profile は残存 0 だった。
- watchdog を `1500ms` に短縮し、`Browser.close` の timeout を意図的に発生させる通常の watchdog 自己試験も、`taskkillStatus=ok`、`childExited=true`、`profileRemoved=true` で期待どおり exit 1 だった。
- 通常 run は `Browser.close=ok`、`childExited=true`、`profileRemoved=true`、`cleanupComplete=true`。対象repo pathを持つ残留 `chrome.exe` は 0 件だった。
- 今回の各自己試験で記録した PID / 一時 profile / timeout helper は残存 0。これとは別に、OS temp には旧 harness が残した同一接頭辞の profile が46件あった。active process 利用は0件だったが、削除操作が実行ポリシーで拒否されたため再試行せず、削除0件のまま残置した。

## 確認した baseline

- local branch: `main`
- `main...origin/main`: `0 0`
- HEAD: `6c6238707bad4629a6074bf8eb107487893b9453`
- PR #2: merged, merge commit `68297f49627c12ba22eb31da367afa553aed8377`
- PR #4: merged, merge commit `6c6238707bad4629a6074bf8eb107487893b9453`
- working tree: baseline 確認時点で clean

## Node 検証結果

`main` 上で以下を実行し、すべて pass しました。

- `node tests/scripts/verify-phase1-static.mjs`
- `node tests/scripts/verify-f1a-observation-safety.mjs`
- `node tests/scripts/verify-f1a-main-hook-simulator.mjs`
- `node tests/scripts/evaluate-f1-observation.mjs tests/fixtures/f1-a-masked-summary.fixture.json`
- `node tests/scripts/audit-operational-alignment.mjs`
- `git diff --check`

`evaluate-f1-observation.mjs` は `fixture_pass` です。これは synthetic fixture の判定であり、実 X の F1-A primary 判定ではありません。

## Chrome 自動確認でできたこと

Codex は既存 Chrome profile を使わず、`%TEMP%` 配下の一時 profile で Chrome を起動しました。

確認対象は local file と unpacked extension 候補だけです。実 X、ログイン、Cookie、token、HAR、Network response、個人情報を含む screenshot は使っていません。

`tests/fixtures/home-timeline.html` は file URL として開き、DevTools Protocol 経由で以下を確認しました。

- 初期状態: synthetic fixture のタイトルと非対象投稿が表示され、置き換え要素は 0 件。
- `説明だけ表示`: 置き換え要素が 2 件になり、対象投稿本文は本文表示から消える。
- `完全に隠す`: hidden 置き換え要素が 2 件になり、対象投稿本文は本文表示から消える。
- `何もしない`: 置き換え要素が 0 件になり、対象投稿本文が通常表示に戻る。

## Chrome 自動確認で未確認のこと

Chrome の一時 profile で unpacked extension 読み込みを試しましたが、Codex の自動化では `x-true-block-mute` の popup を拡張コンテキストとして安定確認できませんでした。

- `DevToolsActivePort` が作られ、一時 profile の Chrome には接続できました。
- ただし `x-true-block-mute` の service worker target を安定して特定できませんでした。
- 候補の extension ID で `chrome-extension://.../src/popup/popup.html` を開いたところ、Chrome は `ERR_FILE_NOT_FOUND` を返しました。
- そのため、popup の `テストデータを入れる` / `テストデータを消す` は自動確認済みとは扱いません。

この未確認は、実 X や既存ログイン済み profile を使えば解消できる、という意味ではありませんでした。2026-06-13 の M2 で、Claude Code が Playwright キャッシュの Chromium（branded Chrome 137+ と異なり `--load-extension` が有効）と raw CDP を使って、この拡張ロードと popup 確認を自動で再試行し、解消しました（下記「2026-06-13 自動確認結果（M2）」を参照）。

## 2026-06-13 自動確認結果（M2）

`node tests/scripts/verify-extension-load-chrome.mjs` を実行し、すべて pass しました。実 X、ログイン、Cookie、token、HAR、Network response、個人情報を含む screenshot は使っていません。

- 拡張は manifest エラーなくロードされ、service worker target（`research-background.js`、extension id `ojojojonmdiblhppolfehhboeklnpnon`）を検出。
- popup を `chrome-extension://<id>/src/popup/popup.html` として開き、拡張コンテキストで描画（`#filter-state` = `状態: 有効`）。これは `chrome.storage` が拡張として読めている証拠。
- popup の `テストデータを入れる` 相当（`#seed-synthetic`）クリックで `登録済みの対象` が `0件` → `2件` に更新。
- `tests/fixtures/home-timeline.html` を file URL で開き、`説明だけ表示`（placeholder）と `完全に隠す`（hidden）で置換要素が 2件、`何もしない`（off）と `テストデータを消す`（clear）で 0件。引用ホストカードは非対象として残存（誤判定なし）。
- スクリーンショット（synthetic データのみ）は `tmp/`（gitignore 済み）に保存。

Codex 失敗（`ERR_FILE_NOT_FOUND` / service worker target 不定）の主因は、branded Chrome 137+ が `--load-extension` を無効化していたことと推定されます。M2 では Playwright キャッシュの open-source Chromium を使うことで解消しました。

## 人間が Chrome で確認する手順

1. Chrome で `chrome://extensions` を開く。
2. `Developer mode` を有効にする。
3. `Load unpacked` で拡張のフォルダ（`manifest.json` がある場所）を選ぶ。
4. `x-true-block-mute` が表示され、manifest エラーがないことを確認する。
5. 拡張アイコンから popup を開く。
6. `ローカル確認用データ` の `テストデータを入れる` を押す。
7. `登録済みの対象` が `0件` 以外になったことを確認する。
8. `tests/fixtures/home-timeline.html` を Chrome で開く。
9. `説明だけ表示`、`完全に隠す`、`何もしない` を切り替え、対象投稿だけ表示が変わることを確認する。
10. 確認後、popup の `テストデータを消す` を押す。

## 報告してよい情報

- Load unpacked が成功したかどうか。
- manifest エラーの文面。
- popup の表示ラベル、件数、状態表示。
- synthetic fixture の対象投稿が期待どおり変わったかどうか。
- Node 検証コマンドの pass/fail。

## 報告してはいけない情報

- X のアカウント名、表示名、handle、user_id。
- 投稿本文、プロフィール文、個人情報を含む screenshot。
- raw X response、HAR、DevTools Network body。
- Cookie、CSRF token、Authorization header、OAuth token、password、MFA code。
- `.env`、credentials、auth.json、session ファイルの中身。

## 停止条件（不変）

このローカル synthetic 確認の範囲を超えて、次のいずれかが必要になったら停止し、ユーザーに確認します。live X 検証や Phase 2 実装はそれぞれ M3 / M4 の専用手順（ユーザー承認済み）で行い、本メモの synthetic 確認とは混ぜません。

- password、MFA、Cookie、CSRF、Authorization、OAuth token の受領・保存。
- raw X response、HAR、DevTools Network 本文の保存。
- raw user_id、raw handle、display name、post text を、ユーザー端末の local production-entry storage（active `xtbmSyncEntries:<generation>`、旧形式は `xtbmEntries`）以外（貼り付け、docs、commit、screenshot 等）へ出すこと。
- 新しい拡張権限を、理由・脅威モデル更新・ユーザー承認なしに追加すること。
- 端末外へのデータ送信、deploy、外部ダッシュボード、paid service。
