# F1 source selection decision

## Status

Phase 1.5 時点では defer decision。

F1-A は MAIN world hook scaffold を追加したが、実 X ページでの endpoint / response shape / pagination / timing は未確認のため、Phase 2 primary としてはまだ採用しない。

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

現時点の推奨は defer decision。

次の実測が揃った場合のみ、F1-A primary を再検討する。

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
