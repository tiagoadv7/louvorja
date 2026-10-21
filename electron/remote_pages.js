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

// Mesmo motivo do ICON_VOLUME acima (emoji renderizava inconsistente entre
// plataformas) -- ícones em traço (stroke, currentColor). Visual geral (tema
// claro, roxo/índigo como cor de destaque, botões sempre com texto + ícone,
// nunca só ícone) inspirado nas telas do app irmão "Violin Remote"
// (apps.apple.com/br/app/violin-remote/id6810058446), referenciado pelo
// usuário como modelo de layout.
const ICON_PATHS = {
  RADIO: '<circle cx="12" cy="10" r="2"/><path d="M12 12v9"/><path d="M8.5 6.5a5 5 0 0 0 0 7"/>' +
    '<path d="M15.5 6.5a5 5 0 0 1 0 7"/><path d="M5.6 3.6a9 9 0 0 0 0 12.8"/><path d="M18.4 3.6a9 9 0 0 1 0 12.8"/>',
  SKIP_BACK: '<polygon points="19 20 9 12 19 4 19 20"/><line x1="5" y1="19" x2="5" y2="5"/>',
  CHEV_LEFT: '<polyline points="15 18 9 12 15 6"/>',
  PLAY: '<polygon points="6 3 20 12 6 21 6 3" fill="currentColor" stroke="none"/>',
  PAUSE: '<rect x="6" y="4" width="4" height="16" rx="1" fill="currentColor" stroke="none"/>' +
    '<rect x="14" y="4" width="4" height="16" rx="1" fill="currentColor" stroke="none"/>',
  CHEV_RIGHT: '<polyline points="9 18 15 12 9 6"/>',
  SKIP_FORWARD: '<polygon points="5 4 15 12 5 20 5 4"/><line x1="19" y1="5" x2="19" y2="19"/>',
  CLOSE: '<line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/>',
  MIC: '<path d="M12 1a3 3 0 0 0-3 3v8a3 3 0 0 0 6 0V4a3 3 0 0 0-3-3z"/>' +
    '<path d="M19 10v2a7 7 0 0 1-14 0v-2"/><line x1="12" y1="19" x2="12" y2="23"/><line x1="8" y1="23" x2="16" y2="23"/>',
  SEARCH: '<circle cx="11" cy="11" r="7"/><line x1="21" y1="21" x2="16.65" y2="16.65"/>',
  VIDEO: '<rect x="2" y="5" width="14" height="14" rx="3"/><path d="M16 10l6-3v10l-6-3z"/>',
  HEADPHONES: '<path d="M3 14v-2a9 9 0 0 1 18 0v2"/><rect x="2" y="14" width="5" height="7" rx="2"/><rect x="17" y="14" width="5" height="7" rx="2"/>',
  SLIDERS: '<line x1="21" y1="4" x2="14" y2="4"/><line x1="10" y1="4" x2="3" y2="4"/>' +
    '<line x1="21" y1="12" x2="12" y2="12"/><line x1="8" y1="12" x2="3" y2="12"/>' +
    '<line x1="21" y1="20" x2="16" y2="20"/><line x1="12" y1="20" x2="3" y2="20"/>' +
    '<line x1="14" y1="2" x2="14" y2="6"/><line x1="8" y1="10" x2="8" y2="14"/><line x1="16" y1="18" x2="16" y2="22"/>',
  LIST: '<line x1="8" y1="6" x2="21" y2="6"/><line x1="8" y1="12" x2="21" y2="12"/><line x1="8" y1="18" x2="21" y2="18"/>' +
    '<line x1="3" y1="6" x2="3.01" y2="6"/><line x1="3" y1="12" x2="3.01" y2="12"/><line x1="3" y1="18" x2="3.01" y2="18"/>',
  LINK: '<path d="M10 13a5 5 0 0 0 7.07 0l2.83-2.83a5 5 0 0 0-7.07-7.07L11 4.76"/>' +
    '<path d="M14 11a5 5 0 0 0-7.07 0L4.1 13.83a5 5 0 0 0 7.07 7.07L12.9 19.24"/>',
  // Mãos em oração (ícone sólido, não traço -- path do MDI "hands-pray",
  // Apache-2.0, viewBox 24x24) -- usado no botão de Atenuar (talkover),
  // que no uso real da igreja é ligado durante orações.
  HANDS_PRAY: '<path fill="currentColor" stroke="none" d="M11.43 9.67C11.47 9.78 11.5 9.88 11.5 10V15.22C11.5 15.72 11.31 16.2 10.97 16.57L8.18 19.62L4.78 16.22L6 15L8.8 2.86C8.92 2.36 9.37 2 9.89 2C10.5 2 11 2.5 11 3.11V8.07C10.84 8.03 10.67 8 10.5 8C9.4 8 8.5 8.9 8.5 10V13C8.5 13.28 8.72 13.5 9 13.5S9.5 13.28 9.5 13V10C9.5 9.45 9.95 9 10.5 9C10.69 9 10.85 9.07 11 9.16C11.12 9.23 11.21 9.32 11.3 9.42C11.33 9.46 11.36 9.5 11.38 9.55C11.4 9.59 11.42 9.63 11.43 9.67M2 19L6 22L7.17 20.73L3.72 17.28L2 19M18 15L15.2 2.86C15.08 2.36 14.63 2 14.11 2C13.5 2 13 2.5 13 3.11V8.07C13.16 8.03 13.33 8 13.5 8C14.6 8 15.5 8.9 15.5 10V13C15.5 13.28 15.28 13.5 15 13.5S14.5 13.28 14.5 13V10C14.5 9.45 14.05 9 13.5 9C13.31 9 13.15 9.07 13 9.16C12.88 9.23 12.79 9.32 12.71 9.42C12.68 9.46 12.64 9.5 12.62 9.55C12.6 9.59 12.58 9.63 12.57 9.67C12.53 9.78 12.5 9.88 12.5 10V15.22C12.5 15.72 12.69 16.2 13.03 16.57L15.82 19.62L19.22 16.22L18 15M20.28 17.28L16.83 20.73L18 22L22 19L20.28 17.28Z"/>',
  // Path do MDI "playlist-music" (Apache-2.0) -- mesmo ícone do módulo
  // Liturgia no LouvorJA (ver src/modules/liturgia/manifest.json#icon), usado
  // no botão "Abrir" da aba Liturgia aqui no remoto (antes usava o ícone de
  // câmera/vídeo, sem relação nenhuma com o que o botão realmente abre).
  PLAYLIST_MUSIC: '<path fill="currentColor" stroke="none" d="M15,6H3V8H15V6M15,10H3V12H15V10M3,16H11V14H3V16M17,6V14.18C16.69,14.07 16.35,14 16,14A3,3 0 0,0 13,17A3,3 0 0,0 16,20A3,3 0 0,0 19,17V8H22V6H17Z"/>',
};
function icon(name, size) {
  return '<svg width="' + (size || 20) + '" height="' + (size || 20) + '" viewBox="0 0 24 24" fill="none" ' +
    'stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">' +
    ICON_PATHS[name] + '</svg>';
}

// Ícone de Play/Pause que troca sozinho conforme o estado real de reprodução
// -- antes sempre mostrava só o ícone de "play", mesmo com algo tocando (o
// botão nunca tinha como saber o estado, só mandava a ação "toggle" às
// cegas). As duas versões (play/pause) nascem juntas no HTML; o <script>
// só alterna a classe "is-playing" no elemento com esse id (ver
// .play-pause-icon no <style> e carregarVolume/carregarVideoVolume/
// carregarSoundMaster mais abaixo) -- troca de ícone pura CSS, sem precisar
// montar SVG no cliente (o <script> não tem acesso à função icon() daqui,
// que só roda no processo main ao montar a página).
function playPauseIcon(id, size) {
  return '<span class="dpad-icon play-pause-icon" id="' + id + '" style="color:var(--primary)">' +
    '<span class="icon-play">' + icon('PLAY', size) + '</span>' +
    '<span class="icon-pause">' + icon('PAUSE', size) + '</span>' +
    '</span>';
}

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
<link rel="preconnect" href="https://fonts.googleapis.com">
<link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Plus+Jakarta+Sans:wght@400;500;600;700;800&display=swap">
<style>
/* Paleta, tipografia (Plus Jakarta Sans) e componentes (cartões, botões,
   sliders) seguindo de perto os mockups de referência fornecidos pelo
   usuário ("Coletânea"/"Liturgia"/"Mídia" -- app-html, exportados de uma
   ferramenta de design). Valores (cores, raios, espaçamento) replicados
   com fidelidade; o HTML/JS funcional por trás de cada ID continua o
   mesmo de antes, só o visual muda. */
*{box-sizing:border-box;margin:0;padding:0;-webkit-tap-highlight-color:transparent}
:root{
  --primary:#F5A524;--primary-dark:#D4891A;--primary-soft:#2A2110;--primary-text-on:#1A1204;--primary-text-soft:#FFC35C;
  --bg:#0A0F1C;--card:#121A2B;--card-border:#1C2539;
  --surface-2:#0D1424;--surface-3:#1A2234;--border-2:#263049;
  --text:#F2F4F8;--text-2:#C4CBD8;--text-muted:#8D97AB;--text-dim:#6B7690;
  --success:#4ADE80;--success-bg:#0F2A1C;
  --danger:#FF8A8A;--danger-bg:#2A1418;--danger-border:#4A2025;
  --info:#7EA2FF;--info-bg:#17254A;
  --radius:20px;--radius-md:16px;--radius-sm:14px;--radius-xs:12px;
  --shadow:0 12px 32px rgba(0,0,0,.45);
}
html{-webkit-text-size-adjust:100%}
body{font-family:'Plus Jakarta Sans',-apple-system,BlinkMacSystemFont,'Segoe UI',system-ui,sans-serif;
  background:var(--bg);min-height:100vh;color:var(--text)}
input,button{font-family:inherit}
/* Slider nativo com trilho preenchido via gradient (ver inline style de
   cada input[type=range]) + thumb circular branco -- mesma técnica dos
   mockups de referência. */
/* .rng-wrap: o trilho (cinza) e o preenchimento (amarelo) viram duas divs
   próprias por baixo do <input>, cada uma com seu próprio border-radius --
   antes o preenchimento era só um gradient no mesmo elemento (ver
   fillSlider), então a ponta onde o amarelo termina era sempre um corte reto
   (nunca arredondada, só as pontas do trilho inteiro eram). O <input> em si
   fica com o fundo transparente e só contribui com o thumb (bolinha) por
   cima, então o arrastar/toque continua 100% nativo. */
.rng-wrap{position:relative;flex:1;height:22px;display:flex;align-items:center}
.rng-track{position:absolute;left:0;right:0;height:8px;border-radius:999px;background:var(--surface-3);pointer-events:none}
.rng-fill{position:absolute;left:0;height:8px;border-radius:999px;background:var(--primary);pointer-events:none;
  width:0%;transition:width .08s ease-out}
.rng{position:relative;z-index:1;-webkit-appearance:none;appearance:none;width:100%;height:8px;border-radius:999px;
  outline:none;margin:0;cursor:pointer;background:transparent}
.rng::-webkit-slider-thumb{-webkit-appearance:none;appearance:none;width:22px;height:22px;border-radius:50%;
  background:#fff;border:0;box-shadow:0 2px 8px rgba(0,0,0,.45)}
.rng::-moz-range-thumb{width:22px;height:22px;border-radius:50%;background:#fff;border:0;box-shadow:0 2px 8px rgba(0,0,0,.45)}
.rng::-moz-range-track{background:transparent}
.rng:focus-visible{box-shadow:0 0 0 3px rgba(245,165,36,.45)}
.topbar{position:sticky;top:0;z-index:5;display:flex;align-items:center;gap:10px;
  padding:20px 16px 16px;background:var(--bg)}
.topbar-icon{width:36px;height:36px;border-radius:var(--radius-xs);background:var(--primary-soft);color:var(--primary);
  display:flex;align-items:center;justify-content:center;flex-shrink:0}
.topbar-titles{display:flex;flex-direction:column;gap:1px;flex:1;min-width:0}
.topbar-title{font-size:15px;font-weight:700;letter-spacing:-.01em;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
.topbar-sub{font-size:12px;color:var(--text-muted)}
h1{display:none}
.status{display:flex;align-items:center;gap:6px;padding:6px 10px;border-radius:999px;flex-shrink:0;
  background:var(--surface-3);color:var(--text-muted);font-size:12px;font-weight:600}
.status.ok{background:var(--success-bg);color:var(--success)}
.status.err{background:var(--danger-bg);color:var(--danger)}
.dot{width:7px;height:7px;border-radius:50%;background:currentColor;display:inline-block;flex-shrink:0;
  box-shadow:0 0 0 3px currentColor,0 0 0 3px rgba(0,0,0,0);opacity:.95}
/* padding-bottom reserva espaço pra barra de abas fixa no rodapé (.tabbar
   abaixo) não cobrir o fim do conteúdo. */
.main{max-width:560px;margin:0 auto;padding:4px 16px 16px;padding-bottom:88px}
/* Abas (Controle/Mídia/Liturgia) -- organização sugerida pelo usuário. Cada
   painel é só escondido via CSS; nenhum conteúdo/id interno dos cards muda
   de aba pra aba. */
.tab-panel{display:none}
.tab-panel.active{display:flex;flex-direction:column;gap:14px}
.tabbar{position:fixed;left:0;right:0;bottom:0;z-index:6;display:flex;
  background:var(--card);border-top:1px solid var(--card-border);
  padding:8px 4px calc(8px + env(safe-area-inset-bottom, 0px))}
.tab-btn{flex:1;display:flex;flex-direction:column;align-items:center;gap:4px;
  border:none;background:transparent;color:var(--text-muted);padding:4px 2px;
  cursor:pointer;font-size:11px;font-weight:500;transition:color .12s ease}
.tab-btn .dpad-icon{color:inherit}
.tab-btn.active{color:var(--primary)}
.card{background:var(--card);border:1px solid var(--card-border);border-radius:var(--radius);padding:14px}
.card-title{display:flex;align-items:center;gap:12px;margin-bottom:14px}
.card-title-icon{width:34px;height:34px;border-radius:var(--radius-xs);display:flex;align-items:center;
  justify-content:center;flex-shrink:0;background:var(--surface-3);color:var(--text-2)}
.card-title-text{display:flex;flex-direction:column;gap:1px;flex:1;min-width:0}
.card-title-text .t{font-size:15px;font-weight:700}
.card-title-text .s{font-size:12px;color:var(--text-muted)}
/* Linha de navegação: pontas só-ícone + meio com rótulo (um deles em
   destaque na cor de marca) -- mesmo padrão do mockup de referência. */
.navrow{display:flex;gap:8px}
.nav-end{width:52px;height:60px;flex-shrink:0;border:1px solid var(--border-2);border-radius:var(--radius-md);
  background:var(--surface-3);color:var(--text-2);display:flex;align-items:center;justify-content:center;
  cursor:pointer;transition:background .12s ease,transform .12s ease}
.nav-end:active{background:var(--card-border);transform:scale(.96)}
.nav-mid{flex:1;height:60px;border:1px solid var(--border-2);border-radius:var(--radius-md);
  background:var(--surface-3);color:var(--text);font-size:15px;font-weight:700;
  display:flex;align-items:center;justify-content:center;gap:6px;cursor:pointer;
  transition:background .12s ease,transform .12s ease}
.nav-mid:active{background:var(--card-border);transform:scale(.98)}
/* Tom suave (igual ao .abtn.soft-accent dos cartões de Mídia) em vez do
   amarelo cheio de antes -- o usuário achou os botões "muito coloridos",
   então o destaque de "Próxima" passou a combinar com o resto. */
.nav-mid--accent{border:1px solid #3A3220;background:var(--primary-soft);color:var(--primary-text-soft)}
.nav-mid--accent:active{opacity:.85}
/* Ícone de Play/Pause que troca sozinho com o estado real (ver playPauseIcon
   no topo do arquivo e carregarVolume/carregarVideoVolume/carregarSoundMaster
   no <script>) -- as duas versões já nascem no HTML, só a visibilidade troca. */
.play-pause-icon .icon-pause{display:none}
.play-pause-icon.is-playing .icon-play{display:none}
.play-pause-icon.is-playing .icon-pause{display:flex}
.dpad-icon{display:flex}
/* Botões de ação (Play/Pause, Fechar, Parar) -- pares lado a lado numa
   grade de 2 colunas, variantes de cor por função. */
.abtn-row{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:10px}
.abtn{height:54px;border:none;border-radius:var(--radius-md);font-size:14px;font-weight:700;
  display:flex;align-items:center;justify-content:center;gap:8px;cursor:pointer;
  transition:background .12s ease,opacity .12s ease,transform .12s ease}
.abtn:active{transform:scale(.98)}
.abtn.accent{background:var(--primary);color:var(--primary-text-on)}
.abtn.accent:active{background:var(--primary-dark)}
.abtn.soft-accent{border:1px solid #3A3220;background:var(--primary-soft);color:var(--primary-text-soft)}
.abtn.soft-accent:active{opacity:.85}
.abtn.soft-danger{border:1px solid var(--danger-border);background:var(--danger-bg);color:var(--danger)}
.abtn.soft-danger:active{opacity:.85}
.abtn.outline{border:1px solid var(--border-2);background:var(--surface-3);color:var(--text)}
.abtn.outline:active{background:var(--card-border)}
input{width:100%;padding:12px 14px;background:var(--surface-2);border:1px solid var(--border-2);
  border-radius:var(--radius-sm);color:var(--text);font-size:15px;outline:none;transition:border-color .12s ease}
input:focus{border-color:var(--primary)}
input::placeholder{color:var(--text-dim)}
.field-group{display:flex;flex-direction:column;gap:10px}
.field-label-row{display:flex;justify-content:space-between;font-size:13px}
.field-label-row label{color:var(--text-2);font-weight:600}
.field-label-row .val{color:var(--text-muted);font-variant-numeric:tabular-nums}
.search-box{position:relative;height:48px;border-radius:var(--radius-sm);background:var(--surface-2);
  border:1px solid var(--border-2);display:flex;align-items:center;gap:10px;padding:0 14px;color:var(--text-muted)}
.search-box svg{flex-shrink:0}
.search-box input{flex:1;min-width:0;border:0;background:transparent;padding:0;height:auto}
.results{display:flex;flex-direction:column;margin-top:10px}
.result,.row-item{display:flex;align-items:center;gap:12px;padding:8px;border-radius:var(--radius-md)}
.row-badge{width:40px;height:40px;border-radius:var(--radius-xs);flex-shrink:0;display:flex;align-items:center;
  justify-content:center;font-size:13px;font-weight:700;background:var(--surface-3);color:var(--text-2)}
.result .name,.row-item .title{align-self:stretch;min-width:0;font-size:15px;font-weight:600;white-space:nowrap;
  overflow:hidden;text-overflow:ellipsis}
/* align-items:flex-start -- sem isso, filhos flex numa coluna (a tag/chip
   de tipo, "Música"/"Escolher na hora"/"Mídia") esticam pra largura cheia
   por padrão, virando uma barra ao invés de um chip ajustado ao texto; name/
   title/sub pedem align-self:stretch de volta, só eles, pra continuar
   truncando com reticências na largura certa. */
.result-info,.row-info{flex:1;min-width:0;display:flex;flex-direction:column;align-items:flex-start;gap:2px}
.result .albums,.row-item .sub{align-self:stretch;display:block;font-size:12px;font-weight:400;color:var(--text-muted);
  overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
.row-play{width:44px;height:44px;border-radius:50%;border:0;flex-shrink:0;display:flex;align-items:center;
  justify-content:center;background:var(--primary-soft);color:var(--primary-text-soft);cursor:pointer}
.row-play:active{opacity:.8}
.result-empty{padding:18px 8px;text-align:center;font-size:13px;color:var(--text-muted)}
.volume-label{font-size:13px;color:var(--text-2);font-weight:600;margin-bottom:10px}
.volume-row{display:flex;align-items:center;gap:12px}
.volume-icon{flex-shrink:0;display:flex;color:var(--text-muted)}
.volume-val{font-size:13px;min-width:38px;text-align:right;flex-shrink:0;color:var(--text-muted);
  font-variant-numeric:tabular-nums}
.media-status{font-size:14px;font-weight:600;color:var(--text);margin-bottom:10px}
/* Tempo decorrido/restante da faixa do SoundMaster -- só aparece quando a
   duração da faixa é conhecida (ver carregarSoundMaster), igual ao resto do
   card de volume por baixo: trilho+preenchimento em .rng-wrap, mas sem
   <input> (é só mostrador, não dá pra arrastar/buscar na faixa por aqui). */
.sm-progress-wrap{margin-bottom:14px}
.sm-progress-rng{height:8px}
.sm-time-row{display:flex;justify-content:space-between;margin-top:6px;font-size:12px;
  color:var(--text-muted);font-variant-numeric:tabular-nums}
/* SoundMaster: lista de pads — mesmo cartão de linha numerada da Liturgia
   (.row-item abaixo), só mais baixa e com o pad tocando destacado. */
#smPads{max-height:38vh;overflow:auto;display:flex;flex-direction:column;margin-bottom:4px}
.row-item.sm-pad-active{background:var(--primary-soft)}
.row-item.sm-pad-active .row-badge{background:var(--primary);color:var(--primary-text-on)}
.row-item.sm-pad-active .row-play{background:var(--primary);color:var(--primary-text-on)}
.sm-talkover-row{display:flex;align-items:center;justify-content:space-between;gap:12px}
.sm-talkover-row .field-label-row{flex:1}
.sm-talkover-btn{height:40px;padding:0 14px;border-radius:999px;border:1px solid var(--border-2);
  background:var(--surface-3);color:var(--text);font-size:13px;font-weight:700;cursor:pointer;
  display:inline-flex;align-items:center;gap:8px;flex-shrink:0}
.sm-talkover-btn.on{border-color:#3B5BB5;background:var(--info-bg);color:#A9C1FF}
.divider{height:1px;background:var(--card-border)}
/* Liturgia: seções viram cartões (ícone + nome + contagem), itens numerados
   reaproveitam o mesmo .row-item/.row-badge/.row-play de cima. */
.lit-section{background:var(--surface-2);border:1px solid var(--card-border);border-radius:var(--radius-md);overflow:hidden}
.lit-section-head{display:flex;align-items:center;gap:12px;padding:12px 12px 10px}
.lit-section-icon{width:32px;height:32px;border-radius:var(--radius-xs);display:flex;align-items:center;
  justify-content:center;flex-shrink:0}
.lit-section-text{flex:1;min-width:0;display:flex;flex-direction:column;gap:1px}
.lit-section-text .name{font-size:14px;font-weight:700}
.lit-section-text .meta{font-size:12px;color:var(--text-muted)}
.lit-section-items{display:flex;flex-direction:column;padding:0 6px 6px}
.lit-tag{display:inline-flex;align-items:center;gap:4px;padding:2px 7px;border-radius:999px;
  font-size:11px;font-weight:700;background:var(--primary-soft);color:var(--primary-text-soft)}
.lit-tag.muted{background:var(--surface-3);color:var(--text-muted)}
.lit-tag.info{background:var(--info-bg);color:var(--info)}
.lit-select-btn{height:40px;padding:0 14px;border-radius:var(--radius-xs);border:1px solid #3A3220;
  background:transparent;color:var(--primary-text-soft);font-size:13px;font-weight:700;cursor:pointer;flex-shrink:0}
.lit-select-btn:active{background:var(--primary-soft)}
.lit-empty{padding:12px 4px;font-size:13px;color:var(--text-muted)}
.lit-header{display:flex;align-items:center;justify-content:space-between;gap:10px}
.lit-header .title-group{display:flex;flex-direction:column;gap:4px}
.lit-eyebrow{font-size:12px;font-weight:600;color:var(--text-muted);text-transform:uppercase;letter-spacing:.08em}
.lit-title{margin:0;font-size:26px;line-height:1.1;font-weight:800;letter-spacing:-.02em}
.lit-header button{height:44px;padding:0 16px;border:0;border-radius:var(--radius-xs);background:var(--primary);
  color:var(--primary-text-on);font-size:14px;font-weight:700;display:flex;align-items:center;gap:8px;cursor:pointer}
.lit-header button:active{background:var(--primary-dark)}
.token-modal{position:fixed;inset:0;background:rgba(5,9,16,.8);display:flex;align-items:center;
  justify-content:center;padding:20px;z-index:10}
.token-modal .box{background:var(--card);border:1px solid var(--card-border);border-radius:var(--radius);
  padding:24px;max-width:360px;width:100%;box-shadow:var(--shadow)}
.token-modal .box-icon{width:44px;height:44px;border-radius:var(--radius-xs);background:var(--primary-soft);
  color:var(--primary);display:flex;align-items:center;justify-content:center;margin-bottom:12px}
.token-modal h2{font-size:16px}
.token-modal p{font-size:13px;color:var(--text-muted);margin:8px 0 14px;line-height:1.45}
.token-modal .field-label{display:block;font-size:12px;font-weight:600;color:var(--text-muted);margin-bottom:6px}
.token-modal button{width:100%;margin-top:12px;padding:12px;background:var(--primary);
  border:none;border-radius:var(--radius-sm);color:var(--primary-text-on);font-weight:700;cursor:pointer;
  transition:background .12s ease}
.token-modal button:active{background:var(--primary-dark)}
.token-modal button:disabled{opacity:.6;cursor:default}
.token-modal .msg{font-size:12px;color:var(--danger);margin-top:10px;min-height:14px}
.hidden{display:none !important}
</style>
</head>
<body>
<div class="topbar">
  <div class="topbar-icon">${icon('RADIO', 20)}</div>
  <div class="topbar-titles">
    <span class="topbar-title">LouvorJA</span>
    <span class="topbar-sub">Controle remoto</span>
  </div>
  <div class="status" id="statusPill"><span id="dot" class="dot"></span><span id="statusText">Conectando...</span></div>
</div>

<div class="main">
  <!-- 3 abas (Controle/Mídia/Liturgia) -- organização sugerida pelo usuário
       (mockup ilustrativo). A Pesquisa (antes aba própria) foi unificada
       aqui dentro de Mídia, junto do controle de reprodução/coletânea e dos
       volumes (ideia do mesmo mockup) -- Controle ficou só com a navegação
       de linhas/slides, que é sobre a PROJEÇÃO atual, não sobre escolher o
       que tocar. Visual continua o mesmo de antes (cards/cores atuais), só
       a divisão de abas mudou. Cada aba é só um <div> escondido/mostrado
       via CSS (.tab-panel.active) -- nenhum HTML nem id interno dos cards
       mudou, só a forma como ficam agrupados/visíveis. Troca de aba é JS
       puro no fim do <script>. -->
  <div class="tab-panel active" data-panel="controle">
    <div class="card">
      <div class="card-title">
        <div class="card-title-icon">${icon('SLIDERS', 18)}</div>
        <div class="card-title-text"><span class="t">Navegação</span><span class="s">Avança/volta na projeção atual</span></div>
      </div>
      <div class="navrow">
        <button class="nav-end" data-key="ArrowLeft" title="Primeiro" aria-label="Primeiro">${icon('SKIP_BACK', 20)}</button>
        <button class="nav-mid" data-key="ArrowUp" title="Linha anterior">${icon('CHEV_LEFT', 20)}<span>Anterior</span></button>
        <button class="nav-mid nav-mid--accent" data-key="ArrowDown" title="Próxima linha"><span>Próxima</span>${icon('CHEV_RIGHT', 20)}</button>
        <button class="nav-end" data-key="ArrowRight" title="Último" aria-label="Último">${icon('SKIP_FORWARD', 20)}</button>
      </div>
    </div>

    <div class="card">
      <div class="card-title">
        <div class="card-title-icon">${icon('PLAY', 18)}</div>
        <div class="card-title-text"><span class="t">Mídia</span><span class="s">Projeção atual (slide, vídeo ou link)</span></div>
      </div>
      <div class="abtn-row">
        <button class="abtn soft-accent" data-key="Space" title="Play/Pause">
          ${playPauseIcon('mediaPlayIcon', 18)}<span>Play/Pause</span>
        </button>
        <button id="closeBtn" class="abtn soft-danger" title="Fechar projeção">
          ${icon('CLOSE', 18)}<span>Fechar</span>
        </button>
      </div>
      <div class="field-group" style="margin-top:14px">
        <div class="field-label-row"><label id="volumeLabel">Volume</label><span class="val" id="volumeVal">100%</span></div>
        <div class="volume-row">
          <span class="volume-icon">${ICON_VOLUME}</span>
          <div class="rng-wrap">
            <div class="rng-track"></div>
            <div class="rng-fill"></div>
            <input id="volume" class="rng" type="range" min="0" max="100" value="100" />
          </div>
        </div>
      </div>
    </div>

    <div class="card">
      <div class="card-title">
        <div class="card-title-icon">${icon('SEARCH', 18)}</div>
        <div class="card-title-text"><span class="t">Buscar na coletânea</span><span class="s">Procure por título da música</span></div>
      </div>
      <div class="search-box">
        ${icon('SEARCH', 16)}
        <input id="search" type="search" placeholder="Nome da música…" autocomplete="off" />
      </div>
      <div class="results" id="results"></div>
    </div>
  </div>

  <div class="tab-panel" data-panel="midia">
    <!-- Vídeo + SoundMaster, juntos nessa aba. -->
    <div class="card">
      <div class="card-title">
        <div class="card-title-icon" style="background:var(--info-bg);color:var(--info)">${icon('VIDEO', 18)}</div>
        <div class="card-title-text"><span class="t">Vídeo</span><span class="s">Reprodução independente da projeção</span></div>
      </div>
      <div class="abtn-row">
        <button class="abtn soft-accent" data-media-target="video" data-media-action="toggle" title="Play/Pause do vídeo">
          ${playPauseIcon('videoPlayIcon', 18)}<span>Play/Pause</span>
        </button>
        <button class="abtn soft-danger" data-media-target="video" data-media-action="stop" title="Fechar vídeo">
          ${icon('CLOSE', 18)}<span>Fechar</span>
        </button>
      </div>
      <div class="field-group" style="margin-top:14px">
        <div class="field-label-row"><label>Volume</label><span class="val" id="videoVolumeVal">100%</span></div>
        <div class="volume-row">
          <span class="volume-icon">${ICON_VOLUME}</span>
          <div class="rng-wrap">
            <div class="rng-track"></div>
            <div class="rng-fill"></div>
            <input id="videoVolume" class="rng" type="range" min="0" max="100" value="100" />
          </div>
        </div>
      </div>
    </div>

    <!-- SoundMaster: pads de áudio de fundo, independente de vídeo/música/
         PowerPoint — controla só a mesa de som do LouvorJA por IPC interno,
         nunca a janela ativa do sistema (não precisa focar nada pra funcionar,
         então não interfere numa apresentação de PowerPoint em execução). -->
    <div class="card">
      <div class="card-title">
        <div class="card-title-icon" style="background:var(--primary-soft);color:var(--primary-text-soft)">${icon('HEADPHONES', 18)}</div>
        <div class="card-title-text"><span class="t">SoundMaster</span><span class="s">Pads de áudio de fundo</span></div>
      </div>
      <div id="smPads"></div>
      <div style="margin:10px 0 14px;padding:14px;border-radius:var(--radius-md);background:var(--surface-2);
        border:1px solid var(--card-border)">
        <div class="media-status" id="smNowPlaying">Nada tocando</div>
        <div class="sm-progress-wrap hidden" id="smProgressWrap">
          <div class="rng-wrap sm-progress-rng">
            <div class="rng-track"></div>
            <div class="rng-fill" id="smProgressFill"></div>
          </div>
          <div class="sm-time-row">
            <span id="smTimeElapsed">0:00</span>
            <span id="smTimeRemaining">-0:00</span>
          </div>
        </div>
        <div class="abtn-row">
          <button class="abtn soft-accent" id="smToggleBtn" title="Play/Pause">${playPauseIcon('smPlayIcon', 18)}<span>Play/Pause</span></button>
          <button class="abtn outline" id="smStopBtn" title="Parar áudio">${icon('CLOSE', 16)}<span>Parar</span></button>
        </div>
      </div>
      <div class="field-group">
        <div class="field-label-row"><label>Volume</label><span class="val" id="smVolumeVal">100%</span></div>
        <div class="volume-row">
          <span class="volume-icon">${ICON_VOLUME}</span>
          <div class="rng-wrap">
            <div class="rng-track"></div>
            <div class="rng-fill"></div>
            <input id="smVolume" class="rng" type="range" min="0" max="100" value="100" />
          </div>
        </div>
      </div>
      <div class="divider" style="margin:16px 0"></div>
      <div class="sm-talkover-row">
        <div class="field-label-row" style="flex-direction:column;gap:2px">
          <label>Atenuar (talkover)</label>
          <span class="val" style="font-size:12px">Baixa a música enquanto alguém fala</span>
        </div>
        <button id="smTalkoverBtn" class="sm-talkover-btn" title="Ligar/desligar atenuador">${icon('MIC', 14)}<span>Atenuar</span></button>
      </div>
      <div class="volume-row" style="margin-top:12px">
        <span class="volume-icon">${ICON_VOLUME}</span>
        <div class="rng-wrap">
          <div class="rng-track"></div>
          <div class="rng-fill"></div>
          <input id="smDucking" class="rng" type="range" min="0" max="100" value="15" />
        </div>
        <span class="volume-val" id="smDuckingVal">15%</span>
      </div>
    </div>
  </div>

  <div class="tab-panel" data-panel="liturgia">
    <div class="card">
      <div class="lit-header">
        <div class="title-group">
          <span class="lit-eyebrow">Culto de hoje</span>
          <h2 class="lit-title">Liturgia</h2>
        </div>
        <button id="openLiturgiaBtn" title="Abrir a janela da Liturgia no LouvorJA">${icon('PLAYLIST_MUSIC', 18)}<span>Abrir</span></button>
      </div>
    </div>
    <div id="liturgiaList" style="display:flex;flex-direction:column;gap:14px"></div>
  </div>
</div>

<div class="tabbar">
  <button class="tab-btn active" data-tab="controle">
    <span class="dpad-icon">${icon('SLIDERS', 20)}</span><span>Controle</span>
  </button>
  <button class="tab-btn" data-tab="midia">
    <span class="dpad-icon">${icon('PLAY', 20)}</span><span>Mídia</span>
  </button>
  <button class="tab-btn" data-tab="liturgia">
    <span class="dpad-icon">${icon('LIST', 20)}</span><span>Liturgia</span>
  </button>
</div>

<div class="token-modal hidden" id="tokenModal">
  <div class="box">
    <div class="box-icon">${icon('LINK', 22)}</div>
    <h2>Token de acesso</h2>
    <p>Informe o token exibido no LouvorJA (módulo Controle Remoto) para conectar.</p>
    <label class="field-label" for="tokenInput">Token</label>
    <input id="tokenInput" type="text" placeholder="Ex.: ABC1D" autocomplete="off" />
    <button id="tokenSave">Conectar</button>
    <div class="msg" id="tokenMsg"></div>
  </div>
</div>

<script>
// ── Abas (Controle/Mídia/Liturgia/Pesquisar) ───────────────────────────────
// Troca só CSS (.tab-panel.active / .tab-btn.active) -- nenhum dado recarrega
// ao trocar de aba, os polls (volume, soundmaster, liturgia) continuam
// rodando em segundo plano pelas mesmas setInterval de sempre, então o
// conteúdo já está pronto quando o operador volta pra uma aba.
document.querySelectorAll('.tab-btn').forEach((btn) => {
  btn.addEventListener('click', () => {
    const tab = btn.dataset.tab;
    document.querySelectorAll('.tab-btn').forEach((b) => b.classList.toggle('active', b === btn));
    document.querySelectorAll('.tab-panel').forEach((p) => p.classList.toggle('active', p.dataset.panel === tab));
  });
});

// Ícones usados em HTML montado aqui no cliente (listas de SoundMaster/busca/
// liturgia) -- duplicados do icon()/ICON_PATHS do processo main (ver topo de
// remote_pages.js) porque esse helper só existe lá, ao montar a página; aqui
// no <script>, que roda no navegador, não tem acesso a ele.
const ICON_PLAY_SVG = '<svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor"><polygon points="6 3 20 12 6 21 6 3"/></svg>';
const ICON_PAUSE_SVG = '<svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor"><rect x="6" y="4" width="4" height="16" rx="1"/><rect x="14" y="4" width="4" height="16" rx="1"/></svg>';
// Mesmo path do ICON_PATHS.HANDS_PRAY no processo main (ver topo do arquivo)
// -- usado como marcador dos itens da liturgia cujo nome é uma oração (ver
// renderLiturgiaRow).
const ICON_HANDS_PRAY_SVG = '<svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor"><path d="M11.43 9.67C11.47 9.78 11.5 9.88 11.5 10V15.22C11.5 15.72 11.31 16.2 10.97 16.57L8.18 19.62L4.78 16.22L6 15L8.8 2.86C8.92 2.36 9.37 2 9.89 2C10.5 2 11 2.5 11 3.11V8.07C10.84 8.03 10.67 8 10.5 8C9.4 8 8.5 8.9 8.5 10V13C8.5 13.28 8.72 13.5 9 13.5S9.5 13.28 9.5 13V10C9.5 9.45 9.95 9 10.5 9C10.69 9 10.85 9.07 11 9.16C11.12 9.23 11.21 9.32 11.3 9.42C11.33 9.46 11.36 9.5 11.38 9.55C11.4 9.59 11.42 9.63 11.43 9.67M2 19L6 22L7.17 20.73L3.72 17.28L2 19M18 15L15.2 2.86C15.08 2.36 14.63 2 14.11 2C13.5 2 13 2.5 13 3.11V8.07C13.16 8.03 13.33 8 13.5 8C14.6 8 15.5 8.9 15.5 10V13C15.5 13.28 15.28 13.5 15 13.5S14.5 13.28 14.5 13V10C14.5 9.45 14.05 9 13.5 9C13.31 9 13.15 9.07 13 9.16C12.88 9.23 12.79 9.32 12.71 9.42C12.68 9.46 12.64 9.5 12.62 9.55C12.6 9.59 12.58 9.63 12.57 9.67C12.53 9.78 12.5 9.88 12.5 10V15.22C12.5 15.72 12.69 16.2 13.03 16.57L15.82 19.62L19.22 16.22L18 15M20.28 17.28L16.83 20.73L18 22L22 19L20.28 17.28Z"/></svg>';

// Ícones de categoria da liturgia (ver CATEGORY_ICON_RULES/categoriaIconSvg
// abaixo) -- paths do MDI (Apache-2.0), mesmo conjunto usado pelo editor de
// Liturgia do LouvorJA (src/modules/liturgia/interface/Index.vue,
// CATEGORY_ICON_RULES) pra essas duas telas combinarem.
const ICON_CAT = {
  TAG: '<path d="M21.41 11.58L12.41 2.58A2 2 0 0 0 11 2H4A2 2 0 0 0 2 4V11A2 2 0 0 0 2.59 12.42L11.59 21.42A2 2 0 0 0 13 22A2 2 0 0 0 14.41 21.41L21.41 14.41A2 2 0 0 0 22 13A2 2 0 0 0 21.41 11.58M13 20L4 11V4H11L20 13M6.5 5A1.5 1.5 0 1 1 5 6.5A1.5 1.5 0 0 1 6.5 5Z"/>',
  MUSIC: '<path d="M12 3V13.55C11.41 13.21 10.73 13 10 13C7.79 13 6 14.79 6 17S7.79 21 10 21 14 19.21 14 17V7H18V3H12Z"/>',
  BOOK: '<path d="M19 1L14 6V17L19 12.5V1M21 5V18.5C19.9 18.15 18.7 18 17.5 18C15.8 18 13.35 18.65 12 19.5V6C10.55 4.9 8.45 4.5 6.5 4.5C4.55 4.5 2.45 4.9 1 6V20.65C1 20.9 1.25 21.15 1.5 21.15C1.6 21.15 1.65 21.1 1.75 21.1C3.1 20.45 5.05 20 6.5 20C8.45 20 10.55 20.4 12 21.5C13.35 20.65 15.8 20 17.5 20C19.15 20 20.85 20.3 22.25 21.05C22.35 21.1 22.4 21.1 22.5 21.1C22.75 21.1 23 20.85 23 20.6V6C22.4 5.55 21.75 5.25 21 5M10 18.41C8.75 18.09 7.5 18 6.5 18C5.44 18 4.18 18.19 3 18.5V7.13C3.91 6.73 5.14 6.5 6.5 6.5C7.86 6.5 9.09 6.73 10 7.13V18.41Z"/>',
  HAND_COIN: '<path d="M16 12C18.76 12 21 9.76 21 7S18.76 2 16 2 11 4.24 11 7 13.24 12 16 12M21.45 17.6C21.06 17.2 20.57 17 20 17H13L10.92 16.27L11.25 15.33L13 16H15.8C16.15 16 16.43 15.86 16.66 15.63S17 15.12 17 14.81C17 14.27 16.74 13.9 16.22 13.69L8.95 11H7V20L14 22L22.03 19C22.04 18.47 21.84 18 21.45 17.6M5 11H.984V22H5V11Z"/>',
  CUP: '<path d="M18.32,8H5.67L5.23,4H18.77M3,2L5,20.23C5.13,21.23 5.97,22 7,22H17C18,22 18.87,21.23 19,20.23L21,2H3Z"/>',
  BULLHORN: '<path d="M12,8H4A2,2 0 0,0 2,10V14A2,2 0 0,0 4,16H5V20A1,1 0 0,0 6,21H8A1,1 0 0,0 9,20V16H12L17,20V4L12,8M21.5,12C21.5,13.71 20.54,15.26 19,16V8C20.53,8.75 21.5,10.3 21.5,12Z"/>',
  ACCOUNT_VOICE: '<path d="M9,5A4,4 0 0,1 13,9A4,4 0 0,1 9,13A4,4 0 0,1 5,9A4,4 0 0,1 9,5M9,15C11.67,15 17,16.34 17,19V21H1V19C1,16.34 6.33,15 9,15M16.76,5.36C18.78,7.56 18.78,10.61 16.76,12.63L15.08,10.94C15.92,9.76 15.92,8.23 15.08,7.05L16.76,5.36M20.07,2C24,6.05 23.97,12.11 20.07,16L18.44,14.37C21.21,11.19 21.21,6.65 18.44,3.63L20.07,2Z"/>',
  WATER: '<path d="M12,20A6,6 0 0,1 6,14C6,10 12,3.25 12,3.25C12,3.25 18,10 18,14A6,6 0 0,1 12,20Z"/>',
  DOOR_OPEN: '<path d="M12,3C10.89,3 10,3.89 10,5H3V19H2V21H22V19H21V5C21,3.89 20.11,3 19,3H12M12,5H19V19H12V5M5,11H7V13H5V11Z"/>',
  HAND_WAVE: '<path d="M23 17C23 20.31 20.31 23 17 23V21.5C19.5 21.5 21.5 19.5 21.5 17H23M1 7C1 3.69 3.69 1 7 1V2.5C4.5 2.5 2.5 4.5 2.5 7H1M8 4.32L3.41 8.92C.19 12.14 .19 17.37 3.41 20.59S11.86 23.81 15.08 20.59L22.15 13.5C22.64 13.03 22.64 12.24 22.15 11.75C21.66 11.26 20.87 11.26 20.38 11.75L15.96 16.17L15.25 15.46L21.79 8.92C22.28 8.43 22.28 7.64 21.79 7.15S20.5 6.66 20 7.15L14.19 13L13.5 12.27L20.37 5.38C20.86 4.89 20.86 4.1 20.37 3.61S19.09 3.12 18.6 3.61L11.71 10.5L11 9.8L16.5 4.32C17 3.83 17 3.04 16.5 2.55S15.22 2.06 14.73 2.55L7.11 10.17C8.33 11.74 8.22 14 6.78 15.45L6.07 14.74C7.24 13.57 7.24 11.67 6.07 10.5L5.72 10.15L9.79 6.08C10.28 5.59 10.28 4.8 9.79 4.31C9.29 3.83 8.5 3.83 8 4.32Z"/>',
  HUMAN_CHILD: '<path d="M12,2A3,3 0 0,1 15,5A3,3 0 0,1 12,8A3,3 0 0,1 9,5A3,3 0 0,1 12,2M11,22H8V16H6V9H18V16H16V22H13V18H11V22Z"/>',
};
function catIconSvg(key) {
  return '<svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor">' + ICON_CAT[key] + '</svg>';
}
// Mesmas regras/ordem do CATEGORY_ICON_RULES em
// src/modules/liturgia/interface/Index.vue -- a primeira que bater no nome
// da categoria vence; sem nenhuma batida, cai no ícone genérico de tag
// (igual ao padrão do tipo "categoria" por lá).
const CATEGORY_ICON_RULES = [
  // louvor/adoração antes de oração: "adoração" contém "oração" como
  // substring (ador-AÇÃO), então na ordem errada "Louvor e Adoração" caía
  // sempre na regra de oração antes de chegar na de louvor.
  [/louvor|ador[aá][cç][aã]o|c[aâ]ntico|m[uú]sica/i, 'MUSIC'],
  [/ora[cç][aã]o|intercess/i, 'HANDS_PRAY'],
  [/palavra|preg(a[cç][aã]o|ador)|serm[aã]o|mensagem|estudo/i, 'BOOK'],
  [/oferta|d[ií]zimo|contribui/i, 'HAND_COIN'],
  [/comunh[aã]o|ceia/i, 'CUP'],
  [/aviso|an[uú]ncio|informe/i, 'BULLHORN'],
  [/testemunho/i, 'ACCOUNT_VOICE'],
  [/batismo/i, 'WATER'],
  [/abertura|boas[- ]vindas|recep[cç][aã]o/i, 'DOOR_OPEN'],
  [/encerramento|b[eê]n[cç][aã]o|despedida/i, 'HAND_WAVE'],
  [/infantil|crian[cç]a/i, 'HUMAN_CHILD'],
];
function categoriaIconSvg(name) {
  const hit = CATEGORY_ICON_RULES.find(([re]) => re.test(name || ''));
  return hit ? (hit[1] === 'HANDS_PRAY' ? ICON_HANDS_PRAY_SVG : catIconSvg(hit[1])) : catIconSvg('TAG');
}

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
  document.getElementById('statusPill').className = 'status ' + cls;
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

// Seletor é só o atributo (sem exigir ".dpad" como ancestral): o botão
// Play/Pause do card Mídia é um .dpad-btn avulso (barra cheia, fora de
// qualquer grade .dpad) -- com o seletor antigo ele renderizava normal mas
// não respondia a clique nenhum, mesmo bug do controle de vídeo acima.
document.querySelectorAll('button[data-key]').forEach((btn) => {
  btn.addEventListener('click', () => {
    chamarApi('keyboard', { key: btn.dataset.key }, (ok) => { if (!ok) testarApi(); });
    // Feedback imediato do ícone Play/Pause (não espera o próximo poll de
    // carregarVolume, até 5s depois).
    if (btn.dataset.key === 'Space') setTimeout(carregarVolume, 200);
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
// tocando ao mesmo tempo. Seletor é só o atributo (sem exigir ".media-row"
// como ancestral): o card Vídeo passou a usar ".dpad"/".dpad-btn" pro visual
// em grade (ver HTML acima), e esse seletor antigo nunca foi atualizado --
// os botões continuavam renderizando normalmente, só não respondiam a clique
// nenhum, silenciosamente.
document.querySelectorAll('button[data-media-target]').forEach((btn) => {
  btn.addEventListener('click', () => {
    chamarApi('media-control', { target: btn.dataset.mediaTarget, action: btn.dataset.mediaAction },
      (ok) => { if (!ok) testarApi(); });
    // Feedback imediato (não espera o próximo poll de carregarVideoVolume,
    // até 5s depois) -- igual ao padrão já usado pelo SoundMaster abaixo.
    if (btn.dataset.mediaAction === 'toggle') setTimeout(carregarVideoVolume, 200);
  });
});

// Ajusta a largura da div .rng-fill (ver .rng-wrap no <style>) pra
// acompanhar o valor atual do slider -- sem isso o preenchimento amarelo
// fica sempre parado em 0%.
function fillSlider(el) {
  const wrap = el.closest('.rng-wrap');
  const fill = wrap && wrap.querySelector('.rng-fill');
  if (fill) fill.style.width = el.value + '%';
}

// mm:ss a partir de segundos -- usado no tempo decorrido/restante do
// SoundMaster (ver carregarSoundMaster). Nunca negativo (duration ainda não
// carregada, ou arredondamento de ponto flutuante perto do fim da faixa).
function formatTime(totalSeconds) {
  const s = Math.max(0, Math.floor(totalSeconds || 0));
  const m = Math.floor(s / 60);
  const sec = s % 60;
  return m + ':' + String(sec).padStart(2, '0');
}

// ── Volume ──────────────────────────────────────────────────────────────
const volumeInput = document.getElementById('volume');
const volumeVal    = document.getElementById('volumeVal');
const volumeLabel  = document.getElementById('volumeLabel');
const mediaPlayIcon = document.getElementById('mediaPlayIcon');
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
    mediaPlayIcon.classList.toggle('is-playing', !data.is_paused);
    fillSlider(volumeInput);
  });
}

volumeInput.addEventListener('pointerdown', () => { volumeDragging = true; });
volumeInput.addEventListener('input', (e) => {
  const v = e.target.value;
  volumeVal.textContent = v + '%';
  fillSlider(volumeInput);
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
const videoPlayIcon     = document.getElementById('videoPlayIcon');
let videoVolumeDebounce = null;
let videoVolumeDragging = false;

function carregarVideoVolume() {
  if (videoVolumeDragging) return;
  chamarApi('get-volume', { target: 'video' }, (ok, data) => {
    if (!ok) return;
    videoVolumeInput.value = data.volume;
    videoVolumeVal.textContent = data.volume + '%';
    videoPlayIcon.classList.toggle('is-playing', !data.is_paused);
    fillSlider(videoVolumeInput);
  });
}

videoVolumeInput.addEventListener('pointerdown', () => { videoVolumeDragging = true; });
videoVolumeInput.addEventListener('input', (e) => {
  const v = e.target.value;
  videoVolumeVal.textContent = v + '%';
  fillSlider(videoVolumeInput);
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
const smPlayIcon     = document.getElementById('smPlayIcon');
const smProgressWrap = document.getElementById('smProgressWrap');
const smProgressFill = document.getElementById('smProgressFill');
const smTimeElapsed  = document.getElementById('smTimeElapsed');
const smTimeRemaining = document.getElementById('smTimeRemaining');
let smVolumeDragging  = false;
let smDuckingDragging = false;
let smVolumeDebounce   = null;
let smDuckingDebounce  = null;
let smActivePadId       = null;

function smControl(action, extra) {
  chamarApi('soundmaster-control', { action, ...extra }, (ok) => { if (!ok) testarApi(); });
}

// Mesma linha numerada (.row-item/.row-badge/.row-play) usada na Liturgia e
// na busca — só os pads com áudio de verdade aparecem (nada de mostrar 10
// slots vazios numa lista pensada pra itens reais), com o que estiver
// tocando destacado.
function renderSmPads(pads) {
  const withFile = pads.filter((p) => p.hasFile);
  if (!withFile.length) {
    smPadsEl.innerHTML = '<div class="lit-empty">Nenhum pad com áudio configurado.</div>';
    return;
  }
  smPadsEl.innerHTML = withFile.map((p, i) => {
    const active = p.id === smActivePadId;
    const num = String(i + 1).padStart(2, '0');
    return '<div class="row-item' + (active ? ' sm-pad-active' : '') + '">' +
      '<div class="row-badge">' + num + '</div>' +
      '<div class="row-info"><span class="title">' + escapeHtml(p.name || ('Pad ' + p.id)) + '</span></div>' +
      '<button class="row-play" data-pad-id="' + p.id + '" aria-label="' + (active ? 'Parar' : 'Tocar') + ' ' + escapeHtml(p.name || '') + '">' +
      (active ? ICON_PAUSE_SVG : ICON_PLAY_SVG) +
      '</button></div>';
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
    fillSlider(smVolume);
    smDucking.value = np.ducking_level ?? 15;
    smDuckingVal.textContent = Math.round(np.ducking_level ?? 15) + '%';
    fillSlider(smDucking);
    smTalkoverBtn.classList.toggle('on', !!np.is_talkover);
    smNowPlaying.textContent = np.playing && np.name ? np.name : 'Nada tocando';
    smPlayIcon.classList.toggle('is-playing', !!np.playing);
    // Tempo decorrido/restante: só aparece com duração conhecida (nada
    // tocando, ou faixa sem metadata de duração ainda carregada, fica
    // escondido em vez de mostrar "0:00 / -0:00" sem sentido nenhum).
    if (np.duration > 0) {
      const pct = Math.min(100, Math.max(0, (np.current_time / np.duration) * 100));
      smProgressFill.style.width = pct + '%';
      smTimeElapsed.textContent = formatTime(np.current_time);
      smTimeRemaining.textContent = '-' + formatTime(np.duration - np.current_time);
      smProgressWrap.classList.remove('hidden');
    } else {
      smProgressWrap.classList.add('hidden');
    }
  });
}

smPadsEl.addEventListener('click', (e) => {
  // closest() (não e.target direto): o botão agora tem um ícone dentro
  // (ver renderSmPads) -- clicar no próprio ícone faria e.target ser o
  // <svg>, que não tem o data-pad-id (só o <button> pai tem).
  const btn = e.target.closest('[data-pad-id]');
  if (!btn) return;
  smControl('play_pad', { padId: btn.dataset.padId });
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
  fillSlider(smVolume);
  clearTimeout(smVolumeDebounce);
  smVolumeDebounce = setTimeout(() => smControl('volume', { value: e.target.value }), 120);
});
smVolume.addEventListener('change', () => { smVolumeDragging = false; });

smDucking.addEventListener('pointerdown', () => { smDuckingDragging = true; });
smDucking.addEventListener('input', (e) => {
  smDuckingVal.textContent = e.target.value + '%';
  fillSlider(smDucking);
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
        '<div class="result"><div class="row-badge">' + catIconSvg('MUSIC') + '</div>' +
        '<div class="result-info"><span class="name">' + escapeHtml(item.name || '') + '</span>' +
        (item.albums && item.albums.length
          ? '<span class="albums">' + escapeHtml(item.albums.join(' • ')) + '</span>'
          : '') +
        '</div><button class="row-play" data-id="' + item.id + '" aria-label="Abrir ' + escapeHtml(item.name || '') + '">' + ICON_PLAY_SVG + '</button></div>'
      ).join('') || '<div class="result-empty">Nenhuma música encontrada</div>';
    });
  }, 400);
});

document.getElementById('results').addEventListener('click', (e) => {
  // closest() (não e.target direto): o botão agora é um círculo com ícone
  // dentro (ver o map() de resultados acima) -- clicar no ícone faria
  // e.target ser o <svg>, que não tem o data-id (só o <button> pai tem).
  // textContent (não innerHTML) pra mostrar "..."/"Aberto"/"Erro" -- sem
  // ícone client-side pronto pra isso (o icon() que monta os SVGs só existe
  // no processo main, ao montar a página, não aqui no <script>).
  const btn = e.target.closest('[data-id]');
  if (!btn) return;
  const id = btn.dataset.id;
  const original = btn.innerHTML;
  btn.textContent = '...';
  chamarApi('open-song', { id, tag: 1 }, (ok) => {
    btn.textContent = ok ? 'Aberto' : 'Erro';
    setTimeout(() => { btn.innerHTML = original; }, 1200);
  });
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

// Linha de um item da liturgia (música escolhida/a escolher, ou mídia
// anexada) -- numeração é sequencial em TODA a liturgia (não reinicia por
// seção), igual ao mockup de referência. Já tem música definida → botão
// circular abre direto. "Escolha na hora" (sem id_music) → botão pílula
// "Selecionar" leva até a busca (agora na aba Mídia) já preenchida com o
// nome do item (não dá pra abrir sem saber qual música exatamente). Mídia
// anexada (vídeo/áudio/link) → botão circular abre via open-liturgia-item;
// o controle de play/pause/fechar depois é feito pelos cartões fixos de
// Vídeo/SoundMaster, não item a item.
function renderLiturgiaRow(item, num) {
  const n = String(num).padStart(2, '0');
  const name = escapeHtml(item.name || '');
  if (item.type === 'musica' && item.id_music) {
    return '<div class="row-item"><div class="row-badge">' + n + '</div>' +
      '<div class="row-info"><span class="title">' + name + '</span><span class="lit-tag">Música</span></div>' +
      '<button class="row-play" data-id="' + item.id_music + '" aria-label="Abrir ' + name + '">' + ICON_PLAY_SVG + '</button></div>';
  }
  if (item.type === 'musica') {
    return '<div class="row-item"><div class="row-badge">' + n + '</div>' +
      '<div class="row-info"><span class="title">' + name + '</span><span class="lit-tag muted">Escolher na hora</span></div>' +
      '<button class="lit-select-btn" data-select="' + name + '">Selecionar</button></div>';
  }
  if (item.has_media) {
    return '<div class="row-item"><div class="row-badge">' + n + '</div>' +
      '<div class="row-info"><span class="title">' + name + '</span><span class="lit-tag info">Mídia</span></div>' +
      '<button class="row-play" data-open-item="' + item.id + '" aria-label="Abrir ' + name + '">' + ICON_PLAY_SVG + '</button></div>';
  }
  // Anotação livre (sem música/mídia anexada) cujo nome é uma oração (ex.:
  // "Oração inicial", "Oração final") -- mostra o ícone de mãos em oração no
  // lugar do número, só pra identificar visualmente o momento na lista.
  const isPrayer = /ora[cç][aã]o/i.test(item.name || '');
  return '<div class="row-item"><div class="row-badge">' + (isPrayer ? ICON_HANDS_PRAY_SVG : n) + '</div>' +
    '<div class="row-info"><span class="title">' + name + '</span></div></div>';
}

function carregarLiturgia() {
  chamarApi('liturgia', {}, (ok, data) => {
    const el = document.getElementById('liturgiaList');
    if (!ok) return; // mantém o que já estava exibido em caso de falha pontual
    const items = data.items || [];
    if (!items.length) { el.innerHTML = '<div class="card"><div class="lit-empty">Nenhum item na liturgia.</div></div>'; return; }

    // Agrupa o array plano (categoria, item, item, categoria, item...) em
    // seções -- cada "categoria" abre uma seção nova, que acumula os itens
    // seguintes até a próxima categoria (ou o fim da lista).
    let seq = 0;
    const sections = [];
    let current = null;
    items.forEach((item) => {
      if (item.type === 'categoria') {
        current = { name: item.name || '', color: item.color || '', rows: [] };
        sections.push(current);
        return;
      }
      if (!current) { current = { name: '', color: '', rows: [] }; sections.push(current); }
      seq++;
      current.rows.push(renderLiturgiaRow(item, seq));
    });

    el.innerHTML = sections.map((sec) => {
      const count = sec.rows.length;
      const meta = count === 0 ? 'Sem itens · momento livre' : (count === 1 ? '1 item' : count + ' itens');
      const head = sec.name
        ? '<div class="lit-section-head">' +
          '<div class="lit-section-icon" style="background:' + escapeHtml(sec.color || '#1A2234') + ';color:#fff">' + categoriaIconSvg(sec.name) + '</div>' +
          '<div class="lit-section-text"><span class="name">' + escapeHtml(sec.name) + '</span><span class="meta">' + meta + '</span></div>' +
          '</div>'
        : '';
      const body = count > 0 ? '<div class="lit-section-items">' + sec.rows.join('') + '</div>' : '';
      return '<section class="lit-section">' + head + body + '</section>';
    }).join('');
  });
}

document.getElementById('liturgiaList').addEventListener('click', (e) => {
  // closest() em cada caso (não e.target direto): os botões "Abrir" agora
  // são círculos com ícone dentro (ver carregarLiturgia) -- clicar no
  // ícone faria e.target ser o <svg>, que não tem o data-* (só o <button>
  // pai tem).
  const openBtn = e.target.closest('[data-id]');
  if (openBtn) {
    const original = openBtn.innerHTML;
    openBtn.textContent = '...';
    chamarApi('open-song', { id: openBtn.dataset.id, tag: 1 }, (ok) => {
      openBtn.textContent = ok ? 'Aberto' : 'Erro';
      setTimeout(() => { openBtn.innerHTML = original; }, 1200);
    });
    return;
  }
  const mediaBtn = e.target.closest('[data-open-item]');
  if (mediaBtn) {
    const original = mediaBtn.innerHTML;
    mediaBtn.textContent = '...';
    chamarApi('open-liturgia-item', { id: mediaBtn.dataset.openItem }, (ok) => {
      mediaBtn.textContent = ok ? 'Aberto' : 'Erro';
      setTimeout(() => { mediaBtn.innerHTML = original; }, 1200);
    });
    return;
  }
  const selectBtn = e.target.closest('[data-select]');
  if (!selectBtn) return;
  const search = document.getElementById('search');
  search.value = selectBtn.dataset.select;
  search.dispatchEvent(new Event('input'));
  // Busca mora na aba "Controle" (junto do resto do controle da projeção,
  // ver tab-btn/tab-panel) -- troca de aba antes de rolar até o campo,
  // senão ele continua escondido (display:none).
  document.querySelector('.tab-btn[data-tab="controle"]')?.click();
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
