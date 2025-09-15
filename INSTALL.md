# Installation Guide

## Prerequisites

- **Chrome**: Version 88 or later
- **Edge**: Version 88 or later  
- **Firefox**: Version 109 or later

## Installation Steps

### Method 1: Install with GitHub (Recommended)

This is the easiest way to keep the extension up to date.

1. **Clone the repository**
   - If you have Git installed: `git clone https://github.com/<your-username>/WebWall.git`
   - Or use GitHub Desktop: File → Clone repository → paste the repo URL
2. **Open the Extensions page** (Chrome/Edge)
   - Go to `chrome://extensions/`
   - Toggle "Developer mode" (top-right)
3. **Load the extension**
   - Click "Load unpacked"
   - Select the folder you cloned (the one that contains `manifest.json`)
4. **Pin the extension** (optional)
   - Click the puzzle icon → pin "WebWall"

Updates later:
- Open the repo folder and run `git pull` (or GitHub Desktop → Pull)
- Go back to `chrome://extensions/` and click the refresh icon on the WebWall card (or toggle it off/on)

### Method 2: Install without GitHub (Download ZIP)

#### Chrome/Edge
1. **Download the Extension**
   - Click "Code" → "Download ZIP" on the GitHub repository page
   - Extract the ZIP to a folder on your computer
2. **Open Extensions Page**
   - Open Chrome/Edge
   - Navigate to `chrome://extensions/`
   - Or go to Menu → More Tools → Extensions
3. **Enable Developer Mode**
   - Toggle the "Developer mode" switch in the top-right corner
4. **Load the Extension**
   - Click "Load unpacked"
   - Select the folder containing the extracted extension files (must include `manifest.json`)
   - The extension should now appear in your extensions list
5. **Pin the Extension** (optional)
   - Click the puzzle piece icon in the toolbar
   - Find "WebWall" and click the pin icon

#### Firefox
1. **Download the Extension**
   - Download this repository as a ZIP file
   - Extract it to a folder on your computer
2. **Open Debugging Page**
   - Open Firefox
   - Navigate to `about:debugging`
   - Click "This Firefox" in the sidebar
3. **Load Temporary Add-on**
   - Click "Load Temporary Add-on"
   - Select the `manifest.json` file from the extension folder
   - The extension will be installed temporarily

**Note**: Firefox temporary add-ons are removed when you restart the browser. For permanent installation, see Method 3.

### Method 3: Web Store Installation (When Available)

#### Chrome Web Store
1. Visit the Chrome Web Store (link will be provided when published)
2. Click "Add to Chrome"
3. Confirm the installation
4. The extension will be automatically installed and pinned

#### Firefox Add-ons
1. Visit Firefox Add-ons (link will be provided when published)
2. Click "Add to Firefox"
3. Confirm the installation
4. The extension will be automatically installed

## First-Time Setup

1. **Click the Extension Icon**
   - Look for the WebWall icon in your toolbar
   - Click it to open the popup

2. **Grant Permissions**
   - The extension may request permissions for:
     - Storage (for settings and data)
     - Declarative Net Request (for site blocking)
     - Alarms (for scheduled sessions)
   - Click "Allow" for all requested permissions

3. **Configure Your Blocklists**
   - Click "Settings" in the popup
   - Go to the "Blocklists" tab
   - Review and customize the default blocklists
   - Add any additional sites you want to block

4. **Set Up Schedules (Optional)**
   - Go to the "Schedules" tab
   - Create recurring focus sessions
   - Set times and days for automatic blocking

## Testing the Extension

1. **Start a Focus Session**
   - Click the extension icon
   - Choose "Quick Focus" (25 minutes) or "Deep Focus" (90 minutes)
   - You should see a confirmation message

2. **Test Site Blocking**
   - Try visiting a blocked site (e.g., instagram.com)
   - For Deep Focus you should be redirected to the blocked page
   - For Quick Focus the page elements will be hidden

3. **Test Bypass Function**
   - On the blocked page, hold the "Hold to Bypass" button for 10 seconds
   - You should be redirected to the original site
   - This bypass is logged for accountability

## Troubleshooting

### Extension Not Loading
- **Check browser version**: Ensure you're using a supported browser version
- **Verify files**: Make sure all extension files are present in the folder
- **Check console**: Open browser developer tools and look for errors
- **Restart browser**: Try restarting your browser and loading again

### Sites Not Being Blocked
- **Check permissions**: Ensure the extension has all required permissions
- **Verify blocklists**: Check that sites are in your active blocklists
- **Check focus session**: Make sure a focus session is active
- **Clear cache**: Try clearing your browser cache and cookies

### Extension Crashes
- **Disable other extensions**: Some extensions may conflict
- **Check for updates**: Ensure you have the latest version
- **Report issues**: Create an issue on the GitHub repository

### Firefox-Specific Issues
- **Temporary installation**: Remember that Firefox temporary add-ons are removed on restart
- **Permissions**: Firefox may require additional permission grants
- **Compatibility**: Some features may work differently in Firefox

## Uninstalling

### Chrome/Edge
1. Go to `chrome://extensions/`
2. Find "WebWall"
3. Click "Remove"
4. Confirm the removal

### Firefox
1. Go to `about:addons`
2. Find "WebWall"
3. Click "Remove"
4. Confirm the removal

## Support

If you encounter issues:
1. Check this troubleshooting guide
2. Search existing issues on GitHub
3. Create a new issue with:
   - Browser and version
   - Extension version
   - Steps to reproduce
   - Error messages (if any)

## Privacy Note

This extension:
- Stores all data locally on your device
- Does not send any data to external servers
- Only requests permissions necessary for functionality
- Is open source and auditable

Your privacy and data security are our top priorities.
