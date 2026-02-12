import * as vscode from 'vscode';
import { DataReceiver, UsageData } from './dataReceiver';
import { StatusBarManager } from './statusBar';

let statusBarManager: StatusBarManager;
let dataReceiver: DataReceiver;
let lastUsageData: UsageData | null = null;

export function activate(context: vscode.ExtensionContext): void {
  statusBarManager = new StatusBarManager();
  dataReceiver = new DataReceiver();

  // Register commands
  context.subscriptions.push(
    vscode.commands.registerCommand('claude-usage-monitor.refresh', () => {
      vscode.window.showInformationMessage(
        'Chrome拡張機能が自動的にデータを更新します。\nChromeでclaude.aiにログインしていることを確認してください。'
      );
    })
  );

  context.subscriptions.push(
    vscode.commands.registerCommand('claude-usage-monitor.showDetails', () => {
      showDetailsQuickPick();
    })
  );

  context.subscriptions.push(
    vscode.commands.registerCommand('claude-usage-monitor.openChrome', () => {
      vscode.env.openExternal(vscode.Uri.parse('https://claude.ai'));
    })
  );

  context.subscriptions.push(statusBarManager);

  // Start data receiver server
  dataReceiver.start((data) => {
    lastUsageData = data;
    updateStatusBar(data);
  });

  // Set initial status
  statusBarManager.setWaitingForData();

  // Show setup message on first activation
  showSetupMessageIfNeeded(context);
}

function updateStatusBar(data: UsageData): void {
  statusBarManager.update(data);
}

async function showSetupMessageIfNeeded(context: vscode.ExtensionContext): Promise<void> {
  const hasShownSetup = context.globalState.get<boolean>('hasShownSetup');

  if (!hasShownSetup) {
    const action = await vscode.window.showInformationMessage(
      'Claude Usage Monitor: Chrome拡張機能をインストールして、claude.aiにログインしてください。',
      'セットアップ手順を見る',
      '閉じる'
    );

    if (action === 'セットアップ手順を見る') {
      showSetupInstructions();
    }

    await context.globalState.update('hasShownSetup', true);
  }
}

function showSetupInstructions(): void {
  const panel = vscode.window.createWebviewPanel(
    'claudeSetup',
    'Claude Usage Monitor - Setup',
    vscode.ViewColumn.One,
    {}
  );

  panel.webview.html = `
<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8">
  <style>
    body {
      font-family: var(--vscode-font-family);
      padding: 20px;
      color: var(--vscode-foreground);
      background-color: var(--vscode-editor-background);
      line-height: 1.6;
    }
    h1 { font-size: 1.5em; margin-bottom: 20px; }
    h2 { font-size: 1.2em; margin-top: 24px; }
    ol { padding-left: 20px; }
    li { margin-bottom: 12px; }
    code {
      background-color: var(--vscode-textCodeBlock-background);
      padding: 2px 6px;
      border-radius: 3px;
    }
    .note {
      background: var(--vscode-textBlockQuote-background);
      border-left: 4px solid var(--vscode-textBlockQuote-border);
      padding: 12px;
      margin: 16px 0;
    }
  </style>
</head>
<body>
  <h1>Claude Usage Monitor - セットアップ</h1>

  <h2>1. Chrome拡張機能をインストール</h2>
  <ol>
    <li>Chromeで <code>chrome://extensions</code> を開く</li>
    <li>右上の「デベロッパーモード」をオンにする</li>
    <li>「パッケージ化されていない拡張機能を読み込む」をクリック</li>
    <li><code>claude-usage-chrome</code> フォルダを選択</li>
  </ol>

  <h2>2. claude.aiにログイン</h2>
  <ol>
    <li>Chromeで <a href="https://claude.ai">claude.ai</a> を開く</li>
    <li>ログインする</li>
  </ol>

  <h2>3. 完了！</h2>
  <p>Chrome拡張機能が自動的に使用量データを取得し、VS Codeに送信します。</p>

  <div class="note">
    <strong>注意:</strong> データはChromeがclaude.aiにログインしている間のみ更新されます。
    セキュリティのため、データファイルは20秒後に自動削除されます。
  </div>
</body>
</html>
  `;
}

async function showDetailsQuickPick(): Promise<void> {
  const items: vscode.QuickPickItem[] = [
    {
      label: '$(globe) Open Claude.ai',
      description: 'Open Claude.ai in browser'
    },
    {
      label: '$(info) Setup Instructions',
      description: 'View setup instructions'
    }
  ];

  if (lastUsageData) {
    const fiveHour = Math.round(lastUsageData.fiveHour.utilization);
    const updatedAt = new Date(lastUsageData.updatedAt);

    items.unshift({
      label: `5 Hour: ${fiveHour}%`,
      description: lastUsageData.fiveHour.resetsAt
        ? `Resets at ${new Date(lastUsageData.fiveHour.resetsAt).toLocaleTimeString()}`
        : ''
    });

    if (lastUsageData.sevenDay) {
      const sevenDay = Math.round(lastUsageData.sevenDay.utilization);
      items.unshift({
        label: `7 Day: ${sevenDay}%`,
        description: lastUsageData.sevenDay.resetsAt
          ? `Resets at ${new Date(lastUsageData.sevenDay.resetsAt).toLocaleDateString()}`
          : ''
      });
    }

    items.unshift({
      label: `$(clock) Last updated: ${updatedAt.toLocaleTimeString()}`,
      description: ''
    });
  }

  const selected = await vscode.window.showQuickPick(items, {
    placeHolder: 'Claude Usage Monitor'
  });

  if (selected?.label === '$(globe) Open Claude.ai') {
    vscode.env.openExternal(vscode.Uri.parse('https://claude.ai'));
  } else if (selected?.label === '$(info) Setup Instructions') {
    showSetupInstructions();
  }
}

export function deactivate(): void {
  if (dataReceiver) {
    dataReceiver.stop();
  }
}
