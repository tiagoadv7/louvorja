import $appdata from "@/helpers/AppData";
import $modules from "@/helpers/Modules";

// Lógica compartilhada para outros módulos (ex. Liturgia) mandarem tocar um
// arquivo de áudio local direto no SoundMaster, sem duplicar a lógica de
// pads/crossfade dele. O SoundMaster mantém os pads como estado local do
// componente (não em $appdata), então o pedido viaja como um "comando
// pendente" em appdata — o componente observa essa chave com watch
// {immediate:true}, o que cobre tanto o caso em que ele já está montado
// quanto o caso em que $modules.open() acabou de montá-lo agora.
export default {
  // Abre o SoundMaster (se necessário) e manda tocar o arquivo no primeiro
  // pad livre (ou reaproveita o pad que já tiver esse mesmo arquivo).
  play(fp, name) {
    if (!fp) return;
    $modules.open("soundmaster");
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
    $modules.open("soundmaster");
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
