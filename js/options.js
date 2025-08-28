// Options page functionality for Focus Blocks
class OptionsManager {
    constructor() {
        this.currentTab = 'blocklists';
        this.editingScheduleId = null;
        this.init();
    }

    async init() {
        this.setupTabNavigation();
        this.setupEventListeners();
        await this.loadData();
        this.renderBlocklists();
        this.renderSchedules();
        this.loadSettings();
    }

    setupTabNavigation() {
        const tabs = document.querySelectorAll('.tab');
        const tabContents = document.querySelectorAll('.tab-content');

        tabs.forEach(tab => {
            tab.addEventListener('click', () => {
                const targetTab = tab.dataset.tab;
                this.switchTab(targetTab);
            });
        });
    }

    switchTab(tabName) {
        // Update active tab
        document.querySelectorAll('.tab').forEach(tab => {
            tab.classList.toggle('active', tab.dataset.tab === tabName);
        });

        // Update active content
        document.querySelectorAll('.tab-content').forEach(content => {
            content.classList.toggle('active', content.id === tabName);
        });

        this.currentTab = tabName;
    }

    setupEventListeners() {
        // Schedule form events
        document.getElementById('saveSchedule').addEventListener('click', () => {
            this.saveSchedule();
        });

        document.getElementById('clearSchedule').addEventListener('click', () => {
            this.clearScheduleForm();
        });

        // Settings toggles
        this.setupToggleListeners();
    }

    setupToggleListeners() {
        const toggles = document.querySelectorAll('.toggle-switch');
        toggles.forEach(toggle => {
            toggle.addEventListener('click', () => {
                toggle.classList.toggle('active');
                this.saveSettings();
            });
        });



        // Duration inputs
        document.getElementById('quickFocusDuration').addEventListener('change', () => {
            this.saveSettings();
        });

        document.getElementById('deepFocusDuration').addEventListener('change', () => {
            this.saveSettings();
        });
    }

    async loadData() {
        try {
            const data = await chrome.storage.sync.get(['lists', 'schedules', 'settings']);
            this.lists = data.lists || {};
            this.schedules = data.schedules || [];
            this.settings = data.settings || {};
        } catch (error) {
            console.error('Error loading data:', error);
        }
    }

    renderBlocklists() {
        const grid = document.getElementById('blocklistGrid');
        grid.innerHTML = '';

        Object.entries(this.lists).forEach(([name, sites]) => {
            const card = this.createBlocklistCard(name, sites);
            grid.appendChild(card);
        });
    }

    createBlocklistCard(name, sites) {
        const card = document.createElement('div');
        card.className = 'blocklist-card';
        
        const descriptions = {
            workday: 'Block social media during work hours',
            deep_work: 'Block all distracting sites for deep focus',
            social_media: 'Block social media platforms only'
        };

        card.innerHTML = `
            <h3>${name.replace('_', ' ').replace(/\b\w/g, l => l.toUpperCase())}</h3>
            <p class="description">${descriptions[name] || 'Custom blocklist'}</p>
            <div class="site-list">
                ${sites.map(site => `
                    <div class="site-item">
                        <span class="site-name">${this.formatSiteName(site)}</span>
                        <button class="remove-btn" data-list="${name}" data-site="${site}">Remove</button>
                    </div>
                `).join('')}
            </div>
            <div class="add-site-form">
                <input type="text" placeholder="Add site (e.g., *.youtube.com/*)" data-list="${name}">
                <button onclick="optionsManager.addSite('${name}', this.previousElementSibling)">Add</button>
            </div>
        `;

        // Add event listeners for remove buttons
        card.querySelectorAll('.remove-btn').forEach(btn => {
            btn.addEventListener('click', () => {
                this.removeSite(btn.dataset.list, btn.dataset.site);
            });
        });

        return card;
    }

    formatSiteName(site) {
        return site.replace('*://*.', '').replace('/*', '').replace('*://', '');
    }

    async addSite(listName, inputElement) {
        const site = inputElement.value.trim();
        if (!site) return;

        if (!this.lists[listName]) {
            this.lists[listName] = [];
        }

        // Format the site pattern
        let formattedSite = site;
        if (!site.startsWith('*://')) {
            if (site.includes('://')) {
                formattedSite = `*://${site.split('://')[1]}`;
            } else {
                formattedSite = `*://*.${site}`;
            }
        }
        if (!formattedSite.endsWith('/*')) {
            formattedSite += '/*';
        }

        this.lists[listName].push(formattedSite);
        await this.saveLists();
        this.renderBlocklists();
        inputElement.value = '';
    }

    async removeSite(listName, site) {
        if (this.lists[listName]) {
            this.lists[listName] = this.lists[listName].filter(s => s !== site);
            await this.saveLists();
            this.renderBlocklists();
        }
    }

    async saveLists() {
        try {
            await chrome.storage.sync.set({ lists: this.lists });
            await chrome.runtime.sendMessage({ action: 'updateBlocklist', lists: this.lists });
            this.showSaveMessage();
        } catch (error) {
            console.error('Error saving lists:', error);
        }
    }

    renderSchedules() {
        const container = document.getElementById('scheduleList');
        container.innerHTML = '';

        this.schedules.forEach(schedule => {
            const item = this.createScheduleItem(schedule);
            container.appendChild(item);
        });
    }

    createScheduleItem(schedule) {
        const item = document.createElement('div');
        item.className = 'schedule-item';
        
        const days = this.formatDays(schedule.days);
        const timeRange = `${schedule.start} - ${schedule.end}`;

        item.innerHTML = `
            <div class="schedule-info">
                <h4>${schedule.name}</h4>
                <p>${days} • ${timeRange} • ${schedule.list}</p>
            </div>
            <div class="schedule-toggle ${schedule.enabled ? 'active' : ''}" data-id="${schedule.id}"></div>
        `;

        // Add event listeners
        const toggle = item.querySelector('.schedule-toggle');
        toggle.addEventListener('click', () => {
            this.toggleSchedule(schedule.id);
        });

        return item;
    }

    formatDays(days) {
        const dayNames = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
        return days.map(day => dayNames[day]).join(', ');
    }

    async saveSchedule() {
        const name = document.getElementById('scheduleName').value.trim();
        const list = document.getElementById('scheduleList').value;
        const startTime = document.getElementById('startTime').value;
        const endTime = document.getElementById('endTime').value;
        
        const selectedDays = Array.from(document.querySelectorAll('.days-selector input:checked'))
            .map(cb => parseInt(cb.value));

        if (!name || selectedDays.length === 0) {
            alert('Please fill in all required fields');
            return;
        }

        const schedule = {
            id: this.editingScheduleId || Date.now().toString(),
            name,
            list,
            days: selectedDays,
            start: startTime,
            end: endTime,
            enabled: true
        };

        if (this.editingScheduleId) {
            const index = this.schedules.findIndex(s => s.id === this.editingScheduleId);
            if (index !== -1) {
                this.schedules[index] = schedule;
            }
        } else {
            this.schedules.push(schedule);
        }

        await this.saveSchedules();
        this.renderSchedules();
        this.clearScheduleForm();
    }

    async saveSchedules() {
        try {
            await chrome.storage.sync.set({ schedules: this.schedules });
            await chrome.runtime.sendMessage({ action: 'updateSchedules', schedules: this.schedules });
            this.showSaveMessage();
        } catch (error) {
            console.error('Error saving schedules:', error);
        }
    }

    async toggleSchedule(scheduleId) {
        const schedule = this.schedules.find(s => s.id === scheduleId);
        if (schedule) {
            schedule.enabled = !schedule.enabled;
            await this.saveSchedules();
            this.renderSchedules();
        }
    }

    clearScheduleForm() {
        document.getElementById('scheduleName').value = '';
        document.getElementById('scheduleList').value = 'workday';
        document.getElementById('startTime').value = '09:00';
        document.getElementById('endTime').value = '17:00';
        document.querySelectorAll('.days-selector input').forEach(cb => cb.checked = false);
        this.editingScheduleId = null;
    }

    loadSettings() {
        // Load toggle states
        const toggles = {
            notificationsToggle: this.settings.enableNotifications,
            sessionAlertsToggle: this.settings.sessionAlerts,
            bypassHoldToggle: this.settings.bypassRequiresHold
        };

        Object.entries(toggles).forEach(([id, value]) => {
            const toggle = document.getElementById(id);
            if (toggle && value) {
                toggle.classList.add('active');
            }
        });



        // Load duration inputs
        const quickFocusDuration = document.getElementById('quickFocusDuration');
        const deepFocusDuration = document.getElementById('deepFocusDuration');
        
        if (quickFocusDuration && this.settings.quickFocusDuration) {
            quickFocusDuration.value = this.settings.quickFocusDuration;
        }
        
        if (deepFocusDuration && this.settings.deepFocusDuration) {
            deepFocusDuration.value = this.settings.deepFocusDuration;
        }
    }

    async saveSettings() {
        const settings = {
            enableNotifications: document.getElementById('notificationsToggle').classList.contains('active'),
            sessionAlerts: document.getElementById('sessionAlertsToggle').classList.contains('active'),
            bypassRequiresHold: document.getElementById('bypassHoldToggle').classList.contains('active'),
            quickFocusDuration: parseInt(document.getElementById('quickFocusDuration').value) || 25,
            deepFocusDuration: parseInt(document.getElementById('deepFocusDuration').value) || 90
        };

        try {
            await chrome.storage.sync.set({ settings });
            this.settings = settings;
            this.showSaveMessage();
        } catch (error) {
            console.error('Error saving settings:', error);
        }
    }





    showSaveMessage() {
        const message = document.getElementById('saveMessage');
        message.classList.add('show');
        setTimeout(() => {
            message.classList.remove('show');
        }, 3000);
    }
}

// Initialize options manager
let optionsManager;

document.addEventListener('DOMContentLoaded', () => {
    optionsManager = new OptionsManager();
});
