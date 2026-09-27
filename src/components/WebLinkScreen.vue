<template>
  <div v-if="isActive" class="wls-root">
    <div v-if="videoId" class="wls-iframe-wrap">
      <div id="wls-yt-player" />
    </div>
    <iframe
      v-else-if="url"
      :src="url"
      class="wls-iframe"
      allow="autoplay; fullscreen; encrypted-media"
      allowfullscreen
      frameborder="0"
    />
  </div>
</template>

<script>
// Espelho simplificado do link (YouTube/Canva) para o monitor de retorno —
// mesma config compartilhada de @/helpers/WebLink (ver components/WebLinkFrame.vue,
// que é a janela de saída "de verdade"), mas sem áudio (sempre mudo: quem está
// no palco já ouve o som pela saída principal) e sem nenhum efeito colateral
// dessa janela (fade, polling de progresso, ESC fechando a projeção) — aqui é
// só visualização, mesmo padrão de video_player/components/Screen.vue.
let ytApiPromise = null;
function loadYoutubeApi() {
  if (window.YT && window.YT.Player) return Promise.resolve();
  if (ytApiPromise) return ytApiPromise;
  ytApiPromise = new Promise((resolve) => {
    const previous = window.onYouTubeIframeAPIReady;
    window.onYouTubeIframeAPIReady = () => {
      previous?.();
      resolve();
    };
    const tag = document.createElement('script');
    tag.src = 'https://www.youtube.com/iframe_api';
    document.head.appendChild(tag);
  });
  return ytApiPromise;
}

export default {
  name: 'WebLinkScreen',

  data: () => ({
    player: null,
    _playerReady: false,
  }),

  computed: {
    config() {
      return this.$appdata.get('modules.web_link.config') || {};
    },
    videoId() {
      return this.config.videoId || null;
    },
    url() {
      return this.config.url || '';
    },
    isActive() {
      return !!(this.videoId || this.url);
    },
  },

  watch: {
    videoId(id, oldId) {
      if (id === oldId) return;
      this._teardownPlayer();
      if (id) this._setupPlayer(id);
    },
    'config.isPlaying'(playing) {
      if (!this.player || !this._playerReady) return;
      if (playing) this.player.playVideo();
      else this.player.pauseVideo();
    },
    'config.stopToken'() {
      if (!this.player || !this._playerReady) return;
      this.player.pauseVideo();
      try { this.player.seekTo(0, true); } catch { /* */ }
    },
    // Seek vindo do controle remoto (Index.vue) — mesma origem que WebLinkFrame.vue.
    'config.seekToken'() {
      if (!this.player || !this._playerReady) return;
      try { this.player.seekTo(this.config.seekTime || 0, true); } catch { /* */ }
    },
  },

  methods: {
    async _setupPlayer(id) {
      await loadYoutubeApi();
      if (this.videoId !== id) return;
      this._playerReady = false;
      this.player = new window.YT.Player('wls-yt-player', {
        width: '100%',
        height: '100%',
        videoId: id,
        playerVars: {
          autoplay: 0,
          controls: 0,
          rel: 0,
          playsinline: 1,
          cc_load_policy: 0,
          iv_load_policy: 3,
          modestbranding: 1,
        },
        events: {
          onReady: () => {
            this._playerReady = true;
            // Sempre mudo — quem está no palco já ouve o som pela saída
            // principal (mesmo motivo do <video muted> de video_player/Screen.vue).
            this.player.mute();
            if (this.config.isPlaying) this.player.playVideo();
          },
        },
      });
    },
    _teardownPlayer() {
      this._playerReady = false;
      try { this.player?.destroy?.(); } catch { /* já destruído */ }
      this.player = null;
    },
  },

  mounted() {
    if (this.videoId) this._setupPlayer(this.videoId);
  },
  beforeUnmount() {
    this._teardownPlayer();
  },
};
</script>

<style scoped>
.wls-root {
  position: relative;
  width: 100%;
  height: 100%;
  background: #000;
  overflow: hidden;
}
.wls-iframe,
.wls-iframe-wrap {
  width: 100%;
  height: 100%;
  border: none;
}
.wls-iframe-wrap :deep(iframe) {
  width: 100%;
  height: 100%;
  border: none;
  display: block;
}
</style>
