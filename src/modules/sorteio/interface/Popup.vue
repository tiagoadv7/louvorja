<template>
  <!-- Modo roleta -->
  <div v-if="isActive && isRoulette" class="rp-root" :style="bgStyle">
    <!-- Imagem de fundo — mesmo padrão de components/Screen.vue (modos
         Números/Nomes), que a Roleta não tinha: sem isso, uma imagem de
         fundo configurada pro módulo Sorteio nunca aparecia na projeção da
         Roleta, só a cor sólida (ou o preto de fallback). -->
    <img
      v-if="userdata.image"
      :src="userdata.image"
      :style="{
        top: 0, left: 0, width: '100%', height: '100%', position: 'absolute',
        objectFit: userdata.image_fit || 'cover',
        opacity: (userdata.image_opacity ?? 100) / 100,
        zIndex: 0,
      }"
    />

    <!-- Painel esquerdo: participantes -->
    <div v-if="showParticipants" class="rp-panel" :style="panelBorderStyle">
      <div class="rp-panel__header" :style="panelHeaderStyle">
        <v-icon size="16" class="mr-1" :color="fontColor">mdi-account-group-outline</v-icon>
        {{ participantsLabel }}
        <span class="rp-panel__count" :style="{ color: fontColor }">{{ rouletteItems.length }}</span>
      </div>
      <div class="rp-panel__content">
        <span
          v-for="(item, i) in rouletteItems"
          :key="i"
          class="rp-chip"
          :class="{ 'rp-chip--drawn': rouletteDrawn.includes(item) }"
          :style="rouletteDrawn.includes(item) ? chipDrawnStyle : chipStyle"
        >{{ item }}</span>
        <span v-if="rouletteItems.length === 0" class="rp-panel__empty" :style="{ color: fontColor }">—</span>
      </div>
    </div>

    <!-- Centro: roda -->
    <!-- Confetti: NÃO tem um wrapper próprio aqui de propósito — RouletteWheel
         já dispara o dele mesmo (ver components/RouletteWheel.vue#showConfetti,
         no evento "winner" abaixo) e usar os dois juntos duplicava a explosão
         de confete pra cada sorteio (dois bursts sobrepostos, com durações
         diferentes — 2s vs os 3s do currentWinner). -->
    <div class="rp-wheel-area" ref="wheelAreaEl">
      <div class="rp-wheel-wrap">
        <RouletteWheel
          ref="rouletteWheel"
          :items="localItems"
          :disabled="true"
          :show-winner-card="false"
          style="width: 100%; height: 100%;"
          @winner="onWheelWinner"
        />
        <transition name="rp-winner">
          <div v-if="currentWinner" class="rp-winner-wrap">
            <div class="rp-winner-label" :style="{ color: fontColor }">{{ winnerLabel }}</div>
            <div class="rp-winner-name" :style="winnerNameStyle">{{ currentWinner }}</div>
          </div>
        </transition>
      </div>
    </div>

    <!-- Painel direito: histórico -->
    <div v-if="showHistory" class="rp-panel rp-panel--right" :style="panelBorderStyle">
      <div class="rp-panel__header" :style="panelHeaderStyle">
        <v-icon size="16" class="mr-1" :color="fontColor">mdi-history</v-icon>
        {{ historyLabel }}
      </div>
      <div class="rp-panel__content">
        <div
          v-for="(item, i) in rouletteDrawn"
          :key="'d' + i"
          class="rp-history-row"
        >
          <span class="rp-history-num" :style="{ color: fontColor }">{{ i + 1 }}.</span>
          <span class="rp-history-text" :style="chipStyle">{{ item }}</span>
        </div>
        <span v-if="rouletteDrawn.length === 0" class="rp-panel__empty" :style="{ color: fontColor }">—</span>
      </div>
    </div>

  </div>

  <!-- Modo números / nomes -->
  <Screen v-else />
</template>

<script>
import manifest from "../manifest.json";
import Screen from "../components/Screen.vue";
import RouletteWheel from "../components/RouletteWheel.vue";
import pt from "../lang/pt.json";

export default {
  name: "SorteioPopup",
  components: { Screen, RouletteWheel },

  data: () => ({
    localItems:    [],
    currentWinner: null,
    _lastSpinId:   0,
    _spinTimer:    null,
    _winnerTimer:  null,
    // Tamanho medido do container da roda — mesma técnica de Screen.vue
    // (fontSizePx), pra "Tamanho do Texto" também escalar o nome do
    // vencedor projetado no modo roleta, e não só no modo números/nomes.
    rp_width:      0,
    rp_height:     0,
  }),

  computed: {
    module_id() { return manifest.id; },
    module()     { return this.$modules.get(this.module_id); },
    // Fechar o painel do operador esconde o conteúdo na janela de saída
    // (fica só a janela transparente) — o modo "números/nomes" (<Screen>)
    // já cuida disso sozinho; aqui cobre o modo roleta.
    isActive() {
      return !!this.$appdata.get(`modules.${this.module_id}.show`) || !!this.$appdata.get(`modules.${this.module_id}.minimized`);
    },

    appdata() {
      return new Proxy({}, {
        get: (_, key) => this.$appdata.get(`modules.${this.module_id}.${key}`, null),
        set: (_, key, value) => { this.$appdata.set(`modules.${this.module_id}.${key}`, value); return true; },
      });
    },
    userdata() {
      return new Proxy({}, {
        get: (_, key) => this.$userdata.get(`modules.${this.module_id}.${key}`, null),
      });
    },

    isRoulette() {
      return (this.appdata.active_tab || 'numbers') === 'roulette';
    },

    fontColor() {
      return this.userdata.font_color
        || this.$vuetify?.theme?.global?.current?.colors?.['on-primary']
        || '#ffffff';
    },

    bgStyle() {
      const color = this.userdata.background_color
        || this.$vuetify?.theme?.global?.current?.colors?.primary
        || '#1b2a41';
      return { background: color };
    },

    // Mesma fórmula de Screen.vue#fontSizePx (porcentagem do menor lado do
    // container) — antes o modo roleta ignorava "Tamanho do Texto" (font_size)
    // por completo, sempre usando o clamp() fixo do CSS.
    fontSizePx() {
      const pc = this.userdata.font_size || 30;
      const v = Math.min(this.rp_width, this.rp_height);
      if (v <= 0) return 60;
      return (pc * v) / 100 / 2;
    },
    panelFontSizePx() { return this.userdata.panel_font_size || 14; },

    winnerNameStyle() {
      return { color: this.fontColor, fontSize: `${this.fontSizePx}px` };
    },

    panelBorderStyle() {
      return { borderColor: `${this.fontColor}33` };
    },

    panelHeaderStyle() {
      return { color: this.fontColor, opacity: 0.7 };
    },

    chipStyle() {
      return { background: `${this.fontColor}18`, color: this.fontColor, fontSize: `${this.panelFontSizePx}px` };
    },

    chipDrawnStyle() {
      return { background: `${this.fontColor}0a`, color: this.fontColor, opacity: 0.4, textDecoration: 'line-through', fontSize: `${this.panelFontSizePx}px` };
    },

    showParticipants() {
      return this.userdata.roulette_show_participants !== false;
    },

    showHistory() {
      return this.userdata.roulette_show_history !== false;
    },

    rouletteItems()      { return this.appdata.roulette_items || []; },
    rouletteDrawn()      { return this.appdata.roulette_drawn  || []; },
    rouletteRemoveDrawn() { return this.userdata.roulette_remove_drawn !== false; },

    rouletteActiveItems() {
      if (this.rouletteRemoveDrawn) {
        const drawn = new Set(this.rouletteDrawn);
        return this.rouletteItems.filter(i => !drawn.has(i));
      }
      return this.rouletteItems;
    },

    participantsLabel() {
      return pt.roulette_participants || 'Participantes';
    },

    historyLabel() {
      return pt.roulette_history || 'Histórico';
    },

    // Mesmo rótulo mostrado no modo números/nomes (Screen.vue#winnerLabel),
    // pra ficar consistente entre os três modos de sorteio.
    winnerLabel() {
      const i18nKey = `modules.${this.module_id}.winner_label`;
      const result = this.$t(i18nKey);
      return result !== i18nKey ? result : (pt.winner_label || i18nKey);
    },

    _spinId() { return this.appdata.roulette_spin_id || 0; },

  },

  watch: {
    rouletteActiveItems: {
      immediate: true,
      handler(items) {
        if (!this.$refs.rouletteWheel?.spinning) {
          this.localItems = [...items];
        }
      },
    },

    // Sincroniza animação de giro — vencedor só aparece via onWheelWinner
    _spinId(newId) {
      if (newId <= this._lastSpinId) return;
      this._lastSpinId = newId;
      this.currentWinner = null;

      if (this._spinTimer) clearTimeout(this._spinTimer);
      this._spinTimer = setTimeout(() => {
        const winnerIdx = this.appdata.roulette_spin_winner_idx ?? -1;
        const spinItems = this.appdata.roulette_spin_items;
        const duration  = this.appdata.roulette_spin_duration || 7000;
        if (winnerIdx < 0) return;

        if (Array.isArray(spinItems) && spinItems.length > 0) {
          this.localItems = [...spinItems];
        }

        this.$nextTick(() => {
          if (this.$refs.rouletteWheel) {
            this.$refs.rouletteWheel.spinTo(winnerIdx, duration);
          }
        });
      }, 120);
    },

    // "isActive && isRoulette" no template é v-if — o .rp-wheel-area só passa
    // a existir no DOM quando entra no modo roleta, então precisa remedir
    // toda vez que isso acontece (mounted() não roda de novo pra esse
    // subtree, só pro componente inteiro).
    isRoulette(val) {
      if (val) this.$nextTick(() => this.rpWindowResize());
    },
  },

  methods: {
    onWheelWinner(winner) {
      this.currentWinner = winner;
      if (this._winnerTimer) clearTimeout(this._winnerTimer);
      this._winnerTimer = setTimeout(() => { this.currentWinner = null; }, 3000);
    },

    // Mesma técnica de Screen.vue#windowResize.
    rpWindowResize() {
      const el = this.$refs.wheelAreaEl;
      if (el) {
        this.rp_width = el.offsetWidth;
        this.rp_height = el.offsetHeight;
        if (this.rp_width <= 0 || this.rp_height <= 0) {
          setTimeout(() => this.rpWindowResize(), 100);
        }
      }
    },
  },

  mounted() {
    if (this.isRoulette) this.rpWindowResize();
    window.addEventListener('resize', this.rpWindowResize);
  },

  beforeUnmount() {
    window.removeEventListener('resize', this.rpWindowResize);
    if (this._spinTimer)  clearTimeout(this._spinTimer);
    if (this._winnerTimer) clearTimeout(this._winnerTimer);
  },
};
</script>

<style scoped>
.rp-root {
  position: fixed;
  inset: 0;
  display: flex;
  align-items: stretch;
  overflow: hidden;
}

/* Painéis laterais */
.rp-panel {
  width: 22vw;
  min-width: 180px;
  max-width: 320px;
  height: 100%;
  display: flex;
  flex-direction: column;
  overflow: hidden;
  border-right: 1px solid;
  flex-shrink: 0;
  /* position: precisa disso pra ficar por cima da imagem de fundo (acima,
     position:absolute) — sem "position" (static), um elemento fica sempre
     atrás de um irmão posicionado, não importa a ordem no DOM. */
  position: relative;
  z-index: 1;
}
.rp-panel--right {
  border-right: none;
  border-left: 1px solid;
}

.rp-panel__header {
  padding: 14px 16px 10px;
  font-size: 13px;
  font-weight: 700;
  text-transform: uppercase;
  letter-spacing: 0.08em;
  border-bottom: 1px solid rgba(255, 255, 255, 0.1);
  display: flex;
  align-items: center;
  flex-shrink: 0;
}
.rp-panel__count {
  margin-left: auto;
  font-size: 14px;
  font-weight: 700;
}

.rp-panel__content {
  flex: 1;
  overflow-y: auto;
  padding: 10px;
  display: flex;
  flex-direction: column;
  gap: 4px;
}
.rp-panel__content::-webkit-scrollbar { width: 4px; }
.rp-panel__content::-webkit-scrollbar-thumb {
  background: rgba(255, 255, 255, 0.2);
  border-radius: 2px;
}

.rp-panel__empty {
  font-size: 13px;
  opacity: 0.4;
  font-style: italic;
  padding: 4px 2px;
}

.rp-chip {
  display: inline-block;
  padding: 4px 10px;
  border-radius: 6px;
  font-size: 13px;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
  max-width: 100%;
}

.rp-history-row {
  display: flex;
  align-items: center;
  gap: 6px;
  padding: 2px 0;
}
.rp-history-num {
  font-size: 11px;
  opacity: 0.5;
  min-width: 22px;
}
.rp-history-text {
  flex: 1;
  font-size: 13px;
  padding: 4px 10px;
  border-radius: 6px;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

/* Centro: área da roda */
.rp-wheel-area {
  flex: 1;
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 16px;
  position: relative;
  z-index: 1; /* acima da imagem de fundo — ver comentário em .rp-panel */
}

/* Roda: quadrado que preenche o espaço disponível */
.rp-wheel-wrap {
  position: relative;
  width: 100%;
  height: 100%;
}

/* Vencedor — overlay centralizado sobre a roda */
.rp-winner-wrap {
  position: absolute;
  top: 50%;
  left: 50%;
  transform: translate(-50%, -50%);
  z-index: 15;
  display: flex;
  flex-direction: column;
  align-items: center;
  pointer-events: none;
}

.rp-winner-label {
  font-size: clamp(13px, 1.8vw, 22px);
  font-weight: 700;
  letter-spacing: 0.20em;
  text-transform: uppercase;
  opacity: 0.75;
  margin-bottom: 8px;
}

.rp-winner-name {
  font-size: clamp(44px, 8vw, 130px);
  font-weight: 900;
  text-align: center;
  max-width: 90%;
  word-break: break-word;
  line-height: 1.05;
  text-shadow: 0 6px 32px rgba(0, 0, 0, 0.70);
  background: rgba(0, 0, 0, 0.60);
  padding: 16px 40px;
  border-radius: 24px;
  border: 2px solid rgba(255, 255, 255, 0.20);
  white-space: nowrap;
}

/* Confetti: ver comentário no template (Centro: roda) — não tem CSS/wrapper
   próprio aqui de propósito, RouletteWheel já cuida do dele. */

/* Transições do vencedor */
.rp-winner-enter-active { animation: rp-in  0.55s cubic-bezier(0.34,1.56,0.64,1) forwards; }
.rp-winner-leave-active  { animation: rp-out 0.30s ease forwards; }
@keyframes rp-in  { from { opacity: 0; transform: translate(-50%, -50%) scale(0.78); } to { opacity: 1; transform: translate(-50%, -50%) scale(1); } }
@keyframes rp-out { from { opacity: 1; transform: translate(-50%, -50%); } to { opacity: 0; transform: translate(-50%, -50%); } }
</style>
