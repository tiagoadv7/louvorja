<template>
  <!-- ÚNICA fonte de áudio do vídeo online (YouTube): um player invisível na
       janela principal que toca o som do começo ao fim e informa o tempo.
       A projeção (WebLinkFrame.vue), o retorno e o miniplayer só mostram a
       imagem, sempre MUDOS, seguindo o tempo deste player. Assim, tirar da
       projeção, voltar ou fechar a janela de projeção não mexe no áudio: não
       existe troca de um som para outro. -->
  <div v-if="present" class="wllp" aria-hidden="true">
    <div ref="host" class="wllp-host" />
  </div>
</template>

<script>
import { loadYoutubeApi } from "@/helpers/YoutubeApi";

const STEP = 5;

export default {
  name: "WebLinkLocalPlayer",

  // present: o elemento continua na página até o fade de saída terminar
  data: () => ({ present: false }),

  computed: {
    cfg() {
      return this.$webLink.getConfig();
    },
    videoId() {
      return this.cfg.videoId || null;
    },
  },

  watch: {
    videoId(id, oldId) {
      if (!id) { this.fadeOutAndDestroy(); return; }
      if (!this._player) { this.start(); return; }
      if (id === oldId) return;
      try {
        clearInterval(this._fade);
        this._fade = null;
        this._player.setVolume(0);
        this._player.loadVideoById({ videoId: id, startSeconds: 0 });
        // Com play, o volume sobe no evento PLAYING (ver onStateChange)
        if (!this.cfg.isPlaying) setTimeout(() => { try { this._player?.pauseVideo(); } catch { /* */ } }, 300);
      } catch { /* */ }
    },
    // Play/pausa com fade de áudio (a projeção acompanha só a imagem)
    "cfg.isPlaying"(playing) {
      if (!this._ready) return;
      if (playing) {
        try { this._player.unMute(); this._player.playVideo(); } catch { /* */ }
        this.fadeTo(this.cfg.volume ?? 100, 100);
      } else {
        this.fadeTo(0, 40, () => { try { this._player?.pauseVideo(); } catch { /* */ } });
      }
    },
    // Seek do operador (barra, ±10 s, atalhos)
    "cfg.seekToken"() {
      if (!this._ready) return;
      try { this._player.seekTo(this.cfg.seekTime || 0, true); } catch { /* */ }
    },
    "cfg.volume"(v) {
      if (!this._ready || this._fade) return;
      try { this._player.setVolume(Math.max(0, Math.min(100, v ?? 100))); } catch { /* */ }
    },
  },

  methods: {
    start() {
      this.present = true;
      this.$nextTick(() => this.init());
    },

    async init() {
      if (this._player || !this.videoId) return;
      const YT = await loadYoutubeApi();
      if (this._player || !this.videoId || !this.$refs.host) return;
      const el = document.createElement("div");
      this.$refs.host.appendChild(el);
      this._ready = false;
      this._player = new YT.Player(el, {
        width: "100%",
        height: "100%",
        videoId: this.videoId,
        playerVars: {
          autoplay: 0, controls: 0, rel: 0, playsinline: 1, modestbranding: 1,
          iv_load_policy: 3, cc_load_policy: 0, disablekb: 1, fs: 0,
        },
        events: {
          onReady: () => {
            if (!this._player) return;
            this._ready = true;
            try {
              this._player.unMute();
              this._player.setVolume(0);
              const t = this.cfg.current_time || 0;
              if (t > 0) this._player.seekTo(t, true);
              // O volume sobe só quando começar a tocar de fato (ver PLAYING abaixo)
              if (this.cfg.isPlaying) this._player.playVideo();
              else this._player.pauseVideo();
            } catch { /* */ }
            this.startPolling();
          },
          onStateChange: (e) => {
            // Tocando de fato: garante o volume. Enquanto o YouTube ainda carrega
            // (buffering), ele ignora setVolume — o fade feito ali terminava com
            // o som em 0 mesmo tocando.
            if (e.data === YT.PlayerState.PLAYING && this.cfg.isPlaying && !this._fade) {
              const target = this.cfg.volume ?? 100;
              try { this._player.unMute(); } catch { /* */ }
              if ((this._player.getVolume?.() ?? 0) < target) this.fadeTo(target, 100);
            }
            // Fim natural do vídeo: encerra suave (som daqui, imagem na projeção)
            if (e.data === YT.PlayerState.ENDED) this.$webLink.stop();
          },
          onError: (e) => {
            // Com a projeção mostrando o link, ela já exibe e avisa o erro
            if (this.$appdata.get("popup") && this.$appdata.get("popup_module") === "web_link") return;
            const MESSAGES = {
              100: "Vídeo não encontrado ou privado.",
              101: "O dono do vídeo desativou a reprodução em outros sites.",
              150: "O dono do vídeo desativou a reprodução em outros sites.",
            };
            this.$alert.error({ text: MESSAGES[e.data] || "Não foi possível carregar o vídeo.", translate: false });
            this.$webLink.stop();
          },
        },
      });
    },

    // Este player é quem informa o tempo para todo o app (barra do rodapé,
    // miniplayer, projeção e retorno seguem este valor)
    startPolling() {
      clearInterval(this._poll);
      this._poll = setInterval(() => {
        if (!this._ready || !this._player) return;
        try {
          this.$appdata.set("modules.web_link.config.current_time", this._player.getCurrentTime?.() || 0);
          this.$appdata.set("modules.web_link.config.duration", this._player.getDuration?.() || 0);
        } catch { /* */ }
      }, 250);
    },

    // Rampa de volume (0-100) em passos de 5
    fadeTo(target, stepMs, done) {
      if (!this._player) { done?.(); return; }
      clearInterval(this._fade);
      let v = 0;
      try { v = this._player.getVolume?.() ?? 0; } catch { /* */ }
      if (v === target) { this._fade = null; done?.(); return; }
      const up = target > v;
      this._fade = setInterval(() => {
        v = up ? Math.min(v + STEP, target) : Math.max(v - STEP, target);
        try { this._player?.setVolume(Math.round(v)); } catch { /* */ }
        if (v === target) {
          clearInterval(this._fade);
          this._fade = null;
          done?.();
        }
      }, stepMs);
    },

    // Vídeo saiu (parar/fechar): esmaece o que ainda estiver soando e destrói
    fadeOutAndDestroy() {
      clearInterval(this._poll);
      this._poll = null;
      clearInterval(this._fade);
      this._fade = null;
      const player = this._player;
      this._player = null;
      this._ready = false;
      if (!player) { this.present = false; return; }
      let v = 0;
      try { v = player.getVolume?.() ?? 0; } catch { /* */ }
      const timer = setInterval(() => {
        v = Math.max(0, v - 10);
        try { player.setVolume(v); } catch { /* */ }
        if (v <= 0) {
          clearInterval(timer);
          try { player.destroy(); } catch { /* */ }
          if (this.videoId) this.init();
          else this.present = false;
        }
      }, 40);
    },
  },

  mounted() {
    if (this.videoId) this.start();
  },

  beforeUnmount() {
    clearInterval(this._poll);
    clearInterval(this._fade);
    try { this._player?.destroy?.(); } catch { /* */ }
    this._player = null;
  },
};
</script>

<style scoped>
/* Dentro da tela (fora dela o Chromium pode reduzir o ritmo do iframe), mas invisível */
.wllp {
  position: fixed;
  right: 0;
  bottom: 0;
  width: 320px;
  height: 180px;
  opacity: 0;
  pointer-events: none;
  z-index: -1;
}
.wllp-host,
.wllp-host :deep(iframe) {
  width: 100%;
  height: 100%;
  border: 0;
}
</style>
