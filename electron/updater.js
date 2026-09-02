/**
 * updater.js — Auto-update do app via GitHub Releases.
 *
 * Fonte: GitHub Releases via electron-updater (ver build.publish em package.json).
 * Extraído de electron/main.js pra ficar no mesmo padrão de módulo isolado
 * usado pelo fork mais avançado deste app (ver PR — GITHUB_OWNER=louvorja/violin-app,
 * electron/main/updater.js daquele repo) — mesmo comportamento de antes, só
 * separado num arquivo próprio.
 *
 * Uso em electron/main.js:
 *   const Updater = require('./updater');
 *   Updater.init();                    // registra ipcMain handlers + listeners do autoUpdater
 *   Updater.setMainWindow(mainWindow); // logo após criar a janela principal
 *   Updater.checkForUpdates();         // dispara verificação (ex.: 15s após o boot)
 *
 * Qualquer falha durante a VERIFICAÇÃO é tratada como "sem atualização
 * disponível" — o usuário que clica em "Verificar atualizações" não precisa
 * saber a razão técnica, só se há ou não uma versão nova. A tela de erro fica
 * reservada para falhas de download (ver downloadInstallerWithRetry abaixo).
 *
 * Se o electron-updater falhar ao verificar (proxy/firewall corporativo
 * bloqueando o formato de request dele, parsing do feed, etc. — ou em dev,
 * sem dev-app-update.yml), cai para uma consulta direta à API do GitHub antes
 * de desistir — mesma fonte, caminho mais simples, sem o overhead do
 * provider do electron-updater. Só depois dessa segunda tentativa falhar é
 * que reporta "sem atualização".
 */

const { app, ipcMain, dialog, shell } = require('electron');
const { autoUpdater } = require('electron-updater');
const https = require('https');
const fs    = require('fs');
const path  = require('path');

/** @type {import('electron').BrowserWindow | null} */
let _mainWindow = null;

function setMainWindow(win) {
  _mainWindow = win;
}

function _sendToRenderer(channel, payload) {
  if (_mainWindow && !_mainWindow.isDestroyed()) {
    _mainWindow.webContents.send(channel, payload);
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

// _checkedViaGithub registra QUAL caminho respondeu por último — o download
// (updater:download/install abaixo) precisa usar o MESMO mecanismo da
// verificação: se foi o electron-updater que confirmou a versão nova, só ele
// tem o estado interno pra baixar/instalar nativamente; se foi o fallback do
// GitHub, o electron-updater nunca chegou a "ver" essa versão, então só o
// download manual funciona. Mesmo padrão usado no fork mais avançado deste
// app (ver PR — GITHUB_OWNER=louvorja/violin-app).
let _checkedViaGithub = false;

// true só durante autoUpdater.downloadUpdate() (ver updater:download) — o
// evento nativo 'error' do autoUpdater dispara tanto numa falha de
// VERIFICAÇÃO quanto numa falha de DOWNLOAD, mas só a segunda precisa virar
// 'updater:error' pro renderer aqui; a primeira já tem seu próprio tratamento
// em checkForUpdates() (fallback pro GitHub antes de decidir o que reportar).
let _downloadingNative = false;
// true durante toda a duração de downloadUpdateWithRetry() — suprime o
// forward automático do evento 'error' nativo abaixo em CADA tentativa
// (mesmo a última): o catch de updater:download já reporta o erro final ao
// renderer explicitamente depois que todas as tentativas se esgotam, então
// deixar o evento passar também duplicaria a mensagem. Sem essa flag, a 1ª
// tentativa falhando já mostrava "erro no download" pro operador mesmo
// quando uma tentativa seguinte teria dado certo (rede instável, hiccup
// passageiro do GitHub).
let _downloadRetryInProgress = false;

async function checkForUpdates() {
  _sendToRenderer('updater:checking');
  _checkedViaGithub = false;

  try {
    const r = await autoUpdater.checkForUpdates();
    // Em dev (app não empacotado, sem dev-app-update.yml) ou em instalações
    // sem config de update, checkForUpdates() resolve com null SEM emitir
    // nenhum evento (ver isUpdaterActive() no electron-updater) — trata como
    // falha e cai no fallback abaixo, em vez de reportar "sem atualização"
    // sem nem checar de verdade (isso também é o que permite testar o fluxo
    // completo em dev, contra a API real do GitHub).
    if (r == null) throw new Error('electron-updater inativo (dev ou sem configuração de update)');
  } catch (e) {
    console.error('[updater] Falha ao verificar via electron-updater, tentando fallback GitHub API:', e.message || e);
    logUpdaterError('check (electron-updater)', e);
    _checkedViaGithub = true;
    try {
      const info = await checkGithubReleaseDirect();
      if (info.updateAvailable) _sendToRenderer('updater:available', { version: info.version, releaseNotes: info.releaseNotes });
      else _sendToRenderer('updater:not-available', {});
    } catch (e2) {
      console.error('[updater] Fallback GitHub API também falhou:', e2.message || e2);
      logUpdaterError('check (github fallback)', e2);
      _sendToRenderer('updater:not-available', {});
    }
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
// se há versão nova (checkForUpdates acima).
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
          if (res.statusCode >= 400) {
            // A API do GitHub sem autenticação libera só 60 requisições/hora por
            // IP — numa rede compartilhada (igreja/escritório com vários
            // instaladores checando update) isso estoura fácil e aparecia pro
            // usuário só como "HTTP 403", sem nenhuma pista do que fazer.
            // rate-limit vem sempre com esses dois headers, então dá pra
            // detectar com certeza (em vez de adivinhar pelo texto do body,
            // que muda) e avisar quando o limite libera de novo.
            const remaining = res.headers['x-ratelimit-remaining'];
            const resetHeader = res.headers['x-ratelimit-reset'];
            if (res.statusCode === 403 && remaining === '0' && resetHeader) {
              const resetDate = new Date(parseInt(resetHeader, 10) * 1000);
              const mins = Math.max(1, Math.ceil((resetDate.getTime() - Date.now()) / 60000));
              return reject(new Error(`Limite de requisições do GitHub atingido — tente novamente em cerca de ${mins} min`));
            }
            return reject(new Error(`HTTP ${res.statusCode} ao consultar o GitHub`));
          }
          try { resolve(JSON.parse(body)); } catch (e) { reject(new Error(`Resposta inválida do GitHub: ${e.message}`)); }
        });
      }
    );
    req.on('error', reject);
    req.setTimeout(30000, () => req.destroy(new Error('Timeout ao consultar o GitHub')));
  });
}

// Cache curto da release "latest" — checkForUpdates (verificação, periódica ou
// manual) e updater:download (clique em "Baixar agora") consultavam o mesmo
// endpoint em separado, cada um consumindo sua própria cota das 60
// requisições/hora sem autenticação. Reaproveitar a resposta por alguns
// minutos cobre o caso comum (usuário vê "atualização disponível" e clica em
// baixar logo em seguida) sem precisar de token.
let _releaseCache = { data: null, time: 0 };
const RELEASE_CACHE_TTL_MS = 5 * 60 * 1000;

async function fetchLatestRelease() {
  const now = Date.now();
  if (_releaseCache.data && now - _releaseCache.time < RELEASE_CACHE_TTL_MS) {
    return _releaseCache.data;
  }
  const release = await githubApiRequest(`https://api.github.com/repos/${GITHUB_OWNER}/${GITHUB_REPO}/releases/latest`);
  _releaseCache = { data: release, time: now };
  return release;
}

/** Busca a release mais recente e o asset compatível com a plataforma atual. */
async function findLatestReleaseAsset() {
  const release = await fetchLatestRelease();
  const ext = assetExtensionForPlatform();
  const asset = (release.assets || []).find((a) => a.name && a.name.toLowerCase().endsWith(`.${ext.toLowerCase()}`));
  if (!asset) throw new Error(`Nenhum instalador .${ext} encontrado na última release`);
  const version = String(release.tag_name || '').replace(/^v/, '');
  return { asset, version };
}

/** Compara duas versões "major.minor.patch". Retorna >0 se a > b. */
function compareVersions(a, b) {
  const pa = String(a).replace(/^v/, '').split('.').map((n) => parseInt(n, 10) || 0);
  const pb = String(b).replace(/^v/, '').split('.').map((n) => parseInt(n, 10) || 0);
  for (let i = 0; i < 3; i++) {
    const diff = (pa[i] || 0) - (pb[i] || 0);
    if (diff !== 0) return diff;
  }
  return 0;
}

// Fallback de VERIFICAÇÃO usado por checkForUpdates quando autoUpdater.checkForUpdates()
// falha (ex.: proxy/firewall bloqueando o formato de request do electron-updater) —
// consulta a mesma release "latest" direto pela API do GitHub, sem depender do
// provider do electron-updater, só para decidir se há versão nova.
async function checkGithubReleaseDirect() {
  const release = await fetchLatestRelease();
  const version = String(release.tag_name || '').replace(/^v/, '');
  if (!version) return { updateAvailable: false, version: null };
  // release.body já vem pronto na mesma resposta da API (texto markdown cru
  // do corpo da release) — sem precisar de uma segunda chamada, ao contrário
  // do fork violin-app (getCurrentReleaseNotes), que busca a release por tag
  // e ainda renderiza via /markdown à parte. UpdateDialog.vue já trata esse
  // mesmo formato cru no caminho nativo do electron-updater (ver
  // formatChangelog), então dá pra reaproveitar sem mudar nada na UI.
  return {
    updateAvailable: compareVersions(version, app.getVersion()) > 0,
    version,
    releaseNotes: release.body || null,
  };
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

// Mesma tolerância a falha passageira (rede instável, hiccup momentâneo da
// API/CDN do GitHub) do download manual acima, mas pro caminho NATIVO
// (autoUpdater.downloadUpdate() — usado sempre que a verificação também foi
// feita pelo electron-updater, o caso mais comum). Antes, esse caminho não
// tentava de novo nenhuma vez: qualquer falha momentânea de rede já reportava
// "falha no download" pro operador, mesmo o release estando 100% publicado e
// acessível (confirmado: falhas nesse caminho não são sempre por causa do
// release em si).
async function downloadUpdateWithRetry() {
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
    // Sempre reabilita o forward do evento nativo pra próxima vez (ex.: um
    // "Baixar agora" chamado fora de downloadUpdateWithRetry, se um dia
    // existir) — o erro FINAL desta chamada já é reportado explicitamente
    // pelo catch de updater:download, então não precisa passar pelo evento.
    _downloadRetryInProgress = false;
  }
}

/**
 * Registra os listeners do autoUpdater e os handlers IPC (updater:check,
 * updater:download, updater:install). Deve ser chamado uma única vez, antes
 * de qualquer chamada IPC do renderer (setMainWindow pode vir depois — os
 * handlers abaixo leem _mainWindow em tempo de chamada, não no registro).
 */
function init() {
  // autoDownload continua false — baixar só quando o operador clicar em
  // "Baixar agora" (ver updater:download abaixo), não assim que encontrar
  // uma versão nova. A diferença agora é COMO baixa: nativamente pelo
  // electron-updater (sem diálogo de "salvar como", instala sozinho) sempre
  // que a própria verificação também tiver sido feita por ele — só cai pro
  // download manual (GitHub API + escolher onde salvar) quando o
  // electron-updater não estava realmente ativo na verificação (dev, ou
  // checkForUpdates falhou) — ver _checkedViaGithub em checkForUpdates().
  autoUpdater.autoDownload = false;
  autoUpdater.logger = null; // silencia logs internos do electron-updater

  autoUpdater.on('checking-for-update',  ()       => _sendToRenderer('updater:checking'));
  autoUpdater.on('update-available',     (info)   => _sendToRenderer('updater:available', info));
  autoUpdater.on('update-not-available', (info)   => _sendToRenderer('updater:not-available', info));
  // Progresso/conclusão do download NATIVO (autoUpdater.downloadUpdate(),
  // ver updater:download abaixo) — reaproveita os mesmos canais que o
  // download manual já usava, então UpdateDialog.vue não precisa saber qual
  // dos dois mecanismos está em uso.
  autoUpdater.on('download-progress', (prog) => _sendToRenderer('updater:progress', {
    percent: Math.round(prog.percent || 0),
    transferred: prog.transferred,
    total: prog.total,
    bytesPerSecond: prog.bytesPerSecond,
  }));
  autoUpdater.on('update-downloaded', (info) => _sendToRenderer('updater:downloaded', { version: info.version }));
  autoUpdater.on('error', (err) => {
    const msg = err?.message || String(err);
    console.error('[updater] Erro do autoUpdater:', msg);
    logUpdaterError('autoUpdater error event', err);
    // Durante a VERIFICAÇÃO, quem decide o que reportar ao renderer é o catch
    // de checkForUpdates (que também recebe esse mesmo erro via rejeição da
    // promise de checkForUpdates() e tenta o fallback do GitHub antes de
    // reportar "sem atualização") — não duplica aqui. Só durante o DOWNLOAD
    // nativo (updater:download abaixo) é que esse é o único aviso que existe
    // — sem isso, "Baixando..." ficava travado pra sempre se ele falhasse no meio.
    if (_downloadingNative && !_downloadRetryInProgress) {
      _sendToRenderer('updater:error', msg);
    }
  });

  ipcMain.handle('updater:check', () => checkForUpdates());

  ipcMain.handle('updater:download', async () => {
    // Verificação foi feita pelo electron-updater de verdade → baixa e
    // instala nativamente (cache próprio do electron-updater, fora da pasta
    // de instalação do app — não conflita com músicas/capas/banco de dados
    // do usuário, ver comentário histórico sobre getWritableBase() acima).
    // Sem diálogo de "salvar como": o instalador some assim que o processo
    // termina, igual ao fluxo padrão de qualquer app atualizado por essa lib.
    if (!_checkedViaGithub) {
      _downloadingNative = true;
      try {
        await downloadUpdateWithRetry();
        return { ok: true, native: true };
      } catch (e) {
        logUpdaterError('download (electron-updater nativo, todas as tentativas)', e);
        _sendToRenderer('updater:error', e.message);
        return { ok: false, error: e.message };
      } finally {
        _downloadingNative = false;
      }
    }

    // Fallback manual (dev, ou checkForUpdates() do electron-updater falhou
    // na verificação) — mesmo fluxo de sempre: GitHub API direto + o
    // operador escolhe onde salvar o instalador.
    try {
      const { asset, version } = await findLatestReleaseAsset();

      const chosen = await dialog.showSaveDialog(_mainWindow, {
        title: 'Salvar instalador da atualização',
        defaultPath: path.join(app.getPath('downloads'), asset.name),
        filters: [{ name: 'Instalador', extensions: [assetExtensionForPlatform()] }],
      });
      if (chosen.canceled || !chosen.filePath) return { canceled: true };

      await downloadInstallerWithRetry(asset.browser_download_url, chosen.filePath, (prog) => _sendToRenderer('updater:progress', prog));

      downloadedInstallerPath = chosen.filePath;
      _sendToRenderer('updater:downloaded', { version });
      return { ok: true, path: chosen.filePath };
    } catch (e) {
      logUpdaterError('download (manual)', e);
      _sendToRenderer('updater:error', e.message);
      return { ok: false, error: e.message };
    }
  });

  ipcMain.handle('updater:install', () => {
    // Download nativo: electron-updater fecha e reabre o app sozinho,
    // substituindo os arquivos — não precisa abrir instalador nenhum.
    if (!_checkedViaGithub) {
      autoUpdater.quitAndInstall();
      return;
    }
    // Download manual: abre o instalador baixado (NSIS), que assume o resto.
    if (!downloadedInstallerPath) return;
    shell.openPath(downloadedInstallerPath).then((err) => {
      if (err) {
        logUpdaterError('install', new Error(err));
        _sendToRenderer('updater:error', err);
        return;
      }
      setTimeout(() => app.quit(), 500);
    });
  });
}

module.exports = {
  init,
  setMainWindow,
  checkForUpdates,
};
