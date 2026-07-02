const { app, BrowserWindow, ipcMain, screen, session, protocol } = require('electron');
const { autoUpdater } = require('electron-updater');

// Deve ser chamado ANTES de app.whenReady() — registra o esquema como seguro
// para que <img src="app-local://capas/2026.bmp"> funcione no renderer
protocol.registerSchemesAsPrivileged([
  { scheme: 'app-local', privileges: { secure: true, standard: true, supportFetchAPI: true, stream: true } },
]);
const path = require('path');
const fs   = require('fs');
const Store = require('./store');
const { setupIpc } = require('./ipc');
const { createMenu } = require('./menu');
const { createTray } = require('./tray');

const isDev = process.env.ELECTRON_DEV === 'true';
const DEV_URL = 'http://localhost:5002';

// ── Otimizações de memória (antes do app.whenReady) ───────────────────────────

app.commandLine.appendSwitch(
  'js-flags',
  '--max-old-space-size=512 --optimize-for-size --gc-interval=100 --expose-gc'
);

app.commandLine.appendSwitch('disable-features', [
  'TranslateUI',
  'AutofillServerCommunication',
  'CalculateNativeWinOcclusion',
  'PrintCompositor',
  'HardwareMediaKeyHandling',
  'MediaRouter',
  'GlobalMediaControls',
  'WebUSB',
  'WebBluetooth',
  'BackForwardCache',
].join(','));

app.commandLine.appendSwitch('disk-cache-size', String(64 * 1024 * 1024));
app.commandLine.appendSwitch('disable-gpu-shader-disk-cache');
app.commandLine.appendSwitch('renderer-process-limit', '4');

// ─────────────────────────────────────────────────────────────────────────────

let mainWindow    = null;
let outputWindow  = null;
let returnWindow  = null;
let loadingWindow = null;

// Previne múltiplas instâncias
const gotLock = app.requestSingleInstanceLock();
if (!gotLock) {
  app.quit();
} else {
  app.on('second-instance', () => {
    if (mainWindow) {
      if (mainWindow.isMinimized()) mainWindow.restore();
      mainWindow.focus();
    }
  });
}

// ── Helpers ───────────────────────────────────────────────────────────────────
const FADE_DURATION_MS = 450;

function sleep(ms) {
  return new Promise(r => setTimeout(r, ms));
}

async function fadeOutAndClose(win) {
  if (!win || win.isDestroyed()) return;
  win.webContents.send('output-closing');
  await sleep(FADE_DURATION_MS);
  if (!win.isDestroyed()) win.close();
}

function tryGC() {
  try { if (global.gc) global.gc(); } catch { /* */ }
}

function getAppUrl(hash = '') {
  if (isDev) return `${DEV_URL}/${hash}`;
  return `file://${path.join(__dirname, '../dist/index.html')}${hash}`;
}

// ── Janela de loading ─────────────────────────────────────────────────────────
function createLoadingWindow() {
  const { width: sw, height: sh } = screen.getPrimaryDisplay().workAreaSize;
  const w = 460, h = 280;

  loadingWindow = new BrowserWindow({
    width: w,
    height: h,
    x: Math.floor((sw - w) / 2),
    y: Math.floor((sh - h) / 2),
    transparent: true,
    backgroundColor: '#00000000',
    alwaysOnTop: true,
    resizable: false,
    frame: false,
    skipTaskbar: true,
    icon: path.join(__dirname, '../public/ico/favicon.png'),
    webPreferences: {
      nodeIntegration: false,
      contextIsolation: true,
    },
    show: false,
  });

  const loadingPath = isDev
    ? path.join(__dirname, '../public/loading.html')
    : path.join(__dirname, '../dist/loading.html');

  loadingWindow.loadFile(loadingPath);

  loadingWindow.once('ready-to-show', () => {
    if (loadingWindow && !loadingWindow.isDestroyed()) loadingWindow.show();

    // Loading visível — agora inicia o carregamento da janela principal
    createMainWindow();
    registerIpcHandlers();
    setupIpc(mainWindow);
    createMenu(mainWindow, isDev);
    try {
      createTray(mainWindow);
    } catch (e) {
      console.warn('[Main] Tray indisponível:', e.message);
    }
  });

  loadingWindow.once('closed', () => { loadingWindow = null; });
}

// ── Janela principal ──────────────────────────────────────────────────────────
function createMainWindow() {
  const saved = Store.get('windowState', {});
  const firstLaunch = !saved.width;
  const primary = screen.getPrimaryDisplay();
  const { width: screenW, height: screenH } = primary.workAreaSize;

  // Lê o tema salvo para definir backgroundColor antes do Vue montar
  const DARK_THEME_NAMES = new Set([
    'dark', 'dark-blue', 'dark-darkblue', 'dark-navy',
    'dark-green', 'dark-orange', 'dark-purple', 'dark-pink', 'ocean-blue',
  ]);
  const userData = Store.get('user_data', {});
  const savedTheme = (userData && userData.theme) || '';
  const windowBgColor = DARK_THEME_NAMES.has(savedTheme) ? '#121212' : '#FAFAFA';

  mainWindow = new BrowserWindow({
    width: saved.width || screenW,
    height: saved.height || screenH,
    x: saved.x,
    y: saved.y,
    minWidth: 900,
    minHeight: 600,
    frame: false,
    backgroundColor: windowBgColor,
    icon: path.join(__dirname, '../public/ico/favicon.png'),
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
      webSecurity: !isDev,
      devTools: isDev,
      spellcheck: false,
      backgroundThrottling: true,
    },
    show: false,
  });

  mainWindow.loadURL(getAppUrl());

  mainWindow.once('ready-to-show', () => {
    // setOpacity(0) ANTES do maximize: o maximize() chama show() internamente,
    // então a janela precisa estar invisível antes de ser exibida
    mainWindow.setOpacity(0);
    if (saved.maximized || firstLaunch) mainWindow.maximize();
    if (isDev) mainWindow.webContents.openDevTools();
    mainWindow.show();
  });

  const saveState = () => {
    if (!mainWindow || mainWindow.isDestroyed()) return;
    const b = mainWindow.getBounds();
    Store.set('windowState', { ...b, maximized: mainWindow.isMaximized() });
  };
  mainWindow.on('resize', saveState);
  mainWindow.on('move', saveState);
  mainWindow.on('maximize',   () => Store.set('windowState.maximized', true));
  mainWindow.on('unmaximize', () => Store.set('windowState.maximized', false));

  mainWindow.on('minimize', () => {
    mainWindow.webContents.setBackgroundThrottling(true);
    tryGC();
  });

  mainWindow.on('closed', () => {
    mainWindow = null;
    if (outputWindow && !outputWindow.isDestroyed()) outputWindow.close();
    if (returnWindow && !returnWindow.isDestroyed()) returnWindow.destroy();
    tryGC();
  });
}

// ── Janela de saída (apresentação) ────────────────────────────────────────────
function createOutputWindow(moduleId, displayId) {
  if (outputWindow && !outputWindow.isDestroyed()) {
    outputWindow.focus();
    if (moduleId) outputWindow.webContents.send('set-module', moduleId);
    return outputWindow;
  }

  const allDisplays = screen.getAllDisplays();
  const primary     = screen.getPrimaryDisplay();
  const external    = allDisplays.find((d) => d.id !== primary.id);

  const targetId = displayId || Store.get('output_display_id');
  if (displayId) Store.set('output_display_id', displayId);

  let target = targetId ? allDisplays.find((d) => d.id === targetId) : null;
  if (!target) target = external || primary;

  const { x, y, width, height } = target.bounds;
  const isExternal = target.id !== primary.id;

  outputWindow = new BrowserWindow({
    x, y, width, height,
    frame: false,
    fullscreen: isExternal,
    alwaysOnTop: !isDev,
    transparent: true,
    backgroundColor: '#00000000',
    icon: path.join(__dirname, '../public/ico/favicon.png'),
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
      webSecurity: !isDev,
      spellcheck: false,
      backgroundThrottling: false,
    },
    show: false,
  });

  const hash = moduleId ? `#/popup?module=${moduleId}` : '#/popup';
  outputWindow.loadURL(getAppUrl(hash));

  outputWindow.once('ready-to-show', () => {
    outputWindow.show();
    if (mainWindow && !mainWindow.isDestroyed()) {
      mainWindow.webContents.send('output-window-opened');
    }
  });

  outputWindow.on('closed', () => {
    outputWindow = null;
    if (mainWindow && !mainWindow.isDestroyed()) {
      mainWindow.webContents.send('output-window-closed');
    }
    tryGC();
  });

  return outputWindow;
}

// ── Janela de retorno (monitor de palco) ──────────────────────────────────────
function createReturnWindow(displayId) {
  if (returnWindow && !returnWindow.isDestroyed()) {
    returnWindow.focus();
    return returnWindow;
  }

  const allDisplays = screen.getAllDisplays();
  const primary     = screen.getPrimaryDisplay();

  const targetId = displayId || Store.get('return_display_id');
  if (displayId) Store.set('return_display_id', displayId);

  let target = targetId ? allDisplays.find(d => d.id === targetId) : null;
  if (!target) target = primary;

  const { x, y, width, height } = target.bounds;

  returnWindow = new BrowserWindow({
    x, y, width, height,
    frame: false,
    closable: false,
    alwaysOnTop: !isDev,
    icon: path.join(__dirname, '../public/ico/favicon.png'),
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
      webSecurity: !isDev,
      spellcheck: false,
      backgroundThrottling: false,
    },
    show: false,
  });

  returnWindow.loadURL(getAppUrl('#/return-screen'));

  returnWindow.once('ready-to-show', () => {
    returnWindow.show();
    if (mainWindow && !mainWindow.isDestroyed()) {
      mainWindow.webContents.send('return-window-opened');
    }
  });

  returnWindow.on('closed', () => {
    returnWindow = null;
    if (mainWindow && !mainWindow.isDestroyed()) {
      mainWindow.webContents.send('return-window-closed');
    }
    tryGC();
  });

  return returnWindow;
}

// ── Auto-updater ──────────────────────────────────────────────────────────────
function setupAutoUpdater() {
  autoUpdater.autoDownload = false;
  autoUpdater.autoInstallOnAppQuit = true;
  autoUpdater.logger = null; // silencia logs internos do electron-updater

  const send = (channel, payload) => {
    if (mainWindow && !mainWindow.isDestroyed()) {
      mainWindow.webContents.send(channel, payload);
    }
  };

  autoUpdater.on('checking-for-update',  ()       => send('updater:checking'));
  autoUpdater.on('update-available',     (info)   => send('updater:available', info));
  autoUpdater.on('update-not-available', (info)   => send('updater:not-available', info));
  autoUpdater.on('download-progress',    (prog)   => send('updater:progress', prog));
  autoUpdater.on('update-downloaded',    (info)   => send('updater:downloaded', info));
  autoUpdater.on('error',                (err)    => send('updater:error', err?.message || String(err)));

  ipcMain.handle('updater:check',    async () => {
    try { await autoUpdater.checkForUpdates(); } catch (e) { send('updater:error', e.message); }
  });
  ipcMain.handle('updater:download', async () => {
    try { await autoUpdater.downloadUpdate(); } catch (e) { send('updater:error', e.message); }
  });
  ipcMain.handle('updater:install',  () => {
    setImmediate(() => autoUpdater.quitAndInstall());
  });
}

// ── Registrar handlers IPC ────────────────────────────────────────────────────
function registerIpcHandlers() {
  // Auto-updater (registra handlers e eventos mesmo em dev para não dar erro de IPC)
  if (!isDev && app.isPackaged) {
    setupAutoUpdater();
  } else {
    // Dev: stubs para não quebrar os invoke do renderer
    ipcMain.handle('updater:check',    () => {});
    ipcMain.handle('updater:download', () => {});
    ipcMain.handle('updater:install',  () => {});
  }

  ipcMain.handle('window:minimize',     () => mainWindow?.minimize());
  ipcMain.handle('window:maximize',     () => {
    if (!mainWindow) return;
    if (mainWindow.isMaximized()) mainWindow.unmaximize();
    else mainWindow.maximize();
  });
  ipcMain.handle('window:close',        () => mainWindow?.destroy());
  ipcMain.handle('window:is-maximized', () => mainWindow?.isMaximized() ?? false);
  ipcMain.handle('window:set-title',    (_, title) => mainWindow?.setTitle(title || 'LouvorJA'));

  ipcMain.handle('output:open', (_, moduleId, displayId) => {
    createOutputWindow(moduleId, displayId);
    return true;
  });
  ipcMain.handle('output:close', async () => {
    if (returnWindow && !returnWindow.isDestroyed()) {
      returnWindow.webContents.send('return-closing');
    }
    await fadeOutAndClose(outputWindow);
    if (returnWindow && !returnWindow.isDestroyed()) returnWindow.destroy();
    return true;
  });
  ipcMain.handle('output:is-open', () => {
    return !!(outputWindow && !outputWindow.isDestroyed());
  });
  ipcMain.handle('output:set-module', (_, moduleId) => {
    if (outputWindow && !outputWindow.isDestroyed()) {
      outputWindow.webContents.send('set-module', moduleId);
    }
    return true;
  });

  ipcMain.handle('return:open', (_, displayId) => {
    createReturnWindow(displayId);
    return true;
  });
  ipcMain.handle('return:close', () => {
    if (returnWindow && !returnWindow.isDestroyed()) returnWindow.destroy();
    return true;
  });
  ipcMain.handle('return:is-open', () => {
    return !!(returnWindow && !returnWindow.isDestroyed());
  });

  ipcMain.on('state-update', (_, data) => {
    if (outputWindow && !outputWindow.isDestroyed()) {
      outputWindow.webContents.send('state-update', data);
    }
    if (returnWindow && !returnWindow.isDestroyed()) {
      returnWindow.webContents.send('state-update', data);
    }
  });

  ipcMain.on('output:ready', () => {
    if (mainWindow && !mainWindow.isDestroyed()) {
      mainWindow.webContents.send('output-ready');
    }
  });

  // Vue sinaliza que está pronto: fade-in da janela principal + fecha loading
  ipcMain.once('app:loaded', () => {
    if (!mainWindow || mainWindow.isDestroyed()) return;
    let opacity = 0;
    const step = () => {
      opacity = Math.min(1, opacity + 0.06);
      if (!mainWindow.isDestroyed()) mainWindow.setOpacity(opacity);
      if (opacity < 1) {
        setTimeout(step, 16);
      } else if (loadingWindow && !loadingWindow.isDestroyed()) {
        loadingWindow.close();
      }
    };
    step();

    // Verifica atualizações automaticamente em produção (15s de delay para não competir com o startup)
    if (!isDev && app.isPackaged) {
      setTimeout(() => {
        try { autoUpdater.checkForUpdates().catch(() => {}); } catch (_) {}
      }, 15000);
    }

    // Após o fade-in: verifica se SQLite já foi aberto por trySqliteAutoOpen (ipc.js).
    // Se sim, notifica o renderer. Se não (race condition ou primeira execução sem banco salvo),
    // tenta abrir com as mediaDirs corretas antes de notificar.
    // Fallback: dispara sqlite:auto-import para gerar JSONs em db/ se necessário.
    setTimeout(async () => {
      try {
        if (!mainWindow || mainWindow.isDestroyed()) return;

        const sqliteReader = require('./sqlite-reader');

        const exeDir   = app.isPackaged
          ? (process.env.PORTABLE_EXECUTABLE_DIR || path.dirname(app.getPath('exe')))
          : app.getPath('userData');
        const userData = app.getPath('userData');

        // Locais candidatos para database.db
        const candidates = [
          path.join(exeDir,   'config', 'database.db'),
          path.join(userData, 'config', 'database.db'),
          path.join(userData, 'database.db'),
        ];

        const dbPath = candidates.find(p => fs.existsSync(p) && fs.statSync(p).size > 100);
        if (!dbPath) return; // nenhum banco encontrado — app usa apenas API

        if (sqliteReader.isAvailable()) {
          // Abre se ainda não estiver aberto (ipc.js pode ter aberto em paralelo).
          // Passa mediaDirs para que imagens e áudio resolvam corretamente.
          if (!sqliteReader.isOpen()) {
            let writableBase = exeDir;
            try { fs.writeFileSync(path.join(exeDir, '.wtest'), ''); fs.unlinkSync(path.join(exeDir, '.wtest')); }
            catch (_) { writableBase = userData; }

            const writableConfig = path.join(writableBase, 'config');
            const installConfig  = path.join(exeDir, 'config');
            const mediaDirs = {
              capasDir:   path.join(writableConfig, 'capas'),
              musicasDir: path.join(writableConfig, 'musicas'),
              imagensDir: path.join(writableConfig, 'imagens'),
              // fallback: instalação original (read-only, ex: Program Files)
              _installCapas:   path.join(installConfig, 'capas'),
              _installMusicas: path.join(installConfig, 'musicas'),
              _installImagens: path.join(installConfig, 'imagens'),
            };
            try { await sqliteReader.open(dbPath, mediaDirs); } catch (_) {}
          }

          // Notifica o renderer para atualizar o status na UI
          if (sqliteReader.isOpen()) {
            if (mainWindow && !mainWindow.isDestroyed()) {
              mainWindow.webContents.send('sqlite:direct-ready', { path: dbPath });
            }
            return;
          }
        }

        // ── Fallback: aciona import SQLite → JSON se pt_categories.json não existe ─
        let writableBase = exeDir;
        try { fs.writeFileSync(path.join(exeDir, '.wtest'), ''); fs.unlinkSync(path.join(exeDir, '.wtest')); }
        catch (_) { writableBase = userData; }

        const dbDir   = Store.get('db_local_folder') || path.join(writableBase, 'db');
        const catFile = path.join(dbDir, 'pt_categories.json');

        if (!fs.existsSync(catFile)) {
          mainWindow.webContents.send('sqlite:auto-import', { dbPath });
        }
      } catch (_) {}
    }, 1500);
  });
}

// ── Inicialização ─────────────────────────────────────────────────────────────
app.whenReady().then(() => {
  Store.init();

  session.defaultSession.clearCache();
  session.defaultSession.clearStorageData({
    storages: ['appcache', 'serviceworkers', 'cachestorage'],
  });

  createLoadingWindow();

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createMainWindow();
  });
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit();
});
