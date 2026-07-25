<template>
  <transition name="rs-fade" appear>
    <div v-if="visible" class="rs-root">
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

        <!-- Relógio / cronômetro individual — widgets independentes do slide,
             ativados no Monitor de Retorno (MonitorSelector.vue) -->
        <div v-if="clockEnabled || timerEnabled" class="rs-widgets">
          <div v-if="clockEnabled" class="rs-widget rs-widget-clock">
            <v-icon size="16" class="rs-widget-icon">mdi-clock-outline</v-icon>{{ wallClockText }}
          </div>
          <div
            v-if="timerEnabled"
            class="rs-widget rs-widget-timer"
            :class="{ 'rs-widget-timer--running': ccIsRunning, 'rs-widget-timer--overtime': ccOvertime }"
          >
            <v-icon size="16" class="rs-widget-icon">mdi-timer-outline</v-icon>{{ timerText }}
          </div>
        </div>

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
  </transition>
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
    batchHandler: null,
    closingHandler: null,
    visible: false,
    now: new Date(),
    _tickInterval: null,
    // Preferência persistida (ver MonitorSelector.vue) — usada até a primeira
    // atualização "ao vivo" chegar via state-update nesta sessão.
    showClockPref: false,
    showTimerPref: false,
  }),

  computed: {
    clockEnabled() {
      const live = this.$appdata.get('return_screen.show_clock');
      return live === null || live === undefined ? this.showClockPref : !!live;
    },
    timerEnabled() {
      const live = this.$appdata.get('return_screen.show_timer');
      return live === null || live === undefined ? this.showTimerPref : !!live;
    },
    wallClockText() {
      const d = this.now;
      const pad = (v) => String(v).padStart(2, '0');
      return `${pad(d.getHours())}:${pad(d.getMinutes())}:${pad(d.getSeconds())}`;
    },

    // Cronômetro individual — mostra o mesmo cronômetro de culto que já está
    // rodando (estado compartilhado via $appdata), como um widget independente
    // do slide, em vez de duplicar a lógica de contagem num cronômetro novo.
    ccIsRunning() {
      return !!this.$appdata.get('modules.cronometro_culto.is_running');
    },
    ccTargetEndAt() {
      const v = this.$appdata.get('modules.cronometro_culto.target_end_at');
      if (!v) return null;
      return v instanceof Date ? v : new Date(v);
    },
    ccTimeFormat() {
      return this.$userdata.get('modules.cronometro_culto.time_format', 'hh:mm:ss') || 'hh:mm:ss';
    },
    ccAutoStopAtZero() {
      return !!this.$userdata.get('modules.cronometro_culto.auto_stop_at_zero', false);
    },
    ccRemainingMs() {
      if (!this.ccTargetEndAt) return 0;
      return this.ccTargetEndAt - this.now;
    },
    ccOvertime() {
      return this.ccIsRunning && this.ccRemainingMs < 0 && !this.ccAutoStopAtZero;
    },
    timerText() {
      if (!this.ccIsRunning || !this.ccTargetEndAt) return '--:--:--';
      // Sem sinal de negativo — o vermelho (ccOvertime) já indica que passou de zero.
      return this._formatDuration(this.ccRemainingMs, this.ccTimeFormat);
    },

    mediaConfig() {
      return this.$appdata.get('modules.media.config') || {};
    },
    mediaData() {
      return this.$appdata.get('modules.media.data') || {};
    },
    mediaShow() {
      return !!this.$appdata.get('modules.media.show');
    },
    mediaMinimized() {
      return !!this.$appdata.get('modules.media.minimized');
    },
    // Mesmo critério de "ativo" usado pela janela de saída (Popup.vue) — o
    // retorno só aparece quando há de fato uma música em apresentação.
    mediaActive() {
      return this.mediaShow || this.mediaMinimized;
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

    _formatDuration(ms, format) {
      const totalSeconds = Math.floor(Math.abs(ms) / 1000);
      const hours = Math.floor(totalSeconds / 3600);
      const minutes = Math.floor((totalSeconds % 3600) / 60);
      const seconds = totalSeconds % 60;
      const pad = (v) => String(v).padStart(2, '0');
      const tokens = { hh: pad(hours), mm: pad(minutes), ss: pad(seconds) };
      return format.replace(/hh|mm|ss/g, (m) => tokens[m]);
    },

    _applyStateEntry(data) {
      if (!data || !data.param) return;
      this.$appdata.set(data.param, data.value);
      if (data.param === 'theme' && data.value) {
        try { this.$vuetify.theme.global.name = data.value; } catch { /* */ }
      }
    },

    initElectron() {
      this.$appdata.set('is_popup', true);
      this.$userdata.load();
      const savedTheme = this.$userdata.get('theme');
      if (savedTheme) {
        try { this.$vuetify.theme.global.name = savedTheme; } catch { /* */ }
      }
      this.showClockPref = !!this.$userdata.get('return_screen.show_clock', false);
      this.showTimerPref = !!this.$userdata.get('return_screen.show_timer', false);

      this.stateHandler = window.electron.on('state-update', (data) => {
        this._applyStateEntry(data);
      });
      // Lote atômico (ver AppData.js setMultiple) — aplica tudo antes de
      // ceder o controle, sem estado combinado intermediário incorreto.
      this.batchHandler = window.electron.on('state-update-batch', (entries) => {
        (entries || []).forEach((entry) => this._applyStateEntry(entry));
      });

      // Mesmo sinal dos dois casos de fechamento (return:close direto, ou
      // output:close em cascata) — aciona o fade de saída da transition.
      this.closingHandler = window.electron.on('return-closing', () => {
        this.visible = false;
      });

      // Solicita sincronização do estado completo ao renderer principal
      window.electron.notifyOutputReady('return');
    },

    initBrowser() {
      this.$appdata.set('is_popup', true);
      this.showClockPref = !!this.$userdata.get('return_screen.show_clock', false);
      this.showTimerPref = !!this.$userdata.get('return_screen.show_timer', false);
      window.addEventListener('message', (event) => {
        if (event.origin !== window.location.origin) return;
        if (Array.isArray(event.data?.batch)) {
          event.data.batch.forEach((entry) => this._applyStateEntry(entry));
          return;
        }
        this._applyStateEntry(event.data);
      });
    },
  },

  watch: {
    // Aparece com fade junto com o slide da música (quando a apresentação
    // fica ativa) e some com fade quando ela termina — em vez de mostrar a
    // tela vazia assim que a janela abre, antes de qualquer música tocar.
    mediaActive(active) {
      this.visible = active;
    },
  },

  mounted() {
    if (isElectron()) {
      this.initElectron();
    } else {
      this.initBrowser();
    }
    this._tickInterval = setInterval(() => { this.now = new Date(); }, 1000);
    // Reflete o estado atual (pode já estar ativo se a apresentação já
    // estiver rolando quando o retorno é aberto) — o resync completo pedido
    // em initElectron() ainda está a caminho, então isso normalmente começa
    // falso e o watcher acima liga o fade assim que os dados chegarem.
    this.visible = this.mediaActive;
  },
  beforeUnmount() {
    clearInterval(this._tickInterval);
    if (isElectron()) {
      if (this.stateHandler)  window.electron.off('state-update',   this.stateHandler);
      if (this.batchHandler)  window.electron.off('state-update-batch', this.batchHandler);
      if (this.closingHandler) window.electron.off('return-closing', this.closingHandler);
    }
  },
};
</script>

<style scoped>
/* ── Fade de entrada/saída da tela de retorno ─────────────────── */
.rs-fade-enter-active,
.rs-fade-leave-active {
  transition: opacity 0.4s ease;
}
.rs-fade-enter-from,
.rs-fade-leave-to {
  opacity: 0;
}

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
  font-size: clamp(38px, 11vh, 148px);
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

/* ── Relógio / cronômetro individual (canto superior esquerdo) ──── */
.rs-widgets {
  position: absolute;
  top: 14px;
  left: 16px;
  display: flex;
  flex-direction: column;
  gap: 6px;
  z-index: 1;
}
.rs-widget {
  display: flex;
  align-items: center;
  gap: 6px;
  background: rgba(0, 0, 0, 0.55);
  border: 1px solid rgba(255, 255, 255, 0.12);
  border-radius: 6px;
  padding: 4px 10px;
  font-size: clamp(13px, 2vh, 22px);
  font-weight: 700;
  font-variant-numeric: tabular-nums;
  color: rgba(255, 255, 255, 0.85);
  line-height: 1.3;
}
.rs-widget-icon {
  opacity: 0.7;
}
.rs-widget-timer--running {
  color: #efb400;
  border-color: rgba(239, 180, 0, 0.35);
}
/* "Desligar ao zerar tempo" desmarcado: passou de zero e continua contando —
   vermelho em vez do sinal de negativo. */
.rs-widget-timer--overtime {
  color: #ff5252;
  border-color: rgba(255, 82, 82, 0.4);
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
