<template>
  <transition name="rs-fade" appear>
    <div v-if="visible" class="rs-root" :class="{ 'rs-root--active': mediaActive || clockModuleActive || cronometroModuleActive || stopwatchModuleActive || videoPlayerActive }">
      <!-- Conteúdo do slide (letra/título, barras de progresso) — só aparece
           junto com uma música realmente ativa; some com fade quando ela
           termina. -->
      <transition name="rs-fade">
        <div v-if="mediaActive" class="rs-slide">
          <!-- Barra de progresso da faixa (topo) -->
          <div class="rs-track-bar">
            <div class="rs-track-fill" :style="{ width: trackProgress + '%' }" />
          </div>

          <!-- Área principal: letra / título atual.
               Cada troca de linha empilha um novo "textSlides[1]" (mesmo
               padrão de src/components/Slide.vue: slides.unshift + active/
               destroy) — o <transition> anima o crossfade real entre a linha
               que sai e a que entra, em vez de só trocar o texto no lugar. -->
          <div class="rs-main">
            <transition
              name="rs-text-fade"
              v-for="(slide, index) in textSlides.slice().reverse()"
              :key="'rstxt-' + index"
            >
              <div v-if="!slide.destroy" v-show="slide.active" class="rs-main-text-layer">
                <div
                  v-if="slide.lyric"
                  class="rs-main-text"
                  :class="{ 'rs-main-cover': slide.cover }"
                  :style="{ color: mainTextColorFor(slide), fontFamily }"
                  v-html="slide.lyric"
                />
                <v-icon v-else size="96" color="rgba(255,255,255,0.10)">mdi-music-note</v-icon>
              </div>
            </transition>

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

      <!-- Idem para o Cronômetro (avulso/manual). -->
      <transition name="rs-fade">
        <div v-if="stopwatchModuleActive" class="rs-module-mirror">
          <StopwatchScreen />
        </div>
      </transition>

      <!-- Espelho do módulo Vídeo (vídeo/imagem, sempre mudo — ver
           video_player/components/Screen.vue). Igual ao Relógio/Cronômetro,
           "return_popup_module" permite manter o vídeo no retorno mesmo que
           o operador já tenha desligado a projeção principal (ver
           components/buttons/Screen.vue#popup, que só limpa popup_module,
           sem mexer na config do vídeo). -->
      <transition name="rs-fade">
        <div v-if="videoPlayerActive" class="rs-module-mirror">
          <VideoPlayerScreen />
        </div>
      </transition>
    </div>
  </transition>
</template>

<script>
import ClockScreen from '@/modules/clock/components/Screen.vue';
import CronometroScreen from '@/modules/cronometro_culto/components/Screen.vue';
import StopwatchScreen from '@/modules/stopwatch/components/Screen.vue';
import VideoPlayerScreen from '@/modules/video_player/components/Screen.vue';

const isElectron = () =>
  typeof window !== 'undefined' &&
  typeof window.electron !== 'undefined' &&
  navigator.userAgent.includes('Electron');

export default {
  name: 'ReturnScreen',
  components: { ClockScreen, CronometroScreen, StopwatchScreen, VideoPlayerScreen },

  data: () => ({
    stateHandler: null,
    batchHandler: null,
    closingHandler: null,
    visible: false,
    now: new Date(),
    _tickInterval: null,
    // Pilha de linhas do texto principal — mesmo padrão de src/components/Slide.vue
    // (slides.unshift + active/destroy), pra permitir o crossfade real entre a
    // linha que sai e a que entra em vez de só trocar o texto no lugar.
    textSlides: [{}, {}],
    repeat: false,
  }),

  computed: {
    // "popup_module" é a mesma chave que a janela de saída usa pra decidir
    // qual módulo está projetado agora (ver views/Popup.vue) — o retorno usa
    // ela pra espelhar exatamente o que está sendo exibido, um de cada vez.
    popupModule() {
      return this.$appdata.get('popup_module');
    },
    // "return_popup_module" é setado pelo botão "Enviar para o retorno" do
    // próprio módulo (Relógio/Cronômetro) — manda ele pro retorno mesmo que
    // não esteja projetado na saída principal. Quando presente, tem
    // prioridade sobre o espelhamento automático do popup_module (senão os
    // dois poderiam ficar ativos ao mesmo tempo e sobrepor o mirror).
    returnPopupModule() {
      return this.$appdata.get('return_popup_module');
    },
    clockModuleActive() {
      if (this.returnPopupModule) return this.returnPopupModule === 'clock';
      return this.popupModule === 'clock';
    },
    cronometroModuleActive() {
      if (this.returnPopupModule) return this.returnPopupModule === 'cronometro_culto';
      return this.popupModule === 'cronometro_culto';
    },
    stopwatchModuleActive() {
      if (this.returnPopupModule) return this.returnPopupModule === 'stopwatch';
      return this.popupModule === 'stopwatch';
    },
    videoPlayerActive() {
      if (this.returnPopupModule) return this.returnPopupModule === 'video_player';
      return this.popupModule === 'video_player';
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
    // passou a ser o que está realmente projetado. Também aceita o mesmo
    // "forçar para o retorno" (return_popup_module) que Relógio/Cronômetro
    // já usam — permite manter a música no retorno mesmo se outro módulo
    // virar o popup_module da saída principal.
    mediaActive() {
      if (this.returnPopupModule) {
        return this.returnPopupModule === 'media' && (this.mediaShow || this.mediaMinimized);
      }
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

    // Snapshot mínimo do slide atual — o watcher abaixo reage a mudanças
    // dele pra empilhar uma nova linha em textSlides (ver pushTextSlide()).
    slideSnapshot() {
      return { lyric: this.displayText, cover: this.isCover };
    },

    // "Fundo Personalizado" (mesma chave slide_global_bg que src/components/
    // Slide.vue lê) — usado aqui só pra herdar cor/fonte do texto, igual ao
    // que a tela de saída (slide) mostra. O retorno mantém seu próprio fundo
    // preto de propósito (monitor de palco), só o texto acompanha.
    globalBg() {
      return this.$appdata.get('slide_global_bg') || null;
    },
    fontFamily() {
      return this.globalBg?.font || "'DINCondensedBold', 'Roboto Condensed', 'Arial Narrow', Arial, sans-serif";
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

  watch: {
    slideSnapshot(newVal, oldVal) {
      this.pushTextSlide(newVal, oldVal);
    },
  },

  methods: {
    // Empilha a nova linha em textSlides — mesmo padrão de setSlide() em
    // src/components/Slide.vue: marca a anterior inativa (dispara o fade de
    // saída), ativa a nova (fade de entrada) e destrói as antigas demais.
    // "repeat" alterna quando a mesma linha se repete em sequência (ex.:
    // coro repetido), pra usar a cor de repetição em vez da cor normal —
    // igual à lógica de repeat em Slide.vue.
    pushTextSlide(newVal, oldVal) {
      if (oldVal && newVal.lyric === oldVal.lyric && newVal.cover === oldVal.cover) {
        this.repeat = !this.repeat;
      } else {
        this.repeat = false;
      }

      this.textSlides.unshift({});
      if (this.textSlides[2] && this.textSlides[2].active) {
        this.textSlides[2] = { ...this.textSlides[2], active: false };
      }
      this.textSlides[1] = { ...newVal, active: true };
      if (this.textSlides.length > 3) {
        this.textSlides[3].destroy = true;
      }
    },

    // Cor do texto principal pro slide dado — mesma lógica/mesmos padrões de
    // cor de src/components/Slide.vue#style_text() (capa/repetição/normal),
    // lendo do mesmo "Fundo Personalizado" (globalBg) que a tela de saída usa.
    mainTextColorFor(slide) {
      const bg = this.globalBg;
      if (slide?.cover)  return bg?.cover_font_color  || bg?.font_color || 'rgb(246, 195, 42)';
      if (this.repeat)   return bg?.repeat_font_color || bg?.font_color || 'rgb(246, 195, 42)';
      return bg?.font_color || 'rgb(255, 255, 255)';
    },

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

      // Só dispara quando o retorno é fechado explicitamente (return:close) —
      // fechar a saída principal (output:close) NÃO derruba mais o retorno
      // em cascata, já que os dois são independentes (ver electron/main.js).
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

    // Mesmo padrão de Popup.vue#handleKeyDown — fecha a janela quando ELA
    // está com o foco (ex.: usuário clicou no monitor de palco e apertou ESC).
    // O fade em si já é feito pelo próprio return:close (envia "return-closing"
    // antes de destruir a janela — ver initElectron acima e electron/main.js).
    handleKeyDown(e) {
      if (e.key === 'Escape' && isElectron()) {
        window.electron.closeReturnScreen();
      }
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
    document.addEventListener('keydown', this.handleKeyDown);
  },
  beforeUnmount() {
    clearInterval(this._tickInterval);
    document.removeEventListener('keydown', this.handleKeyDown);
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
/* Camada absoluta por linha — empilhadas em textSlides pra permitir o
   crossfade real entre a linha que sai e a que entra (ver .rs-text-fade-*
   abaixo), mesmo padrão posicional de src/components/Slide.vue. */
.rs-main-text-layer {
  position: absolute;
  inset: 0;
  display: flex;
  align-items: center;
  justify-content: center;
}
.rs-main-text {
  font-size: clamp(38px, 11vh, 148px);
  font-weight: 900;
  text-align: center;
  text-transform: uppercase;
  /* cor e fonte vêm de :style (mainTextColorFor/fontFamily) — mesmas cores
     e fonte que o "Fundo Personalizado" aplica na tela de saída (slide) */
  line-height: 1.15;
  letter-spacing: 0.01em;
}

/* ── Crossfade entre linhas (mesma duração/easing do .fade de Slide.vue) ── */
.rs-text-fade-enter-active,
.rs-text-fade-leave-active {
  transition: opacity 0.5s ease;
}
.rs-text-fade-enter-from,
.rs-text-fade-leave-to {
  opacity: 0;
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
