import $appdata from "@/helpers/AppData";
import $modules from "@/helpers/Modules";

// Lógica compartilhada para outros módulos (ex. Liturgia) mandarem tocar um
// arquivo de áudio local direto no SoundMaster, sem duplicar a lógica de
// pads/crossfade dele. O SoundMaster mantém os pads como estado local do
// componente (não em $appdata), então o pedido viaja como um "comando
// pendente" em appdata — o componente observa essa chave com watch
// {immediate:true}, o que cobre tanto o caso em que ele já está montado
// quanto o caso em que $modules.open() acabou de montá-lo agora.
// O SoundMaster não tem mais janela própria — sua UI foi unificada na aba
// "SoundMaster" de video_player (módulo "Mídia", ver
// video_player/interface/components/SoundMasterPanel.vue). Chamar apenas
// $modules.open("soundmaster") só grava a flag em appdata (mantida por
// compatibilidade com Footer.vue/Player.vue, que ainda leem
// modules.soundmaster.minimized/now_playing), mas não abre nenhuma janela de
// verdade — o SoundMasterPanel só existe montado dentro da janela "Mídia".
// Por isso, abrir/maximizar o SoundMaster precisa necessariamente abrir o
// módulo "video_player" (dono da janela real) já na aba certa.
function openMediaWindow() {
  $appdata.set("modules.video_player.active_tab", "soundmaster");
  $modules.open("video_player");
}

export default {
  // Abre a janela "Mídia" (aba SoundMaster) e manda tocar o arquivo no
  // primeiro pad livre (ou reaproveita o pad que já tiver esse mesmo arquivo).
  play(fp, name) {
    if (!fp) return;
    openMediaWindow();
    $appdata.set("modules.soundmaster.pending_play", {
      path: fp,
      name: name || fp.split(/[\\/]/).pop(),
      ts: Date.now() + Math.random(),
    });
  },

  // Estado "now playing" espelhado em $appdata pelo próprio componente
  // (os pads vivem como estado local dele) — usado pela barra do rodapé
  // para mostrar faixa/tempo/volume sem precisar da instância do componente.
  nowPlaying() {
    return $appdata.get("modules.soundmaster.now_playing", {
      name: "", playing: false, current_time: 0, duration: 0, progress: 0, volume: 100,
    });
  },

  isMinimized() {
    return $appdata.get("modules.soundmaster.minimized", false);
  },

  maximize() {
    openMediaWindow();
  },

  // Comandos vindos de fora (ex.: barra do rodapé) — o componente observa
  // esses campos em $appdata, mesmo padrão de "pending_play" acima.
  togglePlay() {
    this._command("toggle");
  },
  stop() {
    this._command("stop");
  },
  seekBy(delta) {
    this._command("seek_by", { delta });
  },
  seekTo(time) {
    this._command("seek_to", { time });
  },
  setVolume(vol) {
    this._command("volume", { value: vol });
  },

  _command(action, extra = {}) {
    $appdata.set("modules.soundmaster.footer_command", { action, ...extra, ts: Date.now() + Math.random() });
  },
};
