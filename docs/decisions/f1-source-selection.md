# F1 source selection decision

## Status

2026-06-13 (M3) live 評価により、**F1-A を Phase 2 primary として確定採用**する。深検出修正後の live 再評価で `f1a_viable`（blocked / muted とも endpoint・shape・identity・pagination 成立、`unsafeSignals: []`）を確認した（下記「Live evaluation result」「Live re-evaluation」）。

実 X のログイン済みアカウントで blocked / muted 両ページの masked observation を収集し、`evaluate-f1-observation.mjs --live` で判定した。endpoint / response shape / identity（user_id 風・handle 風）は両ページで成立。pagination 検出のみ未成立だが、これはカーソル不在ではなくフックの走査が浅いことが原因と構造分析で判明したため、修正対象として扱う。

## Live evaluation result (2026-06-13, M3)

収集条件: ユーザーのログイン済み Chrome に拡張を Load unpacked し、Claude Code が Chrome MCP で blocked / muted 設定ページを navigate / scroll / フル遷移。observation は 34 件（blocked 17 / muted 17）。`unsafe_summary` ゲートは `unsafeSignals: []`（raw 値の漏えいなし）。

evaluator verdict: `f1a_insufficient`（missing: blocked/muted pagination、SPA continuity）。

masked summary の構造分析（生値なし）で確認できたこと:

- endpoint: 一覧 GraphQL を両ページで捕捉（muted では `MutedAccounts` op 名が残存）。1.1 系の users 応答も併せて捕捉。
- shape: `$.data.…timeline.timeline.instructions[].entries`、および `$.data.…[].result.rest_id`。X タイムライン型の正規構造。
- identity: `result.rest_id`（= user_id）と `screen_name`（= handle）。同期の主キー・副キーに必要な情報が揃う。
- pagination: 未検出（`cursorLike: 0`）。ただし shapePaths が `instructions[].entries` で止まり、その配下（X の `TimelineTimelineCursor` / `cursorType` を持つ cursor エントリ）まで走査していない。X のタイムラインは常に cursor エントリを含むため、**カーソルは存在するがフックの走査深度不足で未検出**と判断する。
- SPA continuity: 未成立（フル遷移のため hookRunId が blocked/muted で別）。ただし production は manifest の `content_scripts` が両設定ページに document_start で個別注入するため、ページ跨ぎ continuity は本番要件ではない。

採用条件（M4 で実施）:

1. （実装済み）MAIN world hook に深いカーソル検出 `detectDeepPaginationSignal` を追加。`instructions[].entries[]` を全要素・深さ12・ノード予算つきで走査し、`cursorType` 等のキー名だけで `paginationLike` を立てる（raw cursor 値は読まない・出さない）。simulator test に「末尾ネスト cursor」ケースを追加し検証済み。
2. （実装済み）evaluator の continuity 判定を per-page 注入設計に整合。cross-page の `sharedHookRun` 必須を撤廃し、`spaContinuity` は情報出力のみ（manifest が両設定ページに document_start で個別注入するため、ページ跨ぎ continuity は本番要件ではない）。
3. （実施済み）拡張を reload し新フックで blocked/muted を取り直して live 再評価 → `f1a_viable` 確認済み。production capture 実装に進んでよい。

## Live re-evaluation (2026-06-13, f1a_viable)

深検出を identity（rest_id/screen_name）と pagination（cursor）に一般化（深さ18・キー名のみ・raw 値非読取）した後、拡張を reload し観測メモをクリアして blocked/muted を取り直した。`evaluate-f1-observation.mjs --live` の結果:

- status: `f1a_viable`、missing: なし、`unsafeSignals: []`。
- blocked: count 27、endpoint ✓ / shape ✓ / identity ✓ / pagination ✓。
- muted: count 33、endpoint ✓ / shape ✓ / identity ✓ / pagination ✓。
- spaContinuity: false（情報のみ。本番は両ページ個別注入のため非ゲート）。

結論: F1-A を Phase 2 primary として採用。production capture は user_id（rest_id）/ handle（screen_name）/ listKind（blocked/muted）のみを抽出し、`Storage.upsertSyncedEntries()` で `xtbmEntries` に同期する（M4）。raw cursor 値・表示名・本文は抽出しない。

不採用に切り替える条件: 上記修正後の live 再評価でも pagination が成立しない、または full-list 取得が安定しない場合は F1-B（表示範囲限定同期）/ F1-D（手動インポート）へ切り替える。

## Status (Phase 1.5 当時の記録)

Phase 1.5 時点では defer decision だった。

F1-A は MAIN world hook scaffold を追加したが、実 X ページでの endpoint / response shape / pagination / timing は未確認のため、Phase 2 primary としてはまだ採用しない、としていた。この保留は 2026-06-13 の live 評価で解除された。

## Candidates

### F1-A: settings page internal response capture

`/settings/blocked/all` と `/settings/muted/all` のページ内部 request を `MAIN` world の `fetch` / `XMLHttpRequest` hook で構造捕捉する。

採用条件:

- blocked と muted の両方で、一覧由来と判断できる endpoint class が masked observation として確認できる。
- raw value を保存せず、top-level key、shape path、field presence、count だけでレビュー可能な判断材料が残せる。
- `user_id` 風 stable identifier が存在する。
- handle / screen name 風 field が存在する、または handle がなくても `user_id` matching で Phase 2 の価値が成立する。
- cursor 風 pagination が確認でき、scroll または追加読み込みで次ページを検出できる。
- 初期 request の欠落がない、またはユーザー操作として refresh / sync retry を要求する設計で許容できる。
- SPA 遷移後に hook が維持される、または設定ページ遷移ごとに安全に再注入できる。
- Chrome Web Store review 向けに、`scripting` と `MAIN` world hook の目的、対象ページ限定、保存データの最小化を説明できる。

不採用または fallback 条件:

- raw response を保存しないと実装判断できない。
- blocked / muted の片方だけしか捕捉できない。
- stable identifier が存在しない、または field の意味が推論に留まりすぎる。
- pagination が不安定で一覧全体を扱えない。
- injection timing が不安定で初期一覧の欠落が大きい。
- X 側変更に弱すぎ、Phase 2 の保守コストが許容できない。

### F1-B: DOM extraction

settings page または関連 UI の DOM から、表示済みのアカウント情報を抽出する。

fallback trigger:

- F1-A が endpoint / shape / pagination / timing のいずれかで成立しない。
- Chrome Web Store review 上、network hook の説明リスクが高すぎる。
- F1-A の内部 shape が頻繁に変わる見込みが高い。

F1-B を検討する場合の条件:

- DOM から raw private text を保存しない redaction policy を維持する。
- handle-only しか取れない場合、`user_id` matching より精度が落ちることを明記する。
- 仮想リスト / lazy rendering で全件取得できない場合は UI 上の限定同期として扱う。

### F1-D: user import

ユーザーが自分で用意した block / mute list を import する。

fallback trigger:

- F1-A と F1-B がどちらも安全性、安定性、レビューリスクの面で採用できない。
- 自動取得よりも、明示的な user-provided data flow の方が安全に説明できる。
- Chrome extension 権限をこれ以上増やさずに Phase 2 の実用性を作る必要がある。

F1-D を検討する場合の条件:

- import data の schema、validation、dedupe、削除手順を先に設計する。
- raw private data を docs、fixtures、tests に混ぜない。
- sample / synthetic fixture を使って import UI を検証する。

### F1-C: X API / OAuth

F1-C は Phase 1.5 では out of scope のまま維持する。

再検討条件:

- pricing が確認済み。
- developer app ownership が確認済み。
- OAuth scope と token policy が確認済み。
- token 保存、削除、漏洩時対応、review 説明が確認済み。
- paid API execution または有料プランが必要な場合、事前に明示承認がある。

## Phase 2 recommendation

2026-06-13 (M3) の live 評価により defer を解除し、**F1-A primary（pagination 検出修正を条件）** を推奨する（上記「Live evaluation result」）。以下は当時の defer 判断の記録。

当時の推奨は defer decision だった。

次の実測が揃った場合のみ、F1-A primary を再検討する、としていた。

- blocked page: endpoint class、shape、user_id-like field、handle-like field、cursor-like field、pagination の masked observation。
- muted page: endpoint class、shape、user_id-like field、handle-like field、cursor-like field、pagination の masked observation。
- direct load と refresh での injection timing 差分。
- blocked / muted 間の SPA navigation で hook が維持されるか。

実測できない場合、Phase 2 は F1-B primary または F1-D primary に切り替える。

## Mechanical evaluator gate

masked summary は `tests/scripts/evaluate-f1-observation.mjs` で判定する。

```powershell
node tests/scripts/evaluate-f1-observation.mjs --live path\to\masked-summary.json
```

判定基準:

- `unsafe_summary`: 停止。raw 値が混入している可能性があるため、Phase 2 判断材料に使わない。
- `unknown`: F1-A 未確認。blocked / muted の masked observations を取り直す。
- `f1a_insufficient`: F1-A primary 不採用。missing に出た不足を確認し、F1-B または F1-D fallback を選ぶ。
- `fixture_pass`: local fixture は通っているが、実測ではない。F1-A primary 不採用。
- `f1a_viable`: F1-A primary の候補。ただし採用前に review risk、保守性、ユーザー説明、削除手順を確認する。

`f1a_viable` になるには、blocked / muted の両方で次が必要。

- endpoint class
- response shape
- `user_id` 風または handle 風 signal
- pagination / continuation signal
- 同一 hook run による SPA continuity signal

## Next implementation unit after insufficient result

`f1a_insufficient` の missing ごとの次アクション:

- endpoint / shape 不足: F1-A は内部 response 捕捉に失敗しているため、F1-B DOM extraction を優先検討する。
- identity signal 不足: F1-A で stable matching が作れないため、F1-B で visible handle の限定同期、または F1-D user import を検討する。
- pagination 不足: F1-A は全件同期に向かないため、F1-B の表示範囲限定同期または F1-D を検討する。
- SPA continuity 不足: F1-A を採る場合でも refresh / manual sync 前提になる。レビューリスクが高い場合は F1-B / F1-D に切り替える。

F1-B / F1-D fallback はこの decision では設計までに留める。production fallback implementation は Phase 2 の別 task として扱う。
