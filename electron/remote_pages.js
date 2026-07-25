// Páginas HTML estáticas servidas pelo servidor de Controle Remoto (electron/remote_server.js).
// Auto-contidas (sem build step) — mesmo padrão do form inline usado pelo regServer do Sorteio.

function controlPageHtml() {
  return `<!DOCTYPE html>
<html lang="pt">
<head>
<meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1,maximum-scale=1">
<title>Controle Remoto — LouvorJA</title>
<style>
*{box-sizing:border-box;margin:0;padding:0;-webkit-tap-highlight-color:transparent}
body{font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;
  background:linear-gradient(135deg,#1b2a41 0%,#0d1b2a 100%);
  min-height:100vh;color:#fff;padding:18px;padding-bottom:40px}
h1{font-size:18px;text-align:center;margin-bottom:4px}
.status{text-align:center;font-size:12px;color:rgba(255,255,255,.55);margin-bottom:18px;display:flex;
  align-items:center;justify-content:center;gap:6px}
.dot{width:9px;height:9px;border-radius:50%;background:#f1c40f;display:inline-block}
.dot.ok{background:#2ecc71}.dot.err{background:#e74c3c}
.card{background:rgba(255,255,255,.07);border:1px solid rgba(255,255,255,.12);border-radius:18px;
  padding:18px;margin-bottom:16px}
.dpad{display:grid;grid-template-columns:repeat(3,1fr);gap:10px;max-width:320px;margin:0 auto}
.dpad button{aspect-ratio:1;border:none;border-radius:14px;background:rgba(255,255,255,.09);
  color:#fff;font-size:26px;display:flex;align-items:center;justify-content:center;cursor:pointer}
.dpad button:active{background:rgba(255,255,255,.22);transform:scale(.96)}
.dpad .ghost{background:transparent;pointer-events:none}
input{width:100%;padding:12px 14px;background:rgba(255,255,255,.09);border:1px solid rgba(255,255,255,.18);
  border-radius:10px;color:#fff;font-size:15px;outline:none}
input::placeholder{color:rgba(255,255,255,.35)}
.results{margin-top:10px;max-height:40vh;overflow:auto}
.result{padding:12px 10px;border-bottom:1px solid rgba(255,255,255,.08);display:flex;justify-content:space-between;
  align-items:center;gap:8px}
.result .name{flex:1;font-size:14px}
.result button{background:rgba(52,152,219,.85);border:none;border-radius:8px;color:#fff;padding:8px 12px;
  font-size:12px;cursor:pointer}
.token-modal{position:fixed;inset:0;background:rgba(0,0,0,.7);display:flex;align-items:center;
  justify-content:center;padding:20px;z-index:10}
.token-modal .box{background:#152238;border-radius:16px;padding:24px;max-width:360px;width:100%}
.token-modal p{font-size:13px;color:rgba(255,255,255,.6);margin-bottom:14px}
.token-modal button{width:100%;margin-top:12px;padding:12px;background:linear-gradient(90deg,#3498db,#2980b9);
  border:none;border-radius:10px;color:#fff;font-weight:700;cursor:pointer}
.hidden{display:none !important}
</style>
</head>
<body>
<h1>🎵 LouvorJA — Controle Remoto</h1>
<div class="status"><span id="dot" class="dot"></span><span id="statusText">Conectando...</span></div>

<div class="card">
  <div class="dpad">
    <div class="ghost"></div>
    <button data-key="ArrowUp" title="Anterior">▲</button>
    <div class="ghost"></div>
    <button data-key="ArrowLeft" title="Primeiro">⏮</button>
    <button data-key="Space" title="Play/Pause">⏯</button>
    <button data-key="ArrowRight" title="Último">⏭</button>
    <div class="ghost"></div>
    <button data-key="ArrowDown" title="Próxima">▼</button>
    <button data-key="Escape" title="Fechar">✕</button>
  </div>
</div>

<div class="card">
  <input id="search" type="text" placeholder="Buscar música..." autocomplete="off" />
  <div class="results" id="results"></div>
</div>

<div class="token-modal hidden" id="tokenModal">
  <div class="box">
    <h2>Token de acesso</h2>
    <p>Informe o token exibido no LouvorJA (módulo Controle Remoto) para conectar.</p>
    <input id="tokenInput" type="text" placeholder="Token" autocomplete="off" />
    <button id="tokenSave">Conectar</button>
  </div>
</div>

<script>
function obterToken() { return localStorage.getItem('louvorja_remote_token') || ''; }
function salvarToken(t) { localStorage.setItem('louvorja_remote_token', t); }

async function chamarApi(route, params, cb) {
  const token = obterToken();
  const qs = new URLSearchParams({ ...params, token }).toString();
  try {
    const response = await fetch('/api/' + route + '?' + qs);
    const data = await response.json();
    cb(data.status === 'ok', data);
  } catch (e) {
    cb(false, { status: 'error', code: 'FAILED_FETCH' });
  }
}

function setStatus(cls, text) {
  document.getElementById('dot').className = 'dot ' + cls;
  document.getElementById('statusText').textContent = text;
}

function testarApi() {
  chamarApi('ping', {}, (ok, data) => {
    if (ok) { setStatus('ok', 'Conectado'); document.getElementById('tokenModal').classList.add('hidden'); }
    else if (data.code === 'INVALID_TOKEN') { setStatus('err', 'Token inválido'); document.getElementById('tokenModal').classList.remove('hidden'); }
    else setStatus('err', 'Sem conexão');
  });
}

document.querySelectorAll('.dpad button[data-key]').forEach((btn) => {
  btn.addEventListener('click', () => {
    chamarApi('keyboard', { key: btn.dataset.key }, (ok) => { if (!ok) testarApi(); });
  });
});

let searchDebounce = null;
document.getElementById('search').addEventListener('input', (e) => {
  clearTimeout(searchDebounce);
  const q = e.target.value.trim();
  const results = document.getElementById('results');
  if (!q) { results.innerHTML = ''; return; }
  searchDebounce = setTimeout(() => {
    chamarApi('search-songs', { q }, (ok, data) => {
      if (!ok) { results.innerHTML = ''; return; }
      results.innerHTML = (data.results || []).map((item) =>
        '<div class="result"><span class="name">' + escapeHtml(item.name || '') + '</span>' +
        '<button data-id="' + item.id + '">Abrir</button></div>'
      ).join('') || '<div class="result"><span class="name">Nenhum resultado</span></div>';
    });
  }, 400);
});

document.getElementById('results').addEventListener('click', (e) => {
  const id = e.target?.dataset?.id;
  if (!id) return;
  e.target.textContent = '...';
  chamarApi('open-song', { id, tag: 3 }, (ok) => { e.target.textContent = ok ? 'Aberto' : 'Erro'; });
});

document.getElementById('tokenSave').addEventListener('click', () => {
  const v = document.getElementById('tokenInput').value.trim();
  if (!v) return;
  salvarToken(v);
  testarApi();
});

function escapeHtml(s) {
  return String(s).replace(/[&<>"']/g, (c) => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
}

if (!obterToken()) document.getElementById('tokenModal').classList.remove('hidden');
testarApi();
setInterval(testarApi, 4000);
</script>
</body>
</html>`;
}

function mirrorPageHtml() {
  return `<!DOCTYPE html>
<html lang="pt">
<head>
<meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>LouvorJA — Transmissão</title>
<style>
*{box-sizing:border-box;margin:0;padding:0}
html,body{width:100%;height:100%;overflow:hidden;background:transparent}
#stage{position:fixed;inset:0;overflow:hidden}
.bglayer{position:absolute;inset:0;background-repeat:no-repeat;background-position:center center;
  background-size:cover;transition:opacity .5s ease;opacity:0}
.bglayer.active{opacity:1}
.bglayer video{position:absolute;inset:0;width:100%;height:100%;object-fit:cover}
#textwrap{position:absolute;inset:0;display:flex;align-items:center;justify-content:center;
  flex-direction:column;gap:0}
#auxtext,#maintext{background:rgba(0,0,0,.75);text-align:center;text-transform:uppercase;
  font-weight:700;letter-spacing:.02em;transition:opacity .5s ease;opacity:0;max-width:92vw}
#auxtext.show,#maintext.show{opacity:1}
</style>
</head>
<body>
<div id="stage">
  <div class="bglayer" id="bgA"><video id="videoA" poster="data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+A8AAQUBAScY42YAAAAASUVORK5CYII=" autoplay loop muted playsinline style="display:none;background:transparent"></video></div>
  <div class="bglayer" id="bgB"><video id="videoB" poster="data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+A8AAQUBAScY42YAAAAASUVORK5CYII=" autoplay loop muted playsinline style="display:none;background:transparent"></video></div>
  <div id="textwrap">
    <div id="auxtext"></div>
    <div id="maintext"></div>
  </div>
</div>
<script>
const params = new URLSearchParams(location.search);
const token = params.get('token') || localStorage.getItem('louvorja_remote_token') || '';

const layers = [document.getElementById('bgA'), document.getElementById('bgB')];
const videos = [document.getElementById('videoA'), document.getElementById('videoB')];
let activeLayer = 0;
let lastBgKey = null;

function fontSizePc(pc, w, h) {
  const v = Math.min(w, h);
  return (pc * v) / 100 / 2;
}

function bgKeyOf(bg) {
  if (bg && bg.type && bg.type !== 'default' && bg.type !== 'none') {
    return 'bg-' + bg.type + '-' + (bg.url || '') + '-' + (bg.opacity ?? 100);
  }
  if (bg && bg.type === 'none') return 'bg-none';
  return 'bg-default';
}

function applyBg(state) {
  const bg = state.bg;
  const key = bgKeyOf(bg);
  if (key === lastBgKey) return;
  lastBgKey = key;

  const next = 1 - activeLayer;
  const layer = layers[next];
  const video = videos[next];
  video.pause();
  video.removeAttribute('src');
  video.style.display = 'none';
  layer.style.backgroundImage = '';
  layer.style.backgroundColor = '';

  if (bg && bg.type === 'image' && bg.url) {
    layer.style.backgroundColor = bg.background_color || 'transparent';
    layer.style.backgroundImage = 'url(' + bg.url + ')';
    layer.style.backgroundSize = bg.fit || 'cover';
  } else if (bg && bg.type === 'video' && bg.url) {
    layer.style.backgroundColor = bg.background_color || 'transparent';
    video.src = bg.url;
    video.style.opacity = (bg.opacity ?? 100) / 100;
    video.style.display = 'block';
    video.play().catch(() => {});
  } else if (bg && bg.type === 'none') {
    layer.style.backgroundColor = 'transparent';
  } else {
    // 'default' — sem fundo próprio configurado; a transmissão não replica a
    // imagem padrão de cada slide (não disponível fora do app) — fica transparente.
    layer.style.backgroundColor = 'transparent';
  }

  layers[activeLayer].classList.remove('active');
  layer.classList.add('active');
  activeLayer = next;
}

function applyText(state) {
  const w = window.innerWidth, h = window.innerHeight;
  const bg = state.bg || {};
  const family = bg.font || 'DINCondensedBold, sans-serif';
  const border = bg.border_spacing ?? 5;

  const aux = document.getElementById('auxtext');
  if (state.aux_text) {
    aux.innerHTML = state.aux_text;
    aux.style.fontFamily = family;
    aux.style.fontSize = fontSizePc(bg.panel_font_size ?? 10, w, h) + 'px';
    aux.style.color = bg.panel_font_color || 'rgb(246, 195, 42)';
    aux.style.padding = '0px ' + fontSizePc(border, w, h) + 'px';
    aux.classList.add('show');
  } else {
    aux.classList.remove('show');
  }

  const main = document.getElementById('maintext');
  if (state.text) {
    main.innerHTML = state.text;
    main.style.fontFamily = family;
    main.style.padding = '0px ' + fontSizePc(border, w, h) + 'px';
    if (state.cover) {
      main.style.fontSize = fontSizePc(bg.cover_font_size ?? 25, w, h) + 'px';
      main.style.color = bg.cover_font_color || bg.font_color || 'rgb(246, 195, 42)';
    } else if (state.repeat) {
      main.style.fontSize = fontSizePc(bg.font_size ?? 20, w, h) + 'px';
      main.style.color = bg.repeat_font_color || bg.font_color || 'rgb(246, 195, 42)';
    } else {
      main.style.fontSize = fontSizePc(bg.font_size ?? 20, w, h) + 'px';
      main.style.color = bg.font_color || 'rgb(255, 255, 255)';
    }
    main.classList.add('show');
  } else {
    main.classList.remove('show');
  }
}

function applyState(state) {
  if (!state.active) {
    document.getElementById('auxtext').classList.remove('show');
    document.getElementById('maintext').classList.remove('show');
    applyBg({ bg: null });
    return;
  }
  applyBg(state);
  applyText(state);
}

function connect() {
  const es = new EventSource('/api/state-stream?token=' + encodeURIComponent(token));
  es.onmessage = (ev) => {
    try { applyState(JSON.parse(ev.data)); } catch (_) {}
  };
  es.onerror = () => {
    es.close();
    setTimeout(connect, 2000);
  };
}
connect();
</script>
</body>
</html>`;
}

module.exports = { controlPageHtml, mirrorPageHtml };
