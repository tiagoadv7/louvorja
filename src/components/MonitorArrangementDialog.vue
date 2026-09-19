<template>
  <v-dialog v-model="dialogModel" max-width="720" scrollable>
    <v-card>
      <v-card-title class="d-flex align-center ga-2 flex-wrap">
        <v-icon>mdi-monitor-dashboard</v-icon>
        <span>Arranjo de Monitores</span>
        <v-spacer />
        <v-btn
          v-if="hasCustomArrangement"
          size="small"
          variant="text"
          prepend-icon="mdi-restore"
          @click="resetLayout"
        >
          Redefinir arranjo
        </v-btn>
        <v-btn
          size="small"
          variant="tonal"
          color="primary"
          prepend-icon="mdi-monitor-eye"
          :loading="identifying"
          :disabled="screens.length === 0"
          @click="identify"
        >
          Identificar Monitores
        </v-btn>
        <v-btn icon="mdi-close" variant="text" size="small" @click="dialogModel = false" />
      </v-card-title>

      <v-card-text>
        <div
          ref="stageRef"
          class="marr-stage"
          :class="{ 'marr-stage--dragging': draggingId != null }"
          @pointermove="onPointerMove"
          @pointerup="onPointerUp"
          @pointercancel="onPointerCancel"
        >
          <div v-if="!loading && screens.length === 0" class="marr-empty">
            Nenhum monitor encontrado.
          </div>

          <div
            v-for="tile in tiles"
            :key="tile.id"
            class="marr-tile"
            :class="{ 'marr-tile--primary': tile.isPrimary, 'marr-tile--dragging': draggingId === tile.id }"
            :style="{
              width: `${tile.width}px`,
              height: `${tile.height + 22}px`,
              transform: `translate(${tile.left}px, ${tile.top}px)`,
              zIndex: draggingId === tile.id ? 20 : (tile.isPrimary ? 5 : 2),
            }"
            @pointerdown="onPointerDown($event, tile.id)"
          >
            <div class="marr-tile__screen" :style="{ height: `${tile.height}px` }">
              <v-icon v-if="tile.isPrimary" size="16" class="marr-tile__star">mdi-star</v-icon>
              <span class="marr-tile__index">{{ tile.index }}</span>
              <span class="marr-tile__res">{{ tile.resolutionLabel }}</span>
              <span class="marr-tile__badge" :class="{ 'marr-tile__badge--primary': tile.isPrimary }">
                {{ tile.isPrimary ? 'Principal' : 'Estendido' }}
              </span>
            </div>
            <div class="marr-tile__stand" />
            <div class="marr-tile__base" />
          </div>
        </div>

        <p class="marr-hint text-caption text-medium-emphasis text-center mt-3 mb-0">
          Arraste os monitores para reorganizar a posição física.
        </p>
      </v-card-text>
    </v-card>
  </v-dialog>
</template>

<script>
// Margem de folga em torno do bounding-box dos monitores (0.68 = ocupa 68%
// do canvas, deixando espaço pro usuário arrastar além do "encaixe" natural).
const FIT_FACTOR = 0.68;
const MIN_TILE_W = 64;
const MIN_TILE_H = 40;
const PRIMARY_SCALE_BOOST = 1.04;

export default {
  name: "MonitorArrangementDialog",
  props: {
    modelValue: { type: Boolean, default: false },
  },
  emits: ["update:modelValue"],
  data: () => ({
    loading: false,
    identifying: false,
    screens: [],
    arrangement: [],       // [{ id, x, y }] — override só de posição, nunca de tamanho
    stageW: 0,
    stageH: 0,
    draggingId: null,
    dragStart: { x: 0, y: 0 },
    dragOffset: { x: 0, y: 0 },
    dragOrigin: { x: 0, y: 0 }, // posição virtual (mundo) de onde o drag começou
    _resizeObserver: null,
    _displaysChangedHandler: null,
  }),
  computed: {
    dialogModel: {
      get() { return this.modelValue; },
      set(v) { this.$emit("update:modelValue", v); },
    },
    hasCustomArrangement() {
      return this.arrangement.length > 0;
    },
    // Bounding box (em coordenadas "virtuais" — bounds reais, com x/y
    // trocados pelo arranjo salvo quando existir) sobre todos os monitores.
    worldBox() {
      const virtual = this.virtualDisplays;
      if (!virtual.length) return null;
      const minX = Math.min(...virtual.map((v) => v.x));
      const minY = Math.min(...virtual.map((v) => v.y));
      const maxX = Math.max(...virtual.map((v) => v.x + v.width));
      const maxY = Math.max(...virtual.map((v) => v.y + v.height));
      return { minX, minY, width: Math.max(1, maxX - minX), height: Math.max(1, maxY - minY) };
    },
    virtualDisplays() {
      return this.screens.map((s) => {
        const slot = this.arrangement.find((a) => a.id === s.id);
        return {
          id: s.id,
          x: slot ? slot.x : s.bounds.x,
          y: slot ? slot.y : s.bounds.y,
          width: s.bounds.width,
          height: s.bounds.height,
          isPrimary: s.primary,
        };
      });
    },
    // Escala que encaixa o bounding-box no canvas, com a margem de FIT_FACTOR.
    scale() {
      const box = this.worldBox;
      if (!box || !this.stageW || !this.stageH) return 1;
      return Math.min(
        (this.stageW * FIT_FACTOR) / box.width,
        (this.stageH * FIT_FACTOR) / box.height,
      );
    },
    tiles() {
      const box = this.worldBox;
      if (!box) return [];
      const scale = this.scale;
      const scaledW = box.width * scale;
      const scaledH = box.height * scale;
      const offsetX = (this.stageW - scaledW) / 2 - box.minX * scale;
      const offsetY = (this.stageH - scaledH) / 2 - box.minY * scale;

      let extIdx = 0;
      return this.virtualDisplays.map((v) => {
        const boost = v.isPrimary ? PRIMARY_SCALE_BOOST : 1;
        const isDragging = this.draggingId === v.id;
        const dx = isDragging ? this.dragOffset.x : 0;
        const dy = isDragging ? this.dragOffset.y : 0;
        return {
          id: v.id,
          left: v.x * scale + offsetX + dx,
          top: v.y * scale + offsetY + dy,
          width: Math.max(MIN_TILE_W, v.width * scale * boost),
          height: Math.max(MIN_TILE_H, v.height * scale * boost),
          isPrimary: v.isPrimary,
          index: v.isPrimary ? 0 : ++extIdx,
          resolutionLabel: `${v.width}×${v.height}`,
        };
      });
    },
  },
  watch: {
    modelValue(open) {
      if (open) this.refresh();
    },
  },
  mounted() {
    this._resizeObserver = new ResizeObserver(() => this.measureStage());
    if (this.$refs.stageRef) this._resizeObserver.observe(this.$refs.stageRef);

    this._displaysChangedHandler = this.$electron.on?.("displays-changed", () => {
      if (this.modelValue) this.refreshScreens();
    });
  },
  beforeUnmount() {
    this._resizeObserver?.disconnect();
    if (this._displaysChangedHandler) this.$electron.off?.("displays-changed", this._displaysChangedHandler);
  },
  methods: {
    async refresh() {
      const saved = await this.$electron.storeGet("monitor_arrangement");
      this.arrangement = Array.isArray(saved) ? saved : [];
      await this.refreshScreens();
      this.$nextTick(() => this.measureStage());
    },
    async refreshScreens() {
      this.loading = true;
      try {
        this.screens = (await this.$electron.getScreens()) || [];
        // Descarta posições salvas de monitores que não estão mais conectados.
        const ids = new Set(this.screens.map((s) => s.id));
        this.arrangement = this.arrangement.filter((a) => ids.has(a.id));
      } finally {
        this.loading = false;
      }
    },
    measureStage() {
      const el = this.$refs.stageRef;
      if (!el) return;
      this.stageW = el.clientWidth;
      this.stageH = el.clientHeight;
      if (this._resizeObserver && el) this._resizeObserver.observe(el);
    },

    async identify() {
      this.identifying = true;
      try {
        await this.$electron.identifyScreens();
      } finally {
        this.identifying = false;
      }
    },

    async resetLayout() {
      this.arrangement = [];
      await this.$electron.storeSet("monitor_arrangement", []);
    },

    onPointerDown(event, id) {
      if (event.button !== 0) return;
      event.currentTarget.setPointerCapture?.(event.pointerId);
      const v = this.virtualDisplays.find((d) => d.id === id);
      this.draggingId = id;
      this.dragStart = { x: event.clientX, y: event.clientY };
      this.dragOffset = { x: 0, y: 0 };
      this.dragOrigin = { x: v?.x ?? 0, y: v?.y ?? 0 };
    },
    onPointerMove(event) {
      if (this.draggingId == null) return;
      this.dragOffset = {
        x: event.clientX - this.dragStart.x,
        y: event.clientY - this.dragStart.y,
      };
    },
    async onPointerUp() {
      if (this.draggingId == null) return;
      const id = this.draggingId;
      const scale = this.scale || 1;
      const newX = Math.round(this.dragOrigin.x + this.dragOffset.x / scale);
      const newY = Math.round(this.dragOrigin.y + this.dragOffset.y / scale);

      const next = this.arrangement.filter((a) => a.id !== id);
      next.push({ id, x: newX, y: newY });
      this.arrangement = next;
      await this.$electron.storeSet("monitor_arrangement", next);

      this.draggingId = null;
      this.dragOffset = { x: 0, y: 0 };
    },
    onPointerCancel() {
      this.draggingId = null;
      this.dragOffset = { x: 0, y: 0 };
    },
  },
};
</script>

<style scoped>
.marr-stage {
  position: relative;
  overflow: hidden;
  width: 100%;
  min-height: 20rem;
  height: 20rem;
  border-radius: 12px;
  background: radial-gradient(circle at 50% 40%, rgba(var(--v-theme-primary), 0.12), transparent 55%),
    rgba(128, 128, 128, 0.06);
  touch-action: none;
  user-select: none;
}
.marr-stage--dragging {
  cursor: grabbing;
}
.marr-empty {
  position: absolute;
  top: 50%;
  left: 50%;
  transform: translate(-50%, -50%);
  opacity: 0.5;
  font-size: 0.85rem;
}
.marr-tile {
  position: absolute;
  top: 0;
  left: 0;
  display: flex;
  flex-direction: column;
  align-items: center;
  cursor: grab;
  touch-action: none;
  will-change: transform;
  transition: filter 160ms ease;
}
.marr-tile:hover:not(.marr-tile--dragging) {
  filter: brightness(1.08);
}
.marr-tile--dragging {
  cursor: grabbing;
  filter: drop-shadow(0 12px 20px rgba(0, 0, 0, 0.35));
}
.marr-tile__screen {
  position: relative;
  width: 100%;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 2px;
  padding: 6px;
  box-sizing: border-box;
  border-radius: 10px;
  border: 1px solid rgba(128, 128, 128, 0.25);
  background: rgba(128, 128, 128, 0.12);
}
.marr-tile--primary .marr-tile__screen {
  border-color: rgba(var(--v-theme-primary), 0.6);
  background: linear-gradient(135deg, rgb(var(--v-theme-primary)) 0%, #00497d 100%);
  color: #fff;
  box-shadow: 0 0 0 2px rgba(var(--v-theme-primary), 0.4), 0 0 32px rgba(var(--v-theme-primary), 0.3);
}
.marr-tile__star {
  position: absolute;
  top: 6px;
  right: 6px;
  color: #fde047;
}
.marr-tile__index {
  font-size: 20px;
  font-weight: 700;
  letter-spacing: -0.02em;
  line-height: 1;
}
.marr-tile--primary .marr-tile__index {
  font-size: 24px;
}
.marr-tile__res {
  font-size: 10px;
  opacity: 0.7;
  white-space: nowrap;
}
.marr-tile__badge {
  margin-top: 2px;
  padding: 1px 7px;
  border: 1px solid rgba(128, 128, 128, 0.25);
  border-radius: 999px;
  font-size: 8px;
  font-weight: 600;
  letter-spacing: 0.08em;
  text-transform: uppercase;
  opacity: 0.7;
  white-space: nowrap;
}
.marr-tile__badge--primary {
  border: 0;
  background: rgba(255, 255, 255, 0.22);
  opacity: 1;
}
.marr-tile__stand {
  width: 20px;
  height: 8px;
  background: rgba(128, 128, 128, 0.3);
}
.marr-tile--primary .marr-tile__stand {
  background: rgba(var(--v-theme-primary), 0.8);
}
.marr-tile__base {
  width: 52px;
  height: 4px;
  border-radius: 999px;
  background: rgba(128, 128, 128, 0.3);
}
.marr-tile--primary .marr-tile__base {
  background: rgb(var(--v-theme-primary));
}
</style>
