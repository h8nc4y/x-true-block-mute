# Claude Code 独立再レビュー — 012_x-true-block-mute（2026-06-21）

> 本ファイルは Claude Code (Opus 4.8) による 2026-06-21 時点の独立再レビュー結果です。Codex はこのファイルを参照してください。
> レビューに際してソースコード/資材は一切変更していません（docs への本ファイル追加のみ）。
> 本レビューは advisory です。既存の CLAUDE_REVIEW.md / AI_REVIEW_TRIAGE.md / CODEX_TASKS.md フローに対する、独立した最新の所見です。

## 2026/06/25 Codex補足

このレビューは 2026-06-21 時点の静的所見です。sync hook の response scope hardening は `d3ef0f8` として実装され、PR #10 merge commit `95bf09b` で現行 `main` に統合済みです。
本レビュー内で H-1 を未対応として扱っている箇所は履歴的な所見として読み、最新状態は現行 `src/sync/sync-hook.js`、`tests/scripts/verify-sync-hook.mjs`、`docs/deferred-findings-register.md`、`TASKS_BACKLOG.md` で再確認してください。実 X 応答本文・raw user data・Chrome Web Store 審査結果・追加権限・外部送信は引き続きゲートです。

## レビュー範囲と方法

精読した主要ファイル（read-only）:

- ルート文書: `README.md`、`AGENTS.md`、`manifest.json`
- docs: `docs/phase2-readiness-gates.md`、`docs/deferred-findings-register.md`
- 出荷コード全体: `src/shared/constants.js`、`src/storage/storage.js`、`src/sync/sync-hook.js`、`src/sync/sync-capture.js`、`src/sync/sync-bridge.js`、`src/content/content-script.js`、`src/content/content-script.css`、`src/popup/popup.js`、`src/options/options.js`
- パッケージング: `scripts/build-package.mjs`（ALLOWLIST 方式）
- テスト: `tests/scripts/verify-sync-extraction.mjs`（他テストはファイル一覧で確認、本文は未精読）

サンプリング/未精読: `CODEX_HANDOFF.md`（28KB、grep のみ）、`TASKS_BACKLOG.md`（grep のみ）、`src/popup/popup.html` / `options.html` / 各 CSS（構造のみ）、`src/research/f1-a/*`（出荷外の研究資材、ALLOWLIST 除外を確認したため未精読）、`tests/fixtures/*` の実データ。`.env`・実トランスクリプト・token 類は AGENTS.md / readiness-gates の境界に従い読んでいません（存在も確認していません）。

前提: コードは静的読解のみ。テスト・ビルド・lint・Chrome ロードは一切実行していません（タスク制約）。「実 X DOM/応答での挙動」は本レビューでは未確認で、docs の M3〜M5 検証記述を一次情報として扱います。

## プロジェクト目標の理解（docsベース）

事実（docs 準拠）: X/Twitter で「自分自身がブロック・ミュートしたアカウント」由来の投稿（リポスト・引用経由を含む）を、タイムライン上で非表示/プレースホルダ化する Chrome MV3 拡張。データは端末内 `chrome.storage` のみ・外部送信なし・権限は `storage` + `x.com`/`twitter.com` host のみ。`/settings/blocked/all` と `/settings/muted/all` の宣言的 `world:"MAIN"` content script がユーザー自身の一覧 GraphQL 応答から `user_id`/`handle`/`listKind` のみを抽出し、ISOLATED bridge 経由で `xtbmEntries` に取り込む（M4）。通常ページの content script が投稿カードの著者を判定し、対象を hidden/placeholder で処理する（M5）。現状は Chrome Web Store 審査結果待ち（M7）。

## 総合評価

健全性: **良好**

プライバシー設計は一貫しており、出荷コードは小さく読みやすい。権限最小化（`storage` のみ、`scripting` は M7 で retire）、出荷 zip の ALLOWLIST 方式（research/tests/docs を確実に除外）、応答本文の読み取りを settings-list ページかつ list-endpoint に二重ゲートする hook、reconciliation の「空キャプチャでは消さない」safety valve、storage 書き込みの直列化（`runExclusive`）など、リスクの高い箇所に的確な防御が入っている。重大な正しさ/セキュリティ欠陥は本静的レビューでは検出されませんでした。

懸念は主に中〜低リスクで、(1) 本番 sync 抽出が「list 応答に含まれる任意の user オブジェクト」を拾う over-broad walk になっており list 以外のユーザー（自分自身・推薦等）を誤って取り込む余地がある点、(2) 著者判定が X の DOM 構造（`data-testid` 固定値）に強く依存し壊れやすい点、(3) README の機能フラグ名が実装と食い違う docs 不整合、です。いずれも「公開を止める」ほどではないが、誤フィルタ（無関係な投稿の非表示）に直結しうるため Codex の確認を推奨します。

## 指摘事項

### 🔴 Critical

該当なし。

### 🟠 High

**H-1. 本番 sync 抽出が list 応答内の「あらゆる user オブジェクト」を取り込む（over-broad walk）**
- `src/sync/sync-capture.js:65-112`（`extractSyncEntries` → `walk`）
- 問題: gate 済みとはいえ、応答全体を深さ20・budget 20000 で走査し、`rest_id`/`id_str`/`user_id` を持つ全ノードを「ブロック/ミュート対象」として `addUser` する。BlockedAccounts/MutedAccounts 応答に、対象ユーザー以外の user オブジェクト（例: ビューア自身、promoted/suggested、quoted 投稿の作者、social context の参照ユーザー等）が混在していた場合、それらも `xtbmEntries` に取り込まれ、その後 `replaceSyncedListKind` の完全置換でも保持される。
- 影響: 誤ってブロック対象に登録された無関係アカウントの投稿が TL で恒久的に非表示/placeholder 化される。ユーザーから見て原因が分かりにくい誤フィルタになる。プライバシー漏えいではない（端末内のみ）が、製品の正しさに直結。
- 推奨対応: 応答 shape を前提に「list の users コンテナ（entries→itemContent→user_results.result 等）配下のみ」を辿る path-scoped 抽出に絞るか、少なくとも「`__typename === "User"` かつ list timeline entry 配下」の条件を課す。現実装の全走査は M4 で件数一致（blocked 234/muted 50）が確認済みとされるが、それは「件数が一致した」だけで「余計な user が 0 件」を保証しない。実応答 shape に対する path 限定の確度確認を推奨。
- 確度: 中（実応答 shape 未確認のため。誤検出が起きるか否かは X の BlockedAccounts/MutedAccounts レスポンス構造に依存）

### 🟡 Medium

**M-1. reconciliation の完了判定が早すぎる/不発になりうる（`hasTimelineEntries`）**
- `src/sync/sync-hook.js:84-98`、`src/sync/sync-bridge.js:82-96`
- 問題: 1ページで user 抽出が 0 件かつ `entryId`/`cursorType` を持つノードがあると `postComplete` を送る。(a) 末尾以外でも「user を含まない中間ページ」（読み込み境界・エラー再試行直後など）が来れば、その時点の staging 全置換で reconcile が走り、まだ読み込んでいない後続ユーザーが一時的に欠落しうる。staging はクリアされないため再スクロールで回復するが、一過性の取りこぼしは起こりうる。(b) 逆に、ブロック一覧が本当に空のユーザーでは staging が空のまま完了 → `staged.length === 0` の safety valve により reconcile されず、過去に取り込んだ古い同期データを「全解除しても」消せない。
- 影響: (a) 一時的な誤フィルタ取りこぼし（軽微、回復可能）。(b) 全ブロック解除後も古い同期データが残り続け、解除済みアカウントが non-target にならない（=不要な非表示は起きないが、stale データが残る）。
- 推奨対応: 「完了」を cursor の `cursorType === "Bottom"` かつ「最終ページ」に限定する、または完了シグナルに「このページで抽出した user 数」を含め bridge 側で「ページ列の末尾に達した」ことをより厳密に判定する。空リスト reconcile は別途「ユーザー明示の同期データ削除」で担保されている（popup/options の clear）ので (b) は許容可だが、docs に「全解除だけでは自動消去されない」と明記すると親切。
- 確度: 中

**M-2. 著者判定が X の DOM 内部構造（`data-testid` 固定値）に全面依存**
- `src/content/content-script.js:81-101`（`extractAuthorHandle`）、`168-181`（`findQuoteContainers`）
- 問題: `[data-testid="User-Name"]`、`[data-testid="Tweet-User-Avatar"]`、`div[role="link"]` 等に依存。X 側がこれらを改名/再構成すると、著者領域が取れず `handleFromLinks` の fallback が card 全体のリンクを走査しないため「対象なのに非表示にならない」（取りこぼし）か、quote 分離が崩れて「host 投稿ごと消える」誤爆になりうる。README/Phase 1 制限でも「real DOM の author identity は保証しない」と明記されている既知のリスク。
- 影響: フィルタ漏れ（露出が残る = 製品価値の低下）または誤爆（無関係投稿の非表示）。安全側は「漏れ」だが、quote 周りは誤爆方向もある。
- 推奨対応: 出荷ブロッカーではない。`data-testid` 変更に対する fail-safe（領域が取れないときは「何もしない」= 現状は概ねそうなっている）を維持しつつ、主要 selector を定数化して 1 箇所で管理し、将来の DOM 変化検知用に「対象一覧があるのに 0 件マッチが続く」状況を dev 検出できる余地を残すと保守しやすい。
- 確度: 中（X の DOM 変更時に顕在化。現時点で壊れている証拠はない）

**M-3. README の機能フラグ名が実装と不一致（docs 不整合）**
- `README.md:10,84` は `RESEARCH_UI_ENABLED`（既定 false）を「`src/shared/constants.js` で true にすると F1-A 観測メモが見える」と案内。実装には `RESEARCH_UI_ENABLED` は存在せず（`constants.js` 全体・全 src を grep して不在を確認）、存在するのは `LOCAL_TEST_UI_ENABLED`（`constants.js:46`、`popup.js:6` で参照）。research UI 自体は M7 で retire 済みで popup には観測メモ要素がない。
- 影響: 機能ではなくドキュメントの正確性の問題。Chrome Web Store レビュアーや将来の開発者が README 通りに操作しても再現せず、混乱や「記述と実装の乖離」の心証を与えうる。
- 推奨対応: README の該当 2 箇所を実態（research UI は retire 済み・存在するのは `LOCAL_TEST_UI_ENABLED` でローカル test-data パネルのみ）に合わせて修正。`tests/scripts/verify-docs-consistency.mjs` がこの種の不整合を検出できているか確認し、できていなければ検査対象に加えることを推奨。
- 確度: 高（grep で実証済み）

### 🟢 Low

**L-1. content-script の処理対象 selector に裸の `article` が含まれる**
- `src/content/content-script.js:7-12`（`CARD_SELECTORS` に `"article"`）
- 問題: フォールバックとして全 `article` を card 候補にするため、投稿カード以外の `article` 要素も走査対象になる。著者が取れなければ何も起きない（安全側）が、無駄な走査と、稀に著者判定が誤マッチする余地。
- 推奨対応: 影響は小さい。`article[role='article']` までに絞れるか確認。確度: 低。

**L-2. `extractSyncEntries` の budget/depth はサイレントに打ち切る**
- `src/sync/sync-capture.js:90`、`hasTimelineEntries` 同様
- 問題: 大きな応答で budget(20000)/depth(20) 上限に達すると静かに walk を止める。極端に大きい一覧で末尾 user の取りこぼし可能性。実用上は問題になりにくい。
- 推奨対応: 現状維持で可。将来 list が巨大化した場合の watch-item として記録。確度: 低。

### 💡 改善提案

- **P-1**: `src/storage/storage.js` の `upsertSyncedEntriesCore` 冒頭コメント（`storage.js:188-189`）に「accounts that disappeared from the list are NOT removed here … deferred to the production sync step」とあるが、実際には `replaceSyncedListKind` で reconcile 実装済み。コメントが旧状態を指しており誤解を招く。コメント更新を推奨（確度: 高、コード挙動には無害）。
- **P-2**: `sync-capture.js` と `storage.js` に `normalizeHandle` が重複定義（MAIN/ISOLATED の world 分離が理由で意図的だが）。意図をどちらかのコメントに明記すると保守者が安心できる。
- **P-3**: 出荷 zip の検証は `verify-package.mjs` がある一方、CI が無い（deferred-findings CL-AUDIT-011 で既知）。公開後の回帰防止として、ローカル検証スクリプト一式をまとめて走らせる単一の npm script / バッチがあると owner 運用が楽（権限変更を伴わないため §9 gate 外）。

## 要件カバレッジ

docs（README / readiness-gates / deferred-findings）の目標に対する達成度:

満たしている点:
- 権限最小化（`storage` のみ、`scripting` retire）: manifest.json で確認。✔
- 端末内のみ・外部送信なし: 出荷コードに network 送信・外部 fetch なし（hook は X の応答を読むのみ、`postMessage` は same-origin、storage は local/sync）。✔
- `user_id`/`handle`/`listKind` のみ抽出・raw/cursor/表示名/本文を保存しない: `extractSyncEntries` は 3 フィールドのみ構築、cursor/表示名の非混入はテストで担保。✔（ただし H-1 の「list 外 user 混入」は別問題）
- 表示モード hidden/placeholder/off と synthetic fixture: content-script / popup で実装確認。✔
- reconciliation（完全同期時の全置換）: 実装確認（ただし M-1 の判定精度に留保）。△
- ALLOWLIST パッケージング: research/tests/docs/scripts/md 除外を build-package.mjs で確認。✔

未達・乖離:
- README の機能フラグ記述が実装と乖離（M-3）。
- 「list 外 user を取り込まない」ことの保証が実応答 shape 依存で未確認（H-1）。
- Chrome Web Store 審査結果は本レビューでも当然未確認。

## セキュリティ・プライバシー所見

- **データ egress 経路**: 出荷コードに外部送信は見当たらない。MAIN hook は `clone().text()` で X 応答を読むが、抽出後 `postMessage(..., location.origin)` で same-origin に限定して bridge に渡すのみ。raw body は storage に書かれない。`storage.js` の書き込みは local/sync のみ。プライバシー境界は設計通りと評価。
- **応答読み取りのゲート**: `shouldReadListResponse` が `isSettingsListPage()`（pathname 完全一致 `/settings/(blocked|muted)/all`）かつ list-endpoint の二重条件。XHR 側も `__xTbmSyncShouldRead` で responseText 触取を抑止。off-settings ページや非 list 応答は読まない設計で、宣言的 content script の matches もこの 2 パスに限定。良好。
- **`postMessage` の受信側検証**: bridge は `event.source !== window` と `data.source !== SYNC_MESSAGE_SOURCE` を確認。送信は origin 限定。任意サイトからの注入リスクは低い（settings ページにしか MAIN hook が載らない）。
- **留意（H-1 再掲）**: プライバシー漏えいではないが、誤って広いユーザー集合を取り込むと「意図しないフィルタ」になる。プライバシー文書（外部送信なし）は守られているが、「取り込む対象＝自分の list のみ」という製品約束の厳密性は実応答 shape 依存。
- **未確認**: 実 X 応答の実際の JSON 構造、実 DOM の testid 安定性、CSP 下での MAIN hook 動作は静的読解では確認不能。

## テスト・検証の所見

- `verify-sync-extraction.mjs` は extraction の正常系・cursor/表示名非混入・dedupe をカバーしており要点を押さえている。ただし「list 外 user（自分自身/suggested 等）を含む応答で余計に拾わない」negative ケースは見当たらず、H-1 を守るテストが欠落。実応答相当の「混在 fixture」での negative test 追加を推奨。
- reconciliation（`replaceSyncedListKind` / bridge の staging・safety valve・`hasTimelineEntries` による完了判定）の境界テスト（中間空ページ、空リスト完了、再スクロール）が本レビューで読んだ範囲では未確認。M-1 の挙動を固定する unit test があると安心。
- 著者判定（quote/embed 分離）の fixture テスト（`real-dom-timeline.html` 等）は存在するが本文未精読。M-2 の DOM 依存性に対し「testid 改名時に誤爆しない（安全側に倒れる）」ことを示すテストがあるか Codex 側で確認を推奨。
- 全テストの実行結果は本レビューでは未取得（実行禁止のため）。PASS/FAIL は未確認。

## 前回レビューからの差分

前回 Claude レビュー（`CLAUDE_REVIEW.md`）はリポジトリに存在しません（glob で不在を確認）。代わりに `docs/deferred-findings-register.md` に過去の CL-AUDIT-006/007/011 等が記録され、多くが M4/M5/M7 で resolved とされています。本レビューは独立の最新所見であり、register の「resolved」主張に対する反証は検出していません（CL-AUDIT-006/007 の MutationObserver / hook lifecycle は現コードで対策が見える）。ただし H-1（over-broad 抽出）と M-1（完了判定）は register に明示の項目が見当たらず、新規所見として扱います。

## Codex への推奨アクション（優先順位付き）

1. **H-1**: `extractSyncEntries` を実応答 shape に基づき path-scoped に絞る（list timeline entry / user_results 配下のみ）。併せて「混在 fixture で list 外 user を拾わない」negative test を追加。最も製品の正しさに効く。
2. **M-3**: README の `RESEARCH_UI_ENABLED` 記述を実態（`LOCAL_TEST_UI_ENABLED` のみ・research UI retire 済み）に修正し、`verify-docs-consistency.mjs` で検出できるようにする。低コスト・高確度。
3. **M-1**: reconciliation 完了判定を `cursorType === "Bottom"`/末尾到達に厳密化、または「全解除では自動消去されない」旨を docs 明記。境界 unit test を追加。
4. **P-1**: `storage.js:188-189` の旧状態コメントを reconcile 実装済みに合わせて更新。
5. **M-2 / L-1**: 著者判定 selector の定数化と `CARD_SELECTORS` の `article` 絞り込み余地を検討（DOM 変化時の保守性向上、急ぎではない）。

いずれも advisory です。実装着手はユーザー承認のうえ `TASKS_BACKLOG.md` への昇格を経て行ってください（AGENTS.md のガバナンスに従う）。権限追加・データソース変更を伴う提案は含めていません。

## 未確認事項

- 実 X の BlockedAccounts/MutedAccounts 応答の実 JSON 構造（H-1・M-1 の確度はこれ次第）。
- 実 X DOM の `data-testid` 安定性と quote/embed 構造（M-2）。
- テストスイートの実行結果（実行禁止のため PASS/FAIL 未取得）。
- `CODEX_HANDOFF.md` / `TASKS_BACKLOG.md` 本文の詳細（grep のみ。最新タスク状態の細部は未追跡）。
- `tests/fixtures/*` の実データ内容、`src/research/f1-a/*`（出荷外）の挙動。
- Chrome Web Store 審査結果、提出 zip のバージョン同一性（README も「未確認」と記載）。
