// Twitter/X content script for Focus Blocks
class TwitterBlocker {
    constructor() {
        this.rules = [
            // Twitter/X posts and feeds
            'article[data-testid="tweet"]',
            '[data-testid="tweet"]',
            '[data-testid="tweetText"]',
            '[data-testid="tweet-content"]',
            '[data-testid="tweet-body"]',
            '[data-testid="tweet-container"]',
            
            // Twitter post elements
            'div[data-testid="tweet"]',
            'div[data-testid="tweetText"]',
            'div[data-testid="tweet-content"]',
            'div[data-testid="tweet-body"]',
            'div[data-testid="tweet-container"]',
            
            // Generic Twitter post selectors
            'article',
            'div[role="article"]',
            'div[data-testid*="tweet"]',
            
            // Twitter navigation elements
            'a[href="/explore"]',
            'a[href="/trending"]',
            'a[href="/notifications"]',
            'a[href="/messages"]',
            'a[href="/i/bookmarks"]',
            'a[href="/i/lists"]',
            'a[href="/i/communities"]',
            'a[href="/i/premium"]'
        ];
        
        this.blockedElements = new Set();
        this.observer = null;
        this.config = {
            blockHomeFeed: true,
            blockExplore: true,
            blockTrending: true,
            blockNotifications: true,
            blockMessages: true,
            blockBookmarks: true,
            blockLists: true,
            blockCommunities: true
        };
        
        this.init();
    }

    async init() {
        // Load configuration
        await this.loadConfig();
        
        // Inject blocking CSS immediately to prevent flash
        this.injectBlockingCSS();
        
        // Check if there's an active focus session before applying rules
        await this.checkFocusSession();
        
        // Set up mutation observer for dynamic content
        this.setupObserver();
        
        // Handle URL changes (SPA navigation)
        this.handleUrlChanges();
        
        console.log('Twitter Focus Blocker initialized');
    }

    async loadConfig() {
        try {
            const data = await chrome.storage.sync.get(['twitterConfig']);
            if (data.twitterConfig) {
                this.config = { ...this.config, ...data.twitterConfig };
            }
        } catch (error) {
            console.error('Error loading Twitter config:', error);
        }
    }

    async checkFocusSession() {
        try {
            // Check if extension context is still valid
            if (!chrome.runtime?.id) {
                console.log('Extension context invalid, clearing blocks');
                this.clearBlocks();
                return;
            }

            const response = await chrome.runtime.sendMessage({ action: 'getStatus' });
            const hasActiveSession = response.focusSessionActive && response.activeUntil && response.activeUntil > Date.now();
            
            if (hasActiveSession) {
                // Check if it's a Deep Focus session (90+ minutes)
                const sessionDuration = response.activeUntil - Date.now();
                const isDeepFocus = sessionDuration >= (90 * 60 * 1000);
                
                if (isDeepFocus) {
                    console.log('Deep Focus session active - entire site should be blocked by DNR');
                    // Don't apply content script rules for Deep Focus
                    this.clearBlocks();
                } else {
                    console.log('Quick Focus session active - applying Twitter element blocks');
                    this.applyRules();
                }
            } else {
                // Clear any existing blocks if no session is active
                console.log('No focus session - clearing Twitter blocks');
                this.clearBlocks();
                // Also remove the blocking CSS
                this.removeBlockingCSS();
            }
        } catch (error) {
            console.error('Error checking focus session:', error);
            // If we can't check, don't block anything
            this.clearBlocks();
            this.removeBlockingCSS();
        }
    }

    applyRules() {
        // Clear previously blocked elements
        this.clearBlocks();

        // Apply rules based on current page and config
        this.rules.forEach(selector => {
            if (this.shouldBlockSelector(selector)) {
                this.blockElements(selector);
            }
        });
        
        // Also inject CSS to ensure blocking
        this.injectBlockingCSS();
    }
    
    injectBlockingCSS() {
        // Remove existing style if any
        const existingStyle = document.getElementById('webwall-blocking-css');
        if (existingStyle) {
            existingStyle.remove();
        }
        
        // Only apply blocking CSS on the homepage
        if (!this.isHomePage()) {
            console.log('Not on homepage, skipping blocking CSS');
            return;
        }
        
        // Create and inject CSS
        const style = document.createElement('style');
        style.id = 'webwall-blocking-css';
        style.textContent = `
            /* Completely hide Twitter posts and content */
            article[data-testid="tweet"] {
                display: none !important;
            }
            
            /* Also hide any tweet containers */
            div[data-testid="tweet"] {
                display: none !important;
            }
            
            /* Hide the main timeline content area */
            div[aria-label="Timeline: Your Home Timeline"] {
                display: none !important;
            }
            
            /* Hide the "For you" and "Following" tabs content */
            div[role="tabpanel"] {
                display: none !important;
            }
            
            /* Hide specific distracting navigation elements */
            a[href="/explore"] { display: none !important; }
            a[href="/trending"] { display: none !important; }
            a[href="/notifications"] { display: none !important; }
            a[href="/messages"] { display: none !important; }
            a[href="/i/bookmarks"] { display: none !important; }
            a[href="/i/lists"] { display: none !important; }
            a[href="/i/communities"] { display: none !important; }
            a[href="/i/premium"] { display: none !important; }
        `;
        
        // Inject immediately to prevent flash
        if (document.head) {
            document.head.appendChild(style);
        } else {
            // If head doesn't exist yet, wait for it
            document.addEventListener('DOMContentLoaded', () => {
                document.head.appendChild(style);
            });
        }
        
        console.log('Injected black overlay CSS for Twitter elements');
        
        // Debug: log what elements we're targeting
        setTimeout(() => {
            const tweets = document.querySelectorAll('article[data-testid="tweet"]');
            console.log('Twitter: Found', tweets.length, 'tweet elements');
            tweets.forEach((tweet, index) => {
                if (index < 3) { // Only log first 3 for debugging
                    console.log('Twitter tweet element:', tweet, tweet.getAttribute('data-testid'));
                }
            });
        }, 1000);
    }
    
    removeBlockingCSS() {
        const existingStyle = document.getElementById('webwall-blocking-css');
        if (existingStyle) {
            existingStyle.remove();
            console.log('Removed blocking CSS');
        }
    }

    clearBlocks() {
        this.blockedElements.forEach(element => {
            if (element && element.parentNode) {
                element.style.removeProperty('display');
                element.removeAttribute('data-focus-blocked');
                // Remove the indicator
                const indicator = element.querySelector('[data-focus-indicator]');
                if (indicator) {
                    indicator.remove();
                }
            }
        });
        this.blockedElements.clear();
        
        // Remove injected CSS
        this.removeBlockingCSS();
    }

    shouldBlockSelector(selector) {
        // For Quick Focus, block all distracting elements
        if (selector.includes('tweet') || selector.includes('article')) {
            return this.config.blockHomeFeed;
        }
        
        if (selector.includes('explore') || selector.includes('trending')) {
            return this.config.blockExplore;
        }
        
        if (selector.includes('notifications')) {
            return this.config.blockNotifications;
        }
        
        if (selector.includes('messages')) {
            return this.config.blockMessages;
        }
        
        if (selector.includes('bookmarks') || selector.includes('lists') || selector.includes('communities')) {
            return this.config.blockBookmarks;
        }
        
        return true; // Block by default
    }

    blockElements(selector) {
        const elements = document.querySelectorAll(selector);
        elements.forEach(element => {
            if (element && !element.hasAttribute('data-focus-blocked')) {
                // Block all matching elements for Quick Focus
                element.style.setProperty('display', 'none', 'important');
                element.setAttribute('data-focus-blocked', '1');
                this.blockedElements.add(element);
                
                // Add a subtle indicator
                this.addBlockIndicator(element);
                
                console.log('Blocked element:', selector, element);
            }
        });
    }

    addBlockIndicator(element) {
        // Create a small indicator that this element was blocked
        const indicator = document.createElement('div');
        indicator.style.cssText = `
            position: absolute;
            top: 0;
            left: 0;
            right: 0;
            height: 2px;
            background: linear-gradient(90deg, #667eea, #764ba2);
            z-index: 9999;
            pointer-events: none;
        `;
        indicator.setAttribute('data-focus-indicator', '1');
        
        if (element.style.position !== 'absolute' && element.style.position !== 'relative') {
            element.style.position = 'relative';
        }
        element.appendChild(indicator);
    }

    setupObserver() {
        // Disconnect existing observer
        if (this.observer) {
            this.observer.disconnect();
        }

        // Create new mutation observer
        this.observer = new MutationObserver((mutations) => {
            let shouldReapply = false;
            
            mutations.forEach(mutation => {
                if (mutation.type === 'childList' && mutation.addedNodes.length > 0) {
                    // Check if new content was added that might need blocking
                    mutation.addedNodes.forEach(node => {
                        if (node.nodeType === Node.ELEMENT_NODE) {
                            // Check if the new node or its children match our selectors
                            this.rules.forEach(selector => {
                                if (this.shouldBlockSelector(selector)) {
                                    if (node.matches && node.matches(selector)) {
                                        shouldReapply = true;
                                    } else if (node.querySelectorAll) {
                                        const matches = node.querySelectorAll(selector);
                                        if (matches.length > 0) {
                                            shouldReapply = true;
                                        }
                                    }
                                }
                            });
                        }
                    });
                }
            });
            
            if (shouldReapply) {
                // Debounce the reapplication
                clearTimeout(this.reapplyTimeout);
                this.reapplyTimeout = setTimeout(async () => {
                    // Check if there's an active session before applying rules
                    await this.checkFocusSession();
                }, 100);
            }
        });

        // Start observing (wait for body if needed)
        const startObserving = () => {
            const targetNode = document.body || document.documentElement;
            if (!targetNode) {
                return false;
            }
            try {
                this.observer.observe(targetNode, {
                    childList: true,
                    subtree: true
                });
                return true;
            } catch (err) {
                console.error('Failed to start MutationObserver:', err);
                return false;
            }
        };

        if (!startObserving()) {
            // If body isn't ready yet (document_start), wait for DOMContentLoaded
            const onReady = () => {
                if (startObserving()) {
                    document.removeEventListener('DOMContentLoaded', onReady);
                }
            };
            document.addEventListener('DOMContentLoaded', onReady);
        }
    }

    handleUrlChanges() {
        // Listen for URL changes in Twitter's SPA
        let currentUrl = window.location.href;
        
        const checkUrlChange = () => {
            if (window.location.href !== currentUrl) {
                currentUrl = window.location.href;
                setTimeout(async () => {
                    await this.checkFocusSession();
                }, 500); // Small delay to let content load
            }
        };
        
        // Check for URL changes periodically
        setInterval(checkUrlChange, 1000);
        
        // Also listen for popstate events
        window.addEventListener('popstate', () => {
            setTimeout(async () => {
                await this.checkFocusSession();
            }, 500);
        });
    }

    isHomePage() {
        const path = window.location.pathname;
        return path === '/' || path === '/home' || path === '/feed' || path === '/home' || path === '/i/flow';
    }

    // Public method to update configuration
    async updateConfig(newConfig) {
        this.config = { ...this.config, ...newConfig };
        await chrome.storage.sync.set({ twitterConfig: this.config });
        this.applyRules();
    }

    // Public method to get current configuration
    getConfig() {
        return { ...this.config };
    }

    // Public method to temporarily disable blocking
    disable() {
        this.blockedElements.forEach(element => {
            if (element && element.parentNode) {
                element.style.removeProperty('display');
                element.removeAttribute('data-focus-blocked');
            }
        });
        this.blockedElements.clear();
    }

    // Public method to re-enable blocking
    enable() {
        this.applyRules();
    }
}

// Initialize the blocker immediately to prevent flash
let twitterBlocker;

function initializeBlocker() {
    // Run immediately to prevent flash
    twitterBlocker = new TwitterBlocker();
    
    // Also run when DOM is ready for any missed elements
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', () => {
            if (twitterBlocker) {
                twitterBlocker.checkFocusSession();
            }
        });
    }
}

// Handle messages from the extension
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
    try {
        // Check if extension context is still valid
        if (!chrome.runtime?.id) {
            console.log('Extension context invalid, ignoring message');
            return;
        }

        if (message.target === 'twitter' && twitterBlocker) {
            switch (message.action) {
                case 'updateConfig':
                    twitterBlocker.updateConfig(message.config)
                        .then(() => sendResponse({ success: true }))
                        .catch(error => sendResponse({ success: false, error: error.message }));
                    return true;
                    
                case 'getConfig':
                    sendResponse({ config: twitterBlocker.getConfig() });
                    return true;
                    
                case 'disable':
                    twitterBlocker.disable();
                    sendResponse({ success: true });
                    return true;
                    
                case 'enable':
                    twitterBlocker.enable();
                    sendResponse({ success: true });
                    return true;
            }
        }
        
        // Listen for focus session changes
        if (message.action === 'focusSessionChanged' && twitterBlocker) {
            twitterBlocker.checkFocusSession();
        }
        
        // Handle Deep Focus activation
        if (message.action === 'deepFocusActivated') {
            showDeepFocusPrompt(message.message);
        }
    } catch (error) {
        console.error('Error handling message:', error);
        // Don't block anything if there's an error
        if (twitterBlocker) {
            twitterBlocker.clearBlocks();
            twitterBlocker.removeBlockingCSS();
        }
    }
});

// Initialize immediately
initializeBlocker();

// Also initialize when the page is fully loaded (for dynamic content)
window.addEventListener('load', () => {
    if (!twitterBlocker) {
        twitterBlocker = new TwitterBlocker();
    }
});

// Show Deep Focus prompt and auto-refresh
function showDeepFocusPrompt(message) {
    // Create overlay
    const overlay = document.createElement('div');
    overlay.style.cssText = `
        position: fixed;
        top: 0;
        left: 0;
        right: 0;
        bottom: 0;
        background: rgba(0, 0, 0, 0.8);
        z-index: 10000;
        display: flex;
        align-items: center;
        justify-content: center;
        font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
    `;
    
    // Create prompt box
    const promptBox = document.createElement('div');
    promptBox.style.cssText = `
        background: white;
        padding: 2rem;
        border-radius: 12px;
        text-align: center;
        max-width: 400px;
        box-shadow: 0 10px 25px rgba(0, 0, 0, 0.3);
    `;
    
    promptBox.innerHTML = `
        <div style="font-size: 3rem; margin-bottom: 1rem;">🧱</div>
        <h2 style="color: #2d3748; margin-bottom: 1rem;">Deep Focus Activated</h2>
        <p style="color: #718096; margin-bottom: 1.5rem;">${message}</p>
        <div style="display: flex; gap: 1rem; justify-content: center;">
            <button id="refreshNow" style="
                background: #667eea;
                color: white;
                border: none;
                padding: 0.75rem 1.5rem;
                border-radius: 8px;
                cursor: pointer;
                font-weight: 500;
            ">Refresh Now</button>
            <button id="refreshLater" style="
                background: #e2e8f0;
                color: #4a5568;
                border: none;
                padding: 0.75rem 1.5rem;
                border-radius: 8px;
                cursor: pointer;
                font-weight: 500;
            ">Refresh Later</button>
        </div>
    `;
    
    overlay.appendChild(promptBox);
    document.body.appendChild(overlay);
    
    // Add event listeners
    document.getElementById('refreshNow').addEventListener('click', () => {
        window.location.reload();
    });
    
    document.getElementById('refreshLater').addEventListener('click', () => {
        overlay.remove();
    });
    
    // Auto-refresh after 3 seconds
    setTimeout(() => {
        if (document.body.contains(overlay)) {
            window.location.reload();
        }
    }, 3000);
}