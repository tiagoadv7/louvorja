<template>
  <Window
    v-model="module.show"
    :title="t('title')"
    :icon="module.icon"
    :index="module.show ? 1 : 0"
    width="700"
    height="720"
    closable
    minimizable
    compact
    @close="close()"
    @minimize="onMinimize()"
  >
    <template v-slot:system_buttons>
      <LScreenBtn module="video_player" />
    </template>

    <div class="vp-root">

      <!-- ── Procurar vídeos/imagens ──────────────────────────────────────── -->
      <button class="vp-search-btn" @click="pickVideos">
        <v-icon size="18">mdi-filmstrip</v-icon>
        Procurar Vídeos/Imagens
        <v-icon size="18">mdi-magnify</v-icon>
      </button>

      <!-- ── Preview (mudo, sem playback real — só referência visual) ────── -->
      <div class="vp-preview">
        <!-- Mini player flutuante (picture-in-picture): sempre visível por cima
             das outras janelas do app, com play/pause próprio -->
        <button
          v-if="$electron.isElectron()"
          class="vp-pip-btn"
          :class="{ 'vp-pip-btn--on': pipOpen }"
          :title="pipOpen ? 'Fechar mini player flutuante' : 'Abrir mini player flutuante (picture-in-picture)'"
          @click="togglePip"
        >
          <v-icon size="15">mdi-picture-in-picture-bottom-right</v-icon>
        </button>

        <v-icon v-if="!config.src" size="46" style="opacity:0.2">mdi-movie-open-outline</v-icon>
        <img
          v-else-if="config.mediaType === 'image'"
          :key="config.src"
          :src="config.src"
          class="vp-preview-video"
          :style="previewImageStyle"
        />
        <video v-else :key="config.src" :src="config.src" class="vp-preview-video" muted preload="metadata" />
        <div v-if="config.isFading" class="vp-preview-fading">
          <v-icon size="14">mdi-volume-low</v-icon> Efeito de fade em andamento…
        </div>

        <!-- Girar/inverter — só faz sentido para imagem (corrige orientação na tela) -->
        <div v-if="config.src && config.mediaType === 'image'" class="vp-image-controls">
          <button class="vp-img-ctrl-btn" title="Girar à esquerda" @click="rotateLeft">
            <v-icon size="16">mdi-rotate-left</v-icon>
          </button>
          <button class="vp-img-ctrl-btn" title="Girar à direita" @click="rotateRight">
            <v-icon size="16">mdi-rotate-right</v-icon>
          </button>
          <button
            class="vp-img-ctrl-btn"
            :class="{ 'vp-img-ctrl-btn--on': config.flip }"
            title="Inverter (espelhar)"
            @click="toggleFlip"
          >
            <v-icon size="16">mdi-flip-horizontal</v-icon>
          </button>
        </div>
      </div>

      <!-- ── Lista de vídeos/imagens (playlist) ───────────────────────────────────── -->
      <div class="vp-playlist" @dragover.prevent @drop.prevent="onDropFiles">
        <div class="vp-playlist-head">
          <div class="vp-playlist-title">Lista de Vídeos/Imagens</div>
          <div class="vp-playlist-sub">
            Arraste o arquivo aqui para adicionar na fila
            <button class="vp-add-btn" @click="pickVideos">
              <v-icon size="16">mdi-plus-circle-outline</v-icon>
            </button>
          </div>
        </div>

        <div class="vp-playlist-body">
          <div v-if="!playlist.length" class="vp-playlist-empty">Nenhum arquivo na fila</div>
          <div
            v-for="item in playlist" :key="item.id"
            :class="['vp-playlist-item', { 'vp-playlist-item--active': config.currentId === item.id }]"
            @click="selectItem(item)"
          >
            <v-icon size="16" class="vp-playlist-icon">{{ item.mediaType === 'image' ? 'mdi-image-outline' : 'mdi-filmstrip-box' }}</v-icon>
            <div class="vp-playlist-name" :title="item.path">{{ item.name }}</div>
            <div class="vp-playlist-dur">{{ item.mediaType === 'image' ? '' : (item.duration ? fmt(item.duration) : '…') }}</div>
            <button class="vp-playlist-del" @click.stop="removeFromPlaylist(item)">
              <v-icon size="13">mdi-close</v-icon>
            </button>
          </div>
        </div>
      </div>

      <!-- ── Transporte (vídeo: play/volume/talkover/loop) ─────────────────── -->
      <div class="vp-transport" v-if="config.mediaType !== 'image'">
        <button class="vp-tp-btn vp-tp-btn--play" :disabled="!config.src" @click="togglePlay">
          <v-icon size="20">{{ config.isPlaying ? 'mdi-pause' : 'mdi-play' }}</v-icon>
        </button>
        <button class="vp-tp-btn vp-tp-btn--stop" :disabled="!config.src" @click="stop">
          <v-icon size="18">mdi-stop</v-icon>
        </button>

        <div class="vp-vol-group">
          <v-icon size="15">mdi-volume-high</v-icon>
          <input
            type="range" min="0" max="100" step="1"
            class="vp-vol-slider"
            :value="config.volume"
            @input="setVolume($event.target.value)"
          />
          <span class="vp-vol-pct">{{ config.volume }}%</span>
        </div>

        <div class="vp-vol-group">
          <button
            class="vp-talkover-btn"
            :class="{ 'vp-talkover-btn--on': config.talkover }"
            title="Talkover — reduz o volume do vídeo gradualmente"
            @click="toggleTalkover"
          >
            <v-icon size="15">mdi-microphone</v-icon>
          </button>
          <input
            type="range" min="0" max="100" step="1"
            class="vp-vol-slider"
            :value="config.talkoverLevel"
            @input="setTalkoverLevel($event.target.value)"
          />
          <span class="vp-vol-pct">{{ config.talkoverLevel }}%</span>
        </div>

        <button class="vp-repeat-btn" :class="{ 'vp-repeat-btn--on': config.loop }" @click="toggleLoop">
          <v-icon size="15">mdi-repeat</v-icon> Repetir
        </button>
      </div>

      <!-- ── Transporte (imagem: sem play/volume, só tirar da tela) ────────── -->
      <div class="vp-transport" v-else>
        <button class="vp-tp-btn vp-tp-btn--stop" :disabled="!config.src" @click="stop" title="Parar exibição">
          <v-icon size="18">mdi-stop</v-icon>
        </button>
        <span class="vp-image-hint">Imagem exibida na tela de projeção</span>
      </div>
    </div>
  </Window>
</template>

<script>
import manifest from '../manifest.json';
import Window from '@/components/Window.vue';
import LScreenBtn from '@/components/buttons/Screen.vue';
import $audioBus from '@/helpers/AudioBus';

export default {
  name: 'VideoPlayerModule',
  components: { Window, LScreenBtn },

  data: () => ({
    pipOpen: false,
    _pipHandlers: [],
    _focusHandler: null,
  }),

  computed: {
    /* ── obrigatórias ── */
    module_id() { return manifest.id; },
    module()    { return this.$modules.get(this.module_id) || {}; },

    // Lógica de fila/config compartilhada com outros módulos (ex. Liturgia)
    // vive em @/helpers/VideoPlayer — aqui só lemos/gravamos através dela.
    config() { return this.$videoPlayer.getConfig(); },
    playlist: {
      get() { return this.$videoPlayer.getPlaylist(); },
      set(v) { this.$videoPlayer.setPlaylist(v); },
    },
    previewImageStyle() {
      const rotation = this.config.rotation || 0;
      const flipScale = this.config.flip ? -1 : 1;
      return { transform: `rotate(${rotation}deg) scaleX(${flipScale})` };
    },
  },

  methods: {
    /* ── obrigatórios ── */
    t(text) {
      const key = `modules.${this.module_id}.${text}`;
      const result = this.$t(key);
      if (result === key) {
        if (text === 'title') return manifest.name || result;
        const locale = this.$i18n?.locale?.value || this.$i18n?.locale || 'pt';
        const stored = this.$appdata.get(`modules.${this.module_id}.manifest`);
        const tr = stored?.translations?.[locale] || stored?.translations?.['pt'];
        if (tr) {
          const val = text.split('.').reduce((o, k) => o?.[k], tr);
          if (typeof val === 'string') return val;
        }
      }
      return result;
    },
    // Fechar (diferente de minimizar, ver onMinimize) encerra a projeção
    // também — reaproveita o mesmo fade suave do botão "Parar" (stop()),
    // em vez de só esconder o painel e deixar o vídeo tocando escondido.
    close() {
      this.$videoPlayer.stop();
      this.$modules.close(this.module_id);
    },

    fmt(s) {
      if (!s || isNaN(s)) return '0:00';
      const m = Math.floor(s / 60), sec = Math.floor(s % 60).toString().padStart(2, '0');
      return `${m}:${sec}`;
    },

    // Grava só os campos alterados (nunca um snapshot cheio de "config") —
    // currentTime/duration/isFading são atualizados pela própria tela de
    // saída e nunca voltam por IPC pra cá (ver AudioBus/AppData); reenviar um
    // snapshot inteiro sobrescreveria esses campos com valores desatualizados
    // e fazia o vídeo "voltar no tempo" a cada play/pause/volume.
    _patch(partial) { this.$videoPlayer.setConfig(partial); },

    async pickVideos() {
      const fps = await this.$electron.selectFile({
        title: 'Selecionar vídeos ou imagens',
        multiple: true,
        filters: [
          { name: 'Vídeo ou Imagem', extensions: ['mp4', 'webm', 'ogg', 'mov', 'avi', 'mkv', 'jpg', 'jpeg', 'png', 'gif', 'bmp', 'webp'] },
          { name: 'Vídeo', extensions: ['mp4', 'webm', 'ogg', 'mov', 'avi', 'mkv'] },
          { name: 'Imagem', extensions: ['jpg', 'jpeg', 'png', 'gif', 'bmp', 'webp'] },
        ],
      });
      const list = Array.isArray(fps) ? fps : (fps ? [fps] : []);
      for (const fp of list) this.$videoPlayer.addToPlaylist(fp);
    },

    rotateLeft()  { this.$videoPlayer.rotateBy(-90); },
    rotateRight() { this.$videoPlayer.rotateBy(90); },
    toggleFlip()  { this.$videoPlayer.toggleFlip(); },

    onDropFiles(e) {
      const files = [...(e.dataTransfer?.files || [])];
      for (const file of files) {
        const fp = this.$electron.getPathForFile(file);
        if (fp) this.$videoPlayer.addToPlaylist(fp);
      }
    },

    selectItem(item) { this.$videoPlayer.selectPlaylistItem(item); },
    removeFromPlaylist(item) {
      this.playlist = this.playlist.filter(p => p.id !== item.id);
      if (this.config.currentId === item.id) {
        this._patch({
          src: '', path: '', name: '', currentId: null,
          isPlaying: false, currentTime: 0, duration: 0,
          stopToken: (this.config.stopToken || 0) + 1,
        });
      }
    },

    togglePlay() {
      this.$videoPlayer.togglePlay();
    },
    stop() {
      this.$videoPlayer.stop();
    },
    toggleLoop() { this._patch({ loop: !this.config.loop }); },
    toggleTalkover() { this._patch({ talkover: !this.config.talkover }); },
    setVolume(v) { this._patch({ volume: Number(v) }); },
    setTalkoverLevel(v) { this._patch({ talkoverLevel: Number(v) }); },

    // Mini player flutuante (picture-in-picture): abre/fecha uma janela
    // separada, sempre visível por cima das demais, que espelha este vídeo.
    async togglePip() {
      if (this.pipOpen) {
        await this.$electron.pipClose();
        this.pipOpen = false;
      } else {
        await this.$electron.pipOpen();
        this.pipOpen = true;
      }
    },

    // Minimizar o painel não pausa nem interrompe a reprodução (ela continua
    // na projeção normalmente) — só troca a prévia pelos controles da barra do
    // rodapé (ver Footer.vue/videoActive). O mini player flutuante (PIP) é
    // sempre uma ação manual e separada (botão dedicado) — nunca some/aparece
    // sozinho junto do minimizar, pra não nascer sem o operador ter pedido.
    onMinimize() {
      this.$modules.minimize(this.module_id);
    },
  },

  async mounted() {
    // Outro dono de áudio (SoundMaster/Media) pediu foco: o Popup.vue (janela
    // de saída) já reage sozinho e para na hora — mas escritas feitas por ele
    // (is_popup=true) nunca voltam pra esta janela (ver AppData.js). Sem este
    // listener aqui também, o painel e a barra do rodapé nunca ficavam
    // sabendo que o vídeo parou, e continuavam mostrando ele como "ativo"
    // pra sempre (mesmo já mudo/parado na projeção).
    this._focusHandler = $audioBus.listen('video_player', () => {
      if (this.config.isPlaying) this.stop();
    });

    if (!this.$electron.isElectron()) return;
    this.pipOpen = await this.$electron.pipIsOpen();

    // Comandos vindos do mini player (play/pause, parar) chegam aqui porque
    // esta janela é a dona da config compartilhada do módulo de vídeo.
    const hClosed = this.$electron.on('video-pip:closed', () => { this.pipOpen = false; });
    const hToggle = this.$electron.on('video-pip:toggle-play', () => this.togglePlay());
    const hStop   = this.$electron.on('video-pip:stop', () => this.stop());
    // Progresso (currentTime/duration) vindo da janela de saída — canal
    // dedicado (ver comentário em Popup.vue/onTimeUpdate). Sem isso, o painel
    // e a barra do rodapé ficavam parados em 0:00 mesmo com o vídeo tocando.
    const hProgress = this.$electron.on('video-player:progress', ({ currentTime, duration }) => {
      this.$videoPlayer.setConfig({ currentTime, duration });
    });
    this._pipHandlers = [
      ['video-pip:closed', hClosed],
      ['video-pip:toggle-play', hToggle],
      ['video-pip:stop', hStop],
      ['video-player:progress', hProgress],
    ];
  },

  beforeUnmount() {
    this._pipHandlers.forEach(([channel, handler]) => this.$electron.off(channel, handler));
    $audioBus.unlisten(this._focusHandler);
  },
};
</script>

<style scoped>
.vp-root {
  display: flex;
  flex-direction: column;
  gap: 14px;
  padding: 16px;
  height: 100%;
  background: rgb(var(--v-theme-surface));
  color: rgb(var(--v-theme-on-surface));
}

/* ── Procurar vídeos ── */
.vp-search-btn {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 8px;
  padding: 12px;
  border: none;
  border-radius: 8px;
  background: rgb(var(--v-theme-primary));
  color: rgb(var(--v-theme-on-primary));
  font-size: 14px;
  font-weight: 600;
  cursor: pointer;
  flex-shrink: 0;
  transition: filter 0.15s;
}
.vp-search-btn:hover { filter: brightness(1.08); }

/* ── Preview ── */
.vp-preview {
  position: relative;
  /* Precisa ser um height fixo (não min-height): a <img> do modo imagem usa
     height:100% (para caber com object-fit:contain), e percentual de altura
     só resolve corretamente contra uma altura definida do pai — com apenas
     min-height (altura "auto") o resultado é indeterminado e o Chromium
     acaba esticando esse box para quase a altura inteira do painel. */
  height: 220px;
  flex-shrink: 0;
  border-radius: 8px;
  background: rgba(var(--v-theme-on-surface), 0.05);
  display: flex;
  align-items: center;
  justify-content: center;
  overflow: hidden;
}
.vp-preview-video { width: 100%; height: 100%; object-fit: contain; }
.vp-preview-fading {
  position: absolute;
  bottom: 6px;
  left: 8px;
  right: 8px;
  font-size: 11px;
  color: rgba(var(--v-theme-on-surface), 0.7);
  background: rgba(0, 0, 0, 0.4);
  border-radius: 4px;
  padding: 3px 6px;
  display: flex;
  align-items: center;
  gap: 4px;
}

/* ── Mini player flutuante (PIP) ── */
.vp-pip-btn {
  position: absolute;
  top: 6px;
  left: 6px;
  width: 26px;
  height: 26px;
  border-radius: 50%;
  border: none;
  background: rgba(0, 0, 0, 0.45);
  color: #fff;
  display: flex;
  align-items: center;
  justify-content: center;
  cursor: pointer;
  transition: background 0.12s;
  z-index: 1;
}
.vp-pip-btn:hover { background: rgba(0, 0, 0, 0.65); }
.vp-pip-btn--on { background: rgb(var(--v-theme-primary)); }

/* ── Girar/inverter imagem ── */
.vp-image-controls {
  position: absolute;
  top: 6px;
  right: 6px;
  display: flex;
  gap: 4px;
}
.vp-img-ctrl-btn {
  width: 26px;
  height: 26px;
  border-radius: 50%;
  border: none;
  background: rgba(0, 0, 0, 0.45);
  color: #fff;
  display: flex;
  align-items: center;
  justify-content: center;
  cursor: pointer;
  transition: background 0.12s;
}
.vp-img-ctrl-btn:hover { background: rgba(0, 0, 0, 0.65); }
.vp-img-ctrl-btn--on { background: rgb(var(--v-theme-primary)); }
.vp-image-hint {
  font-size: 12px;
  color: rgba(var(--v-theme-on-surface), 0.55);
}

/* ── Playlist ── */
.vp-playlist {
  flex: 1;
  min-height: 0;
  display: flex;
  flex-direction: column;
  border-radius: 8px;
  background: rgba(var(--v-theme-on-surface), 0.04);
  overflow: hidden;
}
.vp-playlist-head {
  padding: 14px 16px 10px;
  text-align: center;
  flex-shrink: 0;
}
.vp-playlist-title { font-size: 15px; font-weight: 700; }
.vp-playlist-sub {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 6px;
  font-size: 11.5px;
  color: rgba(var(--v-theme-on-surface), 0.5);
  margin-top: 2px;
}
.vp-add-btn {
  border: none;
  background: none;
  color: rgba(var(--v-theme-on-surface), 0.6);
  cursor: pointer;
  display: flex;
  align-items: center;
}
.vp-add-btn:hover { color: rgb(var(--v-theme-primary)); }

.vp-playlist-body { flex: 1; overflow-y: auto; padding: 0 8px 8px; }
.vp-playlist-empty {
  text-align: center;
  font-size: 12px;
  color: rgba(var(--v-theme-on-surface), 0.35);
  padding: 24px 0;
}

.vp-playlist-item {
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 8px 10px;
  border-radius: 6px;
  cursor: pointer;
  transition: background 0.1s;
}
.vp-playlist-item:hover { background: rgba(var(--v-theme-on-surface), 0.06); }
.vp-playlist-item--active { background: rgba(var(--v-theme-primary), 0.12); }
.vp-playlist-icon { flex-shrink: 0; opacity: 0.6; }
.vp-playlist-name {
  flex: 1;
  font-size: 13px;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}
.vp-playlist-dur { font-size: 11.5px; color: rgba(var(--v-theme-on-surface), 0.5); white-space: nowrap; }
.vp-playlist-del {
  width: 22px;
  height: 22px;
  border-radius: 50%;
  border: none;
  background: #e53935;
  color: #fff;
  display: flex;
  align-items: center;
  justify-content: center;
  cursor: pointer;
  flex-shrink: 0;
}
.vp-playlist-del:hover { filter: brightness(1.1); }

/* ── Transporte ── */
.vp-transport {
  display: flex;
  align-items: center;
  gap: 10px;
  flex-wrap: wrap;
  flex-shrink: 0;
  padding-top: 6px;
  border-top: 1px solid rgba(var(--v-border-color), var(--v-border-opacity));
}
.vp-tp-btn {
  width: 38px;
  height: 38px;
  border-radius: 50%;
  border: none;
  color: #fff;
  display: flex;
  align-items: center;
  justify-content: center;
  cursor: pointer;
  flex-shrink: 0;
  transition: filter 0.12s;
}
.vp-tp-btn:hover:not(:disabled) { filter: brightness(1.1); }
.vp-tp-btn:disabled { opacity: 0.35; cursor: default; }
.vp-tp-btn--play { background: rgb(var(--v-theme-primary)); }
.vp-tp-btn--stop { background: #e53935; }

.vp-vol-group { display: flex; align-items: center; gap: 6px; }
.vp-vol-slider { width: 70px; accent-color: rgb(var(--v-theme-primary)); }
.vp-vol-pct { font-size: 11px; color: rgba(var(--v-theme-on-surface), 0.55); width: 32px; }

.vp-talkover-btn {
  width: 26px;
  height: 26px;
  border-radius: 50%;
  border: none;
  background: rgba(var(--v-theme-on-surface), 0.08);
  color: rgba(var(--v-theme-on-surface), 0.6);
  display: flex;
  align-items: center;
  justify-content: center;
  cursor: pointer;
  flex-shrink: 0;
}
.vp-talkover-btn--on { background: rgb(var(--v-theme-warning)); color: #fff; }

.vp-repeat-btn {
  display: flex;
  align-items: center;
  gap: 5px;
  margin-left: auto;
  padding: 6px 14px;
  border-radius: 20px;
  border: none;
  background: rgba(var(--v-theme-on-surface), 0.08);
  color: rgba(var(--v-theme-on-surface), 0.6);
  font-size: 12px;
  font-weight: 600;
  cursor: pointer;
  white-space: nowrap;
}
.vp-repeat-btn--on { background: #43a047; color: #fff; }
</style>
