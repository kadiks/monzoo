/* global require */
const { ipcRenderer } = require('electron');
const AnsiToHtml = require('ansi-to-html');
const ansi = new AnsiToHtml({ fg: '#e6e6e6', bg: '#0b0b0b', newline: true, escapeXML: true });

const logEl = document.getElementById('log');
const pauseBtn = document.getElementById('pauseBtn');
const resumeBtn = document.getElementById('resumeBtn');
const clearBtn = document.getElementById('clearBtn');

let paused = false;

function renderEntry(entry) {
  const time = new Date(entry.time).toLocaleString();
  const line = document.createElement('div');
  line.className = `log-${entry.level}`;
  const htmlMsg = ansi.toHtml(entry.message || '');
  line.innerHTML = `<span class="time">[${time}]</span> ${htmlMsg}`;
  logEl.appendChild(line);
}

function scrollToBottom() {
  logEl.scrollTop = logEl.scrollHeight;
}

async function loadInitial() {
  // First load last-run persisted logs
  const last = await ipcRenderer.invoke('logs:get-last');
  logEl.innerHTML = '';
  if (last && last.ok && Array.isArray(last.entries)) {
    for (const e of last.entries) renderEntry(e);
  }
  // Then append current in-memory (live) buffer tail
  const liveTail = await ipcRenderer.invoke('logs:get', { limit: 200 });
  for (const e of liveTail) renderEntry(e);
  scrollToBottom();
}

ipcRenderer.on('logs:append', (_e, entry) => {
  if (paused) return;
  renderEntry(entry);
  scrollToBottom();
});

pauseBtn.addEventListener('click', () => {
  paused = true;
  pauseBtn.disabled = true;
  resumeBtn.disabled = false;
});

resumeBtn.addEventListener('click', () => {
  paused = false;
  pauseBtn.disabled = false;
  resumeBtn.disabled = true;
});

clearBtn.addEventListener('click', async () => {
  await ipcRenderer.invoke('logs:clear');
  logEl.innerHTML = '';
});

loadInitial();
