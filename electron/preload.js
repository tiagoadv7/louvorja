const { contextBridge, ipcRenderer } = require('electron');

// Canais que o renderer pode ouvir (main → renderer)
const RECEIVE_CHANNELS = [
  'state-update',
  'set-module',
  'output-window-closed',
  'output-window-opened',
  'output-ready',
  'output-closing',
  'menu:open-output',
  'menu:close-output',
  'menu:save-data',
  'menu:about',
  'menu:check-updates',
  'sqlite:progress',
  'regserver:registration',
  'album:download-progress',
  'files:download-progress',
];

contextBridge.exposeInMainWorld('electron', {
  // ── Controle de janela ───────────────────────────────────────────────────
  windowMinimize: () => ipcRenderer.invoke('window:minimize'),
  windowMaximize: () => ipcRenderer.invoke('window:maximize'),
  windowClose: () => ipcRenderer.invoke('window:close'),
  windowIsMaximized: () => ipcRenderer.invoke('window:is-maximized'),
  windowSetTitle: (title) => ipcRenderer.invoke('window:set-title', title),

  // ── Janela de saída (apresentação) ───────────────────────────────────────
  openOutput: (moduleId, displayId) => ipcRenderer.invoke('output:open', moduleId, displayId),
  closeOutput: () => ipcRenderer.invoke('output:close'),
  isOutputOpen: () => ipcRenderer.invoke('output:is-open'),
  setOutputModule: (moduleId) => ipcRenderer.invoke('output:set-module', moduleId),

  // ── Armazenamento persistente ────────────────────────────────────────────
  storeGet: (key, defaultValue) => ipcRenderer.invoke('store:get', key, defaultValue),
  storeSet: (key, value) => ipcRenderer.invoke('store:set', key, value),
  storeRemove: (key) => ipcRenderer.invoke('store:remove', key),
  storeClear: () => ipcRenderer.invoke('store:clear'),

  // ── Sistema de arquivos ──────────────────────────────────────────────────
  selectFile: (options) => ipcRenderer.invoke('fs:select-file', options),
  selectFolder: (options) => ipcRenderer.invoke('fs:select-folder', options),
  saveDialog: (options) => ipcRenderer.invoke('fs:save-dialog', options),
  readFile: (filePath, encoding) => ipcRenderer.invoke('fs:read-file', filePath, encoding),
  writeFile: (filePath, data) => ipcRenderer.invoke('fs:write-file', filePath, data),
  deleteFile: (filePath) => ipcRenderer.invoke('fs:delete-file', filePath),
  readDir: (dirPath) => ipcRenderer.invoke('fs:read-dir', dirPath),
  fileExists: (filePath) => ipcRenderer.invoke('fs:exists', filePath),
  getPath: (name) => ipcRenderer.invoke('fs:get-path', name),

  // ── Aplicação ────────────────────────────────────────────────────────────
  getVersion: () => ipcRenderer.invoke('app:get-version'),
  getOS: () => ipcRenderer.invoke('app:get-os'),
  getUserDataPath: () => ipcRenderer.invoke('app:get-user-data-path'),
  openExternal: (url) => ipcRenderer.invoke('app:open-external', url),
  showItemInFolder: (filePath) => ipcRenderer.invoke('app:show-item-in-folder', filePath),

  // ── Arquivos de mídia locais ─────────────────────────────────────────────
  mediaGetBaseFolder: () => ipcRenderer.invoke('media:get-base-folder'),
  mediaSetBaseFolder: (folderPath) => ipcRenderer.invoke('media:set-base-folder', folderPath),
  mediaScanFolder: (folderPath) => ipcRenderer.invoke('media:scan-folder', folderPath),
  mediaResolveFile: (filename) => ipcRenderer.invoke('media:resolve-file', filename),
  mediaGetImagesFolder: () => ipcRenderer.invoke('media:get-images-folder'),
  mediaSetImagesFolder: (folderPath) => ipcRenderer.invoke('media:set-images-folder', folderPath),
  mediaResolveImage: (filename) => ipcRenderer.invoke('media:resolve-image', filename),

  // ── Importação SQLite ────────────────────────────────────────────────────
  sqliteImport: (opts) => ipcRenderer.invoke('sqlite:import', opts),
  sqliteGetImportInfo: () => ipcRenderer.invoke('sqlite:get-import-info'),
  sqliteClear: () => ipcRenderer.invoke('sqlite:clear'),

  // ── Servidor de registro (QR Code) ──────────────────────────────────────
  regserverStart:   ()           => ipcRenderer.invoke('regserver:start'),
  regserverStop:    ()           => ipcRenderer.invoke('regserver:stop'),
  regserverGetList: ()           => ipcRenderer.invoke('regserver:get-list'),
  regserverClear:   ()           => ipcRenderer.invoke('regserver:clear'),
  qrcodeGenerate:   (text, opts) => ipcRenderer.invoke('qrcode:generate', text, opts),

  // ── Banco de dados local ─────────────────────────────────────────────────
  dbGetLocalFolder: () => ipcRenderer.invoke('db:get-local-folder'),
  dbSetLocalFolder: (folderPath) => ipcRenderer.invoke('db:set-local-folder', folderPath),
  dbLocalExists: (filename) => ipcRenderer.invoke('db:local-exists', filename),
  dbLocalGet: (filename) => ipcRenderer.invoke('db:local-get', filename),
  dbLocalSave: (filename, data) => ipcRenderer.invoke('db:local-save', filename, data),
  dbLocalList: () => ipcRenderer.invoke('db:local-list'),
  dbLocalDelete: (filename) => ipcRenderer.invoke('db:local-delete', filename),
  dbLocalClear: () => ipcRenderer.invoke('db:local-clear'),
  dbLocalDownload: (filename, url, token) => ipcRenderer.invoke('db:local-download', filename, url, token),
  albumDownloadFull: (albumId, dbBaseUrl, filesBaseUrl, token, overwrite = false) =>
    ipcRenderer.invoke('album:download-full', albumId, dbBaseUrl, filesBaseUrl, token, overwrite),
  scanMissingFiles: () => ipcRenderer.invoke('files:scan-missing'),
  downloadMissingFiles: (missingList, filesBaseUrl, token) =>
    ipcRenderer.invoke('files:download-missing', missingList, filesBaseUrl, token),

  // ── Telas / displays ─────────────────────────────────────────────────────
  getScreens: () => ipcRenderer.invoke('screen:get-all'),
  identifyScreens: () => ipcRenderer.invoke('screen:identify'),

  // ── Diálogos ─────────────────────────────────────────────────────────────
  showMessage: (options) => ipcRenderer.invoke('dialog:message', options),

  // ── Pasta config/ ────────────────────────────────────────────────────────
  configGetDir: () => ipcRenderer.invoke('config:get-dir'),

  // ── Sincronização de estado (janela principal → janela de saída) ─────────
  sendStateUpdate: (data) => ipcRenderer.send('state-update', data),
  notifyOutputReady: () => ipcRenderer.send('output:ready'),
  appLoaded: () => ipcRenderer.send('app:loaded'),

  // ── Eventos (main → renderer) ────────────────────────────────────────────
  on: (channel, callback) => {
    if (!RECEIVE_CHANNELS.includes(channel)) return;
    const handler = (_, ...args) => callback(...args);
    ipcRenderer.on(channel, handler);
    return handler;
  },

  off: (channel, handler) => {
    if (handler) ipcRenderer.removeListener(channel, handler);
    else ipcRenderer.removeAllListeners(channel);
  },
});
