# sync hook の XHR 再利用・再 install 契約

## 目的

`PHASE2-HOOK-PRODUCTION` の明示 teardown / 再 install 契約を、同じ
`XMLHttpRequest` object が hook 世代をまたいで再利用される場合にも成立させる。
現行実装の object 共通フラグは旧世代の listener を「登録済み」と誤認し、
再 install 後の eligible response を読まない可能性がある。
さらに、ページ側が hook より先に通常の DONE `readystatechange` listener を登録し、
その listener 内で同じ XHR object を再openすると、hook が元responseを読む前に
共有request stateが次requestへ更新される。今回の Class M 修正では、この登録順でも
最初の eligible response を取りこぼさないことを目的とする。

## 影響

- 1つの hook 世代では、同じ XHR object を複数回 `open()` しても listener は
  1回だけ登録し、最後の request state を1回だけ処理する。
- 正常応答の `load` 中にページ側の通常 listener が同じ XHR object を次の
  request へ再利用しても、再初期化前の URL と本文を1回だけ対応付けて処理する。
  次 request の URL を前 response に誤適用せず、eligible response の取りこぼしも
  起こさない。
- ページ側の先行 listener が DONE 中に同じ XHR object を再openした場合、
  hook は `originalOpen` が response を初期化する直前に未処理の前requestを確定する。
  通常の DONE listenerで処理済みなら、request単位の `handled` 状態で二重処理しない。
- request state は hook 世代ごとの `WeakMap` に閉じ、XHR object上の公開expandoを
  URL・読取可否・処理済み状態の正本にしない。
- method / URL 検査や外部wrapperにより `originalOpen` が同期throwした場合、
  provisional request stateを破棄してfail closedにする。失敗requestのURLも
  直前requestのstateも、その後に残るresponseへ誤適用しない。
- 初回 `readystatechange` listener登録が同期throwした場合も、provisional
  request stateを公開しない。listenerが実際には登録済みか判別できないため、
  同じhook世代では再登録せず、重複listenerより当該XHRの本文未読を優先する。
- uninstall は旧世代を inactive にし、in-flight response の本文を読まない。
- 再 install 後に既存 XHR object を再利用した場合、現世代の listener を1回だけ
  登録する。旧世代 listener は残っていても本文を読まず、messageを送らない。
- listener 所有は hook 世代ごとの `WeakSet` で管理し、XHR object 上の公開
  expando flagへ依存しない。
- 外部scriptが旧 `wrappedFetch` / `wrappedOpen` を保持していても、inactive世代は
  requestを次wrapperへ1回委譲した後、入力URLを評価せず、Promise callback /
  listenerを追加しない。外部wrapperの所有権は上書きしない。
- 権限、endpoint、抽出項目、storage schema、実 X データの扱いは変更しない。

## 検証

- uninstall 前に開いた XHR が、uninstall 後の DONE `readystatechange` に
  到達しても本文を読まない。
- 同じ XHR を再 install 後に開き直すと、本文を1回だけ読み、
  `sync-entries` を1件だけ送る。
- hook上に外部 `open` wrapperを置いてからuninstall / 再installしても、新規XHRの
  `readystatechange` listenerは現世代の1件だけで、外部 `open` 呼出しも1回に保つ。
- hook上に外部 `fetch` wrapperを置く同じ世代遷移でも、入力URL getterは現世代
  だけが評価し、本文読取・message・外部 `fetch` 呼出しを各1回に保つ。
- 同一世代内の XHR 再open、fetch再install、off-settings / non-list
  no-read、tail / initial sync契約を維持する。
- ページ側が hook より先に通常の `load` listener を登録し、その listener 内で
  同じ XHR を non-list request へ開き直す synthetic case でも、hook が最初の
  eligible response を1回だけ読み、`sync-entries` を1件だけ送る。
- ページ側が hook より先に通常の `readystatechange` listener を登録し、その
  listener が DONE 時に同じ XHR を non-list request へ開き直す synthetic case でも、
  hook が listener 登録順に依存せず最初の eligible response を1回だけ読み、
  `sync-entries` を1件だけ送る。
- eligible URLへの `originalOpen` が同期throwしても、そのURLを直前のnon-list
  DONE responseへ適用せず、本文読取・message送信を0件に保つ。元の例外は再throwする。
- 外部wrapperがnative相当の `open` へ委譲した後で同期throwしても、直前のeligible
  stateを新しいnon-list responseへ復元せず、本文読取・message送信を0件に保つ。
- `addEventListener` が初回だけ同期throwしても、登録を再試行せず、残った
  non-list DONE responseの本文読取・message送信を0件に保つ。元の例外は再throwする。
- ローカル Chromium の synthetic Blob XHR で、DONE `readystatechange` →
  ページ `load` listener の再open → `loadend` の順を実測し、DONE 時点だけが
  最初の固定 synthetic response を保持することを確認する。
- ローカル Chromium では実通信を行わない合成 `readystatechange` もdispatchし、
  XHR target上では後から登録したcapture listenerが先行する通常listenerを
  追い越さないことを実測する。capture順序を修正根拠にしない。
- network error / abort のstatus 0 DONEでは本文を読まず、messageも送らない。
  abort後は実ブラウザと同じく最終 `readyState` をUNSENT (`0`) としてモデル化する。
- synthetic fixtureと静的10本だけを使い、live X、raw response、実アカウント、
  screenshot、Network本文を使用しない。
