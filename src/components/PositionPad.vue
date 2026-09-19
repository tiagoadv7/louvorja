<template>
  <div class="pos-pad-wrap">
    <div class="pos-pad-row">
      <div class="pos-pad-vlabels">
        <span>{{ vLabels.start }}</span>
        <span>{{ vLabels.center }}</span>
        <span>{{ vLabels.end }}</span>
      </div>
      <div
        ref="padRef"
        class="pos-pad"
        @pointerdown="onPointerDown"
        @pointermove="onPointerMove"
        @pointerup="onPointerUp"
        @pointercancel="onPointerUp"
      >
        <button
          v-for="cell in cells"
          :key="`${cell.h}-${cell.v}`"
          type="button"
          class="pos-pad__dot"
          :class="{ 'pos-pad__dot--active': cell.h === horizontal && cell.v === vertical }"
          :style="{ left: `${cell.x}%`, top: `${cell.y}%` }"
          :aria-label="`${hLabels[cell.h]} · ${vLabels[cell.v]}`"
          @click="select(cell.h, cell.v)"
        />
        <div class="pos-pad__handle" :style="{ left: `${handlePos.x}%`, top: `${handlePos.y}%` }" />
      </div>
    </div>
    <div class="pos-pad-hlabels">
      <span>{{ hLabels.start }}</span>
      <span>{{ hLabels.center }}</span>
      <span>{{ hLabels.end }}</span>
    </div>
  </div>
</template>

<script>
// Posição da letra em tela — grade 3x3 (Esquerda/Centro/Direita x Em Cima/
// Meio/Em Baixo) que pode ser tanto clicada (cada um dos 9 pontos) quanto
// ARRASTADA (a alça acompanha o ponteiro em tempo real e assume a posição —
// start/center/end — mais próxima em cada eixo, sem precisar soltar
// exatamente em cima de um ponto). Substitui os dois v-btn-toggle
// separados (horizontal/vertical) por um único controle mais direto.
const AXIS_VALUES = ["start", "center", "end"];
const AXIS_PCT = { start: 0, center: 50, end: 100 };

export default {
  name: "PositionPad",
  props: {
    horizontal: { type: String, default: "center" },
    vertical: { type: String, default: "center" },
    // Rótulos customizáveis (i18n) — default em português.
    hLabels: {
      type: Object,
      default: () => ({ start: "Esquerda", center: "Centro", end: "Direita" }),
    },
    vLabels: {
      type: Object,
      default: () => ({ start: "Em Cima", center: "Meio", end: "Em Baixo" }),
    },
  },
  emits: ["update:horizontal", "update:vertical"],
  data: () => ({ dragging: false }),
  computed: {
    cells() {
      const cells = [];
      for (const v of AXIS_VALUES) {
        for (const h of AXIS_VALUES) {
          cells.push({ h, v, x: AXIS_PCT[h], y: AXIS_PCT[v] });
        }
      }
      return cells;
    },
    handlePos() {
      return { x: AXIS_PCT[this.horizontal] ?? 50, y: AXIS_PCT[this.vertical] ?? 50 };
    },
  },
  methods: {
    select(h, v) {
      if (h !== this.horizontal) this.$emit("update:horizontal", h);
      if (v !== this.vertical) this.$emit("update:vertical", v);
    },
    posFromPointer(event) {
      const rect = this.$refs.padRef?.getBoundingClientRect();
      if (!rect) return null;
      const px = ((event.clientX - rect.left) / rect.width) * 100;
      const py = ((event.clientY - rect.top) / rect.height) * 100;
      const axis = (pct) => (pct < 33.33 ? "start" : pct < 66.66 ? "center" : "end");
      return { h: axis(Math.max(0, Math.min(100, px))), v: axis(Math.max(0, Math.min(100, py))) };
    },
    onPointerDown(event) {
      event.currentTarget.setPointerCapture?.(event.pointerId);
      this.dragging = true;
      const pos = this.posFromPointer(event);
      if (pos) this.select(pos.h, pos.v);
    },
    onPointerMove(event) {
      if (!this.dragging) return;
      const pos = this.posFromPointer(event);
      if (pos) this.select(pos.h, pos.v);
    },
    onPointerUp() {
      this.dragging = false;
    },
  },
};
</script>

<style scoped>
.pos-pad-wrap {
  display: flex;
  flex-direction: column;
  align-items: center;
  width: 100%;
}
.pos-pad-row {
  display: flex;
  align-items: center;
  gap: 6px;
}
.pos-pad-vlabels {
  display: flex;
  flex-direction: column;
  justify-content: space-between;
  align-items: flex-end;
  height: 96px;
  font-size: 9px;
  opacity: 0.7;
  line-height: 1.1;
  white-space: nowrap;
}
.pos-pad {
  position: relative;
  width: 96px;
  height: 96px;
  border-radius: 8px;
  border: 1px solid rgba(var(--v-border-color), var(--v-border-opacity));
  background: rgba(128, 128, 128, 0.08);
  touch-action: none;
  cursor: pointer;
  flex: 0 0 auto;
}
.pos-pad__dot {
  position: absolute;
  width: 8px;
  height: 8px;
  margin: -4px;
  border-radius: 50%;
  border: 0;
  padding: 0;
  background: rgba(128, 128, 128, 0.45);
  cursor: pointer;
}
.pos-pad__dot--active {
  background: rgb(var(--v-theme-primary));
}
.pos-pad__handle {
  position: absolute;
  width: 18px;
  height: 18px;
  margin: -9px;
  border-radius: 50%;
  background: rgb(var(--v-theme-primary));
  border: 2px solid white;
  box-shadow: 0 1px 4px rgba(0, 0, 0, 0.4);
  pointer-events: none;
  transition: left 0.12s ease, top 0.12s ease;
}
.pos-pad-hlabels {
  display: flex;
  justify-content: space-between;
  width: 96px;
  margin-left: 34px;
  margin-top: 4px;
  font-size: 9px;
  opacity: 0.7;
}
.pos-pad-hlabels span:first-child { margin-left: -6px; }
.pos-pad-hlabels span:last-child { margin-right: -6px; }
</style>
