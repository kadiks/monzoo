# MonZoo Bot

A macOS menu bar application that automates MonZoo game management tasks.

## Features

- **Automated Stock Management**: Checks and refills animal food and boutique items (gifts, fries, drinks, ice creams)
- **Enclosure Care**: Monitors and tends to enclosures that need attention
- **Smart Scheduling**: Runs twice daily (AM/PM windows) at configurable times
- **Secure Credentials**: Password stored in macOS Keychain
- **Live Logs**: View real-time and historical logs from within the app
- **Menu Bar Integration**: Runs silently in the background with status updates

## Installation

### Download Pre-built App (Recommended)

1. Go to the [Releases page](https://github.com/kadiks/monzoo/releases)
2. Download the latest `MonZoo.Bot-X.X.X.dmg`
3. Open the DMG and drag "MonZoo Bot" to Applications
4. Follow the steps in "Installing on Another Mac" below to bypass Gatekeeper

### Build the App Yourself

1. Install dependencies:
```bash
npm install
```

2. Build the macOS app:
```bash
npm run build
```

3. The built app will be in the `dist` folder. Install it:
   - Open `dist/MonZoo Bot.dmg`
   - Drag "MonZoo Bot" to your Applications folder
   - Launch from Applications

### Installing on Another Mac (Unsigned App)

Since the app is not codesigned with an Apple Developer certificate, macOS Gatekeeper will show a security warning on first launch.

**To open the app for the first time:**

1. After dragging to Applications, **don't double-click** to open
2. Instead, **right-click** (or Control-click) on "MonZoo Bot" in Applications
3. Select **"Open"** from the menu
4. In the dialog that appears, click **"Open"** again
5. The app will launch and won't show the warning again

**Alternative method:**
1. Try to open the app normally (you'll see the warning)
2. Go to **System Settings → Privacy & Security**
3. Scroll down to the Security section
4. Click **"Open Anyway"** next to the MonZoo Bot message
5. Confirm by clicking **"Open"**

**Note:** This only needs to be done once per Mac. After the first successful launch, the app will open normally.

### First-Time Setup

1. After launching, click the MonZoo icon in your menu bar
2. Select "Preferences…"
3. Enter your MonZoo username and password
4. Configure schedule settings:
   - **Run minute**: Which minute of each hour to check (default: 10)
   - **AM start hour**: When the AM window begins (default: 0 = midnight)
   - **PM start hour**: When the PM window begins (default: 14 = 2pm)
5. Click "Save"

The app will automatically:
- Start when you log in to macOS
- Run at the configured minute each hour
- Only execute twice per day (once in AM window, once in PM window)

## Usage

### Menu Bar Actions

- **Status**: Shows whether the bot is currently running or idle
- **Next run**: Displays when the next scheduled run will occur
- **Preferences…**: Configure credentials and schedule
- **Logs…**: View real-time and last-run logs
- **Run now**: Force an immediate run (bypasses schedule)
- **Last actions**: Shows recent activity with timestamps
- **Quit**: Exit the application

### Schedule Logic

The bot divides each day into two windows:
- **AM Window**: From AM start hour to 13:59 (default: 00:00-13:59)
- **PM Window**: From PM start hour to 23:59 (default: 14:00-23:59)

Each window, the bot will run **once** at the first scheduled opportunity (HH:MM where MM is your configured minute). If it's already run in the current window, subsequent scheduled checks will skip until the next window.

### Logs Window

The Logs window shows:
- All logs from the most recent run (persisted)
- Live logs if a run is currently active
- Colored output matching terminal colors
- Controls to Pause/Resume streaming or Clear the view

## Development

### Run in Development Mode
```bash
npm run app
```

### Run Tests
```bash
npm test
```

### Run CLI (without Electron)
```bash
npm run cli
```

## Requirements

- macOS
- Node.js 18+
- MonZoo account credentials

## Files & Data

- **Settings**: `~/Library/Application Support/monzoo/settings.json`
- **State/History**: `~/Library/Application Support/monzoo/run-state.json`
- **Last Run Logs**: `~/Library/Application Support/monzoo/logs/last-run.json`
- **Password**: Stored securely in macOS Keychain

## Troubleshooting

**App doesn't start at login:**
- Check System Settings → General → Login Items
- MonZoo Bot should be listed and enabled

**Can't see logs or colors:**
- Ensure you've run at least once
- Reopen the Logs window

**Scheduled runs not happening:**
- Check Preferences → ensure "Enable hourly schedule" is checked
- Verify you haven't already run in the current window (check "Last actions")

**Credentials not working:**
- Re-enter password in Preferences (it will update the Keychain)
- Ensure your MonZoo account credentials are correct

## License

ISC
