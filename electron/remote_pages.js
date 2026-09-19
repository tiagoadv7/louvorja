// Páginas HTML estáticas servidas pelo servidor de Controle Remoto (electron/remote_server.js).
// Auto-contidas (sem build step) — mesmo padrão do form inline usado pelo regServer do Sorteio.

const fs   = require('fs');
const path = require('path');

// Ícone SVG do volume (traço, currentColor) — substitui o emoji 🔊, que rendia
// de forma inconsistente entre plataformas/navegadores. Só o visual muda;
// nenhum comportamento do JS/CSS em volta foi alterado.
const ICON_VOLUME = '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" ' +
  'stroke-width="2" stroke-linecap="round" stroke-linejoin="round">' +
  '<polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5" fill="currentColor" stroke="none"/>' +
  '<path d="M15.54 8.46a5 5 0 0 1 0 7.07"/><path d="M19.07 4.93a10 10 0 0 1 0 14.14"/></svg>';

// A fonte usada nas letras (mesma "DIN Condensed" do LouvorJA Delphi — ver
// fmMusica.pas: lblLetra.Font.Name := 'DIN Condensed') precisa ser embutida
// como data URI aqui: mirrorPageHtml() é uma página HTML autônoma servida
// direto pelo Express (fonte de navegador do OBS/vMix), fora do bundle do
// Vite — sem @font-face próprio ela nunca tinha a fonte declarada e caía
// silenciosamente no sans-serif padrão do navegador.
// Fica em electron/assets/ (não em src/) porque só a pasta electron/ é
// empacotada com o app (ver "files" no electron-builder do package.json);
// src/ some no build final.
let _dinCondensedBoldBase64 = null;
function getDinCondensedBoldFontFace() {
  if (_dinCondensedBoldBase64 === null) {
    try {
      const fontPath = path.join(__dirname, 'assets', 'din-condensed-bold.ttf');
      _dinCondensedBoldBase64 = fs.readFileSync(fontPath).toString('base64');
    } catch (e) {
      console.error('[remote_pages] Falha ao carregar fonte DIN Condensed Bold:', e.message);
      _dinCondensedBoldBase64 = '';
    }
  }
  if (!_dinCondensedBoldBase64) return '';
  return `@font-face{font-family:'DINCondensedBold';` +
    `src:url(data:font/ttf;base64,${_dinCondensedBoldBase64}) format('truetype');` +
    `font-weight:bold;font-style:normal;font-display:swap}`;
}


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
/* Botões lado a lado (mesmo padrão das ações de item da Liturgia), em vez do
   D-pad em grade 3x3 anterior. */
.dpad{display:flex;flex-wrap:wrap;justify-content:center;gap:10px}
.dpad button{flex:0 0 auto;width:52px;height:52px;border:none;border-radius:50%;background:rgba(255,255,255,.09);
  color:#fff;font-size:22px;display:flex;align-items:center;justify-content:center;cursor:pointer}
.dpad button:active{background:rgba(255,255,255,.22);transform:scale(.96)}
.dpad button#closeBtn{background:rgba(231,76,60,.25)}
input{width:100%;padding:12px 14px;background:rgba(255,255,255,.09);border:1px solid rgba(255,255,255,.18);
  border-radius:10px;color:#fff;font-size:15px;outline:none}
input::placeholder{color:rgba(255,255,255,.35)}
.results{margin-top:10px;max-height:40vh;overflow:auto}
.result{padding:12px 10px;border-bottom:1px solid rgba(255,255,255,.08);display:flex;justify-content:space-between;
  align-items:center;gap:8px}
.result .name{flex:1;font-size:14px;min-width:0}
.result .albums{display:block;font-size:11px;color:rgba(255,255,255,.5);margin-top:2px;
  overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
.result button{background:rgba(52,152,219,.85);border:none;border-radius:8px;color:#fff;padding:8px 12px;
  font-size:12px;cursor:pointer;flex-shrink:0}
.volume-label{font-size:11px;color:rgba(255,255,255,.5);margin-bottom:6px;text-transform:uppercase;letter-spacing:.03em}
.volume-row{display:flex;align-items:center;gap:12px}
.volume-icon{flex-shrink:0;display:flex;color:rgba(255,255,255,.7)}
.volume-row input[type=range]{flex:1;-webkit-appearance:none;appearance:none;height:6px;border-radius:3px;
  background:rgba(255,255,255,.18);outline:none}
.volume-row input[type=range]::-webkit-slider-thumb{-webkit-appearance:none;width:22px;height:22px;
  border-radius:50%;background:#3498db;cursor:pointer;border:none}
.volume-row input[type=range]::-moz-range-thumb{width:22px;height:22px;border-radius:50%;background:#3498db;
  cursor:pointer;border:none}
.volume-val{font-size:13px;min-width:40px;text-align:right;flex-shrink:0;color:rgba(255,255,255,.7)}
/* Controle dedicado de vídeo/áudio (independente do controle de slides acima) */
.media-row{display:flex;align-items:center;gap:10px;padding:8px 2px}
.media-row:not(:last-child){border-bottom:1px solid rgba(255,255,255,.08)}
.media-row .media-label{flex:1;font-size:14px}
.media-row button{flex:0 0 auto;width:44px;height:44px;border:none;border-radius:50%;
  background:rgba(255,255,255,.09);color:#fff;font-size:18px;display:flex;align-items:center;
  justify-content:center;cursor:pointer}
.media-row button:active{background:rgba(255,255,255,.22);transform:scale(.96)}
.media-row button.media-stop{background:rgba(231,76,60,.25)}
/* SoundMaster: lista de pads — mesmo visual da lista da Liturgia
   (.lit-list/.lit-item abaixo), só mais baixa (card menor) e com o item
   tocando destacado. */
#smPads{max-height:38vh}
.lit-item.sm-pad-active{background:rgba(52,152,219,.18);border-radius:8px}
.sm-talkover-row{display:flex;align-items:center;justify-content:space-between;margin-top:14px;margin-bottom:6px}
.sm-talkover-btn{background:rgba(255,255,255,.09);border:none;border-radius:8px;color:#fff;
  padding:6px 12px;font-size:13px;cursor:pointer}
.sm-talkover-btn.on{background:rgba(241,196,15,.85)}
/* ── Layout de duas colunas: controle de um lado, liturgia do outro ── */
.layout{display:flex;gap:16px;align-items:flex-start;flex-wrap:wrap}
.col{flex:1 1 320px;min-width:280px}
.lit-item{padding:10px;border-bottom:1px solid rgba(255,255,255,.08);display:flex;justify-content:space-between;
  align-items:center;gap:8px}
.lit-item .name{flex:1;font-size:14px}
.lit-item.lit-cat{font-weight:700;text-transform:uppercase;font-size:12px;letter-spacing:.03em;
  border-radius:8px;border-bottom:none;margin-top:8px;padding:8px 10px}
.lit-item.lit-cat:first-child{margin-top:0}
.lit-empty{padding:12px 10px;font-size:13px;color:rgba(255,255,255,.5)}
.lit-list{max-height:60vh;overflow:auto}
.lit-header{display:flex;align-items:center;justify-content:space-between;gap:10px;margin-bottom:10px}
.lit-title{font-weight:700;font-size:14px}
.lit-header button,.lit-item button{background:rgba(52,152,219,.85);border:none;border-radius:8px;color:#fff;
  padding:8px 12px;font-size:12px;cursor:pointer;flex-shrink:0}
.token-modal{position:fixed;inset:0;background:rgba(0,0,0,.7);display:flex;align-items:center;
  justify-content:center;padding:20px;z-index:10}
.token-modal .box{background:#152238;border-radius:16px;padding:24px;max-width:360px;width:100%}
.token-modal p{font-size:13px;color:rgba(255,255,255,.6);margin-bottom:14px}
.token-modal button{width:100%;margin-top:12px;padding:12px;background:linear-gradient(90deg,#3498db,#2980b9);
  border:none;border-radius:10px;color:#fff;font-weight:700;cursor:pointer}
.token-modal button:disabled{opacity:.6;cursor:default}
.token-modal .msg{font-size:12px;color:#e74c3c;margin-top:10px;min-height:14px}
.hidden{display:none !important}
</style>
</head>
<body>
<h1>🎵 LouvorJA — Controle Remoto</h1>
<div class="status"><span id="dot" class="dot"></span><span id="statusText">Conectando...</span></div>

<div class="layout">
  <div class="col col-control">
    <div class="card">
      <div class="dpad">
        <button data-key="ArrowLeft" title="Primeiro">⏮</button>
        <button data-key="ArrowUp" title="Linha anterior">◀</button>
        <button data-key="Space" title="Play/Pause">⏯</button>
        <button data-key="ArrowDown" title="Próxima linha">▶</button>
        <button data-key="ArrowRight" title="Último">⏭</button>
        <button id="closeBtn" title="Fechar projeção">✕</button>
      </div>
    </div>

    <div class="card">
      <div class="volume-label" id="volumeLabel">Volume</div>
      <div class="volume-row">
        <span class="volume-icon">${ICON_VOLUME}</span>
        <input id="volume" type="range" min="0" max="100" value="100" />
        <span class="volume-val" id="volumeVal">100%</span>
      </div>
    </div>

    <!-- Vídeo: "Áudio" (SoundMaster) foi pro card dedicado abaixo, com a
         própria lista de pads — repetir os dois botões aqui virava controle
         duplicado da mesma coisa. -->
    <div class="card">
      <div class="lit-title" style="margin-bottom:8px">Vídeo</div>
      <div class="media-row">
        <span class="media-label">Reprodução</span>
        <button data-media-target="video" data-media-action="toggle" title="Play/Pause do vídeo">⏯</button>
        <button data-media-target="video" data-media-action="stop" class="media-stop" title="Fechar vídeo">✕</button>
      </div>
      <div class="volume-label" style="margin-top:10px">Volume</div>
      <div class="volume-row">
        <span class="volume-icon">${ICON_VOLUME}</span>
        <input id="videoVolume" type="range" min="0" max="100" value="100" />
        <span class="volume-val" id="videoVolumeVal">100%</span>
      </div>
    </div>

    <!-- SoundMaster: pads de áudio de fundo, independente de vídeo/música/
         PowerPoint — controla só a mesa de som do LouvorJA por IPC interno,
         nunca a janela ativa do sistema (não precisa focar nada pra funcionar,
         então não interfere numa apresentação de PowerPoint em execução). -->
    <div class="card">
      <div class="lit-title" style="margin-bottom:10px">SoundMaster</div>
      <div class="lit-list" id="smPads"></div>
      <div class="media-row">
        <span class="media-label" id="smNowPlaying">Nada tocando</span>
        <button id="smToggleBtn" title="Play/Pause">⏯</button>
        <button id="smStopBtn" class="media-stop" title="Parar áudio">✕</button>
      </div>
      <div class="volume-label" style="margin-top:10px">Volume</div>
      <div class="volume-row">
        <span class="volume-icon">${ICON_VOLUME}</span>
        <input id="smVolume" type="range" min="0" max="100" value="100" />
        <span class="volume-val" id="smVolumeVal">100%</span>
      </div>
      <div class="sm-talkover-row">
        <span class="volume-label" style="margin:0">Atenuar (talkover)</span>
        <button id="smTalkoverBtn" class="sm-talkover-btn" title="Ligar/desligar atenuador">🎤 Atenuar</button>
      </div>
      <div class="volume-row">
        <span class="volume-icon">${ICON_VOLUME}</span>
        <input id="smDucking" type="range" min="0" max="100" value="15" />
        <span class="volume-val" id="smDuckingVal">15%</span>
      </div>
    </div>

    <div class="card">
      <input id="search" type="text" placeholder="Buscar música..." autocomplete="off" />
      <div class="results" id="results"></div>
    </div>
  </div>

  <div class="col col-liturgia">
    <div class="card">
      <div class="lit-header">
        <span class="lit-title">Liturgia</span>
        <button id="openLiturgiaBtn" title="Abrir a janela da Liturgia no LouvorJA">Abrir no LouvorJA</button>
      </div>
      <div class="lit-list" id="liturgiaList"></div>
    </div>
  </div>
</div>

<div class="token-modal hidden" id="tokenModal">
  <div class="box">
    <h2>Token de acesso</h2>
    <p>Informe o token exibido no LouvorJA (módulo Controle Remoto) para conectar.</p>
    <input id="tokenInput" type="text" placeholder="Token" autocomplete="off" />
    <button id="tokenSave">Conectar</button>
    <div class="msg" id="tokenMsg"></div>
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

function setTokenMsg(text) {
  document.getElementById('tokenMsg').textContent = text || '';
}

// Feedback sempre visível dentro da própria caixa do modal (o texto de status
// no topo da página fica coberto pelo overlay enquanto o modal está aberto,
// então erro de conexão/token passava batido sem nenhuma mensagem aparecer).
function testarApi(cb) {
  chamarApi('ping', {}, (ok, data) => {
    if (ok) {
      setStatus('ok', 'Conectado');
      setTokenMsg('');
      document.getElementById('tokenModal').classList.add('hidden');
    } else if (data.code === 'INVALID_TOKEN') {
      setStatus('err', 'Token inválido');
      setTokenMsg('Token inválido. Confira o token exibido no LouvorJA (módulo Controle Remoto).');
      document.getElementById('tokenModal').classList.remove('hidden');
    } else {
      setStatus('err', 'Sem conexão');
      setTokenMsg('Não foi possível conectar. Verifique se o celular está na mesma rede Wi-Fi do computador.');
      document.getElementById('tokenModal').classList.remove('hidden');
    }
    if (cb) cb(ok);
  });
}

document.querySelectorAll('.dpad button[data-key]').forEach((btn) => {
  btn.addEventListener('click', () => {
    chamarApi('keyboard', { key: btn.dataset.key }, (ok) => { if (!ok) testarApi(); });
  });
});

// Fechar projeção: rota própria (força fechamento sem diálogo de confirmação —
// diferente de mandar a tecla Escape, cujo $media.close() padrão abre um "tem
// certeza?" na tela do computador, que ninguém vai clicar remotamente).
document.getElementById('closeBtn').addEventListener('click', () => {
  chamarApi('close-media', {}, (ok) => { if (!ok) testarApi(); });
});

// Controle de vídeo/áudio: independente da música/slide (media-control não
// olha pra "módulo ativo", ver App.vue) — funciona mesmo com vídeo e áudio
// tocando ao mesmo tempo.
document.querySelectorAll('.media-row button[data-media-target]').forEach((btn) => {
  btn.addEventListener('click', () => {
    chamarApi('media-control', { target: btn.dataset.mediaTarget, action: btn.dataset.mediaAction },
      (ok) => { if (!ok) testarApi(); });
  });
});

// ── Volume ──────────────────────────────────────────────────────────────
const volumeInput = document.getElementById('volume');
const volumeVal    = document.getElementById('volumeVal');
const volumeLabel  = document.getElementById('volumeLabel');
const MODULE_LABEL = { media: 'Volume — Música', video_player: 'Volume — Vídeo', web_link: 'Volume — YouTube' };
let volumeDebounce  = null;
let volumeDragging  = false;

function carregarVolume() {
  if (volumeDragging) return; // não sobrescreve enquanto o usuário está arrastando
  chamarApi('get-volume', {}, (ok, data) => {
    if (!ok) return;
    volumeInput.value  = data.volume;
    volumeVal.textContent = data.volume + '%';
    volumeLabel.textContent = MODULE_LABEL[data.module] || 'Volume';
  });
}

volumeInput.addEventListener('pointerdown', () => { volumeDragging = true; });
volumeInput.addEventListener('input', (e) => {
  const v = e.target.value;
  volumeVal.textContent = v + '%';
  clearTimeout(volumeDebounce);
  volumeDebounce = setTimeout(() => chamarApi('set-volume', { value: v }, () => {}), 120);
});
volumeInput.addEventListener('change', () => { volumeDragging = false; });

carregarVolume();
setInterval(carregarVolume, 5000);

// ── Volume dedicado do Vídeo (independente do "módulo ativo" acima —
// funciona mesmo com música/YouTube sendo o que está projetado agora,
// mesmo padrão do volume do SoundMaster abaixo) ───────────────────────────
const videoVolumeInput = document.getElementById('videoVolume');
const videoVolumeVal    = document.getElementById('videoVolumeVal');
let videoVolumeDebounce = null;
let videoVolumeDragging = false;

function carregarVideoVolume() {
  if (videoVolumeDragging) return;
  chamarApi('get-volume', { target: 'video' }, (ok, data) => {
    if (!ok) return;
    videoVolumeInput.value = data.volume;
    videoVolumeVal.textContent = data.volume + '%';
  });
}

videoVolumeInput.addEventListener('pointerdown', () => { videoVolumeDragging = true; });
videoVolumeInput.addEventListener('input', (e) => {
  const v = e.target.value;
  videoVolumeVal.textContent = v + '%';
  clearTimeout(videoVolumeDebounce);
  videoVolumeDebounce = setTimeout(() => chamarApi('set-volume', { target: 'video', value: v }, () => {}), 120);
});
videoVolumeInput.addEventListener('change', () => { videoVolumeDragging = false; });

carregarVideoVolume();
setInterval(carregarVideoVolume, 5000);

// ── SoundMaster ──────────────────────────────────────────────────────────
const smPadsEl       = document.getElementById('smPads');
const smVolume       = document.getElementById('smVolume');
const smVolumeVal    = document.getElementById('smVolumeVal');
const smDucking      = document.getElementById('smDucking');
const smDuckingVal   = document.getElementById('smDuckingVal');
const smTalkoverBtn  = document.getElementById('smTalkoverBtn');
const smNowPlaying   = document.getElementById('smNowPlaying');
let smVolumeDragging  = false;
let smDuckingDragging = false;
let smVolumeDebounce   = null;
let smDuckingDebounce  = null;
let smActivePadId       = null;

function smControl(action, extra) {
  chamarApi('soundmaster-control', { action, ...extra }, (ok) => { if (!ok) testarApi(); });
}

// Lista igual à da Liturgia (.lit-item/.lit-list) — só os pads com áudio de
// verdade aparecem (mesmo critério de lá: nada de mostrar 10 slots vazios
// numa lista pensada pra itens reais), com o que estiver tocando destacado.
function renderSmPads(pads) {
  const withFile = pads.filter((p) => p.hasFile);
  if (!withFile.length) {
    smPadsEl.innerHTML = '<div class="lit-empty">Nenhum pad com áudio configurado.</div>';
    return;
  }
  smPadsEl.innerHTML = withFile.map((p) => {
    const active = p.id === smActivePadId;
    return '<div class="lit-item' + (active ? ' sm-pad-active' : '') + '">' +
      '<span class="name">' + escapeHtml(p.name || ('Pad ' + p.id)) + '</span>' +
      '<button data-pad-id="' + p.id + '">' + (active ? 'Parar' : 'Tocar') + '</button>' +
      '</div>';
  }).join('');
}

function carregarSoundMaster() {
  // Não sobrescreve enquanto o usuário arrasta os sliders (mesmo motivo do
  // volume de vídeo/música acima).
  if (smVolumeDragging || smDuckingDragging) return;
  chamarApi('soundmaster-state', {}, (ok, data) => {
    if (!ok) return;
    const np = data.nowPlaying || {};
    smActivePadId = np.active_pad_id ?? null;
    renderSmPads(data.pads || []);
    smVolume.value = np.volume ?? 100;
    smVolumeVal.textContent = Math.round(np.volume ?? 100) + '%';
    smDucking.value = np.ducking_level ?? 15;
    smDuckingVal.textContent = Math.round(np.ducking_level ?? 15) + '%';
    smTalkoverBtn.classList.toggle('on', !!np.is_talkover);
    smNowPlaying.textContent = np.playing && np.name ? np.name : 'Nada tocando';
  });
}

smPadsEl.addEventListener('click', (e) => {
  const id = e.target?.dataset?.padId;
  if (id === undefined) return;
  smControl('play_pad', { padId: id });
  setTimeout(carregarSoundMaster, 250);
});

document.getElementById('smToggleBtn').addEventListener('click', () => {
  smControl('toggle', {});
  setTimeout(carregarSoundMaster, 250);
});

document.getElementById('smStopBtn').addEventListener('click', () => {
  smControl('stop', {});
  setTimeout(carregarSoundMaster, 250);
});

smTalkoverBtn.addEventListener('click', () => {
  smControl('talkover_toggle', {});
  setTimeout(carregarSoundMaster, 250);
});

smVolume.addEventListener('pointerdown', () => { smVolumeDragging = true; });
smVolume.addEventListener('input', (e) => {
  smVolumeVal.textContent = e.target.value + '%';
  clearTimeout(smVolumeDebounce);
  smVolumeDebounce = setTimeout(() => smControl('volume', { value: e.target.value }), 120);
});
smVolume.addEventListener('change', () => { smVolumeDragging = false; });

smDucking.addEventListener('pointerdown', () => { smDuckingDragging = true; });
smDucking.addEventListener('input', (e) => {
  smDuckingVal.textContent = e.target.value + '%';
  clearTimeout(smDuckingDebounce);
  smDuckingDebounce = setTimeout(() => smControl('ducking_level', { value: e.target.value }), 120);
});
smDucking.addEventListener('change', () => { smDuckingDragging = false; });

carregarSoundMaster();
setInterval(carregarSoundMaster, 4000);

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
        '<div class="result"><span class="name">' + escapeHtml(item.name || '') +
        (item.albums && item.albums.length
          ? '<span class="albums">' + escapeHtml(item.albums.join(' • ')) + '</span>'
          : '') +
        '</span><button data-id="' + item.id + '">Abrir</button></div>'
      ).join('') || '<div class="result"><span class="name">Nenhum resultado</span></div>';
    });
  }, 400);
});

document.getElementById('results').addEventListener('click', (e) => {
  const id = e.target?.dataset?.id;
  if (!id) return;
  e.target.textContent = '...';
  chamarApi('open-song', { id, tag: 1 }, (ok) => { e.target.textContent = ok ? 'Aberto' : 'Erro'; });
});

// ── Liturgia (só leitura + abrir música, ao lado do controle) ──────────────
document.getElementById('openLiturgiaBtn').addEventListener('click', (e) => {
  const original = e.target.textContent;
  e.target.textContent = '...';
  chamarApi('open-liturgia', {}, (ok) => {
    e.target.textContent = ok ? 'Aberto!' : 'Erro';
    setTimeout(() => { e.target.textContent = original; }, 1500);
  });
});

function carregarLiturgia() {
  chamarApi('liturgia', {}, (ok, data) => {
    const el = document.getElementById('liturgiaList');
    if (!ok) return; // mantém o que já estava exibido em caso de falha pontual
    const items = data.items || [];
    if (!items.length) { el.innerHTML = '<div class="lit-empty">Nenhum item na liturgia.</div>'; return; }
    el.innerHTML = items.map((item) => {
      if (item.type === 'categoria') {
        return '<div class="lit-item lit-cat" style="background:' + escapeHtml(item.color || '#1a237e') + '">' +
          escapeHtml(item.name || '') + '</div>';
      }
      // Já tem música definida → abre direto. "Escolha na hora" (sem id_music)
      // → também mostra o botão, mas ele só leva o operador até a busca já
      // preenchida com o nome do item (não dá pra abrir sem saber qual música
      // exatamente o nome do item da liturgia corresponde).
      // has_media (midia/arquivo/link com arquivo anexado) → botão "Abrir" que
      // toca o vídeo/áudio/link no computador (ver open-liturgia-item); o
      // controle de play/pause/fechar depois é feito pelos botões fixos de
      // Vídeo/Áudio no card acima, não item a item.
      const button = item.type === 'musica' && item.id_music
        ? '<button data-id="' + item.id_music + '">Abrir</button>'
        : item.type === 'musica'
          ? '<button data-select="' + escapeHtml(item.name || '') + '">Selecionar</button>'
          : item.has_media
            ? '<button data-open-item="' + item.id + '">Abrir</button>'
            : '';
      return '<div class="lit-item">' +
        '<span class="name">' + escapeHtml(item.name || '') + '</span>' +
        button +
        '</div>';
    }).join('');
  });
}

document.getElementById('liturgiaList').addEventListener('click', (e) => {
  const id = e.target?.dataset?.id;
  if (id) {
    e.target.textContent = '...';
    chamarApi('open-song', { id, tag: 1 }, (ok) => { e.target.textContent = ok ? 'Aberto' : 'Abrir'; });
    return;
  }
  const itemId = e.target?.dataset?.openItem;
  if (itemId !== undefined) {
    e.target.textContent = '...';
    chamarApi('open-liturgia-item', { id: itemId }, (ok) => { e.target.textContent = ok ? 'Aberto' : 'Abrir'; });
    return;
  }
  const nome = e.target?.dataset?.select;
  if (nome === undefined) return;
  const search = document.getElementById('search');
  search.value = nome;
  search.dispatchEvent(new Event('input'));
  search.scrollIntoView({ behavior: 'smooth', block: 'center' });
  search.focus();
});

carregarLiturgia();
setInterval(carregarLiturgia, 5000);

document.getElementById('tokenSave').addEventListener('click', () => {
  const v = document.getElementById('tokenInput').value.trim();
  if (!v) { setTokenMsg('Digite o token.'); return; }
  const btn = document.getElementById('tokenSave');
  const original = btn.textContent;
  btn.disabled = true;
  btn.textContent = 'Conectando...';
  setTokenMsg('');
  salvarToken(v);
  testarApi(() => {
    btn.disabled = false;
    btn.textContent = original;
  });
});

function escapeHtml(s) {
  return String(s).replace(/[&<>"']/g, (c) => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
}

// QR code: o link codificado já vem com "?token=" (ver refreshQrCode() no
// módulo Controle Remoto) — ler direto da URL e salvar aqui evita pedir o
// token de novo (o celular nunca visitou esse IP:porta antes, então o
// localStorage estaria vazio mesmo com o token certo na própria URL). O link
// pra COPIAR/colar de propósito não inclui o token (ver serverUrls no mesmo
// módulo), então continua caindo no modal normalmente.
const urlToken = new URLSearchParams(location.search).get('token');
if (urlToken) salvarToken(urlToken);

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
${getDinCondensedBoldFontFace()}
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
  font-weight:700;letter-spacing:.02em;transition:opacity .5s ease;opacity:0;max-width:92vw;
  font-family:'DINCondensedBold',sans-serif}
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
    // "fill" (opção "Ampliar") não é uma palavra-chave válida de background-size
    // (só cover/contain/auto/valores explícitos) — mesmo ajuste de src/components/Slide.vue.
    layer.style.backgroundSize = bg.fit === 'fill' ? '100% 100%' : (bg.fit || 'cover');
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

// Troca o conteúdo de um texto com o mesmo efeito de crossfade de
// src/components/Slide.vue (fade 0.5s): some o texto atual, troca o
// conteúdo/estilo só depois de já estar bem apagado, e revela o novo.
// "sig" identifica o conteúdo mostrado — chamadas repetidas com o mesmo sig
// (ex.: outros campos do estado mudando, tick de progresso) não refazem o
// fade, só quando o texto realmente muda de uma linha pra outra.
function fadeSwapText(el, sig, hasContent, applyFn) {
  if (!hasContent) {
    clearTimeout(el._fadeTimer);
    el.classList.remove('show');
    el._lastSig = null;
    return;
  }
  if (el._lastSig === sig) return;
  el._lastSig = sig;

  if (!el.classList.contains('show')) {
    applyFn();
    el.classList.add('show');
    return;
  }
  el.classList.remove('show');
  clearTimeout(el._fadeTimer);
  el._fadeTimer = setTimeout(() => {
    applyFn();
    el.classList.add('show');
  }, 260); // um pouco mais da metade dos 0.5s de saída — troca já bem apagado, sem "pop"
}

function applyText(state) {
  const w = window.innerWidth, h = window.innerHeight;
  const bg = state.bg || {};
  const family = bg.font || 'DINCondensedBold, sans-serif';
  const border = bg.border_spacing ?? 5;

  const aux = document.getElementById('auxtext');
  fadeSwapText(aux, 'aux:' + state.aux_text, !!state.aux_text, () => {
    aux.innerHTML = state.aux_text;
    aux.style.fontFamily = family;
    aux.style.fontSize = fontSizePc(bg.panel_font_size ?? 10, w, h) + 'px';
    aux.style.color = bg.panel_font_color || 'rgb(246, 195, 42)';
    aux.style.padding = '0px ' + fontSizePc(border, w, h) + 'px';
  });

  const main = document.getElementById('maintext');
  const mainSig = 'main:' + state.text + ':' + state.cover + ':' + state.repeat + ':' + family;
  fadeSwapText(main, mainSig, !!state.text, () => {
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
  });
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
