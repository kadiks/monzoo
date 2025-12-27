import { app, Menu, Tray, nativeImage } from 'electron';
import dotenv from 'dotenv';
import path from 'path';
import fs from 'fs';
import cron from 'node-cron';
import { fileURLToPath } from 'url';
import { runMonzooCycle } from '../index.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

let tray = null;
import { BrowserWindow, ipcMain } from 'electron';
let isRunning = false;
let state = null;
let statePath = null;

const PERIODS = {
  AM: 'am', // 00:00 -> 13:59
import keytar from 'keytar';
  PM: 'pm', // 14:00 -> 23:59
};

function getPeriod(date = new Date()) {
  const h = date.getHours();
let settings = null;
let settingsPath = null;
let cronTask = null;
let prefsWindow = null;
  return h < 14 ? PERIODS.AM : PERIODS.PM;
}

function periodStart(date = new Date()) {
  const d = new Date(date);
  if (getPeriod(d) === PERIODS.AM) {
    d.setHours(0, 0, 0, 0);
  } else {
    d.setHours(14, 0, 0, 0);
  }
  return d;
}

function loadState() {
  try {
    const raw = fs.readFileSync(statePath, 'utf-8');
    return JSON.parse(raw);
  } catch {
    return { lastRun: { am: null, pm: null }, history: [] };
  }

function defaultSettings() {
  return {
    scheduleEnabled: true,
    runMinute: 10, // HH:10 each hour
    amStartHour: 0,
    pmStartHour: 14,
    username: '',
  };
}

function loadSettings() {
  try {
    const raw = fs.readFileSync(settingsPath, 'utf-8');
    const parsed = JSON.parse(raw);
    return { ...defaultSettings(), ...parsed };
  } catch {
    return defaultSettings();
  }
}

function saveSettings() {
  fs.mkdirSync(path.dirname(settingsPath), { recursive: true });
  fs.writeFileSync(settingsPath, JSON.stringify(settings, null, 2));
}
}

function saveState() {
  fs.mkdirSync(path.dirname(statePath), { recursive: true });
  // Compute start based on settings
  const start = (() => {
    const d = new Date(now);
    if (getPeriod(d) === PERIODS.AM) {
      d.setHours(settings.amStartHour ?? 0, 0, 0, 0);
    } else {
      d.setHours(settings.pmStartHour ?? 14, 0, 0, 0);
    }
    return d;
  })();
}

function addHistory(entry) {
  state.history.unshift(entry);
  state.history = state.history.slice(0, 20);
  saveState();
}

function shouldRunNow(now = new Date()) {
  const period = getPeriod(now);
  const last = state.lastRun[period] ? new Date(state.lastRun[period]) : null;
  const start = periodStart(now);
  // Run if never ran in this period or last run is before the start of the current period
  return !last || last < start;
}

function updateMenu() {
  const statusLabel = isRunning ? 'Status: Running…' : 'Status: Idle';
  const lastEntries = state.history.slice(0, 5);

    { label: 'Preferences…', click: () => openPreferences() },
    { type: 'separator' },
  const historyItems = lastEntries.length
    ? lastEntries.map((h) => ({
        label: `${new Date(h.time).toLocaleString()} — ${h.message}`,
        enabled: false,
      }))
    : [{ label: 'No recent activity', enabled: false }];

  const menu = Menu.buildFromTemplate([
    { label: 'MonZoo Bot', enabled: false },
    { type: 'separator' },
    { label: statusLabel, enabled: false },
    { type: 'separator' },
    { label: 'Run now', click: () => triggerRun('manual') },
    { type: 'separator' },
    { label: 'Last actions', enabled: false },
    ...historyItems,
    { type: 'separator' },
  if (reason === 'scheduled' && (!settings.scheduleEnabled || !shouldRunNow(now))) {
  ]);

  tray.setContextMenu(menu);
}

async function triggerRun(reason = 'scheduled') {
  if (isRunning) return;

  const now = new Date();
  const period = getPeriod(now);
    // Inject credentials from settings/keychain into env for runner
    process.env.MONZOO_USERNAME = settings.username || '';
    try {
      const pwd = await keytar.getPassword('net.monzoo.bot', 'monzoo-password');
      process.env.MONZOO_PASSWORD = pwd || '';
    } catch {}


  if (reason === 'scheduled' && !shouldRunNow(now)) {
    addHistory({ time: now.toISOString(), message: `Skipped (already ran this ${period.toUpperCase()})` });
    updateMenu();
    return;
  }

  isRunning = true;
  updateMenu();
  addHistory({ time: now.toISOString(), message: `Run started (${reason})` });

  try {
    const summary = await runMonzooCycle();
    const finished = new Date();

    if (summary.ok) {
      // Mark period as run if not a manual skip test
      state.lastRun[period] = finished.toISOString();
      saveState();

      const addedCount = summary.itemsAdded.length;
      const safeCount = summary.itemsSafe.length;
      addHistory({
        time: finished.toISOString(),
        message: `Success: added ${addedCount} item types, ${safeCount} already safe`,
      });
    } else {
      addHistory({ time: finished.toISOString(), message: `Failed: ${summary.errors.join('; ')}` });
    }
  } catch (e) {
    addHistory({ time: new Date().toISOString(), message: `Error: ${e.message || String(e)}` });
  } finally {
    isRunning = false;
    updateMenu();
  }
function reschedule() {
  if (cronTask) {
    try { cronTask.stop(); } catch {}
    cronTask = null;
  }
  if (!settings.scheduleEnabled) {
    return;
  }
  const minute = Math.max(0, Math.min(59, Number(settings.runMinute ?? 10)));
  const expression = `${minute} * * * *`;
  cronTask = cron.schedule(expression, () => triggerRun('scheduled'));
}

function openPreferences() {
  if (prefsWindow) {
    prefsWindow.focus();
    return;
  }
  prefsWindow = new BrowserWindow({
    width: 420,
    height: 360,
    title: 'Preferences',
    resizable: false,
    minimizable: false,
    maximizable: false,
    webPreferences: {
      nodeIntegration: true,
      contextIsolation: false,
    },
  });
  prefsWindow.on('closed', () => (prefsWindow = null));
  prefsWindow.loadFile(path.join(__dirname, 'preferences.html'));
}

// IPC for preferences
ipcMain.handle('prefs:get', async () => {
  const hasPassword = !!(await keytar.getPassword('net.monzoo.bot', 'monzoo-password').catch(() => null));
  return { settings, hasPassword };
});

ipcMain.handle('prefs:save', async (_e, payload) => {
  const { username, password, scheduleEnabled, runMinute, amStartHour, pmStartHour } = payload || {};
  settings.username = username ?? settings.username;
  settings.scheduleEnabled = !!scheduleEnabled;
  settings.runMinute = Number.isFinite(Number(runMinute)) ? Number(runMinute) : settings.runMinute;
  settings.amStartHour = Number.isFinite(Number(amStartHour)) ? Number(amStartHour) : settings.amStartHour;
  settings.pmStartHour = Number.isFinite(Number(pmStartHour)) ? Number(pmStartHour) : settings.pmStartHour;
  saveSettings();
  if (typeof password === 'string' && password.length > 0) {
    await keytar.setPassword('net.monzoo.bot', 'monzoo-password', password);
  }
  reschedule();
  return { ok: true };
});
  const transparentPng =
    'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8Xw8AAqMBhKyeqP8AAAAASUVORK5CYII=';
  const image = nativeImage.createFromDataURL(transparentPng);
  tray = new Tray(image);
  tray.setTitle('MonZoo'); // Shows text in macOS menu bar
  updateMenu();
  settingsPath = path.join(app.getPath('userData'), 'settings.json');
  settings = loadSettings();
}
  reschedule();
function setupScheduler() {
  // At HH:10 every hour
  cron.schedule('10 * * * *', () => triggerRun('scheduled'));
}

app.whenReady().then(() => {
  // Load environment variables from .env if present (dev convenience)
  dotenv.config();
  statePath = path.join(app.getPath('userData'), 'run-state.json');
  state = loadState();
  createTray();
  setupScheduler();
  updateMenu();
});

app.on('window-all-closed', (e) => {
  // Prevent quitting on macOS when no windows
  e.preventDefault();
});
