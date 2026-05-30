# F1-A MAIN world hook feasibility research

## 目的

Phase 1.5 では、`/settings/blocked/all` と `/settings/muted/all` で X/Twitter のページ内部 `fetch` / `XMLHttpRequest` レスポンスを `MAIN` world hook で構造的に捕捉できるかを検証する。

この検証は Phase 2 の取得経路選定のための研究ゲートであり、本番用のブロック・ミュート一覧同期は実装しない。

## 対象ページ

- `https://x.com/settings/blocked/all`
- `https://x.com/settings/muted/all`
- `https://twitter.com/settings/blocked/all`
- `https://twitter.com/settings/muted/all`

## 実装した hook strategy

- 設定ページ専用の content script `src/research/f1-a/content-bridge.js` を `document_start` で読み込む。
- 研究用設定 `xtbmF1AResearch.enabled` が `true` のときだけ、background service worker へ注入要求を送る。
- background service worker `src/background/research-background.js` が `chrome.scripting.executeScript` を `world: "MAIN"` で実行し、ページ側の `window.fetch` と `XMLHttpRequest.prototype.open` を最小 wrapping する。
- `MAIN` world hook は `chrome.*` API を呼ばない。
- `MAIN` world から isolated content script へは `window.postMessage` だけで sanitized observation を渡す。
- isolated content script は `Storage.appendF1AResearchObservation()` を通じて `xtbmF1AResearch` に保存する。
- `xtbmEntries` には書き込まない。

## 保存する情報

保存対象は構造サマリだけに限定する。

- `pageKind`: `blocked` / `muted` / `unknown`
- `requestKind`: `fetch` / `xhr`
- HTTP method
- status class: `2xx` など
- endpoint class: origin、masked path、query key 名だけ
- query key 名
- JSON top-level key 名
- JSON shape path 名
- 配列 path と件数
- hook continuity marker: `hookRunId`
- `user_id` 風 field の有無
- handle / screen name 風 field の有無
- cursor 風 field の有無

保存しない情報:

- raw response body
- request / response header
- Cookie
- CSRF token
- Authorization header
- OAuth token
- raw user_id
- raw handle
- 表示名
- 投稿本文
- screenshot
- HAR / network log

## ローカルで潰した不確実性

実 X ログインページに入らなくても、次はローカル検証できる。

- `src/research/f1-a/main-world-hook.js` を Node VM simulator で読み込み、synthetic `fetch` / `XMLHttpRequest` の JSON shape を masked observation に丸めること。
- `hookRunId` が同一 hook 内の blocked / muted observations に残り、SPA continuity 判定材料になること。
- raw-looking user id、handle value、display name、cursor value が simulator output に残らないこと。
- `src/research/f1-a/observation-utils.js` が storage 用 observation を再 sanitize し、raw-looking summary を `unsafe_summary` と判定すること。
- `tests/fixtures/f1-a-masked-summary.fixture.json` が実測ではなく fixture として `fixture_pass` になること。

ローカル検証コマンド:

```powershell
node tests/scripts/verify-phase1-static.mjs
node tests/scripts/verify-f1a-observation-safety.mjs
node tests/scripts/verify-f1a-main-hook-simulator.mjs
node tests/scripts/evaluate-f1-observation.mjs tests/fixtures/f1-a-masked-summary.fixture.json
```

## injection timing

実装上は `document_start` の isolated content script から background service worker へ要求し、`world: "MAIN"` で注入する。

ただし、実ページで初期 request より前に hook が入るかは未確認。手動検証では次を分けて確認する。

- 対象ページを開く前に popup で `F1-A 観測を開始` を有効化し、対象ページを新規ロードする。
- 対象ページ上で有効化したあと refresh する。
- 直接ロード時に初期 request が欠落するかを見る。

## SPA navigation 維持

hook には `window.__xTbmF1AMainWorldHookInstalled` の idempotency guard を置いた。

SPA 遷移で `window` が維持される限り hook は残る想定だが、実ページでの維持可否は未確認。手動検証では blocked と muted の相互遷移で masked observation が増えるかを確認する。

## 観測結果

2026-05-20 時点では、実 X ログイン状態のページ検証は行っていない。以下は scaffold 実装後の記録テンプレートであり、実データ由来の endpoint / shape は未確認。

### blocked page

- endpoint observed: 未確認
- response shape summary: 未確認
- user_id-like field presence: 未確認
- handle-like field presence: 未確認
- cursor-like pagination presence: 未確認
- pagination / scrolling behavior: 未確認
- initial direct-load capture: 未確認
- SPA navigation after hook: 未確認

### muted page

- endpoint observed: 未確認
- response shape summary: 未確認
- user_id-like field presence: 未確認
- handle-like field presence: 未確認
- cursor-like pagination presence: 未確認
- pagination / scrolling behavior: 未確認
- initial direct-load capture: 未確認
- SPA navigation after hook: 未確認

### blocked / muted 差分

- endpoint class difference: 未確認
- response shape difference: 未確認
- pagination behavior difference: 未確認

## 手動検証手順

この手順は人間がログイン済み Chrome で実施する。Codex はログイン待ち、masked summary 入力待ち、DevTools Network 本文待ちをしない。

1. Chrome で `chrome://extensions` を開く。
2. `Developer mode` を有効にする。
3. `Load unpacked` で `D:\Agent\Codex\Projects\012_x-true-block-mute\` を読み込む。既に読み込み済みなら `Reload` を押す。
4. 拡張 popup を開き、`F1-A 観測メモ（開発用）` の `F1-A 観測を開始` を有効にする。
5. `https://x.com/settings/blocked/all` を開く。ログインが必要な場合は、人間が Chrome 上で直接ログインする。Codex に password、MFA、Cookie、token を渡さない。
6. ページを refresh する。
7. 一覧を少し scroll し、追加読み込みが起きるかを見る。
8. 拡張 popup を開き、`観測メモ` と `ブロック / ミュート` の件数が増えたかだけを見る。
9. popup の `次に確認すること` を読み、足りない側の設定ページがあれば確認する。
10. popup の `安全な要約をコピー（masked summary）` を押す。コピー対象は masked summary だけで、raw response は含めない。
11. 必要なら `tmp\masked-summary.json` のような repo 内 ignored temp path に masked summary だけを置く。raw response、Cookie、CSRF、token、HAR、screenshot は置かない。
12. `https://x.com/settings/muted/all` に SPA 遷移または直接移動し、同じ確認をする。
13. `twitter.com` equivalents が reachable なら同じ手順で確認する。
14. 記録する場合は raw value を書かず、endpoint は `endpoint-1` などのラベル、shape は top-level key 名と field presence だけにする。
15. 検証後、popup の `観測メモを消す` を押す。

## masked summary 判定手順

popup の `安全な要約をコピー（masked summary）` で得た JSON だけを使う。raw response、DevTools Network log、HAR、screenshot は使わない。

fixture の確認:

```powershell
node tests/scripts/evaluate-f1-observation.mjs tests/fixtures/f1-a-masked-summary.fixture.json
```

この結果は `fixture_pass` であり、実 X での F1-A 採用根拠にはしない。

実 X 由来の masked summary を評価する場合:

```powershell
node tests/scripts/evaluate-f1-observation.mjs --live path\to\masked-summary.json
```

判定:

- `unsafe_summary`: raw-looking 値が混入している可能性がある。共有せず削除する。
- `unknown`: observations がない。`F1-A 観測を開始` を有効化し、blocked / muted を再確認する。
- `f1a_insufficient`: 不足項目がある。F1-A primary には進めない。
- `fixture_pass`: synthetic fixture としては通った。実測根拠ではない。
- `f1a_viable`: `--live` 付きの masked 実測が機械条件を満たした。ただし Chrome Web Store review risk と保守性は別途判断する。

## privacy and review risks

- `scripting` permission と background service worker は Phase 1.5 の研究注入のためだけに追加した。
- `webRequest`、`cookies`、`tabs`、`activeTab`、`<all_urls>`、`https://api.x.com/*` は追加していない。
- response body は clone / parse のため一時的にメモリ上で読むが、raw value は保存、表示、console 出力しない。
- Chrome Web Store review では、`MAIN` world の network hook が高リスクに見える可能性がある。Phase 2 で採用する場合は、ユーザー操作で明示的に同期を開始する設計、最小ページ限定、保存値の redaction 方針、権限理由の説明が必要。
- X 側の内部 endpoint / response shape は非公開仕様であり、破壊的変更のリスクが高い。

## real DOM author matching limitation

Phase 1 の通常 content script にある handle 抽出は、synthetic fixture とローカル確認用の補助です。実 X DOM の author identity を保証するものではありません。

- 投稿カード内リンクが投稿者本人、quote 元、埋め込み対象、profile card、関連リンクのどれを指すかは未確認。
- quote / embedded target を production 品質で除外する処理は未実装。
- real-DOM author matching は Phase 2 以降の別 task として扱う。
- この F1-A research scope では real-DOM 著者判定ロジック、MutationObserver 挙動、本番同期処理は変更しない。

## F1-A judgment

未確認。

理由:

- safe local static validation までは可能だが、実 X ログインページの blocked / muted 内部 response は未観測。
- endpoint class、shape、pagination、initial injection timing、SPA navigation 維持が実測できていない。

## Phase 2 recommendation

defer decision。

Phase 2 で F1-A を primary にするには、少なくとも blocked と muted の両方で次が masked observation として確認される必要がある。

- stable identifier として使える `user_id` 風 field が存在する。
- handle / screen name 風 field が補助情報として存在する、または `user_id` だけで Phase 2 の matching が成立する。
- cursor 風 pagination があり、scroll / next page で追加取得を検知できる。
- `document_start` 注入または refresh 前提の運用で初期 request の欠落を許容できる。
- SPA 遷移後も hook が維持される、または遷移ごとに再注入できる。
