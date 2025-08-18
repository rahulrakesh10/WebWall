// Reddit content script for Focus Blocks
class RedditBlocker {
    constructor() {
        this.rules = [
            // r/all and popular
            'a[href="/r/all/"]',
            'a[href="/r/popular/"]',
            'a[href="/all/"]',
            'a[href="/popular/"]',
            
            // Home feed posts
            '[data-testid="post-container"]',
            '[data-testid="post"]',
            '.Post',
            
            // Trending communities
            '[data-testid="trending-communities"]',
            '.trending-communities',
            
            // Popular posts sidebar
            '.popular-posts',
            '[data-testid="popular-posts"]',
            
            // Recommendations
            '[data-testid="recommendations"]',
            '.recommendations',
            
            // Comments (optional)
            '[data-testid="comment"]',
            '.Comment',
            
            // Upvote/downvote buttons (optional)
            '[data-testid="upvote"]',
            '[data-testid="downvote"]'
        ];
        
        this.blockedElements = new Set();
        this.observer = null;
        this.config = {
            blockAll: true,
            blockPopular: true,
            blockHomeFeed: true,
            blockTrending: true,
            blockComments: false,
            blockVoteButtons: false
        };
        
        this.init();
    }

    async init() {
        await this.loadConfig();
        this.applyRules();
        this.setupObserver();
        this.handleUrlChanges();
        console.log('Reddit Focus Blocker initialized');
    }

    async loadConfig() {
        try {
            const data = await chrome.storage.sync.get(['redditConfig']);
            if (data.redditConfig) {
                this.config = { ...this.config, ...data.redditConfig };
            }
        } catch (error) {
            console.error('Error loading Reddit config:', error);
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
        if (selector.includes('all') || selector.includes('popular')) {
            return this.config.blockAll || this.config.blockPopular;
        }
        
        if (selector.includes('post-container') || selector.includes('post') || selector.includes('Post')) {
            return this.config.blockHomeFeed && this.isHomePage();
        }
        
        if (selector.includes('trending')) {
            return this.config.blockTrending;
        }
        
        if (selector.includes('comment') || selector.includes('Comment')) {
            return this.config.blockComments;
        }
        
        if (selector.includes('upvote') || selector.includes('downvote')) {
            return this.config.blockVoteButtons;
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
        return path === '/' || path === '/home' || path === '/r/all' || path === '/r/popular';
    }

    async updateConfig(newConfig) {
        this.config = { ...this.config, ...newConfig };
        await chrome.storage.sync.set({ redditConfig: this.config });
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

let redditBlocker;

function initializeBlocker() {
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', () => {
            redditBlocker = new RedditBlocker();
        });
    } else {
        redditBlocker = new RedditBlocker();
    }
}

chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
    if (message.target === 'reddit' && redditBlocker) {
        switch (message.action) {
            case 'updateConfig':
                redditBlocker.updateConfig(message.config)
                    .then(() => sendResponse({ success: true }))
                    .catch(error => sendResponse({ success: false, error: error.message }));
                return true;
                
            case 'getConfig':
                sendResponse({ config: redditBlocker.getConfig() });
                return true;
                
            case 'disable':
                redditBlocker.disable();
                sendResponse({ success: true });
                return true;
                
            case 'enable':
                redditBlocker.enable();
                sendResponse({ success: true });
                return true;
        }
    }
});

initializeBlocker();

window.addEventListener('load', () => {
    if (!redditBlocker) {
        redditBlocker = new RedditBlocker();
    }
});
