/* global require */
const { ipcRenderer, remote } = require('electron');

async function load() {
  const { settings, hasPassword } = await ipcRenderer.invoke('prefs:get');
  document.getElementById('username').value = settings.username || '';
  document.getElementById('password').value = '';
  document.getElementById('pwdHint').textContent = hasPassword ? '(stored in Keychain)' : '';
  document.getElementById('scheduleEnabled').checked = !!settings.scheduleEnabled;
  document.getElementById('runMinute').value = settings.runMinute ?? 10;
  document.getElementById('amStartHour').value = settings.amStartHour ?? 0;
  document.getElementById('pmStartHour').value = settings.pmStartHour ?? 14;
}

async function save() {
  const payload = {
    username: document.getElementById('username').value.trim(),
    password: document.getElementById('password').value,
    scheduleEnabled: document.getElementById('scheduleEnabled').checked,
    runMinute: Number(document.getElementById('runMinute').value),
    amStartHour: Number(document.getElementById('amStartHour').value),
    pmStartHour: Number(document.getElementById('pmStartHour').value),
  };
  await ipcRenderer.invoke('prefs:save', payload);
  window.close();
}

document.getElementById('saveBtn').addEventListener('click', save);
document.getElementById('cancelBtn').addEventListener('click', () => window.close());

load();
