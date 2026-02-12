// Popup script for Claude Usage Monitor

document.addEventListener('DOMContentLoaded', async () => {
  await loadData();

  document.getElementById('refresh').addEventListener('click', async () => {
    const button = document.getElementById('refresh');
    button.textContent = 'Refreshing...';
    button.disabled = true;

    await chrome.runtime.sendMessage({ type: 'refresh' });

    // Wait a moment for data to update
    await new Promise(resolve => setTimeout(resolve, 1000));
    await loadData();

    button.textContent = 'Refresh';
    button.disabled = false;
  });

  document.getElementById('openClaude').addEventListener('click', () => {
    chrome.tabs.create({ url: 'https://claude.ai' });
  });
});

async function loadData() {
  const { usageData, lastError, lastUpdate } = await chrome.storage.local.get([
    'usageData',
    'lastError',
    'lastUpdate'
  ]);

  const errorEl = document.getElementById('error');

  if (lastError) {
    errorEl.textContent = lastError;
    errorEl.style.display = 'block';
  } else {
    errorEl.style.display = 'none';
  }

  if (usageData) {
    updateUsageDisplay('fiveHour', usageData.fiveHour);
    updateUsageDisplay('sevenDay', usageData.sevenDay);
  }

  if (lastUpdate) {
    const date = new Date(lastUpdate);
    document.getElementById('lastUpdate').textContent =
      `Last updated: ${date.toLocaleTimeString()}`;
  }
}

function updateUsageDisplay(prefix, data) {
  const utilization = Math.round(data.utilization);
  const isWarning = utilization >= 80;

  const valueEl = document.getElementById(prefix);
  valueEl.textContent = `${utilization}%`;
  valueEl.className = `usage-value ${isWarning ? 'warning' : 'normal'}`;

  const barEl = document.getElementById(`${prefix}Bar`);
  barEl.style.width = `${utilization}%`;
  barEl.className = `progress-fill ${isWarning ? 'warning' : 'normal'}`;

  const resetEl = document.getElementById(`${prefix}Reset`);
  const resetDate = new Date(data.resetsAt);
  resetEl.textContent = `Resets: ${formatResetTime(resetDate)}`;
}

function formatResetTime(date) {
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
