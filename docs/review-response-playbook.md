# 審査対応プレイブック・公開後運用 runbook

作成: 2026-07-03 ClaudeCode Fable5（要件再定義 v2 の R2-003 / R2-004）。
前提: 提出 2026-06-14・store item ID `anpgfamnbjoajbapfeclnjkklbcoknkb`。**2026-07-06 更新: 審査通過・公開済み（v1.1.1）**。§1〜§2 は将来の再提出・更新版審査で長期化/却下が起きたときの手順として保持する。Chrome Web Store の管理画面操作・再提出・公開はすべてオーナー（人間ゲート①）。エージェントは文書・修正・検証・zip 生成までを担当する。

## 1. 審査が長期化しているとき（保留 3 週間超 = 2026-07-05 以降）

公式ドキュメント（Chrome Web Store review process）は「ほとんどは数日、数週間かかる場合もある。3 週間を超えたら Developer Support へ問い合わせ」を案内している。2026-04 以降は提出急増による審査遅延が公式に告知されており、長期化自体は異常ではない。

オーナーの手順:

1. [デベロッパーダッシュボード](https://chrome.google.com/webstore/devconsole) でアイテムのステータスを確認（審査中/公開/却下）。
2. まだ審査中なら [One Stop Support フォーム](https://support.google.com/chrome_webstore/contact/one_stop_support) から問い合わせ。区分は「拡張機能の審査状況」相当を選択。
3. 問い合わせ文面テンプレ（英語・そのまま貼り付け可。item ID 以外の個人情報は不要）:

> Subject: Review status inquiry — item pending for over 3 weeks
>
> Hello, my extension (item ID: anpgfamnbjoajbapfeclnjkklbcoknkb, name: TrueBlock & Mute) was submitted for review on June 14, 2026 and has been pending for more than three weeks. Could you please share the current review status or an estimated timeline? The extension uses only the `storage` permission plus host permissions for x.com/twitter.com, and sends no data off the device. Thank you.

## 2. 却下されたときの理由カテゴリ別対応表

却下メールには該当ポリシーと理由が明記される。**オーナーは却下メールの理由部分（個人情報を除く）を repo 側へ共有**すれば、エージェントが対応を実装する。再提出はオーナー（ゲート①）。

| 却下理由カテゴリ | ありうる指摘 | 対応（エージェント） | 備考 |
| --- | --- | --- | --- |
| プライバシーポリシー不備 | URL 不達・権限使用の開示漏れ・データ開示フォームとの不一致 | `docs/privacy-policy.md|.html` と store-listing のフォーム回答を突き合わせて修正。ホスティング URL の疎通はオーナー確認 | 三者（manifest 権限・フォーム・ポリシー本文）の整合が審査対象 |
| Single purpose 違反 | 機能が複数目的に見える | 掲載文の機能記述を「ブロック/ミュート済みアカウント由来の露出を隠す」1 目的に絞り込む文言修正 | 実装は元々単機能。文言の問題として扱う |
| 権限過剰 | host_permissions の正当化不足 | store-listing の permissions justification を具体化（同期=設定 2 ページ、フィルタ=タイムライン） | 権限自体の変更は §9④ ゲート。原則、権限は減らさず説明で対応 |
| コード透明性（MV3） | MAIN world フック・難読化疑い | コードは非難読・repo 公開である旨を説明。必要なら sync-hook の目的コメント/説明文書を強化 | リモートコードは不使用。fetch/XHR ラップは同期取り込みのためで、対象 2 ページ限定 |
| メタデータ/スパム | 説明文・スクショの品質 | `docs/store-listing.md` と `scripts/make-screenshots.mjs` の生成物を修正 | スクショは synthetic データのみ（実データ不使用を維持） |
| 商標 | 名称・アイコンに X/Twitter 商標 | name は中立「TrueBlock & Mute」済み。description の互換性表記が問題なら「for X (Twitter)」形式へ修正 | アイコンは独自デザイン（禁止記号モチーフ） |

対応後の共通手順: 修正 → `node scripts/check-all.mjs` 緑 → PR → merge → `node scripts/build-package.mjs` で zip 再生成 → `verify-package` 緑 → **オーナーがアップロード・再送信**。version は再提出のたびに patch を上げる（例 1.1.2）。

アピール（不服申立て）は同一違反につき原則 1 回で最終判断。**先に修正再提出、アピールは「明確な誤判定」のときだけ**にする。

## 3. 公開後運用 runbook（不具合報告 → 修正リリース）

### 受け口と「受け取らない情報」

- 受け口はオーナー決定（要件 v2 Q5: GitHub Issues / サポートメール / なし）。
- **受け取ってよい情報**: 症状の言葉での説明（隠れない・隠れすぎ・同期件数が増えない）、発生ページ種別（ホーム TL / 検索 / プロフィール等）、拡張バージョン、Chrome バージョン、件数。
- **受け取らない情報（§10 不変条件）**: raw user_id・raw handle・表示名・投稿本文・スクリーンショット・HAR・DevTools のレスポンス本文。報告テンプレにも「アカウント名や画面写真は送らないでください」と明記する。

### 対応フロー（成功指標: 一次判断 48h・修正版作成 14 日）

1. **一次判断（48 時間以内）**: 症状を「同期取り込み破損」か「タイムライン表示フィルタ破損」に分類し、対応要否を backlog に記録。
2. **再現**: 症状に対応する synthetic fixture を新造・更新して再現（実データは使わない）。同期系で X 応答形状の変化が疑われる場合は、オーナー同意の下 Claude Code が masked observation（構造のみ・raw 値なし）を収集し `evaluate-f1-observation.mjs` の安全判定を通す。
3. **修正**: 該当モジュール修正＋回帰テスト追加（fixture を恒久化）。
4. **検証**: `node scripts/check-all.mjs` 緑。可能なら `verify-extension-load-chrome.mjs` 実機ロード。
5. **リリース準備**: manifest version を patch 上げ → `build-package.mjs` → `verify-package` 緑 → PR/merge。
6. **提出（オーナー）**: zip のアップロード・送信はオーナー。公開反映まで審査が再度走ることを想定する。

### X 側変更の予防的検知

テレメトリはないため、能動検知はオーナー自身の日常利用が一次センサーになる。「popup の同期件数が増えない」「隠れていたはずの投稿が見える」を感じたら上記フローへ。定期の synthetic 検証（check:all）は repo 側の回帰のみ検知でき、X 側変更は検知できないことを明記しておく。

## 4. 公開判明時の初日チェックリスト

1. ストア公開ページを開き、掲載文・スクショ・プライバシーポリシーリンクの表示を確認（オーナー）。
2. ストアから実インストールし、①同期（設定ページスクロール→件数増加）②タイムラインで placeholder 表示③options の一覧表示、を確認（オーナー。報告は件数・結果のみ）。
3. 審査中 zip が旧版だった場合: 公開確認後に v1.1.1（またはその時点の最新）へ更新提出するか判断（要件 v2 §6.2 の判断木）。
4. repo 側: `TASKS_BACKLOG.md` P2-021 を done 化、README の状態記述を「公開済み」へ更新、公開日を記録（エージェント）。
5. 告知（Q4 でオーナーが選択した方針に従う。費用ゼロの範囲）。
6. 初週はストアレビュー・サポート窓口を毎日確認（オーナー）。不具合報告は §3 フローへ。
