# CODEX 引継ぎプロンプト — TrueBlock & Mute（x-true-block-mute）

> このファイルは Codex（自律的な主開発者）が本リポジトリで開発を再開するためのリポジトリ内ハンドオフです。
> 現行のユーザー指示、グローバル `AGENTS.md`、本リポジトリの `AGENTS.md` を優先し、本書は現状・検証・次タスクを補完します。
> 本書と `AGENTS.md` が食い違う場合は、現在の `AGENTS.md` に合わせて本書を更新することを最初の自走タスクにしてよい（§11・§6 参照）。
> **§10 データ保護不変条件** と **§9 4ゲート** は、どの作業でも上書きできない最優先ルール。

初版: 2026/06/19 ／ 最終更新: 2026/07/29 ／ リポジトリ: 本リポジトリ root（remote `origin` = `github.com/h8nc4y/x-true-block-mute`、default branch `main`）

---

## 1. あなた（Codex）の役割

- **あなたは自律的な主開発者**です。「タスク選定 → 実装 → 自己検証（check:all 緑）→ 敵対的自己レビュー → 日本語コミット → PR」までを**承認待ちなしで自走**してよい。
- **例外は4つだけ**＝§9の **人間承認ゲート**。これに該当する操作は必ず停止してオーナー（あなたの委譲元の人間）の承認を待つ。
- **フロントのビジュアルデザインも担当する**。配色・書体・レイアウトの方針から実装、a11y、実レンダー検証まで進める。§12 は停止・人手仲介用ではなく、判断根拠と受け入れ基準を整理する内部メモとして使う。
- **レビューは原則あなたのセルフレビュー**（check:all 緑 ＋ §8 の敵対的自己レビュー）。外部相談は materially useful なときだけ使う。廃止済みの `agmsg` は使わず、復活させない。
- 報告・ユーザー向け文章は**日本語**。冒頭に JST タイムスタンプ `YYYY/MM/DD HH:MM:SS` を付ける（PowerShell: `[System.TimeZoneInfo]::ConvertTimeBySystemTimeZoneId([DateTime]::UtcNow,'Tokyo Standard Time').ToString('yyyy/MM/dd HH:mm:ss')`）。
- **テスト結果・コマンド出力・commit hash・PR URL を捏造しない。** 未確認は「未確認」と書く。

---

## 2. プロダクト概要

**TrueBlock & Mute** は X(Twitter) 向けの Chrome 拡張（Manifest V3）。X 純正のブロック/ミュートでは漏れる露出経路（**他人のリポスト・引用ツイート経由で流れてくる、自分がブロック/ミュート済みアカウントの投稿**）をタイムライン上で非表示にする。

- 想定利用者 = **VTuber 配信者**（ブロック/ミュートを多用し、配信画面に出すタイムラインをクリーンに保ちたい層）。UI・ストア文言は**非エンジニア向け**。
- **完全ローカル**。外部送信ゼロ・バックエンドなし・解析/トラッキング/広告なし。権限は `storage` ＋ x.com/twitter.com ホストのみ。
- 最終目的 = **Chrome Web Store 一般公開**。
- 動作: ユーザーが X の設定ページ（`/settings/blocked/all`・`/settings/muted/all`）を開いて下までスクロールすると、自分のブロック/ミュート一覧を取り込み（`user_id`/`handle`/`listKind` のみ）、タイムライン側でその著者の投稿カードを非表示／中立プレースホルダに差し替える。

---

## 3. アーキテクチャ要約

権限（`manifest.json`）: `permissions: ["storage"]` のみ。`host_permissions: ["https://x.com/*","https://twitter.com/*"]`。**background service worker は無い**。`scripting`/`webRequest`/`cookies`/`tabs`/`activeTab`/`<all_urls>`/`api.x.com` は**禁止**（§9/§10）。

content_scripts（宣言的・3 登録）:
1. **sync-bridge（ISOLATED）** — `…/settings/blocked|muted/all*` 限定。`constants.js`+`storage.js`+`sync-bridge.js`、`document_start`。`chrome.storage` へ保存。
2. **timeline filter（ISOLATED）** — 上記設定2ページを `exclude_matches` した全 X ページ。`constants.js`+`storage.js`+`content-script.js`(+`content-script.css`)、`document_idle`。DOM フィルタ本体。
3. **sync capture hook（`world:"MAIN"`）** — 設定2ページ限定。`sync-capture.js`+`sync-hook.js`、`document_start`。ページ文脈で `fetch`/`XHR` をラップ（`chrome.*` 不可）。

データフロー:
```
設定ページをスクロール → X が GraphQL(BlockedAccounts/MutedAccounts) を発行
 → sync-hook.js(MAIN) が応答をラップし extractSyncEntries() で {user_id,handle,listKind} のみ抽出
 → window.postMessage({source:"x-tbm:sync:capture", kind:"sync-entries"|"sync-complete"}, location.origin)
 → sync-bridge.js(ISOLATED) が source 検証→staging。sync 有効時のみ
       sync-entries  → Storage.upsertSyncedEntries()（追記マージ）
       sync-complete → Storage.replaceSyncedListKind()（末尾到達時のみ全置換＝ブロック解除を反映）
 → chrome.storage.local: active xtbmSyncEntries:<generation>
                          （+ xtbmBaseEntries / xtbmSyntheticEntries
                            / xtbmLegacySyntheticEntries / legacy xtbmEntries
                            / xtbmSyncEnabled / xtbmSyncLastSyncedAt
                            / xtbmSyncGeneration / xtbmSyncMigrated）
 → storage.onChanged → content-script.js が targetUserIds/Handles を再構築しカード走査→差し替え（可逆）
```

主要モジュール（`src/`）:
- `shared/constants.js` — 共有名前空間 `globalThis.XTrueBlockMute`、`STORAGE_KEYS`、`SYNC_MESSAGE_SOURCE="x-tbm:sync:capture"`、`DISPLAY_MODES`（既定 `placeholder`）、`SYNTHETIC_ENTRIES`、機能フラグ `LOCAL_TEST_UI_ENABLED=false`／研究 UI フラグ（既定 false）。
- `storage/storage.js` — 唯一の storage 抽象。同一 JavaScript context 内は `runExclusive` で直列化し、context をまたぐ削除と同期の競合は generation 別 shard で分離する。generation pointer は clear だけが更新し、旧操作の cleanup は live active shard を除外する。旧 single-key は base / legacy synthetic fallback / initial shard の全書込み後に commit を公開し、stale full-object set ではなく旧 key 全体を remove する。現行 synthetic は専用 key、`enabled` / `lastSyncedAt` は field 別 key へ分ける。`upsertSyncedEntries`（user_id 主・handle 副の重複排除＋handle-only の昇格）、`replaceSyncedListKind`（listKind 単位の全置換＝reconcile）、`clearSyncedEntries`、synthetic/sync-state ヘルパ。
- `content/content-script.js` — タイムライン DOM フィルタ。`extractAuthorHandle` は最上位 `[data-testid="User-Name"]` 領域に限定し**引用コンテナを除外**（引用/埋め込み/メンションを著者と誤認しない）。`processQuotedCards` は host が安全でも引用先が対象なら引用カードだけ隠す。`MutationObserver`＋`storage.onChanged` で SPA 遷移に追従。差し替えは可逆。
- `sync/sync-capture.js` — MAIN-safe な純ロジック（`chrome.*` 無し・単体テスト可）。`listKindFromUrl`／`extractSyncEntries`（深さ20・ノード20000上限・WeakSet 循環ガード、`legacy.`/`core.` 両形に対応、cursor/表示名は読まない）／`hasTimelineEntries`。
- `sync/sync-hook.js` — MAIN フック。`fetch`/`XHR` を冪等ラップ（`window.__xTbmSyncHookInstalled`）。cursor を持たない初回 list request の正常応答では、request variables を含めず固定の `sync-start` を entries より先に同一オリジンへ postMessage する。
- `sync/sync-bridge.js` — ISOLATED 受信。`event.source===window`＋source 検証。`sync-start` で該当 listKind の staging だけを新しい全走査へ切り替え、pagination / tail-only refetch では前回の完全集合を保持する。空 staging では reconcile しない**安全弁**（誤った完了でリストを消さない）。
- `popup/popup.js`・`options/options.js` — 設定 UI／透明性ページ。`storage.onChanged` で自動更新。

ストレージキー: `chrome.storage.sync.xtbmSettings`（enabled/displayMode）、`chrome.storage.local.xtbmEntries`（移行前 single-key、commit 後 whole-key remove）、`chrome.storage.local.xtbmBaseEntries`（legacy/manual 専用）、`chrome.storage.local.xtbmSyntheticEntries`（現行 synthetic 専用）、`chrome.storage.local.xtbmLegacySyntheticEntries`（移行済み synthetic fallback）、`chrome.storage.local.xtbmSyncEntries:<generation>`（同期 raw user_id/handle＝端末内のみ）、`chrome.storage.local.xtbmSyncGeneration`（clear 専用の非機密 active pointer）、`chrome.storage.local.xtbmSyncMigrated`（全 entry domain の二段階移行 commit）、`chrome.storage.local.xtbmSyncEnabled` / `xtbmSyncLastSyncedAt`（field 別同期状態。旧 `xtbmSyncState` は読取互換）、`chrome.storage.local.xtbmF1AResearch`（旧研究の masked 専用・本番未使用）。

---

## 4. リポジトリの現状（2026-07-29 時点）

- **version `1.1.1`**（`manifest.json` が真実。`minimum_chrome_version:111`）。`dist/TrueBlock-Mute-v1.1.1.zip` は生成済み（`dist/` は gitignore・再生成可）。
- **Chrome Web Store: 公開済み**（store item ID `anpgfamnbjoajbapfeclnjkklbcoknkb`、2026-06-14 にオーナーが「審査のため送信」→ 公開ページの最終更新 2026-06-18・公開版 v1.1.1。2026-07-06 にオーナーがダッシュボードで公開を確認し、エージェントが公開ストアページで version / 掲載文を確認。旧状態「提出済み・審査結果待ち」は公開で解消）。Codex は Chrome Web Store の管理画面確認・再提出・公開操作を行わない。
- `TASKS_BACKLOG.md` は現行トラッカー（P2 系列は全 done/closed）。2026-07-15 の読取専用レビュー3所見は、sync staging、storage lane、reserved paths の順に synthetic TDD で再現・解消した。判断理由と残る境界は `docs/deferred-findings-register.md` に同期済み。
- 2026-07-21 に PR #40（現況・所見台帳同期、merge commit `3155c63`）を merge。続く PR #41 では同一ページ再同期の staging lifecycle を、cursor 無し initial request の固定 `sync-start` と synthetic 回帰で修正した。
- 2026-07-23 に `REVIEW-2026-07-15-STORAGE-LANE` を TDD で再現。同期行を generation 別 shard へ分離し、popup clear 後の stale upsert は旧 shard だけを cleanup / reject する。4 context の連続 clear 中も最新 shard を保持し、旧 single-key は失敗再試行可能な二段階移行後に whole-key remove、base / synthetic / sync は別 key、同期状態は field 別 key とした。retired cleanup の一時失敗後も active generation を止めず次回 clear で再処理する回帰を固定した。
- 2026-07-24 に `REVIEW-2026-07-15-RESERVED-PATHS` を Class M の synthetic-only TDD で再現。User-Name 領域の `/hashtag`、`/intent`、`/lists`、`/communities` が同名 target を author と誤認して4カードを隠す RED を確認後、既知 route 先頭語を予約集合へ追加した。既存 author 2件＋quote 1件の置換を保ち、予約 path 4件を表示維持する headless Chromium 回帰と静的10本を PASS。権限・データソース・外部送信・公開版は変更していない。
- 2026-07-25 に `REVIEW-2026-07-25-SYNC-ENDPOINT-PATH` を Class M の synthetic-only TDD で再現。設定ページ上の無関係な GraphQL URLでも query 値に operation 名があれば本文読取へ進む RED を確認し、許可 origin と GraphQL operation pathname を厳密化した。相対 list URL の互換を保ち、query-only operation と `api.x.com` は本文読取前に拒否する。実 X・raw response・新権限・公開操作は使っていない。
- 2026-07-26 に `PHASE2-HOOK-PRODUCTION` の Class M bounded reviewで、uninstall前からあるXHR objectを再install後に再利用すると、旧世代の公開flagにより現世代listenerを登録できないREDをsynthetic再現した。listener所有をhook世代ごとの`WeakSet`へ分離し、旧世代は本文を読まず、現世代が1回だけ処理する契約を固定した。さらに外部`fetch` / `open` wrapperが旧hookを保持する経路でも、inactive世代はrequest委譲後にURL評価・callback / listener追加をせず、世代数に比例するnoop処理の蓄積を防ぐ。
- 2026-07-27 に同じ bounded review を継続し、ページ側の通常 `load` listener が同じXHRを次requestへ開き直すと、`loadend` 時点の共有metadataが次URLへ上書きされて直前のeligible responseを取りこぼすREDをsynthetic再現した。成功応答の処理をDONE `readystatechange` へ移し、後続の`load` listenerによる再初期化前にURLと本文を1回だけ対応付ける回帰を固定した。ローカル Chromium のsynthetic Blob XHRでも DONE→load再open→loadend の順と、DONE時点だけが元responseを保持することを確認した（PR #46、merge `cef39f5`）。
- 2026-07-28 に同じ bounded review を継続し、hookより先に登録された通常のDONE `readystatechange` listenerが同じXHRを再openすると、hook処理前にrequest stateを上書きしてeligible responseを取りこぼすREDをsynthetic再現した。capture listenerで登録順を追い越せないことをローカル Chromiumの `normal,capture` 順で確認し、request stateを世代別`WeakMap`へ分離したうえで、再入`open()`がnative responseを初期化する直前に未処理responseを1回確定する。listener登録、native validation、外部wrapperの同期throwでは曖昧なstateを破棄して本文をfail closedに未読とする回帰も固定した（PR #48、merge `454c32b`）。
- 2026-07-28 に `POST-2026-07-28-BROWSER-EVIDENCE` を test-only Class M で完了。既存 Chromium harness を、options page の `390x844 / 768x1024 / 1280x900` responsive probe、主要 text / control の readability、session 別の bounded Runtime / console / failed-request 収集へ拡張した。collector 自体の synthetic error 3種を先に検出する false-green 防止を含む headless Chromium 73 checks と、3枚の full-page screenshot 目視で横 overflow・実pageの runtime/page error・console error・failed request が各0であることを確認した。独立レビューで検出した watchdog cleanup 迂回と exit 0 race、通常 cleanup 不完了の false-green、taskkill helper の未評価を修正。watchdog terminal latch、cleanup failure 集約、bounded taskkill の timeout / exit code / redacted stderr / helper exit 確認を追加した。さらに pre/post-spawn error を `spawn` event / PID で分離し、spawn 後 error は実 exit まで settle せず、grace 後は exact helper PID へ再送する。race・profile status failure・taskkill timeout / nonzero・helper spawn / post-spawn / kill error の自己試験はいずれも非 0、PID / profile / helper 残存なしを実測した。PR #50（head `30d490a`、merge `232d12e`）で統合済み。GitHub の check rollup と `main` push run はともに0件で、今回の変更を検証する remote CI 証跡は存在しない。2026-07-29 の exact merge commit `232d12e` 初回 run は静的10本と headful Chromium 73 checks を PASSし、6枚の synthetic screenshot を目視、3 viewport の横 overflow と popup / home fixture / real-DOM / options 3幅の6つの機能確認 session で runtime/page error・console error・failed request が各0、cleanup 完了、一時 profile と対象 Chromium process の残存が各0だった。一方、証跡保存用の同条件再実行では機能73件が全て PASSし `Browser.close=ok`、`childExited=true`、`profileRemoved=true`、残存各0だったにもかかわらず、終了競合で `taskkill` と fallback が exit 128 となり cleanup failure に集約され runner は exit 1。`POST-2026-07-29-BROWSER-CLEANUP-RACE` では観測済み summary が旧判定で失敗するREDを固定し、既知 no-process exit 128 を Browser.close・tree試行・child終了・profile削除・helper正常終了の全条件付きでのみ benign とする純関数へ分離した。primaryはfallback判断前のchild終了も必須とし、終了済みならfallbackを省く。exit 23 / timeout / helper異常 / child・profile未完了はfail-closedに維持。policy本体追加直後の通常Chromium 73件はexit 0、fallback前child-exit制御追加後のforced exit 23はexit 1、最終静的10本もPASSし、各runの残存process/profile各0を確認した。実 X・権限・製品 UI・公開版は変更していない。
- OS temp には旧 harness 由来の `xtbm-tb002-*` profile が46件残存（active process 利用0、今回の試験で作ったものとは分離確認済み）。direct child / non-reparse を検証して削除しようとしたが実行ポリシーに拒否されたため、迂回・再試行せず削除0件で残置した。現行 harness の合否や current cleanup 証跡を妨げる blocker ではない。
- 2026-07-29 実測で `node scripts/check-all.mjs` は静的10本 PASS。docs は現行資料と歴史資料（`docs/archive/`）を分離済みで、分類索引は `docs/README.md`。
- プロダクト機能は完成し公開済み（本番同期・実DOM著者照合・reconcile・popup/options・プライバシーポリシー JA/EN・allowlist パッケージ）。以後は公開後運用（`docs/review-response-playbook.md` §3〜§4）と、`docs/requirements-v2-2026-07.md` §7 のオーナー未回答質問（Q3〜Q7: 公開範囲・告知・サポート窓口・費用・v1.2 優先度）への回答待ちが主戦場。CI workflow の追加・Chrome Web Store 操作・release/tag は §9 ゲート。
- v1.2 候補（**実装しない・オーナー承認待ち＝§9④**）: 同期忘れ/鮮度切れの警告 UI（仕様は `docs/requirements-v2-2026-07.md` §5 に定義済み）、初回オンボーディング、Firefox 移植。
- ブランチ: `main`（＋ `feature/*`・`research/*`・`backup/*` の旧ブランチは温存。merge/delete しない）。

## 5. 自走ループ（毎タスクの手順）

1. **タスク選定** — §11 の候補と「現状」から1件選ぶ。§9ゲートに触れるものは選ばない（触れるなら停止して承認要求）。
2. **ブランチ作成** — `main` から切る（例 `feature/<slug>`・`docs/<slug>`・`fix/<slug>`）。`main` へ直接コミットしない。
3. **実装** — 既存のコード様式・コメント密度・命名・日本語UI文言に合わせる。フロントの新規ビジュアル設計が要るなら **§12 ブリーフを書いて停止**。
4. **自己検証** — §6 の **check:all（静的10本）を緑**にする。Chromium 系（実機ロード/スクショ）は本タスクで必要かつローカルで実行可能な場合だけ bounded に実行し、未実行なら「未確認」と明記する。live X の DOM/Network/スクショ読み取りは §10 に従って行わない。
5. **敵対的自己レビュー** — §8 の手順で自分の差分を批判的に点検し、見つけた問題を直す。
6. **日本語コミット** — §7 の規約。
7. **PR** — `gh` で PR を開く。本文は日本語（背景/変更点/検証結果/§9該当有無/未確認事項）。§7 の merge 方針に従う。
8. **報告** — 中央 dev-log に直接追記できる環境では追記する。書き込み拒否または単独転記が必要な場合は、§14 の `## 開発ログ報告（Obsidian用）` ブロックを応答末尾に出す。

着手前に関連ドキュメントを読む順: `AGENTS.md`（不変条件）→ `CODEX_HANDOFF.md`（本書・現状）→ `README.md`（コマンド一覧）→ `manifest.json` → `docs/privacy-threat-model.md` → 対象 `src/`／`tests/`。`TASKS_BACKLOG.md` は現行トラッカーなので、タスク状態が変わったら更新する。

---

## 6. 検証ハーネス（check:all の定義）

`package.json` は**無い**。各検証は `node` と `node:` 標準だけで実行（npm install 不要・必ず終了）。リポジトリ root から、通常は一括 harness を使う。

### あなた（Codex）が sandbox で実行する「check:all」＝静的10本（コミット前に毎回）
```powershell
node scripts/check-all.mjs
```

実行順を表示するだけなら:
```powershell
node scripts/check-all.mjs --list
```

一括 harness は次の10本を順番に実行し、最初の失敗で停止する。`verify-package` は最後（`dist/` に zip を書き出すため）。
```
node tests/scripts/verify-phase1-static.mjs
node tests/scripts/verify-docs-consistency.mjs
node tests/scripts/audit-operational-alignment.mjs
node tests/scripts/verify-f1a-observation-safety.mjs
node tests/scripts/verify-f1a-main-hook-simulator.mjs
node tests/scripts/verify-sync-extraction.mjs
node tests/scripts/verify-sync-hook.mjs
node tests/scripts/verify-sync-bridge.mjs
node tests/scripts/verify-storage-sync-schema.mjs
node tests/scripts/verify-package.mjs
```

PowerShell で個別実行へ戻す場合の fallback:
```powershell
foreach ($s in @('verify-phase1-static','verify-docs-consistency','audit-operational-alignment','verify-f1a-observation-safety','verify-f1a-main-hook-simulator','verify-sync-extraction','verify-sync-hook','verify-sync-bridge','verify-storage-sync-schema','verify-package')) { node "tests/scripts/$s.mjs"; if ($LASTEXITCODE -ne 0) { Write-Error "FAILED: $s"; break } }
```
各本の検査内容（要点）:
- `verify-phase1-static` — 必須ファイル存在・JS 構文・**権限ロック**（`permissions===["storage"]`／禁止権限不在）。
- `audit-operational-alignment` — **ガバナンス/プライバシー不変条件の監査**。AGENTS.md/README/popup HTML/研究・decision docs が必要語彙（masked-summary 評価語、資格情報境界の一文、popup ラベル `ローカル確認用データ`／`詳細設定・プライバシー`）を保持し、fixture に raw らしき文字列が無いことを確認。**ドキュメントを編集したら必ず再実行。**
- `verify-docs-consistency` — README/manifest/docs の整合・禁止権限が docs に明記・gate 状態語・storage キー名・CL-AUDIT/PHASE2 ID 列挙を確認。
- `verify-package` — manifest/HTML 参照 ⊆ ALLOWLIST(18)・禁止パス不在・実 ZIP 妥当性。
- `verify-f1a-*`／`verify-sync-*`／`verify-storage-sync-schema` — 抽出・フック・bridge・schema の安全性/正しさを `node:vm` で検証。
- `verify-storage-sync-schema` の競合操作は各1.5秒、suite 全体は20秒、`scripts/check-all.mjs` の各 child は60秒で timeout し、callback 未完了や未解決 Promise を false-green／無期限待機にしない。

権限ロックは **3本（phase1-static / audit / docs-consistency）が独立に**監視。権限を変えると3本とも落ちる（＝§9①/§10 の機械的ガード）。

### 追加で実行できる場合だけ行うもの（Chromium 必須・実測時のみ報告）
- `node tests/scripts/verify-extension-load-chrome.mjs` — 実機ロード/popup/フィルタ（Playwright キャッシュ Chromium `chromium-1223`、`XTBM_CHROME_PATH`/`XTBM_HEADLESS=1` 上書き可。branded Chrome 137+ は `--load-extension` 不可）。
- `node scripts/make-screenshots.mjs` — ストア用スクショ（synthetic のみ・実 X 不使用）。
- `node scripts/make-icons.mjs` — 純 Node だがアイコン再生成はブランド変更時のみ（ブランド色は §12 のロック値）。
- `node tests/scripts/evaluate-f1-observation.mjs <file>` は引数必須の CLI 評価器で **check:all には含めない**。

> 注意: check:all の必須条件は静的10本。Chromium 実機ロードやスクショ生成は環境依存なので、実行した場合だけ viewport・console・結果を実測として報告し、未実行なら「未確認」と明記する。これは捏造禁止（§1）の帰結。

ビルド/パッケージ: `node scripts/build-package.mjs`（決定論 ZIP）→ `node tests/scripts/verify-package.mjs`。zip の**アップロード/公開は §9① の人間ゲート**。

---

## 7. コミット・ブランチ・PR・merge 方針

### コミットメッセージ（日本語）
- 形式: `type(scope): 日本語の要約`。`type`/`scope` は英語トークンを踏襲（`feat` `fix` `refactor` `docs` `chore` `style` `test` `harden` 等／scope は `popup` `content` `sync` `storage` `options` `ui` `package` `docs` 等）、**要約本文は日本語**。必要なら `(M7 / P2-019)` のようにマイルストーン/タスク ID を併記。
  - 例: `fix(sync): 末尾未到達時の早期 reconcile を防止`／`docs(backlog): M5 完了状態に整合（P2-012/013/014）`
- 本文に**実データ・raw handle・user_id・token・secret を書かない**（§10）。未確認は「未確認」。
- コミットフッタに `Co-Authored-By:` を付ける運用がある場合はそれに従う（捏造の Hash/URL は書かない）。

### ブランチ / PR / merge
- 必ず `main` からブランチを切る。PR は `gh` で開き、本文は日本語で「背景・変更点・検証結果（check:all 結果＋Chromium 分の扱い）・§9該当の有無・未確認事項」を含める。
- **merge 方針（オーナー確定・2026-06-19）**: check:all 緑＋セルフレビュー済みで **§9 ゲートに該当しない** PR は、あなたが `main` へ **self-merge してよい**（承認待ち不要＝自走）。**§9 ゲートに該当する変更を含む PR は merge せず PR で停止**し、オーナー承認を待つ。
  - 判定に迷う（ゲート該当か不明）場合は merge せず PR で停止し確認する。将来オーナーが「全 PR は人間が merge」へ切替えた場合のみ、その指示が本書より優先。
- 旧ブランチ（`feature/*`・`research/*`・`backup/*`）は温存。勝手に merge/delete しない。

---

## 8. セルフレビュー（既定）

各 PR 前に、自分の差分を**敵対的に**点検する。最低限の観点:
- **プライバシー/権限**: 新たな権限・ホスト・外部送信・raw 値の docs/log/commit 流出が無いか（§9③/§10）。manifest 差分が出たら即停止して再点検。
- **正しさ**: 境界条件・冪等性・競合（storage の read-modify-write は `runExclusive` 経由か）・SPA 遷移・X DOM 構造依存（`data-testid` 変化耐性）。
- **回帰**: 既存 fixture/検証で守られている不変条件を壊していないか。check:all を**実際に**走らせて緑を確認（結果を貼る）。
- **可逆性**: フィルタ差し替えは restore で戻るか。
- **過剰実装の排除**: スコープ外変更・死にコード・不要な抽象を足していないか。
自分で潰せない不確実性が残るときだけ §13 で外部レビューを依頼する。

---

## 9. 人間承認ゲート（4つ・自走の唯一の例外）

以下に該当する操作は**実装/実行せず停止**し、日本語で「何を・なぜ・差分要約・想定リスク・rollback」を提示して承認を待つ。PR は開いてよいが merge/実行はしない。

1. **デプロイ / GitHub Actions / リリース・tag** — `git tag`、リリース用 version bump の公開、`.github/workflows` の新規/変更、Chrome Web Store への zip アップロード・送信・公開、その他「外向きに出る」操作。
2. **課金 / 有料 API** — 有料サービス契約・課金が発生する API 利用・デベロッパー費用等。
3. **secret / 実素材 / 実データの外部送信** — 認証情報・Cookie・token・実 user_id/handle/表示名/本文・raw 応答・HAR・個人を含むスクショを、端末外（クラウド/外部レビュー/ダッシュボード/ネットワーク）へ出すこと。masked 化されていても X 由来の実データの外部送信は停止。
4. **製品要件の変更** — スコープ/対象ユーザー/データソース方針（例 F1-B DOM 抽出・F1-D import UI の採用、新権限の必要化）・プライバシー方針・ストア掲載方針の変更。

> 迷ったら停止して聞く方が安全。ゲートは「不可逆・外向き・費用・要件」を守るための線引きで、通常のコード/ドキュメント自走を妨げない。

---

## 10. データ保護・プライバシー不変条件（最重要・常時・上書き不可）

- secret / OAuth 資格情報 / Cookie / CSRF token / Authorization header / password / MFA code / 実データ / 個人データを**読まない・記録しない・コミットしない**。
- raw X response / HAR / DevTools Network 本文 / 個人情報を含む screenshot / raw user_id / raw handle / 表示名 / 本文を、clipboard / fixture / docs / log / commit / PR / 外部レビューに**含めない**。
- 本番同期 shard（`xtbmSyncEntries:<generation>`、旧形式は `xtbmEntries`）の raw user_id/handle は**端末内 `chrome.storage.local` 限り**。docs/fixture/log/commit/clipboard へは出さない。境界詳細は `docs/privacy-threat-model.md`。
- x.com/twitter.com タブでは screenshot・DOM テキスト読取・network response 読取を行わない。ライブ X の masked observation 収集は Claude Code(Chrome MCP) がオーナー同意下で行う担当で、**Codex はやらない**。
- 権限は `storage` ＋ x.com/twitter.com ホストに固定。`webRequest`/`cookies`/`tabs`/`activeTab`/`<all_urls>`/`api.x.com` を足さない（足すなら §9④＋脅威モデル更新＋承認）。
- `evaluate-f1-observation.mjs` が `unsafe_summary` を返したら処理を停止し当該 summary を削除。
- 検証スクリプトは必ず終了する（`read`/`pause`/`watch`/`tail -f`/`while true`/`sleep infinity` 等で待機しない）。

---

## 11. 次の一手（タスク候補・着手順）

**まず認識**: Chrome Web Store 公開済みで、工学的な launch blocker も外部ブロッカーも無い。フェーズは**公開後運用**。実装系の大タスク（v1.2 警告 UI 等）は §9④（要件変更）でオーナー承認待ちのため、Codex が自走で価値を出せるのは、公開操作に触れない範囲の**ドキュメント整合・ローカル検証の保守・限定的なコード健全性レビュー・不具合報告対応の準備**。

自走可（§9に触れない）・推奨着手順:
1. **ハンドオフ/トラッカー整合の維持** — `CODEX_HANDOFF.md`、`AGENTS.md`、`TASKS_BACKLOG.md`、`README.md`、`docs/deferred-findings-register.md` が同じ現状を指すよう保つ。古い ChatGPT 承認制、`storage + scripting` 旧記述、`TASKS_BACKLOG.md` 陳腐化前提、Vault 書き込み不可前提、「審査待ち」旧状態を再導入しない。
2. **ローカル検証ハーネス保守** — 静的10本が、権限・外部送信・raw 値禁止・ハンドオフ drift を検知し続けるようにする。ドキュメント編集後は `audit-operational-alignment.mjs` と `verify-docs-consistency.mjs` を必ず再実行。
3. **公開後の不具合報告対応（`docs/review-response-playbook.md` §3〜§4 の runbook 実行）** — ユーザー報告が来たら「48時間以内一次判断・14日以内修正版 zip 作成」の指標で動く。報告から raw handle/user_id/スクショを受け取らず、synthetic fixture 化 → 修正 → check:all 緑 → zip 生成まで。**ストアへの再提出・公開はオーナー（§9①）**。
4. **`PHASE2-HOOK-PRODUCTION` の bounded review** — MAIN-world hook の lifecycle / teardown / idempotency はローカル fixture と静的レビューだけで扱う。明示 teardown、in-flight停止、再 install 契約、tail 厳格化（PR #34）、安全な全走査開始検出（PR #41）、exact GraphQL endpoint pathname gate（2026-07-25）は固定済み。今後も新権限・新データソース・raw response 取得・live X 読み取りはしない。
5. **オーナー回答の文書反映** — `docs/requirements-v2-2026-07.md` §7 の Q3〜Q7（公開範囲・告知・サポート窓口・費用・v1.2 優先度）への回答が共有されたら、要件 v2 の確定・backlog への v1.2 タスク起票・掲載文言の改善計画に反映する。回答が来るまで v1.2 実装には着手しない。
6. **CI の草案作成のみ** — `.github/workflows` の新規作成・変更は §9① に該当するため、workflow を有効化しない。必要なら静的10本を走らせる CI 手順の Markdown 草案までに留める。

人間ゲート（自走しない・停止して提示）:
- Chrome Web Store の一切の操作（掲載文更新・再提出・公開設定・ダッシュボード確認はオーナー）。
- v1.2 スコープ承認（警告 UI・オンボーディング・Firefox 移植は §9④。仕様案は要件 v2 §5 に定義済み）。
- 新権限・新データソース（F1-B/F1-D）・プライバシー方針変更（§9④）。
- 端末外送信・deploy・有料サービス（§9②③）。

## 12. デザイン判断メモ雛形

新規ビジュアル設計（配色/書体/レイアウトの創出・作り直し）が必要になったら、以下を埋めて判断根拠と受け入れ基準を固定し、そのまま実装と検証へ進む。

**設計の不変制約（メモに必ず明記・逸脱不可）**:
- アイデンティティ = わんコメ(OneComme)/BOOTH/FANBOX 風＝**白基調＋オレンジ系アクセント**、ピル型ボタン・角丸カード・余白広め・フレンドリー（エラー調にしない）。対象 = VTuber/配信者・非エンジニア。
- **AA コントラスト必須**。テキスト付きオレンジ面は明色 `#f08300`（白文字 2.64:1＝不可）を使わず**濃色 `#b85600` 系**（白文字 4.81:1）を使う「2 オレンジ分離」を維持。
- フォントは**システムスタック（JP 対応）**: `system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", "Hiragino Kaku Gothic ProN", "Noto Sans JP", Meiryo, sans-serif`。Web フォント追加は要相談。UI 言語は日本語。
- **X/Twitter のロゴ・固有色を使わない**（商標配慮）。タイムライン内に挿入する placeholder は「拡張の主張を抑えた中立カード」に保つ。
- 現行トークンは `:root`（`src/popup/popup.css`・`src/options/options.css`）に定義。主要値: `--accent:#f08300`（小面アクセント限定）/`--accent-strong:#b85600`（文字面）/`--accent-ink:#a85400`（リンク）/`--bg-page:#fff8f0`/`--surface:#fff`/`--surface-tint:#fff6ea`/`--border-soft:#f1e2cf`/`--text:#3a3f47`/`--text-strong:#222a30`/`--text-muted:#5e6672`/`--radius-lg:16px`。content-script はトークン未使用でハードコード（placeholder: border `#f6dcae`/bg `#fff7ec`/text `#6b4a25`/左帯 `#f08300`）。ブランドマーク `icons/icon.svg` = `#f08300`＋濃紺 `#102445`（紺は**マーク専用**・UI 不使用）。

```
## デザイン判断メモ
- 日時 / 対象タスク:
- 対象サーフェス: [ popup(372px) / options(640px) / content-script placeholder / アイコン ] のどれか
- 目的（何を・なぜ。非エンジニア/VTuber 視点で）:
- 変更したい点 / 維持したい点:
- 不変制約（上記を再掲・特に AA と 2 オレンジ分離・システムフォント・X 商標不使用・ローカル中立トーン）:
- 現状の課題（スクショ参照: store-assets/store-3-popup.png 等。実データを含むスクショは出さない）:
- 受領したい成果物の形式:
    - カラートークン表（4–6 hex・各用途・白/黒文字のコントラスト比 AA 明記）
    - タイプスケール（display/body の font-size/weight/line-height）
    - レイアウト指示（カード/余白/角丸/ボタン形状の指針、各サーフェスの構造）
    - シグネチャ要素（あれば 1 つ）
- 受け入れ基準（実装後に満たすべき: AA 比の実測・既存 check:all 緑・3 サーフェス整合）:
- スコープ外（今回触らないもの）:
```

決定したデザイン仕様に沿って実装した後は、`make-screenshots.mjs` をローカル Chromium で実行できた場合だけストア用スクショの再生成結果を PR に明記し、未実行なら「未確認」と書く。

---

## 13. 外部レビュー/相談ブロック雛形

セルフレビューで潰し切れない不確実性が残るときだけ、下記要点で利用可能なレビュー手段を使う。廃止済みの `agmsg` は使用・復活させない。**差分や説明に実データ・raw handle・user_id・token を含めない**（§10）。

```
## 外部レビュー/相談
- 日時 / 対象ブランチ・PR:
- レビュー種別: [ 正しさ / セキュリティ・プライバシー / パフォーマンス / 設計 ] から選択（複数可）
- 変更の要約（何を・なぜ）:
- 重点的に見てほしい点（具体的な懸念・自分で判断がつかなかった箇所）:
- 触れたファイル一覧:
- check:all 結果: [ 静的10本: 緑/赤・赤なら詳細 ] / [ Chromium 分: 実行結果または未確認 ]
- 制約（レビュアーが守るべき前提）: 権限は storage のみ・外部送信ゼロ・raw 値を出力に含めない・§9 ゲート不可侵
- 差分（プライバシー安全な形で。実データを含む箇所はマスクする）:
```

---

## 14. 報告（開発ログ Obsidian 用ブロック）・参照

中央 dev-log に直接追記できる環境では、当日 `daily/` へ短く追記する。書き込み拒否・単独転記・別ツールへの委譲が必要な場合は、**作業応答の末尾に以下を出力**する。secret/token/実データは書かない。

```
## 開発ログ報告（Obsidian用）
- やったこと:
- 学び・詰まり・解決:
- 検証結果（実測のみ・捏造しない。未実行は「未確認」）:
- §9 ゲート該当の有無 / 停止して承認待ちの項目:
- 次回:
- 関連: [[topic-slug]] / #tag
```

### 主要参照ファイル
- docs 索引: `docs/README.md`（現行資料の分類。歴史資料は `docs/archive/` に分離済み）
- ガバナンス/運用: `AGENTS.md`（不変条件）、`CODEX_HANDOFF.md`（本書・現状メモ）
- タスク/要件: `TASKS_BACKLOG.md`（現行トラッカー）、`docs/requirements-v2-2026-07.md`（要件定義書 v2）、`docs/deferred-findings-register.md`、`docs/decisions/f1-source-selection.md`
- 公開後運用: `docs/review-response-playbook.md`（不具合報告 runbook・却下対応表）
- コマンド一覧: `README.md`（Static validation / Packaging 節）
- プライバシー/脅威モデル: `docs/privacy-threat-model.md`、`docs/privacy-policy.md|.html`、`docs/store-listing.md`
- 検証/ビルド: `tests/scripts/*.mjs`(12)、`scripts/build-package.mjs`／`make-icons.mjs`／`make-screenshots.mjs`、`tests/fixtures/*`
- ソース: `src/{shared,storage,content,sync,popup,options}/*`、`manifest.json`
