// Popup functionality for Focus Blocks
class PopupManager {
    constructor() {
        this.currentStatus = null;
        this.timerInterval = null;
        this.init();
    }

    async init() {
        try {
            await this.loadStatus();
            this.setupEventListeners();
            this.showContent();
        } catch (error) {
            console.error('Error initializing popup:', error);
            this.showError();
        }
    }

    async loadStatus() {
        try {
            const response = await chrome.runtime.sendMessage({ action: 'getStatus' });
            this.currentStatus = response;
            this.updateUI();
            this.loadStats();
        } catch (error) {
            console.error('Error loading status:', error);
            throw error;
        }
    }

    updateUI() {
        const statusDot = document.getElementById('statusDot');
        const timer = document.getElementById('timer');
        const sessionInfo = document.getElementById('sessionInfo');
        const endButton = document.getElementById('endSession');
        const quickFocusBtn = document.getElementById('quickFocus');
        const deepFocusBtn = document.getElementById('deepFocus');

        if (this.currentStatus.focusSessionActive && this.currentStatus.activeUntil) {
            // Active session
            statusDot.classList.add('active');
            endButton.disabled = false;
            quickFocusBtn.classList.add('active');
            deepFocusBtn.classList.remove('active');

            // Update timer
            this.updateTimer();
            
            // Start timer updates
            if (!this.timerInterval) {
                this.timerInterval = setInterval(() => this.updateTimer(), 1000);
            }
        } else {
            // No active session
            statusDot.classList.remove('active');
            timer.textContent = '--:--';
            sessionInfo.textContent = 'No active session';
            endButton.disabled = true;
            quickFocusBtn.classList.remove('active');
            deepFocusBtn.classList.remove('active');

            // Clear timer interval
            if (this.timerInterval) {
                clearInterval(this.timerInterval);
                this.timerInterval = null;
            }
        }
    }

    updateTimer() {
        if (!this.currentStatus.activeUntil) return;

        const now = Date.now();
        const timeLeft = this.currentStatus.activeUntil - now;

        if (timeLeft > 0) {
            const minutes = Math.floor(timeLeft / 60000);
            const seconds = Math.floor((timeLeft % 60000) / 1000);
            document.getElementById('timer').textContent = 
                `${minutes}:${seconds.toString().padStart(2, '0')}`;
            
            const endTime = new Date(this.currentStatus.activeUntil);
            document.getElementById('sessionInfo').textContent = 
                `Session ends at ${endTime.toLocaleTimeString()}`;
        } else {
            // Session has ended
            document.getElementById('timer').textContent = 'Session Ended';
            document.getElementById('sessionInfo').textContent = 'Great job! Session completed.';
            this.loadStatus(); // Refresh status
        }
    }

    async loadStats() {
        try {
            const data = await chrome.storage.local.get(['stats']);
            const stats = data.stats || { 
                totalMinutesSaved: 0, 
                todayMinutesSaved: 0, 
                sessionsCompleted: 0 
            };

            if (stats.todayMinutesSaved > 0 || stats.sessionsCompleted > 0) {
                document.getElementById('timeSaved').textContent = stats.todayMinutesSaved;
                document.getElementById('sessionsCompleted').textContent = stats.sessionsCompleted;
                document.getElementById('stats').style.display = 'block';
            }
        } catch (error) {
            console.error('Error loading stats:', error);
        }
    }

    setupEventListeners() {
        // Focus session buttons
        document.getElementById('quickFocus').addEventListener('click', (event) => {
            this.startFocusSession(25, 'deep_work', event);
        });

        document.getElementById('deepFocus').addEventListener('click', (event) => {
            this.startFocusSession(90, 'deep_work', event);
        });

        // End session button
        document.getElementById('endSession').addEventListener('click', () => {
            this.endFocusSession();
        });

        // Quick actions
        document.getElementById('openOptions').addEventListener('click', () => {
            chrome.runtime.openOptionsPage();
        });

        document.getElementById('viewStats').addEventListener('click', () => {
            this.showStats();
        });
    }

    async startFocusSession(duration, blocklist, event) {
        let button = null;
        try {
            if (event && event.target) {
                button = event.target.closest('.focus-button');
            }
            if (button) {
                button.disabled = true;
                button.textContent = 'Starting...';
            }

            const response = await chrome.runtime.sendMessage({
                action: 'startFocusSession',
                duration: duration,
                blocklist: blocklist
            });

            if (response.success) {
                await this.loadStatus();
                this.showSuccessMessage(`Focus session started for ${duration} minutes`);
            } else {
                throw new Error(response.error || 'Failed to start focus session');
            }
        } catch (error) {
            console.error('Error starting focus session:', error);
            this.showErrorMessage('Failed to start focus session');
        } finally {
            if (button) {
                button.disabled = false;
                button.innerHTML = `
                    <span class="duration">${duration}m</span>
                    <span class="label">${duration === 25 ? 'Quick Focus' : 'Deep Focus'}</span>
                `;
            }
        }
    }

    async endFocusSession() {
        try {
            const button = document.getElementById('endSession');
            button.disabled = true;
            button.textContent = 'Ending...';

            const response = await chrome.runtime.sendMessage({
                action: 'endFocusSession'
            });

            if (response.success) {
                await this.loadStatus();
                this.showSuccessMessage('Focus session ended');
            } else {
                throw new Error(response.error || 'Failed to end focus session');
            }
        } catch (error) {
            console.error('Error ending focus session:', error);
            this.showErrorMessage('Failed to end focus session');
        } finally {
            const button = document.getElementById('endSession');
            button.disabled = false;
            button.textContent = 'End Focus Session';
        }
    }

    showStats() {
        // For now, just open the options page to the stats tab
        chrome.runtime.openOptionsPage();
    }

    showContent() {
        document.getElementById('loading').style.display = 'none';
        document.getElementById('content').style.display = 'block';
    }

    showError() {
        document.getElementById('loading').style.display = 'none';
        document.getElementById('error').style.display = 'block';
    }

    showSuccessMessage(message) {
        // Create a temporary success message
        const successDiv = document.createElement('div');
        successDiv.style.cssText = `
            position: fixed;
            top: 10px;
            left: 50%;
            transform: translateX(-50%);
            background: #48bb78;
            color: white;
            padding: 0.75rem 1rem;
            border-radius: 8px;
            font-size: 0.9rem;
            z-index: 1000;
            box-shadow: 0 4px 12px rgba(0, 0, 0, 0.15);
        `;
        successDiv.textContent = message;
        
        document.body.appendChild(successDiv);
        
        setTimeout(() => {
            successDiv.remove();
        }, 3000);
    }

    showErrorMessage(message) {
        // Create a temporary error message
        const errorDiv = document.createElement('div');
        errorDiv.style.cssText = `
            position: fixed;
            top: 10px;
            left: 50%;
            transform: translateX(-50%);
            background: #f56565;
            color: white;
            padding: 0.75rem 1rem;
            border-radius: 8px;
            font-size: 0.9rem;
            z-index: 1000;
            box-shadow: 0 4px 12px rgba(0, 0, 0, 0.15);
        `;
        errorDiv.textContent = message;
        
        document.body.appendChild(errorDiv);
        
        setTimeout(() => {
            errorDiv.remove();
        }, 3000);
    }
}

// Initialize popup when DOM is loaded
document.addEventListener('DOMContentLoaded', () => {
    new PopupManager();
});
