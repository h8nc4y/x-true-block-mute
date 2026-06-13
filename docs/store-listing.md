# Chrome Web Store listing — TrueBlock & Mute

This file holds the copy and form answers for the Chrome Web Store submission.
Fill the bracketed placeholders before submitting. The submission itself
(developer registration, the one-time fee, and final upload) is done by the
account owner.

---

## Basics

- **Name:** TrueBlock & Mute
- **Category:** Productivity
- **Default language:** 日本語 (Japanese); English copy is provided below as well.
- **Package:** `dist/TrueBlock-Mute-v<version>.zip` (built with `node scripts/build-package.mjs`)
- **Privacy policy URL:** `[PASTE THE HOSTED docs/privacy-policy.html URL]`
- **Support / contact email:** `[ADD YOUR CONTACT EMAIL]`

---

## Summary (short description — keep under 132 characters)

**日本語:**
自分のブロック・ミュート済みアカウント由来の投稿（リポスト・引用経由も）を X で非表示に。データは端末内のみ・外部送信なし。

**English:**
Hide posts from accounts you've blocked or muted on X — including via reposts and quotes. All data stays on your device.

---

## Detailed description

### 日本語

X (Twitter) では、ブロック・ミュートしたアカウントでも、他人のリポストや引用を通じて
タイムラインに表示されてしまうことがあります。TrueBlock & Mute は、**あなた自身の**
ブロック・ミュート一覧を端末内に取り込み、その一覧に含まれるアカウント由来の投稿を
（リポスト・引用経由を含めて）タイムラインから非表示にします。

**特長**
- あなたのブロック / ミュート一覧に基づくフィルタ（リポスト・引用カードにも対応）
- 表示方法を選べます: 完全に隠す / 説明だけ表示 / 何もしない
- データはすべて端末内（ローカル）に保存。外部サーバーへの送信は一切ありません
- 解析・トラッキング・広告なし。要求する権限は最小限（ストレージと x.com / twitter.com のみ）

**使い方**
1. 拡張のポップアップで「同期を有効にする」をオンにします。
2. ブロック一覧 / ミュート一覧の設定ページを開き、一番下までスクロールします。
3. タイムラインに戻ると、対象アカウント由来の投稿が非表示になります。

本拡張は X Corp. および Twitter とは提携・承認関係にありません。

### English

On X (Twitter), accounts you've blocked or muted can still reach your timeline
through other people's reposts and quotes. TrueBlock & Mute imports **your own**
block/mute lists onto your device and hides posts from those accounts — including
posts surfaced via reposts and quotes.

**Features**
- Filtering based on your own block/mute lists (handles reposts and quoted cards)
- Choose how matched posts are shown: hide completely / show a short notice / do nothing
- All data is stored locally on your device — nothing is ever sent to any server
- No analytics, tracking, or ads; minimal permissions (storage and x.com / twitter.com only)

**How to use**
1. Turn on "sync" in the extension popup.
2. Open your Blocked / Muted accounts settings pages and scroll to the bottom.
3. Return to your timeline — posts from those accounts are now hidden.

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
- **Privacy policy URL:** `[PASTE THE HOSTED docs/privacy-policy.html URL]`

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
