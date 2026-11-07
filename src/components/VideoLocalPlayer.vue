<template>
  <!-- ÚNICA fonte de som do vídeo local (Mídia › Vídeo), igual ao YouTube
       (WebLinkLocalPlayer.vue): este <audio> da janela principal toca do começo
       ao fim e é o relógio de todo o app (helpers/VideoClock.js). Projeção,
       retorno, janela PiP e miniplayer mostram só a imagem, sempre mudos,
       seguindo este tempo. Tirar da projeção, voltar ou fechar a janela de
       projeção não mexe no som: não existe troca de um áudio para outro. -->
  <audio
    v-if="active"
    ref="audio"
    :src="config.src"
    :loop="!!config.loop"
    preload="auto"
    @loadedmetadata="onLoaded"
    @ended="onEnded"
  />
</template>

<script>
import $audioBus from "@/helpers/AudioBus";

const STEP = 0.05;

export default {
  name: "VideoLocalPlayer",

  computed: {
    config() {
      return this.$videoPlayer.getConfig();
    },
    active() {
      return !!this.config.src && (this.config.mediaType || "video") === "video";
    },
    targetVolume() {
      const c = this.config;
      return (c.talkover ? (c.talkoverLevel ?? 20) : (c.volume ?? 100)) / 100;
    },
  },

  watch: {
    "config.isPlaying"(playing) {
      const el = this.$refs.audio;
      if (!el || !this._ready) return;
      if (playing) {
        $audioBus.requestFocus("video_player");
        el.play().catch(() => {});
        this.fadeTo(this.targetVolume, 50);
      } else {
        this.fadeTo(0, 40, () => { el.pause(); this.publish(); });
      }
      this.publish();
    },
    // Seek do operador (barra, ±10 s, atalhos, controle remoto)
    "config.seekStamp"() {
      const el = this.$refs.audio;
      if (!el || !this._ready) return;
      el.currentTime = this.config.currentTime || 0;
      this.publish();
    },
    targetVolume(v) {
      const el = this.$refs.audio;
      if (el && !this._fade && !el.paused) el.volume = v;
    },
    "config.stopToken"() {
      const el = this.$refs.audio;
      if (!el) return;
      const reset = () => { el.pause(); el.currentTime = 0; this.publish(); };
      if (!el.paused) this.fadeTo(0, 50, reset);
      else reset();
    },
    "config.src"() {
      this._ready = false;
      clearInterval(this._fade);
      this._fade = null;
      this.stopPolling();
    },
  },

  methods: {
    onLoaded() {
      const el = this.$refs.audio;
      if (!el) return;
      this._ready = true;
      el.volume = 0;
      const t = this.config.currentTime || 0;
      if (t > 0 && t < (el.duration || Infinity)) el.currentTime = t;
      if (this.config.isPlaying) {
        $audioBus.requestFocus("video_player");
        el.play().catch(() => {});
        this.fadeTo(this.targetVolume, 50);
      } else {
        el.volume = this.targetVolume;
      }
      this.startPolling();
    },
    onEnded() {
      if (this.config.loop) return;
      this.$videoPlayer.stop();
    },

    // Relógio para as imagens (ver helpers/VideoClock.js) + tempo da barra do rodapé
    publish() {
      const el = this.$refs.audio;
      if (!el || !this._ready) return;
      const t = el.currentTime || 0;
      this.$appdata.set("modules.video_player.config.clock", { t, at: Date.now(), playing: !el.paused, src: this.config.src });
      this.$appdata.set("modules.video_player.config.currentTime", t);
      if (el.duration && isFinite(el.duration)) this.$appdata.set("modules.video_player.config.duration", el.duration);
    },
    startPolling() {
      this.stopPolling();
      this.publish();
      this._poll = setInterval(() => this.publish(), 250);
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
      if (v === target) { this._fade = null; done?.(); return; }
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
    // Outro áudio do app começou (música, coletânea...): para o vídeo
    this._focus = $audioBus.listen("video_player", () => {
      if (this.config.isPlaying) this.$videoPlayer.stop();
    });
  },

  beforeUnmount() {
    this.stopPolling();
    clearInterval(this._fade);
    $audioBus.unlisten(this._focus);
  },
};
</script>
