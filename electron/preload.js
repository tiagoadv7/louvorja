const { contextBridge, ipcRenderer, webUtils } = require('electron');

// Canais que o renderer pode ouvir (main → renderer)
const RECEIVE_CHANNELS = [
  'state-update',
  'state-update-batch',
  'set-module',
  'output-window-closed',
  'output-window-opened',
  'restore-output-state',
  'output-ready',
  'output-closing',
  'audio-focus-request',
  'return-window-opened',
  'return-window-closed',
  'return-closing',
  'video-pip:toggle-play',
  'video-pip:stop',
  'video-pip:closed',
  'video-player:progress',
  'menu:open-output',
  'menu:close-output',
  'menu:save-data',
  'menu:about',
  'menu:check-updates',
  'sqlite:progress',
  'sqlite:auto-import',
  'sqlite:direct-ready',
  'regserver:registration',
  'remote:request',
  'album:download-progress',
  'files:download-progress',
  'files:scan-progress',
  'updater:checking',
  'updater:available',
  'updater:not-available',
  'updater:progress',
  'updater:downloaded',
  'updater:error',
  'displays-changed',
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
  // File.path foi removido do Electron (a partir da v32) por segurança — o caminho
  // absoluto de um arquivo arrastado (drag&drop) só pode ser obtido via webUtils,
  // que só existe no processo com Node (preload), nunca no renderer isolado.
  getPathForFile: (file) => webUtils.getPathForFile(file),
  selectFile: (options) => ipcRenderer.invoke('fs:select-file', options),
  selectFolder: (options) => ipcRenderer.invoke('fs:select-folder', options),
  saveDialog: (options) => ipcRenderer.invoke('fs:save-dialog', options),
  readFile: (filePath, encoding) => ipcRenderer.invoke('fs:read-file', filePath, encoding),
  writeFile: (filePath, data, encoding) => ipcRenderer.invoke('fs:write-file', filePath, data, encoding),
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
  refreshWritableBase: () => ipcRenderer.invoke('app:refresh-writable-base'),

  // ── Arquivos de mídia locais ─────────────────────────────────────────────
  mediaGetBaseFolder: () => ipcRenderer.invoke('media:get-base-folder'),
  mediaSetBaseFolder: (folderPath) => ipcRenderer.invoke('media:set-base-folder', folderPath),
  mediaScanFolder: (folderPath) => ipcRenderer.invoke('media:scan-folder', folderPath),
  mediaResolveFile: (filename) => ipcRenderer.invoke('media:resolve-file', filename),
  mediaDownloadFile: (params) => ipcRenderer.invoke('media:download-file', params),
  mediaResolveRemoteUrl: (url, filesBaseUrl) => ipcRenderer.invoke('media:resolve-remote-url', url, filesBaseUrl),
  mediaGetImagesFolder: () => ipcRenderer.invoke('media:get-images-folder'),
  mediaSetImagesFolder: (folderPath) => ipcRenderer.invoke('media:set-images-folder', folderPath),
  mediaResolveImage: (filename) => ipcRenderer.invoke('media:resolve-image', filename),

  // ── Importação SQLite (legacy: converte para JSON) ───────────────────────
  sqliteImport: (opts) => ipcRenderer.invoke('sqlite:import', opts),
  sqliteGetImportInfo: () => ipcRenderer.invoke('sqlite:get-import-info'),
  sqliteClear: () => ipcRenderer.invoke('sqlite:clear'),
  sqliteCheckAutoImport: () => ipcRenderer.invoke('sqlite:check-auto-import'),
  sqliteCheckUpdate: (dbBaseUrl, token) => ipcRenderer.invoke('sqlite:check-update', { dbBaseUrl, token }),

  // ── SQLite direto (better-sqlite3) ───────────────────────────────────────
  sqliteOpenPath:   (dbPath) => ipcRenderer.invoke('sqlite:open-path', dbPath),
  sqliteUnload:     ()       => ipcRenderer.invoke('sqlite:unload'),
  sqliteStatus:     ()       => ipcRenderer.invoke('sqlite:status'),
  sqliteAutoDetect: ()       => ipcRenderer.invoke('sqlite:auto-detect'),

  // ── Servidor de registro (QR Code) ──────────────────────────────────────
  regserverStart:   ()           => ipcRenderer.invoke('regserver:start'),
  regserverStop:    ()           => ipcRenderer.invoke('regserver:stop'),
  regserverGetList: ()           => ipcRenderer.invoke('regserver:get-list'),
  regserverClear:   ()           => ipcRenderer.invoke('regserver:clear'),
  qrcodeGenerate:   (text, opts) => ipcRenderer.invoke('qrcode:generate', text, opts),

  // ── Servidor de Controle Remoto (API com token + transmissão/mirror) ─────
  remoteServerStart:  ()      => ipcRenderer.invoke('remote-server:start'),
  remoteServerStop:   ()      => ipcRenderer.invoke('remote-server:stop'),
  remoteServerStatus: ()      => ipcRenderer.invoke('remote-server:status'),
  remoteServerRegenerateToken: () => ipcRenderer.invoke('remote-server:regenerate-token'),
  sendRemoteResponse: (payload) => ipcRenderer.send('remote:response', payload),

  // ── Banco de dados local ─────────────────────────────────────────────────
  dbGetLocalFolder: () => ipcRenderer.invoke('db:get-local-folder'),
  dbGetActualDir: () => ipcRenderer.invoke('db:get-actual-dir'),
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
  scanMissingFiles: (dbBaseUrl, token) => ipcRenderer.invoke('files:scan-missing', dbBaseUrl, token),
  scanAlbumsFiles: (dbBaseUrl, token) => ipcRenderer.invoke('files:scan-albums', dbBaseUrl, token),
  checkAlbumsComplete: (albumIds, dbBaseUrl, token) =>
    ipcRenderer.invoke('files:check-albums-complete', albumIds, dbBaseUrl, token),
  downloadMissingFiles: (missingList, filesBaseUrl, token) =>
    ipcRenderer.invoke('files:download-missing', missingList, filesBaseUrl, token),

  // ── Tela de Retorno (monitor de palco) ──────────────────────────────────────
  openReturnScreen:  (displayId) => ipcRenderer.invoke('return:open', displayId),
  closeReturnScreen: ()          => ipcRenderer.invoke('return:close'),
  isReturnScreenOpen: ()         => ipcRenderer.invoke('return:is-open'),
  // Força repaint da janela de saída principal — usado ao alternar o que está
  // fixado no retorno (ver ButtonReturnScreenComponent), pra corrigir um bug
  // conhecido do Chromium/Electron no Windows onde janelas transparentes já
  // abertas podem renderizar preto quando outra janela transparente muda de
  // conteúdo, mesmo sem recriar nenhuma janela.
  invalidateOutput: () => ipcRenderer.invoke('output:invalidate'),

  // ── Janela flutuante (PIP) do player de vídeo ────────────────────────────
  pipOpen: () => ipcRenderer.invoke('video-pip:open'),
  pipClose: () => ipcRenderer.invoke('video-pip:close'),
  pipIsOpen: () => ipcRenderer.invoke('video-pip:is-open'),
  sendPipTogglePlay: () => ipcRenderer.send('video-pip:toggle-play'),
  sendPipStop: () => ipcRenderer.send('video-pip:stop'),
  // Progresso de reprodução (currentTime/duration) — canal dedicado da janela
  // de saída pra janela principal. O canal genérico de estado (state-update)
  // não serve aqui: escritas feitas pela janela de saída (is_popup=true)
  // nunca voltam por ali, então a barra do rodapé/painel nunca sabiam o
  // tempo real de reprodução e ficavam parados em 0:00.
  sendVideoProgress: (data) => ipcRenderer.send('video-player:progress', data),

  // ── Sistema ───────────────────────────────────────────────────────────────
  getHostname: () => ipcRenderer.invoke('app:hostname'),

  // ── Auto-updater ─────────────────────────────────────────────────────────
  updaterCheck:    () => ipcRenderer.invoke('updater:check'),
  updaterDownload: () => ipcRenderer.invoke('updater:download'),
  updaterInstall:  () => ipcRenderer.invoke('updater:install'),

  // ── Telas / displays ─────────────────────────────────────────────────────
  getScreens: () => ipcRenderer.invoke('screen:get-all'),
  identifyScreens: () => ipcRenderer.invoke('screen:identify'),

  // ── Diálogos ─────────────────────────────────────────────────────────────
  showMessage: (options) => ipcRenderer.invoke('dialog:message', options),

  // ── Pasta config/ ────────────────────────────────────────────────────────
  configGetDir: () => ipcRenderer.invoke('config:get-dir'),
  shellOpenFolder: (folderPath) => ipcRenderer.invoke('shell:open-folder', folderPath),

  // ── Sincronização de estado (janela principal → janela de saída) ─────────
  sendStateUpdate: (data) => ipcRenderer.send('state-update', data),
  // Lote atômico — vários campos entregues numa única mensagem/evento, pra
  // quem recebe nunca computar um estado combinado intermediário incorreto
  // (ver AppData.js setMultiple).
  sendStateUpdateBatch: (entries) => ipcRenderer.send('state-update-batch', entries),
  // Foco de áudio — bidirecional entre janela principal e janela de saída
  sendAudioFocusRequest: (data) => ipcRenderer.send('audio-focus-request', data),
  notifyOutputReady: (target) => ipcRenderer.send('output:ready', target),
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
