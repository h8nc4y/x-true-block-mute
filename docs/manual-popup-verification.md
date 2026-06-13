# popup 手動確認手順

この手順は、Chrome 拡張の popup 表示を初心者でも確認できるようにするためのものです。実 X ログイン、実アカウント、実データ取得は不要です。

## 今回の確認範囲

この手順は PR #2 / PR #4 merge 後の `main` を対象にした、ローカル Chrome 拡張確認です。

- 確認するもの: Chrome Load unpacked、popup 表示、ローカル確認用データ、`tests/fixtures/home-timeline.html` の synthetic fixture。
- 確認しないもの: `https://x.com`、`https://twitter.com`、real X ログイン、real X DOM、F1-A live endpoint、production sync。
- 使うデータ: repository 内の synthetic fixture と、popup の `テストデータを入れる` で入るローカル確認用データだけ。
- 使わないデータ: Cookie、CSRF token、Authorization header、OAuth token、raw X response、HAR、raw user_id、raw handle、投稿本文、個人情報を含む screenshot。

実 X の確認は別枠です。この手順を進めるために X/Twitter を開かないでください。

## Chrome に読み込む

1. Chrome で `chrome://extensions` を開く。
2. 右上の `Developer mode` を有効にする。
3. `Load unpacked` をクリックする。
4. この拡張のフォルダ（`manifest.json` がある場所）を選択する。
5. `x-true-block-mute` が表示され、manifest エラーが出ていないことを確認する。
6. Chrome の拡張アイコンから `x-true-block-mute` の popup を開く。

この時点でエラーが出る場合は、エラー文だけを報告してください。実 X、Cookie、token、Network response、個人情報を含む screenshot は貼らないでください。

## popup で見る場所

### 通常フィルタ

- `フィルタを使う`: ローカル確認用データをタイムライン fixture に反映するかを切り替える。
- `投稿の扱い`: 対象投稿を `完全に隠す`、`説明だけ表示`、`何もしない` のどれで扱うかを選ぶ。

### ローカル確認用データ

- `登録済みの対象`: ローカル fixture 用に入っているテスト対象の件数。実 X アカウント数ではありません。
- `最終更新`: `テストデータを入れる` を押した時刻。
- `テストデータを入れる`: 実データを使わず、決め打ちのテスト対象を storage に入れる。
- `テストデータを消す`: ローカル確認用データを消す。

`登録済みの対象` が `0件` でも異常とは限りません。fixture を確認する前に `テストデータを入れる` を押してください。

### F1-A 観測メモ（開発用）

この欄は本番同期ではありません。ブロック / ミュート設定ページで、構造だけを安全にメモできるかを調べる開発用表示です。

- `F1-A 観測を開始`: 実 X の設定ページを人間が確認するときだけ使う。ローカル確認だけなら停止中で問題ありません。
- `監視状態`: F1-A 観測が `監視中` か `停止中` かを示す。
- `観測メモ`: masked summary の材料になった構造メモの件数。ユーザー数ではありません。
- `ブロック / ミュート`: ブロック設定ページ由来とミュート設定ページ由来の観測件数。
- `次に確認すること`: 現在の状態で次に見るべきこと。
- `安全な要約をコピー（masked summary）`: 個人名、ID、本文、token を含めない構造要約だけをコピーする。
- `観測メモを消す`: F1-A 観測メモを消す。

`観測メモ` が `0件` でも、対象ページ外、未ログイン、ページ再読み込み前なら異常ではありません。

## ローカルだけで確認する流れ

1. popup を開く。
2. `ローカル確認用データ` の `テストデータを入れる` を押す。
3. `登録済みの対象` が `0件` 以外になったことを確認する。
4. リポジトリ内の `tests/fixtures/home-timeline.html` を Chrome にドラッグして開く、または Chrome のアドレス欄に file URL として開く。
5. fixture 画面のボタンで `説明だけ表示`、`完全に隠す`、`何もしない` を切り替える。
6. popup の `投稿の扱い` と fixture の表示が対応していることを確認する。
7. 確認後、popup の `テストデータを消す` を押す。

### synthetic fixture で期待する表示

- `何もしない`: 対象投稿の本文がそのまま見える。
- `説明だけ表示`: 対象投稿の本文が消え、説明用の置き換え表示になる。非対象の投稿は残る。
- `完全に隠す`: 対象投稿が画面上で非表示になる。非対象の投稿は残る。
- `テストデータを消す`: ローカル確認用データが消え、対象投稿が通常表示に戻る。

fixture 内の `phase1_*` という値は synthetic test data です。実アカウント情報ではありません。

## 報告に貼ってよい情報

- popup の表示ラベルと件数。
- `監視状態`、`観測メモ`、`ブロック / ミュート`、`次に確認すること` の表示内容。
- `safe` な masked summary の機械判定結果。
- ローカル検証コマンドの結果。
- Load unpacked で出た manifest エラーの文面。
- synthetic fixture の表示が期待どおりかどうか。

## 貼ってはいけない情報

- X のアカウント名、表示名、handle、user_id。
- 投稿本文、プロフィール文、スクリーンショット内の個人情報。
- raw response、HAR、DevTools Network の本文。
- Cookie、CSRF token、Authorization header、OAuth token、password、MFA code。
- `.env`、credentials、auth.json、session ファイルの中身。

迷った場合は貼らず、`未確認` として報告してください。
