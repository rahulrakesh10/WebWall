// YouTube content script for WebWall
class YouTubeBlocker {
    constructor() {
        this.blockedElements = new Set();
        this.observer = null;
        this.config = {
            blockShorts: true,
            blockHomeFeed: true,
            blockTrending: true,
            blockComments: false,
            blockRelatedVideos: false,
            redirectHomeToSubscriptions: false
        };
        
        this.init();
    }

    async init() {
        await this.loadConfig();
        this.checkFocusSession();
        this.setupObserver();
        this.handleUrlChanges();
        
        // TEST: Force apply blocking CSS to test if it works
        setTimeout(() => {
            console.log('TEST: Forcing YouTube blocking CSS application');
            this.injectBlockingCSS();
        }, 2000);
        
        console.log('YouTube WebWall Blocker initialized');
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

    async checkFocusSession() {
        try {
            // Check if extension context is still valid
            if (!chrome.runtime?.id) {
                console.log('Extension context invalid, skipping focus session check');
                return;
            }

            const data = await chrome.storage.sync.get(['activeFocusUntil', 'isDeepFocus', 'focusSessionActive']);
            const hasActiveSession = data.focusSessionActive && data.activeFocusUntil && data.activeFocusUntil > Date.now();
            const isDeepFocus = data.isDeepFocus || false;

            console.log('YouTube: Focus session check', { hasActiveSession, isDeepFocus, activeFocusUntil: data.activeFocusUntil });

            if (hasActiveSession) {
                if (isDeepFocus) {
                    // Deep Focus: Don't apply element blocking (site is blocked by DNR)
                    console.log('YouTube: Deep Focus active - site blocked by DNR');
                    this.removeBlockingCSS();
                } else {
                    // Quick Focus: Apply element blocking
                    console.log('YouTube: Quick Focus active - applying element blocking');
                    this.injectBlockingCSS();
                }
            } else {
                // No active session: Remove all blocking
                console.log('YouTube: No active session - removing all blocking');
                this.removeBlockingCSS();
            }
        } catch (error) {
            console.error('Error checking focus session:', error);
        }
    }

    injectBlockingCSS() {
        // Remove existing style if any
        const existingStyle = document.getElementById('webwall-blocking-css');
        if (existingStyle) {
            existingStyle.remove();
        }
        
        // Always apply blocking CSS to hide Shorts and distracting content
        console.log('Applying YouTube blocking CSS');
        
        // Create and inject CSS
        const style = document.createElement('style');
        style.id = 'webwall-blocking-css';
        style.textContent = `
            /* Block YouTube Shorts and distracting elements */
            

            
            /* Hide Shorts tab in top navigation - more aggressive selectors */
            a[href="/shorts/"],
            a[href^="/shorts/"],
            [aria-label="Shorts"],
            [data-testid="shorts-tab"],
            ytd-guide-entry-renderer[title="Shorts"],
            ytd-guide-entry-renderer[aria-label*="Shorts"],
            ytd-mini-guide-entry-renderer[title="Shorts"],
            ytd-mini-guide-entry-renderer[aria-label*="Shorts"],
            /* More specific selectors for sidebar */
            ytd-guide-entry-renderer:has(a[href="/shorts/"]),
            ytd-guide-entry-renderer:has([aria-label="Shorts"]),
            ytd-mini-guide-entry-renderer:has(a[href="/shorts/"]),
            ytd-mini-guide-entry-renderer:has([aria-label="Shorts"]),
            /* Target by text content */
            ytd-guide-entry-renderer:has(span:contains("Shorts")),
            ytd-mini-guide-entry-renderer:has(span:contains("Shorts")),
            /* Target by any element containing "Shorts" */
            *:contains("Shorts") {
                display: none !important;
            }
            
            /* Hide Shorts content on homepage */
            ytd-rich-section-renderer[is-shorts],
            ytd-rich-section-renderer[section-identifier="FEshorts"],
            ytd-rich-section-renderer[section-identifier="shorts"],
            ytd-rich-section-renderer:has(ytd-rich-shelf-renderer[is-shorts]),
            ytd-rich-shelf-renderer[is-shorts],
            ytd-rich-shelf-renderer[title*="Shorts"],
            ytd-rich-shelf-renderer[title*="shorts"] {
                display: none !important;
            }
            
            /* Hide trending section */
            ytd-rich-section-renderer[section-identifier="trending"],
            ytd-rich-section-renderer[section-identifier="trending"],
            ytd-rich-shelf-renderer[title*="Trending"],
            ytd-rich-shelf-renderer[title*="trending"] {
                display: none !important;
            }
            
            /* Hide "What to watch" recommendations on homepage */
            ytd-rich-section-renderer[section-identifier="chips"],
            ytd-rich-section-renderer[section-identifier="shelf_0"],
            ytd-rich-shelf-renderer[title*="Recommended"],
            ytd-rich-shelf-renderer[title*="recommended"] {
                display: none !important;
            }
            
            /* Hide main video grid on homepage */
            ytd-rich-grid-renderer,
            ytd-rich-grid-row,
            ytd-rich-item-renderer {
                display: none !important;
            }
            
            /* Hide specific video sections */
            ytd-rich-section-renderer[section-identifier="FEshorts"],
            ytd-rich-section-renderer[section-identifier="shelf_0"],
            ytd-rich-section-renderer[section-identifier="shelf_1"],
            ytd-rich-section-renderer[section-identifier="shelf_2"],
            ytd-rich-section-renderer[section-identifier="shelf_3"],
            ytd-rich-section-renderer[section-identifier="shelf_4"],
            ytd-rich-section-renderer[section-identifier="shelf_5"] {
                display: none !important;
            }
            
            /* Hide video thumbnails and recommendations */
            ytd-rich-item-renderer,
            ytd-rich-item-renderer *,
            ytd-rich-grid-media,
            ytd-rich-grid-row {
                display: none !important;
            }
            
            /* Hide Subscriptions section in sidebar */
            ytd-guide-entry-renderer[title="Subscriptions"],
            ytd-guide-entry-renderer[aria-label*="Subscriptions"],
            ytd-mini-guide-entry-renderer[title="Subscriptions"],
            ytd-mini-guide-entry-renderer[aria-label*="Subscriptions"] {
                display: none !important;
            }
            
            /* Hide Explore section in sidebar */
            ytd-guide-entry-renderer[title="Explore"],
            ytd-guide-entry-renderer[aria-label*="Explore"],
            ytd-mini-guide-entry-renderer[title="Explore"],
            ytd-mini-guide-entry-renderer[aria-label*="Explore"] {
                display: none !important;
            }
            
            /* Hide individual subscription channels */
            ytd-guide-entry-renderer[title*="a bit more willne"],
            ytd-guide-entry-renderer[title*="AB"],
            ytd-guide-entry-renderer[title*="Abbas Vlogs"],
            ytd-guide-entry-renderer[title*="Abdel1107"],
            ytd-guide-entry-renderer[title*="Abdul Bari"],
            ytd-guide-entry-renderer[title*="Acting is Reacting"],
            ytd-guide-entry-renderer[title*="Alex Lee"] {
                display: none !important;
            }
            
            /* Hide Music, Movies & TV, Live sections */
            ytd-guide-entry-renderer[title="Music"],
            ytd-guide-entry-renderer[title="Movies & TV"],
            ytd-guide-entry-renderer[title="Live"] {
                display: none !important;
            }
            
            /* Hide suggested videos sidebar when watching a video */
            ytd-watch-flexy[theater] #secondary,
            ytd-watch-flexy:not([theater]) #secondary,
            ytd-watch-flexy #secondary,
            ytd-watch-flexy #related,
            ytd-watch-flexy ytd-watch-next-secondary-results-renderer,
            ytd-watch-flexy ytd-compact-video-renderer,
            ytd-watch-flexy ytd-rich-item-renderer {
                display: none !important;
            }
            
            /* Hide Shorts in video sidebar */
            ytd-watch-flexy ytd-rich-section-renderer[is-shorts],
            ytd-watch-flexy ytd-rich-shelf-renderer[is-shorts],
            ytd-watch-flexy ytd-rich-shelf-renderer[title*="Shorts"] {
                display: none !important;
            }
            
            /* Hide recommended videos in sidebar */
            ytd-watch-flexy ytd-rich-shelf-renderer[title*="Recommended"],
            ytd-watch-flexy ytd-rich-shelf-renderer[title*="recommended"] {
                display: none !important;
            }
            
            /* Hide sidebar Shorts link */
            ytd-guide-entry-renderer[title="Shorts"],
            ytd-guide-entry-renderer[aria-label*="Shorts"],
            ytd-mini-guide-entry-renderer[title="Shorts"],
            ytd-mini-guide-entry-renderer[aria-label*="Shorts"] {
                display: none !important;
            }
            
            /* Hide Shorts in search results */
            ytd-video-renderer[is-shorts],
            ytd-compact-video-renderer[is-shorts],
            ytd-rich-item-renderer[is-shorts] {
                display: none !important;
            }
            
            /* Hide Shorts in channel pages */
            ytd-tab[title="Shorts"],
            ytd-tab[aria-label*="Shorts"] {
                display: none !important;
            }
            
            /* Hide Shorts in mobile navigation */
            ytd-mobile-guide-entry-renderer[title="Shorts"],
            ytd-mobile-guide-entry-renderer[aria-label*="Shorts"] {
                display: none !important;
            }
            

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
        
        console.log('Injected YouTube blocking CSS - hiding Shorts and distracting content');
        
        // Also use JavaScript to hide elements that CSS might miss
        setTimeout(() => {
            this.hideShortsWithJavaScript();
        }, 1000);
        
        // Debug: log what elements we're targeting
        setTimeout(() => {
            const shortsLinks = document.querySelectorAll('a[href="/shorts/"], [aria-label="Shorts"], ytd-guide-entry-renderer[title="Shorts"]');
            const shortsContent = document.querySelectorAll('ytd-rich-shelf-renderer[is-shorts], ytd-rich-section-renderer[is-shorts]');
            const trendingContent = document.querySelectorAll('ytd-rich-shelf-renderer[title*="Trending"]');
            
            console.log('Found Shorts links:', shortsLinks.length);
            console.log('Found Shorts content sections:', shortsContent.length);
            console.log('Found trending content:', trendingContent.length);
            
            console.log('YouTube blocking active - Shorts and trending content should be hidden');
        }, 1000);
    }

    removeBlockingCSS() {
        const existingStyle = document.getElementById('webwall-blocking-css');
        if (existingStyle) {
            existingStyle.remove();
            console.log('Removed YouTube blocking CSS');
        }
        
        // Also restore all JavaScript-hidden elements
        this.restoreJavaScriptHiddenElements();
    }

    restoreJavaScriptHiddenElements() {
        console.log('YouTube: Restoring all JavaScript-hidden elements');
        
        // Restore all elements that were hidden by JavaScript
        const allElements = document.querySelectorAll('*');
        allElements.forEach(element => {
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
        
        console.log('YouTube: All JavaScript-hidden elements restored');
    }

    hideShortsWithJavaScript() {
        console.log('Using JavaScript to hide Shorts and video elements');
        
        // Hide all elements containing "Shorts" text
        const allElements = document.querySelectorAll('*');
        allElements.forEach(element => {
            if (element.textContent && element.textContent.includes('Shorts')) {
                // Check if it's a navigation element or link
                if (element.tagName === 'A' || 
                    element.closest('ytd-guide-entry-renderer') || 
                    element.closest('ytd-mini-guide-entry-renderer') ||
                    element.closest('nav') ||
                    element.closest('[role="navigation"]')) {
                    element.style.display = 'none';
                    console.log('Hidden Shorts element:', element);
                }
            }
        });
        
        // Hide specific Shorts links
        const shortsSelectors = [
            'a[href="/shorts/"]',
            'a[href^="/shorts/"]',
            '[aria-label="Shorts"]',
            '[data-testid="shorts-tab"]',
            'ytd-guide-entry-renderer[title="Shorts"]',
            'ytd-guide-entry-renderer[aria-label*="Shorts"]',
            'ytd-mini-guide-entry-renderer[title="Shorts"]',
            'ytd-mini-guide-entry-renderer[aria-label*="Shorts"]'
        ];
        
        shortsSelectors.forEach(selector => {
            const elements = document.querySelectorAll(selector);
            elements.forEach(element => {
                element.style.display = 'none';
                console.log('Hidden element with selector:', selector, element);
            });
        });
        
        // Hide parent containers of Shorts elements
        const shortsElements = document.querySelectorAll('a[href="/shorts/"], [aria-label="Shorts"]');
        shortsElements.forEach(element => {
            const parent = element.closest('ytd-guide-entry-renderer, ytd-mini-guide-entry-renderer');
            if (parent) {
                parent.style.display = 'none';
                console.log('Hidden parent container:', parent);
            }
        });
        
        // Hide video content on homepage
        const videoSelectors = [
            'ytd-rich-grid-renderer',
            'ytd-rich-grid-row',
            'ytd-rich-item-renderer',
            'ytd-rich-section-renderer[section-identifier="shelf_0"]',
            'ytd-rich-section-renderer[section-identifier="shelf_1"]',
            'ytd-rich-section-renderer[section-identifier="shelf_2"]',
            'ytd-rich-section-renderer[section-identifier="shelf_3"]',
            'ytd-rich-section-renderer[section-identifier="shelf_4"]',
            'ytd-rich-section-renderer[section-identifier="shelf_5"]'
        ];
        
        videoSelectors.forEach(selector => {
            const elements = document.querySelectorAll(selector);
            elements.forEach(element => {
                element.style.display = 'none';
                console.log('Hidden video element with selector:', selector, element);
            });
        });
        
        // Hide any remaining video thumbnails
        const videoThumbnails = document.querySelectorAll('ytd-rich-item-renderer, ytd-rich-grid-media');
        videoThumbnails.forEach(element => {
            element.style.display = 'none';
            console.log('Hidden video thumbnail:', element);
        });
        
        // Hide Subscriptions and Explore sections
        const sidebarSections = [
            'ytd-guide-entry-renderer[title="Subscriptions"]',
            'ytd-guide-entry-renderer[title="Explore"]',
            'ytd-mini-guide-entry-renderer[title="Subscriptions"]',
            'ytd-mini-guide-entry-renderer[title="Explore"]'
        ];
        
        sidebarSections.forEach(selector => {
            const elements = document.querySelectorAll(selector);
            elements.forEach(element => {
                element.style.display = 'none';
                console.log('Hidden sidebar section:', selector, element);
            });
        });
        
        // Hide individual subscription channels
        const subscriptionChannels = document.querySelectorAll('ytd-guide-entry-renderer');
        subscriptionChannels.forEach(element => {
            const title = element.getAttribute('title');
            if (title && (
                title.includes('a bit more willne') ||
                title.includes('AB') ||
                title.includes('Abbas Vlogs') ||
                title.includes('Abdel1107') ||
                title.includes('Abdul Bari') ||
                title.includes('Acting is Reacting') ||
                title.includes('Alex Lee')
            )) {
                element.style.display = 'none';
                console.log('Hidden subscription channel:', title);
            }
        });
        
        // Hide Music, Movies & TV, Live sections
        const exploreSections = [
            'ytd-guide-entry-renderer[title="Music"]',
            'ytd-guide-entry-renderer[title="Movies & TV"]',
            'ytd-guide-entry-renderer[title="Live"]'
        ];
        
        exploreSections.forEach(selector => {
            const elements = document.querySelectorAll(selector);
            elements.forEach(element => {
                element.style.display = 'none';
                console.log('Hidden explore section:', selector, element);
            });
        });
        
        // Hide video sidebar and suggested videos
        const videoSidebarSelectors = [
            'ytd-watch-flexy #secondary',
            'ytd-watch-flexy #related',
            'ytd-watch-flexy ytd-watch-next-secondary-results-renderer',
            'ytd-watch-flexy ytd-compact-video-renderer',
            'ytd-watch-flexy ytd-rich-item-renderer'
        ];
        
        videoSidebarSelectors.forEach(selector => {
            const elements = document.querySelectorAll(selector);
            elements.forEach(element => {
                element.style.display = 'none';
                console.log('Hidden video sidebar element:', selector, element);
            });
        });
        
        // Hide Shorts and recommended videos in video sidebar
        const videoSidebarContent = document.querySelectorAll('ytd-watch-flexy ytd-rich-shelf-renderer');
        videoSidebarContent.forEach(element => {
            const title = element.getAttribute('title') || '';
            if (title.includes('Shorts') || title.includes('Recommended') || title.includes('recommended')) {
                element.style.display = 'none';
                console.log('Hidden video sidebar content:', title);
            }
        });
    }

    setupObserver() {
        if (this.observer) {
            this.observer.disconnect();
        }

        this.observer = new MutationObserver((mutations) => {
            let shouldReapply = false;
            let shouldHideShorts = false;
            
            mutations.forEach(mutation => {
                if (mutation.type === 'childList' && mutation.addedNodes.length > 0) {
                    mutation.addedNodes.forEach(node => {
                        if (node.nodeType === Node.ELEMENT_NODE) {
                            // Check for main content elements
                            if (node.matches && (
                                node.matches('ytd-page-manager') ||
                                node.matches('ytd-browse[page-subtype="home"]') ||
                                node.matches('ytd-rich-grid-renderer') ||
                                node.matches('ytd-rich-item-renderer')
                            )) {
                                shouldReapply = true;
                            } else if (node.querySelectorAll) {
                                const mainContentElements = node.querySelectorAll('ytd-page-manager, ytd-browse[page-subtype="home"], ytd-rich-grid-renderer, ytd-rich-item-renderer');
                                if (mainContentElements.length > 0) {
                                    shouldReapply = true;
                                }
                            }
                            
                            // Check for Shorts elements
                            if (node.matches && (
                                node.matches('a[href="/shorts/"]') ||
                                node.matches('[aria-label="Shorts"]') ||
                                node.matches('ytd-guide-entry-renderer') ||
                                node.matches('ytd-mini-guide-entry-renderer')
                            )) {
                                shouldHideShorts = true;
                            } else if (node.querySelectorAll) {
                                const shortsElements = node.querySelectorAll('a[href="/shorts/"], [aria-label="Shorts"], ytd-guide-entry-renderer, ytd-mini-guide-entry-renderer');
                                if (shortsElements.length > 0) {
                                    shouldHideShorts = true;
                                }
                            }
                            
                            // Check for video elements
                            if (node.matches && (
                                node.matches('ytd-rich-item-renderer') ||
                                node.matches('ytd-rich-grid-renderer') ||
                                node.matches('ytd-rich-grid-row') ||
                                node.matches('ytd-rich-section-renderer')
                            )) {
                                shouldHideShorts = true;
                            } else if (node.querySelectorAll) {
                                const videoElements = node.querySelectorAll('ytd-rich-item-renderer, ytd-rich-grid-renderer, ytd-rich-grid-row, ytd-rich-section-renderer');
                                if (videoElements.length > 0) {
                                    shouldHideShorts = true;
                                }
                            }
                        }
                    });
                }
            });
            
            if (shouldReapply) {
                clearTimeout(this.reapplyTimeout);
                this.reapplyTimeout = setTimeout(() => {
                    this.checkFocusSession();
                }, 100);
            }
            
            if (shouldHideShorts) {
                clearTimeout(this.shortsTimeout);
                this.shortsTimeout = setTimeout(() => {
                    this.hideShortsWithJavaScript();
                }, 100);
            }
        });

        // Only observe if document.body exists
        if (document.body) {
            this.observer.observe(document.body, {
                childList: true,
                subtree: true
            });
        } else {
            // Wait for body to be available
            document.addEventListener('DOMContentLoaded', () => {
                if (document.body && this.observer) {
                    this.observer.observe(document.body, {
                        childList: true,
                        subtree: true
                    });
                }
            });
        }
    }

    handleUrlChanges() {
        let currentUrl = window.location.href;
        
        const checkUrlChange = () => {
            if (window.location.href !== currentUrl) {
                currentUrl = window.location.href;
                setTimeout(() => {
                    this.checkFocusSession();
                }, 500);
            }
        };
        
        setInterval(checkUrlChange, 1000);
        
        window.addEventListener('popstate', () => {
            setTimeout(() => {
                this.checkFocusSession();
            }, 500);
        });
    }

    isHomePage() {
        const path = window.location.pathname;
        // Apply blocking to homepage, subscriptions, trending, and any page with Shorts
        return path === '/' || 
               path === '/feed/subscriptions' || 
               path === '/feed/trending' ||
               path.startsWith('/shorts/') ||
               path === '/shorts';
    }

    redirectToSubscriptions() {
        // Only redirect if we're on the homepage and redirect is enabled
        if (this.isHomePage() && this.config.redirectHomeToSubscriptions) {
            const subscriptionLink = document.querySelector('a[href="/feed/subscriptions"]');
            if (subscriptionLink) {
                subscriptionLink.click();
            } else {
                // Fallback: navigate directly
                window.location.href = '/feed/subscriptions';
            }
        }
    }

    // Public method to update configuration
    async updateConfig(newConfig) {
        this.config = { ...this.config, ...newConfig };
        await chrome.storage.sync.set({ youtubeConfig: this.config });
        this.checkFocusSession();
    }

    // Public method to get current configuration
    getConfig() {
        return { ...this.config };
    }

    // Public method to temporarily disable blocking
    disable() {
        this.removeBlockingCSS();
    }

    // Public method to re-enable blocking
    enable() {
        this.checkFocusSession();
    }

    // Method to show deep focus prompt
    showDeepFocusPrompt() {
        // Create a prompt to refresh the page
        const prompt = document.createElement('div');
        prompt.style.cssText = `
            position: fixed;
            top: 50%;
            left: 50%;
            transform: translate(-50%, -50%);
            background: #1a1a1a;
            color: white;
            padding: 20px;
            border-radius: 8px;
            z-index: 10000;
            font-family: Arial, sans-serif;
            text-align: center;
            box-shadow: 0 4px 20px rgba(0,0,0,0.5);
            min-width: 300px;
        `;
        
        prompt.innerHTML = `
            <h3>Deep Focus Activated</h3>
            <p>This site is now blocked. The page will refresh automatically in 3 seconds.</p>
            <div style="margin-top: 15px;">
                <button id="refresh-now" style="background: #667eea; color: white; border: none; padding: 10px 20px; border-radius: 4px; margin-right: 10px; cursor: pointer; font-size: 14px; font-weight: 500; transition: background 0.2s;">Refresh Now</button>
                <button id="refresh-later" style="background: #666; color: white; border: none; padding: 10px 20px; border-radius: 4px; cursor: pointer; font-size: 14px; font-weight: 500; transition: background 0.2s;">Refresh Later</button>
            </div>
        `;
        
        document.body.appendChild(prompt);
        
        // Auto-refresh after 3 seconds
        const autoRefresh = setTimeout(() => {
            if (document.body.contains(prompt)) {
                window.location.reload();
            }
        }, 3000);
        
        // Manual refresh button - improved event handling
        const refreshNowBtn = prompt.querySelector('#refresh-now');
        const refreshLaterBtn = prompt.querySelector('#refresh-later');
        
        // Use multiple event listeners for better responsiveness
        const refreshNow = () => {
            clearTimeout(autoRefresh);
            window.location.reload();
        };
        
        const refreshLater = () => {
            clearTimeout(autoRefresh);
            if (document.body.contains(prompt)) {
                document.body.removeChild(prompt);
            }
        };
        
        // Add multiple event listeners for better responsiveness
        refreshNowBtn.addEventListener('click', refreshNow, { once: true });
        refreshNowBtn.addEventListener('mousedown', refreshNow, { once: true });
        refreshNowBtn.addEventListener('touchstart', refreshNow, { once: true });
        
        refreshLaterBtn.addEventListener('click', refreshLater, { once: true });
        refreshLaterBtn.addEventListener('mousedown', refreshLater, { once: true });
        refreshLaterBtn.addEventListener('touchstart', refreshLater, { once: true });
        
        // Add hover effects
        refreshNowBtn.addEventListener('mouseenter', () => {
            refreshNowBtn.style.background = '#5a67d8';
        });
        refreshNowBtn.addEventListener('mouseleave', () => {
            refreshNowBtn.style.background = '#667eea';
        });
        
        refreshLaterBtn.addEventListener('mouseenter', () => {
            refreshLaterBtn.style.background = '#555';
        });
        refreshLaterBtn.addEventListener('mouseleave', () => {
            refreshLaterBtn.style.background = '#666';
        });
    }
}

// Initialize the blocker immediately to prevent flash
let youtubeBlocker;

function initializeBlocker() {
    // Run immediately to prevent flash
    youtubeBlocker = new YouTubeBlocker();
    
    // Also run when DOM is ready for any missed elements
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', () => {
            if (youtubeBlocker) {
                youtubeBlocker.checkFocusSession();
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

        // Ensure youtubeBlocker is initialized
        if (!youtubeBlocker) {
            console.log('YouTube blocker not initialized, initializing now');
            youtubeBlocker = new YouTubeBlocker();
        }

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
        
        // Listen for focus session changes
        if (message.action === 'focusSessionChanged' && youtubeBlocker) {
            youtubeBlocker.checkFocusSession();
            sendResponse({ success: true });
            return true;
        }
        
        // Listen for Deep Focus activation
        if (message.action === 'deepFocusActivated' && youtubeBlocker) {
            try {
                if (typeof youtubeBlocker.showDeepFocusPrompt === 'function') {
                    youtubeBlocker.showDeepFocusPrompt();
                    sendResponse({ success: true });
                } else {
                    console.error('showDeepFocusPrompt method not found on youtubeBlocker, using fallback');
                    // Fallback: create the prompt directly with improved responsiveness
                    const prompt = document.createElement('div');
                    prompt.style.cssText = `
                        position: fixed;
                        top: 50%;
                        left: 50%;
                        transform: translate(-50%, -50%);
                        background: #1a1a1a;
                        color: white;
                        padding: 20px;
                        border-radius: 8px;
                        z-index: 10000;
                        font-family: Arial, sans-serif;
                        text-align: center;
                        box-shadow: 0 4px 20px rgba(0,0,0,0.5);
                        min-width: 300px;
                    `;
                    
                    prompt.innerHTML = `
                        <h3>Deep Focus Activated</h3>
                        <p>This site is now blocked. The page will refresh automatically in 3 seconds.</p>
                        <div style="margin-top: 15px;">
                            <button id="refresh-now" style="background: #667eea; color: white; border: none; padding: 10px 20px; border-radius: 4px; margin-right: 10px; cursor: pointer; font-size: 14px; font-weight: 500; transition: background 0.2s;">Refresh Now</button>
                            <button id="refresh-later" style="background: #666; color: white; border: none; padding: 10px 20px; border-radius: 4px; cursor: pointer; font-size: 14px; font-weight: 500; transition: background 0.2s;">Refresh Later</button>
                        </div>
                    `;
                    
                    document.body.appendChild(prompt);
                    
                    // Auto-refresh after 3 seconds
                    const autoRefresh = setTimeout(() => {
                        if (document.body.contains(prompt)) {
                            window.location.reload();
                        }
                    }, 3000);
                    
                    // Manual refresh button - improved event handling
                    const refreshNowBtn = prompt.querySelector('#refresh-now');
                    const refreshLaterBtn = prompt.querySelector('#refresh-later');
                    
                    // Use multiple event listeners for better responsiveness
                    const refreshNow = () => {
                        clearTimeout(autoRefresh);
                        window.location.reload();
                    };
                    
                    const refreshLater = () => {
                        clearTimeout(autoRefresh);
                        if (document.body.contains(prompt)) {
                            document.body.removeChild(prompt);
                        }
                    };
                    
                    // Add multiple event listeners for better responsiveness
                    refreshNowBtn.addEventListener('click', refreshNow, { once: true });
                    refreshNowBtn.addEventListener('mousedown', refreshNow, { once: true });
                    refreshNowBtn.addEventListener('touchstart', refreshNow, { once: true });
                    
                    refreshLaterBtn.addEventListener('click', refreshLater, { once: true });
                    refreshLaterBtn.addEventListener('mousedown', refreshLater, { once: true });
                    refreshLaterBtn.addEventListener('touchstart', refreshLater, { once: true });
                    
                    // Add hover effects
                    refreshNowBtn.addEventListener('mouseenter', () => {
                        refreshNowBtn.style.background = '#5a67d8';
                    });
                    refreshNowBtn.addEventListener('mouseleave', () => {
                        refreshNowBtn.style.background = '#667eea';
                    });
                    
                    refreshLaterBtn.addEventListener('mouseenter', () => {
                        refreshLaterBtn.style.background = '#555';
                    });
                    refreshLaterBtn.addEventListener('mouseleave', () => {
                        refreshLaterBtn.style.background = '#666';
                    });
                    
                    sendResponse({ success: true });
                }
            } catch (error) {
                console.error('Error showing deep focus prompt:', error);
                sendResponse({ success: false, error: error.message });
            }
            return true;
        }
        
    } catch (error) {
        console.error('Error handling message:', error);
        sendResponse({ success: false, error: error.message });
    }
});

// Initialize immediately
initializeBlocker();

// Also initialize on load for any missed elements
window.addEventListener('load', () => {
    if (!youtubeBlocker) {
        youtubeBlocker = new YouTubeBlocker();
    }
});
