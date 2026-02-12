// Claude Usage Monitor - Background Service Worker

const VSCODE_SERVER_URL = 'http://localhost:19876/usage';
const ALARM_NAME = 'fetchUsage';
const FETCH_INTERVAL_MINUTES = 1;

// Initialize alarm on install
chrome.runtime.onInstalled.addListener(() => {
  chrome.alarms.create(ALARM_NAME, {
    delayInMinutes: 0.1,
    periodInMinutes: FETCH_INTERVAL_MINUTES
  });
  console.log('Claude Usage Monitor installed');
});

// Handle alarm
chrome.alarms.onAlarm.addListener((alarm) => {
  if (alarm.name === ALARM_NAME) {
    fetchAndSendUsage();
  }
});

// Fetch organization ID from claude.ai
// Prefer organizations with active Pro/Team plans
async function getOrganizationId() {
  try {
    const response = await fetch('https://claude.ai/api/organizations', {
      credentials: 'include'
    });

    if (!response.ok) {
      throw new Error(`HTTP ${response.status}`);
    }

    const orgs = await response.json();
    console.log('Available organizations:', orgs.map(o => ({ uuid: o.uuid, name: o.name, billing_type: o.billing_type, raven_type: o.raven_type })));

    if (!orgs || orgs.length === 0) {
      throw new Error('No organizations found');
    }

    // Priority 1: Find org with paid subscription (billing_type is set)
    for (const org of orgs) {
      if (org.billing_type && org.billing_type !== null) {
        console.log('Found paid org:', org.uuid, org.name, 'billing:', org.billing_type);
        return org.uuid;
      }
    }

    // Priority 2: Find org with raven_type (Pro/Team indicator)
    for (const org of orgs) {
      if (org.raven_type && org.raven_type !== null) {
        console.log('Found raven org:', org.uuid, org.name, 'raven_type:', org.raven_type);
        return org.uuid;
      }
    }

    // Priority 3: Find org with "raven" in capabilities
    for (const org of orgs) {
      if (org.capabilities && org.capabilities.includes('raven')) {
        console.log('Found org with raven capability:', org.uuid, org.name);
        return org.uuid;
      }
    }

    // Fallback: return first org
    console.log('Using first org (fallback):', orgs[0].uuid, orgs[0].name);
    return orgs[0].uuid;
  } catch (error) {
    console.error('Failed to get organization ID:', error);
    return null;
  }
}

// Fetch usage data from claude.ai
async function fetchUsage(organizationId) {
  try {
    console.log('Fetching usage for org:', organizationId);
    const response = await fetch(
      `https://claude.ai/api/organizations/${organizationId}/usage`,
      { credentials: 'include' }
    );

    console.log('Usage response status:', response.status);

    if (!response.ok) {
      const text = await response.text();
      console.error('Usage response error body:', text);
      throw new Error(`HTTP ${response.status}`);
    }

    const data = await response.json();
    console.log('Usage response data:', data);
    return data;
  } catch (error) {
    console.error('Failed to fetch usage:', error);
    return null;
  }
}

// Send usage data to VS Code extension server
async function sendToVSCode(data) {
  try {
    const response = await fetch(VSCODE_SERVER_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(data)
    });

    if (!response.ok) {
      throw new Error(`HTTP ${response.status}`);
    }

    return true;
  } catch (error) {
    // VS Code server might not be running, that's okay
    console.log('VS Code server not available:', error.message);
    return false;
  }
}

// Main function to fetch and send usage
async function fetchAndSendUsage() {
  console.log('Fetching usage data...');

  // Get or retrieve cached organization ID
  let { organizationId } = await chrome.storage.local.get('organizationId');

  if (!organizationId) {
    organizationId = await getOrganizationId();
    if (organizationId) {
      await chrome.storage.local.set({ organizationId });
    }
  }

  if (!organizationId) {
    updateBadge('!', '#FF0000');
    await chrome.storage.local.set({
      lastError: 'Not logged in to claude.ai',
      lastUpdate: new Date().toISOString()
    });
    return;
  }

  const usage = await fetchUsage(organizationId);

  if (!usage) {
    // Maybe organization ID changed, clear cache and retry next time
    await chrome.storage.local.remove('organizationId');
    updateBadge('!', '#FF0000');
    await chrome.storage.local.set({
      lastError: 'Failed to fetch usage',
      lastUpdate: new Date().toISOString()
    });
    return;
  }

  // Validate response structure - at least five_hour should exist
  if (!usage.five_hour) {
    console.error('Unexpected usage response structure:', usage);
    updateBadge('!', '#FF0000');
    await chrome.storage.local.set({
      lastError: 'Invalid API response structure',
      lastUpdate: new Date().toISOString()
    });
    return;
  }

  // Prepare data - handle null seven_day for free accounts
  const data = {
    fiveHour: {
      utilization: usage.five_hour.utilization || 0,
      resetsAt: usage.five_hour.resets_at || ''
    },
    sevenDay: usage.seven_day ? {
      utilization: usage.seven_day.utilization || 0,
      resetsAt: usage.seven_day.resets_at || ''
    } : null,
    updatedAt: new Date().toISOString()
  };

  // Save to local storage for popup
  await chrome.storage.local.set({
    usageData: data,
    lastError: null,
    lastUpdate: new Date().toISOString()
  });

  // Update badge
  const fiveHour = Math.round(data.fiveHour.utilization);
  updateBadge(fiveHour.toString(), fiveHour >= 80 ? '#FF6600' : '#4CAF50');

  // Send to VS Code
  await sendToVSCode(data);

  console.log('Usage data updated:', data);
}

// Update extension badge
function updateBadge(text, color) {
  chrome.action.setBadgeText({ text });
  chrome.action.setBadgeBackgroundColor({ color });
}

// Listen for messages from popup
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message.type === 'refresh') {
    fetchAndSendUsage().then(() => {
      sendResponse({ success: true });
    });
    return true; // Keep channel open for async response
  }

  if (message.type === 'clearOrgId') {
    chrome.storage.local.remove('organizationId').then(() => {
      sendResponse({ success: true });
    });
    return true;
  }
});

// Initial fetch
fetchAndSendUsage();
