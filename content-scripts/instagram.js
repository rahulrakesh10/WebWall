// Instagram content script for Focus Blocks
class InstagramBlocker {
    constructor() {
        this.rules = [
            // Home feed
            'main [role="feed"]',
            'main article',
            'main [data-testid="post-container"]',
            
            // Reels
            '[aria-label="Reels"]',
            'a[href="/reels/"]',
            'a[href^="/reels/"]',
            '[data-testid="reels-tab"]',
            'a[href*="reels"]',
            
            // Stories (optional - can be toggled)
            '[data-testid="stories-container"]',
            '[role="button"][aria-label*="story"]',
            
            // Explore feed
            'a[href="/explore/"]',
            '[data-testid="explore-tab"]',
            
            // Suggested posts
            '[data-testid="suggested-posts"]',
            '[aria-label*="Suggested"]',
            
            // Shopping
            '[data-testid="shopping-tab"]',
            'a[href="/shopping/"]',
            
            // Live
            '[data-testid="live-tab"]',
            'a[href="/live/"]'
        ];
        
        this.blockedElements = new Set();
        this.observer = null;
        this.config = {
            blockHomeFeed: true,
            blockReels: true,
            blockStories: false,
            blockExplore: true,
            blockShopping: true,
            blockLive: true,
            redirectHomeToDMs: false
        };
        
        this.init();
    }

    async init() {
        // Load configuration
        await this.loadConfig();
        
        // Check if there's an active focus session before applying rules
        await this.checkFocusSession();
        
        // Set up mutation observer for dynamic content
        this.setupObserver();
        
        // Handle URL changes (SPA navigation)
        this.handleUrlChanges();
        
        // Optional: Redirect homepage to DMs
        if (this.config.redirectHomeToDMs && this.isHomePage()) {
            this.redirectToDMs();
        }
        
        console.log('Instagram Focus Blocker initialized');
    }

    async loadConfig() {
        try {
            const data = await chrome.storage.sync.get(['instagramConfig']);
            if (data.instagramConfig) {
                this.config = { ...this.config, ...data.instagramConfig };
            }
        } catch (error) {
            console.error('Error loading Instagram config:', error);
        }
    }

    async checkFocusSession() {
        try {
            const response = await chrome.runtime.sendMessage({ action: 'getStatus' });
            const hasActiveSession = response.focusSessionActive && response.activeUntil && response.activeUntil > Date.now();
            
            if (hasActiveSession) {
                this.applyRules();
            } else {
                // Clear any existing blocks if no session is active
                this.clearBlocks();
            }
        } catch (error) {
            console.error('Error checking focus session:', error);
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
    }

    shouldBlockSelector(selector) {
        // Check if selector should be blocked based on current page and config
        if (selector.includes('feed') || selector.includes('article') || selector.includes('post-container')) {
            return this.config.blockHomeFeed && this.isHomePage();
        }
        
        if (selector.includes('reels')) {
            return this.config.blockReels;
        }
        
        if (selector.includes('stories')) {
            return this.config.blockStories;
        }
        
        if (selector.includes('explore')) {
            return this.config.blockExplore;
        }
        
        if (selector.includes('shopping')) {
            return this.config.blockShopping;
        }
        
        if (selector.includes('live')) {
            return this.config.blockLive;
        }
        
        return true; // Block by default
    }

    blockElements(selector) {
        const elements = document.querySelectorAll(selector);
        elements.forEach(element => {
            if (element && !element.hasAttribute('data-focus-blocked')) {
                element.style.setProperty('display', 'none', 'important');
                element.setAttribute('data-focus-blocked', '1');
                this.blockedElements.add(element);
                
                // Add a subtle indicator
                this.addBlockIndicator(element);
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

        // Start observing
        this.observer.observe(document.body, {
            childList: true,
            subtree: true
        });
    }

    handleUrlChanges() {
        // Listen for URL changes in Instagram's SPA
        let currentUrl = window.location.href;
        
        const checkUrlChange = () => {
            if (window.location.href !== currentUrl) {
                currentUrl = window.location.href;
                setTimeout(async () => {
                    await this.checkFocusSession();
                    
                    // Handle redirects based on new URL
                    if (this.config.redirectHomeToDMs && this.isHomePage()) {
                        this.redirectToDMs();
                    }
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
        return path === '/' || path === '/home' || path === '/feed';
    }

    redirectToDMs() {
        // Only redirect if we're on the homepage and redirect is enabled
        if (this.isHomePage() && this.config.redirectHomeToDMs) {
            const dmLink = document.querySelector('a[href="/direct/inbox/"]');
            if (dmLink) {
                dmLink.click();
            } else {
                // Fallback: navigate directly
                window.location.href = '/direct/inbox/';
            }
        }
    }

    // Public method to update configuration
    async updateConfig(newConfig) {
        this.config = { ...this.config, ...newConfig };
        await chrome.storage.sync.set({ instagramConfig: this.config });
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

// Initialize the blocker when the page loads
let instagramBlocker;

function initializeBlocker() {
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', () => {
            instagramBlocker = new InstagramBlocker();
        });
    } else {
        instagramBlocker = new InstagramBlocker();
    }
}

// Handle messages from the extension
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
    if (message.target === 'instagram' && instagramBlocker) {
        switch (message.action) {
            case 'updateConfig':
                instagramBlocker.updateConfig(message.config)
                    .then(() => sendResponse({ success: true }))
                    .catch(error => sendResponse({ success: false, error: error.message }));
                return true;
                
            case 'getConfig':
                sendResponse({ config: instagramBlocker.getConfig() });
                return true;
                
            case 'disable':
                instagramBlocker.disable();
                sendResponse({ success: true });
                return true;
                
            case 'enable':
                instagramBlocker.enable();
                sendResponse({ success: true });
                return true;
        }
    }
    
    // Listen for focus session changes
    if (message.action === 'focusSessionChanged' && instagramBlocker) {
        instagramBlocker.checkFocusSession();
    }
});

// Initialize immediately
initializeBlocker();

// Also initialize when the page is fully loaded (for dynamic content)
window.addEventListener('load', () => {
    if (!instagramBlocker) {
        instagramBlocker = new InstagramBlocker();
    }
});
