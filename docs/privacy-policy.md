# TrueBlock & Mute — Privacy Policy / プライバシーポリシー

**Last updated / 最終更新日: 2026-06-14**

TrueBlock & Mute is a Chrome extension that hides posts on X (Twitter) authored by
accounts on **your own** block/mute lists, including posts surfaced via reposts and
quotes. This policy explains exactly what data the extension handles.

TrueBlock & Mute は、X (Twitter) のタイムラインから、**あなた自身の**ブロック・ミュート
一覧に含まれるアカウント由来の投稿（リポスト・引用経由を含む）を非表示にする Chrome
拡張機能です。本ポリシーは、本拡張が扱うデータを正確に説明します。

---

## English

### Summary

TrueBlock & Mute does **not** collect, transmit, or sell any personal data. All
data stays on your device. There are no servers, no analytics, and no third-party
sharing.

### What data the extension accesses and uses

- **Your own block/mute list.** When you open `x.com/settings/blocked/all` or
  `x.com/settings/muted/all` with sync enabled, the extension reads the list
  response that X returns to your browser and extracts, for each account on your
  list, only: the numeric user id, the handle (screen name), and which list it is
  on (blocked or muted).
- It does **not** read or store display names, post text, your timeline content,
  cookies, CSRF/authorization tokens, OAuth tokens, pagination cursors, or any
  other account data.

### How the data is stored

- The extracted ids/handles are stored **locally on your device** using Chrome's
  `chrome.storage.local`. This data is used solely to match and hide posts from
  those accounts in your timeline.
- Settings (filter on/off, display mode) are stored in `chrome.storage`.

### What the extension does NOT do

- It does not send any data off your device. There is no backend server.
- It does not use analytics, tracking, advertising, or fingerprinting.
- It does not share, sell, or transfer data to any third party.

### Permissions

- `storage` — to save your list and settings locally on your device.
- Host access to `x.com` / `twitter.com` — so the content script can hide posts
  on those pages and read your own block/mute list from the settings pages.

The extension requests no other permissions (no `tabs`, `cookies`, `webRequest`,
`scripting`, `<all_urls>`, or external hosts).

### Data retention and deletion

- You can delete the synced list at any time from the extension popup
  ("同期データを消す") or the options page.
- Uninstalling the extension removes all of its local data.

### Changes to this policy

If this policy changes, the "Last updated" date above will change and the new
version will be published at the policy URL.

### Contact

Questions about this policy: **[ADD YOUR CONTACT EMAIL BEFORE PUBLISHING]**

---

## 日本語

### 概要

TrueBlock & Mute は、個人データを**収集・送信・販売しません**。すべてのデータは端末内に
留まります。サーバー・解析・第三者共有はありません。

### 取得・利用するデータ

- **あなた自身のブロック・ミュート一覧。** 同期を有効にした状態で
  `x.com/settings/blocked/all` または `x.com/settings/muted/all` を開くと、X が
  あなたのブラウザに返す一覧応答を読み取り、一覧上の各アカウントについて次だけを
  抽出します: 数値の user id、handle（screen name）、種別（ブロック / ミュート）。
- 表示名、投稿本文、タイムラインの内容、Cookie、CSRF/認可トークン、OAuth トークン、
  ページネーション cursor、その他のアカウントデータは**読み取らず・保存しません**。

### 保存場所

- 抽出した id / handle は、Chrome の `chrome.storage.local` を用いて**端末内に
  ローカル保存**します。用途は、該当アカウント由来の投稿をタイムラインで照合・非表示に
  することのみです。
- 設定（フィルタの ON/OFF、表示モード）は `chrome.storage` に保存します。

### 行わないこと

- データを端末外へ送信しません。バックエンドサーバーはありません。
- 解析・トラッキング・広告・フィンガープリンティングを行いません。
- データを第三者へ共有・販売・移転しません。

### 権限

- `storage` — 一覧と設定を端末内にローカル保存するため。
- `x.com` / `twitter.com` へのホストアクセス — content script がそれらのページで
  投稿を非表示にし、設定ページからあなた自身のブロック・ミュート一覧を読み取るため。

これ以外の権限（`tabs` / `cookies` / `webRequest` / `scripting` / `<all_urls>` /
外部ホスト）は要求しません。

### データの保持・削除

- 取り込んだ一覧は、拡張の popup（「同期データを消す」）または設定ページからいつでも
  削除できます。
- 拡張をアンインストールすると、ローカルデータはすべて削除されます。

### 本ポリシーの変更

変更時は上部の「最終更新日」を更新し、新しい版をポリシー URL で公開します。

### 連絡先

本ポリシーに関するお問い合わせ: **[公開前に連絡先メールアドレスを記入してください]**
