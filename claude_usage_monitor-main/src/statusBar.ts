import * as vscode from 'vscode';
import { UsageData } from './dataReceiver';

const WARNING_THRESHOLD = 80;

export class StatusBarManager {
  private statusBarItem: vscode.StatusBarItem;
  private lastUsageData: UsageData | null = null;

  constructor() {
    this.statusBarItem = vscode.window.createStatusBarItem(
      vscode.StatusBarAlignment.Right,
      100
    );
    this.statusBarItem.command = 'claude-usage-monitor.showDetails';
    this.statusBarItem.show();
    this.setLoading();
  }

  setLoading(): void {
    this.statusBarItem.text = '$(sync~spin) Claude: Loading...';
    this.statusBarItem.backgroundColor = undefined;
    this.statusBarItem.tooltip = 'Fetching usage data...';
  }

  setError(message: string): void {
    this.statusBarItem.text = '$(warning) Claude: Error';
    this.statusBarItem.backgroundColor = new vscode.ThemeColor('statusBarItem.warningBackground');
    this.statusBarItem.tooltip = message;
  }

  setNeedsLogin(): void {
    this.statusBarItem.text = '$(key) Claude: Login Required';
    this.statusBarItem.backgroundColor = undefined;
    this.statusBarItem.tooltip = 'Click to login to claude.ai';
    this.statusBarItem.command = 'claude-usage-monitor.login';
  }

  setWaitingForData(): void {
    this.statusBarItem.text = '$(radio-tower) Claude: Waiting...';
    this.statusBarItem.backgroundColor = undefined;
    this.statusBarItem.tooltip = 'Waiting for data from Chrome extension.\nMake sure Chrome is running and logged into claude.ai.';
    this.statusBarItem.command = 'claude-usage-monitor.showDetails';
  }

  update(data: UsageData): void {
    this.lastUsageData = data;

    const fiveHour = Math.round(data.fiveHour.utilization);
    const sevenDay = data.sevenDay ? Math.round(data.sevenDay.utilization) : null;

    // Display text based on available data
    if (sevenDay !== null) {
      this.statusBarItem.text = `$(graph) Claude: 5h ${fiveHour}% | 7d ${sevenDay}%`;
    } else {
      this.statusBarItem.text = `$(graph) Claude: 5h ${fiveHour}%`;
    }

    // Set warning color if exceeds threshold
    const showWarning = fiveHour >= WARNING_THRESHOLD || (sevenDay !== null && sevenDay >= WARNING_THRESHOLD);
    if (showWarning) {
      this.statusBarItem.backgroundColor = new vscode.ThemeColor('statusBarItem.warningBackground');
    } else {
      this.statusBarItem.backgroundColor = undefined;
    }

    // Format reset times
    const fiveHourReset = this.formatResetTime(data.fiveHour.resetsAt);
    const sevenDayReset = data.sevenDay ? this.formatResetTime(data.sevenDay.resetsAt) : 'N/A';

    // Build tooltip
    let tooltipContent = `**Claude Usage**\n\n` +
      `| Period | Usage | Resets |\n` +
      `|--------|-------|--------|\n` +
      `| 5 Hour | ${fiveHour}% | ${fiveHourReset} |\n`;

    if (sevenDay !== null) {
      tooltipContent += `| 7 Day | ${sevenDay}% | ${sevenDayReset} |\n`;
    }

    tooltipContent += `\n_Click for more options_`;

    this.statusBarItem.tooltip = new vscode.MarkdownString(tooltipContent);

    this.statusBarItem.command = 'claude-usage-monitor.showDetails';
  }

  private formatResetTime(dateStr: string): string {
    if (!dateStr) {
      return 'N/A';
    }
    const date = new Date(dateStr);
    const now = new Date();
    const diff = date.getTime() - now.getTime();

    if (diff < 0) {
      return 'Now';
    }

    const hours = Math.floor(diff / (1000 * 60 * 60));
    const minutes = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));

    if (hours > 24) {
      const days = Math.floor(hours / 24);
      return `${days}d ${hours % 24}h`;
    }

    if (hours > 0) {
      return `${hours}h ${minutes}m`;
    }

    return `${minutes}m`;
  }

  getLastUsageData(): UsageData | null {
    return this.lastUsageData;
  }

  dispose(): void {
    this.statusBarItem.dispose();
  }
}
