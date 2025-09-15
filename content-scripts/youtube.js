// YouTube content script for WebWall
class YouTubeBlocker {
    constructor() {
        this.blockedElements = new Set();
        this.observer = null;
        // Track whether we currently have an active, non-deep focus session
        this.isSessionActive = false;
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
        
        // Add global test functions for debugging
        window.testYouTubeBlocker = () => {
            console.log('YouTube: Manual test - applying blocking...');
            this.injectBlockingCSS();
            this.hideShortsWithJavaScript();
        };
        
        window.clearYouTubeBlocks = () => {
            console.log('YouTube: Manual test - clearing all blocks...');
            this.clearBlocks();
        };
        
        console.log('YouTube WebWall Blocker initialized - content script is running!');
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
                console.log('Extension context invalid, clearing blocks');
                this.clearBlocks();
                this.isSessionActive = false;
                return;
            }

            const response = await chrome.runtime.sendMessage({ action: 'getStatus' });
            const hasActiveSession = response.focusSessionActive && response.activeUntil && response.activeUntil > Date.now();
            const isDeepFocus = response.activeUntil && (response.activeUntil - Date.now()) >= (90 * 60 * 1000);

            console.log('YouTube: Focus session check', { 
                hasActiveSession, 
                isDeepFocus, 
                activeFocusUntil: response.activeUntil,
                currentTime: Date.now(),
                timeLeft: response.activeUntil ? response.activeUntil - Date.now() : 0,
                response: response
            });

            if (hasActiveSession) {
                if (isDeepFocus) {
                    // Deep Focus: Don't apply element blocking (site is blocked by DNR)
                    console.log('YouTube: Deep Focus active - site blocked by DNR');
                    this.removeBlockingCSS();
                    this.isSessionActive = false;
                } else {
                    // Quick Focus: Apply element blocking
                    console.log('YouTube: Quick Focus active - applying element blocking');
                    this.isSessionActive = true;
                    this.injectBlockingCSS();
                }
            } else {
                // No active session: Remove all blocking
                console.log('YouTube: No active session - removing all blocking');
                this.clearBlocks();
                this.isSessionActive = false;
            }
        } catch (error) {
            console.error('Error checking focus session:', error);
            this.isSessionActive = false;
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
        const path = window.location.pathname;
        const isWatchPage = path === '/watch';
        const isHomeOrBrowse = path === '/' || path.startsWith('/feed') || path.startsWith('/channel') || path.startsWith('/@') || path.startsWith('/c/');
        const isSearch = path === '/results';

        let css = '';

        if (isWatchPage) {
            // On the watch page: keep the player and primary info, hide suggestions and comments
            css += `
                /* Watch page: hide distractions only */
                ytd-watch-flexy #secondary,
                ytd-watch-flexy #related,
                ytd-watch-next-secondary-results-renderer,
                ytd-comments,
                ytd-engagement-panel-section-list-renderer {
                    display: none !important;
                }
            `;
        }

        if (isHomeOrBrowse || isSearch) {
            // On home, subscriptions, trending, channels, and search: hide video grids and shelves
            css += `
                /* Feed/Search pages: hide grids and shelves */
                ytd-rich-grid-renderer,
                ytd-rich-grid-row,
                ytd-rich-item-renderer,
                ytd-rich-section-renderer,
                ytd-rich-shelf-renderer,
                ytd-rich-grid-media {
                    display: none !important;
                }
            `;
        }

        // Shorts hiding everywhere
        css += `
            /* Hide Shorts everywhere */
            ytd-rich-section-renderer[is-shorts],
            ytd-rich-shelf-renderer[is-shorts],
            a[href="/shorts/"],
            a[href^="/shorts/"],
            ytd-guide-entry-renderer[title="Shorts"],
            ytd-mini-guide-entry-renderer[title="Shorts"],
            [title="Shorts"] {
                display: none !important;
            }
        `;

        style.textContent = css;
        
        // Inject immediately to prevent flash
        if (document.head) {
            document.head.appendChild(style);
        } else {
            // If head doesn't exist yet, wait for it
            document.addEventListener('DOMContentLoaded', () => {
                document.head.appendChild(style);
            });
        }
        
        console.log('Injected YouTube blocking CSS - path:', path);

        // Also use JavaScript to hide elements that CSS might miss
        setTimeout(() => {
            this.hideShortsWithJavaScript();
        }, 1000);
        
        // Debug: log what elements we're targeting
        setTimeout(() => {
            const videoGrid = document.querySelectorAll('ytd-rich-grid-renderer');
            const videoItems = document.querySelectorAll('ytd-rich-item-renderer');
            const videoSections = document.querySelectorAll('ytd-rich-section-renderer');
            const shortsLinks = document.querySelectorAll('a[href="/shorts/"]');
            const shortsButtons = document.querySelectorAll('[title="Shorts"]');
            const shortsElements = document.querySelectorAll('*');
            let shortsCount = 0;
            
            // Count elements containing "Shorts" text
            shortsElements.forEach(el => {
                if (el.textContent && el.textContent.includes('Shorts')) {
                    shortsCount++;
                }
            });
            
            console.log('YouTube: Found video grid elements:', videoGrid.length);
            console.log('YouTube: Found video items:', videoItems.length);
            console.log('YouTube: Found video sections:', videoSections.length);
            console.log('YouTube: Found Shorts links:', shortsLinks.length);
            console.log('YouTube: Found Shorts buttons:', shortsButtons.length);
            console.log('YouTube: Found elements with "Shorts" text:', shortsCount);
            
            // Log all Shorts-related elements for debugging
            shortsButtons.forEach((btn, index) => {
                if (index < 5) { // Only log first 5
                    console.log('YouTube: Shorts button element:', btn, btn.textContent);
                }
            });
            
            console.log('YouTube blocking active - all video content should be hidden');
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
        if (!this.isSessionActive) {
            // Do nothing if there is no active session
            return;
        }
        console.log('Using JavaScript to hide YouTube content elements');
        
        const path = window.location.pathname;
        const isWatchPage = path === '/watch';

        // Hide content based on page type
        const videoSelectors = isWatchPage
            ? [
                // On watch page, hide sidebar suggestions and comments only
                'ytd-watch-flexy #secondary',
                'ytd-watch-flexy #related',
                'ytd-watch-next-secondary-results-renderer',
                'ytd-comments',
                'ytd-engagement-panel-section-list-renderer'
              ]
            : [
                // On feeds/search/channels, hide grids and shelves
                'ytd-rich-grid-renderer',
                'ytd-rich-grid-row', 
                'ytd-rich-item-renderer',
                'ytd-rich-section-renderer',
                'ytd-rich-shelf-renderer',
                'ytd-rich-grid-media'
              ];
        
        videoSelectors.forEach(selector => {
            const elements = document.querySelectorAll(selector);
            elements.forEach(element => {
                element.style.display = 'none';
                console.log('Hidden YouTube element:', selector);
            });
        });
        
        // Hide Shorts navigation - more aggressive approach
        const shortsSelectors = [
            'a[href="/shorts/"]',
            'a[href^="/shorts/"]',
            'ytd-guide-entry-renderer[title="Shorts"]',
            'ytd-mini-guide-entry-renderer[title="Shorts"]'
        ];
        
        shortsSelectors.forEach(selector => {
            const elements = document.querySelectorAll(selector);
            elements.forEach(element => {
                element.style.display = 'none';
                console.log('Hidden Shorts element:', selector);
            });
        });
 
        // Also hide any element containing "Shorts" text
        const allElements = document.querySelectorAll('*');
        allElements.forEach(element => {
            if (element.textContent && element.textContent.includes('Shorts')) {
                // Check if it's in the navigation area
                if (element.closest('ytd-guide-entry-renderer') || 
                    element.closest('ytd-mini-guide-entry-renderer') ||
                    element.closest('nav') ||
                    element.closest('[role="navigation"]')) {
                    element.style.display = 'none';
                    console.log('Hidden Shorts text element:', element);
                }
            }
        });
 
        // Hide parent containers of Shorts elements
        const shortsElements = document.querySelectorAll('a[href="/shorts/"], a[href^="/shorts/"]');
        shortsElements.forEach(element => {
            const parent = element.closest('ytd-guide-entry-renderer, ytd-mini-guide-entry-renderer');
            if (parent) {
                parent.style.display = 'none';
                console.log('Hidden Shorts parent container:', parent);
            }
        });
 
        if (!isWatchPage) {
            // Additional cleanup only on non-watch pages
            const sidebarSelectors = [
                'ytd-watch-flexy #secondary',
                'ytd-watch-flexy #related',
                'ytd-watch-next-secondary-results-renderer'
            ];
            sidebarSelectors.forEach(selector => {
                const elements = document.querySelectorAll(selector);
                elements.forEach(element => {
                    element.style.display = 'none';
                    console.log('Hidden sidebar element:', selector);
                });
            });
        }
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
            
            if (shouldHideShorts && this.isSessionActive) {
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
            console.log('YouTube: Received focusSessionChanged message, checking session...');
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

