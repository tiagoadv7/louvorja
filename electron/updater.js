/**
 * updater.js — Auto-update do app via GitHub Releases.
 *
 * Refeito seguindo a mesma arquitetura do fork mais avançado deste app
 * (louvorja/violin-app, electron/main/updater.js) — que por sua vez nasceu
 * copiando o retry/rate-limit daqui. Agora os dois compartilham o mesmo
 * desenho: um único objeto de estado (_state) emitido via IPC "updater:state"
 * a cada mudança, em vez de 6 eventos separados (checking/available/
 * not-available/progress/downloaded/error) — a UI só precisa reagir a
 * `status`, sem coordenar múltiplos listeners.
 *
 * Uso em electron/main.js:
 *   const Updater = require('./updater');
 *   Updater.init();                    // registra ipcMain handlers + listeners do autoUpdater
 *   Updater.setMainWindow(mainWindow); // logo após criar a janela principal
 *   Updater.checkForUpdates();         // dispara verificação (ex.: 15s após o boot)
 *
 * Estado emitido ao renderer via IPC "updater:state":
 *   { status, version, newVersion, releaseNotes, progress, bytesPerSecond,
 *     transferred, total, error, packagePath }
 * Status possíveis: idle | checking | available | not-available | downloading
 *                    | downloaded | error
 *
 * Qualquer falha durante a VERIFICAÇÃO é tratada como "sem atualização
 * disponível" — o usuário que clica em "Verificar atualizações" não precisa
 * saber a razão técnica, só se há ou não uma versão nova. A tela de erro fica
 * reservada para falhas de DOWNLOAD (ver downloadPackage/downloadUpdate abaixo).
 *
 * Se o electron-updater falhar ao verificar (proxy/firewall corporativo
 * bloqueando o formato de request dele, parsing do feed, etc. — ou em dev,
 * sem dev-app-update.yml), cai para uma consulta direta à API do GitHub antes
 * de desistir — mesma fonte, caminho mais simples, sem o overhead do
 * provider do electron-updater. Só depois dessa segunda tentativa falhar é
 * que reporta "sem atualização".
 *
 * Diferença deliberada do violin-app: o download manual (fallback) aqui
 * SEMPRE pergunta onde salvar antes de baixar (dialog.showSaveDialog) — nunca
 * direto na pasta Downloads. Motivo: a pasta de instalação do Louvor JA
 * também guarda músicas/capas/banco de dados do usuário (ver getWritableBase()
 * em ipc.js e build/installer.nsh); salvar o instalador ali por engano seria
 * fácil de fazer sem esse passo manual. Isso não existe no violin-app porque
 * lá a pasta de instalação não acumula conteúdo do usuário.
 */

// Lazy require — electron-updater acessa app.getVersion() na importação,
// antes do app estar pronto (mesmo cuidado do violin-app).
const { app, ipcMain, dialog, shell, BrowserWindow } = require('electron');
const https = require('https');
const fs    = require('fs');
const path  = require('path');

let autoUpdater = null;

const GITHUB_OWNER = 'tiagoadv7';
const GITHUB_REPO = 'louvorja';
const GITHUB_RELEASES_URL = `https://api.github.com/repos/${GITHUB_OWNER}/${GITHUB_REPO}/releases?per_page=20`;

/** @type {import('electron').BrowserWindow | null} */
let _mainWindow = null;

function setMainWindow(win) {
  _mainWindow = win;
}

/** @type {{ status: string, version: string, newVersion: string|null, releaseNotes: string|null, progress: number, bytesPerSecond: number, transferred: number, total: number, error: string|null, packagePath: string|null }} */
let _state = {
  status: 'idle',
  version: '0.0.0',
  newVersion: null,
  releaseNotes: null,
  progress: 0,
  bytesPerSecond: 0,
  transferred: 0,
  total: 0,
  error: null,
  packagePath: null,
};

// Opções em runtime (aplicadas a cada check) — expostas mas sem UI própria
// ainda no Louvor JA; useBeta/autoDownload ficam desligadas por padrão pra
// preservar o comportamento atual (só considera releases estáveis, só baixa
// quando o operador clica em "Baixar agora").
let _useBeta      = false;
let _autoCheck    = true;
let _autoDownload = false;

// Candidata mais recente encontrada via GitHub API — guardada pro download
// manual não precisar refazer o check.
let _latestReleaseInfo = null;

// _checkedViaGithub registra QUAL caminho respondeu por último — o download
// (updater:download/install abaixo) precisa usar o MESMO mecanismo da
// verificação: se foi o electron-updater que confirmou a versão nova, só ele
// tem o estado interno pra baixar/instalar nativamente; se foi o fallback do
// GitHub, o electron-updater nunca chegou a "ver" essa versão, então só o
// download manual funciona.
let _checkedViaGithub = false;

// Amostragem de taxa de download (download manual via GitHub API).
let _dlSample = { time: 0, received: 0, rate: 0 };

// Um release recém-publicado no GitHub pode levar de segundos a alguns
// MINUTOS pra terminar de propagar (arquivos grandes de ~150MB passam por
// verificação antes de ficar baixáveis via browser_download_url) — confirmado
// na prática duas vezes: um release apareceu com os assets listados na API
// mas retornando 404 por vários minutos seguidos, e depois (v1.28.20) um
// "Baixar agora" clicado ~11min após o publish ainda falhou com uma janela de
// só ~100s de tolerância — a propagação daquela vez levou mais que isso.
// Atraso progressivo (10s, 15s, 20s, 30s, 45s, 60s, 60s, 90s) soma ~5,5min de
// tolerância total.
const DOWNLOAD_RETRY_DELAYS_MS = [10000, 15000, 20000, 30000, 45000, 60000, 60000, 90000];

// true durante toda a duração de _downloadUpdateWithRetry() — suprime o
// forward automático do evento nativo 'error' do autoUpdater em CADA
// tentativa (mesmo a última): o catch de downloadUpdate() já reporta o erro
// final via _setState() depois que todas as tentativas se esgotam, então
// deixar o evento passar também sobrescreveria o estado no meio de uma
// tentativa seguinte que ainda pode dar certo.
let _downloadRetryInProgress = false;

// ---------------------------------------------------------------------------
// Internals
// ---------------------------------------------------------------------------

function _emit() {
  if (_mainWindow && !_mainWindow.isDestroyed()) {
    _mainWindow.webContents.send('updater:state', { ..._state });
  }
}

function _setState(patch) {
  _state = { ..._state, ...patch };
  _emit();
}

// console.error some no vazio numa GUI empacotada sem terminal anexado — sem
// isso, uma falha real de update é indiagnosticável depois do fato. Mantido
// como arquivo próprio (o violin-app não tem — só console.log) porque já
// serviu pra diagnosticar problemas de produção reais neste projeto.
function logUpdaterError(context, err) {
  try {
    const line = `[${new Date().toISOString()}] ${context}: ${err?.stack || err?.message || err}\n`;
    fs.appendFileSync(path.join(app.getPath('userData'), 'updater.log'), line);
  } catch (_) { /* não crítico — só o console.error já emitido segue valendo */ }
}

/** Fetch HTTP(S) simples, retorna Buffer ou JSON, seguindo redirecionamentos. */
function _request(url, { headers = {}, parseJson = false } = {}, redirects = 0) {
  return new Promise((resolve, reject) => {
    const req = https.get(url, { headers: { 'User-Agent': 'LouvorJA', Accept: 'application/vnd.github+json', ...headers } }, (res) => {
      const status = res.statusCode || 0;
      if (status >= 300 && status < 400 && res.headers.location) {
        res.resume();
        if (redirects >= 10) return reject(new Error('Muitos redirecionamentos ao acessar o GitHub'));
        const next = new URL(res.headers.location, url).toString();
        return _request(next, { headers, parseJson }, redirects + 1).then(resolve, reject);
      }
      const chunks = [];
      res.on('data', (c) => chunks.push(c));
      res.on('end', () => {
        const buf = Buffer.concat(chunks);
        if (status >= 400) {
          // A API do GitHub sem autenticação libera só 60 requisições/hora por
          // IP — numa rede compartilhada (igreja/escritório com vários
          // instaladores checando update) isso estoura fácil e aparecia pro
          // usuário só como "HTTP 403", sem nenhuma pista do que fazer. O
          // rate-limit vem sempre com esses dois headers, então dá pra
          // detectar com certeza (em vez de adivinhar pelo texto do body,
          // que muda) e avisar quando o limite libera de novo.
          const remaining = res.headers['x-ratelimit-remaining'];
          const resetHeader = res.headers['x-ratelimit-reset'];
          if (status === 403 && remaining === '0' && resetHeader) {
            const resetDate = new Date(parseInt(resetHeader, 10) * 1000);
            const mins = Math.max(1, Math.ceil((resetDate.getTime() - Date.now()) / 60000));
            return reject(new Error(`Limite de requisições do GitHub atingido — tente novamente em cerca de ${mins} min`));
          }
          return reject(new Error(`HTTP ${status} ao acessar o GitHub`));
        }
        if (!parseJson) return resolve(buf);
        try { resolve(JSON.parse(buf.toString('utf8'))); }
        catch (e) { reject(new Error(`Resposta inválida (não-JSON) do GitHub: ${e.message}`)); }
      });
    });
    req.on('error', reject);
    req.setTimeout(30000, () => req.destroy(new Error('Timeout ao consultar o GitHub')));
  });
}

/**
 * Compara dois identificadores de pré-release semver por partes separadas
 * por ponto (ex: "test.10" vs "test.2"). Retorna >0 se a>b.
 *
 * Regras semver:
 *  - identificadores numéricos são comparados numericamente (10 > 2);
 *  - numérico tem precedência MENOR que alfanumérico;
 *  - alfanuméricos são comparados lexicograficamente (ASCII);
 *  - mais identificadores = maior precedência (test.3.1 > test.3).
 */
function _comparePrerelease(a, b) {
  const aParts = a.split('.');
  const bParts = b.split('.');
  const len = Math.max(aParts.length, bParts.length);
  for (let i = 0; i < len; i++) {
    const x = aParts[i];
    const y = bParts[i];
    if (x === undefined) return -1;
    if (y === undefined) return 1;
    const xNum = /^\d+$/.test(x);
    const yNum = /^\d+$/.test(y);
    if (xNum && yNum) {
      const d = parseInt(x, 10) - parseInt(y, 10);
      if (d !== 0) return d;
    } else if (xNum) {
      return -1;
    } else if (yNum) {
      return 1;
    } else {
      const d = x < y ? -1 : x > y ? 1 : 0;
      if (d !== 0) return d;
    }
  }
  return 0;
}

function _parseVersion(v) {
  const clean = String(v || '').replace(/^v/, '').trim();
  const [core, pre] = clean.split('-', 2);
  const nums = core.split('.').map((n) => parseInt(n, 10) || 0);
  while (nums.length < 3) nums.push(0);
  nums.prerelease = pre || null;
  return nums;
}

/**
 * Compara versões semver básicas (a.b.c[-pre.release]). Retorna >0 se a>b.
 * Suporta pré-release (ex: 1.28.19-test.1 < 1.28.19) — a comparação antiga
 * (parseInt ingênuo por "."), tratava "1.28.19-test.1" como [1,28,19] (o
 * sufixo "-test" virava NaN||0 e era descartado), fazendo uma versão de
 * teste comparar IGUAL à versão estável de mesmo número — confirmado na
 * prática ao publicar v1.28.19-test.1 nesta sessão.
 */
function compareVersions(a, b) {
  const pa = _parseVersion(a);
  const pb = _parseVersion(b);
  for (let i = 0; i < 3; i++) {
    if (pa[i] !== pb[i]) return pa[i] - pb[i];
  }
  const ap = pa.prerelease;
  const bp = pb.prerelease;
  if (ap && !bp) return -1;
  if (!ap && bp) return 1;
  if (ap && bp) return _comparePrerelease(ap, bp);
  return 0;
}

function assetExtensionForPlatform() {
  if (process.platform === 'win32') return 'exe';
  if (process.platform === 'darwin') return 'dmg';
  return 'AppImage';
}

/**
 * Busca a release mais recente (compatível com a plataforma e com useBeta)
 * do repositório via GitHub API. Retorna { updateAvailable, version, tag,
 * url, assets } ou null se não houver nenhuma release candidata.
 */
async function checkGithubRelease() {
  const releases = await _request(GITHUB_RELEASES_URL, { parseJson: true });
  if (!Array.isArray(releases)) return null;

  const candidates = releases.filter((r) => {
    if (!r || r.draft) return false;
    const tag = String(r.tag_name || '').replace(/^v/, '');
    if (!/^\d+\.\d+\.\d+/.test(tag)) return false;
    // Pre-release: só considera se useBeta estiver ativo.
    if (r.prerelease && !_useBeta) return false;
    return true;
  });
  if (candidates.length === 0) return null;

  candidates.sort((a, b) => compareVersions(String(b.tag_name), String(a.tag_name)));
  const latest = candidates[0];
  const version = String(latest.tag_name).replace(/^v/, '');

  return {
    updateAvailable: compareVersions(version, app.getVersion()) > 0,
    version,
    tag: latest.tag_name,
    url: latest.html_url || `https://github.com/${GITHUB_OWNER}/${GITHUB_REPO}/releases/tag/${latest.tag_name}`,
    assets: latest.assets || [],
  };
}

/**
 * Renderiza markdown (GFM) em HTML usando a API pública do GitHub
 * (`POST /markdown`). Retorna null em caso de falha para que a UI tenha
 * fallback pro texto cru (ver UpdateDialog.vue).
 */
function renderMarkdown(text) {
  return new Promise((resolve) => {
    const body = JSON.stringify({ text: String(text || ''), mode: 'gfm' });
    const req = https.request(
      'https://api.github.com/markdown',
      {
        method: 'POST',
        headers: {
          'User-Agent': 'LouvorJA',
          Accept: 'application/vnd.github+json',
          'Content-Type': 'application/json',
          'Content-Length': Buffer.byteLength(body),
        },
      },
      (res) => {
        const chunks = [];
        res.on('data', (c) => chunks.push(c));
        res.on('end', () => {
          const status = res.statusCode || 0;
          if (status < 200 || status >= 300) return resolve(null);
          resolve(Buffer.concat(chunks).toString('utf8'));
        });
      }
    );
    req.on('error', () => resolve(null));
    req.setTimeout(30000, () => req.destroy(new Error('Timeout ao consultar o GitHub')));
    req.end(body);
  });
}

/** Faz o check via GitHub API e atualiza o estado unificado. */
async function checkGithubAndSetState() {
  _setState({ status: 'checking', error: null, newVersion: null });
  try {
    const info = await checkGithubRelease();
    if (!info) {
      _setState({ status: 'not-available' });
      return { ok: true, updateAvailable: false };
    }
    _latestReleaseInfo = info;
    if (!info.updateAvailable) {
      _setState({ status: 'not-available', newVersion: info.version });
      return { ok: true, updateAvailable: false };
    }
    // checkGithubRelease() não devolve o corpo (a listagem /releases não
    // precisa dele pra decidir se há update) — busca a release específica só
    // pra pegar o markdown cru e renderizar em HTML (cai pro texto cru se
    // essa segunda chamada ou o /markdown falharem).
    const release = await _request(`https://api.github.com/repos/${GITHUB_OWNER}/${GITHUB_REPO}/releases/tags/v${info.version}`, { parseJson: true }).catch(() => null);
    const body = release?.body || '';
    const releaseNotes = body ? (await renderMarkdown(body)) || body : null;

    _setState({ status: 'available', newVersion: info.version, releaseNotes, error: null });
    if (_autoDownload) {
      downloadPackage().catch((e) => console.warn('[updater] auto-download falhou:', e.message));
    }
    return { ok: true, updateAvailable: true, version: info.version };
  } catch (e) {
    logUpdaterError('check (github fallback)', e);
    _setState({ status: 'error', error: e.message || String(e) });
    return { ok: false, error: e.message };
  }
}

/**
 * Busca os release notes de uma versão específica (tag v<version>) — por
 * padrão a versão INSTALADA (app.getVersion()). Usado pelo modal de
 * novidades (ReleaseNotesDialog.vue), que mostra o changelog da versão que o
 * operador está rodando agora — diferente de checkGithubAndSetState()
 * acima, que busca o changelog da versão NOVA disponível pra download.
 * Mesmo desenho do fork mais avançado deste app (louvorja/violin-app,
 * getCurrentReleaseNotes em electron/main/updater.js).
 *
 * Retorna { version, name, body, bodyHtml, url } ou null se a release não
 * existir (ex.: versão de dev sem tag publicada ainda).
 */
async function getCurrentReleaseNotes(version) {
  const v = String(version || app.getVersion()).replace(/^v/, '');
  try {
    const release = await _request(`https://api.github.com/repos/${GITHUB_OWNER}/${GITHUB_REPO}/releases/tags/v${v}`, { parseJson: true });
    if (!release || !release.tag_name) return null;
    const body = release.body || '';
    const bodyHtml = body ? await renderMarkdown(body) : null;
    return {
      version: String(release.tag_name).replace(/^v/, ''),
      name: release.name || release.tag_name,
      body,
      bodyHtml,
      url: release.html_url || `https://github.com/${GITHUB_OWNER}/${GITHUB_REPO}/releases/tag/${release.tag_name}`,
    };
  } catch (e) {
    console.warn('[updater] getCurrentReleaseNotes falhou:', e.message);
    return null;
  }
}

/**
 * Baixa o asset (.exe) da release pra um destino escolhido pelo usuário
 * (dialog.showSaveDialog — ver nota no topo do arquivo sobre por que isso é
 * diferente do violin-app), com progresso e retry.
 *
 * @param {import('electron').BrowserWindow} [win] janela pra ancorar o diálogo de salvar
 */
async function downloadPackage(win) {
  if (!_latestReleaseInfo || !_latestReleaseInfo.assets) {
    const chk = await checkGithubAndSetState();
    if (!chk.ok || !chk.updateAvailable) {
      throw new Error(_state.error || 'Nenhuma versão disponível para download');
    }
  }
  const info = _latestReleaseInfo;
  const ext = assetExtensionForPlatform();
  const asset = info.assets.find((a) => a.name && a.name.toLowerCase().endsWith(`.${ext.toLowerCase()}`));
  if (!asset) throw new Error(`Nenhum instalador .${ext} encontrado na release ${info.tag}`);

  const chosen = await dialog.showSaveDialog(win || _mainWindow, {
    title: 'Salvar instalador da atualização',
    defaultPath: path.join(app.getPath('downloads'), asset.name),
    filters: [{ name: 'Instalador', extensions: [ext] }],
  });
  if (chosen.canceled || !chosen.filePath) return { canceled: true };

  const dest = chosen.filePath;
  const tmp = `${dest}.tmp`;

  _dlSample = { time: 0, received: 0, rate: 0 };
  _setState({ status: 'downloading', progress: 0, newVersion: info.version, error: null, bytesPerSecond: 0, transferred: 0, total: asset.size || 0 });

  const attemptOnce = () =>
    new Promise((resolve, reject) => {
      const download = (url) => {
        https.get(url, { headers: { 'User-Agent': 'LouvorJA' } }, (res) => {
          if (res.statusCode >= 300 && res.statusCode < 400 && res.headers.location) {
            res.resume();
            return download(res.headers.location);
          }
          if (res.statusCode !== 200) {
            res.resume();
            return reject(new Error(`HTTP ${res.statusCode} ao baixar ${asset.name}`));
          }
          _pipeToFile(res, dest, tmp, info, resolve, reject);
        }).on('error', reject).setTimeout(120000, function () {
          this.destroy(new Error('Timeout ao baixar o instalador'));
        });
      };
      download(asset.browser_download_url);
    });

  try {
    const maxAttempts = DOWNLOAD_RETRY_DELAYS_MS.length + 1;
    let lastErr = null;
    for (let attempt = 1; attempt <= maxAttempts; attempt++) {
      try {
        await attemptOnce();
        lastErr = null;
        break;
      } catch (e) {
        lastErr = e;
        logUpdaterError(`download (manual) tentativa ${attempt}/${maxAttempts} falhou`, e);
        try { fs.unlinkSync(tmp); } catch (_) { /* pode não existir ainda */ }
        const delayMs = DOWNLOAD_RETRY_DELAYS_MS[attempt - 1];
        if (delayMs) await new Promise((resolve) => setTimeout(resolve, delayMs));
      }
    }
    if (lastErr) throw lastErr;

    _setState({ status: 'downloaded', progress: 100, newVersion: info.version, packagePath: dest });
    return { ok: true, path: dest };
  } catch (e) {
    try { fs.unlinkSync(tmp); } catch (_) { /* ignore */ }
    logUpdaterError('download (manual, todas as tentativas)', e);
    _setState({ status: 'error', error: e.message || String(e) });
    throw e;
  }
}

function _pipeToFile(res, dest, tmp, info, resolve, reject) {
  const total = parseInt(res.headers['content-length'] || '0', 10);
  let received = 0;
  const out = fs.createWriteStream(tmp);
  res.on('data', (chunk) => {
    received += chunk.length;
    if (total > 0) {
      const now = Date.now();
      if (now - _dlSample.time >= 250) {
        _dlSample.rate = (received - _dlSample.received) / ((now - _dlSample.time) / 1000);
        _dlSample.time = now;
        _dlSample.received = received;
      }
      _setState({
        status: 'downloading',
        progress: Math.min(99, Math.round((received / total) * 100)),
        newVersion: info.version,
        bytesPerSecond: Math.round(_dlSample.rate),
        transferred: received,
        total,
      });
    }
  });
  res.pipe(out);
  out.on('finish', () => out.close(() => fs.rename(tmp, dest, (err) => (err ? reject(err) : resolve()))));
  out.on('error', reject);
}

/** Abre o instalador baixado e fecha o app pro instalador assumir o resto. */
function openPackage() {
  if (!_state.packagePath) return Promise.resolve({ ok: false, error: 'Nenhum instalador baixado' });
  return shell.openPath(_state.packagePath).then(
    (err) => {
      if (err) { logUpdaterError('install (manual)', new Error(err)); return { ok: false, error: err }; }
      setTimeout(() => app.quit(), 500);
      return { ok: true };
    },
    (err) => ({ ok: false, error: String(err) })
  );
}

/** Abre a página da release no browser — fallback quando o asset não é encontrado/baixável. */
function openReleasePage() {
  const url = _latestReleaseInfo?.url || `https://github.com/${GITHUB_OWNER}/${GITHUB_REPO}/releases/latest`;
  shell.openExternal(url);
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

/**
 * Inicializa o updater: registra os listeners do autoUpdater e os handlers
 * IPC (updater:check, updater:download, updater:install, updater:status,
 * updater:setOptions, updater:openReleasePage). Deve ser chamado uma única
 * vez, antes de qualquer chamada IPC do renderer — setMainWindow() pode vir
 * depois, os handlers abaixo leem _mainWindow em tempo de chamada.
 *
 * @param {{ channel?: string, autoCheck?: boolean, autoDownload?: boolean, useBeta?: boolean }} opts
 */
function init({ channel = 'latest', autoCheck = true, autoDownload = false, useBeta = false } = {}) {
  _useBeta      = !!useBeta;
  _autoCheck    = !!autoCheck;
  _autoDownload = !!autoDownload;
  _state.version = app.getVersion();

  if (!autoUpdater) {
    try {
      autoUpdater = require('electron-updater').autoUpdater;
    } catch (e) {
      console.warn('[updater] electron-updater indisponível:', e.message);
    }
  }

  if (autoUpdater) {
    // autoDownload do PROVIDER continua false por padrão — baixar só quando
    // o operador clicar em "Baixar agora" (updater:download abaixo), a
    // menos que _autoDownload (opção do app, não do provider) esteja ligada.
    autoUpdater.autoDownload   = _autoDownload;
    autoUpdater.allowPrerelease = _useBeta;
    autoUpdater.channel        = channel;
    autoUpdater.logger         = null; // silencia logs internos do electron-updater

    autoUpdater.on('checking-for-update', () => {
      _setState({ status: 'checking', error: null });
    });

    autoUpdater.on('update-available', async (info) => {
      const raw = typeof info.releaseNotes === 'string' ? info.releaseNotes : null;
      const releaseNotes = raw ? (await renderMarkdown(raw)) || raw : null;
      _setState({ status: 'available', newVersion: info.version, releaseNotes, error: null });
    });

    autoUpdater.on('update-not-available', (info) => {
      _setState({ status: 'not-available', newVersion: info?.version || null });
    });

    // Progresso/conclusão do download NATIVO (autoUpdater.downloadUpdate(),
    // ver updater:download abaixo) — mesmo _state que o download manual usa,
    // então UpdateDialog.vue não precisa saber qual dos dois está em uso.
    autoUpdater.on('download-progress', (prog) => {
      _setState({
        status: 'downloading',
        progress: Math.round(prog.percent || 0),
        transferred: prog.transferred,
        total: prog.total,
        bytesPerSecond: prog.bytesPerSecond,
      });
    });

    autoUpdater.on('update-downloaded', (info) => {
      _setState({ status: 'downloaded', newVersion: info.version, progress: 100 });
    });

    autoUpdater.on('error', (err) => {
      const msg = err?.message || String(err);
      console.error('[updater] Erro do autoUpdater:', msg);
      logUpdaterError('autoUpdater error event', err);
      // Durante um retry de download (ver _downloadUpdateWithRetry), esse
      // mesmo evento dispara a cada tentativa que falha — só a tentativa
      // FINAL (depois de esgotar DOWNLOAD_RETRY_DELAYS_MS) deve virar estado
      // de erro pro usuário; senão "Baixando..." já mostrava erro na 1ª
      // falha passageira mesmo quando uma tentativa seguinte teria dado certo.
      if (_downloadRetryInProgress) return;
      _setState({ status: 'error', error: msg });
    });
  }

  ipcMain.handle('updater:check', () => checkForUpdates());
  ipcMain.handle('updater:download', (event) => downloadUpdate(BrowserWindow.fromWebContents(event.sender) || _mainWindow));
  ipcMain.handle('updater:install', () => quitAndInstall());
  ipcMain.handle('updater:status', () => status());
  ipcMain.handle('updater:setOptions', (_e, opts) => setOptions(opts));
  ipcMain.handle('updater:openReleasePage', () => openReleasePage());
  ipcMain.handle('updater:getReleaseNotes', (_e, version) => getCurrentReleaseNotes(version));

  // Verifica automaticamente só em build empacotada — em dev (`npm run
  // electron:dev`, app.isPackaged=false) cada restart do processo dispararia
  // um check novo, gastando a cota de 60 req/hora sem autenticação da API do
  // GitHub e distraindo com popups de update no meio do desenvolvimento.
  // 15s de delay pra não competir com o carregamento inicial do app.
  if (_autoCheck && app.isPackaged) {
    setTimeout(() => {
      checkForUpdates().catch(() => {});
    }, 15000);
  }

  console.log('[updater] Inicializado. autoUpdater:', !!autoUpdater, '| autoDownload:', _autoDownload, '| useBeta:', _useBeta);
}

/**
 * Aplica opções em runtime (ex.: futura tela de configurações).
 * @param {{ useBeta?: boolean, autoCheck?: boolean, autoDownload?: boolean }} opts
 */
function setOptions({ useBeta, autoCheck, autoDownload } = {}) {
  if (typeof useBeta === 'boolean') _useBeta = useBeta;
  if (typeof autoCheck === 'boolean') _autoCheck = autoCheck;
  if (typeof autoDownload === 'boolean') _autoDownload = autoDownload;
  if (autoUpdater) {
    autoUpdater.allowPrerelease = _useBeta;
    autoUpdater.autoDownload    = _autoDownload;
  }
}

/**
 * Verifica se há versão nova.
 * - Produção com electron-updater ativo: delega a ele.
 * - Dev (app não empacotado) ou electron-updater inativo/falhou: fallback GitHub API.
 */
async function checkForUpdates() {
  if (!autoUpdater || !autoUpdater.isUpdaterActive()) {
    _checkedViaGithub = true;
    return checkGithubAndSetState();
  }
  try {
    _checkedViaGithub = false;
    autoUpdater.allowPrerelease = _useBeta;
    autoUpdater.autoDownload    = _autoDownload;
    await autoUpdater.checkForUpdates();
    return { ok: true, state: { ..._state } };
  } catch (e) {
    console.warn('[updater] Falha ao verificar via electron-updater, tentando fallback GitHub API:', e.message || e);
    logUpdaterError('check (electron-updater)', e);
    _checkedViaGithub = true;
    return checkGithubAndSetState();
  }
}

/** Tenta autoUpdater.downloadUpdate() algumas vezes antes de desistir (ver DOWNLOAD_RETRY_DELAYS_MS). */
async function _downloadUpdateWithRetry() {
  const maxAttempts = DOWNLOAD_RETRY_DELAYS_MS.length + 1;
  _downloadRetryInProgress = true;
  try {
    let lastErr;
    for (let attempt = 1; attempt <= maxAttempts; attempt++) {
      try {
        return await autoUpdater.downloadUpdate();
      } catch (e) {
        lastErr = e;
        logUpdaterError(`download nativo tentativa ${attempt}/${maxAttempts} falhou`, e);
        const delayMs = DOWNLOAD_RETRY_DELAYS_MS[attempt - 1];
        if (delayMs) await new Promise((resolve) => setTimeout(resolve, delayMs));
      }
    }
    throw lastErr;
  } finally {
    _downloadRetryInProgress = false;
  }
}

/**
 * Inicia o download da atualização disponível.
 * - Verificação foi feita pelo electron-updater: baixa nativamente (cache
 *   próprio do electron-updater, fora da pasta de instalação do app).
 * - Dev ou verificação caiu pro fallback GitHub API: download manual, com
 *   diálogo de "salvar como" (ver downloadPackage).
 */
async function downloadUpdate(win) {
  if (_checkedViaGithub || !autoUpdater || !autoUpdater.isUpdaterActive()) {
    try {
      return await downloadPackage(win);
    } catch (e) {
      return { ok: false, error: e.message };
    }
  }
  try {
    autoUpdater.allowPrerelease = _useBeta;
    autoUpdater.autoDownload    = true;
    await _downloadUpdateWithRetry();
    return { ok: true, native: true };
  } catch (e) {
    logUpdaterError('download (electron-updater nativo, todas as tentativas)', e);
    _setState({ status: 'error', error: e.message });
    return { ok: false, error: e.message };
  }
}

/**
 * Fecha o app e instala a atualização baixada.
 * - Download nativo: electron-updater fecha e reabre o app sozinho.
 * - Download manual: abre o instalador (NSIS) baixado, que assume o resto.
 */
function quitAndInstall() {
  if (_checkedViaGithub || !autoUpdater || !autoUpdater.isUpdaterActive()) {
    return openPackage();
  }
  autoUpdater.quitAndInstall();
}

/** Snapshot do estado atual (não reativo). */
function status() {
  return { ..._state };
}

module.exports = {
  init,
  setMainWindow,
  checkForUpdates,
  downloadUpdate,
  downloadPackage,
  quitAndInstall,
  openPackage,
  openReleasePage,
  status,
  setOptions,
  checkGithubRelease,
  checkGithubAndSetState,
  getCurrentReleaseNotes,
};
