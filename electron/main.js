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
const remoteServer = require('./remote_server');

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
let pipWindow     = null;

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
  if (!win.isDestroyed()) win.destroy();
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

    // Registra handlers IPC ANTES de createMainWindow para eliminar a janela de
    // corrida onde o renderer envia app:loaded antes do handler estar registrado.
    registerIpcHandlers();

    // Loading visível — agora inicia o carregamento da janela principal
    createMainWindow();
    setupIpc(mainWindow);
    createMenu(mainWindow, isDev);
    try {
      createTray(mainWindow);
    } catch (e) {
      console.warn('[Main] Tray indisponível:', e.message);
    }

    // Segurança: se app:loaded nunca chegar (falha silenciosa no renderer),
    // fecha a loading window após 15s para o app não ficar travado.
    setTimeout(() => {
      if (loadingWindow && !loadingWindow.isDestroyed()) {
        console.warn('[Main] Timeout: app:loaded não recebido — forçando fechamento da loading window');
        loadingWindow.destroy();
        if (mainWindow && !mainWindow.isDestroyed()) mainWindow.setOpacity(1);
      }
    }, 15000);
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
    // Usa destroy() para garantir fechamento mesmo em fullscreen/alwaysOnTop
    if (outputWindow && !outputWindow.isDestroyed()) outputWindow.destroy();
    if (returnWindow && !returnWindow.isDestroyed()) returnWindow.destroy();
    if (pipWindow && !pipWindow.isDestroyed()) pipWindow.destroy();
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

// ── Janela flutuante do player de vídeo (PIP no modo operador) ────────────────
// Mini player sempre visível por cima das outras janelas do app (não da tela de
// projeção), para o operador acompanhar o vídeo e controlar play/pause sem
// precisar deixar o módulo de Vídeo em foco.
function createPipWindow() {
  if (pipWindow && !pipWindow.isDestroyed()) {
    pipWindow.focus();
    return pipWindow;
  }

  // Ancora na tela onde a janela principal (operador) está — NUNCA em
  // screen.getPrimaryDisplay() puro. Se o Windows estiver configurado com o
  // monitor/projetor externo como "tela principal" do sistema (comum em
  // configurações de som/imagem), getPrimaryDisplay() apontava pra lá, e o
  // mini player flutuante nascia por cima da própria projeção — visível pra
  // plateia — em vez de ficar na tela do operador.
  const anchorDisplay = (mainWindow && !mainWindow.isDestroyed())
    ? screen.getDisplayMatching(mainWindow.getBounds())
    : screen.getPrimaryDisplay();
  const { x: ax, y: ay, width: sw, height: sh } = anchorDisplay.workArea;
  const w = 340, h = 210;

  pipWindow = new BrowserWindow({
    width: w,
    height: h,
    x: ax + sw - w - 24,
    y: ay + sh - h - 24,
    minWidth: 220,
    minHeight: 140,
    frame: false,
    alwaysOnTop: true,
    resizable: true,
    skipTaskbar: true,
    backgroundColor: '#000000',
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
  pipWindow.setAlwaysOnTop(true, 'floating');

  pipWindow.loadURL(getAppUrl('#/video-pip'));

  pipWindow.once('ready-to-show', () => {
    if (pipWindow && !pipWindow.isDestroyed()) pipWindow.show();
  });

  pipWindow.on('closed', () => {
    pipWindow = null;
    if (mainWindow && !mainWindow.isDestroyed()) {
      mainWindow.webContents.send('video-pip:closed');
    }
  });

  return pipWindow;
}

// ── Auto-updater ──────────────────────────────────────────────────────────────
function sendToRenderer(channel, payload) {
  if (mainWindow && !mainWindow.isDestroyed()) {
    mainWindow.webContents.send(channel, payload);
  }
}

// console.error some no vazio numa GUI empacotada sem terminal anexado — sem
// isso, uma falha real de update é indiagnosticável depois do fato.
function logUpdaterError(context, err) {
  try {
    const line = `[${new Date().toISOString()}] ${context}: ${err?.stack || err?.message || err}\n`;
    fs.appendFileSync(path.join(app.getPath('userData'), 'updater.log'), line);
  } catch (_) { /* não crítico — só o console.error já emitido segue valendo */ }
}

// Fonte: GitHub Releases via electron-updater (ver build.publish em package.json).
//
// Qualquer falha durante a VERIFICAÇÃO é tratada como "sem atualização
// disponível" — o usuário que clica em "Verificar atualizações" não precisa
// saber a razão técnica, só se há ou não uma versão nova. A tela de erro fica
// reservada para falhas de download (ver isCheckingUpdate abaixo e o handler
// 'updater:download').
let isCheckingUpdate = false;

async function runUpdateCheck() {
  sendToRenderer('updater:checking');

  isCheckingUpdate = true;
  try {
    await autoUpdater.checkForUpdates();
  } catch (e) {
    console.error('[updater] Falha ao verificar no GitHub:', e.message || e);
    logUpdaterError('check', e);
    sendToRenderer('updater:not-available', {});
  } finally {
    isCheckingUpdate = false;
  }
}

// Tenta o download algumas vezes com espera entre tentativas antes de desistir.
// Motivo: um release recém-publicado no GitHub pode levar de segundos a alguns
// MINUTOS pra terminar de propagar (arquivos grandes de ~150MB passam por
// verificação antes de ficar baixáveis via browser_download_url) — confirmado
// na prática: um release apareceu com os assets listados na API mas retornando
// 404 no download por vários minutos seguidos. Sem isso, um "Baixar agora"
// clicado logo após o publish falha mesmo o release já estando "publicado".
// Atraso progressivo (10s, 15s, 20s, 25s, 30s) soma ~100s de tolerância total.
const DOWNLOAD_RETRY_DELAYS_MS = [10000, 15000, 20000, 25000, 30000];

// isRetryingDownload sinaliza pro listener global 'error' (abaixo) não repassar
// pro renderer as falhas das tentativas intermediárias — só a última, se todas
// falharem — senão o usuário veria a tela de erro piscar mesmo quando uma
// tentativa posterior dá certo.
let isRetryingDownload = false;

async function downloadUpdateWithRetry() {
  isRetryingDownload = true;
  try {
    const maxAttempts = DOWNLOAD_RETRY_DELAYS_MS.length + 1;
    let lastErr;
    for (let attempt = 1; attempt <= maxAttempts; attempt++) {
      try {
        return await autoUpdater.downloadUpdate();
      } catch (e) {
        lastErr = e;
        logUpdaterError(`download tentativa ${attempt}/${maxAttempts} falhou`, e);
        const delayMs = DOWNLOAD_RETRY_DELAYS_MS[attempt - 1];
        if (delayMs) {
          await new Promise((resolve) => setTimeout(resolve, delayMs));
        }
      }
    }
    throw lastErr;
  } finally {
    isRetryingDownload = false;
  }
}

function setupAutoUpdater() {
  autoUpdater.autoDownload = false;
  autoUpdater.autoInstallOnAppQuit = true;
  autoUpdater.logger = null; // silencia logs internos do electron-updater
  // Histórico de releases já teve tags reaproveitadas apontando pra conteúdo
  // diferente do esperado — um download diferencial (baseado no .blockmap da
  // versão anterior) é bem mais frágil nesse cenário do que baixar o instalador
  // completo de novo. Desliga a otimização em troca de confiabilidade.
  autoUpdater.disableDifferentialDownload = true;

  autoUpdater.on('checking-for-update',  ()       => sendToRenderer('updater:checking'));
  autoUpdater.on('update-available',     (info)   => sendToRenderer('updater:available', info));
  autoUpdater.on('update-not-available', (info)   => sendToRenderer('updater:not-available', info));
  autoUpdater.on('download-progress',    (prog)   => sendToRenderer('updater:progress', prog));
  autoUpdater.on('update-downloaded',    (info)   => sendToRenderer('updater:downloaded', info));
  autoUpdater.on('error', (err) => {
    const msg = err?.message || String(err);
    console.error('[updater] Erro do autoUpdater:', msg);
    logUpdaterError('autoUpdater error event', err);
    // Erro durante a verificação (não durante o download) → sem atualização
    if (isCheckingUpdate) {
      sendToRenderer('updater:not-available', {});
      return;
    }
    // Falha de uma tentativa intermediária do retry — não repassa ainda (ver
    // downloadUpdateWithRetry); só a falha final (lançada pro catch do handler
    // 'updater:download' abaixo) chega no renderer.
    if (isRetryingDownload) return;
    sendToRenderer('updater:error', msg);
  });

  ipcMain.handle('updater:check', () => runUpdateCheck());

  ipcMain.handle('updater:download', async () => {
    try {
      await downloadUpdateWithRetry();
    } catch (e) {
      logUpdaterError('download', e);
      sendToRenderer('updater:error', e.message);
    }
  });

  ipcMain.handle('updater:install', () => {
    setImmediate(() => autoUpdater.quitAndInstall());
  });
}

// ── Registrar handlers IPC ────────────────────────────────────────────────────
function registerIpcHandlers() {
  // Auto-updater: electron-updater/GitHub Releases já trata sua própria falha
  // em dev (sem app-update.yml) como "sem atualização", ver runUpdateCheck().
  setupAutoUpdater();

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
  ipcMain.handle('return:close', async () => {
    if (returnWindow && !returnWindow.isDestroyed()) {
      // Mesmo sinal usado quando a saída fecha em cascata (ver output:close) —
      // o handler em ReturnScreen.vue já faz o fade da tela toda para 0.
      returnWindow.webContents.send('return-closing');
      await sleep(FADE_DURATION_MS);
      if (returnWindow && !returnWindow.isDestroyed()) returnWindow.destroy();
    }
    return true;
  });
  ipcMain.handle('return:is-open', () => {
    return !!(returnWindow && !returnWindow.isDestroyed());
  });

  // ── Janela flutuante (PIP) do player de vídeo ────────────────────────────
  ipcMain.handle('video-pip:open', () => {
    createPipWindow();
    return true;
  });
  ipcMain.handle('video-pip:close', () => {
    if (pipWindow && !pipWindow.isDestroyed()) pipWindow.destroy();
    return true;
  });
  ipcMain.handle('video-pip:is-open', () => {
    return !!(pipWindow && !pipWindow.isDestroyed());
  });
  // Comandos vindos da janela PIP (play/pause, parar) são repassados para a
  // janela principal, que é a dona da config compartilhada do módulo de vídeo
  // — assim o play/pause controla o mesmo vídeo/áudio real da projeção.
  ipcMain.on('video-pip:toggle-play', (event) => {
    if (mainWindow && !mainWindow.isDestroyed() && event.sender !== mainWindow.webContents) {
      mainWindow.webContents.send('video-pip:toggle-play');
    }
  });
  ipcMain.on('video-pip:stop', (event) => {
    if (mainWindow && !mainWindow.isDestroyed() && event.sender !== mainWindow.webContents) {
      mainWindow.webContents.send('video-pip:stop');
    }
  });
  // Progresso de reprodução (currentTime/duration) da janela de saída pra
  // janela principal — canal dedicado, não passa pelo state-update genérico
  // (ver comentário em preload.js).
  ipcMain.on('video-player:progress', (event, data) => {
    if (mainWindow && !mainWindow.isDestroyed() && event.sender !== mainWindow.webContents) {
      mainWindow.webContents.send('video-player:progress', data);
    }
  });

  // data.target (opcional): sincronização completa pedida por UMA janela
  // específica (ver 'output:ready' abaixo) — vai só pra ela. Sem isso, o
  // resync completo de uma janela (ex.: PIP abrindo) reenviava também pra
  // outputWindow campos que só ela mesma atualiza localmente e nunca manda
  // de volta (ex. currentTime do vídeo em reprodução), fazendo a projeção
  // saltar de volta pra um tempo antigo — visualmente "reiniciava" o vídeo.
  ipcMain.on('state-update', (_, data) => {
    remoteServer.applyStateEntry(data);
    if (data && data.target === 'output') {
      if (outputWindow && !outputWindow.isDestroyed()) outputWindow.webContents.send('state-update', data);
      return;
    }
    if (data && data.target === 'return') {
      if (returnWindow && !returnWindow.isDestroyed()) returnWindow.webContents.send('state-update', data);
      return;
    }
    if (data && data.target === 'pip') {
      if (pipWindow && !pipWindow.isDestroyed()) pipWindow.webContents.send('state-update', data);
      return;
    }
    // Sem target: atualização "ao vivo" normal — broadcast pra todas (comportamento original)
    if (outputWindow && !outputWindow.isDestroyed()) {
      outputWindow.webContents.send('state-update', data);
    }
    if (returnWindow && !returnWindow.isDestroyed()) {
      returnWindow.webContents.send('state-update', data);
    }
    if (pipWindow && !pipWindow.isDestroyed()) {
      pipWindow.webContents.send('state-update', data);
    }
  });

  // Lote atômico (ver AppData.js setMultiple / preload.js) — sempre
  // broadcast (só usado para atualizações "ao vivo", nunca resync completo).
  ipcMain.on('state-update-batch', (_, entries) => {
    (entries || []).forEach((entry) => remoteServer.applyStateEntry(entry));
    if (outputWindow && !outputWindow.isDestroyed()) outputWindow.webContents.send('state-update-batch', entries);
    if (returnWindow && !returnWindow.isDestroyed()) returnWindow.webContents.send('state-update-batch', entries);
    if (pipWindow && !pipWindow.isDestroyed()) pipWindow.webContents.send('state-update-batch', entries);
  });

  // Foco de áudio entre janelas — diferente de 'state-update' (que só vai da
  // janela principal para a de saída), este é bidirecional: quem começa a
  // tocar (mainWindow ou outputWindow) avisa TODAS as outras janelas, exceto
  // a que enviou, para pararem o próprio áudio.
  ipcMain.on('audio-focus-request', (event, data) => {
    if (mainWindow && !mainWindow.isDestroyed() && event.sender !== mainWindow.webContents) {
      mainWindow.webContents.send('audio-focus-request', data);
    }
    if (outputWindow && !outputWindow.isDestroyed() && event.sender !== outputWindow.webContents) {
      outputWindow.webContents.send('audio-focus-request', data);
    }
  });

  // target identifica QUEM pediu o resync ('output' | 'return' | 'pip') —
  // repassado pra SystemBar.vue poder marcar cada state-update do resync
  // com esse mesmo target, ver comentário em 'state-update' acima.
  ipcMain.on('output:ready', (_, target) => {
    if (mainWindow && !mainWindow.isDestroyed()) {
      mainWindow.webContents.send('output-ready', target);
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
        loadingWindow.destroy();
      }
    };
    step();

    // Verifica atualizações automaticamente em produção (15s de delay para não competir com o startup)
    // via GitHub Releases (electron-updater) — ver runUpdateCheck().
    if (!isDev && app.isPackaged) {
      setTimeout(() => {
        runUpdateCheck().catch(() => {});
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

app.on('before-quit', () => {
  remoteServer.stop();
});
