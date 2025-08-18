// Blocked page functionality for Focus Blocks
let holdTimer = null;
let holdProgress = 0;
let bypassHoldDuration = 3000; // 3 seconds
let originalUrl = '';

// Get URL parameters
const urlParams = new URLSearchParams(window.location.search);
originalUrl = urlParams.get('url') || '';

// Initialize the page
async function initializePage() {
    await updateTimer();
    await loadStats();
    
    // Update timer every second
    setInterval(updateTimer, 1000);
}

// Update the countdown timer
async function updateTimer() {
    try {
        const response = await chrome.runtime.sendMessage({ action: 'getStatus' });
        
        if (response.focusSessionActive && response.activeUntil) {
            const now = Date.now();
            const timeLeft = response.activeUntil - now;
            
            if (timeLeft > 0) {
                const minutes = Math.floor(timeLeft / 60000);
                const seconds = Math.floor((timeLeft % 60000) / 1000);
                document.getElementById('timer').textContent = 
                    `${minutes}:${seconds.toString().padStart(2, '0')}`;
                
                const endTime = new Date(response.activeUntil);
                document.getElementById('session-info').textContent = 
                    `Session ends at ${endTime.toLocaleTimeString()}`;
            } else {
                // Session has ended
                document.getElementById('timer').textContent = 'Session Ended';
                document.getElementById('session-info').textContent = 
                    'Your focus session has completed. Great job!';
            }
        } else {
            document.getElementById('timer').textContent = 'No Active Session';
            document.getElementById('session-info').textContent = 
                'No focus session is currently active.';
        }
    } catch (error) {
        console.error('Error getting status:', error);
    }
}

// Load and display stats
async function loadStats() {
    try {
        const data = await chrome.storage.local.get(['stats']);
        const stats = data.stats || { totalMinutesSaved: 0, todayMinutesSaved: 0 };
        
        if (stats.todayMinutesSaved > 0) {
            document.getElementById('timeSaved').textContent = stats.todayMinutesSaved;
            document.getElementById('stats').style.display = 'block';
        }
    } catch (error) {
        console.error('Error loading stats:', error);
    }
}

// Bypass button functionality
function setupBypassButton() {
    const bypassButton = document.getElementById('bypassButton');
    const progressBar = document.getElementById('progressBar');

    bypassButton.addEventListener('mousedown', startHold);
    bypassButton.addEventListener('mouseup', endHold);
    bypassButton.addEventListener('mouseleave', endHold);
    bypassButton.addEventListener('touchstart', startHold);
    bypassButton.addEventListener('touchend', endHold);
}

function startHold() {
    const bypassButton = document.getElementById('bypassButton');
    const progressBar = document.getElementById('progressBar');
    
    bypassButton.classList.add('holding');
    holdProgress = 0;
    progressBar.style.width = '0%';
    
    holdTimer = setInterval(() => {
        holdProgress += 50; // Update every 50ms for smooth progress
        const percentage = (holdProgress / bypassHoldDuration) * 100;
        progressBar.style.width = `${Math.min(percentage, 100)}%`;
        
        if (holdProgress >= bypassHoldDuration) {
            bypassSite();
        }
    }, 50);
}

function endHold() {
    if (holdTimer) {
        clearInterval(holdTimer);
        holdTimer = null;
    }
    const bypassButton = document.getElementById('bypassButton');
    const progressBar = document.getElementById('progressBar');
    
    bypassButton.classList.remove('holding');
    progressBar.style.width = '0%';
    holdProgress = 0;
}

function bypassSite() {
    // Log the bypass
    chrome.storage.local.get(['bypassLog'], (data) => {
        const bypassLog = data.bypassLog || [];
        bypassLog.push({
            timestamp: Date.now(),
            url: originalUrl,
            reason: 'Manual bypass'
        });
        chrome.storage.local.set({ bypassLog: bypassLog.slice(-100) }); // Keep last 100
    });

    // Navigate to the original URL
    if (originalUrl) {
        window.location.href = originalUrl;
    } else {
        window.history.back();
    }
}

// Initialize the page when DOM is loaded
document.addEventListener('DOMContentLoaded', () => {
    setupBypassButton();
    initializePage();
});
