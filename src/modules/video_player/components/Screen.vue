<template>
  <div v-if="isActive" class="vps-root">
    <div
      v-if="config.mediaType === 'image'"
      class="vps-image-zoomwrap"
      :style="zoomWrapStyle"
    >
      <img
        :key="config.src"
        :src="config.src"
        class="vps-media"
        :style="mediaStyle"
      />
    </div>
    <video
      v-else
      ref="video"
      :src="renderedSrc"
      :loop="config.loop"
      muted
      playsinline
      class="vps-media"
      :style="mediaStyle"
      @loadedmetadata="onLoadedMetadata"
    />
  </div>
</template>

<script>
import { expectedTime, followClock, startFollowing } from '@/helpers/VideoClock';

// Espelho simplificado do módulo Vídeo para o monitor de retorno — mesma
// config compartilhada de @/helpers/VideoPlayer (ver interface/Popup.vue,
// que é a janela de saída "de verdade"), sem nenhum dos efeitos colaterais
// dessa janela (pedido de foco no AudioBus, envio de progresso por IPC, ESC
// fechando a projeção) — aqui é só visualização, sempre muda (o som é o da
// janela principal, components/VideoLocalPlayer.vue).
export default {
  name: 'VideoPlayerScreen',

  data: () => ({
    renderedSrc: '',
  }),

  computed: {
    config() {
      return this.$appdata.get('modules.video_player.config') || {};
    },
    isActive() {
      return !!this.config.src;
    },
    mediaStyle() {
      const rotation = this.config.rotation || 0;
      const flipScale = this.config.flip ? -1 : 1;
      return { transform: `rotate(${rotation}deg) scaleX(${flipScale})` };
    },
    // Zoom "estilo PowerPoint" (ver interface/Index.vue e interface/Popup.vue) —
    // mirror do retorno também reflete o zoom aplicado na saída principal.
    zoomWrapStyle() {
      return this.$videoPlayer.imageZoomStyle(this.config);
    },
  },

  watch: {
    'config.src'(src) {
      if (this.config.mediaType === 'image') return;
      this.renderedSrc = src;
      this.$nextTick(() => this.$refs.video?.load());
    },
    'config.isPlaying'(playing) {
      const el = this.$refs.video;
      if (!el) return;
      if (playing) el.play().catch(() => {});
      else el.pause();
    },
    'config.stopToken'() {
      const el = this.$refs.video;
      if (!el) return;
      el.pause();
      el.currentTime = 0;
    },
    // Seek do operador: alinha já no próximo tempo publicado
    'config.seekStamp'() {
      this._seekAt = Date.now();
    },
    'config.clock'() {
      if (Date.now() - (this._seekAt || 0) < 600) this.follow();
    },
  },

  methods: {
    onLoadedMetadata() {
      const el = this.$refs.video;
      if (!el) return;
      // Sempre mudo: o som é o da janela principal (components/VideoLocalPlayer.vue);
      // a imagem segue o tempo desse áudio (helpers/VideoClock.js)
      const t = expectedTime(this.config.clock, 0, this.config.src);
      if (t > 0.3 && t < (el.duration || Infinity)) el.currentTime = t;
      if (this.config.isPlaying) el.play().catch(() => {});
    },
    follow() {
      followClock(this.$refs.video, this.config.clock, { loop: !!this.config.loop, src: this.config.src });
    },
  },

  mounted() {
    this._stopFollow = startFollowing(() => this.$refs.video, () => this.config.clock, () => ({ loop: !!this.config.loop, src: this.config.src }));
    // Monta já com o vídeo carregado se um estiver ativo (ex.: o operador
    // ativou o retorno depois de já ter selecionado um vídeo/imagem).
    if (this.config.mediaType !== 'image' && this.config.src) this.renderedSrc = this.config.src;
  },
  beforeUnmount() {
    this._stopFollow?.();
  },
};
</script>

<style scoped>
.vps-root {
  position: relative;
  width: 100%;
  height: 100%;
  /* Transparente igual à janela de saída principal (ver .vp-popup-root em
     interface/Popup.vue) — antes era preto sólido, então a área fora do
     vídeo (barras do object-fit: contain) e o instante antes de escolher
     pra onde mandar a reprodução ficavam pretas em vez de deixar ver o que
     está atrás (monitor de palco). */
  background: transparent;
  display: flex;
  align-items: center;
  justify-content: center;
  overflow: hidden;
}
.vps-media {
  width: 100%;
  height: 100%;
  object-fit: contain;
}
.vps-image-zoomwrap {
  width: 100%;
  height: 100%;
  transition: transform 0.25s ease;
}
</style>
