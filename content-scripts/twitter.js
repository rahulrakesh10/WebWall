// Twitter/X content script for Focus Blocks
class TwitterBlocker {
    constructor() {
        this.rules = [
            // Home timeline
            '[data-testid="primaryColumn"]',
            '[data-testid="cellInnerDiv"]',
            '[data-testid="tweet"]',
            '[data-testid="tweetText"]',
            
            // Trending topics
            '[data-testid="trend"]',
            '[data-testid="trending"]',
            '[data-testid="sidebarColumn"]',
            
            // Who to follow
            '[data-testid="sidebarColumn"] [data-testid="UserCell"]',
            '[data-testid="whoToFollow"]',
            
            // Explore tab
            'a[href="/explore"]',
            '[data-testid="explore"]',
            
            // Notifications (optional)
            '[data-testid="notification"]',
            '[data-testid="notifications"]',
            
            // Search suggestions
            '[data-testid="searchBox"]',
            '[data-testid="searchBoxInput"]'
        ];
        
        this.blockedElements = new Set();
        this.observer = null;
        this.config = {
            blockHomeTimeline: true,
            blockTrending: true,
            blockWhoToFollow: true,
            blockExplore: true,
            blockNotifications: false,
            blockSearch: false
        };
        
        this.init();
    }

    async init() {
        await this.loadConfig();
        this.applyRules();
        this.setupObserver();
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

    applyRules() {
        this.blockedElements.forEach(element => {
            if (element && element.parentNode) {
                element.style.removeProperty('display');
                element.removeAttribute('data-focus-blocked');
            }
        });
        this.blockedElements.clear();

        this.rules.forEach(selector => {
            if (this.shouldBlockSelector(selector)) {
                this.blockElements(selector);
            }
        });
    }

    shouldBlockSelector(selector) {
        if (selector.includes('primaryColumn') || selector.includes('cellInnerDiv') || selector.includes('tweet')) {
            return this.config.blockHomeTimeline && this.isHomePage();
        }
        
        if (selector.includes('trend') || selector.includes('trending')) {
            return this.config.blockTrending;
        }
        
        if (selector.includes('whoToFollow') || selector.includes('UserCell')) {
            return this.config.blockWhoToFollow;
        }
        
        if (selector.includes('explore')) {
            return this.config.blockExplore;
        }
        
        if (selector.includes('notification')) {
            return this.config.blockNotifications;
        }
        
        if (selector.includes('search')) {
            return this.config.blockSearch;
        }
        
        return true;
    }

    blockElements(selector) {
        const elements = document.querySelectorAll(selector);
        elements.forEach(element => {
            if (element && !element.hasAttribute('data-focus-blocked')) {
                element.style.setProperty('display', 'none', 'important');
                element.setAttribute('data-focus-blocked', '1');
                this.blockedElements.add(element);
                this.addBlockIndicator(element);
            }
        });
    }

    addBlockIndicator(element) {
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
        if (this.observer) {
            this.observer.disconnect();
        }

        this.observer = new MutationObserver((mutations) => {
            let shouldReapply = false;
            
            mutations.forEach(mutation => {
                if (mutation.type === 'childList' && mutation.addedNodes.length > 0) {
                    mutation.addedNodes.forEach(node => {
                        if (node.nodeType === Node.ELEMENT_NODE) {
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
                clearTimeout(this.reapplyTimeout);
                this.reapplyTimeout = setTimeout(() => {
                    this.applyRules();
                }, 100);
            }
        });

        this.observer.observe(document.body, {
            childList: true,
            subtree: true
        });
    }

    handleUrlChanges() {
        let currentUrl = window.location.href;
        
        const checkUrlChange = () => {
            if (window.location.href !== currentUrl) {
                currentUrl = window.location.href;
                setTimeout(() => {
                    this.applyRules();
                }, 500);
            }
        };
        
        setInterval(checkUrlChange, 1000);
        
        window.addEventListener('popstate', () => {
            setTimeout(() => {
                this.applyRules();
            }, 500);
        });
    }

    isHomePage() {
        const path = window.location.pathname;
        return path === '/' || path === '/home' || path === '/i/flow/home';
    }

    async updateConfig(newConfig) {
        this.config = { ...this.config, ...newConfig };
        await chrome.storage.sync.set({ twitterConfig: this.config });
        this.applyRules();
    }

    getConfig() {
        return { ...this.config };
    }

    disable() {
        this.blockedElements.forEach(element => {
            if (element && element.parentNode) {
                element.style.removeProperty('display');
                element.removeAttribute('data-focus-blocked');
            }
        });
        this.blockedElements.clear();
    }

    enable() {
        this.applyRules();
    }
}

let twitterBlocker;

function initializeBlocker() {
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', () => {
            twitterBlocker = new TwitterBlocker();
        });
    } else {
        twitterBlocker = new TwitterBlocker();
    }
}

chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
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
});

initializeBlocker();

window.addEventListener('load', () => {
    if (!twitterBlocker) {
        twitterBlocker = new TwitterBlocker();
    }
});
