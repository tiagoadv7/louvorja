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
      :muted="mainAlsoShowing"
      class="vps-media"
      :style="mediaStyle"
      @loadedmetadata="onLoadedMetadata"
    />
  </div>
</template>

<script>
// Espelho simplificado do módulo Vídeo para o monitor de retorno — mesma
// config compartilhada de @/helpers/VideoPlayer (ver interface/Popup.vue,
// que é a janela de saída "de verdade"), sem nenhum dos efeitos colaterais
// dessa janela (pedido de foco no AudioBus, envio de progresso por IPC, ESC
// fechando a projeção) — aqui é só visualização. Áudio: ver mainAlsoShowing.
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
    // Mudo só quando a saída PRINCIPAL também está mostrando este vídeo
    // (mesmo appdata, mesma reprodução) — nesse caso o som já sai por lá, e
    // tocar aqui também duplicaria o áudio. Quando o operador manda o vídeo
    // SÓ pro retorno (ver helpers/VideoPlayer.js#ensureOutputShowing — botão
    // de "Retorno" marcado sem "Tela" também marcada), a principal nunca
    // chega a abrir: este é o ÚNICO lugar tocando o vídeo, então precisa do
    // próprio som — mudo sempre, nesse caso, tocava a projeção sem áudio em
    // lugar nenhum.
    mainAlsoShowing() {
      return this.$appdata.get('popup_module') === 'video_player';
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
    // Volume nunca importava enquanto o elemento ficava sempre mudo — agora
    // que ele pode tocar com som de verdade (ver mainAlsoShowing), precisa
    // acompanhar o volume configurado no painel, igual à saída principal.
    'config.volume'(v) {
      const el = this.$refs.video;
      if (el) el.volume = (v ?? 100) / 100;
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
      if (!el) return;
      el.volume = (this.config.volume ?? 100) / 100;
      if (this.config.isPlaying) el.play().catch(() => {});
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
</style>
