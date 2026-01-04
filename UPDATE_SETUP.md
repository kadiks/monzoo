# Auto-Updater Setup

The app includes automatic update checking from GitHub releases. Here's what you need to do:

## Configuration

Edit [electron/updater.js](electron/updater.js) and replace the placeholder values:

```javascript
autoUpdater.setFeedURL({
  provider: 'github',
  owner: 'your-username',      // ← Replace with your GitHub username
  repo: 'monzoo',               // ← Keep as 'monzoo' (or change if repo name differs)
});
```

## How It Works

1. **Automatic Checks**: The app checks for updates every 60 minutes
2. **Startup Check**: Updates are checked when the app starts
3. **Auto-Download**: If an update is available, it downloads automatically
4. **User Notification**: A dialog appears asking to restart and install
5. **GitHub Integration**: Fetches releases from your GitHub repository

## Release Requirements

For the auto-updater to work, your GitHub releases must include:
- **Proper version tag**: `v1.0.5` (matches package.json version)
- **macOS artifacts**: Include the `.dmg` or `.zip` files in the release
- **Release notes**: Automatically extracted from GitHub release notes

## Building for Updates

Use the version script to create releases:

```bash
npm run version 1.0.6
```

This will:
1. Update package.json
2. Commit the change
3. Create a git tag `v1.0.6`
4. Push everything to GitHub
5. Trigger GitHub Actions to build and create a release

## Testing Updates

To test the update feature locally:

1. Build the current version: `npm run build`
2. Bump version: `npm run version 1.0.1`
3. Check for updates in the app tray menu

## Troubleshooting

If updates aren't working:
- Verify your GitHub username and repo name in `updater.js`
- Ensure releases have proper version tags (`v1.0.5` format)
- Check that `.dmg` or `.zip` files are attached to releases
- Check the console logs for update check errors
