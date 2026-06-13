# TASKS_BACKLOG

## Status

最終更新: 2026-06-14

このファイルは現行タスクの source of truth です。2026-06-13 のガバナンス変更（`docs/DECISION_LOG.md` 参照）により、旧 ChatGPT 承認制は廃止され、ユーザー本人がチャットで直接承認したタスクを Claude Code が実装します。旧 ChatGPT-approved task queue である `docs/CODEX_TASKS.md` は archived（歴史的記録）です。

## Goal

非エンジニアが「インストール → 同期ボタン → タイムラインで効果確認」だけで、自分のブロック・ミュートリスト由来の露出（RT/引用等経由を含む）を減らせる Chrome 拡張を、Chrome Web Store で一般公開する。データはすべて端末ローカル保存・外部送信なし・権限最小（`storage` + x.com/twitter.com host、可能なら `scripting` も削除）を維持する。

## Roadmap

```
M1 ──→ M2 ──→ M3(分岐点) ──→ M4 ──→ M5 ──→ M6 ──→ M7
文書/ガバナンス  Chrome自動検証  F1-A live判定  production sync  実DOM filtering  UX仕上げ  Store提出
                                  └─ insufficient → M4' (F1-B/F1-D に差し替え、M5以降共通)
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
| P2-006 | M3 | `docs/decisions/f1-source-selection.md` の decision 確定（viable/insufficient の記録） | 高 | S | done: F1-A を Phase 2 primary に確定。P2-011 fallback は不要化（hold→closed 候補）。 | P2-005 |
| P2-007 | M4 | 宣言的 MAIN world `content_scripts` 移行検証（`scripting` permission 削除可否） | 高 | S | done: 宣言的 `world:"MAIN"` content script（minimum_chrome_version 111）で sync hook を注入し実機ロード確認。`scripting` 削除は research 動的注入の retire（M6）後に実施予定のため permission は storage+scripting 維持。 | P2-005 |
| P2-008 | M4 | production capture script（user_id / handle / listKind のみ抽出） | 高 | M | done: sync-capture（抽出）+ sync-hook（MAIN捕捉）+ sync-bridge（ISOLATED保存ゲート）。**live 検証で実アカウントの blocked 234件 / muted 50件 を xtbmEntries に取り込み成功**（2026-06-13）。 | P2-006, P2-007 |
| P2-009 | M4 | storage schema v2（upsert / dedupe / listKind / syncedAt / stale 削除 / migration） | 高 | M | done: 基盤＋sync-state（enabled/lastSyncedAt）、upsert・dedupe は live 実証済み。stale reconciliation（完全同期時のみ全置換）を P2-009b で完了。 | source 非依存のため先行実装 |
| P2-010 | M4 | popup 同期導線（同期ボタン・進捗・最終同期時刻・削除） | 高 | M | done: 「ブロック・ミュート同期」セクション（有効化トグル・件数・最終同期・設定ページリンク・削除）。M2 で実機検証。popup の `chrome.storage.onChanged` 自動更新は M6 で実装済み（busy/area/key ガード）。 | P2-008, P2-009 |
| P2-009b | M4 | stale reconciliation（完了検出＝末尾カーソル到達時に全置換、部分時は追加のみ） | 高 | M | done: sync-hook が末尾（抽出0件）で `sync-complete` を post、sync-bridge が session staging を非空時のみ `replaceSyncedListKind` で当該 listKind を全置換（空 staging は安全弁で no-op、reconcile 後も staging 非クリア）、storage に `replaceSyncedListKind` 追加。verify-sync-hook / verify-sync-bridge / verify-storage-sync-schema 拡張、全11検証（Chrome 実機ロード含む）green（2026-06-14）。 | P2-008 |
| P2-011 | M4' | (fallback) F1-B DOM 抽出 または F1-D import UI | 条件付 | M/L | hold: P2-005 が insufficient の場合のみ | P2-005 |
| P2-012 | M5 | 実DOM author matching（User-Name 領域限定、quote/embed 除外、全リンク走査の廃止） | 高 | L | ready | P2-009 |
| P2-013 | M5 | SPA 対応＋MutationObserver 性能改善（CL-AUDIT-006/007 消化） | 高 | M | ready | P2-012 |
| P2-014 | M5 | 実X DOM 模擬 synthetic fixture 新造＋実TL動作確認（報告は件数のみ） | 高 | M | ready | P2-012 |
| P2-015 | M6 | production placeholder 文言・エラー日本語ガイダンス | 中 | S | ready | P2-010, P2-012 |
| P2-016 | M6 | options page（entries 管理・プライバシー説明）＋research UI の本番非表示化 | 中 | M | doing: research UI 本番非表示化 done（dev フラグ `RESEARCH_UI_ENABLED`、既定 false。コード・background 注入・`scripting` は保持し M7 で retire）。README を Phase2 実装済みに更新＋audit-operational-alignment lockstep（2026-06-14、全11検証 green）。options page（entries 管理・プライバシー説明）は未実施。 | P2-010 |
| P2-017 | M7 | manifest icons / version / 商標配慮 name 整備 | 中 | S | ready | - |
| P2-018 | M7 | パッケージ zip 生成スクリプト（allowlist 方式、dist/ 出力） | 中 | S | ready | P2-016 |
| P2-019 | M7 | プライバシーポリシー文書＋ホスティング URL | 高 | S | ready | P2-002 |
| P2-020 | M7 | ストア掲載物一式（説明文・スクショ・single purpose・permissions justification） | 中 | M | ready | P2-016, P2-018 |
| P2-021 | M7 | Web Store 提出と審査対応サイクル（デベロッパー登録・決済・最終送信はユーザー） | 高 | M | ready | P2-017〜P2-020 |

## 旧 TB 系列タスクの扱い

2026-06-12 までの棚卸し結果（旧ガバナンス時点）。状態変更の根拠は 2026-06-13 のユーザー決定。

| ID | タスク名 | 旧状態 | 現状態 |
| --- | --- | --- | --- |
| TB-001 | 残タスク棚卸しと backlog 作成 | done | done（記録として保持） |
| TB-002 | Chrome Load unpacked と popup の確認 | skip: 人間確認が必要 | done（2026-06-13、P2-004 として実施）。`verify-extension-load-chrome.mjs` で拡張ロード・popup 描画・synthetic fixture フィルタを自動検証し pass。Codex 失敗の主因は branded Chrome 137+ の `--load-extension` 無効化と判明。 |
| TB-003 | F1-A live masked summary 評価 | skip: real X login と ChatGPT approval が必要 | ready → P2-005 に統合。ユーザー同意の下、Claude Code が Chrome MCP で masked observation のみ収集・評価。 |
| TB-004 | Phase 2 source selection と production 実装 | skip: deferred / out of scope | approved → M4 / M5（P2-007〜P2-014）として分解。 |
| TB-005 | F1-C X API / OAuth 連携の再検討 | skip: OAuth 等の承認が必要 | closed（不採用）。F1-A 精度方針の確定により再検討条件が消滅。F1-A insufficient 時も F1-B / F1-D を優先する。 |
| TB-006 | Chrome Web Store / package / CI / distribution readiness | skip: distribution decision が必要 | approved → M7（P2-017〜P2-021）として実施。 |
| TB-007 | local stale branches の扱い確認 | done | done（4本は温存。merge / delete はしない） |
| TB-008 | Claude Code 引き継ぎ用 closeout 文書化 | done | done（`HANDOFF.md` 参照） |

## Validation evidence

2026-06-12 の closeout で実行した local checks（Codex 記録）:

- `node tests/scripts/verify-phase1-static.mjs` -> pass
- `node tests/scripts/verify-f1a-observation-safety.mjs` -> pass
- `node tests/scripts/verify-f1a-main-hook-simulator.mjs` -> pass
- `node tests/scripts/verify-docs-consistency.mjs` -> pass
- `node tests/scripts/evaluate-f1-observation.mjs tests/fixtures/f1-a-masked-summary.fixture.json` -> `fixture_pass`
- `node tests/scripts/audit-operational-alignment.mjs` -> `passed` with optional external checks skipped because paths were not provided
- `git diff --check` -> pass
- `gh issue list --limit 100 --state open --json number,title,labels,url` -> `[]`

2026-06-13 の引き継ぎ時ベースライン（Claude Code 実測）:

- `node tests/scripts/verify-phase1-static.mjs` -> pass
- `node tests/scripts/verify-f1a-observation-safety.mjs` -> pass
- `node tests/scripts/verify-f1a-main-hook-simulator.mjs` -> pass
- `node tests/scripts/verify-docs-consistency.mjs` -> pass
- `node tests/scripts/evaluate-f1-observation.mjs tests/fixtures/f1-a-masked-summary.fixture.json` -> `fixture_pass`
- `node tests/scripts/audit-operational-alignment.mjs` -> `passed` with optional external checks skipped because paths were not provided
- `git diff --check` -> pass

## Done criteria

Goal 達成（Chrome Web Store 公開）まで P2 系列を M1 から順に実装する。各タスクは実装・検証・コミットまで揃って done とする。live X 検証で `unsafe_summary` が出た場合は停止・削除し、検証結果は実測のみ記録する。
