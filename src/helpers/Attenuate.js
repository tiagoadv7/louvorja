// Atenuar: baixa o volume aos poucos até 20% (para falar por cima da música)
// e, no 2º acionamento, volta suave ao volume de antes. Vale para coletâneas
// ("media"), YouTube ("web_link") e vídeo local ("video" — lá é o mesmo
// "talkover" do módulo Mídia). Usado pelo botão do player (components/Player.vue)
// e pela tecla T (App.vue).
import $appdata from "@/helpers/AppData";
import $media from "@/helpers/Media";
import $webLink from "@/helpers/WebLink";
import $videoPlayer from "@/helpers/VideoPlayer";

const LEVEL = 20;
let fadeTimer = null;

function getVolume(source) {
  if (source === "web_link") return $webLink.getConfig().volume ?? 100;
  if (source === "video") return $videoPlayer.getConfig().volume ?? 100;
  return $appdata.get("modules.media.config.volume") ?? 100;
}

function setVolume(source, v) {
  const vol = Math.round(Math.max(0, Math.min(100, v)));
  if (source === "web_link") $webLink.setVolume(vol);
  else if (source === "video") $videoPlayer.setVolume(vol);
  else $media.setVolume(vol);
}

// Rampa de volume (~0,9 s)
function fadeVolume(source, from, to, steps = 22, interval = 40) {
  clearInterval(fadeTimer);
  const delta = (to - from) / steps;
  let n = 0;
  fadeTimer = setInterval(() => {
    n++;
    setVolume(source, n >= steps ? to : from + delta * n);
    if (n >= steps) {
      clearInterval(fadeTimer);
      fadeTimer = null;
    }
  }, interval);
}

function setState(source, on, prev) {
  if (source === "web_link") { $webLink.setConfig({ attenuated: on, attenuatePrev: prev }); return; }
  $appdata.set("modules.media.config.attenuated", on);
  $appdata.set("modules.media.config.attenuate_prev", prev);
}

export function isAttenuated(source) {
  if (source === "video") return !!$videoPlayer.getConfig().talkover;
  if (source === "web_link") return !!$webLink.getConfig().attenuated;
  if (source === "media") return !!$appdata.get("modules.media.config.attenuated");
  return false;
}

export function toggleAttenuate(source) {
  if (source === "video") {
    $videoPlayer.setConfig({ talkover: !$videoPlayer.getConfig().talkover });
    return;
  }
  if (source !== "media" && source !== "web_link") return;
  const current = getVolume(source);
  if (!isAttenuated(source)) {
    setState(source, true, current);
    fadeVolume(source, current, Math.min(current, LEVEL));
  } else {
    const prev = source === "web_link"
      ? $webLink.getConfig().attenuatePrev
      : $appdata.get("modules.media.config.attenuate_prev");
    setState(source, false, null);
    fadeVolume(source, current, prev ?? 100);
  }
}

// Mexer no volume à mão desliga a atenuação (o volume escolhido passa a valer)
export function clearAttenuate(source) {
  if (!isAttenuated(source)) return;
  clearInterval(fadeTimer);
  fadeTimer = null;
  if (source === "video") { $videoPlayer.setConfig({ talkover: false }); return; }
  setState(source, false, null);
}

// O que está tocando agora (para a tecla T): o que estiver de fato tocando
// tem prioridade; senão, o que estiver carregado.
export function currentSource() {
  const v = $videoPlayer.getConfig();
  const videoLoaded = !!v.src && (v.mediaType || "video") === "video";
  const w = $webLink.getConfig();
  const ytLoaded = !!w.videoId;
  const mode = $appdata.get("modules.media.config.mode");
  const mediaLoaded = !!$appdata.get("modules.media.config.audio") && (mode === "audio" || mode === "instrumental");
  if (videoLoaded && v.isPlaying) return "video";
  if (ytLoaded && w.isPlaying) return "web_link";
  if (mediaLoaded && !$appdata.get("modules.media.config.is_paused")) return "media";
  if (videoLoaded) return "video";
  if (ytLoaded) return "web_link";
  if (mediaLoaded) return "media";
  return null;
}
