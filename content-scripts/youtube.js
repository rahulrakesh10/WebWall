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

            const data = await chrome.storage.sync.get(['activeFocusSession', 'isDeepFocus']);
            const hasActiveSession = data.activeFocusSession && data.activeFocusSession.endTime > Date.now();
            const isDeepFocus = data.isDeepFocus || false;

            console.log('YouTube: Focus session check', { hasActiveSession, isDeepFocus });

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
        
        // Only apply blocking CSS on the homepage
        if (!this.isHomePage()) {
            console.log('Not on homepage, skipping blocking CSS');
            return;
        }
        
        // Create and inject CSS
        const style = document.createElement('style');
        style.id = 'webwall-blocking-css';
        style.textContent = `
            /* Completely block YouTube homepage with overlay */
            
            /* Target the main content area */
            ytd-page-manager,
            ytd-browse[page-subtype="home"] {
                position: relative !important;
            }
            
            /* Create a full-screen blocking overlay */
            ytd-page-manager::before,
            ytd-browse[page-subtype="home"]::before {
                content: "" !important;
                position: fixed !important;
                top: 0 !important;
                left: 0 !important;
                right: 0 !important;
                bottom: 0 !important;
                background: linear-gradient(135deg, #1a1a1a 0%, #2d2d2d 100%) !important;
                z-index: 999999 !important;
                pointer-events: auto !important;
            }
            
            /* Add blocking message overlay */
            ytd-page-manager::after,
            ytd-browse[page-subtype="home"]::after {
                content: "🎯 Focus Session Active\\A\\A YouTube homepage is blocked\\A to help you stay focused.\\A\\A You can still access specific videos\\A by searching or using direct links." !important;
                position: fixed !important;
                top: 50% !important;
                left: 50% !important;
                transform: translate(-50%, -50%) !important;
                z-index: 1000000 !important;
                pointer-events: none !important;
                text-align: center !important;
                font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif !important;
                color: white !important;
                font-size: 18px !important;
                line-height: 1.6 !important;
                max-width: 450px !important;
                background: rgba(0, 0, 0, 0.9) !important;
                padding: 30px 40px !important;
                border-radius: 12px !important;
                backdrop-filter: blur(10px) !important;
                box-shadow: 0 8px 32px rgba(0, 0, 0, 0.3) !important;
                border: 1px solid rgba(255, 255, 255, 0.1) !important;
                white-space: pre-line !important;
            }
            
            /* Hide specific distracting navigation elements */
            a[href="/shorts/"] { display: none !important; }
            a[href^="/shorts/"] { display: none !important; }
            [aria-label="Shorts"] { display: none !important; }
            [data-testid="shorts-tab"] { display: none !important; }
            ytd-guide-entry-renderer[title="Shorts"] { display: none !important; }
            
            /* Hide Shorts in sidebar navigation */
            ytd-guide-entry-renderer[title="Shorts"],
            ytd-guide-entry-renderer[aria-label*="Shorts"] { display: none !important; }
            
            /* Prevent any interaction with video content */
            ytd-rich-grid-renderer,
            ytd-rich-grid-row,
            ytd-rich-item-renderer,
            ytd-rich-item-renderer * {
                pointer-events: none !important;
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
        
        console.log('Injected comprehensive blocking CSS for YouTube homepage');
        
        // Debug: log what elements we're targeting
        setTimeout(() => {
            const pageManager = document.querySelectorAll('ytd-page-manager');
            const browseHome = document.querySelectorAll('ytd-browse[page-subtype="home"]');
            const richGrid = document.querySelectorAll('ytd-rich-grid-renderer');
            const richItems = document.querySelectorAll('ytd-rich-item-renderer');
            const sidebarShorts = document.querySelectorAll('ytd-guide-entry-renderer[title="Shorts"]');
            
            console.log('Found page manager:', pageManager.length);
            console.log('Found browse home:', browseHome.length);
            console.log('Found rich grid:', richGrid.length);
            console.log('Found rich items:', richItems.length);
            console.log('Found sidebar Shorts:', sidebarShorts.length);
            
            // Log what we're blocking
            console.log('Blocking entire main content area to prevent distractions');
        }, 1000);
    }

    removeBlockingCSS() {
        const existingStyle = document.getElementById('webwall-blocking-css');
        if (existingStyle) {
            existingStyle.remove();
            console.log('Removed YouTube blocking CSS');
        }
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
        return path === '/' || path === '/feed/subscriptions' || path === '/feed/trending';
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
        `;
        
        prompt.innerHTML = `
            <h3>Deep Focus Activated</h3>
            <p>This site is now blocked. The page will refresh automatically in 3 seconds.</p>
            <div style="margin-top: 15px;">
                <button id="refresh-now" style="background: #667eea; color: white; border: none; padding: 8px 16px; border-radius: 4px; margin-right: 10px; cursor: pointer;">Refresh Now</button>
                <button id="refresh-later" style="background: #666; color: white; border: none; padding: 8px 16px; border-radius: 4px; cursor: pointer;">Refresh Later</button>
            </div>
        `;
        
        document.body.appendChild(prompt);
        
        // Auto-refresh after 3 seconds
        const autoRefresh = setTimeout(() => {
            window.location.reload();
        }, 3000);
        
        // Manual refresh button
        document.getElementById('refresh-now').addEventListener('click', () => {
            clearTimeout(autoRefresh);
            window.location.reload();
        });
        
        // Cancel button
        document.getElementById('refresh-later').addEventListener('click', () => {
            clearTimeout(autoRefresh);
            document.body.removeChild(prompt);
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
                    // Fallback: create the prompt directly
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
                    `;
                    
                    prompt.innerHTML = `
                        <h3>Deep Focus Activated</h3>
                        <p>This site is now blocked. The page will refresh automatically in 3 seconds.</p>
                        <div style="margin-top: 15px;">
                            <button id="refresh-now" style="background: #667eea; color: white; border: none; padding: 8px 16px; border-radius: 4px; margin-right: 10px; cursor: pointer;">Refresh Now</button>
                            <button id="refresh-later" style="background: #666; color: white; border: none; padding: 8px 16px; border-radius: 4px; cursor: pointer;">Refresh Later</button>
                        </div>
                    `;
                    
                    document.body.appendChild(prompt);
                    
                    // Auto-refresh after 3 seconds
                    const autoRefresh = setTimeout(() => {
                        window.location.reload();
                    }, 3000);
                    
                    // Manual refresh button
                    document.getElementById('refresh-now').addEventListener('click', () => {
                        clearTimeout(autoRefresh);
                        window.location.reload();
                    });
                    
                    // Cancel button
                    document.getElementById('refresh-later').addEventListener('click', () => {
                        clearTimeout(autoRefresh);
                        document.body.removeChild(prompt);
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
