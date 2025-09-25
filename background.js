// Background service worker for Focus Blocks
const DNR = chrome.declarativeNetRequest;

// Rule ID ranges for different types of blocks
const RULE_RANGES = {
  FOCUS_SESSION: { start: 10000, end: 19999 },
  SCHEDULE: { start: 20000, end: 29999 },
  CUSTOM: { start: 30000, end: 39999 }
};

// Default blocklists - using more specific patterns for element blocking
const DEFAULT_LISTS = {
  workday: [
    "*://*.instagram.com/*",
    "*://*.reddit.com/*",
    "*://*.twitter.com/*",
    "*://*.x.com/*"
  ],
  deep_work: [
    "*://*.youtube.com/*",
    "*://*.instagram.com/*",
    "*://*.reddit.com/*",
    "*://*.twitter.com/*",
    "*://*.x.com/*",
    "*://*.tiktok.com/*",
    "*://*.facebook.com/*"
  ],
  social_media: [
    "*://*.instagram.com/*",
    "*://*.twitter.com/*",
    "*://*.x.com/*",
    "*://*.facebook.com/*",
    "*://*.tiktok.com/*"
  ]
};

// Initialize extension data
async function initializeExtension() {
  const data = await chrome.storage.sync.get(['lists', 'schedules', 'activeFocusUntil', 'settings']);
  
  if (!data.lists) {
    await chrome.storage.sync.set({ lists: DEFAULT_LISTS });
  }
  
  if (!data.schedules) {
    await chrome.storage.sync.set({ schedules: [] });
  }
  
  if (!data.settings) {
    await chrome.storage.sync.set({ 
      settings: {
        enableNotifications: true,
        bypassRequiresHold: true,
        bypassHoldDuration: 3000,
        showStats: true
      }
    });
  }
  
  // Set up alarms for existing schedules
  await setupScheduleAlarms();
  
  // Check if focus session is still active
  if (data.activeFocusUntil && data.activeFocusUntil > Date.now()) {
    const remainingTime = data.activeFocusUntil - Date.now();
    chrome.alarms.create('focusSessionEnd', { delayInMinutes: remainingTime / 60000 });
  } else if (data.activeFocusUntil && data.activeFocusUntil <= Date.now()) {
    // Session has expired, clean it up
    await chrome.storage.sync.set({ 
      activeFocusUntil: 0,
      isDeepFocus: false,
      focusSessionActive: false
    });
    console.log('Cleaned up expired focus session during initialization');
  }
}

// Generate deterministic rule IDs
function generateRuleIds(patterns, type) {
  const range = RULE_RANGES[type];
  const timestamp = Date.now();
  const hash = patterns.join('').split('').reduce((a, b) => {
    a = ((a << 5) - a) + b.charCodeAt(0);
    return a & a;
  }, 0);
  
  return patterns.map((_, index) => {
    const baseId = range.start + Math.abs(hash + index) % (range.end - range.start - 1000);
    return baseId + (timestamp % 1000); // Add timestamp component for uniqueness
  });
}

// Set block rules using DNR
async function setBlockRules(patterns, enable, type = 'CUSTOM') {
  if (!patterns || patterns.length === 0) return;
  
  try {
    if (enable) {
      // Clear existing rules of this type first
      const existingRules = await DNR.getDynamicRules();
      const existingRuleIds = existingRules
        .filter(rule => rule.id >= RULE_RANGES[type].start && rule.id < RULE_RANGES[type].end)
        .map(rule => rule.id);
      
      if (existingRuleIds.length > 0) {
        await DNR.updateDynamicRules({ removeRuleIds: existingRuleIds });
        console.log(`Cleared ${existingRuleIds.length} existing rules for ${type}`);
      }
      
      // Generate new rule IDs
      const ruleIds = generateRuleIds(patterns, type);
          const rules = patterns.map((pattern, index) => ({
      id: ruleIds[index],
      priority: 100, // Higher priority to ensure it takes precedence
      action: {
        type: "redirect",
        redirect: {
          extensionPath: "/blocked.html?from=" + encodeURIComponent(pattern)
        }
      },
      condition: {
        urlFilter: pattern,
        resourceTypes: ["main_frame"]
      }
    }));
      
      console.log('Created DNR rules:', rules);
      
      await DNR.updateDynamicRules({ addRules: rules });
      console.log(`Added ${rules.length} block rules for ${type}`);
      
      // Verify the rules were added
      const currentRules = await DNR.getDynamicRules();
      const addedRules = currentRules.filter(rule => 
        rule.id >= RULE_RANGES[type].start && rule.id < RULE_RANGES[type].end
      );
      console.log(`Verified ${addedRules.length} active rules for ${type}`);
    } else {
      // Remove rules by type range
      const existingRules = await DNR.getDynamicRules();
      const ruleIdsToRemove = existingRules
        .filter(rule => rule.id >= RULE_RANGES[type].start && rule.id < RULE_RANGES[type].end)
        .map(rule => rule.id);
      
      if (ruleIdsToRemove.length > 0) {
        await DNR.updateDynamicRules({ removeRuleIds: ruleIdsToRemove });
        console.log(`Removed ${ruleIdsToRemove.length} block rules for ${type}`);
      }
    }
  } catch (error) {
    console.error('Error updating DNR rules:', error);
  }
}

// Start a focus session
async function startFocusSession(durationMinutes, blocklistName = 'deep_work') {
  const data = await chrome.storage.sync.get(['lists']);
  const patterns = data.lists[blocklistName] || DEFAULT_LISTS.deep_work;
  
  const endTime = Date.now() + (durationMinutes * 60 * 1000);
  
  // Determine blocking strategy based on duration
  const isDeepFocus = durationMinutes >= 90; // Deep Focus blocks entire sites
  
  console.log('Starting focus session:', { durationMinutes, isDeepFocus, patterns });
  
  if (isDeepFocus) {
    // Deep Focus should override any temporary per-site bypasses
    try {
      await chrome.storage.sync.remove(BYPASS_KEY);
    } catch (_) {}

    // Deep Focus: Block entire sites using DNR with redirect to blocked page
    console.log('Setting up Deep Focus DNR rules');
    await setBlockRules(patterns, true, 'FOCUS_SESSION');
    
    // Silently reload relevant tabs so DNR blocking takes effect immediately
    const tabs = await chrome.tabs.query({});
    const relevantDomains = ['instagram.com', 'youtube.com', 'reddit.com', 'twitter.com', 'x.com', 'facebook.com', 'tiktok.com'];
    
    // Also extract domains from custom patterns
    const customDomains = patterns
      .filter(pattern => !relevantDomains.some(domain => pattern.includes(domain)))
      .map(pattern => {
        try {
          // Extract domain from pattern like "*://*.example.com/*"
          const match = pattern.match(/\*:\/\/\*\.([^/]+)\/*/);
          return match ? match[1] : null;
        } catch (e) {
          return null;
        }
      })
      .filter(domain => domain);
    
    const allRelevantDomains = [...relevantDomains, ...customDomains];
    
    tabs.forEach(tab => {
      if (tab.url && allRelevantDomains.some(domain => tab.url.includes(domain))) {
        try {
          chrome.tabs.reload(tab.id);
        } catch (e) {
          // Ignore errors
        }
      }
    });
  } else {
    // Quick Focus: Only content scripts will block elements (no DNR rules)
    console.log('Quick Focus - no DNR rules, only content script blocking');
    // Clear any existing DNR rules to ensure no blocking
    await setBlockRules(patterns, false, 'FOCUS_SESSION');
  }
  
  console.log('Background: Setting storage values:', { 
    activeFocusUntil: endTime,
    isDeepFocus: isDeepFocus,
    focusSessionActive: true
  });
  
  await Promise.all([
    chrome.storage.sync.set({ 
      activeFocusUntil: endTime,
      isDeepFocus: isDeepFocus,
      focusSessionActive: true
    }),
    chrome.alarms.create('focusSessionEnd', { delayInMinutes: durationMinutes })
  ]);
  
  console.log('Background: Storage set successfully, verifying...');
  
  // Verify storage was set correctly
  const verifyData = await chrome.storage.sync.get(['activeFocusUntil', 'focusSessionActive', 'isDeepFocus']);
  console.log('Background: Storage verification:', verifyData);
  
  // Wait a moment for storage to sync, then notify content scripts
  setTimeout(() => {
    console.log('Background: Broadcasting session change...');
    broadcastSessionChange();
  }, 100);
  
  if (chrome.notifications) {
    chrome.notifications.create({
      type: 'basic',
      iconUrl: 'icons/optimized/icon48.png',
      title: isDeepFocus ? 'Deep Focus Started' : 'Focus Started',
      message: isDeepFocus ? 'Distracting sites will be fully blocked' : 'Distractions will be hidden'
    });
  }
  
  return { success: true, activeUntil: endTime, isDeepFocus };
}

// End focus session
async function endFocusSession() {
  console.log('Background: endFocusSession called');
  const data = await chrome.storage.sync.get(['lists']);
  const patterns = data.lists.deep_work || DEFAULT_LISTS.deep_work;
  
  await Promise.all([
    setBlockRules(patterns, false, 'FOCUS_SESSION'),
    chrome.storage.sync.set({ 
      activeFocusUntil: 0,
      isDeepFocus: false,
      focusSessionActive: false
    }),
    chrome.alarms.clear('focusSessionEnd')
  ]);
  
  // Wait a moment for storage to sync, then notify content scripts and refresh tabs
  setTimeout(() => {
    console.log('Background: Broadcasting session change and refreshing tabs');
    broadcastSessionChange();
    // Proactively tell scripts to clear any UI-blocking styles immediately
    chrome.tabs.query({}, (tabs) => {
      const relevantSites = ['instagram.com', 'youtube.com', 'reddit.com', 'twitter.com', 'x.com'];
      tabs.forEach(tab => {
        if (tab.url && relevantSites.some(site => tab.url.includes(site))) {
          console.log(`Sending forceClear to ${tab.url}`);
          chrome.tabs.sendMessage(tab.id, { action: 'forceClear' }).catch((error) => {
            console.log(`Could not send forceClear to ${tab.url}:`, error.message);
          });
        }
      });
    });
    refreshBlockedTabs();
  }, 100);
  
  if (chrome.notifications) {
    chrome.notifications.create({
      type: 'basic',
      iconUrl: 'icons/optimized/icon48.png',
      title: 'Focus Session Ended',
      message: 'Distracting sites are now accessible again'
    });
  }
  
  return { success: true };
}

// Setup schedule alarms
async function setupScheduleAlarms() {
  const data = await chrome.storage.sync.get(['schedules']);
  const schedules = data.schedules || [];
  
  // Clear existing schedule alarms (both old and new format)
  const alarms = await chrome.alarms.getAll();
  const scheduleAlarms = alarms.filter(alarm => alarm.name.startsWith('schedule_'));
  await Promise.all(scheduleAlarms.map(alarm => chrome.alarms.clear(alarm.name)));
  
  console.log(`Cleared ${scheduleAlarms.length} existing schedule alarms`);
  
  // Create new alarms for each schedule
  for (const schedule of schedules) {
    if (schedule.enabled) {
      console.log(`Setting up alarms for schedule: ${schedule.name}`);
      await createScheduleAlarms(schedule);
    }
  }
  
  console.log(`Setup complete for ${schedules.length} schedules`);
}

// Create alarms for a specific schedule
async function createScheduleAlarms(schedule) {
  const now = new Date();
  const [startHour, startMinute] = schedule.start.split(':').map(Number);
  const [endHour, endMinute] = schedule.end.split(':').map(Number);
  
  // Create alarms for each day in the schedule
  for (const dayOfWeek of schedule.days) {
    // Calculate next occurrence of this day
    const nextOccurrence = getNextOccurrenceOfDay(dayOfWeek, startHour, startMinute);
    const endOccurrence = getNextOccurrenceOfDay(dayOfWeek, endHour, endMinute);
    
    // Only create alarms if the times are in the future
    if (nextOccurrence > now) {
      const startDelay = Math.max(0, nextOccurrence.getTime() - now.getTime());
      const endDelay = Math.max(0, endOccurrence.getTime() - now.getTime());
      
      await chrome.alarms.create(`schedule_${schedule.id}_${dayOfWeek}_start`, {
        delayInMinutes: startDelay / 60000
      });
      
      await chrome.alarms.create(`schedule_${schedule.id}_${dayOfWeek}_end`, {
        delayInMinutes: endDelay / 60000
      });
    }
  }
}

// Helper function to get next occurrence of a specific day and time
function getNextOccurrenceOfDay(dayOfWeek, hour, minute) {
  const now = new Date();
  const target = new Date();
  target.setHours(hour, minute, 0, 0);
  
  // Calculate days until next occurrence
  const daysUntilTarget = (dayOfWeek - now.getDay() + 7) % 7;
  
  if (daysUntilTarget === 0) {
    // Same day - check if time has passed
    if (target <= now) {
      target.setDate(target.getDate() + 7); // Next week
    }
  } else {
    target.setDate(target.getDate() + daysUntilTarget);
  }
  
  return target;
}

// Broadcast session changes to content scripts
function broadcastSessionChange() {
  chrome.tabs.query({}, (tabs) => {
    console.log(`Broadcasting session change to ${tabs.length} tabs`);
    tabs.forEach(tab => {
      // Only send to relevant sites
      const relevantSites = ['instagram.com', 'youtube.com', 'reddit.com', 'twitter.com', 'x.com', 'facebook.com', 'tiktok.com'];
      const isRelevant = tab.url && relevantSites.some(site => tab.url.includes(site));
      
      if (isRelevant) {
        console.log(`Sending focusSessionChanged to ${tab.url}`);
        // Send message with retry mechanism
        const sendMessageWithRetry = (retryCount = 0) => {
          chrome.tabs.sendMessage(tab.id, { action: 'focusSessionChanged' }).then(() => {
            console.log(`Successfully sent message to tab ${tab.id} (${tab.url})`);
          }).catch((error) => {
            if (retryCount < 2) {
              // Retry after a short delay
              setTimeout(() => {
                sendMessageWithRetry(retryCount + 1);
              }, 200);
            } else {
              // Ignore errors for tabs that don't have content scripts
              console.log(`Could not send message to tab ${tab.id} (${tab.url}):`, error.message);
            }
          });
        };
        
        sendMessageWithRetry();
      }
    });
  });
}

// Refresh tabs that were blocked during focus session
async function refreshBlockedTabs() {
  const defaultBlockedDomains = [
    'instagram.com',
    'youtube.com', 
    'reddit.com',
    'twitter.com',
    'x.com',
    'facebook.com',
    'tiktok.com'
  ];
  
  // Get custom domains from storage
  let customDomains = [];
  try {
    const data = await chrome.storage.sync.get(['lists']);
    if (data.lists && data.lists.deep_work) {
      customDomains = data.lists.deep_work
        .filter(pattern => !defaultBlockedDomains.some(domain => pattern.includes(domain)))
        .map(pattern => {
          try {
            const match = pattern.match(/\*:\/\/\*\.([^/]+)\/*/);
            return match ? match[1] : null;
          } catch (e) {
            return null;
          }
        })
        .filter(domain => domain);
    }
  } catch (error) {
    console.error('Error getting custom domains:', error);
  }
  
  const allBlockedDomains = [...defaultBlockedDomains, ...customDomains];
  
  chrome.tabs.query({}, (tabs) => {
    tabs.forEach(tab => {
      if (tab.url && allBlockedDomains.some(domain => tab.url.includes(domain))) {
        console.log(`Refreshing blocked tab: ${tab.url}`);
        chrome.tabs.reload(tab.id);
      }
    });
  });
}

// Temporary per-site bypass tracking
const BYPASS_KEY = 'temporaryBypasses'; // { [domain]: expiresAt }

async function getBypasses() {
  const data = await chrome.storage.sync.get([BYPASS_KEY]);
  return data[BYPASS_KEY] || {};
}

async function setBypasses(bypasses) {
  await chrome.storage.sync.set({ [BYPASS_KEY]: bypasses });
}

function extractDomain(urlOrPattern) {
  try {
    if (!urlOrPattern) return '';
    if (urlOrPattern.startsWith('*://*.')) {
      // pattern like *://*.youtube.com/*
      const m = urlOrPattern.match(/\*:\/\/\*\.([^/]+)\/*/);
      return m ? m[1] : '';
    }
    const u = new URL(urlOrPattern);
    return u.hostname.replace(/^www\./, '');
  } catch {
    return '';
  }
}

async function applyBypassesToRules(patterns) {
  const bypasses = await getBypasses();
  const now = Date.now();
  const activeBypassedDomains = Object.entries(bypasses)
    .filter(([, expires]) => expires > now)
    .map(([domain]) => domain);

  if (activeBypassedDomains.length === 0) return patterns;

  // Filter out any pattern whose domain is currently bypassed
  return patterns.filter(p => {
    const domain = extractDomain(p);
    return !activeBypassedDomains.includes(domain);
  });
}

// Override setBlockRules wrapper when called for FOCUS_SESSION to respect bypasses
const originalSetBlockRules = setBlockRules;
setBlockRules = async function(patterns, enable, type = 'CUSTOM') {
  let effectivePatterns = patterns;
  if (enable && type === 'FOCUS_SESSION') {
    effectivePatterns = await applyBypassesToRules(patterns);
  }
  return originalSetBlockRules(effectivePatterns, enable, type);
};

async function requestTemporaryBypass(targetUrlOrPattern, minutes = 5) {
  const domain = extractDomain(targetUrlOrPattern);
  if (!domain) return { success: false, error: 'Could not determine domain' };

  const bypasses = await getBypasses();
  const expiresAt = Date.now() + minutes * 60 * 1000;
  bypasses[domain] = Math.max(bypasses[domain] || 0, expiresAt);
  await setBypasses(bypasses);

  // Re-apply DNR rules for current session so the bypass takes effect immediately
  const data = await chrome.storage.sync.get(['lists', 'activeFocusUntil', 'focusSessionActive']);
  if (data.focusSessionActive && data.activeFocusUntil && data.activeFocusUntil > Date.now()) {
    const patterns = (data.lists && data.lists.deep_work) || DEFAULT_LISTS.deep_work;
    await setBlockRules(patterns, true, 'FOCUS_SESSION');
  }

  // Schedule cleanup alarm
  chrome.alarms.create(`bypass:${domain}`, { delayInMinutes: minutes });

  return { success: true, domain, expiresAt };
}

// Handle alarm events
chrome.alarms.onAlarm.addListener(async (alarm) => {
  if (alarm.name === 'focusSessionEnd') {
    await endFocusSession();
  } else if (alarm.name.startsWith('schedule_')) {
    await handleScheduleAlarm(alarm);
  } else if (alarm.name.startsWith('bypass:')) {
    const domain = alarm.name.split(':')[1];
    const bypasses = await getBypasses();
    const now = Date.now();
    if (bypasses[domain] && bypasses[domain] <= now) {
      delete bypasses[domain];
      await setBypasses(bypasses);
      // Re-apply rules to restore block
      const data = await chrome.storage.sync.get(['lists', 'activeFocusUntil', 'focusSessionActive']);
      if (data.focusSessionActive && data.activeFocusUntil && data.activeFocusUntil > Date.now()) {
        const patterns = (data.lists && data.lists.deep_work) || DEFAULT_LISTS.deep_work;
        await setBlockRules(patterns, true, 'FOCUS_SESSION');
      }
    }
  }
});

// Handle schedule alarms
async function handleScheduleAlarm(alarm) {
  const parts = alarm.name.split('_');
  const scheduleId = parts[1];
  const dayOfWeek = parts[2];
  const action = parts[3]; // 'start' or 'end'
  
  const data = await chrome.storage.sync.get(['schedules', 'lists']);
  const schedule = data.schedules.find(s => s.id === scheduleId);
  
  if (!schedule) return;
  
  const patterns = data.lists[schedule.list] || [];
  
  if (action === 'start') {
    await setBlockRules(patterns, true, 'SCHEDULE');
    console.log(`Schedule ${schedule.name} started for day ${dayOfWeek}`);
    
    // Show notification if enabled
    if (chrome.notifications) {
      chrome.notifications.create({
        type: 'basic',
        iconUrl: 'icons/optimized/icon48.png',
        title: 'Focus Schedule Started',
        message: `${schedule.name} is now active - distracting sites are blocked`
      });
    }
    
    // Schedule the next occurrence
    await scheduleNextOccurrence(schedule, dayOfWeek, action);
  } else if (action === 'end') {
    await setBlockRules(patterns, false, 'SCHEDULE');
    console.log(`Schedule ${schedule.name} ended for day ${dayOfWeek}`);
    
    // Show notification if enabled
    if (chrome.notifications) {
      chrome.notifications.create({
        type: 'basic',
        iconUrl: 'icons/optimized/icon48.png',
        title: 'Focus Schedule Ended',
        message: `${schedule.name} has ended - sites are accessible again`
      });
    }
    
    // Schedule the next occurrence
    await scheduleNextOccurrence(schedule, dayOfWeek, action);
  }
}

// Schedule the next occurrence of a schedule
async function scheduleNextOccurrence(schedule, dayOfWeek, action) {
  const [hour, minute] = action === 'start' ? 
    schedule.start.split(':').map(Number) : 
    schedule.end.split(':').map(Number);
  
  const nextOccurrence = getNextOccurrenceOfDay(parseInt(dayOfWeek), hour, minute);
  const now = new Date();
  const delay = Math.max(0, nextOccurrence.getTime() - now.getTime());
  
  if (delay > 0) {
    await chrome.alarms.create(`schedule_${schedule.id}_${dayOfWeek}_${action}`, {
      delayInMinutes: delay / 60000
    });
  }
}

// Message handling
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  console.log('Background: Received message:', message);
  
  switch (message.action) {
    case 'test':
      console.log('Background: Test message received, responding...');
      sendResponse({ success: true, message: 'Background script is working' });
      return true;
    case 'temporaryBypass':
      requestTemporaryBypass(message.target, message.minutes || 5)
        .then(sendResponse)
        .catch(error => sendResponse({ success: false, error: error.message }));
      return true;
    case 'startFocusSession':
      startFocusSession(message.duration, message.blocklist)
        .then(sendResponse)
        .catch(error => sendResponse({ success: false, error: error.message }));
      return true; // Keep message channel open for async response
      
    case 'testDNRRules':
      DNR.getDynamicRules().then(rules => {
        console.log('Current DNR rules:', rules);
        sendResponse({ rules: rules });
      }).catch(error => sendResponse({ error: error.message }));
      return true;
      
    case 'endFocusSession':
      endFocusSession()
        .then(sendResponse)
        .catch(error => sendResponse({ success: false, error: error.message }));
      return true;
      
    case 'getStatus':
      console.log('Background: getStatus request received');
      chrome.storage.sync.get(['activeFocusUntil', 'focusSessionActive', 'schedules', 'isDeepFocus'])
        .then(data => {
          console.log('Background: getStatus - raw storage data:', data);
          const isActive = data.focusSessionActive && data.activeFocusUntil && data.activeFocusUntil > Date.now();
          const response = {
            focusSessionActive: isActive,
            activeUntil: data.activeFocusUntil,
            schedules: data.schedules || [],
            isDeepFocus: !!data.isDeepFocus
          };
          console.log('Background: getStatus - calculated response:', response);
          console.log('Background: getStatus - isActive calculation:', {
            focusSessionActive: data.focusSessionActive,
            activeFocusUntil: data.activeFocusUntil,
            currentTime: Date.now(),
            timeLeft: data.activeFocusUntil ? data.activeFocusUntil - Date.now() : 0,
            isActive: isActive
          });
          sendResponse(response);
        });
      return true;
      
    case 'updateBlocklist':
      chrome.storage.sync.set({ lists: message.lists })
        .then(async () => {
          try {
            // If a Deep Focus session is currently active, immediately re-apply DNR rules
            const data = await chrome.storage.sync.get(['lists', 'activeFocusUntil', 'focusSessionActive', 'isDeepFocus']);
            const isActiveDeepFocus = !!data.isDeepFocus && data.focusSessionActive && data.activeFocusUntil && data.activeFocusUntil > Date.now();
            if (isActiveDeepFocus) {
              const patterns = (data.lists && data.lists.deep_work) || DEFAULT_LISTS.deep_work;
              await setBlockRules(patterns, true, 'FOCUS_SESSION');
              // Refresh tabs on affected domains so rules take effect immediately
              refreshBlockedTabs();
            }
          } catch (_) {}
          sendResponse({ success: true });
        })
        .catch(error => sendResponse({ success: false, error: error.message }));
      return true;
      
    case 'updateSchedules':
      chrome.storage.sync.set({ schedules: message.schedules })
        .then(() => {
          setupScheduleAlarms();
          sendResponse({ success: true });
        })
        .catch(error => sendResponse({ success: false, error: error.message }));
      return true;
      
    case 'testSchedules':
      chrome.alarms.getAll().then(alarms => {
        const scheduleAlarms = alarms.filter(alarm => alarm.name.startsWith('schedule_'));
        console.log('Current schedule alarms:', scheduleAlarms);
        sendResponse({ 
          success: true, 
          alarms: scheduleAlarms,
          totalAlarms: alarms.length 
        });
      }).catch(error => sendResponse({ success: false, error: error.message }));
      return true;
  }
});

// Initialize when extension loads
chrome.runtime.onStartup.addListener(initializeExtension);
chrome.runtime.onInstalled.addListener(initializeExtension);

// Handle extension startup
initializeExtension();

// Periodic cleanup of expired sessions
setInterval(async () => {
  try {
    const data = await chrome.storage.sync.get(['activeFocusUntil', 'focusSessionActive']);
    if (data.activeFocusUntil && data.activeFocusUntil <= Date.now() && data.focusSessionActive) {
      console.log('Periodic cleanup: Found expired session, cleaning up');
      await chrome.storage.sync.set({ 
        activeFocusUntil: 0,
        isDeepFocus: false,
        focusSessionActive: false
      });
      // Notify content scripts about session change
      broadcastSessionChange();
    }
  } catch (error) {
    console.error('Error in periodic cleanup:', error);
  }
}, 30000); // Check every 30 seconds
