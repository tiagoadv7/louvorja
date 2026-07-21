<template>
  <!-- Modo roleta -->
  <div v-if="isRoulette" class="rp-root" :style="bgStyle">

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
    <div class="rp-wheel-area">
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
          <div v-if="currentWinner" class="rp-winner-name" :style="winnerNameStyle">
            {{ currentWinner }}
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

    <!-- Confetti -->
    <div v-if="currentWinner" class="rp-confetti-wrap" aria-hidden="true">
      <div v-for="i in 50" :key="i" class="rp-confetti" :style="getConfettiStyle(i)" />
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

const CONFETTI_COLORS = [
  '#FF6B6B', '#4ECDC4', '#5B9BD5', '#FDCB6E',
  '#A29BFE', '#FD79A8', '#0984E3', '#6C5CE7',
];

export default {
  name: "SorteioPopup",
  components: { Screen, RouletteWheel },

  data: () => ({
    localItems:    [],
    currentWinner: null,
    _lastSpinId:   0,
    _spinTimer:    null,
    _winnerTimer:  null,
  }),

  computed: {
    module_id() { return manifest.id; },
    module()     { return this.$modules.get(this.module_id); },

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

    winnerNameStyle() {
      return { color: this.fontColor };
    },

    panelBorderStyle() {
      return { borderColor: `${this.fontColor}33` };
    },

    panelHeaderStyle() {
      return { color: this.fontColor, opacity: 0.7 };
    },

    chipStyle() {
      return { background: `${this.fontColor}18`, color: this.fontColor };
    },

    chipDrawnStyle() {
      return { background: `${this.fontColor}0a`, color: this.fontColor, opacity: 0.4, textDecoration: 'line-through' };
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
  },

  methods: {
    onWheelWinner(winner) {
      this.currentWinner = winner;
      if (this._winnerTimer) clearTimeout(this._winnerTimer);
      this._winnerTimer = setTimeout(() => { this.currentWinner = null; }, 3000);
    },

    getConfettiStyle(i) {
      const color = CONFETTI_COLORS[(i - 1) % CONFETTI_COLORS.length];
      const angle = ((i - 1) / 50) * 360;
      const delay = ((i - 1) % 10) * 0.05;
      const size  = 6 + (i % 5) * 4;
      const dist  = 150 + (i % 4) * 70;
      return {
        background: color,
        width:  size + 'px',
        height: size + 'px',
        '--ca':    angle + 'deg',
        '--dist':  dist  + 'px',
        '--delay': delay + 's',
      };
    },
  },

  beforeUnmount() {
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
}

/* Roda: quadrado que preenche o espaço disponível */
.rp-wheel-wrap {
  position: relative;
  width: 100%;
  height: 100%;
}

/* Nome do vencedor — overlay centralizado sobre a roda */
.rp-winner-name {
  position: absolute;
  top: 50%;
  left: 50%;
  transform: translate(-50%, -50%);
  z-index: 15;
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
  pointer-events: none;
  white-space: nowrap;
}

/* Confetti */
.rp-confetti-wrap {
  position: fixed;
  inset: 0;
  pointer-events: none;
  z-index: 10;
  display: flex;
  align-items: center;
  justify-content: center;
}
.rp-confetti {
  position: absolute;
  border-radius: 50%;
  animation: rp-burst 2.2s var(--delay, 0s) cubic-bezier(0.22, 0.61, 0.36, 1) forwards;
}
@keyframes rp-burst {
  0%   { transform: rotate(var(--ca)) translateY(0) scale(1);          opacity: 1; }
  70%  { opacity: 1; }
  100% { transform: rotate(var(--ca)) translateY(calc(-1 * var(--dist, 160px))) scale(0.3); opacity: 0; }
}

/* Transições do vencedor */
.rp-winner-enter-active { animation: rp-in  0.55s cubic-bezier(0.34,1.56,0.64,1) forwards; }
.rp-winner-leave-active  { animation: rp-out 0.30s ease forwards; }
@keyframes rp-in  { from { opacity: 0; transform: translate(-50%, -50%) scale(0.78); } to { opacity: 1; transform: translate(-50%, -50%) scale(1); } }
@keyframes rp-out { from { opacity: 1; transform: translate(-50%, -50%); } to { opacity: 0; transform: translate(-50%, -50%); } }
</style>
