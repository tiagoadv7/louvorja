<template>
  <div class="pip-root">
    <div class="pip-dragbar">
      <v-icon size="13" style="opacity:0.6">mdi-picture-in-picture-bottom-right</v-icon>
      <span class="pip-title">{{ config.name || 'Vídeo' }}</span>
      <button class="pip-icon-btn" title="Fechar mini player" @click="closeWindow">
        <v-icon size="14">mdi-close</v-icon>
      </button>
    </div>

    <div class="pip-stage">
      <template v-if="!hasSrc">
        <v-icon size="40" style="opacity:0.25">mdi-movie-open-outline</v-icon>
        <span class="pip-empty-hint">Nenhum vídeo selecionado</span>
      </template>

      <img
        v-else-if="isImage"
        :src="config.src"
        class="pip-media"
        :style="imageStyle"
      />

      <video
        v-else
        ref="video"
        :key="config.src"
        :src="config.src"
        :loop="config.loop"
        muted
        class="pip-media"
        @loadedmetadata="onLoadedMetadata"
        @click="togglePlay"
      />

      <div v-if="hasSrc && !isImage" class="pip-controls">
        <button class="pip-ctrl-btn pip-ctrl-btn--play" title="Play/Pause" @click="togglePlay">
          <v-icon size="20">{{ config.isPlaying ? 'mdi-pause' : 'mdi-play' }}</v-icon>
        </button>
        <button class="pip-ctrl-btn" title="Parar" @click="stop">
          <v-icon size="16">mdi-stop</v-icon>
        </button>
      </div>
      <div v-else-if="hasSrc && isImage" class="pip-controls">
        <button class="pip-ctrl-btn" title="Parar exibição" @click="stop">
          <v-icon size="16">mdi-stop</v-icon>
        </button>
      </div>
    </div>
  </div>
</template>

<script>
const isElectron = () =>
  typeof window !== 'undefined' &&
  typeof window.electron !== 'undefined' &&
  navigator.userAgent.includes('Electron');

export default {
  name: 'VideoPip',

  data: () => ({
    stateHandler: null,
    batchHandler: null,
    _escHandler: null,
  }),

  computed: {
    config() {
      return this.$appdata.get('modules.video_player.config') || {};
    },
    hasSrc() { return !!this.config.src; },
    isImage() { return this.config.mediaType === 'image'; },
    imageStyle() {
      const rotation = this.config.rotation || 0;
      const flipScale = this.config.flip ? -1 : 1;
      return { transform: `rotate(${rotation}deg) scaleX(${flipScale})` };
    },
  },

  watch: {
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
  },

  methods: {
    onLoadedMetadata() {
      const el = this.$refs.video;
      if (el && this.config.isPlaying) el.play().catch(() => {});
    },
    // Repassa o comando para a janela principal, que é a dona da config
    // compartilhada — assim o play/pause controla o mesmo vídeo/áudio real
    // exibido na projeção, não uma cópia isolada aqui no mini player.
    togglePlay() {
      if (!this.hasSrc) return;
      this.$electron.sendPipTogglePlay();
    },
    stop() {
      if (!this.hasSrc) return;
      this.$electron.sendPipStop();
    },
    closeWindow() {
      this.$electron.pipClose();
    },

    _applyStateEntry(data) {
      if (data && data.param) this.$appdata.set(data.param, data.value);
    },

    initElectron() {
      this.$appdata.set('is_popup', true);

      this.stateHandler = window.electron.on('state-update', (data) => {
        this._applyStateEntry(data);
      });
      // Lote atômico (ver AppData.js setMultiple) — aplica tudo antes de
      // ceder o controle, sem estado combinado intermediário incorreto.
      this.batchHandler = window.electron.on('state-update-batch', (entries) => {
        (entries || []).forEach((entry) => this._applyStateEntry(entry));
      });

      this._escHandler = (e) => { if (e.key === 'Escape') this.closeWindow(); };
      document.addEventListener('keydown', this._escHandler);

      // Solicita o estado completo atual (a janela PIP abre "vazia" sem isso)
      window.electron.notifyOutputReady('pip');
    },
  },

  mounted() {
    if (isElectron()) this.initElectron();
  },
  beforeUnmount() {
    if (isElectron()) {
      if (this.stateHandler) window.electron.off('state-update', this.stateHandler);
      if (this.batchHandler) window.electron.off('state-update-batch', this.batchHandler);
      if (this._escHandler) document.removeEventListener('keydown', this._escHandler);
    }
  },
};
</script>

<style scoped>
.pip-root {
  position: fixed;
  inset: 0;
  display: flex;
  flex-direction: column;
  background: #000;
  color: #fff;
  overflow: hidden;
  user-select: none;
}

.pip-dragbar {
  -webkit-app-region: drag;
  display: flex;
  align-items: center;
  gap: 6px;
  flex-shrink: 0;
  height: 26px;
  padding: 0 6px 0 10px;
  background: rgba(255, 255, 255, 0.06);
}
.pip-title {
  flex: 1;
  min-width: 0;
  font-size: 11px;
  font-weight: 600;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
  opacity: 0.75;
}
.pip-icon-btn {
  -webkit-app-region: no-drag;
  width: 20px;
  height: 20px;
  border: none;
  background: none;
  color: rgba(255, 255, 255, 0.6);
  display: flex;
  align-items: center;
  justify-content: center;
  cursor: pointer;
  border-radius: 4px;
  flex-shrink: 0;
}
.pip-icon-btn:hover { background: rgba(255, 255, 255, 0.12); color: #fff; }

.pip-stage {
  -webkit-app-region: no-drag;
  position: relative;
  flex: 1;
  min-height: 0;
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 8px;
}
.pip-media {
  width: 100%;
  height: 100%;
  object-fit: contain;
  cursor: pointer;
}
.pip-empty-hint {
  position: absolute;
  bottom: 10px;
  left: 0;
  right: 0;
  text-align: center;
  font-size: 11px;
  opacity: 0.35;
}

.pip-controls {
  position: absolute;
  bottom: 8px;
  left: 0;
  right: 0;
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 8px;
  opacity: 0;
  transition: opacity 0.15s;
}
.pip-stage:hover .pip-controls { opacity: 1; }

.pip-ctrl-btn {
  width: 32px;
  height: 32px;
  border-radius: 50%;
  border: none;
  background: rgba(0, 0, 0, 0.55);
  color: #fff;
  display: flex;
  align-items: center;
  justify-content: center;
  cursor: pointer;
  backdrop-filter: blur(2px);
}
.pip-ctrl-btn:hover { background: rgba(0, 0, 0, 0.75); }
.pip-ctrl-btn--play {
  width: 40px;
  height: 40px;
  background: rgba(var(--v-theme-primary), 0.85);
}
.pip-ctrl-btn--play:hover { background: rgb(var(--v-theme-primary)); }
</style>
