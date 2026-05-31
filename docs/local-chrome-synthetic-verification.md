# ローカル Chrome / synthetic fixture 確認メモ

## Status

2026-05-31 に Codex が PR #2 / PR #4 merge 後の `main` で確認した結果です。

このメモは実 X 検証ではありません。`https://x.com` と `https://twitter.com` は開いていません。

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

この未確認は、実 X や既存ログイン済み profile を使えば解消できる、という意味ではありません。今回の安全条件では、人間の Chrome Load unpacked 確認に切り替えるのが妥当です。

## 人間が Chrome で確認する手順

1. Chrome で `chrome://extensions` を開く。
2. `Developer mode` を有効にする。
3. `Load unpacked` で `D:\Agent\Codex\Projects\012_x-true-block-mute\` を選ぶ。
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

## real X へ進む前の停止条件

次のいずれかが必要になったら、Codex は実行せず ChatGPT / user 判断に戻します。

- real X login。
- real X DOM 確認。
- F1-A live endpoint 確認。
- Cookie、CSRF、Authorization、OAuth token、raw X response、HAR の確認。
- raw user_id、raw handle、display name、post text の保存、貼り付け、commit。
- production F1-A sync、F1-B、F1-C、F1-D、real-DOM author matching。
- 新しい拡張権限、新依存、package.json、CI、deploy、Chrome Web Store 作業。
