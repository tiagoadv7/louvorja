// Helper para comunicação com o processo principal do Electron.
// No navegador, as operações de banco de dados usam localStorage como fallback.

const isElectron = () =>
  typeof window !== 'undefined' &&
  typeof window.electron !== 'undefined' &&
  navigator.userAgent.includes('Electron');

// ── Fallback localStorage para o browser ──────────────────────────────────
const _DB_PFX = 'db_local:';

const _bGet = (filename) => {
  try {
    const raw = localStorage.getItem(_DB_PFX + filename);
    return raw ? JSON.parse(raw) : null;
  } catch { return null; }
};

const _bSave = (filename, data) => {
  try {
    localStorage.setItem(_DB_PFX + filename, JSON.stringify(data));
    return true;
  } catch (e) {
    console.warn('[Browser DB] localStorage quota exceeded:', filename);
    return false;
  }
};

const _bList = () => {
  try {
    const results = [];
    for (let i = 0; i < localStorage.length; i++) {
      const key = localStorage.key(i);
      if (key && key.startsWith(_DB_PFX)) {
        const name = key.slice(_DB_PFX.length);
        const raw = localStorage.getItem(key) || '';
        results.push({ name, size: raw.length });
      }
    }
    return results;
  } catch { return []; }
};

const _bDelete = (filename) => {
  try { localStorage.removeItem(_DB_PFX + filename); return true; }
  catch { return false; }
};

const _bClear = () => {
  try {
    const keys = [];
    for (let i = 0; i < localStorage.length; i++) {
      const k = localStorage.key(i);
      if (k && k.startsWith(_DB_PFX)) keys.push(k);
    }
    keys.forEach(k => localStorage.removeItem(k));
    return true;
  } catch { return false; }
};

const _bDownload = async (filename, url, token) => {
  try {
    const resp = await fetch(url, token ? { headers: { 'Api-Token': token } } : {});
    if (!resp.ok) return false;
    const data = await resp.json();
    return _bSave(filename, data);
  } catch { return false; }
};

export default {
  isElectron,

  // ── Controle de janela ─────────────────────────────────────────────────
  windowMinimize: () => isElectron() && window.electron.windowMinimize(),
  windowMaximize: () => isElectron() && window.electron.windowMaximize(),
  windowClose: () => isElectron() && window.electron.windowClose(),
  windowIsMaximized: () => isElectron() ? window.electron.windowIsMaximized() : Promise.resolve(false),
  windowSetTitle: (title) => isElectron() && window.electron.windowSetTitle(title),

  // ── Janela de saída ────────────────────────────────────────────────────
  openOutput: (moduleId, displayId) => isElectron() ? window.electron.openOutput(moduleId, displayId) : null,
  closeOutput: () => isElectron() ? window.electron.closeOutput() : null,
  isOutputOpen: () => isElectron() ? window.electron.isOutputOpen() : Promise.resolve(false),
  setOutputModule: (moduleId) => isElectron() && window.electron.setOutputModule(moduleId),

  // ── Armazenamento persistente ──────────────────────────────────────────
  storeGet: (key, defaultValue = null) =>
    isElectron() ? window.electron.storeGet(key, defaultValue) : Promise.resolve(defaultValue),
  storeSet: (key, value) =>
    isElectron() ? window.electron.storeSet(key, value) : Promise.resolve(false),
  storeRemove: (key) =>
    isElectron() ? window.electron.storeRemove(key) : Promise.resolve(false),
  storeClear: () =>
    isElectron() ? window.electron.storeClear() : Promise.resolve(false),

  // ── Sistema de arquivos ────────────────────────────────────────────────
  // Caminho absoluto de um File (drag&drop) — File.path não existe mais fora do Electron.
  getPathForFile: (file) =>
    isElectron() ? window.electron.getPathForFile(file) : null,
  selectFile: (options = {}) =>
    isElectron() ? window.electron.selectFile(options) : Promise.resolve(null),
  selectFolder: (options = {}) =>
    isElectron() ? window.electron.selectFolder(options) : Promise.resolve(null),
  saveDialog: (options = {}) =>
    isElectron() ? window.electron.saveDialog(options) : Promise.resolve(null),
  readFile: (filePath, encoding = 'utf8') =>
    isElectron() ? window.electron.readFile(filePath, encoding) : Promise.resolve(null),
  writeFile: (filePath, data) =>
    isElectron() ? window.electron.writeFile(filePath, data) : Promise.resolve(false),
  deleteFile: (filePath) =>
    isElectron() ? window.electron.deleteFile(filePath) : Promise.resolve(false),
  readDir: (dirPath) =>
    isElectron() ? window.electron.readDir(dirPath) : Promise.resolve([]),
  fileExists: (filePath) =>
    isElectron() ? window.electron.fileExists(filePath) : Promise.resolve(false),
  getPath: (name) =>
    isElectron() ? window.electron.getPath(name) : Promise.resolve(null),

  // ── Aplicação ──────────────────────────────────────────────────────────
  getVersion: () =>
    isElectron() ? window.electron.getVersion() : Promise.resolve(null),
  getOS: () =>
    isElectron() ? window.electron.getOS() : Promise.resolve(navigator.platform),
  getUserDataPath: () =>
    isElectron() ? window.electron.getUserDataPath() : Promise.resolve(null),
  openExternal: (url) =>
    isElectron() ? window.electron.openExternal(url) : window.open(url, '_blank'),
  showItemInFolder: (filePath) =>
    isElectron() && window.electron.showItemInFolder(filePath),

  // ── Arquivos de mídia locais ──────────────────────────────────────────
  mediaGetBaseFolder: () =>
    isElectron() ? window.electron.mediaGetBaseFolder() : Promise.resolve(null),
  mediaSetBaseFolder: (folderPath) =>
    isElectron() ? window.electron.mediaSetBaseFolder(folderPath) : Promise.resolve(false),
  mediaScanFolder: (folderPath) =>
    isElectron() ? window.electron.mediaScanFolder(folderPath) : Promise.resolve({ count: 0 }),
  mediaResolveFile: (filename) =>
    isElectron() ? window.electron.mediaResolveFile(filename) : Promise.resolve(null),
  mediaDownloadFile: (params) =>
    isElectron() ? window.electron.mediaDownloadFile(params) : Promise.resolve(null),
  mediaGetImagesFolder: () =>
    isElectron() ? window.electron.mediaGetImagesFolder() : Promise.resolve(null),
  mediaSetImagesFolder: (folderPath) =>
    isElectron() ? window.electron.mediaSetImagesFolder(folderPath) : Promise.resolve(false),
  mediaResolveImage: (filename) =>
    isElectron() ? window.electron.mediaResolveImage(filename) : Promise.resolve(null),

  // ── Importação SQLite (legacy: converte para JSON) ────────────────────
  sqliteImport: (opts) =>
    isElectron() ? window.electron.sqliteImport(opts) : Promise.resolve({ success: false }),
  sqliteGetImportInfo: () =>
    isElectron() ? window.electron.sqliteGetImportInfo() : Promise.resolve(null),
  sqliteClear: () =>
    isElectron() ? window.electron.sqliteClear() : Promise.resolve(false),
  sqliteCheckUpdate: (dbBaseUrl, token) =>
    isElectron()
      ? window.electron.sqliteCheckUpdate(dbBaseUrl, token)
      : Promise.resolve({ updated: false, reason: 'not-electron' }),

  // ── SQLite direto (better-sqlite3) — sem conversão para JSON ──────────
  sqliteOpenPath: (dbPath) =>
    isElectron()
      ? window.electron.sqliteOpenPath(dbPath)
      : Promise.resolve({ success: false, error: 'not-electron' }),
  sqliteUnload: () =>
    isElectron() ? window.electron.sqliteUnload() : Promise.resolve(false),
  sqliteStatus: () =>
    isElectron()
      ? window.electron.sqliteStatus()
      : Promise.resolve({ available: false, open: false, path: null }),
  sqliteAutoDetect: () =>
    isElectron()
      ? window.electron.sqliteAutoDetect()
      : Promise.resolve({ found: false, reason: 'not-electron' }),

  // ── Banco de dados local ───────────────────────────────────────────────
  dbGetLocalFolder: () =>
    isElectron() ? window.electron.dbGetLocalFolder() : Promise.resolve(null),
  dbGetActualDir: () =>
    isElectron() ? window.electron.dbGetActualDir() : Promise.resolve(null),
  dbSetLocalFolder: (folderPath) =>
    isElectron() ? window.electron.dbSetLocalFolder(folderPath) : Promise.resolve(false),
  dbLocalExists: (filename) =>
    isElectron() ? window.electron.dbLocalExists(filename) : Promise.resolve(_bGet(filename) !== null),
  dbLocalGet: (filename) =>
    isElectron() ? window.electron.dbLocalGet(filename) : Promise.resolve(_bGet(filename)),
  dbLocalSave: (filename, data) =>
    isElectron() ? window.electron.dbLocalSave(filename, data) : Promise.resolve(_bSave(filename, data)),
  dbLocalList: () =>
    isElectron() ? window.electron.dbLocalList() : Promise.resolve(_bList()),
  dbLocalDelete: (filename) =>
    isElectron() ? window.electron.dbLocalDelete(filename) : Promise.resolve(_bDelete(filename)),
  dbLocalClear: () =>
    isElectron() ? window.electron.dbLocalClear() : Promise.resolve(_bClear()),
  dbLocalDownload: (filename, url, token) =>
    isElectron() ? window.electron.dbLocalDownload(filename, url, token) : _bDownload(filename, url, token),

  albumDownloadFull: (albumId, dbBaseUrl, filesBaseUrl, token, overwrite = false) =>
    isElectron()
      ? window.electron.albumDownloadFull(albumId, dbBaseUrl, filesBaseUrl, token, overwrite)
      : Promise.resolve({ success: false, error: 'not-electron' }),

  // Passa dbBaseUrl/token para que o scan possa buscar metadados de música que
  // ainda não foram cacheados localmente (ex: Modo Offline nunca salvou o JSON
  // da música porque só lê do disco) — sem isso, músicas sem music_<id>.json
  // local são silenciosamente ignoradas e a busca "some vazia".
  scanMissingFiles: () =>
    isElectron()
      ? window.electron.scanMissingFiles(import.meta.env.VITE_URL_DATABASE, import.meta.env.VITE_API_TOKEN)
      : Promise.resolve({ total: 0, missing: [], counts: {} }),

  scanAlbumsFiles: () =>
    isElectron()
      ? window.electron.scanAlbumsFiles(import.meta.env.VITE_URL_DATABASE, import.meta.env.VITE_API_TOKEN)
      : Promise.resolve({ total: 0, totalFiles: 0, foundFiles: 0, albums: [], allMissing: [] }),

  // Verifica álbuns específicos (baixados via album_<id>.json) diretamente pelo
  // id — ao contrário de scanAlbumsFiles, não depende do SQLite Delphi (cujas
  // entradas não têm id_album e nunca combinariam com os ids de "Meus Downloads").
  checkAlbumsComplete: (albumIds) =>
    isElectron()
      ? window.electron.checkAlbumsComplete(albumIds, import.meta.env.VITE_URL_DATABASE, import.meta.env.VITE_API_TOKEN)
      : Promise.resolve({}),

  downloadMissingFiles: (missingList, filesBaseUrl, token) =>
    isElectron()
      ? window.electron.downloadMissingFiles(missingList, filesBaseUrl, token)
      : Promise.resolve({ success: false, error: 'not-electron' }),

  // ── Tela de Retorno ────────────────────────────────────────────────────────
  openReturnScreen: (displayId) =>
    isElectron() ? window.electron.openReturnScreen(displayId) : Promise.resolve(false),
  closeReturnScreen: () =>
    isElectron() ? window.electron.closeReturnScreen() : Promise.resolve(false),
  isReturnScreenOpen: () =>
    isElectron() ? window.electron.isReturnScreenOpen() : Promise.resolve(false),

  // ── Janela flutuante (PIP) do player de vídeo ─────────────────────────
  pipOpen: () =>
    isElectron() ? window.electron.pipOpen() : Promise.resolve(false),
  pipClose: () =>
    isElectron() ? window.electron.pipClose() : Promise.resolve(false),
  pipIsOpen: () =>
    isElectron() ? window.electron.pipIsOpen() : Promise.resolve(false),
  sendPipTogglePlay: () =>
    isElectron() && window.electron.sendPipTogglePlay(),
  sendPipStop: () =>
    isElectron() && window.electron.sendPipStop(),
  sendVideoProgress: (data) =>
    isElectron() && window.electron.sendVideoProgress(data),

  // ── Sistema ───────────────────────────────────────────────────────────
  getHostname: () =>
    isElectron() ? window.electron.getHostname() : Promise.resolve(window.location.hostname || ''),

  // ── Telas ──────────────────────────────────────────────────────────────
  getScreens: () =>
    isElectron() ? window.electron.getScreens() : Promise.resolve([]),
  identifyScreens: () =>
    isElectron() ? window.electron.identifyScreens() : Promise.resolve(),

  // ── Diálogos ──────────────────────────────────────────────────────────
  showMessage: (options) =>
    isElectron() ? window.electron.showMessage(options) : Promise.resolve(0),

  // ── Servidor de registro (QR Code) ───────────────────────────────────
  regserverStart:   () => isElectron() ? window.electron.regserverStart()   : Promise.resolve(null),
  regserverStop:    () => isElectron() ? window.electron.regserverStop()    : Promise.resolve(false),
  regserverGetList: () => isElectron() ? window.electron.regserverGetList() : Promise.resolve([]),
  regserverClear:   () => isElectron() ? window.electron.regserverClear()   : Promise.resolve(false),
  qrcodeGenerate:   (text, opts) =>
    isElectron() ? window.electron.qrcodeGenerate(text, opts) : Promise.resolve(null),

  // ── Pasta config/ ────────────────────────────────────────────────────────
  configGetDir: () =>
    isElectron() ? window.electron.configGetDir() : Promise.resolve(null),
  shellOpenFolder: (folderPath) =>
    isElectron() ? window.electron.shellOpenFolder(folderPath) : Promise.resolve(),

  // ── Sincronização de estado ────────────────────────────────────────────
  sendStateUpdate: (data) =>
    isElectron() && window.electron.sendStateUpdate(data),
  sendAudioFocusRequest: (data) =>
    isElectron() && window.electron.sendAudioFocusRequest(data),
  notifyOutputReady: () =>
    isElectron() && window.electron.notifyOutputReady(),

  on: (channel, callback) => {
    if (!isElectron()) return null;
    return window.electron.on(channel, callback);
  },

  off: (channel, handler) => {
    if (!isElectron()) return;
    window.electron.off(channel, handler);
  },
};
