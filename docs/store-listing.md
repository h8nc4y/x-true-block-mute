# Chrome Web Store listing — TrueBlock & Mute

This file holds the copy and form answers for the Chrome Web Store submission.
Fill the bracketed placeholders before submitting. The submission itself
(developer registration, the one-time fee, and final upload) is done by the
account owner.

---

## Basics

- **Name:** TrueBlock & Mute
- **Category:** ソーシャルネットワーク (Social Network) — matches the live listing
- **Default language:** 日本語 (Japanese); English copy is provided below as well.
- **Package:** `dist/TrueBlock-Mute-v<version>.zip` (built with `node scripts/build-package.mjs`)
- **Privacy policy URL:** `https://h8nc4y.github.io/x-true-block-mute/privacy-policy.html` （GitHub Pages /docs で公開・到達確認済み 2026-06-14）
- **Support / contact email:** h8nc4y@gmail.com

---

## Summary (short description — keep under 132 characters)

**日本語:**
自分のブロック・ミュート済みアカウント由来の投稿（リポスト・引用経由も）を X で非表示に。データは端末内のみ・外部送信なし。

**English:**
Hide posts from accounts you've blocked or muted on X — including via reposts and quotes. All data stays on your device.

---

## Detailed description

### 日本語

「ブロックもミュートもしたのに、他の人がリポスト（リツイート）や引用をすると、その人の投稿がまたタイムラインに出てきてしまう」——X (Twitter) でよくあるこの困りごとを解消する拡張機能です。

TrueBlock & Mute は、**あなたがすでにブロック・ミュートしているアカウント**の投稿を、リポストや引用で再表示される分も含めて、タイムラインから自動で隠します。新しく誰かをブロックするものではありません。あなたが「もう見たくない」と決めた相手を、より確実に見えなくするだけです。

**できること**
- あなたのブロック・ミュート一覧に載っている人の投稿を非表示（リポスト・引用での再表示にも対応）
- 隠し方を選べます：「完全に隠す」／「（対象の投稿だと）説明だけ表示」／「何もしない」
- データはすべてあなたのパソコンの中だけに保存。外部のサーバーには一切送信しません
- 解析・追跡・広告なし。使う権限は最小限（保存領域と x.com / twitter.com だけ）

**使い方（かんたん3ステップ）**
1. 拡張アイコンをクリックしてポップアップを開き、「同期を有効にする」をオンにします。
   →「同期」とは、あなた自身のブロック・ミュート一覧をこの拡張に読み込むこと。これで「誰を隠せばよいか」を覚えます。
2. ポップアップの「ブロック一覧を開く」「ミュート一覧を開く」リンクから設定ページを開き、**一番下までゆっくりスクロール**します（全員分を読み込むため）。
3. タイムラインに戻ると、その人たちの投稿が消えています。以後は自動で隠れます。

※ ブロック・ミュートする相手を増やしたら、また同じ手順で一覧を開いてスクロールすると最新の状態に更新されます。
※ 取り込んだ一覧の確認・削除や設定は、ポップアップの「詳細設定・プライバシー」から行えます。

本拡張は X Corp. および Twitter とは提携・承認関係にありません。

### English

You blocked or muted someone — but when other people repost or quote them, their posts show up in your timeline again. TrueBlock & Mute fixes this everyday X (Twitter) annoyance.

It automatically hides posts from accounts **you have already blocked or muted**, including when they reappear via someone else's repost or quote. It does not block anyone new — it just makes the people you've already decided not to see disappear more reliably.

**What it does**
- Hides posts from people on your block/mute lists (including reposts and quotes of them)
- Choose how they're hidden: hide completely / show a short "hidden" notice / do nothing
- All data stays only on your own computer — nothing is ever sent to any server
- No analytics, tracking, or ads; minimal permissions (storage and x.com / twitter.com only)

**How to use (3 easy steps)**
1. Click the extension icon to open the popup and turn on "Enable sync."
   → "Sync" simply means loading your own block/mute lists into the extension so it knows who to hide.
2. Use the "Open blocked list" / "Open muted list" links in the popup, then slowly scroll to the very bottom of each settings page (so everyone is loaded).
3. Go back to your timeline — those people's posts are now gone, and stay hidden automatically.

Tip: after you block or mute more people, just open the lists and scroll again to refresh.
You can review or delete the imported list anytime via "詳細設定・プライバシー" (Details & privacy) in the popup.

This extension is not affiliated with or endorsed by X Corp. or Twitter.

---

## Single purpose (required field)

TrueBlock & Mute has a single purpose: to hide posts in the user's X (Twitter)
timeline that are authored by accounts on the user's own block or mute lists,
including posts surfaced through reposts and quotes.

---

## Permission justifications (required for each permission)

- **`storage`** — Stores the user's own block/mute list (numeric user id, handle,
  and which list) and the user's display settings locally via `chrome.storage`, so
  posts can be matched and hidden. No data leaves the device.
- **Host access `https://x.com/*`, `https://twitter.com/*`** — The content script
  runs on X/Twitter pages to hide matching posts, and on the Blocked/Muted
  settings pages it reads the list response the site returns to the browser to
  learn which accounts to hide. The extension only operates on these sites and
  requests no other host access.
- **No remote code** — All code is bundled in the package; nothing is fetched or
  executed from a remote source.

The extension does **not** request `tabs`, `cookies`, `webRequest`, `scripting`,
`<all_urls>`, or any external host.

---

## Privacy practices / data use disclosures (store form)

The extension keeps all data on the user's device and transmits nothing, so under
the Chrome Web Store definition (where "collect" means transmitting data off the
device) it collects no user data.

- **What user data do you collect / transmit?** None. The block/mute list and
  settings are stored locally with `chrome.storage` and never transmitted.
- **Sell or transfer to third parties?** No.
- **Use or transfer for purposes unrelated to the single purpose?** No.
- **Use or transfer to determine creditworthiness / for lending?** No.
- **Remote code?** No — all scripts are included in the package.
- **Privacy policy URL:** `https://h8nc4y.github.io/x-true-block-mute/privacy-policy.html` （GitHub Pages /docs で公開・到達確認済み 2026-06-14）

(If the review form treats the locally-stored list as a data category, disclose it
as "Personally identifiable information" handled **locally only, not transmitted**,
and keep all transfer/sale answers as "No".)

---

## Screenshots

Store screenshots are generated from the synthetic fixtures only (no real X
account data) by `node scripts/make-screenshots.mjs`, written to `store-assets/`
at 1280×800:

- `store-assets/store-1-timeline.png` — synthetic timeline with matched posts
  replaced by the neutral notice ("説明だけ表示" mode).
- `store-assets/store-2-options.png` — the options page (privacy explanation +
  synced-list transparency + management).
- `store-assets/store-3-popup.png` — the popup (filter mode + block/mute sync controls).

Upload at least one; 1280×800 PNG is the recommended Chrome Web Store size.

---

## Pre-submission checklist (owner)

1. `node scripts/build-package.mjs` → upload `dist/TrueBlock-Mute-v<version>.zip`.
2. Host `docs/privacy-policy.html`; paste its URL into the listing and the privacy form.
3. Fill the contact email in `docs/privacy-policy.{md,html}` and this file.
4. `node scripts/make-screenshots.mjs` → upload images from `store-assets/`.
5. Set the single purpose, permission justifications, and data-use answers above.
6. Submit for review (developer registration + one-time fee required).
