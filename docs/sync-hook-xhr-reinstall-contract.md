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
加えて、宣言的script全体が同一documentで再評価されても、既存hookの公開APIと
wrapper所有権を失わず、teardown / 再install後も処理を1世代に保つ。
公開installed flagはprivateなhook ownershipを写すmirrorに限定し、falseへdriftしても
同じAPIまたはscript再評価がwrapperを重ねない。反対にprivate stateが無い場合は、
公開flagだけがtrueでもfresh installを妨げない。
外部 `open` wrapperがnative相当処理への委譲前後にDONEを同期送出する場合も、
正常復帰していない次requestへ旧本文・新本文を対応付けない。

## 影響

- 1つの hook 世代では、同じ XHR object を複数回 `open()` しても listener は
  1回だけ登録し、最後の request state を1回だけ処理する。
- 稼働中に同じ `sync-hook.js` が再評価された場合は、既存の公開APIとhook世代を
  正本として保持する。新しいclosureでAPIだけを上書きせず、既存APIのuninstallが
  元の `fetch` / `XMLHttpRequest.open` を復元できる状態を保つ。
- 同じAPIのprivate `installedHook` がactiveなら、公開installed flagがfalseでも
  wrapper identityを変えず、flagだけをtrueへ自己修復する。script再評価も既存APIの
  private active ownershipを問い合わせて同じAPIとwrapperを再利用する。
- private active ownershipが無い場合は公開installed flagをinstall guardに使わない。
  flagだけがtrueへdriftしたfresh contextでも通常どおりwrapperをinstallし、
  uninstallで元の `fetch` / `XMLHttpRequest.open` を復元する。
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
- 次request stateは `originalOpen` の正常復帰後だけ有効化する。委譲中は
  旧request stateも次request stateも本文の正本にせず、外部wrapperが委譲前に
  送出した旧DONEを新URLへ誤適用しない。
- 外部wrapperがnative委譲後・正常復帰前に新DONEを同期送出した場合は、その場では
  本文を読まず、正常復帰後の `readyState` 再確認で1回だけ処理する。DONE送出後に
  wrapperが同期throwした場合はrequest stateを有効化せず、本文・messageを0件に保つ。
- XHRごとのopen coordinatorはinstall世代をまたいで共有し、`depth`、tree token、
  `delegating` / `committed` phase、曖昧性を一元管理する。delegation `depth > 0` 中に
  active世代のnested openを検出した時点で、世代を問わずtree全体をambiguousに固定し、
  tokenを消す。innerが同期DONE後に正常復帰してもstateをcommit・即時処理しない。
- ambiguous treeはinner / outerがreturnまたはthrowしてdepthが0へ戻るまで維持し、
  同じtreeの復帰処理では再armしない。後続の独立top-level openだけが新tokenを作り、
  正常復帰後に `committed` へ進める。
- このfail-closed境界では、nested openを含むtree内に実際は対応可能なeligible responseが
  あっても同期対象から落とす可能性がある。誤ったURLで本文を読む／messageを送ることを
  避けるためのavailability tradeoffであり、次の独立top-level openで回復する。
- 現世代wrapperから外部wrapperへ委譲中はinactive旧wrapperを1回だけ通す。
  外部scriptが保持したinactive旧wrapperをcommit後に直接呼んだ場合は、現世代wrapperを
  迂回する新requestとして共有tokenを破棄し、現世代stateを本文の正本にしない。
- inactive旧wrapperも通常のwrapper鎖／retained関数の直呼びを問わず、その
  `originalOpen` 委譲を同じcoordinatorのdepthへ `try/finally` で計上する。
  直呼び配下のactive nested openも独立top-levelと誤認せず、同じtreeをambiguousにする。
- 1回のdelegation中に同じinactive旧wrapperを複数回通った場合は、どのnative openが
  最終requestか証明できない。共有tokenを破棄し、外側stateもfail closedに無効化する。
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
- 同じscriptを2回評価しても公開APIとwrapper identityは初回のまま変わらず、
  そのAPIでuninstallすると元の `fetch` / `XMLHttpRequest.open` を復元する。
  続く再install後のeligible responseは本文読取・`sync-entries`とも各1回に保つ。
- 同じAPIの稼働中に公開installed flagをfalseへ変更して再installしても、fetch / openの
  wrapper identityは変わらず、flagをtrueへ戻し、uninstallはnativeを復元する。
- 稼働中の公開installed flagをfalseへ変更してscriptを再評価しても、既存APIと
  fetch / open wrapperを保持し、flagをtrueへ戻す。
- private stateが無いfresh contextで公開installed flagだけをtrueにしてもinstallを行い、
  uninstallでnative fetch / openへ戻す。
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
- 外部wrapperがnative相当の `open` へ委譲する前に旧non-list DONEを同期送出しても、
  旧本文を次のeligible URLとして読まず、message送信を0件に保つ。正常復帰した
  次requestは、その後のDONEで本文読取・message送信を各1件に保つ。
- 外部wrapperがnative委譲後・return前に新DONEを同期送出して正常復帰した場合は、
  return後の再確認で本文読取・message送信を各1件に保つ。同じDONE送出後に
  wrapperが同期throwした場合は、本文読取・message送信を各0件に保つ。
- 外部wrapperの委譲後DONE中に先行page listenerが同じXHRをnon-list requestへ
  再openしても、外側eligible openの遅い復帰時に曖昧なstate全体を破棄する。後続の
  non-list DONEで本文読取・message送信を各0件に保つ。
- 外部wrapperの委譲前DONE中に先行page listenerが同じXHRをeligible requestへ
  再openし、その後に外側non-list openがnative委譲されても、内側stateを最終request
  と誤認せず全体を破棄する。後続のnon-list DONEで本文読取・message送信を各0件に保つ。
- 同じ委譲前DONE listenerがhookをuninstall / reinstallしてから同じXHRをeligibleへ
  再openしても、世代共有tokenにより新世代stateを無効化する。その後に外側non-listが
  native委譲・DONEへ進んでも、本文読取・message送信を各0件に保つ。
- 外側の委譲前DONEから再入した内側eligible openが、委譲後DONEを同期送出して
  正常復帰しても、共有depthが外側の未復帰を示すため内側stateをcommitしない。
  同世代とuninstall / reinstall後の新世代で、本文読取・message送信を各0件に保つ。
- ambiguous tree全体がdepth 0へ戻った後、同じXHRを独立top-level eligible openへ
  再利用すると、新tokenで再armし、本文読取・message送信を各1件に回復する。
- retained inactive旧wrapperをtop-levelで直接呼び、その委譲前DONEから現世代の
  inner eligible openが同期DONEまで正常完了しても、inactive ancestorの共有depthにより
  innerをcommitしない。tree unwind後の独立現世代openだけ各1件に回復する。
- 現世代でeligible stateをcommitした後、外部scriptが保持したinactive旧世代
  `open` を同じXHRへ直接呼んでnon-list requestを開始しても、共有tokenを無効化する。
  後続DONEで本文読取・message送信を各0件に保つ。
- 現世代のdelegation鎖で同じinactive旧世代 `open` が2回呼ばれ、最後のnative requestが
  non-listになっても、曖昧なstateをcommitしない。後続DONEで本文読取・message送信を
  各0件に保つ。通常の1回だけのinactive世代通過はeligible responseを各1件処理する。
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
