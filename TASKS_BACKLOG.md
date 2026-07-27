# TASKS_BACKLOG

## Status

最終更新: 2026-07-27

このファイルは現行タスクのトラッカーです。Codex は現行のユーザー指示とハンドオフを優先し、ここではロードマップとタスク状態を実装実態に合わせて記録します。旧 ChatGPT 承認制は廃止済みです。現行ユーザー指示で許可された自律開発の範囲では、Codex / Claude Code が通常の docs・test・code 健全性タスクを進めます。権限追加、Phase 移行、配布、外部送信などの境界変更は人間承認ゲートです。

## Goal

非エンジニアが「インストール → 同期ボタン → タイムラインで効果確認」だけで、自分のブロック・ミュートリスト由来の露出（RT/引用等経由を含む）を減らせる Chrome 拡張を、Chrome Web Store で一般公開する。データはすべて端末ローカル保存・外部送信なし・権限最小（`storage` + x.com/twitter.com host）を維持する。

## Roadmap

```
M1 ──→ M2 ──→ M3(分岐点) ──→ M4 ──→ M5 ──→ M6 ──→ M7
文書/ガバナンス  Chrome自動検証  F1-A live判定  production sync  実DOM filtering  UX仕上げ  Store提出
                                  └─ insufficient（履歴） → M4' (F1-B/F1-D)。現行は F1-A viable で fallback closed
```

| M | 内容 | 規模 | 完了条件 |
| --- | --- | --- | --- |
| M1 | バックログ再編＋ガバナンス文書更新（検証スクリプトと lockstep） | M | 全検証スクリプト pass、新ガバナンス文書化 |
| M2 | Chrome 自動検証ハーネス（TB-002 解消） | M | 拡張ロード＋popup＋fixture フィルタの自動検証 pass |
| M3 | F1-A live masked summary 収集と evaluator 判定 | M | f1a_viable / insufficient の判定確定、decision 更新 |
| M4 | production sync（capture→xtbmEntries、schema v2、同期UX） | L | 実アカウントで blocked/muted 全件同期（件数のみ確認） |
| M5 | 実X DOM author matching＋SPA 対応 | L | 実TLで誤判定なくフィルタ動作 |
| M6 | 非エンジニア向け UX 仕上げ（同期1ボタン、エラー日本語ガイド、research UI 非表示化） | M | 説明書なしで利用フロー完結 |
| M7 | Store 準備・提出（icons、zip、掲載文、プライバシーポリシー、審査対応） | M | 審査通過・公開 |

## Backlog（現行 P2 系列）

| ID | M | タスク名 | 優先度 | 規模 | 状態 | 依存 |
| --- | --- | --- | --- | --- | --- | --- |
| P2-001 | M1 | backlog 再編（本ファイル更新） | 高 | S | done | - |
| P2-002 | M1 | ガバナンス文書改訂（AGENTS / README / gates / threat model / deferred register / research docs） | 高 | M | done | P2-001 |
| P2-003 | M1 | 検証スクリプト lockstep 更新（verify-docs-consistency / audit-operational-alignment） | 高 | S | done | P2-002 と同一コミット |
| P2-004 | M2 | CDP 自動検証スクリプト `tests/scripts/verify-extension-load-chrome.mjs`（依存ゼロ、Playwright キャッシュ Chromium 使用） | 高 | M | done | P2-003 |
| P2-005 | M3 | F1-A live masked summary 収集と `evaluate-f1-observation.mjs --live` 判定 | 高 | M | done: 深検出修正（cursor/identity）後 `f1a_viable` 確認（blocked/muted とも全条件成立、unsafeSignals 空）。 | P2-004 |
| P2-006 | M3 | `docs/decisions/f1-source-selection.md` の decision 確定（viable/insufficient の記録） | 高 | S | done: F1-A を Phase 2 primary に確定。P2-011 fallback は不要化し、closed として記録済み。 | P2-005 |
| P2-007 | M4 | 宣言的 MAIN world `content_scripts` 移行検証（`scripting` permission 削除可否） | 高 | S | done: 宣言的 `world:"MAIN"` content script（minimum_chrome_version 111）で sync hook を注入し実機ロード確認。M7 で research 動的注入（background SW＋content-bridge）を撤去し `scripting` 権限を削除 → permission は `storage` のみ。研究の評価器・f1a テスト・observation-utils/main-world-hook・decision doc はリポジトリに保持し出荷 zip から除外。実 Chromium で storage 単一権限・background なしのロード／popup／フィルタ／options を確認。 | P2-005 |
| P2-008 | M4 | production capture script（user_id / handle / listKind のみ抽出） | 高 | M | done: sync-capture（抽出）+ sync-hook（MAIN捕捉）+ sync-bridge（ISOLATED保存ゲート）。**live 検証で実アカウントの blocked 234件 / muted 50件 を xtbmEntries に取り込み成功**（2026-06-13）。 | P2-006, P2-007 |
| P2-009 | M4 | storage schema v2（upsert / dedupe / listKind / syncedAt / stale 削除 / migration） | 高 | M | done: 基盤＋sync-state（enabled/lastSyncedAt）、upsert・dedupe は live 実証済み。stale reconciliation（完全同期時のみ全置換）を P2-009b で完了。 | source 非依存のため先行実装 |
| P2-010 | M4 | popup 同期導線（同期ボタン・進捗・最終同期時刻・削除） | 高 | M | done: 「ブロック・ミュート同期」セクション（有効化トグル・件数・最終同期・設定ページリンク・削除）。M2 で実機検証。popup の `chrome.storage.onChanged` 自動更新は M6 で実装済み（busy/area/key ガード）。 | P2-008, P2-009 |
| P2-009b | M4 | stale reconciliation（完了検出＝末尾カーソル到達時に全置換、部分時は追加のみ） | 高 | M | done: sync-hook が抽出0件かつ Bottom cursor 到達時だけ `sync-complete` を postし、Top-only cursor ページは完了扱いしない。sync-bridge は session staging を非空時のみ `replaceSyncedListKind` で当該 listKind を全置換（空 staging は安全弁で no-op、reconcile 後も staging 非クリア）。2026-06-27 に M-1 境界テストを追加し P-1 の旧コメントも更新。 | P2-008 |
| P2-011 | M4' | (fallback) F1-B DOM 抽出 または F1-D import UI | 条件付 | M/L | closed: P2-005 が `f1a_viable` となり、F1-A primary 採用で fallback 条件が消滅。新データソース採用は別途 §9 ゲート。 | P2-005 |
| P2-012 | M5 | 実DOM author matching（User-Name 領域限定、quote/embed 除外、全リンク走査の廃止） | 高 | L | done: `e137d04` で User-Name 領域限定・quote-aware 抽出へ更新し、引用/埋め込み/関連リンクを投稿者として誤認しない防御を追加。 | P2-009 |
| P2-013 | M5 | SPA 対応＋MutationObserver 性能改善（CL-AUDIT-006/007 消化） | 高 | M | done: `a0538ae` で SPA 遷移後の取りこぼし防止、detached replacement prune、再走査の安定化を実装。CL-AUDIT-006/007 はトラッカー上 resolved、MAIN-world hook の継続監視は `PHASE2-HOOK-PRODUCTION` に分離。 | P2-012 |
| P2-014 | M5 | 実X DOM 模擬 synthetic fixture 新造＋実TL動作確認（報告は件数のみ） | 高 | M | done: v1.1 系で quote-aware/SPA 回帰確認を実施し、実TL確認は raw 値を出さず件数・結果のみで記録。根拠は `e137d04` / `a0538ae` と README「検証状況」。 | P2-012 |
| P2-015 | M6 | production placeholder 文言・エラー日本語ガイダンス | 中 | S | done: placeholder 文言は本番品質（「この投稿は、ブロックまたはミュート対象のアカウントによるものです（x-true-block-mute）。」）。エラー日本語ガイダンスは options page の「うまく同期できないとき」＋既存 popup メッセージで提供。 | P2-010, P2-012 |
| P2-016 | M6 | options page（entries 管理・プライバシー説明）＋research UI の本番非表示化 | 中 | M | done: research UI 本番非表示化（dev フラグ `RESEARCH_UI_ENABLED`、既定 false。コード・background 注入・`scripting` は保持し M7 で retire）。options page（`src/options/`、`options_ui` 登録、popup から導線）= プライバシー説明・フィルタ対象一覧の透明性表示・同期/テストデータ削除・トラブルシュート。README Phase2 化＋audit lockstep、verify-phase1-static に options 検証追加、Chrome CDP で options 描画も自動検証。 | P2-010 |
| P2-017 | M7 | manifest icons / version / 商標配慮 name 整備 | 中 | S | done: 表示名を中立ブランド「TrueBlock & Mute」に（商標は name に含めず、X (Twitter) は description の互換性表記のみ）。version 1.0.0。アイコン16/32/48/128px は禁止記号（青角丸＋白リング＋スラッシュ）を依存ゼロの生成器 `scripts/make-icons.mjs`（純 Node・SVG ソース `icons/icon.svg` 併置）で生成。manifest に icons＋action.default_icon、UI 文言（popup/options 見出し・placeholder）も改名。実 Chromium で新 name/icons ロード確認。 | - |
| P2-018 | M7 | パッケージ zip 生成スクリプト（allowlist 方式、dist/ 出力） | 中 | S | done: `scripts/build-package.mjs`（純 Node の決定論的 ZIP writer、allowlist 18件、固定 DOS 日付）が `dist/TrueBlock-Mute-v<version>.zip` を出力。research/tests/docs/scripts/*.md/*.svg は同梱しない。`tests/scripts/verify-package.mjs` が manifest/HTML 参照⊆allowlist・禁止パス不在・ファイル存在・ZIP 署名/central-directory 件数を検証（57 checks PASS）。.NET ZipFile で 18 entries の展開・CRC を独立確認。 | P2-016 |
| P2-019 | M7 | プライバシーポリシー文書＋ホスティング URL | 高 | S | done（ホスト/連絡先記入はユーザー）: `docs/privacy-policy.md`（日英併記）＋自己完結 HTML `docs/privacy-policy.html` を作成。実データフロー（端末内のみ・外部送信なし・user_id/handle/listKind のみ・第三者共有/解析なし・権限は storage+host）に正確準拠。連絡先メールはプレースホルダ（公開前にユーザー記入）。ホスティング（GitHub Pages 等）と URL 確定はユーザー作業（README に手順）。 | P2-002 |
| P2-020 | M7 | ストア掲載物一式（説明文・スクショ・single purpose・permissions justification） | 中 | M | done: `docs/store-listing.md`（name/category/summary/詳細説明 日英・single purpose・各権限の justification・CWS データ使用フォーム回答＝端末内のみで収集なし・提出前チェックリスト）。スクショは `scripts/make-screenshots.mjs`（CDP・synthetic のみ・実 X 不使用）で 1280×800 を3枚生成し `store-assets/`（store-1-timeline=placeholder フィルタ実証 / store-2-options / store-3-popup）。実 Chromium で生成・視覚確認済み。 | P2-016, P2-018 |
| P2-021 | M7 | Web Store 提出と審査対応サイクル（デベロッパー登録・決済・最終送信はユーザー） | 高 | M | done: 2026-06-14 にユーザーが「審査のため送信」（store item ID `anpgfamnbjoajbapfeclnjkklbcoknkb`）→ 審査通過・**公開済み**（公開ページ最終更新 2026-06-18・公開版 v1.1.1）。2026-07-06 にオーナーがダッシュボードで公開を確認し、エージェントが公開ストアページで version/掲載文を確認。 | P2-017〜P2-020 |

## 旧 TB 系列タスクの扱い

2026-06-12 までの棚卸し結果（旧ガバナンス時点）。状態変更の根拠は 2026-06-13 のユーザー決定。

| ID | タスク名 | 旧状態 | 現状態 |
| --- | --- | --- | --- |
| TB-001 | 残タスク棚卸しと backlog 作成 | done | done（記録として保持） |
| TB-002 | Chrome Load unpacked と popup の確認 | skip: 人間確認が必要 | done（2026-06-13、P2-004 として実施）。`verify-extension-load-chrome.mjs` で拡張ロード・popup 描画・synthetic fixture フィルタを自動検証し pass。Codex 失敗の主因は branded Chrome 137+ の `--load-extension` 無効化と判明。 |
| TB-003 | F1-A live masked summary 評価 | skip: real X login とユーザー同意が必要 | done: P2-005 に統合。ユーザー同意の下、Claude Code が Chrome MCP で masked observation のみ収集・評価。 |
| TB-004 | Phase 2 source selection と production 実装 | skip: deferred / out of scope | done: M4 / M5（P2-007〜P2-014）として分解し、F1-A primary で実装済み。 |
| TB-005 | F1-C X API / OAuth 連携の再検討 | skip: OAuth 等の承認が必要 | closed（不採用）。F1-A 精度方針の確定により再検討条件が消滅。F1-A insufficient 時も F1-B / F1-D を優先する。 |
| TB-006 | Chrome Web Store / package / CI / distribution readiness | skip: distribution decision が必要 | done: M7（P2-017〜P2-021）として実施。Chrome Web Store は公開済み（公開ページ最終更新 2026-06-18、オーナー確認 2026-07-06）。 |
| TB-007 | local stale branches の扱い確認 | done | done（4本は温存。merge / delete はしない） |
| TB-008 | Claude Code 引き継ぎ用 closeout 文書化 | done | done |

## Validation evidence

現行の検証正本は `node scripts/check-all.mjs`（静的10本一括。コミット前に毎回緑を確認する）。直近の全緑実測は 2026-07-27。M1〜M7 期の個別コマンドのベースライン記録（2026-06-12/13）は、本ファイルの git 履歴旧版を参照。

## Done criteria

当初 Goal（Chrome Web Store 公開）は **2026-06-18 に達成**（オーナー確認 2026-07-06）。以後の done 判定は公開後運用の成功指標（`docs/requirements-v2-2026-07.md` §3: 全リリースで check:all 緑・不具合報告の一次判断 48 時間・修正版 zip 作成 14 日）に従う。live X 検証で `unsafe_summary` が出た場合は停止・削除し、検証結果は実測のみ記録する。

## 変更履歴（要約）

各項目の詳細は該当 PR・`docs/deferred-findings-register.md`・git 履歴を正とする。

- 2026-06-21: レビュー指摘 H-1（sync 抽出の over-broad walk）→ PR #10 で path-scoped 抽出に解消。当時の委譲仕様・所見は `docs/archive/` に保存。
- 2026-06-27〜30: `PHASE2-HOOK-PRODUCTION` の lifecycle hardening 一連（XHR 再open 重複防止 = PR #23、明示 teardown / 再 install 契約 = PR #25）、ハンドオフ drift 検査の `verify-docs-consistency.mjs` への追加（2026-06-28）、`scripts/check-all.mjs` 導入（PR #26）。
- 2026-07-03: 要件定義書 v2（`docs/requirements-v2-2026-07.md`）・市場調査メモ・審査対応プレイブックを追加。
- 2026-07-05: ultracode 本体レビュー → sync-state 直列化（PR #29）・UI 衛生/非提携免責（PR #30）を修正。判断記録は `docs/archive/review-2026-07-05.md`。
- 2026-07-06: **Chrome Web Store 公開確認**（P2-021 done）。sync 完了判定を `isListTailResponse` に厳格化（PR #34、REVIEW-2026-07-05-SYNC-COMPLETE 解消）。
- 2026-07-11〜12: 引き継ぎ資料を公開後フェーズへ同期（PR #35）。docs 全面整理: 歴史資料を `docs/archive/` へ分離、`docs/README.md` 索引を新設、要件 v2 の Q1/Q2 解消を反映。
- 2026-07-15: 読取専用の横断レビュー3所見を PR #39 で台帳化。2026-07-21 に安定 ID・優先順・検証条件を追記し、最上位を sync staging の再現・修正に確定。
- 2026-07-21: PR #40 で現況資料と所見 ID を同期。PR #41 で `REVIEW-2026-07-15-SYNC-STAGING` を TDD 解消し、次の最上位を storage lane の再現性検証へ更新。
- 2026-07-23: PR #42 で `REVIEW-2026-07-15-STORAGE-LANE` を独立 VM 2〜4 context の共有 storage stub で TDD 再現。同期行を generation 別 shard、base / synthetic を専用 key、同期状態を field 別 key へ分離した。popup clear の削除優先、連続 clear 中の最新 shard 保持、旧 single-key の二段階移行失敗と whole-key cleanup、cleanup 一時失敗からの再処理、全競合テストの timeout を固定。
- 2026-07-25: `REVIEW-2026-07-25-SYNC-ENDPOINT-PATH` を synthetic TDD で解消。MAIN-world hook の list 判定を URL 全体の operation 名部分一致から、x.com / twitter.com の exact GraphQL operation pathname へ狭め、無関係な応答本文を query 値だけで読まない回帰を固定した。
- 2026-07-26: `PHASE2-HOOK-PRODUCTION` のbounded lifecycle reviewで、hook世代をまたいで再利用するXHR objectのlistener所有を世代別`WeakSet`へ分離した。uninstall後の旧listenerは本文を読まず、再install後の現listenerが1回だけ処理するsynthetic回帰を固定した。外部`fetch` / `open` wrapperが旧hookを保持する場合もinactive世代は入力URL・callback / listenerを追加処理せず、外部wrapper所有権と現世代の1回処理を維持する。
- 2026-07-27: 同じXHRをページ側の通常`load` listenerが次requestへ再利用すると、`loadend`時点の共有URL metadataが次requestへ上書きされ、直前のeligible responseを取りこぼすREDをsynthetic再現。hookの成功応答処理をDONE `readystatechange`へ移し、後続の`load` listenerによる再初期化前に1回だけ本文を読む契約を固定した。ローカル Chromium のsynthetic Blob XHRでも DONE→load再open→loadend の順序と元response保持境界を実測した。

## 外部レビュー指摘の台帳（2026-07-15 maxエフォート横断レビュー）

読取専用レビュー（実行検証なし）の指摘。2026-07-21 の現況同期でローカル検証対象へ昇格した。実装前に synthetic fixture で妥当性を確認し、完了時は行頭を [x] にして対応 PR を追記する。

- [x] `REVIEW-2026-07-15-SYNC-STAGING` — PR #41 で解消。TDD RED で同一ページの2回目完全同期に前サイクル4件が残ることを再現した。無条件 clear は tail-only 部分ページによる削り落としを招くため採用せず、cursor 無し initial request の正常応答だけが固定 `sync-start` を送り、該当 listKind の staging を新しい全走査へ切り替える。pagination は前回完全集合を保持し、request variables / cursor 値は送信しない。`verify-sync-hook.mjs` / `verify-sync-bridge.mjs` / 静的10本 PASS。
- [x] `REVIEW-2026-07-15-STORAGE-LANE` — `storage.js:16`: context-local lane では、popup clear 後の stale settings upsert による同期行復活と、`setSyncEnabled(false)` / `markSynced()` の full-object lost update を防げないことを TDD RED で再現。同期行を `xtbmSyncEntries:<generation>`、clear 専用 active pointer を `xtbmSyncGeneration`、base を `xtbmBaseEntries`、synthetic を `xtbmSyntheticEntries`、同期状態を field 別 key へ分離した。旧 single-key は base / legacy synthetic fallback / initial shard の全書込み後に `xtbmSyncMigrated` を commit し、stale full-object set ではなく whole-key remove する。途中失敗では legacy 全体を authoritative に保つ。full-replacement `setEntryStore` export は廃止し、fixture も production upsert API を使う。stale writer は旧 shard だけを空にして reject し、4 context の連続 clear 中も最新 shardを保持する。各競合操作と静的10本 runner は timeout 付き。retired cleanup が一時失敗しても active generation は継続し、次回 clear が再処理する。既存 schema/同期回帰を含む静的10本 PASS。
- [x] `REVIEW-2026-07-15-RESERVED-PATHS` — User-Name 領域の synthetic URL と同名 target を組み合わせ、`/hashtag` / `/intent` / `/lists` / `/communities` が author handle 候補へ到達して4カードを誤って隠す RED を実測。4語を `PROFILE_RESERVED_PATHS` へ追加し、予約 path カードを表示維持しながら既存 author 2件＋quote 1件だけを置換する headless Chromium 回帰を固定した。実 X・raw handle/user_id・新権限・新データソースは不使用。`verify-phase1-static.mjs` / `verify-extension-load-chrome.mjs` / 静的10本 PASS。
