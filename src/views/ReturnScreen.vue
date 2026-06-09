<template>
  <div class="rs-root">
    <!-- Barra de progresso da faixa (topo) -->
    <div class="rs-track-bar">
      <div class="rs-track-fill" :style="{ width: trackProgress + '%' }" />
    </div>

    <!-- Área principal: letra / título atual -->
    <div class="rs-main">
      <div
        v-if="displayText"
        class="rs-main-text"
        :class="{ 'rs-main-cover': isCover }"
        v-html="displayText"
      />
      <v-icon v-else size="96" color="rgba(255,255,255,0.10)">mdi-music-note</v-icon>

      <!-- Contador discreto no canto inferior direito -->
      <span v-if="slideCounter" class="rs-counter">{{ slideCounter }}</span>
    </div>

    <!-- Divisória: barra de progresso do slide -->
    <div class="rs-slide-bar">
      <div class="rs-slide-fill" :style="{ width: slideProgress + '%' }" />
    </div>

    <!-- Próxima letra -->
    <div class="rs-next">
      <div
        v-if="nextText"
        class="rs-next-text"
        v-html="nextText"
      />
      <span v-else class="rs-next-empty">–</span>
    </div>
  </div>
</template>

<script>
const isElectron = () =>
  typeof window !== 'undefined' &&
  typeof window.electron !== 'undefined' &&
  navigator.userAgent.includes('Electron');

export default {
  name: 'ReturnScreen',

  data: () => ({
    stateHandler: null,
    closingHandler: null,
  }),

  computed: {
    mediaConfig() {
      return this.$appdata.get('modules.media.config') || {};
    },
    mediaData() {
      return this.$appdata.get('modules.media.data') || {};
    },
    mediaShow() {
      return !!this.$appdata.get('modules.media.show');
    },

    computedSlides() {
      const data = this.mediaData;
      if (!data || !data.name) return [];
      let prevImage = data.url_image;
      let prevImagePos = data.image_position;
      return [
        {
          lyric: data.name,
          cover: true,
          url_image: data.url_image,
          image_position: data.image_position,
        },
        ...Object.values(data.lyric || data.slides || {})
          .filter(l => !l.cover && l.show_slide !== 0 && l.show_slide !== false)
          .sort((a, b) => (a.order ?? 0) - (b.order ?? 0))
          .map(l => {
            if (l.url_image) { prevImage = l.url_image; prevImagePos = l.image_position; }
            return {
              ...l,
              cover: false,
              lyric: l.lyric ? l.lyric.replace(/[\r\n]+/g, '<br>') : '',
              url_image: prevImage,
              image_position: prevImagePos,
            };
          }),
      ];
    },

    currentSlide() {
      const idx = this.mediaConfig.slide_index ?? 0;
      return this.computedSlides[idx] ?? null;
    },
    nextSlide() {
      const idx = this.mediaConfig.slide_index ?? 0;
      return this.computedSlides[idx + 1] ?? null;
    },

    isCover() {
      return this.currentSlide?.cover === true;
    },
    displayText() {
      const s = this.currentSlide;
      if (!s) return '';
      return s.lyric || '';
    },
    nextText() {
      const s = this.nextSlide;
      if (!s) return '';
      return s.lyric || '';
    },

    title() {
      return this.mediaConfig.title || '';
    },
    trackProgress() {
      const p = this.mediaConfig.progress ?? 0;
      return Math.min(100, Math.max(0, p));
    },
    slideProgress() {
      const p = this.mediaConfig.slide_progress ?? 0;
      return Math.min(100, Math.max(0, p));
    },
    slideCounter() {
      const idx = (this.mediaConfig.slide_index ?? 0) + 1;
      const total = this.computedSlides.length;
      if (!total) return '';
      return `${idx} / ${total}`;
    },
    timeText() {
      const cur = this.mediaConfig.current_time ?? 0;
      const dur = this.mediaConfig.duration ?? 0;
      return `${this._fmtTime(cur)} / ${this._fmtTime(dur)}`;
    },
  },

  methods: {
    _fmtTime(secs) {
      if (!secs || isNaN(secs)) return '0:00';
      const m = Math.floor(secs / 60);
      const s = Math.floor(secs % 60);
      return `${m}:${s.toString().padStart(2, '0')}`;
    },

    initElectron() {
      this.$appdata.set('is_popup', true);
      this.$userdata.load();
      const savedTheme = this.$userdata.get('theme');
      if (savedTheme) {
        try { this.$vuetify.theme.global.name = savedTheme; } catch { /* */ }
      }

      this.stateHandler = window.electron.on('state-update', (data) => {
        if (data && data.param) {
          this.$appdata.set(data.param, data.value);
          if (data.param === 'theme' && data.value) {
            try { this.$vuetify.theme.global.name = data.value; } catch { /* */ }
          }
        }
      });

      this.closingHandler = window.electron.on('return-closing', () => {
        const el = this.$el;
        if (el) {
          el.style.transition = 'opacity 0.4s ease';
          el.style.opacity = '0';
        }
      });

      // Solicita sincronização do estado completo ao renderer principal
      window.electron.notifyOutputReady();
    },

    initBrowser() {
      this.$appdata.set('is_popup', true);
      window.addEventListener('message', (event) => {
        if (event.origin === window.location.origin && event.data?.param) {
          this.$appdata.set(event.data.param, event.data.value);
        }
      });
    },
  },

  mounted() {
    if (isElectron()) {
      this.initElectron();
    } else {
      this.initBrowser();
    }
  },
  beforeUnmount() {
    if (isElectron()) {
      if (this.stateHandler)  window.electron.off('state-update',   this.stateHandler);
      if (this.closingHandler) window.electron.off('return-closing', this.closingHandler);
    }
  },
};
</script>

<style scoped>
/* ── Raiz ────────────────────────────────────────────────────── */
.rs-root {
  position: fixed;
  inset: 0;
  background: #000;
  display: flex;
  flex-direction: column;
  font-family: 'DINCondensedBold', 'Roboto Condensed', 'Arial Narrow', Arial, sans-serif;
  overflow: hidden;
  user-select: none;
}

/* ── Barra de progresso da faixa (topo) ─────────────────────── */
.rs-track-bar {
  height: 5px;
  background: rgba(255,255,255,0.08);
  flex-shrink: 0;
}
.rs-track-fill {
  height: 100%;
  background: #efb400;
  transition: width 0.4s linear;
}

/* ── Área principal (letra / título atual) ───────────────────── */
.rs-main {
  flex: 1;
  min-height: 0;
  background: #000;
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 32px 48px;
  position: relative;
}
.rs-main-text {
  font-size: clamp(32px, 9vh, 128px);
  font-weight: 900;
  text-align: center;
  text-transform: uppercase;
  color: #fff;
  line-height: 1.15;
  letter-spacing: 0.01em;
}
/* Slide de capa/título: amarelo */
.rs-main-cover {
  color: #efb400;
}

/* Contador discreto */
.rs-counter {
  position: absolute;
  bottom: 10px;
  right: 16px;
  font-size: clamp(11px, 1.4vh, 18px);
  color: rgba(255,255,255,0.25);
  font-variant-numeric: tabular-nums;
  font-weight: 400;
}

/* ── Barra de progresso do slide (divisória) ─────────────────── */
.rs-slide-bar {
  height: 5px;
  background: rgba(255,255,255,0.12);
  flex-shrink: 0;
}
.rs-slide-fill {
  height: 100%;
  background: #efb400;
  opacity: 0.55;
  transition: width 0.25s linear;
}

/* ── Próxima letra ───────────────────────────────────────────── */
.rs-next {
  flex: 0 0 36%;
  min-height: 0;
  background: #c0c0c0;
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 24px 48px;
}
.rs-next-text {
  font-size: clamp(22px, 6vh, 86px);
  font-weight: 900;
  text-align: center;
  text-transform: uppercase;
  color: #111;
  line-height: 1.15;
  letter-spacing: 0.01em;
}
.rs-next-empty {
  font-size: clamp(20px, 4vh, 48px);
  color: rgba(0,0,0,0.2);
  font-weight: 700;
}
</style>
