import { app, dialog, ipcMain } from 'electron';

import { autoUpdater } from 'electron-updater';
import chalk from 'chalk';

let updateAvailable = false;
let updateDownloaded = false;

export const initAutoUpdater = (mainWindow) => {
  // Configure auto-updater
  autoUpdater.autoDownload = false;
  autoUpdater.autoInstallOnAppQuit = true;

  // Set up repository info for GitHub
  // Format: owner/repo (e.g., your-username/monzoo)
  // You'll need to replace this with your actual GitHub repo
  autoUpdater.setFeedURL({
    provider: 'github',
    owner: 'kadiks', // Replace with your GitHub username
    repo: 'monzoo', // Replace if repo name is different
  });

  // Check for updates on startup
  autoUpdater.checkForUpdates().catch(err => {
    console.log(chalk.yellow(`Auto-update check failed: ${err.message}`));
  });

  // Check for updates every 60 minutes
  setInterval(() => {
    autoUpdater.checkForUpdates().catch(err => {
      console.log(chalk.yellow(`Auto-update check failed: ${err.message}`));
    });
  }, 60 * 60 * 1000);

  // Update available
  autoUpdater.on('update-available', (info) => {
    console.log(chalk.cyan(`\n🔄 Update available: v${info.version}`));
    console.log(chalk.dim(`  Current: v${app.getVersion()}`));
    console.log(chalk.dim(`  Latest: v${info.version}`));
    
    updateAvailable = true;

    if (mainWindow) {
      mainWindow.webContents.send('update:available', {
        currentVersion: app.getVersion(),
        newVersion: info.version,
        releaseNotes: info.releaseNotes,
      });
    }

    // Auto download the update
    autoUpdater.downloadUpdate();
  });

  // Update not available
  autoUpdater.on('update-not-available', () => {
    console.log(chalk.dim(`✓ App is up to date (v${app.getVersion()})`));
  });

  // Download progress
  autoUpdater.on('download-progress', (progressObj) => {
    const percent = Math.round(progressObj.percent);
    console.log(chalk.dim(`  Downloading update: ${percent}%`));

    if (mainWindow) {
      mainWindow.webContents.send('update:download-progress', { percent });
    }
  });

  // Update downloaded
  autoUpdater.on('update-downloaded', (info) => {
    console.log(chalk.green(`✓ Update downloaded: v${info.version}`));
    console.log(chalk.dim(`  Restart required to apply changes`));

    updateDownloaded = true;

    if (mainWindow) {
      mainWindow.webContents.send('update:downloaded', {
        version: info.version,
      });
    }

    // Show dialog asking to restart
    dialog.showMessageBox(mainWindow, {
      type: 'info',
      title: 'Update Available',
      message: `MonZoo Bot v${info.version} is ready to install`,
      detail: 'Click "Restart Now" to update and restart the app.',
      buttons: ['Restart Now', 'Later'],
      defaultId: 0,
      cancelId: 1,
    }).then(result => {
      if (result.response === 0) {
        autoUpdater.quitAndInstall();
      }
    });
  });

  // Error handling
  autoUpdater.on('error', (error) => {
    console.error(chalk.red(`Update error: ${error.message}`));
    if (mainWindow) {
      mainWindow.webContents.send('update:error', { error: error.message });
    }
  });

  // IPC handlers for update control
  ipcMain.handle('update:check', async () => {
    try {
      await autoUpdater.checkForUpdates();
      return { success: true };
    } catch (error) {
      return { success: false, error: error.message };
    }
  });

  ipcMain.handle('update:restart', () => {
    autoUpdater.quitAndInstall();
  });

  ipcMain.handle('update:status', () => {
    return {
      currentVersion: app.getVersion(),
      updateAvailable,
      updateDownloaded,
    };
  });
};

export const getUpdateStatus = () => ({
  currentVersion: app.getVersion(),
  updateAvailable,
  updateDownloaded,
});
