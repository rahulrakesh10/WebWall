// Reddit content script for WebWall
class RedditBlocker {
    constructor() {
        this.rules = [
            // r/all and popular
            'a[href="/r/all/"]',
            'a[href="/r/popular/"]',
            'a[href="/all/"]',
            'a[href="/popular/"]',
            
            // Home feed posts - more specific selectors
            '[data-testid="post-container"]',
            '[data-testid="post"]',
            '.Post',
            'div[data-testid="post-container"]',
            'article[data-testid="post-container"]',
            
            // Reddit post content
            'div[data-testid="post-container"]',
            'div[data-testid="post"]',
            'article[data-testid="post"]',
            
            // Promoted content
            'div[data-testid="promoted"]',
            '[data-testid="promoted"]',
            
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
        await this.checkFocusSession();
        this.setupObserver();
        this.handleUrlChanges();
        
        // TEST: Force apply rules after 2 seconds to test if it works
        setTimeout(() => {
            console.log('TEST: Forcing Reddit rules application');
            this.applyRules();
        }, 2000);
        
        console.log('Reddit WebWall Blocker initialized');
    }

    async checkFocusSession() {
        try {
            const data = await chrome.storage.sync.get(['focusSessionActive', 'activeFocusUntil']);
            const hasActiveSession = data.focusSessionActive && data.activeFocusUntil && data.activeFocusUntil > Date.now();
            
            console.log('Reddit: Focus session check', { hasActiveSession, activeFocusUntil: data.activeFocusUntil });
            
            if (hasActiveSession) {
                console.log('Reddit: Active focus session detected, applying blocking rules');
                this.applyRules();
            } else {
                console.log('Reddit: No active focus session, disabling blocking');
                this.disable();
            }
        } catch (error) {
            console.error('Reddit: Error checking focus session:', error);
        }
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
        // Clear previous blocking
        this.blockedElements.forEach(element => {
            if (element && element.parentNode) {
                element.style.removeProperty('display');
                element.removeAttribute('data-focus-blocked');
            }
        });
        this.blockedElements.clear();

        console.log('Reddit script is running');

        // Only apply blocking if we're on a feed page, not a specific post
        if (!this.isPostPage()) {
            this.rules.forEach(selector => {
                if (this.shouldBlockSelector(selector)) {
                    this.blockElements(selector);
                }
            });
            
            // Also try to hide elements by text content
            this.hideElementsByText();
        }
    }

    shouldBlockSelector(selector) {
        // Don't block anything if we're on a specific post page
        if (this.isPostPage()) {
            return false;
        }
        
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
            // Don't block elements in the left sidebar
            if (element && !element.hasAttribute('data-focus-blocked') && !this.isInLeftSidebar(element)) {
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

    hideElementsByText() {
        // Don't hide anything if we're on a specific post page
        if (this.isPostPage()) {
            return;
        }
        
        console.log('Hiding Reddit elements by text content');
        
        // Only target the main content area, not sidebars
        const mainContentArea = document.querySelector('main') || 
                               document.querySelector('[data-testid="main-content"]') ||
                               document.querySelector('[role="main"]') ||
                               document.body;
        
        // Hide elements containing "upvotes" or "comments" (typical Reddit post indicators)
        const allElements = mainContentArea.querySelectorAll('*');
        allElements.forEach(element => {
            if (element.textContent && (
                element.textContent.includes('upvotes') ||
                element.textContent.includes('comments') ||
                element.textContent.includes('Share') ||
                element.textContent.includes('Promoted')
            )) {
                // Check if it's a post container
                const postContainer = element.closest('[data-testid="post-container"]') || 
                                    element.closest('[data-testid="post"]') ||
                                    element.closest('article');
                
                // Only hide if it's a post container and not in sidebar
                if (postContainer && !this.isInLeftSidebar(postContainer)) {
                    postContainer.style.display = 'none';
                    console.log('Hidden Reddit post by text content:', element.textContent.substring(0, 50));
                }
            }
        });
        
        // Hide promoted content specifically
        const promotedElements = mainContentArea.querySelectorAll('*');
        promotedElements.forEach(element => {
            if (element.textContent && element.textContent.includes('Promoted')) {
                const container = element.closest('div') || element.closest('article');
                if (container && !this.isInLeftSidebar(container)) {
                    container.style.display = 'none';
                    console.log('Hidden promoted content');
                }
            }
        });
    }

    isInLeftSidebar(element) {
        // Check if element is in the left sidebar (communities list)
        const leftSidebar = element.closest('nav') || 
                           element.closest('[data-testid="left-sidebar"]') ||
                           element.closest('.left-sidebar') ||
                           element.closest('[role="navigation"]') ||
                           element.closest('[data-testid="navigation"]') ||
                           element.closest('[data-testid="communities"]') ||
                           element.closest('[data-testid="community-list"]');
        
        return !!leftSidebar;
    }

    removeBlockingCSS() {
        const existingStyle = document.getElementById('webwall-blocking-css');
        if (existingStyle) {
            existingStyle.remove();
            console.log('Removed Reddit blocking CSS');
        }
    }

    hideRedditElementsWithJavaScript() {
        console.log('Using JavaScript to hide Reddit elements');
        
        // Hide all elements containing "Popular" or "Trending" text
        const allElements = document.querySelectorAll('*');
        allElements.forEach(element => {
            if (element.textContent && (
                element.textContent.includes('Popular on Reddit') ||
                element.textContent.includes('Trending today') ||
                element.textContent.includes('Because you visited') ||
                element.textContent.includes('Similar to') ||
                element.textContent.includes('More like this') ||
                element.textContent.includes('Discover more') ||
                element.textContent.includes('You might like') ||
                element.textContent.includes('Suggested communities') ||
                element.textContent.includes('Trending communities')
            )) {
                // Check if it's a content section
                if (element.closest('[data-testid]') || 
                    element.closest('.Post') ||
                    element.closest('[data-testid="post-container"]')) {
                    element.style.display = 'none';
                    console.log('Hidden Reddit element:', element.textContent.substring(0, 50));
                }
            }
        });
        
        // Hide specific Reddit elements
        const redditSelectors = [
            '[data-testid="post-container"]',
            '[data-testid="post"]',
            '.Post',
            '[data-testid="trending-communities"]',
            '[data-testid="popular-posts"]',
            '[data-testid="recommendations"]',
            '[data-testid="popular-on-reddit"]',
            '[data-testid="trending-today"]',
            '[data-testid="because-you-visited"]',
            '[data-testid="similar-to"]',
            '[data-testid="more-like-this"]',
            '[data-testid="discover-more"]',
            '[data-testid="you-might-like"]',
            '[data-testid="suggested-communities"]'
        ];
        
        redditSelectors.forEach(selector => {
            const elements = document.querySelectorAll(selector);
            elements.forEach(element => {
                element.style.display = 'none';
                console.log('Hidden Reddit element with selector:', selector);
            });
        });
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

    isPostPage() {
        const path = window.location.pathname;
        // Check if we're on a specific post (has /comments/ in URL)
        return path.includes('/comments/') || path.includes('/r/') && path.split('/').length > 3;
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
        console.log('Reddit: Disabling focus mode - restoring ALL content');
        
        // Restore elements hidden by the rules-based method
        this.blockedElements.forEach(element => {
            if (element && element.parentNode) {
                element.style.removeProperty('display');
                element.removeAttribute('data-focus-blocked');
            }
        });
        this.blockedElements.clear();
        
        // AGGRESSIVE restoration - restore ALL hidden elements
        const allHiddenElements = document.querySelectorAll('*');
        allHiddenElements.forEach(element => {
            if (element.style.display === 'none') {
                element.style.display = '';
                console.log('Restored hidden element:', element.tagName, element.className);
            }
        });
        
        // Also remove any inline styles that might be hiding content
        const elementsWithHiddenStyles = document.querySelectorAll('[style*="display: none"]');
        elementsWithHiddenStyles.forEach(element => {
            element.style.removeProperty('display');
            console.log('Removed display:none from element:', element.tagName);
        });
        
        // Force a page refresh to ensure everything is restored
        console.log('Reddit focus mode disabled - all content should be visible now');
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
    
    // Listen for focus session changes
    if (message.action === 'focusSessionChanged' && redditBlocker) {
        redditBlocker.checkFocusSession();
        sendResponse({ success: true });
        return true;
    }
});

initializeBlocker();

window.addEventListener('load', () => {
    if (!redditBlocker) {
        redditBlocker = new RedditBlocker();
    }
});
