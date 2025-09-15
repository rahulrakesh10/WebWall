// Blocked page functionality for Focus Blocks
let holdTimer = null;
let holdProgress = 0;
let bypassHoldDuration = 10000; // 10 seconds
let originalUrl = '';

// Get URL parameters
const urlParams = new URLSearchParams(window.location.search);
const fromPattern = urlParams.get('from') || '';

console.log('Current URL:', window.location.href);
console.log('URL parameters:', window.location.search);
console.log('From pattern:', fromPattern);
console.log('Document referrer:', document.referrer);

// Try to construct the original URL from the pattern
if (fromPattern && fromPattern !== '') {
    // Convert the pattern back to a real URL
    // Pattern format: "*://*.instagram.com/*" -> "https://www.instagram.com"
    let constructedUrl = fromPattern;
    
    console.log('Constructing URL from pattern:', constructedUrl);
    
    // Replace wildcards with actual values
    if (constructedUrl.includes('*://*.instagram.com/*')) {
        constructedUrl = 'https://www.instagram.com';
    } else if (constructedUrl.includes('*://*.youtube.com/*')) {
        constructedUrl = 'https://www.youtube.com';
    } else if (constructedUrl.includes('*://*.reddit.com/*')) {
        constructedUrl = 'https://www.reddit.com';
    } else if (constructedUrl.includes('*://*.twitter.com/*')) {
        constructedUrl = 'https://www.twitter.com';
    } else if (constructedUrl.includes('*://*.x.com/*')) {
        constructedUrl = 'https://www.x.com';
    } else if (constructedUrl.includes('*://*.facebook.com/*')) {
        constructedUrl = 'https://www.facebook.com';
    } else if (constructedUrl.includes('*://*.tiktok.com/*')) {
        constructedUrl = 'https://www.tiktok.com';
    } else {
        // For other patterns, try to extract the domain
        const domainMatch = constructedUrl.match(/\*:\/\/\*\.([^\/]+)\/\*/);
        if (domainMatch) {
            constructedUrl = `https://www.${domainMatch[1]}`;
        }
    }
    
    console.log('Constructed URL:', constructedUrl);
    originalUrl = constructedUrl;
} else {
    // Fallback to referrer
    console.log('No pattern found, using referrer');
    originalUrl = document.referrer;
}

// If still no valid URL, use a default
if (!originalUrl || originalUrl === '' || originalUrl === 'null' || originalUrl === 'undefined') {
    console.log('No valid URL found, using Google as fallback');
    // Try harder: inspect current URL's query param target
    try {
        const qp = new URLSearchParams(window.location.search);
        const from = qp.get('from');
        if (from) {
            const domainMatch = from.match(/\*:\/\/\*\.([^\/]+)\/*/);
            if (domainMatch) {
                originalUrl = `https://www.${domainMatch[1]}`;
            }
        }
    } catch {}
    if (!originalUrl) originalUrl = 'https://www.google.com';
}

console.log('Final original URL:', originalUrl);

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
                
                // Check if it's a Deep Focus session (90+ minutes)
                const isDeepFocus = (response.activeUntil - now) >= (90 * 60 * 1000);
                const sessionType = isDeepFocus ? 'Deep Focus' : 'Quick Focus';
                
                document.getElementById('session-info').textContent = 
                    `${sessionType} session ends at ${endTime.toLocaleTimeString()}`;
                
                // Update the header text based on session type
                const focusInfo = document.querySelector('.focus-info h3');
                if (focusInfo) {
                    focusInfo.textContent = `${sessionType} Session Active`;
                }
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

// Bypass button functionality - hold to bypass
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
    
    // Use the standard 10-second hold duration
    bypassHoldDuration = 10000;
    
    holdTimer = setInterval(() => {
        holdProgress += 100; // Update every 100ms for smooth progress
        const percentage = (holdProgress / bypassHoldDuration) * 100;
        progressBar.style.width = `${Math.min(percentage, 100)}%`;
        
        if (holdProgress >= bypassHoldDuration) {
            bypassSite();
        }
    }, 100);
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
    console.log('=== BYPASS FUNCTION CALLED ===');
    console.log('Original URL from pattern:', originalUrl);
    console.log('From pattern:', fromPattern);
    
    // Determine redirect URL - prioritize the original URL we detected
    let redirectUrl = originalUrl;
    
    // If we don't have a good original URL, try to construct it from the pattern
    if (!redirectUrl || redirectUrl === 'undefined' || redirectUrl === 'null' || redirectUrl === '') {
        console.log('No valid original URL, constructing from pattern...');
        
        if (fromPattern) {
            // Convert pattern back to URL
            if (fromPattern.includes('instagram.com')) {
                redirectUrl = 'https://www.instagram.com';
            } else if (fromPattern.includes('youtube.com')) {
                redirectUrl = 'https://www.youtube.com';
            } else if (fromPattern.includes('reddit.com')) {
                redirectUrl = 'https://www.reddit.com';
            } else if (fromPattern.includes('twitter.com') || fromPattern.includes('x.com')) {
                redirectUrl = 'https://www.twitter.com';
            } else if (fromPattern.includes('facebook.com')) {
                redirectUrl = 'https://www.facebook.com';
            } else if (fromPattern.includes('tiktok.com')) {
                redirectUrl = 'https://www.tiktok.com';
            }
        }
        
        // Final fallback
        if (!redirectUrl) {
            redirectUrl = 'https://www.instagram.com'; // Default to Instagram
        }
    }
    
    console.log('Final redirect URL:', redirectUrl);

    // Request a temporary bypass for this domain without ending the session
    const targetForBypass = fromPattern || redirectUrl;
    chrome.runtime.sendMessage({ action: 'temporaryBypass', target: targetForBypass, minutes: 5 }, (response) => {
        console.log('Temporary bypass response:', response);

        // Log the bypass
        chrome.storage.local.get(['bypassLog'], (data) => {
            const bypassLog = data.bypassLog || [];
            bypassLog.push({
                timestamp: Date.now(),
                url: redirectUrl,
                reason: 'Manual bypass - temporary (5m)'
            });
            chrome.storage.local.set({ bypassLog: bypassLog.slice(-100) });
        });

        // Redirect back to the original site immediately
        console.log('Redirecting to:', redirectUrl);
        window.location.replace(redirectUrl);
    });
}

// Initialize the page when DOM is loaded
document.addEventListener('DOMContentLoaded', () => {
    setupBypassButton();
    initializePage();
});
