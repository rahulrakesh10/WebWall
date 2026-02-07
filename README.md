# WebWall - Browser Extension

A powerful browser extension that helps you stay focused by blocking distracting websites and elements. Built with Manifest V3 for Chrome, Edge, and Firefox.

## Features

### 🎯 **Whole-Site Blocking**
- Block entire websites using declarative net request (DNR)
- Redirect blocked sites to a beautiful focus page
- Customizable blocklists for different scenarios

### ⏰ **Focus Sessions**
- Quick Focus for short bursts of productivity
- Deep Work for extended focus periods
- Custom duration sessions
- Automatic session management with countdown timers

### 📅 **Smart Schedules**
- Set up recurring focus sessions (e.g., work hours)
- Day-of-week scheduling
- Automatic start/stop based on time
- Multiple schedule support

### 🎨 **Granular Element Blocking**
- **Instagram**: Block home feed, Reels, Stories, Explore,  allowed to see stories
- **YouTube**: Block Shorts, home feed,  allowed to see searched videos
- **Reddit**: Block r/all, popular posts, trending communities, allowed to see searched posts
- **Twitter/X**: Block home timeline, trending topics, who to follow

### 🔧 **Advanced Features**
- Hold-to-bypass functionality (3-second hold)
- Focus statistics and progress tracking
- Cross-browser sync for settings
- Beautiful, modern UI
- Accessibility-friendly design

## Installation

### Chrome/Edge
1. Download or clone this repository
2. Open Chrome/Edge and go to `chrome://extensions/`
3. Enable "Developer mode" in the top right
4. Click "Load unpacked" and select the extension folder
5. The extension icon should appear in your toolbar

### Firefox
1. Download or clone this repository
2. Open Firefox and go to `about:debugging`
3. Click "This Firefox" in the sidebar
4. Click "Load Temporary Add-on" and select the `manifest.json` file
5. The extension will be installed temporarily (reload after browser restart)

## Usage

### Quick Start
1. Click the Focus Blocks icon in your toolbar
2. Choose "Quick Focus" (25m) or "Deep Work" (90m)
3. Distracting sites will be automatically blocked
4. Use the hold-to-bypass feature if you need urgent access

### Managing Blocklists
1. Click the extension icon → "Settings"
2. Go to the "Blocklists" tab
3. Edit existing lists or add new sites
4. Sites use pattern matching (e.g., `*.youtube.com/*`)

### Setting Up Schedules
1. Go to Settings → "Schedules" tab
2. Click "Add Schedule"
3. Choose days, times, and blocklist
4. Enable/disable schedules as needed

### Customizing Site Blocking
1. Go to Settings → "Settings" tab
2. Configure Instagram, YouTube, Reddit, and Twitter options
3. Toggle specific features on/off
4. Settings are automatically saved

## Architecture

### Core Components

#### Background Service Worker (`background.js`)
- Manages declarative net request rules
- Handles focus sessions and schedules
- Coordinates with content scripts
- Manages alarms for automatic scheduling

#### Content Scripts
- **Instagram**: Blocks feed, Reels, Stories, Explore
- **YouTube**: Blocks Shorts, home feed, trending
- **Reddit**: Blocks r/all, popular posts, trending
- **Twitter**: Blocks timeline, trending, who to follow

#### UI Components
- **Popup**: Quick session controls and status
- **Options Page**: Full settings and management
- **Blocked Page**: Beautiful focus page with bypass

### Data Storage
- **Chrome Storage Sync**: Settings, blocklists, schedules
- **Chrome Storage Local**: Statistics, bypass logs
- **Declarative Net Request**: Dynamic blocking rules

## Configuration

### Blocklist Patterns
Use URL patterns to specify sites to block:
- `*://*.instagram.com/*` - All Instagram pages
- `*://*.youtube.com/shorts/*` - YouTube Shorts only
- `*://*.reddit.com/r/all/*` - Reddit r/all only

### Focus Session Types
- **Quick Focus**: 25 minutes, ideal for short tasks
- **Deep Work**: 90 minutes, for extended focus
- **Custom**: User-defined duration

### Schedule Options
- **Days**: Monday-Sunday selection
- **Times**: Start and end times (24-hour format)
- **Blocklist**: Which sites to block during schedule

## Development

### Project Structure
```
Focus-Blocks/
├── manifest.json          # Extension manifest
├── background.js          # Service worker
├── popup.html            # Popup interface
├── popup.js              # Popup functionality
├── options.html          # Settings page
├── options.js            # Settings functionality
├── blocked.html          # Blocked page
├── rules.json            # Static DNR rules
├── content-scripts/      # Site-specific blockers
│   ├── instagram.js
│   ├── youtube.js
│   ├── reddit.js
│   └── twitter.js
└── js/                   # Shared JavaScript
    ├── popup.js
    └── options.js
```

### Adding New Sites
1. Create a new content script in `content-scripts/`
2. Add site patterns to `manifest.json` content_scripts
3. Implement blocking logic similar to existing scripts
4. Add configuration options to the options page

### Building for Distribution
1. Test thoroughly in development mode
2. Create a ZIP file of the extension folder
3. Submit to Chrome Web Store or Firefox Add-ons

## Privacy & Security

- **No external telemetry**: All data stays local
- **No tracking**: Extension doesn't collect personal information
- **Open source**: Code is transparent and auditable
- **Minimal permissions**: Only requests necessary permissions

## Browser Compatibility

- **Chrome**: 88+ (Manifest V3)
- **Edge**: 88+ (Manifest V3)
- **Firefox**: 109+ (Manifest V3 support)
## Support

For issues, feature requests, or questions:
1. Check the existing issues
2. Create a new issue with details
3. Include browser version and extension version


**Stay focused, stay productive! 🧱**
