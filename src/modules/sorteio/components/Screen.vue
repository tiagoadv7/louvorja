<template>
  <transition name="sr-visibility">
  <div v-if="isActive" ref="container" class="sorteio-screen" :style="containerStyle">
    <AnimatedBackground v-if="animatedBg !== 'none'" :variant="animatedBg" :color="animatedBgColor" />
    <!-- Imagem de fundo -->
    <img
      v-if="userdata.image"
      :src="userdata.image"
      :style="{
        top: 0,
        left: 0,
        width: '100%',
        height: '100%',
        position: 'absolute',
        objectFit: userdata.image_fit || 'cover',
        opacity: (userdata.image_opacity ?? 100) / 100,
        zIndex: 0,
      }"
    />

    <!-- Painel esquerdo -->
    <div v-if="showLeftPanel" class="sorteio-panel" :style="panelBorderStyle">
      <div class="sorteio-panel__header" :style="panelHeaderStyle">
        <v-icon size="14" class="mr-1" :color="fontColor">{{ isNamesMode ? "mdi-format-text" : "mdi-pound" }}</v-icon>
        {{ leftPanelTitle }}
      </div>
      <div class="sorteio-panel__content sorteio-panel__content--column">
        <span
          v-for="(item, i) in leftPanelItems"
          :key="i"
          class="sorteio-chip"
          :style="chipStyle"
        >
          {{ item }}
        </span>
        <!-- Tela do operador: avisa que acabou a lista -->
        <span v-if="overridePanels && leftPanelItems.length === 0" class="sorteio-panel__empty" :style="{ color: fontColor }">
          {{ emptyLeftText }}
        </span>
      </div>
    </div>

    <!-- Centro: display do sorteado atual -->
    <div ref="center" class="sorteio-center" :style="{ padding: `${borderSpacing}px` }">
      <div class="sorteio-result">
        <div v-if="isRevealed" :key="'lbl' + revealId" class="sorteio-winner-label" :style="labelStyle">
          {{ winnerLabel }}
        </div>
        <!-- Depois do sorteio, o resultado continua "vivo": flutua de leve e
             o brilho pulsa (sorteio-alive); girando, ele treme (sorteio-rolling). -->
        <div :class="{ 'sorteio-alive': isRevealed || showFim, 'sorteio-rolling': isAnimating }">
          <span
            :key="showFim ? 'fim' : revealId"
            :style="numberStyle"
            :class="{
              'sorteio-animating': isAnimating,
              'sorteio-reveal-anim': isRevealed,
              'sorteio-fim-anim': showFim,
            }"
          >
            {{ displayCurrent }}
          </span>
        </div>
      </div>
    </div>

    <!-- Confete: helpers/Confetti.js (canvas-confetti, efeito do Preline),
         disparado a cada novo sorteado — o canvas fica dentro desta tela. -->

    <!-- Painel direito -->
    <div v-if="showRightPanel" class="sorteio-panel sorteio-panel--right" :style="panelBorderStyle">
      <div class="sorteio-panel__header" :style="panelHeaderStyle">
        <v-icon size="14" class="mr-1" :color="fontColor">mdi-history</v-icon>
        {{ rightPanelTitle }}
      </div>
      <div class="sorteio-panel__content sorteio-panel__content--column">
        <span
          v-for="(item, i) in rightPanelItems"
          :key="i === 0 ? 'latest-' + revealId : i"
          class="sorteio-chip"
          :class="{ 'sorteio-chip--latest': i === 0 }"
          :style="i === 0 ? chipLatestStyle : chipStyle"
        >
          {{ item }}
        </span>
      </div>
    </div>
  </div>
  </transition>
</template>

<script>
import manifest from "../manifest.json";
import pt from "../lang/pt.json";
import AnimatedBackground from "@/components/AnimatedBackground.vue";
import $confetti from "@/helpers/Confetti";

export default {
  name: "SorteioScreen",
  components: { AnimatedBackground },
  props: {
    overridePanels: {
      type: Boolean,
      default: false,
    },
  },
  data: () => ({
    s_width: 0,
    s_height: 0,
    c_width: 0,
    rollValue: null,
  }),
  computed: {
    module_id() {
      return manifest.id;
    },
    // Fechar o painel do operador esconde o conteúdo na janela de saída
    // (fica só a janela transparente), sem afetar o painel do próprio
    // operador nem o estado "minimizado".
    isActive() {
      return !!this.$appdata.get(`modules.${this.module_id}.show`) || !!this.$appdata.get(`modules.${this.module_id}.minimized`);
    },
    module() {
      return this.$modules.get(this.module_id);
    },
    userdata() {
      return new Proxy(
        {},
        {
          get: (_, key) => this.$userdata.get(`modules.${this.module.id}.${key}`, null),
          set: (_, key, value) => {
            this.$userdata.set(`modules.${this.module.id}.${key}`, value);
            return true;
          },
        },
      );
    },
    appdata() {
      return new Proxy(
        {},
        {
          get: (_, key) => this.$appdata.get(`modules.${this.module.id}.${key}`, null),
          set: (_, key, value) => {
            this.$appdata.set(`modules.${this.module.id}.${key}`, value);
            return true;
          },
        },
      );
    },

    isNamesMode() {
      return (this.appdata.active_tab || "numbers") === "names";
    },
    isAnimating() {
      return this.appdata.animating || false;
    },

    // Painéis visíveis
    showLeftPanel() {
      return this.overridePanels || this.userdata.show_numbers !== false;
    },
    showRightPanel() {
      return this.overridePanels || this.userdata.show_drawn !== false;
    },

    // Itens dos painéis conforme o modo
    leftPanelItems() {
      if (this.isNamesMode) {
        return this.appdata.names_available || [];
      }
      return [...(this.appdata.available || [])].sort((a, b) => a - b);
    },
    rightPanelItems() {
      if (this.isNamesMode) {
        return this.appdata.names_drawn || [];
      }
      return this.appdata.drawn || [];
    },

    // Títulos dos painéis
    leftPanelTitle() {
      const key = this.isNamesMode ? "names_title" : "numbers_title";
      const i18nKey = `modules.${this.module_id}.${key}`;
      const result = this.$t(i18nKey);
      return result !== i18nKey ? result : (pt[key] || key);
    },
    rightPanelTitle() {
      const key = this.isNamesMode ? "names_drawn_title" : "drawn_title";
      const i18nKey = `modules.${this.module_id}.${key}`;
      const result = this.$t(i18nKey);
      return result !== i18nKey ? result : (pt[key] || key);
    },

    // Valor exibido no centro
    padLength() {
      return Math.max(4, (this.userdata.final || 100).toString().length);
    },
    displayCurrent() {
      if (this.showFim) return "Fim!";
      // Girando: valor calculado aqui mesmo (ver runRoll), igual em todas as telas
      if (this.isAnimating && this.rollValue !== null) return this.rollValue;
      if (this.isNamesMode) {
        return this.appdata.names_current || "-------";
      }
      const val = this.appdata.current;
      if (!val) return "0".repeat(this.padLength);
      return val;
    },

    revealId() { return this.appdata.reveal_id || 0; },
    isRevealed() {
      return !this.isAnimating && !this.showFim && this.revealId > 0;
    },
    winnerLabel() {
      const i18nKey = `modules.${this.module_id}.winner_label`;
      const result = this.$t(i18nKey);
      return result !== i18nKey ? result : (pt.winner_label || i18nKey);
    },

    // Estilos
    bgColor() {
      return this.userdata.background_color || this.$vuetify.theme.global.current?.colors?.primary || '#1b2a41';
    },
    fontColor() { return this.userdata.font_color || this.$vuetify.theme.global.current?.colors?.['on-primary'] || '#FFFFFF'; },
    font() { return this.userdata.font || "Arial, sans-serif"; },
    fontSizePx() {
      const pc = this.userdata.font_size || 30;
      const v = Math.min(this.s_width, this.s_height);
      return (pc * v) / 100 / 2;
    },
    // Número/nome sempre numa linha só: se não couber na largura, a fonte
    // diminui até caber (medida com canvas, sem mexer no layout). Girando no
    // modo Nomes, usa o maior nome da lista, para o tamanho não ficar pulando.
    fittedFontSizePx() {
      const base = this.fontSizePx;
      const avail = (this.c_width - 2 * this.borderSpacing) * 0.9;
      if (!base || avail <= 0) return base;
      let texts = [String(this.displayCurrent ?? "")];
      if (this.isAnimating && this.isNamesMode) {
        texts = (this.appdata.names_available || []).map(String);
      }
      const w = Math.max(0, ...texts.map((t) => this.measureText(t, base)));
      return w > avail ? Math.max(8, base * (avail / w)) : base;
    },
    borderSpacing() { return this.userdata.border_spacing || 10; },
    panelFontSizePx() { return this.userdata.panel_font_size || 14; },
    // Tamanho do "SORTEADO(A)" (Personalizar > Texto > Tamanho do título),
    // proporcional à tela como o número — 20 ≈ 20 px na prévia, maior na projeção.
    labelFontSizePx() {
      const v = Math.min(this.s_width, this.s_height) || 400;
      return Math.max(10, ((this.userdata.label_font_size || 20) * v) / 400);
    },
    labelStyle() {
      return { color: this.fontColor, fontSize: `${this.labelFontSizePx}px`, fontFamily: this.font };
    },
    animatedBg() { return this.userdata.animated_bg || "none"; },
    animatedBgColor() { return this.userdata.animated_bg_color || "#7aa0ff"; },

    containerStyle() {
      return {
        background: this.bgColor,
        color: this.fontColor,
        display: "flex",
        width: "100%",
        height: "100%",
        overflow: "hidden",
        position: "relative",
      };
    },
    panelBorderStyle() {
      return { borderColor: `${this.fontColor}33`, zIndex: 1 };
    },
    panelHeaderStyle() {
      return { color: this.fontColor };
    },
    numberStyle() {
      return {
        fontSize: `${this.fittedFontSizePx}px`,
        color: this.fontColor,
        fontWeight: "bold",
        whiteSpace: "nowrap",
        // Fonte escolhida em Personalizar (antes os números eram sempre
        // monospace); tabular-nums mantém os dígitos com a mesma largura.
        fontFamily: this.font,
        fontVariantNumeric: "tabular-nums",
        letterSpacing: this.isNamesMode ? "normal" : "0.05em",
        userSelect: "none",
        zIndex: 1,
        position: "relative",
        textAlign: "center",
        maxWidth: "none",
        // Sem quebra de linha: quem garante que cabe é fittedFontSizePx.
        display: "inline-block",
      };
    },
    chipStyle() {
      return { background: `${this.fontColor}18`, color: this.fontColor, fontSize: `${this.panelFontSizePx}px`, fontFamily: this.font };
    },
    chipLatestStyle() {
      // Último sorteado em destaque: maior que os demais da lista
      return {
        background: `${this.fontColor}40`,
        color: this.fontColor,
        fontWeight: "bold",
        fontFamily: this.font,
        fontSize: `${Math.round(this.panelFontSizePx * 1.8)}px`,
        padding: "0.15em 0.4em",
        marginBottom: "4px",
        boxShadow: `0 0 0 2px ${this.fontColor}66`,
      };
    },
    // "Fim!" só enquanto a lista do modo atual estiver vazia (adicionar
    // nomes/números ou trocar de aba já volta ao normal)
    showFim() {
      return this.appdata.fim === true && this.leftPanelItems.length === 0;
    },
    emptyLeftText() {
      const key = this.isNamesMode ? "none_left_names" : "none_left_numbers";
      const i18nKey = `modules.${this.module_id}.${key}`;
      const result = this.$t(i18nKey);
      return result !== i18nKey ? result : (pt[key] || key);
    },
    drawAnim() {
      return this.appdata.draw_anim || null;
    },
  },
  watch: {
    // Começou um sorteio (Index.vue#draw): anima aqui, pelo relógio
    drawAnim(anim) {
      if (anim && anim.id) this.runRoll(anim);
      else this.stopRoll();
    },
    // Dispara o confete a cada novo sorteado (números/nomes), igual ao
    // "showConfetti" de RouletteWheel.vue — some sozinho depois de um tempo.
    revealId(val) {
      if (val > 0 && !this.showFim) {
        this.$nextTick(() => $confetti.burst(this.$refs.container));
      }
    },
  },
  methods: {
    // Mesma sequência em todas as telas: os instantes de troca seguem a mesma
    // curva (rápido no começo, desacelerando — 12 ms + 100 ms × progresso²)
    // e o item de cada troca vem de um sorteio "com semente" (id + índice),
    // então prévia e projeção mostram os mesmos números ao mesmo tempo. Se
    // uma tela recebe o aviso alguns ms depois, ela se acerta pelo horário.
    runRoll(anim) {
      this.stopRoll();
      const pool = anim.mode === "names"
        ? [...(this.appdata.names_available || [])]
        : [...(this.appdata.available || [])];
      if (!pool.length) return;
      // Sobrou só 1 ou 2: a animação ficaria parada no mesmo nome/número —
      // gira também pelos já sorteados (só visual; o sorteado sai do pool).
      if (pool.length < 3) {
        const drawn = anim.mode === "names" ? (this.appdata.names_drawn || []) : (this.appdata.drawn || []);
        for (const d of drawn) if (!pool.includes(d)) pool.push(d);
      }
      const ticks = [];
      for (let t = 0; t < anim.duration;) {
        ticks.push(t);
        const p = Math.min(t / anim.duration, 1);
        t += 12 + 100 * p * p;
      }
      const pick = (i) => {
        let x = (Math.floor(anim.id % 2147483647) + i * 2654435761) >>> 0;
        x ^= x << 13; x >>>= 0; x ^= x >>> 17; x ^= x << 5; x >>>= 0;
        return pool[x % pool.length];
      };
      const fmt = (v) => (anim.mode === "names" ? v : String(v).padStart(this.padLength, "0"));
      let idx = -1;
      const step = () => {
        const elapsed = Date.now() - anim.start;
        if (elapsed >= anim.duration) { this._rollRaf = null; return; }
        let k = idx < 0 ? 0 : idx;
        while (k + 1 < ticks.length && ticks[k + 1] <= elapsed) k++;
        if (k !== idx) { idx = k; this.rollValue = fmt(pick(k)); }
        this._rollRaf = requestAnimationFrame(step);
      };
      step();
    },
    stopRoll() {
      if (this._rollRaf) cancelAnimationFrame(this._rollRaf);
      this._rollRaf = null;
      this.rollValue = null;
    },
    measureText(text, size) {
      if (!text) return 0;
      const ctx = (this._measureCtx ||= document.createElement("canvas").getContext("2d"));
      ctx.font = `bold ${size}px ${this.font}`;
      const spacing = this.isNamesMode ? 0 : 0.05 * size * text.length;
      return ctx.measureText(text).width + spacing;
    },
    observeCenter() {
      if (!this._ro) return;
      this._ro.disconnect();
      if (this.$refs.center) this._ro.observe(this.$refs.center);
      if (this.$refs.container) this._ro.observe(this.$refs.container);
      this.windowResize();
    },
    windowResize() {
      const container = this.$refs.container;
      if (this.$refs.center) this.c_width = this.$refs.center.clientWidth;
      if (container) {
        this.s_width = container.offsetWidth;
        this.s_height = container.offsetHeight;
        if (this.s_width <= 0 || this.s_height <= 0) {
          setTimeout(() => this.windowResize(), 100);
        }
      }
    },
  },
  mounted() {
    if (this.drawAnim && this.drawAnim.id) this.runRoll(this.drawAnim);
    this.windowResize();
    window.addEventListener("resize", this.windowResize);
    // Painéis laterais ligando/desligando mudam a largura do centro sem
    // "resize" da janela — observa o próprio container.
    if (window.ResizeObserver) {
      this._ro = new ResizeObserver(() => this.windowResize());
      this.$watch(() => this.isActive, () => this.$nextTick(() => this.observeCenter()), { immediate: true });
    }
  },
  unmounted() {
    window.removeEventListener("resize", this.windowResize);
    if (this._ro) this._ro.disconnect();
    this.stopRoll();
    $confetti.clear(this.$refs.container);
  },
};
</script>

<style scoped>
.sr-visibility-enter-active,
.sr-visibility-leave-active {
  transition: opacity 0.4s ease;
}
.sr-visibility-enter-from,
.sr-visibility-leave-to {
  opacity: 0;
}
.sorteio-screen {
  position: relative;
}

.sorteio-panel {
  width: 210px;
  min-width: 210px;
  height: 100%;
  display: flex;
  flex-direction: column;
  overflow: hidden;
  border-right: 1px solid;
  position: relative;
  z-index: 1;
}
.sorteio-panel--right {
  border-right: none;
  border-left: 1px solid;
}

.sorteio-panel__header {
  padding: 10px 12px 8px;
  font-size: 11px;
  font-weight: 600;
  text-transform: uppercase;
  opacity: 0.65;
  letter-spacing: 0.08em;
  border-bottom: 1px solid rgba(255, 255, 255, 0.1);
  display: flex;
  align-items: center;
  flex-shrink: 0;
}

.sorteio-panel__content {
  flex: 1;
  overflow-y: auto;
  padding: 8px;
  display: flex;
  flex-wrap: wrap;
  align-content: flex-start;
  gap: 4px;
}
.sorteio-panel__content--column {
  flex-direction: column;
  flex-wrap: nowrap;
}
.sorteio-panel__content::-webkit-scrollbar { width: 4px; }
.sorteio-panel__content::-webkit-scrollbar-thumb {
  background: rgba(255, 255, 255, 0.2);
  border-radius: 2px;
}

.sorteio-panel__empty {
  font-size: 13px;
  opacity: 0.55;
  font-style: italic;
  padding: 4px 2px;
}

.sorteio-center {
  flex: 1;
  display: flex;
  align-items: center;
  justify-content: center;
  min-width: 0;
  z-index: 1;
}

.sorteio-result {
  display: flex;
  flex-direction: column;
  align-items: center;
  max-width: 100%;
}

.sorteio-winner-label {
  font-weight: 700;
  letter-spacing: 0.20em;
  text-transform: uppercase;
  opacity: 0.85;
  margin-bottom: 0.3em;
  line-height: 1.1;
  text-align: center;
  /* Entra com "salto" e depois fica pulsando de leve enquanto o sorteado
     está na tela */
  animation:
    sorteio-label-in 0.45s cubic-bezier(0.34, 1.56, 0.64, 1) both,
    sorteio-label-pulse 2.2s ease-in-out 0.6s infinite;
}
@keyframes sorteio-label-in {
  from { opacity: 0; transform: translateY(10px) scale(0.8); }
  to   { opacity: 0.85; transform: translateY(0) scale(1); }
}
@keyframes sorteio-label-pulse {
  0%, 100% { opacity: 0.85; transform: scale(1); letter-spacing: 0.20em; }
  50%      { opacity: 1;    transform: scale(1.06); letter-spacing: 0.26em; }
}

/* Resultado "vivo" depois do sorteio: flutua e o brilho pulsa */
.sorteio-alive {
  animation:
    sorteio-float 3.2s ease-in-out 0.5s infinite,
    sorteio-glow 2.4s ease-in-out 0.5s infinite;
}
@keyframes sorteio-float {
  0%, 100% { transform: translateY(0); }
  50%      { transform: translateY(-2.5%); }
}
@keyframes sorteio-glow {
  0%, 100% { filter: drop-shadow(0 0 0 rgba(255, 255, 255, 0)); }
  50%      { filter: drop-shadow(0 0 18px rgba(255, 255, 255, 0.55)); }
}
/* Girando: tremida rápida */
.sorteio-rolling {
  animation: sorteio-roll 0.18s ease-in-out infinite;
}
@keyframes sorteio-roll {
  0%, 100% { transform: scale(1) rotate(0deg); }
  25%      { transform: scale(1.03) rotate(-1deg); }
  75%      { transform: scale(0.98) rotate(1deg); }
}
/* Último sorteado na lista: entra com destaque */
.sorteio-chip--latest {
  animation: sorteio-chip-pop 0.6s cubic-bezier(0.34, 1.56, 0.64, 1) both;
}
@keyframes sorteio-chip-pop {
  0%   { transform: scale(0.4); opacity: 0; }
  70%  { transform: scale(1.12); opacity: 1; }
  100% { transform: scale(1); }
}

.sorteio-chip {
  display: inline-block;
  padding: 2px 7px;
  border-radius: 4px;
  font-variant-numeric: tabular-nums;
  /* Antes: nowrap + ellipsis — um nome grande na lista lateral (ainda mais
     com "Tamanho do Texto" aumentado) cortava com "..." em vez de quebrar
     linha, escondendo o resto do nome. Números continuam curtos o bastante
     pra nunca precisar quebrar, então isso não muda nada pro modo Números. */
  white-space: normal;
  word-break: break-word;
  overflow-wrap: break-word;
  max-width: 100%;
}

.sorteio-animating {
  opacity: 0.85;
}

.sorteio-reveal-anim {
  animation: sorteio-reveal 0.45s cubic-bezier(0.34, 1.56, 0.64, 1) forwards;
}

@keyframes sorteio-reveal {
  0%   { transform: scale(0.6) translateY(12px); opacity: 0.2; }
  65%  { transform: scale(1.06) translateY(-3px); opacity: 1; }
  82%  { transform: scale(0.98) translateY(0); }
  100% { transform: scale(1)    translateY(0); opacity: 1; }
}

.sorteio-fim-anim {
  animation: sorteio-fim 0.6s cubic-bezier(0.34, 1.56, 0.64, 1) forwards;
}

@keyframes sorteio-fim {
  0%   { transform: scale(0.2); opacity: 0; }
  60%  { transform: scale(1.12); opacity: 1; }
  78%  { transform: scale(0.96); }
  90%  { transform: scale(1.04); }
  100% { transform: scale(1);    opacity: 1; }
}

</style>
