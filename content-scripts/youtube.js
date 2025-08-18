// YouTube content script for Focus Blocks
class YouTubeBlocker {
    constructor() {
        this.rules = [
            // Shorts
            'a[href="/shorts/"]',
            'a[href^="/shorts/"]',
            '[aria-label="Shorts"]',
            '[data-testid="shorts-tab"]',
            'ytd-reel-shelf-renderer',
            'ytd-rich-section-renderer[is-shorts]',
            
            // Home feed recommendations
            'ytd-rich-grid-renderer',
            'ytd-rich-grid-row',
            'ytd-rich-item-renderer',
            
            // Trending
            'a[href="/trending"]',
            '[data-testid="trending-tab"]',
            
            // Subscriptions feed
            'ytd-browse[page-subtype="subscriptions"]',
            
            // Comments (optional)
            'ytd-comments',
            '#comments',
            
            // Related videos sidebar
            'ytd-watch-next-secondary-results-renderer',
            '#related'
        ];
        
        this.blockedElements = new Set();
        this.observer = null;
        this.config = {
            blockShorts: true,
            blockHomeFeed: true,
            blockTrending: true,
            blockComments: false,
            blockRelatedVideos: false
        };
        
        this.init();
    }

    async init() {
        await this.loadConfig();
        this.applyRules();
        this.setupObserver();
        this.handleUrlChanges();
        console.log('YouTube Focus Blocker initialized');
    }

    async loadConfig() {
        try {
            const data = await chrome.storage.sync.get(['youtubeConfig']);
            if (data.youtubeConfig) {
                this.config = { ...this.config, ...data.youtubeConfig };
            }
        } catch (error) {
            console.error('Error loading YouTube config:', error);
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
        if (selector.includes('shorts')) {
            return this.config.blockShorts;
        }
        
        if (selector.includes('rich-grid') || selector.includes('rich-item')) {
            return this.config.blockHomeFeed && this.isHomePage();
        }
        
        if (selector.includes('trending')) {
            return this.config.blockTrending;
        }
        
        if (selector.includes('comments')) {
            return this.config.blockComments;
        }
        
        if (selector.includes('related') || selector.includes('watch-next')) {
            return this.config.blockRelatedVideos;
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
        return path === '/' || path === '/feed/subscriptions' || path === '/feed/trending';
    }

    async updateConfig(newConfig) {
        this.config = { ...this.config, ...newConfig };
        await chrome.storage.sync.set({ youtubeConfig: this.config });
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

let youtubeBlocker;

function initializeBlocker() {
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', () => {
            youtubeBlocker = new YouTubeBlocker();
        });
    } else {
        youtubeBlocker = new YouTubeBlocker();
    }
}

chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
    if (message.target === 'youtube' && youtubeBlocker) {
        switch (message.action) {
            case 'updateConfig':
                youtubeBlocker.updateConfig(message.config)
                    .then(() => sendResponse({ success: true }))
                    .catch(error => sendResponse({ success: false, error: error.message }));
                return true;
                
            case 'getConfig':
                sendResponse({ config: youtubeBlocker.getConfig() });
                return true;
                
            case 'disable':
                youtubeBlocker.disable();
                sendResponse({ success: true });
                return true;
                
            case 'enable':
                youtubeBlocker.enable();
                sendResponse({ success: true });
                return true;
        }
    }
});

initializeBlocker();

window.addEventListener('load', () => {
    if (!youtubeBlocker) {
        youtubeBlocker = new YouTubeBlocker();
    }
});
