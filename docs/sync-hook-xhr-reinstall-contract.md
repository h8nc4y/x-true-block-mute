# sync hook の XHR 再利用・再 install 契約

## 目的

`PHASE2-HOOK-PRODUCTION` の明示 teardown / 再 install 契約を、同じ
`XMLHttpRequest` object が hook 世代をまたいで再利用される場合にも成立させる。
現行実装の object 共通フラグは旧世代の listener を「登録済み」と誤認し、
再 install 後の eligible response を読まない可能性がある。

## 影響

- 1つの hook 世代では、同じ XHR object を複数回 `open()` しても listener は
  1回だけ登録し、最後の request state を1回だけ処理する。
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

- uninstall 前に開いた XHR が、uninstall 後の `loadend` で本文を読まない。
- 同じ XHR を再 install 後に開き直すと、本文を1回だけ読み、
  `sync-entries` を1件だけ送る。
- hook上に外部 `open` wrapperを置いてからuninstall / 再installしても、新規XHRの
  `loadend` listenerは現世代の1件だけで、外部 `open` 呼出しも1回に保つ。
- hook上に外部 `fetch` wrapperを置く同じ世代遷移でも、入力URL getterは現世代
  だけが評価し、本文読取・message・外部 `fetch` 呼出しを各1回に保つ。
- 同一世代内の XHR 再open、fetch再install、off-settings / non-list
  no-read、tail / initial sync契約を維持する。
- synthetic fixtureと静的10本だけを使い、live X、raw response、実アカウント、
  screenshot、Network本文を使用しない。
