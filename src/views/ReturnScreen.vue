<template>
  <transition name="rs-fade" appear>
    <div v-if="visible" class="rs-root" :class="{ 'rs-root--active': mediaActive || clockModuleActive || cronometroModuleActive }">
      <!-- Conteúdo do slide (letra/título, barras de progresso) — só aparece
           junto com uma música realmente ativa; some com fade quando ela
           termina. -->
      <transition name="rs-fade">
        <div v-if="mediaActive" class="rs-slide">
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
      </transition>

      <!-- Espelha o módulo Relógio de verdade (mesma fonte/cor/tamanho que
           foi configurado nele) — só quando ele é o que está projetado no
           momento (popup_module), nunca junto com uma música. -->
      <transition name="rs-fade">
        <div v-if="clockModuleActive" class="rs-module-mirror">
          <ClockScreen />
        </div>
      </transition>

      <!-- Idem para o Cronômetro de Culto. -->
      <transition name="rs-fade">
        <div v-if="cronometroModuleActive" class="rs-module-mirror">
          <CronometroScreen />
        </div>
      </transition>
    </div>
  </transition>
</template>

<script>
import ClockScreen from '@/modules/clock/components/Screen.vue';
import CronometroScreen from '@/modules/cronometro_culto/components/Screen.vue';

const isElectron = () =>
  typeof window !== 'undefined' &&
  typeof window.electron !== 'undefined' &&
  navigator.userAgent.includes('Electron');

export default {
  name: 'ReturnScreen',
  components: { ClockScreen, CronometroScreen },

  data: () => ({
    stateHandler: null,
    batchHandler: null,
    closingHandler: null,
    visible: false,
    now: new Date(),
    _tickInterval: null,
  }),

  computed: {
    // "popup_module" é a mesma chave que a janela de saída usa pra decidir
    // qual módulo está projetado agora (ver views/Popup.vue) — o retorno usa
    // ela pra espelhar exatamente o que está sendo exibido, um de cada vez.
    popupModule() {
      return this.$appdata.get('popup_module');
    },
    clockModuleActive() {
      return this.popupModule === 'clock';
    },
    cronometroModuleActive() {
      return this.popupModule === 'cronometro_culto';
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
    // Mesmo critério de "ativo" usado pela janela de saída (Popup.vue) +
    // popup_module==='media' pra garantir que não fica com o slide antigo
    // ainda marcado como "show" enquanto outro módulo (relógio/cronômetro)
    // passou a ser o que está realmente projetado.
    mediaActive() {
      return this.popupModule === 'media' && (this.mediaShow || this.mediaMinimized);
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

  mounted() {
    // Transparência global (mesmo padrão de Popup.vue) — sem isso, o fundo
    // escuro padrão do tema (Vuetify) aparecia atrás da janela transparente
    // enquanto nenhuma música toca (visible=false), em vez de ficar limpo.
    const style = document.createElement('style');
    style.id = 'return-screen-transparent';
    style.textContent = `
      html, body, #app, #app-container,
      .v-application, .v-application__wrap {
        background: transparent !important;
        background-color: transparent !important;
      }
    `;
    document.head.appendChild(style);

    if (isElectron()) {
      this.initElectron();
    } else {
      this.initBrowser();
    }
    this._tickInterval = setInterval(() => { this.now = new Date(); }, 1000);
    // Início suave: a janela em si entra com fade assim que abre — o slide
    // da música (dentro dela) tem seu próprio fade, controlado por
    // "mediaActive", e o relógio/cronômetro aparecem independente disso.
    this.visible = true;
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
/* Transparente por padrão — só fica preta (visual de monitor de palco)
   quando uma música está de fato ativa (.rs-root--active). O relógio/
   cronômetro tem seu próprio fundo (.rs-widget) e não precisa disso. */
.rs-root {
  position: fixed;
  inset: 0;
  background: transparent;
  transition: background-color 0.4s ease;
  display: flex;
  flex-direction: column;
  font-family: 'DINCondensedBold', 'Roboto Condensed', 'Arial Narrow', Arial, sans-serif;
  overflow: hidden;
  user-select: none;
}
.rs-root--active {
  background: #000;
}

.rs-slide {
  display: flex;
  flex-direction: column;
  flex: 1;
  min-height: 0;
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

/* ── Espelho dos módulos Relógio / Cronômetro de Culto ──────────── */
/* Preenche a tela toda — cada módulo já desenha seu próprio fundo/fonte/cor
   configurados (Screen.vue de cada um), então isso só posiciona e garante
   que fique por cima caso o bloco do slide ainda esteja saindo do fade. */
.rs-module-mirror {
  position: absolute;
  inset: 0;
  z-index: 2;
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
