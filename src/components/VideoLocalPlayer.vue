<template>
  <!-- Áudio do vídeo local (Mídia › Vídeo) na janela principal — mesma ideia do
       WebLinkLocalPlayer.vue (YouTube):
       - vídeo na projeção: este <audio> toca MUDO, só acompanhando o tempo e o
         play/pausa da projeção;
       - operador tirou o vídeo da projeção: ele sobe o volume enquanto a
         projeção esmaece, e o áudio segue sem parar (o miniplayer mostra a
         imagem); passa a informar o tempo para a barra do rodapé;
       - vídeo volta para a projeção: o som continua aqui até a projeção
         começar a tocar, e só então abaixa (troca cruzada). -->
  <audio
    v-if="active"
    ref="audio"
    :src="config.src"
    :loop="!!config.loop"
    preload="auto"
    muted
    @loadedmetadata="onLoaded"
    @ended="onEnded"
  />
</template>

<script>
import $audioBus from "@/helpers/AudioBus";

const STEP = 0.05;
// Tolerância do espelho mudo: a projeção informa o tempo a cada 0,25 s; com
// folga maior o som da principal ficava até ~0,7 s adiantado e "pulava" na troca.
const DRIFT = 0.4;

export default {
  name: "VideoLocalPlayer",

  computed: {
    config() {
      return this.$videoPlayer.getConfig();
    },
    active() {
      return !!this.config.src && (this.config.mediaType || "video") === "video";
    },
    // Fechando a projeção (fade de saída) já conta como fora dela: o som passa
    // para cá durante o fade, sem buraco
    projecting() {
      return !!this.$appdata.get("popup") && this.$appdata.get("popup_module") === "video_player"
        && !this.$appdata.get("output_closing");
    },
    // Vídeo mandado só para o Retorno: o som já sai por lá (ver
    // video_player/components/Screen.vue#mainAlsoShowing)
    returnPlaysAudio() {
      return this.$appdata.get("return_popup_module") === "video_player";
    },
    outputPlaying() {
      return !!this.$appdata.get("modules.video_player.output_playing");
    },
    // Quem informa o tempo: este player, a menos que a projeção já esteja tocando
    reporting() {
      return this.active && !(this.projecting && this.outputPlaying);
    },
    targetVolume() {
      const c = this.config;
      return (c.talkover ? (c.talkoverLevel ?? 20) : (c.volume ?? 100)) / 100;
    },
  },

  watch: {
    // Saiu da projeção: assume o som na hora. Voltou: espera a projeção tocar.
    // Só zera o sinal "projeção tocando" ao SAIR dela: zerar também ao entrar
    // apagava um sinal que já tinha chegado, e os dois players ficavam
    // informando o tempo ao mesmo tempo (um corrigindo o outro = som pulando).
    projecting(on) {
      if (on) return;
      this.$appdata.set("modules.video_player.output_playing", false);
      if (this._ready && !this._audible && !this.returnPlaysAudio) this.takeOver();
    },
    outputPlaying(on) {
      if (on && this.projecting && this._audible) this.handOver();
    },
    returnPlaysAudio(on) {
      if (on && this._audible) this.handOver();
      else if (!on && this._ready && !this._audible && !this.projecting) this.takeOver();
    },
    reporting(on) {
      if (on) this.startPolling();
      else this.stopPolling();
    },
    "config.isPlaying"(playing) {
      const el = this.$refs.audio;
      if (!el || !this._ready) return;
      if (!this._audible) {
        if (playing) el.play().catch(() => {});
        else el.pause();
        return;
      }
      if (playing) {
        $audioBus.requestFocus("video_player");
        el.muted = false;
        el.play().catch(() => {});
        this.fadeTo(this.targetVolume, 100);
      } else {
        this.fadeTo(0, 50, () => el.pause());
      }
    },
    // Espelho mudo (projeção tocando): acompanha o tempo que ela informa
    "config.currentTime"(t) {
      const el = this.$refs.audio;
      if (!el || !this._ready || this.reporting || Date.now() < (this._noSeekUntil || 0)) return;
      if (Math.abs(el.currentTime - t) > DRIFT) el.currentTime = t;
    },
    // Com o som aqui, só reposiciona num seek do operador (barra, ±10 s, atalhos)
    "config.seekStamp"() {
      const el = this.$refs.audio;
      if (!el || !this._ready || !this.reporting) return;
      el.currentTime = this.config.currentTime || 0;
    },
    targetVolume(v) {
      const el = this.$refs.audio;
      if (el && this._audible && !this._fade && !el.paused) el.volume = v;
    },
    "config.stopToken"() {
      const el = this.$refs.audio;
      if (!el) return;
      if (this._audible && !el.paused) this.fadeTo(0, 50, () => { el.pause(); el.currentTime = 0; });
      else { el.pause(); el.currentTime = 0; }
    },
    "config.src"() {
      this._ready = false;
      this._audible = false;
      this.stopPolling();
    },
  },

  methods: {
    onLoaded() {
      const el = this.$refs.audio;
      if (!el) return;
      this._ready = true;
      el.muted = true;
      el.volume = 0;
      const t = this.config.currentTime || 0;
      if (t > 0) el.currentTime = t;
      if (this.config.isPlaying) el.play().catch(() => {});
      this._audible = false;
      // Vídeo aberto sem projeção (nem retorno com som): o áudio é daqui
      if (!this.projecting && !this.returnPlaysAudio) this.takeOver();
      else if (this.reporting) this.startPolling();
    },
    onEnded() {
      if (this.config.loop) return;
      if (this._audible && !this.projecting) this.$videoPlayer.stop();
    },

    takeOver() {
      const el = this.$refs.audio;
      if (!el) return;
      this._audible = true;
      const t = this.config.currentTime || 0;
      if (Math.abs(el.currentTime - t) > 1.2) el.currentTime = t;
      el.muted = false;
      if (this.config.isPlaying) {
        el.play().catch(() => {});
        // Entrada rápida, cruzando com o fade de saída da projeção (~0,4 s)
        this.fadeTo(this.targetVolume, 25);
      } else {
        el.volume = this.targetVolume;
      }
      if (this.reporting) this.startPolling();
    },
    handOver() {
      const el = this.$refs.audio;
      this._audible = false;
      this._noSeekUntil = Date.now() + 2000;
      if (!el) return;
      this.fadeTo(0, 50, () => { if (!this._audible) el.muted = true; });
    },

    startPolling() {
      this.stopPolling();
      this._poll = setInterval(() => {
        const el = this.$refs.audio;
        if (!el || !this._ready || !this.reporting) return;
        this.$appdata.set("modules.video_player.config.currentTime", el.currentTime || 0);
        if (el.duration && isFinite(el.duration)) this.$appdata.set("modules.video_player.config.duration", el.duration);
      }, 500);
    },
    stopPolling() {
      clearInterval(this._poll);
      this._poll = null;
    },

    fadeTo(target, stepMs, done) {
      const el = this.$refs.audio;
      if (!el) { done?.(); return; }
      clearInterval(this._fade);
      let v = el.volume;
      const up = target > v;
      this._fade = setInterval(() => {
        v = up ? Math.min(v + STEP, target) : Math.max(v - STEP, target);
        el.volume = Math.max(0, Math.min(1, v));
        if (v === target) {
          clearInterval(this._fade);
          this._fade = null;
          done?.();
        }
      }, stepMs);
    },
  },

  mounted() {
    // Outro áudio do app começou (música, coletânea...): para o vídeo se o som é daqui
    this._focus = $audioBus.listen("video_player", () => {
      if (this._audible && this.config.isPlaying && !this.projecting) this.$videoPlayer.stop();
    });
  },

  beforeUnmount() {
    this.stopPolling();
    clearInterval(this._fade);
    $audioBus.unlisten(this._focus);
  },
};
</script>
