# TASKS_BACKLOG

## Status

最終更新: 2026-07-30

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
| P2-019 | M7 | プライバシーポリシー文書＋ホスティング URL | 高 | S | done: `docs/privacy-policy.md`（日英併記）＋自己完結 HTML `docs/privacy-policy.html` を作成。実データフロー（端末内のみ・外部送信なし・user_id/handle/listKind のみ・第三者共有/解析なし・権限は storage+host）に正確準拠。連絡先と想定公開 URL のプレースホルダは 2026-06-14 に解消し、文書は公開済み。連絡先値と URL 値は台帳へ転記しない。公開 URL の現在の疎通とストア管理画面の設定値は本同期では未確認で、今後のストア更新・再提出・公開はオーナーゲートを維持する。 | P2-002 |
| P2-020 | M7 | ストア掲載物一式（説明文・スクショ・single purpose・permissions justification） | 中 | M | done: `docs/store-listing.md`（name/category/summary/詳細説明 日英・single purpose・各権限の justification・CWS データ使用フォーム回答＝端末内のみで収集なし・提出前チェックリスト）。スクショは `scripts/make-screenshots.mjs`（CDP・synthetic のみ・実 X 不使用）で 1280×800 を3枚生成し `store-assets/`（store-1-timeline=placeholder フィルタ実証 / store-2-options / store-3-popup）。実 Chromium で生成・視覚確認済み。 | P2-016, P2-018 |
| P2-021 | M7 | Web Store 提出と審査対応サイクル（デベロッパー登録・決済・最終送信はユーザー） | 高 | M | done: 2026-06-14 にユーザーが「審査のため送信」（store item ID `anpgfamnbjoajbapfeclnjkklbcoknkb`）→ 審査通過・**公開済み**（公開ページ最終更新 2026-06-18・公開版 v1.1.1）。2026-07-06 にオーナーがダッシュボードで公開を確認し、エージェントが公開ストアページで version/掲載文を確認。 | P2-017〜P2-020 |

## 公開後保守キュー

| ID | タスク名 | 優先度 | 規模 | 状態 | 根拠 |
| --- | --- | --- | --- | --- | --- |
| POST-2026-07-30-FETCH-URL-ACCESSOR-SINGLE-READ | fetch inputのURL accessorを1回だけ評価し、browser-owned URLと一致しない分類をfail closedにする | 高 | M | done: `url` getterの2回評価による値変化／2回目throwに加え、実`Request`のown getterが内部HomeTimeline URLを偽BlockedAccounts URLでshadowするP1をsynthetic RED再現。page-visible値は1回だけ読み、初回script評価時に固定した標準`Request.prototype.url` getterの内部URLと完全一致するときだけ本文を扱う。prototype差替え→uninstall / reinstallでも標準getterを再取得しない。外部wrapperがeligibleなRequest／stringを内部HomeTimeline入力へ置換するP1、opaque delegateを捕捉した旧世代をtransparent wrapper経由で次世代がlaunderするP1、foreign wrapper保持中のuninstall後にscriptを再評価して現在のwrapperを新基準として信頼するP1も追加RED再現した。各inactive世代は実入力identityと返却Promiseに加えて、自身のdelegate provenanceを基準fetchまで再帰検証してからancestor proofへ参加する。inactive旧APIが残るscript再評価は同じclosureを再利用する。公開APIのshape getter／Proxy throwはprobe全体で隔離し、shape一致のno-op installは同一API identityとprivate active ownershipの再確認に失敗するためfresh fail-closedへ進む。置換・複数枝・Promise差替え・内側未証明・観測不能は元Promiseを維持して本文・messageを扱わない。透過委譲、既存single-read、in-flight停止、teardown境界は維持。新権限・endpoint・storage schema・live X・raw response・製品UIは不使用。 | PR #59／merge `4138d63`。`verify-sync-hook.mjs` 204 checks＋静的10本 PASS。private-marker delta 0、Gitleaks working tree／108 commits 0、Semgrep 68 rules／2 targets 0、独立review P0–P3なし。 |
| POST-2026-07-29-SYNC-HOOK-PUBLIC-FLAG-DRIFT | 公開installed flagのdriftでactive hookのteardown所有権を失わない | 高 | M | done: 公開flagがfalseのまま同じAPIを再installすると二重wrapし、script再評価では初回APIを上書きしてnative復元を失うREDをsynthetic再現。private `installedHook && active` と既存APIのactive wrapper ownershipを正本にし、同じAPI / 再評価の両経路でwrapper identityを維持してflagをtrueへ自己修復する。private stateなしで公開flagだけtrueのfresh contextはinstallを妨げない。新権限・endpoint・storage schema・live X・raw responseは不使用。 | PR #57 / merge `7407fbf` / `verify-sync-hook.mjs` 148 checks・静的10本 PASS |
| POST-2026-07-29-XHR-OPEN-COMMIT-BOUNDARY | 外部 `open` wrapper 内の同期 DONE と request state の対応付けを fail closed にする | 高 | M | done: 次のeligible stateをdelegate前に公開すると、外部wrapperのpre-delegate DONEが旧non-list本文を新URLとして読み、delegate後DONE→同期throwでもcatch前にmessageを送るREDをsynthetic再現。委譲中はrequest stateを無効化し、`originalOpen` 正常復帰後だけ次stateを有効化した。委譲後・return前の同期DONEは正常復帰後に再確認して1回処理し、throw時は本文・messageを0件に保つ。独立レビューで同期DONE中の再入openをpost/pre-delegate、uninstall / reinstall、commit後のinactive旧wrapper直呼び、同一inactive wrapper二重通過、未復帰active／retained inactive outer配下でinnerが同期DONEまで正常完了する経路と組み合わせてREDを固定した。install世代共有のper-XHR coordinatorはactive／inactive wrapperのdelegationをdepthへ含め、`depth > 0` 中のtree全体をambiguous化してinner / outerのcommit・即時処理を禁止する。tree unwind後の独立top-level openだけ再armするavailability tradeoffを安全側に採用した。新権限・新data source・live X・raw responseは不使用。 | PR #55 / merge `596c4e2` / `verify-sync-hook.mjs` 138 checks |
| POST-2026-07-29-SYNC-HOOK-DOUBLE-EVALUATION | 同一documentでのhook script再評価後もteardown所有権と1回処理を維持 | 高 | M | done: script再評価で公開APIだけが上書きされ、初回hookをuninstallできず、再install後の本文読取とmessageが各2回になるREDをsynthetic再現。稼働中は既存API/hook世代を保持し、uninstallで元wrapperを復元、再install後も各1回に固定した。新権限・新data source・live X・raw responseは不使用。 | PR #53 / merge `49a7c61` |
| POST-2026-07-29-BROWSER-CLEANUP-RACE | Chromium 正常終了と `taskkill` fallback の競合による cleanup false-negative を解消 | 高 | M | done: 観測済み summary が旧 policy で失敗する RED を固定し、既知 no-process exit 128 だけを `Browser.close=ok`・tree試行・child終了・profile削除・helper spawn/exit・helper error不在・redacted診断の全条件で benign とする純関数へ分離。primaryはfallback判断前のchild終了も必須とし、終了済みならPID再利用後の別processを狙わないようfallbackを省く。exit 23 / timeout / helper異常 / child・profile未完了はfail-closed。policy本体追加直後の通常Chromium 73件、最終cleanup制御のforced exit 23非0終了、最終静的10本、残存process/profile各0を確認。 | PR #50 closeout |

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
| TB-007 | local stale branches の扱い確認 | done | done（カテゴリ名や固定本数を正本にせず開始時に再計測し、非祖先または由来未確定の tip は温存する。2026-08-01 再計測の `fix/claude-sync-scope` tip `aa63fb987ab80ebc81596320f825d05487deabae` は由来未確定 residue として merge / delete しない） |
| TB-008 | Claude Code 引き継ぎ用 closeout 文書化 | done | done |

## Validation evidence

現行の検証正本は `node scripts/check-all.mjs`（静的10本一括。コミット前に毎回緑を確認する）。静的10本の直近全緑実測は 2026-07-30。fetch URL single-read＋browser-owned一致＋prototype drift lifecycle＋外部wrapperの再帰的委譲証明＋再評価closure再利用＋公開API probe隔離境界はfocused `verify-sync-hook.mjs` 204 checksをPASSした。PR #53 のexact merge commit `49a7c61` でもhook 101件と静的10本をPASSした。GitHub check rollupとbranch workflow runは各0件で、この変更のremote CI証跡はない。Chromium harness は同日のpolicy本体追加直後（fallback前child-exit制御の最終追加前）の通常 run が73 checksとcleanupを全緑。最終cleanup制御はforced exit 23をcleanup failureに集約して期待どおりexit 1とし、最終静的10本でも契約を確認した。各runで作成したprofileと対象 Chromium processは各0件だった。M1〜M7 期の個別コマンドのベースライン記録（2026-06-12/13）は、本ファイルの git 履歴旧版を参照。

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
- 2026-07-27: 同じXHRをページ側の通常`load` listenerが次requestへ再利用すると、`loadend`時点の共有URL metadataが次requestへ上書きされ、直前のeligible responseを取りこぼすREDをsynthetic再現。hookの成功応答処理をDONE `readystatechange`へ移し、後続の`load` listenerによる再初期化前に1回だけ本文を読む契約を固定した。ローカル Chromium のsynthetic Blob XHRでも DONE→load再open→loadend の順序と元response保持境界を実測し、PR #46（merge `cef39f5`）でmainへ統合した。
- 2026-07-28: hookより先に登録された通常のDONE `readystatechange` listenerが同じXHRを再openし、hook処理前にrequest stateを上書きするREDをsynthetic再現。Chromium実測でcapture listenerも先行listenerを追い越さないことを確認し、request stateを世代別`WeakMap`へ分離した。再入`open()`入口で未処理responseを1回確定し、listener登録・native validation・外部wrapperの同期throwでは曖昧なstateを破棄してfail closedに本文を読まない。94件のhook回帰、静的10本、headless Chromium 30件をPASSし、PR #48（merge `454c32b`）でmainへ統合した。
- 2026-07-28: `POST-2026-07-28-BROWSER-EVIDENCE` を test-only Class M で完了。既存 headless Chromium harness に options page の `390x844 / 768x1024 / 1280x900` responsive probe、主要 text / control の readability、session 別の bounded Runtime / console / failed-request 収集、3幅の full-page screenshot を追加した。collector 自体の synthetic error 3種を検出する false-green 防止を含む73 checks PASS、3枚を目視し、横 overflow・実pageの runtime/page error・console error・failed request は各0。独立レビューで見つけた watchdog cleanup 迂回と exit 0 race、通常 cleanup 不完了の false-green、taskkill helper 未評価を、共有する冪等 cleanup、terminal latch、failure 集約、bounded helper の timeout / exit code / redacted stderr / helper exit 確認で解消した。pre/post-spawn error も分離し、spawn 後 error は実 exit まで終了扱いにせず、grace 後は exact helper PID へ再送する。race・profile status failure・taskkill timeout / nonzero・helper spawn / post-spawn / kill error 自己試験は全て非 0、PID / profile / helper 残存なし。実 X・権限・製品 UI・公開版は変更していない。
- 2026-07-29: PR #50（head `30d490a`、merge `232d12e`）の統合を確認。GitHub の check rollup と `main` push run はともに0件で今回の変更を検証する remote CI 証跡はないため、exact merge commit で `node scripts/check-all.mjs` の静的10本と headful Chromium harness を再実行した。初回は73 checksとcleanupが全緑。popup、home fixture、real-DOM、options 3 viewport の計6枚を目視し、3幅の横 overflow と、これら6つの機能確認 session の runtime/page error・console error・failed request は各0、cleanup 完了、一時 profile と対象 Chromium process の残存も各0だった。証跡保存用の同条件再実行では機能73件が全 PASSした後、既に child / profile が消えた終了競合で primary / fallback `taskkill` が exit 128となり runner exit 1を再現したため、`POST-2026-07-29-BROWSER-CLEANUP-RACE` へ昇格した。
- 2026-07-29: `POST-2026-07-29-BROWSER-CLEANUP-RACE` を test-only Class M で完了。cleanup 判定を純関数へ分離し、観測済み exit 128 と終了証拠の全一致だけを benign とした。primary helper失敗後は直接childの実exitを先に待ち、終了済みならfallbackを省いてPID再利用後の誤killを避ける。単体境界でexit 23 / timeout / spawn・post-spawn・kill異常 / child・profile未完了を拒否した。policy本体追加直後の通常Chromium 73件はexit 0、fallback前child-exit制御追加後のforced exit 23はexit 1、最終静的10本もPASSし、各runの新規profileと対象Chromium processの残存0を確認した。
- 2026-07-29: `POST-2026-07-29-SYNC-HOOK-DOUBLE-EVALUATION` を Class M のsynthetic-only TDDで完了。同一documentでscriptを2回評価すると公開APIが初回hookのteardown所有権を失い、再install後に本文読取/messageが各2回になるREDを固定した。稼働中の既存APIとwrapperを再評価時も保持し、uninstall復元と再install後の1回処理を回帰化した（PR #53、merge `49a7c61`）。
- 2026-07-29: `POST-2026-07-29-XHR-OPEN-COMMIT-BOUNDARY` を Class M のsynthetic-only TDDで完了。次request stateをdelegate前に公開すると、外部wrapperのpre-delegate DONEが旧non-list本文を新しいeligible URLとして読み、delegate後DONE→同期throwでもcatch前にmessageを送るREDを確認した。委譲中はstateを無効化し、`originalOpen` 正常復帰後だけ次stateをcommitしてDONEを再確認することで、正常return時の同期DONEは1回処理し、throw時は本文・messageを0件に固定した。独立レビューで同期DONE中の再入openをpost-delegate / pre-delegateの両順序と組み合わせると、単純な外側commitも内側保持も反対側の順序で誤stateを残すREDを確認した。さらに旧世代outer open中のuninstall / reinstallを挟む再入、commit後のinactive旧wrapper直呼び、delegation中の同一inactive wrapper二重通過、未復帰active outer配下でinnerがpost-delegate DONEまで正常完了する経路に加え、retained inactive outerの直呼び配下で現世代innerが同様に完了するREDも固定した。install世代共有のper-XHR coordinatorへactive／inactive wrapperのdelegation depth、tree token、phase、曖昧性を集約し、depth内のnested open tree全体をinner / outerともcommit・即時処理不可にした。tree unwind後の独立top-level openだけ再armし、曖昧tree内の有効responseを落とし得るavailability tradeoffを明示した。
- 2026-07-29: 上記XHR境界をPR #55（head `a7e6a2a`、merge `596c4e2`）でmainへ統合。exact merge commitで静的10本をPASSし、PR checkとhead commitのworkflow runは各0件だった。main merge commitのGitHub Pages build/deploy run `30429121391` はsuccessだが、コードテストCIの代替ではない。
- 2026-07-29: `POST-2026-07-29-SYNC-HOOK-PUBLIC-FLAG-DRIFT` を Class M のsynthetic-only TDDで実装。公開installed flagがfalseでも同じAPI / script再評価はprivate active ownershipを再利用し、wrapper identityとnative teardown所有権を維持してflagを自己修復する。private stateなしで公開flagだけtrueのfresh contextはinstallできる。targeted hook 148件と静的10本をPASSし、PR #57（head `05d80d8`、merge `7407fbf`）でmainへ統合。exact merge commitでも静的10本をPASSし、PR check rollupは0件、自動GitHub Pages run `30431664453` はsuccessだったがコードテストCIの代替ではない。
- 2026-07-30: `POST-2026-07-30-FETCH-URL-ACCESSOR-SINGLE-READ` を Class M のsynthetic-only TDDで実装。fetch inputの`url` getterを2回評価することで生じる値差し替えと2回目throwをRED再現し、URLをsingle-read snapshotへ固定した。独立レビューのP1では、実`Request`の内部HomeTimeline URLとown getterの偽BlockedAccounts URLが不一致でも本文を処理するfalse-positiveを追加RED再現。次の追加P1ではprototype getterの差替え→uninstall / reinstall、外部wrapperのRequest／string置換、さらにopaque delegateを捕捉した旧世代のprovenance launderingとforeign wrapper保持中のscript再評価による基準fetch再信頼をRED再現した。標準`Request.prototype.url` getterは初回script評価時に固定し、外部wrapper配下では各inactive世代が実入力identity・返却Promise・内側delegate provenanceを基準fetchまで再帰検証する。inactive旧APIが残る再評価は同じclosureを再利用する。公開APIのgetter/Proxy throwとshape一致no-op APIも追加RED固定し、probe隔離とinstall後のactive ownership再確認を追加した。未証明経路は元Promiseを保って本文未読・message未送信へfail closedにした。透過委譲と既存in-flight停止を含むfocused hook 204 checksをPASS。新権限・endpoint・storage schema・live X・raw response・製品UIは変更していない。

## 外部レビュー指摘の台帳（2026-07-15 maxエフォート横断レビュー）

読取専用レビュー（実行検証なし）の指摘。2026-07-21 の現況同期でローカル検証対象へ昇格した。実装前に synthetic fixture で妥当性を確認し、完了時は行頭を [x] にして対応 PR を追記する。

- [x] `REVIEW-2026-07-15-SYNC-STAGING` — PR #41 で解消。TDD RED で同一ページの2回目完全同期に前サイクル4件が残ることを再現した。無条件 clear は tail-only 部分ページによる削り落としを招くため採用せず、cursor 無し initial request の正常応答だけが固定 `sync-start` を送り、該当 listKind の staging を新しい全走査へ切り替える。pagination は前回完全集合を保持し、request variables / cursor 値は送信しない。`verify-sync-hook.mjs` / `verify-sync-bridge.mjs` / 静的10本 PASS。
- [x] `REVIEW-2026-07-15-STORAGE-LANE` — `storage.js:16`: context-local lane では、popup clear 後の stale settings upsert による同期行復活と、`setSyncEnabled(false)` / `markSynced()` の full-object lost update を防げないことを TDD RED で再現。同期行を `xtbmSyncEntries:<generation>`、clear 専用 active pointer を `xtbmSyncGeneration`、base を `xtbmBaseEntries`、synthetic を `xtbmSyntheticEntries`、同期状態を field 別 key へ分離した。旧 single-key は base / legacy synthetic fallback / initial shard の全書込み後に `xtbmSyncMigrated` を commit し、stale full-object set ではなく whole-key remove する。途中失敗では legacy 全体を authoritative に保つ。full-replacement `setEntryStore` export は廃止し、fixture も production upsert API を使う。stale writer は旧 shard だけを空にして reject し、4 context の連続 clear 中も最新 shardを保持する。各競合操作と静的10本 runner は timeout 付き。retired cleanup が一時失敗しても active generation は継続し、次回 clear が再処理する。既存 schema/同期回帰を含む静的10本 PASS。
- [x] `REVIEW-2026-07-15-RESERVED-PATHS` — User-Name 領域の synthetic URL と同名 target を組み合わせ、`/hashtag` / `/intent` / `/lists` / `/communities` が author handle 候補へ到達して4カードを誤って隠す RED を実測。4語を `PROFILE_RESERVED_PATHS` へ追加し、予約 path カードを表示維持しながら既存 author 2件＋quote 1件だけを置換する headless Chromium 回帰を固定した。実 X・raw handle/user_id・新権限・新データソースは不使用。`verify-phase1-static.mjs` / `verify-extension-load-chrome.mjs` / 静的10本 PASS。
