// Servidor de Controle Remoto — API com token (navegação/busca/abrir música) +
// página de transmissão (mirror) para captura via OBS/vMix, na mesma rede local.
// Equivalente ao par cliente já existente em src/modules/core/remote_control
// (que consome /api/ping e /api/open-song) e ao server/ do LouvorJA Delphi.
const http = require('http');
const crypto = require('crypto');
const os = require('os');
const { app } = require('electron');
const Store = require('./store');
const { controlPageHtml, mirrorPageHtml } = require('./remote_pages');

let server       = null;
let port         = 0;
let fwRule       = null;
let fwStatus     = null;
let mainWindowRef = null;
const sseClients = new Set();
const pendingReqs = new Map();
let reqCounter    = 0;

const cache = {
  mediaData:      null,
  slideIndex:     0,
  mediaShow:      false,
  mediaMinimized: false,
  bg:             null,
  lastKey:        '',
  repeat:         false,
};

function setMainWindow(win) {
  mainWindowRef = win;
}

function getToken() {
  let token = Store.get('remote_server.token');
  if (!token) {
    token = crypto.randomBytes(9).toString('hex');
    Store.set('remote_server.token', token);
  }
  return token;
}

function regenerateToken() {
  const token = crypto.randomBytes(9).toString('hex');
  Store.set('remote_server.token', token);
  return token;
}

// Mesma heurística de electron/ipc.js#getLocalIps — mantida separada aqui
// porque este módulo pode iniciar/parar de forma independente do resto do IPC.
function getLocalIps() {
  const nets = os.networkInterfaces();
  const VIRTUAL_RE = /vmware|vmnet|virtualbox|vethernet|docker|hamachi|zerotier|nordlynx|mullvad|wireguard|tap\d|tun\d|vbox|pseudo/i;
  const REAL_RE    = /wi.?fi|wlan|ethernet|local area connection|eth\d|en\d/i;
  const seen = new Set();
  const p1 = [], p2 = [], p3 = [];

  for (const [name, addrs] of Object.entries(nets)) {
    for (const addr of addrs) {
      if (addr.family !== 'IPv4' || addr.internal || seen.has(addr.address)) continue;
      seen.add(addr.address);
      const isLan = /^(192\.168\.|10\.|172\.(1[6-9]|2\d|3[01])\.)/.test(addr.address);
      if (REAL_RE.test(name) && isLan)          p1.push(addr.address);
      else if (!VIRTUAL_RE.test(name) && isLan) p2.push(addr.address);
      else if (!VIRTUAL_RE.test(name))          p2.push(addr.address);
      else                                      p3.push(addr.address);
    }
  }
  return [...p1, ...p2, ...p3];
}

// Reconstrói a mesma sequência de slides que src/helpers/Media.js#slides()/slide()
// gera no renderer, a partir do estado cacheado (que chega via o relay genérico
// de state-update em electron/main.js) — sem isso, o processo main não tem como
// saber qual linha está em tela para alimentar a página de transmissão.
function computeMediaSlide(data, slideIndex) {
  if (!data) return null;
  let prevImage = data.url_image;
  let prevImagePosition = data.image_position;

  const slides = [
    {
      lyric: data.name,
      cover: true,
      url_image: data.url_image,
      image_position: data.image_position,
    },
    ...Object.values(data.lyric || data.slides || {})
      .filter((l) => !l.cover && l.show_slide !== 0 && l.show_slide !== false)
      .sort((a, b) => (a.order ?? 0) - (b.order ?? 0))
      .map((l) => {
        if (l.url_image) {
          prevImage = l.url_image;
          prevImagePosition = l.image_position;
        }
        return {
          ...l,
          cover: false,
          lyric: l.lyric ? String(l.lyric).replace(/[\r\n]+/g, '<br>') : '',
          url_image: prevImage,
          image_position: prevImagePosition,
        };
      }),
  ];

  return slides[slideIndex] ?? null;
}

// Atualiza o flag de "repetição" (usado para a cor do texto de repetição no
// mirror) — só chamado quando o slide/música realmente muda, nunca em
// atualizações só do fundo (senão um ajuste de cor no meio da música marcaria
// a linha atual como repetida sem nenhum avanço real ter ocorrido).
function updateRepeatState() {
  const active = !!(cache.mediaShow || cache.mediaMinimized);
  const slide  = active ? computeMediaSlide(cache.mediaData, cache.slideIndex || 0) : null;
  const key = slide ? [slide.lyric, slide.aux_lyric || '', slide.url_image || '', slide.cover].join('|') : '';
  cache.repeat  = !!(key && key === cache.lastKey && !slide?.cover);
  cache.lastKey = key;
}

function computeState() {
  const active = !!(cache.mediaShow || cache.mediaMinimized);
  const slide  = active ? computeMediaSlide(cache.mediaData, cache.slideIndex || 0) : null;

  return {
    active,
    text:           slide?.lyric || '',
    aux_text:       slide?.aux_lyric || '',
    cover:          !!slide?.cover,
    repeat:         cache.repeat,
    image:          slide?.url_image || '',
    image_position: slide?.image_position ?? 5,
    bg:             cache.bg || null,
  };
}

function broadcast() {
  if (sseClients.size === 0) return;
  const payload = `data: ${JSON.stringify(computeState())}\n\n`;
  for (const res of sseClients) {
    try { res.write(payload); } catch (_) { sseClients.delete(res); }
  }
}

// Chamado pelo relay genérico de state-update em electron/main.js para todo
// evento de estado que trafega entre as janelas — filtra e cacheia só o que
// a transmissão precisa (dados da música atual, índice do slide, fundo).
function applyStateEntry(entry) {
  if (!entry || !server) return;
  const { param, value } = entry;
  let mediaChanged = false;
  switch (param) {
    case 'modules.media.data':               cache.mediaData      = value; mediaChanged = true; break;
    case 'modules.media.config.slide_index': cache.slideIndex     = value; mediaChanged = true; break;
    case 'modules.media.show':               cache.mediaShow      = value; mediaChanged = true; break;
    case 'modules.media.minimized':          cache.mediaMinimized = value; mediaChanged = true; break;
    case 'slide_global_bg':                  cache.bg             = value; break;
    default: return;
  }
  if (mediaChanged) updateRepeatState();
  broadcast();
}

// Ponte requisição/resposta com o renderer da janela principal — usada pelas
// rotas que dependem de estado só disponível lá (busca na base local, abrir
// música, navegação por teclado reaproveitando a lógica já existente em Media.js).
function requestRenderer(type, params, timeoutMs = 8000) {
  return new Promise((resolve) => {
    if (!mainWindowRef || mainWindowRef.isDestroyed()) {
      resolve({ ok: false, code: 'NO_WINDOW' });
      return;
    }
    const reqId = ++reqCounter;
    const timer = setTimeout(() => {
      pendingReqs.delete(reqId);
      resolve({ ok: false, code: 'TIMEOUT' });
    }, timeoutMs);
    pendingReqs.set(reqId, { resolve, timer });
    mainWindowRef.webContents.send('remote:request', { reqId, type, params });
  });
}

function resolveResponse(payload) {
  if (!payload) return;
  const { reqId, ...rest } = payload;
  const pending = pendingReqs.get(reqId);
  if (!pending) return;
  clearTimeout(pending.timer);
  pendingReqs.delete(reqId);
  pending.resolve(rest);
}

function isAuthed(searchParams) {
  const token = searchParams.get('token') || '';
  return token && token === getToken();
}

function sendJson(res, status, obj) {
  res.writeHead(status, {
    'Content-Type': 'application/json; charset=utf-8',
    'Access-Control-Allow-Origin': '*',
  });
  res.end(JSON.stringify(obj));
}

function sendHtml(res, html) {
  // Sem no-store, o navegador do celular pode servir uma versão em cache da
  // página de controle depois de uma atualização do app (HTML/JS gerado aqui
  // é sempre montado na hora, nunca muda de conteúdo por si só pra precisar
  // de cache) — o celular ficaria preso numa versão antiga (ex.: sem o botão
  // de fechar sem confirmação ou o controle de volume) até uma recarga manual.
  res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8', 'Cache-Control': 'no-store' });
  res.end(html);
}

async function handleRequest(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') { res.writeHead(204); res.end(); return; }

  const url = new URL(req.url, 'http://localhost');
  const p = url.pathname;

  if (p === '/' || p === '/remote') return sendHtml(res, controlPageHtml());
  if (p === '/mirror')              return sendHtml(res, mirrorPageHtml());

  if (p === '/api/ping') {
    if (!isAuthed(url.searchParams)) return sendJson(res, 200, { status: 'error', code: 'INVALID_TOKEN' });
    return sendJson(res, 200, { status: 'ok', app: 'LouvorJA', version: app.getVersion() });
  }

  if (p === '/api/state') {
    if (!isAuthed(url.searchParams)) return sendJson(res, 200, { status: 'error', code: 'INVALID_TOKEN' });
    return sendJson(res, 200, { status: 'ok', ...computeState() });
  }

  if (p === '/api/state-stream') {
    if (!isAuthed(url.searchParams)) return sendJson(res, 200, { status: 'error', code: 'INVALID_TOKEN' });
    res.writeHead(200, {
      'Content-Type': 'text/event-stream; charset=utf-8',
      'Cache-Control': 'no-cache',
      'Connection': 'keep-alive',
      'Access-Control-Allow-Origin': '*',
    });
    res.write(`data: ${JSON.stringify(computeState())}\n\n`);
    sseClients.add(res);
    req.on('close', () => sseClients.delete(res));
    return;
  }

  if (p === '/api/keyboard') {
    if (!isAuthed(url.searchParams)) return sendJson(res, 200, { status: 'error', code: 'INVALID_TOKEN' });
    const key = url.searchParams.get('key') || '';
    const r = await requestRenderer('keyboard', { key });
    return sendJson(res, 200, r.ok ? { status: 'ok' } : { status: 'error', code: r.code || 'ERROR' });
  }

  if (p === '/api/search-songs') {
    if (!isAuthed(url.searchParams)) return sendJson(res, 200, { status: 'error', code: 'INVALID_TOKEN' });
    const q = url.searchParams.get('q') || '';
    const r = await requestRenderer('search-songs', { q });
    return sendJson(res, 200, r.ok ? { status: 'ok', results: r.results || [] } : { status: 'error', code: r.code || 'ERROR' });
  }

  if (p === '/api/liturgia') {
    if (!isAuthed(url.searchParams)) return sendJson(res, 200, { status: 'error', code: 'INVALID_TOKEN' });
    const r = await requestRenderer('get-liturgia', {});
    return sendJson(res, 200, r.ok
      ? { status: 'ok', day: r.day || '', items: r.items || [] }
      : { status: 'error', code: r.code || 'ERROR' });
  }

  if (p === '/api/open-song') {
    if (!isAuthed(url.searchParams)) return sendJson(res, 200, { status: 'error', code: 'INVALID_TOKEN' });
    const id  = url.searchParams.get('id');
    const tag = Number(url.searchParams.get('tag') || 3);
    const r = await requestRenderer('open-song', { id, tag });
    return sendJson(res, 200, r.ok ? { status: 'ok' } : { status: 'error', code: r.code || 'ERROR' });
  }

  if (p === '/api/open-liturgia') {
    if (!isAuthed(url.searchParams)) return sendJson(res, 200, { status: 'error', code: 'INVALID_TOKEN' });
    const r = await requestRenderer('open-liturgia', {});
    return sendJson(res, 200, r.ok ? { status: 'ok' } : { status: 'error', code: r.code || 'ERROR' });
  }

  // Abre o áudio/vídeo/link anexado a um item específico da liturgia (ex.: um
  // item "arquivo"/áudio ou "midia"/vídeo da ordem de culto) — só recebe o
  // "id" do item, nunca um caminho de arquivo (o renderer resolve o item de
  // verdade a partir dos dados da liturgia, ver App.vue#open-liturgia-item).
  if (p === '/api/open-liturgia-item') {
    if (!isAuthed(url.searchParams)) return sendJson(res, 200, { status: 'error', code: 'INVALID_TOKEN' });
    const id = url.searchParams.get('id');
    const r = await requestRenderer('open-liturgia-item', { id });
    return sendJson(res, 200, r.ok ? { status: 'ok' } : { status: 'error', code: r.code || 'ERROR' });
  }

  // Controle dedicado de vídeo/áudio (play/pause via "toggle", ou "stop" para
  // fechar) — target=video|audio, action=toggle|stop. Independente de qual
  // módulo está "ativo" no momento (ver comentário em App.vue#media-control).
  if (p === '/api/media-control') {
    if (!isAuthed(url.searchParams)) return sendJson(res, 200, { status: 'error', code: 'INVALID_TOKEN' });
    const target = url.searchParams.get('target') || '';
    const action = url.searchParams.get('action') || '';
    const r = await requestRenderer('media-control', { target, action });
    return sendJson(res, 200, r.ok ? { status: 'ok' } : { status: 'error', code: r.code || 'ERROR' });
  }

  if (p === '/api/close-media') {
    if (!isAuthed(url.searchParams)) return sendJson(res, 200, { status: 'error', code: 'INVALID_TOKEN' });
    const r = await requestRenderer('close-media', {});
    return sendJson(res, 200, r.ok ? { status: 'ok' } : { status: 'error', code: r.code || 'ERROR' });
  }

  if (p === '/api/get-volume') {
    if (!isAuthed(url.searchParams)) return sendJson(res, 200, { status: 'error', code: 'INVALID_TOKEN' });
    // target=video: volume do vídeo especificamente (ver App.vue#handleRemoteRequest),
    // usado pelo card dedicado "Vídeo" — sem target, comportamento antigo
    // (volume de quem estiver "ativo" na projeção no momento).
    const target = url.searchParams.get('target') || undefined;
    const r = await requestRenderer('get-volume', { target });
    return sendJson(res, 200, r.ok ? { status: 'ok', volume: r.volume ?? 100, module: r.module } : { status: 'error', code: r.code || 'ERROR' });
  }

  if (p === '/api/set-volume') {
    if (!isAuthed(url.searchParams)) return sendJson(res, 200, { status: 'error', code: 'INVALID_TOKEN' });
    const value = Number(url.searchParams.get('value'));
    const target = url.searchParams.get('target') || undefined;
    const r = await requestRenderer('set-volume', { value, target });
    return sendJson(res, 200, r.ok ? { status: 'ok' } : { status: 'error', code: r.code || 'ERROR' });
  }

  // SoundMaster (pads/volume/atenuador) — canal próprio, independente do
  // "módulo ativo" que os endpoints de vídeo/áudio acima usam (SoundMaster
  // nunca projeta nada, então nunca é ele). Ver App.vue#handleRemoteRequest.
  if (p === '/api/soundmaster-state') {
    if (!isAuthed(url.searchParams)) return sendJson(res, 200, { status: 'error', code: 'INVALID_TOKEN' });
    const r = await requestRenderer('soundmaster-state', {});
    return sendJson(res, 200, r.ok
      ? { status: 'ok', pads: r.pads || [], nowPlaying: r.nowPlaying || {} }
      : { status: 'error', code: r.code || 'ERROR' });
  }

  if (p === '/api/soundmaster-control') {
    if (!isAuthed(url.searchParams)) return sendJson(res, 200, { status: 'error', code: 'INVALID_TOKEN' });
    const action = url.searchParams.get('action') || '';
    const padId  = url.searchParams.get('padId');
    const value  = url.searchParams.get('value');
    const r = await requestRenderer('soundmaster-control', {
      action,
      padId: padId != null ? Number(padId) : undefined,
      value: value != null ? Number(value) : undefined,
    });
    return sendJson(res, 200, r.ok ? { status: 'ok' } : { status: 'error', code: r.code || 'ERROR' });
  }

  res.writeHead(404, { 'Content-Type': 'text/plain' });
  res.end('Not found');
}

async function start() {
  // Lembra que o usuário quer o servidor ligado — permite reabrir sozinho na
  // próxima inicialização do app (ver chamada em electron/ipc.js), já que sem
  // isso "Transmitir" sempre voltava desligado a cada abertura, mesmo tendo
  // sido deixado ativado de propósito.
  Store.set('remote_server.enabled', true);
  if (server) return status();
  getToken();

  server = http.createServer((req, res) => {
    handleRequest(req, res).catch(() => {
      try { res.writeHead(500); res.end(); } catch (_) { /* resposta já iniciada */ }
    });
  });

  await new Promise((resolve, reject) => {
    server.listen(0, '0.0.0.0', () => { port = server.address().port; resolve(); });
    server.on('error', (e) => { server = null; reject(e); });
  });

  if (process.platform === 'win32') {
    fwRule = `LouvorJA-Remote-${port}`;
    // "netsh advfirewall" exige elevação — sem admin ele falha em silêncio
    // (Access is denied), a porta fica bloqueada pro celular e nada acusa o
    // motivo. Guarda o resultado pra status() poder avisar a UI.
    await new Promise((resolve) => {
      require('child_process').exec(
        `netsh advfirewall firewall add rule name="${fwRule}" dir=in action=allow protocol=TCP localport=${port} profile=any`,
        { windowsHide: true },
        (err, stdout, stderr) => {
          fwStatus = err ? { ok: false, message: (stderr || err.message || '').trim() } : { ok: true };
          resolve();
        },
      );
    });
  } else {
    fwStatus = null;
  }

  return status();
}

// Libera a porta/regra de firewall sem mexer na preferência "enabled" — usada
// tanto pelo stop() (usuário desligando de propósito) quanto pelo encerramento
// do app (electron/main.js#before-quit), que precisa liberar os recursos do SO
// mas NÃO deve marcar a preferência como desligada (senão "Transmitir" nunca
// reabriria sozinho, já que o app SEMPRE chama isso ao fechar).
function stopServer() {
  if (server) { server.close(); server = null; port = 0; }
  for (const res of sseClients) { try { res.end(); } catch (_) { /* já fechado */ } }
  sseClients.clear();
  fwStatus = null;
  if (process.platform === 'win32' && fwRule) {
    const rule = fwRule;
    fwRule = null;
    require('child_process').exec(`netsh advfirewall firewall delete rule name="${rule}"`, { windowsHide: true }, () => {});
  }
  return true;
}

function stop() {
  Store.set('remote_server.enabled', false);
  return stopServer();
}

function status() {
  const ips = getLocalIps();
  return { running: !!server, port, ip: ips[0] || '127.0.0.1', ips, token: getToken(), firewall: fwStatus };
}

module.exports = {
  setMainWindow,
  start,
  stop,
  stopServer,
  status,
  getToken,
  regenerateToken,
  applyStateEntry,
  resolveResponse,
};
