# Codex 委譲タスク: sync 抽出の over-broad walk を path-scoped に絞る（012 / H-1）

> 出典: `docs/CLAUDE_CODE_REVIEW_2026-06-21.md` の H-1（advisory）。本ファイルは Claude Code が 2026-06-21 に作成した委譲タスク仕様。ソースは未変更。
> 推奨 — インテリジェンス：高 ／ Codexのチャット：新規チャット欄を作成
> ガバナンス: 本リポジトリは AGENTS.md により、実装着手前に TASKS_BACKLOG.md への昇格＋ユーザー承認が必要。本ファイルは advisory。

## 2026/06/25 Codex補足

この委譲タスク仕様は 2026-06-21 時点の履歴資料です。sync hook response scope hardening は `d3ef0f8` として PR #10 (`95bf09b`) に含まれ、現行 `main` へ統合済みです。
以後の作業は、このファイルを新規実装指示としてではなく、実 X 応答 shape や Chrome Web Store 審査対応を再確認する前提資料として参照してください。secret、raw X response、実ユーザー一覧、追加権限、外部送信、Store提出/審査操作のゲートは現行 `AGENTS.md` と `TASKS_BACKLOG.md` を優先します。

## Goal
本番 sync 抽出が BlockedAccounts/MutedAccounts 応答内の「任意の user オブジェクト」を取り込む over-broad walk を、list timeline entry / user_results 配下のみを辿る path-scoped 抽出に絞り、list 外ユーザー（ビューア自身・suggested・quoted 作者等）の誤取り込みを防ぐ。併せて回帰テストを追加する。

## Context（確認した事実）
- 問題: `src/sync/sync-capture.js:65-112`（`extractSyncEntries` → `walk`）が応答全体を深さ20・budget 20000 で走査し、`rest_id`/`id_str`/`user_id` を持つ全ノードを `addUser` する。gate（settings-list ページ + list-endpoint の二重ゲート）は効いているが、応答に混在する list 外 user も拾い、`replaceSyncedListKind` の完全置換でも保持される。
- 影響: 誤登録された無関係アカウントの投稿が TL で恒久的に hidden/placeholder 化。プライバシー漏えいではない（端末内のみ）が製品の正しさに直結。
- 確度は「中」: 実際に誤検出するかは X の BlockedAccounts/MutedAccounts 応答の実 JSON 構造に依存。M4 の件数一致（blocked 234/muted 50）は「件数一致」であって「余計な user 0件」を保証しない。

## Autonomy policy
（昇格・承認後）ローカル実装・vitest/ノードテスト・lint・commit・PR まで自走。

## Stop only when
権限追加・データソース変更・外部送信の導入が必要になったとき（本タスクはいずれも不要のはず）。応答 shape 変更が要件判断（gate）に触れる場合。

## Do not stop for
path-scoped 抽出の実装、混在 fixture の negative test 追加、lint、commit、PR。

## Constraints（書込スコープ・安全）
- 変更してよい: `src/sync/sync-capture.js`（抽出を path 限定に）、必要なら `tests/scripts/verify-sync-extraction.mjs`（negative ケース追加）と関連 fixture。外部通信・権限追加は導入しない（出荷コードの「外部送信なし」「permissions=storage のみ」を維持）。
- 実装方針: 「list timeline entry（entries→itemContent→user_results.result 等）配下のみ」を辿る path-scoped 抽出に絞るか、最低限「`__typename === "User"` かつ list timeline entry 配下」を条件化。現行の全走査 budget/depth は path 限定後の保険として残してよい。
- 回帰テスト: list 外 user（ビューア自身/suggested/quoted 作者等）を混在させた応答 fixture で「3フィールド（user_id/handle/listKind）のみ・list 内 user のみ」が取れることを negative 検証。
- 実 X 応答 shape は Codex も直接取得しない（外部アクセス禁止）。代表 fixture で検証し、「実 shape に対する path 妥当性は残存未確認」と報告に明記。

## Work loop
REVIEW(H-1) と `tests/scripts/verify-sync-extraction.mjs` を読む → 現行 walk の取り込み範囲を確認 → path-scoped 抽出に実装変更 → 混在 fixture の negative test 追加 → 既存テスト（cursor/表示名非混入・dedupe）が引き続き通ることを確認 → lint → 自己レビュー → commit → PR。

## Done when（受入基準）
- `extractSyncEntries` が list timeline entry / user_results 配下のみを対象とし、混在 fixture で list 外 user を拾わないことが negative test で固定される。
- 既存の抽出テスト（3フィールド限定・cursor/表示名非混入・dedupe）が緑のまま。
- 外部送信・権限を増やしていない。PR 作成済み。報告は冒頭に日本時間、変更ファイル・テスト結果・未確認（実 X 応答 shape に対する path 妥当性）を明記。

## 関連
- 詳細所見: `docs/CLAUDE_CODE_REVIEW_2026-06-21.md`（H-1 / M-1 / M-3 / P-1）
- 横断索引: repo 外の作業索引として扱い、本リポジトリには取り込みません
