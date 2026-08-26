const { app, BrowserWindow, ipcMain, screen, session, protocol, dialog, shell } = require('electron');
const { autoUpdater } = require('electron-updater');
const https = require('https');

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

// Espelha "popup_module" (ver relay de 'state-update' abaixo) — só pra saber,
// aqui no processo main, qual módulo está projetado agora. Necessário porque
// o ESC em módulos com iframe (ex. web_link, ver 'before-input-event' em
// createOutputWindow) não chega no listener de keydown do renderer quando o
// foco do teclado está dentro do iframe (conteúdo de outra origem não
// propaga eventos de teclado pro documento pai) — o processo main consegue
// interceptar antes disso, mas só deve agir para o módulo certo.
let currentPopupModule = null;

// Lembra se a projeção deve reabrir sozinha na próxima vez que o app for
// aberto (ver restauração em ipcMain.once('app:loaded')) — "" (só acontece
// quando o operador fecha a projeção de propósito, ver Popup.js#exit) marca
// que NÃO deve reabrir; um módulo real marca que deve, MAS só se a janela de
// saída estiver de fato aberta nesse momento (ver checagem abaixo) — ver
// createOutputWindow (Store.set('output_window_was_open', true) no
// ready-to-show) pra quando ela vira true de verdade. Chamado tanto por
// 'state-update' quanto por 'state-update-batch' (Media.maximize() — o
// fluxo mais comum, projetar uma música — manda popup_module dentro de um
// lote via setMultiple, não por um 'state-update' avulso; sem cobrir os
// dois canais aqui, o módulo nunca era lembrado pra restaurar nesse caso,
// que é o mais frequente na prática).
//
// A checagem de outputWindow aberta existe porque popup_module pode mudar
// SEM a janela de saída estar aberta — a própria Media.maximize() documenta
// que isso vira no-op nesse caso (ex.: o operador reabre a barra de áudio
// minimizada depois de já ter fechado a projeção). Sem essa checagem, esse
// no-op ainda gravava "deve reabrir" no Store, e a próxima abertura do app
// tentava restaurar uma projeção que nunca esteve de fato na tela.
function rememberPopupModuleForRestore(entry) {
  if (!entry || entry.param !== 'popup_module') return;
  currentPopupModule = entry.value || null;
  if (entry.value) {
    if (outputWindow && !outputWindow.isDestroyed()) {
      Store.set('output_window_was_open', true);
      Store.set('output_window_last_module', entry.value);
    }
  } else {
    Store.set('output_window_was_open', false);
  }
}

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

// Repinta uma janela transparente algumas vezes ao longo de ~300ms. Motivo:
// criar uma janela em camadas (transparent+alwaysOnTop) nova pode fazer OUTRA
// janela transparente já aberta perder a composição de alpha no Windows e
// renderizar em preto sólido até o próximo repaint (ver comentários em
// createOutputWindow/createReturnWindow) — mas esse "furo" do DWM acontece de
// forma assíncrona, um pouco DEPOIS que a nova janela é de fato apresentada,
// não no instante do show()/ready-to-show. Uma única chamada de invalidate()
// imediata corre o risco de rodar ANTES do glitch acontecer e não ter efeito
// nenhum — foi o que deixava a saída principal "preta" (parecendo encerrada)
// ao abrir o retorno. Repetir cobre essa janela de tempo sem depender do
// usuário mexer na janela pra forçar um repaint real.
function nudgeRepaint(win) {
  for (const delay of [0, 60, 150, 300]) {
    setTimeout(() => {
      if (win && !win.isDestroyed()) win.webContents.invalidate();
    }, delay);
  }
}

// Resolve qual monitor usar para a janela de saída: o salvo no Store (se ainda
// existir), senão o primeiro monitor externo, senão o primário. Extraído para
// ser reaproveitado tanto na abertura (createOutputWindow) quanto ao reagir a
// mudanças de monitores com a janela já aberta (ver reconcileDisplays()).
function resolveOutputDisplay(displayId) {
  const allDisplays = screen.getAllDisplays();
  const primary     = screen.getPrimaryDisplay();
  const external    = allDisplays.find((d) => d.id !== primary.id);

  const targetId = displayId || Store.get('output_display_id');
  if (displayId) Store.set('output_display_id', displayId);

  let target = targetId ? allDisplays.find((d) => d.id === targetId) : null;
  if (!target) target = external || primary;

  return { target, isExternal: target.id !== primary.id };
}

// ── Janela de saída (apresentação) ────────────────────────────────────────────
function createOutputWindow(moduleId, displayId) {
  if (outputWindow && !outputWindow.isDestroyed()) {
    outputWindow.focus();
    if (moduleId) outputWindow.webContents.send('set-module', moduleId);
    return outputWindow;
  }

  const { target, isExternal } = resolveOutputDisplay(displayId);
  const { x, y, width, height } = target.bounds;

  outputWindow = new BrowserWindow({
    x, y, width, height,
    frame: false,
    fullscreen: isExternal,
    // Sem isso, mesmo sem frame visível o Windows ainda deixa arrastar as
    // bordas invisíveis pra redimensionar e a janela inteira pra mover — a
    // saída tem que ficar travada exatamente no tamanho/posição do monitor
    // escolhido, nunca ajustável pelo usuário.
    resizable: false,
    movable: false,
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

  // ESC com o link (web_link) projetado: se o foco do teclado estiver dentro
  // do iframe (ex.: cliques nos controles do player do YouTube), o keydown
  // não propaga pro documento pai — o listener de ESC do renderer nunca
  // dispara nesse caso. 'before-input-event' intercepta a tecla antes da
  // Chromium decidir pra qual frame entregar, então funciona independente
  // de qual frame está com o foco. Só age pro web_link — outros módulos já
  // têm seu próprio tratamento de ESC no renderer (ver views/Popup.vue e
  // video_player/interface/Popup.vue) e não precisam dessa via alternativa.
  outputWindow.webContents.on('before-input-event', (_event, input) => {
    if (input.type === 'keyDown' && input.key === 'Escape' && currentPopupModule === 'web_link') {
      fadeOutAndClose(outputWindow);
    }
  });

  const hash = moduleId ? `#/popup?module=${moduleId}` : '#/popup';
  outputWindow.loadURL(getAppUrl(hash));

  outputWindow.once('ready-to-show', () => {
    // Reforça bounds (+ fullscreen quando externo) antes de exibir — mesmo
    // motivo do createReturnWindow logo abaixo: em alguns casos no Windows a
    // opção do construtor não é suficiente sozinha e sobra uma faixa do
    // monitor descoberta, ou o usuário consegue "descolar" a janela do
    // tamanho certo antes desse reforço rodar.
    outputWindow.setBounds({ x, y, width, height });
    if (isExternal) outputWindow.setFullScreen(true);
    outputWindow.setResizable(false);
    outputWindow.setMovable(false);
    outputWindow.show();
    // Marca "deve reabrir sozinho da próxima vez" (ver restauração em
    // ipcMain.once('app:loaded')) só agora, que a janela de saída de fato
    // abriu — ver comentário em rememberPopupModuleForRestore sobre por que
    // isso não pode vir só de popup_module mudar. NÃO espelhar isso no
    // 'closed' abaixo: o cascade-destroy de mainWindow.on('closed') também
    // passa por ali ao encerrar o app inteiro, e apagar a flag nesse
    // momento destruiria a própria restauração que ela existe pra viabilizar.
    Store.set('output_window_was_open', true);
    if (mainWindow && !mainWindow.isDestroyed()) {
      mainWindow.webContents.send('output-window-opened');
    }
    // Mesmo nudge de repaint do lado do retorno (ver createReturnWindow) —
    // cobre o caso inverso: abrir a saída principal com o retorno já aberto.
    nudgeRepaint(returnWindow);
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

// Mesmo papel de resolveOutputDisplay(), para o monitor de retorno (sem
// preferência por monitor externo — cai direto pro primário).
function resolveReturnDisplay(displayId) {
  const allDisplays = screen.getAllDisplays();
  const primary     = screen.getPrimaryDisplay();

  const targetId = displayId || Store.get('return_display_id');
  if (displayId) Store.set('return_display_id', displayId);

  let target = targetId ? allDisplays.find(d => d.id === targetId) : null;
  if (!target) target = primary;

  return { target };
}

// ── Janela de retorno (monitor de palco) ──────────────────────────────────────
function createReturnWindow(displayId) {
  if (returnWindow && !returnWindow.isDestroyed()) {
    returnWindow.focus();
    return returnWindow;
  }

  const { target } = resolveReturnDisplay(displayId);
  const { x, y, width, height } = target.bounds;

  returnWindow = new BrowserWindow({
    x, y, width, height,
    frame: false,
    closable: false,
    // Sempre fullscreen (não só em monitor externo) — a janela precisa
    // preencher o monitor por completo em qualquer configuração; sem isso,
    // no Windows a borda de resize invisível do frame frameless deixava uma
    // faixa sem cobrir a tela (o usuário conseguia até arrastar pra redimensionar).
    fullscreen: true,
    alwaysOnTop: !isDev,
    // Transparente (igual à janela de saída) — sem isso, antes de qualquer
    // música tocar (visible=false em ReturnScreen.vue) a janela mostrava o
    // fundo escuro padrão do tema em vez de ficar em branco/transparente.
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

  returnWindow.loadURL(getAppUrl('#/return-screen'));

  returnWindow.once('ready-to-show', () => {
    // Reforça bounds + fullscreen antes de exibir — em alguns casos no Windows
    // a opção "fullscreen" do construtor não é suficiente por si só (a janela
    // fica só com o tamanho x/y/width/height inicial, deixando uma faixa do
    // monitor descoberta). Chamar de novo aqui garante a cobertura total.
    returnWindow.setBounds({ x, y, width, height });
    returnWindow.setFullScreen(true);
    returnWindow.setResizable(false);
    returnWindow.show();
    if (mainWindow && !mainWindow.isDestroyed()) {
      mainWindow.webContents.send('return-window-opened');
    }
    // Bug conhecido do Chromium/Electron no Windows: criar uma NOVA janela
    // transparente pode fazer janelas transparentes JÁ abertas (aqui, a saída
    // principal) perderem a composição de alpha e renderizarem com fundo
    // sólido preto até o próximo repaint — mesmo em monitores diferentes, sem
    // nenhuma sobreposição visual real. nudgeRepaint() força esse repaint
    // (repetidas vezes — ver comentário na função) sem esperar o usuário
    // mexer na janela pra "descongelar".
    nudgeRepaint(outputWindow);
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

// ── Auto-ajuste de resolução em tempo real ────────────────────────────────────
// Reage a monitor plugado/desplugado ou resolução alterada COM a projeção já
// aberta. Sem isso, createOutputWindow()/createReturnWindow() só pegavam os
// bounds corretos no momento de abrir a janela — se o monitor mudasse de
// resolução (ou fosse desconectado/trocado) depois, a janela ficava com o
// tamanho/posição antigos (parte da tela descoberta, ou presa num monitor que
// não existe mais). registerDisplayWatcher() (chamado uma vez em
// app.whenReady()) escuta screen.on('display-added'/'removed'/'metrics-changed')
// e reaplica a mesma resolução de monitor (resolveOutputDisplay/
// resolveReturnDisplay, com o mesmo fallback pro externo/primário) nas janelas
// que já estiverem abertas.
function reconcileDisplays() {
  if (outputWindow && !outputWindow.isDestroyed()) {
    try {
      const { target, isExternal } = resolveOutputDisplay();
      const { x, y, width, height } = target.bounds;
      outputWindow.setBounds({ x, y, width, height });
      outputWindow.setFullScreen(isExternal);
    } catch (_) {}
  }

  if (returnWindow && !returnWindow.isDestroyed()) {
    try {
      const { target } = resolveReturnDisplay();
      const { x, y, width, height } = target.bounds;
      returnWindow.setBounds({ x, y, width, height });
      returnWindow.setFullScreen(true);
    } catch (_) {}
  }

  // Avisa o operador pra atualizar a lista de monitores do seletor (MonitorSelector.vue)
  if (mainWindow && !mainWindow.isDestroyed()) {
    mainWindow.webContents.send('displays-changed');
  }
}

let _reconcileDisplaysTimer = null;
function scheduleReconcileDisplays() {
  // display-metrics-changed costuma disparar várias vezes seguidas durante a
  // própria mudança (Windows aplicando a nova resolução em etapas) — debounce
  // evita reaplicar bounds várias vezes com valores intermediários.
  clearTimeout(_reconcileDisplaysTimer);
  _reconcileDisplaysTimer = setTimeout(reconcileDisplays, 300);
}

function registerDisplayWatcher() {
  screen.on('display-added', scheduleReconcileDisplays);
  screen.on('display-removed', scheduleReconcileDisplays);
  screen.on('display-metrics-changed', scheduleReconcileDisplays);
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
// reservada para falhas de download (ver downloadInstallerWithRetry abaixo).
let isCheckingUpdate = false;

async function runUpdateCheck() {
  sendToRenderer('updater:checking');

  isCheckingUpdate = true;
  try {
    const r = await autoUpdater.checkForUpdates();
    // Em dev (app não empacotado, sem dev-app-update.yml), checkForUpdates()
    // resolve com null SEM emitir nenhum evento (ver isUpdaterActive() no
    // electron-updater) — sem isso o diálogo fica preso em "Verificando
    // atualizações..." pra sempre em dev. Em produção o autoUpdater sempre
    // emite 'update-available'/'update-not-available', então isso não
    // duplica evento nenhum ali.
    if (r == null) sendToRenderer('updater:not-available', {});
  } catch (e) {
    console.error('[updater] Falha ao verificar no GitHub:', e.message || e);
    logUpdaterError('check', e);
    sendToRenderer('updater:not-available', {});
  } finally {
    isCheckingUpdate = false;
  }
}

// ── Download do instalador ──────────────────────────────────────────────────
// electron-updater (autoUpdater.downloadUpdate) baixa sempre para a própria
// pasta de cache dele (%LOCALAPPDATA%\louvorja-updater) e depois instala
// silenciosamente — o usuário nunca escolhe o destino. Aqui o download do
// instalador é feito à parte, direto da API do GitHub Releases (mesma fonte
// do autoUpdater), só para poder perguntar ANTES onde salvar o arquivo —
// nunca dentro da pasta de instalação do Louvor JA, que também guarda
// músicas/capas/banco de dados do usuário (ver getWritableBase() em ipc.js e
// build/installer.nsh). O autoUpdater continua sendo usado só para VERIFICAR
// se há versão nova (runUpdateCheck acima).
const GITHUB_OWNER = 'tiagoadv7';
const GITHUB_REPO = 'louvorja';

let downloadedInstallerPath = null;

function assetExtensionForPlatform() {
  if (process.platform === 'win32') return 'exe';
  if (process.platform === 'darwin') return 'dmg';
  return 'AppImage';
}

/** GET simples de JSON via HTTPS, seguindo redirecionamentos. */
function githubApiRequest(urlStr, redirects = 0) {
  return new Promise((resolve, reject) => {
    const u = new URL(urlStr);
    const req = https.get(
      { hostname: u.hostname, path: u.pathname + u.search, headers: { 'User-Agent': 'LouvorJA', Accept: 'application/vnd.github+json' } },
      (res) => {
        if (res.statusCode >= 300 && res.statusCode < 400 && res.headers.location) {
          res.resume();
          if (redirects >= 10) return reject(new Error('Muitos redirecionamentos ao consultar o GitHub'));
          return githubApiRequest(new URL(res.headers.location, urlStr).toString(), redirects + 1).then(resolve, reject);
        }
        const chunks = [];
        res.on('data', (c) => chunks.push(c));
        res.on('end', () => {
          const body = Buffer.concat(chunks).toString('utf8');
          if (res.statusCode >= 400) return reject(new Error(`HTTP ${res.statusCode} ao consultar o GitHub`));
          try { resolve(JSON.parse(body)); } catch (e) { reject(new Error(`Resposta inválida do GitHub: ${e.message}`)); }
        });
      }
    );
    req.on('error', reject);
    req.setTimeout(30000, () => req.destroy(new Error('Timeout ao consultar o GitHub')));
  });
}

/** Busca a release mais recente e o asset compatível com a plataforma atual. */
async function findLatestReleaseAsset() {
  const release = await githubApiRequest(`https://api.github.com/repos/${GITHUB_OWNER}/${GITHUB_REPO}/releases/latest`);
  const ext = assetExtensionForPlatform();
  const asset = (release.assets || []).find((a) => a.name && a.name.toLowerCase().endsWith(`.${ext.toLowerCase()}`));
  if (!asset) throw new Error(`Nenhum instalador .${ext} encontrado na última release`);
  const version = String(release.tag_name || '').replace(/^v/, '');
  return { asset, version };
}

/** Baixa uma URL para um arquivo local, com progresso e redirecionamentos. */
function downloadFile(url, destPath, onProgress) {
  return new Promise((resolve, reject) => {
    const tmpPath = `${destPath}.tmp`;
    const request = (u) => {
      https.get(u, { headers: { 'User-Agent': 'LouvorJA' } }, (res) => {
        if (res.statusCode >= 300 && res.statusCode < 400 && res.headers.location) {
          res.resume();
          return request(res.headers.location);
        }
        if (res.statusCode !== 200) {
          res.resume();
          return reject(new Error(`HTTP ${res.statusCode} ao baixar o instalador`));
        }
        const total = parseInt(res.headers['content-length'] || '0', 10);
        let received = 0;
        let sample = { time: Date.now(), received: 0 };
        const out = fs.createWriteStream(tmpPath);
        res.on('data', (chunk) => {
          received += chunk.length;
          const now = Date.now();
          if (now - sample.time >= 250) {
            const bytesPerSecond = Math.round(((received - sample.received) / (now - sample.time)) * 1000);
            sample = { time: now, received };
            const eta = bytesPerSecond > 0 && total > 0 ? Math.round((total - received) / bytesPerSecond) : null;
            onProgress({ percent: total ? Math.min(99, Math.round((received / total) * 100)) : 0, transferred: received, total, bytesPerSecond, eta });
          }
        });
        res.pipe(out);
        out.on('finish', () => out.close(() => fs.rename(tmpPath, destPath, (err) => (err ? reject(err) : resolve()))));
        out.on('error', reject);
      }).on('error', reject).setTimeout(120000, function () {
        this.destroy(new Error('Timeout ao baixar o instalador'));
      });
    };
    request(url);
  });
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

async function downloadInstallerWithRetry(url, destPath, onProgress) {
  const maxAttempts = DOWNLOAD_RETRY_DELAYS_MS.length + 1;
  let lastErr;
  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    try {
      return await downloadFile(url, destPath, onProgress);
    } catch (e) {
      lastErr = e;
      logUpdaterError(`download tentativa ${attempt}/${maxAttempts} falhou`, e);
      try { fs.unlinkSync(`${destPath}.tmp`); } catch (_) { /* pode não existir ainda */ }
      const delayMs = DOWNLOAD_RETRY_DELAYS_MS[attempt - 1];
      if (delayMs) await new Promise((resolve) => setTimeout(resolve, delayMs));
    }
  }
  throw lastErr;
}

function setupAutoUpdater() {
  autoUpdater.autoDownload = false; // download é feito manualmente (ver acima) — autoUpdater só verifica
  autoUpdater.logger = null; // silencia logs internos do electron-updater

  autoUpdater.on('checking-for-update',  ()       => sendToRenderer('updater:checking'));
  autoUpdater.on('update-available',     (info)   => sendToRenderer('updater:available', info));
  autoUpdater.on('update-not-available', (info)   => sendToRenderer('updater:not-available', info));
  autoUpdater.on('error', (err) => {
    const msg = err?.message || String(err);
    console.error('[updater] Erro do autoUpdater:', msg);
    logUpdaterError('autoUpdater error event', err);
    // O autoUpdater só é usado para verificar — qualquer erro dele é erro de
    // verificação, tratado como "sem atualização" (ver runUpdateCheck acima).
    if (isCheckingUpdate) sendToRenderer('updater:not-available', {});
  });

  ipcMain.handle('updater:check', () => runUpdateCheck());

  ipcMain.handle('updater:download', async () => {
    try {
      const { asset, version } = await findLatestReleaseAsset();

      const chosen = await dialog.showSaveDialog(mainWindow, {
        title: 'Salvar instalador da atualização',
        defaultPath: path.join(app.getPath('downloads'), asset.name),
        filters: [{ name: 'Instalador', extensions: [assetExtensionForPlatform()] }],
      });
      if (chosen.canceled || !chosen.filePath) return { canceled: true };

      await downloadInstallerWithRetry(asset.browser_download_url, chosen.filePath, (prog) => sendToRenderer('updater:progress', prog));

      downloadedInstallerPath = chosen.filePath;
      sendToRenderer('updater:downloaded', { version });
      return { ok: true, path: chosen.filePath };
    } catch (e) {
      logUpdaterError('download', e);
      sendToRenderer('updater:error', e.message);
      return { ok: false, error: e.message };
    }
  });

  ipcMain.handle('updater:install', () => {
    if (!downloadedInstallerPath) return;
    shell.openPath(downloadedInstallerPath).then((err) => {
      if (err) {
        logUpdaterError('install', new Error(err));
        sendToRenderer('updater:error', err);
        return;
      }
      setTimeout(() => app.quit(), 500);
    });
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
  // Fecha só a projeção principal — a tela de retorno é independente (pode
  // estar espelhando outra coisa, ou ter um módulo fixado nela via "Enviar
  // para o retorno") e não deve ser derrubada só porque a saída principal
  // fechou. Antes, esse handler sempre destruía returnWindow junto, então
  // projetar/fechar algo na saída principal também tirava o que estava sendo
  // exibido independentemente no retorno. A própria reatividade de
  // ReturnScreen.vue (popup_module/return_popup_module) já cuida de deixar o
  // retorno transparente quando não há mais nada ativo pra mostrar — sem
  // precisar fechar a janela.
  ipcMain.handle('output:close', async () => {
    await fadeOutAndClose(outputWindow);
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
  // Ver comentário em preload.js (invalidateOutput) — nudge de repaint pro
  // bug de janela transparente renderizando preto.
  ipcMain.handle('output:invalidate', () => {
    if (outputWindow && !outputWindow.isDestroyed()) outputWindow.webContents.invalidate();
    return true;
  });

  ipcMain.handle('return:open', (_, displayId) => {
    createReturnWindow(displayId);
    // Lembra que o retorno deve reabrir sozinho na próxima vez que o app for
    // aberto (ver restauração em ipcMain.once('app:loaded') abaixo) — mesmo
    // padrão do "output_window_was_open" pra saída principal. Marcado aqui
    // (no próprio open/close, e não a partir de algum estado de conteúdo)
    // porque o retorno não tem um "módulo" que reflita sozinho se ele está
    // aberto ou não — só o toggle explícito do usuário decide isso.
    Store.set('return_window_was_open', true);
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
    // Só marca como "não deve reabrir" quando o usuário fecha de propósito
    // (aqui) — nunca no cascade-destroy do 'closed' da janela (ver comentário
    // em createReturnWindow), que também dispara ao encerrar o app inteiro e
    // não deve apagar essa preferência.
    Store.set('return_window_was_open', false);
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
    rememberPopupModuleForRestore(data);

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
    (entries || []).forEach((entry) => {
      remoteServer.applyStateEntry(entry);
      rememberPopupModuleForRestore(entry);
    });
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

    // Restaura a projeção que estava aberta quando o app foi fechado da
    // última vez — sem isso, o operador precisa reabrir manualmente o mesmo
    // módulo toda vez que reinicia o app, mesmo tendo deixado a projeção
    // ativa antes de fechar. O module_id é o único dado que falta pra
    // createOutputWindow reabrir igual estava (o monitor já é resolvido via
    // "output_display_id", que createOutputWindow já lê sozinho).
    if (Store.get('output_window_was_open')) {
      const lastModule = Store.get('output_window_last_module');
      if (lastModule) {
        createOutputWindow(lastModule);
        mainWindow.webContents.send('restore-output-state', lastModule);
      }
    }

    // Mesma restauração para o monitor de retorno (ver 'return:open'/'return:close'
    // acima) — o monitor já é resolvido sozinho via "return_display_id" dentro de
    // createReturnWindow, igual ao da saída principal. Roda independente da saída
    // (o retorno não depende de haver um módulo projetado pra existir) e não
    // manda nada pra outputWindow/mainWindow além do evento "return-window-opened"
    // que já dispara normalmente — não toca no slide/módulo que a saída principal
    // acabou de restaurar acima.
    if (Store.get('return_window_was_open')) {
      createReturnWindow();
    }

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
  registerDisplayWatcher();

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createMainWindow();
  });
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit();
});

app.on('before-quit', () => {
  // stopServer() (não stop()): libera porta/firewall sem marcar a preferência
  // "enabled" como desligada — isso roda em TODO fechamento do app, então
  // usar stop() aqui faria "Transmitir" nunca reabrir sozinho na próxima vez.
  remoteServer.stopServer();
});
