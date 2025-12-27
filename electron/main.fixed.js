import { BrowserWindow, Menu, Tray, app, ipcMain, nativeImage } from 'electron';

import cron from 'node-cron';
import dotenv from 'dotenv';
import { fileURLToPath } from 'url';
import fs from 'fs';
import keytar from 'keytar';
import path from 'path';
import { runMonzooCycle } from '../index.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

let tray = null;
let isRunning = false;
let runningSince = null;
let state = null;
let statePath = null;
let settings = null;
let settingsPath = null;
let cronTask = null;
let prefsWindow = null;
let logsDir = null;
let lastRunLogPath = null;
let logsWindow = null;

// In-memory log buffer (current run) and console interception
const LOG_CAP = 1000;
let logBuffer = [];
const originalConsole = {
  log: console.log,
  info: console.info,
  warn: console.warn,
  error: console.error,
};

function stringifyArg(arg) {
  if (arg instanceof Error) return `${arg.name}: ${arg.message}`;
  if (typeof arg === 'object') {
    try { return JSON.stringify(arg); } catch { return String(arg); }
  }
  return String(arg);
}

function pushLog(level, args) {
  const message = args.map(stringifyArg).join(' ');
  const entry = { time: new Date().toISOString(), level, message };
  logBuffer.push(entry);
  if (logBuffer.length > LOG_CAP) logBuffer.shift();
  if (logsWindow && !logsWindow.isDestroyed()) {
    logsWindow.webContents.send('logs:append', entry);
  }
}

console.log = (...args) => { originalConsole.log(...args); pushLog('info', args); };
console.info = (...args) => { originalConsole.info(...args); pushLog('info', args); };
console.warn = (...args) => { originalConsole.warn(...args); pushLog('warn', args); };
console.error = (...args) => { originalConsole.error(...args); pushLog('error', args); };

const PERIODS = { AM: 'am', PM: 'pm' };

function getPeriod(date = new Date()) {
  const h = date.getHours();
  return h < (settings?.pmStartHour ?? 14) ? PERIODS.AM : PERIODS.PM;
}

function defaultSettings() {
  return {
    scheduleEnabled: true,
    runMinute: 10, // HH:10
    amStartHour: 0,
    pmStartHour: 14,
    username: '',
  };
}

function loadSettings() {
  try {
    const raw = fs.readFileSync(settingsPath, 'utf-8');
    return { ...defaultSettings(), ...JSON.parse(raw) };
  } catch {
    return defaultSettings();
  }
}

function saveSettings() {
  fs.mkdirSync(path.dirname(settingsPath), { recursive: true });
  fs.writeFileSync(settingsPath, JSON.stringify(settings, null, 2));
}

function loadState() {
  try {
    const raw = fs.readFileSync(statePath, 'utf-8');
    return JSON.parse(raw);
  } catch {
    return { lastRun: { am: null, pm: null }, history: [] };
  }
}

function saveState() {
  fs.mkdirSync(path.dirname(statePath), { recursive: true });
  fs.writeFileSync(statePath, JSON.stringify(state, null, 2));
}

function addHistory(entry) {
  state.history.unshift(entry);
  state.history = state.history.slice(0, 20);
  saveState();
}

function periodStart(now = new Date()) {
  const d = new Date(now);
  if (getPeriod(d) === PERIODS.AM) {
    d.setHours(settings.amStartHour ?? 0, 0, 0, 0);
  } else {
    d.setHours(settings.pmStartHour ?? 14, 0, 0, 0);
  }
  return d;
}

function shouldRunNow(now = new Date()) {
  const period = getPeriod(now);
  const last = state.lastRun[period] ? new Date(state.lastRun[period]) : null;
  const start = periodStart(now);
  return !last || last < start;
}

function nextPeriodStart(now = new Date()) {
  const d = new Date(now);
  if (getPeriod(d) === PERIODS.AM) {
    const sameDayPM = new Date(d);
    sameDayPM.setHours(settings.pmStartHour ?? 14, 0, 0, 0);
    return sameDayPM;
  }
  const nextDayAM = new Date(d);
  nextDayAM.setDate(d.getDate() + 1);
  nextDayAM.setHours(settings.amStartHour ?? 0, 0, 0, 0);
  return nextDayAM;
}

function nextOccurrenceFrom(date, minute) {
  const d = new Date(date);
  if (d.getMinutes() < minute) {
    d.setMinutes(minute, 0, 0);
    return d;
  }
  d.setHours(d.getHours() + 1, minute, 0, 0);
  return d;
}

function computeNextRunTime(now = new Date()) {
  if (!settings?.scheduleEnabled) return null;
  const minute = Math.max(0, Math.min(59, Number(settings.runMinute ?? 10)));
  if (shouldRunNow(now)) {
    return nextOccurrenceFrom(now, minute);
  }
  const nps = nextPeriodStart(now);
  return nextOccurrenceFrom(nps, minute);
}

function updateMenu() {
  const statusLabel = isRunning
    ? `Status: Running…${runningSince ? ` (since ${new Date(runningSince).toLocaleTimeString()})` : ''}`
    : 'Status: Idle';

  const nextRun = settings?.scheduleEnabled ? computeNextRunTime(new Date()) : null;
  const nextRunLabel = settings?.scheduleEnabled
    ? `Next run: ${nextRun ? nextRun.toLocaleString() : '—'}`
    : 'Schedule: Disabled';

  const lastEntries = state.history.slice(0, 5);
  const historyItems = lastEntries.length
    ? lastEntries.map((h) => ({ label: `${new Date(h.time).toLocaleString()} — ${h.message}`, enabled: false }))
    : [{ label: 'No recent activity', enabled: false }];

  const menu = Menu.buildFromTemplate([
    { label: 'MonZoo Bot', enabled: false },
    { type: 'separator' },
    { label: statusLabel, enabled: false },
    { label: nextRunLabel, enabled: false },
    { type: 'separator' },
    { label: 'Preferences…', click: () => openPreferences() },
    { label: 'Logs…', click: () => openLogs() },
    { type: 'separator' },
    { label: 'Run now', click: () => triggerRun('manual') },
    { type: 'separator' },
    { label: 'Last actions', enabled: false },
    ...historyItems,
    { type: 'separator' },
    { label: 'Quit', role: 'quit' },
  ]);

  tray.setContextMenu(menu);
}

async function triggerRun(reason = 'scheduled') {
  if (isRunning) return;

  const now = new Date();
  const period = getPeriod(now);

  if (reason === 'scheduled' && (!settings.scheduleEnabled || !shouldRunNow(now))) {
    addHistory({ time: now.toISOString(), message: `Skipped (already ran this ${period.toUpperCase()})` });
    updateMenu();
    return;
  }

  // Reset log buffer for a new run so "last-run" reflects the previous cycle
  logBuffer = [];
  isRunning = true;
  runningSince = new Date();
  updateMenu();
  addHistory({ time: now.toISOString(), message: `Run started (${reason})` });

  try {
    // Provide credentials to runner
    process.env.MONZOO_USERNAME = settings.username || '';
    try {
      const pwd = await keytar.getPassword('net.monzoo.bot', 'monzoo-password');
      process.env.MONZOO_PASSWORD = pwd || '';
    } catch {}

    const summary = await runMonzooCycle();
    const finished = new Date();

    if (summary.ok) {
      state.lastRun[period] = finished.toISOString();
      saveState();
      addHistory({
        time: finished.toISOString(),
        message: `Success: added ${summary.itemsAdded.length} type(s), ${summary.itemsSafe.length} already safe`,
      });
    } else {
      addHistory({ time: finished.toISOString(), message: `Failed: ${summary.errors.join('; ')}` });
    }
  } catch (e) {
    addHistory({ time: new Date().toISOString(), message: `Error: ${e.message || String(e)}` });
  } finally {
    // Persist last run logs
    try {
      fs.mkdirSync(logsDir, { recursive: true });
      const payload = {
        startedAt: runningSince ? runningSince.toISOString() : null,
        finishedAt: new Date().toISOString(),
        entries: logBuffer,
      };
      fs.writeFileSync(lastRunLogPath, JSON.stringify(payload, null, 2));
    } catch {}
    isRunning = false;
    runningSince = null;
    updateMenu();
  }
}

function createTray() {
  const transparentPng = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8Xw8AAqMBhKyeqP8AAAAASUVORK5CYII=';
  const image = nativeImage.createFromDataURL(transparentPng);
  tray = new Tray(image);
  tray.setTitle('MonZoo');
  updateMenu();
}

function reschedule() {
  if (cronTask) {
    try { cronTask.stop(); } catch {}
    cronTask = null;
  }
  if (!settings.scheduleEnabled) return;
  const minute = Math.max(0, Math.min(59, Number(settings.runMinute ?? 10)));
  const expression = `${minute} * * * *`;
  cronTask = cron.schedule(expression, () => triggerRun('scheduled'));
}

function openPreferences() {
  if (prefsWindow) return prefsWindow.focus();
  prefsWindow = new BrowserWindow({
    width: 420,
    height: 360,
    title: 'Preferences',
    resizable: false,
    minimizable: false,
    maximizable: false,
    webPreferences: { nodeIntegration: true, contextIsolation: false },
  });
  prefsWindow.on('closed', () => (prefsWindow = null));
  prefsWindow.loadFile(path.join(__dirname, 'preferences.html'));
}

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
  updateMenu();
  return { ok: true };
});

// Logs IPC
ipcMain.handle('logs:get-last', async () => {
  try {
    const raw = fs.readFileSync(lastRunLogPath, 'utf-8');
    const data = JSON.parse(raw);
    return { ok: true, ...data };
  } catch (e) {
    return { ok: false, entries: [], error: e.message };
  }
});

// Logs window
function openLogs() {
  if (logsWindow) return logsWindow.focus();
  logsWindow = new BrowserWindow({
    width: 720,
    height: 480,
    title: 'MonZoo Logs',
    webPreferences: { nodeIntegration: true, contextIsolation: false },
  });
  logsWindow.on('closed', () => (logsWindow = null));
  logsWindow.loadFile(path.join(__dirname, 'logs.html'));
}

ipcMain.handle('logs:get', async (_e, payload = {}) => {
  const limit = Number(payload.limit ?? 500);
  const slice = logBuffer.slice(Math.max(0, logBuffer.length - limit));
  return slice;
});

ipcMain.handle('logs:clear', async () => {
  logBuffer = [];
  return { ok: true };
});

app.whenReady().then(() => {
  dotenv.config();
  statePath = path.join(app.getPath('userData'), 'run-state.json');
  settingsPath = path.join(app.getPath('userData'), 'settings.json');
  logsDir = path.join(app.getPath('userData'), 'logs');
  lastRunLogPath = path.join(logsDir, 'last-run.json');
  state = loadState();
  settings = loadSettings();
  createTray();
  reschedule();
  updateMenu();
  
  // Set app to open at login
  app.setLoginItemSettings({
    openAtLogin: true,
    openAsHidden: true,
  });
});

app.on('window-all-closed', (e) => {
  e.preventDefault();
});
