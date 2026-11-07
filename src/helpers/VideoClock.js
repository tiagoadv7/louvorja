// Relógio único do vídeo local (Mídia › Vídeo).
//
// O som sai de UM lugar só: o <audio> da janela principal
// (components/VideoLocalPlayer.vue), que publica a cada 0,25 s
// "modules.video_player.config.clock" = { t, at, playing }:
//   t       — posição do áudio (s)
//   at      — Date.now() no momento da leitura (mesmo relógio em todas as janelas)
//   playing — se o áudio estava tocando
//   src     — vídeo a que o tempo se refere (relógio de outro vídeo é ignorado)
//
// Projeção, retorno, janela PiP e miniplayer só mostram a IMAGEM, sempre mudos,
// e seguem esse relógio. Pequenas diferenças são corrigidas mudando de leve a
// velocidade (sem salto de imagem); só uma diferença grande (seek, vídeo
// recém-carregado) faz um seek de verdade.

const HARD = 0.3;   // acima disto (s), reposiciona (imagem recém-aberta, seek)
const SOFT = 0.04;  // abaixo disto, velocidade normal
const MAX_RATE = 0.08;

// Posição em que o áudio está AGORA, estimada a partir da última leitura
export function expectedTime(clock, fallback = 0, src = null) {
  if (!clock || typeof clock.t !== "number") return fallback;
  if (src && clock.src && clock.src !== src) return fallback;
  if (!clock.playing) return clock.t;
  const elapsed = Math.max(0, Math.min(1.5, (Date.now() - (clock.at || 0)) / 1000));
  return clock.t + elapsed;
}

// Aproxima o <video> do relógio. Retorna a diferença (s) para diagnóstico.
export function followClock(el, clock, { loop = false, src = null } = {}) {
  if (!el || !clock || el.readyState < 1) return 0;
  if (src && clock.src && clock.src !== src) return 0;
  let target = expectedTime(clock);
  const dur = el.duration;
  if (loop && dur && isFinite(dur) && target >= dur) target = target % dur;
  if (dur && isFinite(dur)) target = Math.min(target, Math.max(0, dur - 0.05));
  const drift = target - el.currentTime;
  if (el.paused) {
    if (Math.abs(drift) > 0.15) el.currentTime = target;
    if (el.playbackRate !== 1) el.playbackRate = 1;
    return drift;
  }
  if (Math.abs(drift) > HARD) {
    // Pequena antecipação: o seek leva alguns ms para ser aplicado
    el.currentTime = target + 0.08;
    el.playbackRate = 1;
  } else if (Math.abs(drift) > SOFT) {
    const rate = 1 + Math.max(-MAX_RATE, Math.min(MAX_RATE, drift * 0.6));
    if (Math.abs(el.playbackRate - rate) > 0.005) el.playbackRate = rate;
  } else if (el.playbackRate !== 1) {
    el.playbackRate = 1;
  }
  return drift;
}

// Liga um seguidor periódico ao <video> devolvido por getEl(). Retorna a função para desligar.
export function startFollowing(getEl, getClock, getOpts = () => ({}), ms = 200) {
  const id = setInterval(() => {
    try { followClock(getEl(), getClock(), getOpts()); } catch { /* */ }
  }, ms);
  return () => clearInterval(id);
}
