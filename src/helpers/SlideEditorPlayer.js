import $appdata from "@/helpers/AppData";
import $modules from "@/helpers/Modules";

// Ponte entre o Editor de Músicas (slide_editor — um componente comum, não
// um singleton com helper próprio) e o mini-player do rodapé (Footer.vue/
// Player.vue), mesmo padrão já usado por SoundMaster.js pro SoundMasterPanel:
// o componente mantém o estado real (áudio, tempo, etc.) localmente e só
// espelha o necessário em $appdata pra quem não tem acesso à instância dele
// (o rodapé é um componente totalmente separado) mostrar título/progresso/
// play-pause, e comandos (toggle/seek/volume) voltam como um "comando
// pendente" que o próprio slide_editor observa e aplica no <audio> real.
export default {
  nowPlaying() {
    return $appdata.get("modules.slide_editor.now_playing", {
      title: "", playing: false, current_time: 0, duration: 0, progress: 0, volume: 100,
    });
  },

  isMinimized() {
    return $appdata.get("modules.slide_editor.minimized", false);
  },

  maximize() {
    $modules.open("slide_editor");
  },

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
    $appdata.set("modules.slide_editor.footer_command", { action, ...extra, ts: Date.now() + Math.random() });
  },
};
