# Claude Usage Monitor

VS Code のステータスバーに claude.ai の使用率を表示する拡張機能です。

Chrome拡張機能がclaude.aiからデータを取得し、VS Code拡張機能に送信するハイブリッドアーキテクチャを採用しています。

![Status Bar](https://img.shields.io/badge/Claude-5h%2043%25%20%7C%207d%2026%25-green)

## 機能

- **リアルタイム表示**: 5時間/7日間の使用率をステータスバーに表示
- **自動更新**: 1分ごとにChrome拡張機能がデータを取得
- **警告表示**: 使用率が80%を超えると警告色（オレンジ）に変化
- **Cloudflare対応**: ブラウザセッションを利用してCloudflareをバイパス

## プロジェクト構造

```
claude-usage-monitor/
├── src/                    # VS Code拡張機能のソースコード
├── chrome-extension/       # Chrome拡張機能
│   ├── manifest.json
│   ├── background.js
│   ├── popup.html
│   ├── popup.js
│   └── icon*.png
├── package.json
└── README.md
└── claude-usage-monitor-0.1.0.vsix
```

## インストール

### 1. Chrome拡張機能のインストール

1. Chromeで `chrome://extensions` を開く
2. 右上の「デベロッパーモード」をオンにする
3. 「パッケージ化されていない拡張機能を読み込む」をクリック
4. `chrome-extension` フォルダを選択

### 2. VS Code拡張機能のインストール

#### VSIXからインストール

1. VS Codeで `Ctrl+Shift+P` を押す
2. "Extensions: Install from VSIX" を選択
3. `claude-usage-monitor-0.1.0.vsix` を選択

#### ソースからビルド

```bash
npm install
npm run compile
npx vsce package
```

### 3. claude.aiにログイン

1. Chromeで [claude.ai](https://claude.ai) を開く
2. ログインする（Pro/Teamプランが必要）

## 使い方

### ステータスバー表示

```
Claude: 5h 43% | 7d 26%
```

- `5h`: 5時間の使用率
- `7d`: 7日間の使用率（Pro/Teamプランのみ）
- 80%以上で背景がオレンジ色に変化

### Chrome拡張機能ポップアップ

ツールバーのアイコンをクリックすると詳細な使用率を表示

## アーキテクチャ

```
┌─────────────────┐     HTTP POST      ┌─────────────────┐
│ Chrome Extension│ ─────────────────► │ VS Code Extension│
│                 │   localhost:19876  │                 │
│ - claude.ai API │                    │ - Status Bar    │
│ - 1分ごと自動更新 │                    │ - Quick Pick    │
└─────────────────┘                    └─────────────────┘
```

## セキュリティ

- Chrome拡張機能は認証済みブラウザセッションを使用
- VS Codeとの通信はlocalhost限定
- セッションキーやcookieはファイルに保存されません

## トラブルシューティング

### "Waiting..." が表示され続ける

- Chrome拡張機能がインストールされているか確認
- Chromeでclaude.aiにログインしているか確認
- Chrome拡張機能のService Workerコンソールでエラーを確認

### 使用率が0%のまま

- Pro/Teamプランの組織が選択されているか確認
- Chrome拡張機能を再読み込みして組織IDをリセット

### 組織が正しくない

Chrome拡張機能のService Workerコンソールで実行:
```javascript
chrome.storage.local.remove('organizationId').then(() => fetchAndSendUsage())
```

## 開発

### 必要環境

- Node.js 18+
- npm
- Chrome

### ビルド

```bash
# VS Code拡張機能
npm install
npm run compile
npx vsce package

# Chrome拡張機能は直接読み込み可能
```

## ライセンス

MIT
