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
    // Deep Focus: Block entire sites using DNR with redirect to blocked page
    console.log('Setting up Deep Focus DNR rules');
    await setBlockRules(patterns, true, 'FOCUS_SESSION');
    
    // Notify all tabs to refresh for Deep Focus
    const tabs = await chrome.tabs.query({});
    tabs.forEach(tab => {
      chrome.tabs.sendMessage(tab.id, { 
        action: 'deepFocusActivated',
        message: 'Deep Focus activated! Refreshing page to apply site blocking...'
      }).catch(() => {
        // Ignore errors for tabs without content scripts
      });
    });
  } else {
    // Quick Focus: Only content scripts will block elements (no DNR rules)
    console.log('Quick Focus - no DNR rules, only content script blocking');
    // Clear any existing DNR rules to ensure no blocking
    await setBlockRules(patterns, false, 'FOCUS_SESSION');
  }
  
  await Promise.all([
    chrome.storage.sync.set({ 
      activeFocusUntil: endTime,
      isDeepFocus: isDeepFocus,
      focusSessionActive: true
    }),
    chrome.alarms.create('focusSessionEnd', { delayInMinutes: durationMinutes })
  ]);
  
  // Wait a moment for storage to sync, then notify content scripts
  setTimeout(() => {
    broadcastSessionChange();
  }, 100);
  
  if (chrome.notifications) {
    chrome.notifications.create({
      type: 'basic',
      iconUrl: 'icons/icon48.png',
      title: 'Focus Session Started',
      message: `${isDeepFocus ? 'Deep Focus' : 'Quick Focus'} session started for ${durationMinutes} minutes`
    });
  }
  
  return { success: true, endTime };
}

// End focus session
async function endFocusSession() {
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
  
  // Wait a moment for storage to sync, then notify content scripts
  setTimeout(() => {
    broadcastSessionChange();
  }, 100);
  
  if (chrome.notifications) {
    chrome.notifications.create({
      type: 'basic',
      iconUrl: 'icons/icon48.png',
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
  
  // Clear existing schedule alarms
  const alarms = await chrome.alarms.getAll();
  const scheduleAlarms = alarms.filter(alarm => alarm.name.startsWith('schedule_'));
  await Promise.all(scheduleAlarms.map(alarm => chrome.alarms.clear(alarm.name)));
  
  // Create new alarms for each schedule
  for (const schedule of schedules) {
    if (schedule.enabled) {
      await createScheduleAlarms(schedule);
    }
  }
}

// Create alarms for a specific schedule
async function createScheduleAlarms(schedule) {
  const now = new Date();
  const today = now.getDay(); // 0 = Sunday, 1 = Monday, etc.
  
  if (schedule.days.includes(today)) {
    const [startHour, startMinute] = schedule.start.split(':').map(Number);
    const [endHour, endMinute] = schedule.end.split(':').map(Number);
    
    const startTime = new Date();
    startTime.setHours(startHour, startMinute, 0, 0);
    
    const endTime = new Date();
    endTime.setHours(endHour, endMinute, 0, 0);
    
    // If start time has passed today, schedule for tomorrow
    if (startTime <= now) {
      startTime.setDate(startTime.getDate() + 1);
    }
    
    // If end time has passed today, schedule for tomorrow
    if (endTime <= now) {
      endTime.setDate(endTime.getDate() + 1);
    }
    
    const startDelay = Math.max(0, startTime.getTime() - now.getTime());
    const endDelay = Math.max(0, endTime.getTime() - now.getTime());
    
    await chrome.alarms.create(`schedule_${schedule.id}_start`, {
      delayInMinutes: startDelay / 60000
    });
    
    await chrome.alarms.create(`schedule_${schedule.id}_end`, {
      delayInMinutes: endDelay / 60000
    });
  }
}

// Broadcast session changes to content scripts
function broadcastSessionChange() {
  chrome.tabs.query({}, (tabs) => {
    console.log(`Broadcasting session change to ${tabs.length} tabs`);
    tabs.forEach(tab => {
      // Send message with retry mechanism
      const sendMessageWithRetry = (retryCount = 0) => {
        chrome.tabs.sendMessage(tab.id, { action: 'focusSessionChanged' }).catch((error) => {
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
    });
  });
}

// Handle alarm events
chrome.alarms.onAlarm.addListener(async (alarm) => {
  if (alarm.name === 'focusSessionEnd') {
    await endFocusSession();
  } else if (alarm.name.startsWith('schedule_')) {
    await handleScheduleAlarm(alarm);
  }
});

// Handle schedule alarms
async function handleScheduleAlarm(alarm) {
  const parts = alarm.name.split('_');
  const scheduleId = parts[1];
  const action = parts[2]; // 'start' or 'end'
  
  const data = await chrome.storage.sync.get(['schedules', 'lists']);
  const schedule = data.schedules.find(s => s.id === scheduleId);
  
  if (!schedule) return;
  
  const patterns = data.lists[schedule.list] || [];
  
  if (action === 'start') {
    await setBlockRules(patterns, true, 'SCHEDULE');
    console.log(`Schedule ${schedule.name} started`);
  } else if (action === 'end') {
    await setBlockRules(patterns, false, 'SCHEDULE');
    console.log(`Schedule ${schedule.name} ended`);
  }
}

// Message handling
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  switch (message.action) {
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
      chrome.storage.sync.get(['activeFocusUntil', 'focusSessionActive', 'schedules'])
        .then(data => {
          const isActive = data.focusSessionActive && data.activeFocusUntil && data.activeFocusUntil > Date.now();
          sendResponse({
            focusSessionActive: isActive,
            activeUntil: data.activeFocusUntil,
            schedules: data.schedules || []
          });
        });
      return true;
      
    case 'updateBlocklist':
      chrome.storage.sync.set({ lists: message.lists })
        .then(() => sendResponse({ success: true }))
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
