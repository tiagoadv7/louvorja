const { app } = require('electron');
const fs = require('fs');
const path = require('path');

let storePath = '';
let data = {};

function init() {
  storePath = path.join(app.getPath('userData'), 'louvorja-store.json');
  load();
}

function load() {
  try {
    if (fs.existsSync(storePath)) {
      const raw = fs.readFileSync(storePath, 'utf8');
      data = JSON.parse(raw) || {};
    }
  } catch (e) {
    console.error('[Store] Erro ao carregar:', e.message);
    data = {};
  }
}

function save() {
  try {
    const dir = path.dirname(storePath);
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }
    fs.writeFileSync(storePath, JSON.stringify(data, null, 2), 'utf8');
  } catch (e) {
    console.error('[Store] Erro ao salvar:', e.message);
  }
}

function get(key, defaultValue = null) {
  if (!key) return data;
  const parts = key.split('.');
  let value = data;
  for (const part of parts) {
    if (value === null || value === undefined || typeof value !== 'object') {
      return defaultValue;
    }
    value = value[part];
  }
  return value !== undefined ? value : defaultValue;
}

function set(key, value) {
  if (!key) return;
  const parts = key.split('.');
  let obj = data;
  for (let i = 0; i < parts.length - 1; i++) {
    if (!obj[parts[i]] || typeof obj[parts[i]] !== 'object') {
      obj[parts[i]] = {};
    }
    obj = obj[parts[i]];
  }
  obj[parts[parts.length - 1]] = value;
  save();
}

function remove(key) {
  if (!key) return;
  const parts = key.split('.');
  let obj = data;
  for (let i = 0; i < parts.length - 1; i++) {
    if (!obj[parts[i]]) return;
    obj = obj[parts[i]];
  }
  delete obj[parts[parts.length - 1]];
  save();
}

function clear() {
  data = {};
  save();
}

module.exports = { init, get, set, remove, clear, load, save };
