<template>
  <div v-if="isActive" class="vps-root">
    <img
      v-if="config.mediaType === 'image'"
      :key="config.src"
      :src="config.src"
      class="vps-media"
      :style="mediaStyle"
    />
    <video
      v-else
      ref="video"
      :src="renderedSrc"
      :loop="config.loop"
      muted
      class="vps-media"
      :style="mediaStyle"
      @loadedmetadata="onLoadedMetadata"
    />
  </div>
</template>

<script>
// Espelho simplificado do módulo Vídeo para o monitor de retorno — mesma
// config compartilhada de @/helpers/VideoPlayer (ver interface/Popup.vue,
// que é a janela de saída "de verdade"), mas sem áudio (sempre mudo: quem
// está no palco já ouve o som pela saída principal) e sem nenhum dos efeitos
// colaterais dessa janela (fade de volume, pedido de foco no AudioBus, envio
// de progresso por IPC, ESC fechando a projeção) — aqui é só visualização.
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
    // Seek vindo do controle remoto (Index.vue) — mesma tolerância de
    // interface/Popup.vue, pra não entrar em loop com o próprio timeupdate.
    'config.currentTime'(t) {
      const el = this.$refs.video;
      if (el && Math.abs(el.currentTime - t) > 0.75) el.currentTime = t;
    },
  },

  methods: {
    onLoadedMetadata() {
      const el = this.$refs.video;
      if (el && this.config.isPlaying) el.play().catch(() => {});
    },
  },

  mounted() {
    // Monta já com o vídeo carregado se um estiver ativo (ex.: o operador
    // ativou o retorno depois de já ter selecionado um vídeo/imagem).
    if (this.config.mediaType !== 'image' && this.config.src) this.renderedSrc = this.config.src;
  },
};
</script>

<style scoped>
.vps-root {
  position: relative;
  width: 100%;
  height: 100%;
  background: #000;
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
</style>
