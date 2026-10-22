<template>
  <v-dialog v-model="dialogModel" max-width="720" scrollable>
    <v-card>
      <v-card-title class="d-flex align-center ga-2 flex-wrap">
        <v-icon color="primary">mdi-monitor-dashboard</v-icon>
        <span class="text-primary">Tela de Projeção</span>
        <v-spacer />
        <v-btn
          v-if="hasCustomArrangement"
          size="small"
          variant="text"
          prepend-icon="mdi-restore"
          @click="resetLayout"
        >
          Redefinir
        </v-btn>
        <v-btn
          size="small"
          variant="tonal"
          color="primary"
          prepend-icon="mdi-monitor-eye"
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
            :class="{
              'marr-tile--primary': tile.isPrimary,
              'marr-tile--dragging': draggingId === tile.id,
              'marr-tile--active-output': selectedId === tile.id,
            }"
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
              <div class="marr-tile__out-row">
                <span v-if="tile.id === selectedId" class="marr-tile__out marr-tile__out--output">Saída</span>
                <span v-if="tile.id === returnSelectedId" class="marr-tile__out marr-tile__out--return">Retorno</span>
              </div>
            </div>
            <div class="marr-tile__stand" />
            <div class="marr-tile__base" />
            <div v-if="tile.deviceName" class="marr-tile__device" :title="tile.deviceName">
              {{ tile.deviceName }}
            </div>
          </div>
        </div>

        <!-- Clicar (sem arrastar) num monitor aqui já seleciona/ativa ele
             como saída da projeção (ver onPointerUp) -- a grade "Monitor de
             saída" que existia aqui embaixo virou redundante (mesmos cards,
             mesma ação) e foi removida; só "Monitor de retorno" continua
             como seção separada abaixo, por ser uma atribuição independente. -->
        <p class="marr-hint text-caption text-medium-emphasis text-center mt-3 mb-4">
          Clique num monitor para projetar nele · arraste para reorganizar a posição física.
        </p>

        <v-alert
          v-if="outputNotFoundWarning"
          type="warning"
          density="compact"
          variant="tonal"
          class="mb-4"
        >
          Monitor de saída salvo não encontrado. Clique num monitor acima para selecionar de novo.
        </v-alert>

        <!-- ── Monitor de retorno (palco) ─────────────────────────── -->
        <v-divider class="mb-4" />
        <div class="text-subtitle-2 text-center mb-2">Monitor de retorno</div>
        <div class="d-flex justify-center mb-3">
          <v-btn
            size="small"
            variant="tonal"
            :color="returnOpen ? 'info' : undefined"
            :prepend-icon="returnOpen ? 'mdi-monitor-eye' : 'mdi-monitor-off'"
            @click="toggleReturn"
          >
            {{ returnOpen ? 'Desativar' : 'Ativar' }}
          </v-btn>
        </div>

        <v-alert
          v-if="returnNotFoundWarning"
          type="warning"
          density="compact"
          variant="tonal"
          class="mb-3"
        >
          Monitor de retorno salvo não encontrado. Selecione o monitor novamente.
        </v-alert>

        <!-- Lista sempre visível — sem v-if="returnOpen", igual ao menu antigo -->
        <div v-if="!loading && screens.length" class="d-flex flex-wrap justify-center ga-3">
          <div
            v-for="s in screens"
            :key="'ret-' + s.id"
            class="monitor-tile"
            :class="{ 'monitor-tile--primary': s.primary, 'monitor-tile--active-return': returnSelectedId === s.id }"
            :title="s.deviceName || undefined"
            @click="lockReturn(s.id)"
          >
            <div class="monitor-tile__screen">
              <v-icon v-if="s.primary" size="12" class="monitor-tile__star">mdi-star</v-icon>
              <span class="monitor-tile__num">{{ indexById[s.id] ?? '' }}</span>
              <span class="monitor-tile__res">{{ s.bounds.width }}×{{ s.bounds.height }}</span>
              <span class="monitor-tile__badge" :class="{ 'monitor-tile__badge--primary': s.primary }">
                {{ s.primary ? 'Principal' : 'Estendido' }}
              </span>
              <span v-if="s.id === selectedId" class="monitor-tile__out">Saída</span>
            </div>
            <div class="monitor-tile__stand" />
            <div class="monitor-tile__base" />
            <div v-if="s.deviceName" class="monitor-tile__device" :title="s.deviceName">{{ s.deviceName }}</div>
          </div>
        </div>

        <div class="d-flex justify-center mt-5">
          <v-btn
            size="small"
            variant="text"
            color="error"
            prepend-icon="mdi-restore-alert"
            @click="resetAll"
          >
            Redefinir tudo
          </v-btn>
        </div>
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

    // ── Monitor de saída/retorno -- estado que antes vivia em
    // MonitorSelector.vue (ver comentário no template acima). ──────────────
    selectedId: null,
    outputOpen: false,
    returnOpen: false,
    returnSelectedId: null,
    outputNotFoundWarning: false,
    returnNotFoundWarning: false,
    _outputOpenedHandler: null,
    _outputClosedHandler: null,
    _returnOpenedHandler: null,
    _returnClosedHandler: null,
    _displayNotFoundHandler: null,
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
          deviceName: s.deviceName || '',
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
          deviceName: v.deviceName,
        };
      });
    },
    // Mesma numeração dos cards do arranjo acima (0 = principal, 1/2/3... =
    // estendidos, na ordem em que vêm de getScreens) -- reaproveitada nos
    // cards de saída/retorno abaixo pra não ter dois esquemas de numeração
    // diferentes pro mesmo monitor dentro do mesmo diálogo.
    indexById() {
      const map = {};
      for (const t of this.tiles) map[t.id] = t.index;
      return map;
    },
  },
  watch: {
    modelValue(open) {
      if (open) this.refresh();
    },
  },
  async mounted() {
    this._resizeObserver = new ResizeObserver(() => this.measureStage());
    if (this.$refs.stageRef) this._resizeObserver.observe(this.$refs.stageRef);

    this._displaysChangedHandler = this.$electron.on?.("displays-changed", () => {
      if (this.modelValue) this.refreshScreens();
    });

    // Estado de saída/retorno (ver comentário no data() acima) -- carregado
    // já no mount (não só quando o diálogo abre) pelo mesmo motivo de
    // MonitorSelector.vue original: os badges "Saída"/"Retorno" nos cards
    // abaixo precisam disso assim que o usuário abrir o diálogo pela
    // primeira vez, sem esperar um refresh extra.
    const saved = await this.$electron.storeGet('output_display_id');
    if (saved) this.selectedId = saved;
    this.outputOpen = await this.$electron.isOutputOpen();

    this.returnOpen = await this.$electron.isReturnScreenOpen();
    const savedReturn = await this.$electron.storeGet('return_display_id');
    if (savedReturn) this.returnSelectedId = savedReturn;

    this._outputOpenedHandler = this.$electron.on('output-window-opened', () => {
      this.outputOpen = true;
    });
    this._outputClosedHandler = this.$electron.on('output-window-closed', () => {
      this.outputOpen = false;
    });
    this._returnOpenedHandler = this.$electron.on('return-window-opened', () => {
      this.returnOpen = true;
    });
    this._returnClosedHandler = this.$electron.on('return-window-closed', () => {
      this.returnOpen = false;
    });
    this._displayNotFoundHandler = this.$electron.on('output-display-not-found', ({ kind }) => {
      if (kind === 'return') this.returnNotFoundWarning = true;
      else this.outputNotFoundWarning = true;
    });
  },
  beforeUnmount() {
    this._resizeObserver?.disconnect();
    if (this._displaysChangedHandler) this.$electron.off?.("displays-changed", this._displaysChangedHandler);
    if (this._outputOpenedHandler) this.$electron.off('output-window-opened', this._outputOpenedHandler);
    if (this._outputClosedHandler) this.$electron.off('output-window-closed', this._outputClosedHandler);
    if (this._returnOpenedHandler) this.$electron.off('return-window-opened', this._returnOpenedHandler);
    if (this._returnClosedHandler) this.$electron.off('return-window-closed', this._returnClosedHandler);
    if (this._displayNotFoundHandler) this.$electron.off('output-display-not-found', this._displayNotFoundHandler);
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
        if (!this.selectedId && this.screens.length) {
          const ext = this.screens.find((s) => !s.primary);
          this.selectedId = (ext ?? this.screens[0]).id;
        }
        if (!this.returnSelectedId && this.screens.length) {
          const ext = this.screens.find((s) => !s.primary);
          this.returnSelectedId = (ext ?? this.screens[0]).id;
        }
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
      await this.$electron.identifyScreens();
    },

    // Só a posição dos cards no arranjo -- o botão "Redefinir" do topo é
    // pensado pra ser inofensivo/sem confirmação (só reorganiza o layout
    // visual). O reset completo (saída/retorno/salvos) é o resetAll() lá
    // embaixo, com aviso antes, por ser mais impactante.
    async resetLayout() {
      this.arrangement = [];
      await this.$electron.storeSet("monitor_arrangement", []);
    },

    // "Redefinir tudo" -- além do arranjo, também limpa o monitor de saída/
    // retorno escolhidos (desmarca e tira do electron-store de vez, via
    // storeRemove, não só storeSet(null)). Sem isso, uma escolha salva pra
    // um monitor que não existe mais (id trocado, projetor substituído etc.)
    // ficava presa pra sempre, sem um jeito de "começar do zero" além de
    // editar o arquivo de config na mão. Mais impactante que o "Redefinir"
    // de cima (fecha a projeção/retorno ativos), por isso pede confirmação.
    async resetAll() {
      this.$alert.yesno(
        { text: 'Isso vai fechar a projeção e o retorno ativos, e esquecer os monitores de saída/retorno escolhidos. Continuar?', translate: false },
        async (btn) => {
          if (btn !== 'yes') return;

          this.arrangement = [];
          await this.$electron.storeSet("monitor_arrangement", []);

          if (this.outputOpen) await this.$electron.closeOutput();
          if (this.returnOpen) await this.$electron.closeReturnScreen();
          this.outputOpen = false;
          this.returnOpen = false;
          this.selectedId = null;
          this.returnSelectedId = null;
          this.outputNotFoundWarning = false;
          this.returnNotFoundWarning = false;
          await this.$electron.storeRemove("output_display_id");
          await this.$electron.storeRemove("return_display_id");
        }
      );
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
      const offset = this.dragOffset; // captura antes de resetar (ver abaixo)
      this.draggingId = null;
      this.dragOffset = { x: 0, y: 0 };

      // Ponteiro soltou quase sem se mover (abaixo do limiar) -- trata como
      // CLIQUE, não arrasto: seleciona/ativa esse monitor como saída (ver
      // lock() abaixo), em vez de regravar a mesma posição de antes. É isso
      // que substitui a antiga grade "Monitor de saída" separada.
      if (Math.hypot(offset.x, offset.y) < 4) {
        await this.lock(id);
        return;
      }

      const scale = this.scale || 1;
      const newX = Math.round(this.dragOrigin.x + offset.x / scale);
      const newY = Math.round(this.dragOrigin.y + offset.y / scale);

      const next = this.arrangement.filter((a) => a.id !== id);
      next.push({ id, x: newX, y: newY });
      this.arrangement = next;
      await this.$electron.storeSet("monitor_arrangement", next);
    },
    onPointerCancel() {
      this.draggingId = null;
      this.dragOffset = { x: 0, y: 0 };
    },

    // ── Monitor de saída/retorno -- métodos que antes viviam em
    // MonitorSelector.vue (ver comentário no template/data acima). ─────────

    // Clicar num card de monitor não só memoriza a escolha — já ativa a
    // projeção nele na hora (o operador não deveria precisar de um segundo
    // clique em outro lugar pra ver o resultado). Se já estiver projetando
    // em OUTRO monitor, fecha e reabre no novo (createOutputWindow ignora um
    // displayId novo enquanto já está aberta — ver electron/main.js).
    async lock(id) {
      // Nunca projeta na tela principal (a do operador) -- clicar nela
      // força a escolha pro monitor estendido, já que a projeção é sempre
      // pensada pra uma segunda tela/projetor, nunca por cima da tela que o
      // próprio operador está olhando. Se não tiver NENHUMA outra tela pra
      // forçar, o clique não faz nada aqui (não deixa marcar a principal
      // neste diálogo) -- o aviso "projetar assim mesmo?" pra esse caso
      // aparece na hora de abrir uma projeção de verdade (ver Popup.js#open),
      // não aqui, que é só escolha/preferência.
      const target = this.screens.find((s) => s.id === id);
      if (target?.primary) {
        const ext = this.screens.find((s) => !s.primary);
        if (!ext) return;
        id = ext.id;
      }

      // Clicar de novo no MESMO monitor já ativo como saída desativa a
      // projeção -- mesmo toggle que lockReturn() já faz pro retorno (ver
      // comentário lá). Antes esse clique repetido não fazia nada.
      if (this.outputOpen && this.selectedId === id) {
        await this.$electron.closeOutput();
        this.outputOpen = false;
        return;
      }

      this.selectedId = id;
      this.outputNotFoundWarning = false;
      await this.$electron.storeSet('output_display_id', id);

      if (this.outputOpen) await this.$electron.closeOutput();

      // Mesma resolução de módulo do botão de abrir saída (ver
      // SystemBar.vue#openOutput) — sem um popup_module já definido, usa o
      // módulo ativo no momento (media minimizado conta como ativo).
      let moduleId = this.$appdata.get('popup_module');
      if (!moduleId) {
        const modules = this.$appdata.get('modules') || {};
        if (modules?.media?.minimized) {
          moduleId = 'media';
        } else {
          for (const [mid, mod] of Object.entries(modules)) {
            if (mod && mod.show) { moduleId = mid; break; }
          }
        }
        if (moduleId) this.$appdata.set('popup_module', moduleId);
      }
      await this.$electron.openOutput(moduleId, id);
      this.outputOpen = true;
      this.$appdata.set('popup', { closed: false, _electron: true });
    },

    async toggleReturn() {
      if (this.returnOpen) {
        await this.$electron.closeReturnScreen();
        this.returnOpen = false;
      } else {
        await this.$electron.openReturnScreen(this.returnSelectedId || null);
        this.returnOpen = true;
      }
    },

    // Mesma ideia do lock() acima, pro retorno: clicar num card ativa o
    // monitor de palco na hora, não só memoriza a escolha pra uma próxima
    // vez que o usuário apertar "Ativar retorno" manualmente. Clicar de novo
    // no MESMO card já ativo agora desativa (toggle) -- antes esse clique
    // repetido não fazia nada (só regravava a mesma escolha), então não tinha
    // como desligar o retorno clicando no card, só pelo botão "Retorno ativo".
    async lockReturn(id) {
      if (this.returnOpen && this.returnSelectedId === id) {
        await this.$electron.closeReturnScreen();
        this.returnOpen = false;
        return;
      }

      this.returnSelectedId = id;
      this.returnNotFoundWarning = false;
      await this.$electron.storeSet('return_display_id', id);

      if (this.returnOpen) await this.$electron.closeReturnScreen();
      await this.$electron.openReturnScreen(id);
      this.returnOpen = true;
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
/* Anel azul pra indicar "é esse o monitor de saída agora" -- clicar (sem
   arrastar) num tile aqui ativa ele como saída (ver onPointerUp). Regra
   depois de --primary de propósito: quando o mesmo monitor é primário E
   saída, o anel azul soma ao gradiente do primário em vez de substituí-lo
   (só troca border-color/box-shadow, nunca background). */
.marr-tile--active-output .marr-tile__screen {
  border-color: #2196F3;
  box-shadow: 0 0 0 2px rgba(33, 150, 243, 0.45), 0 0 20px rgba(33, 150, 243, 0.3);
}
.marr-tile--active-output .marr-tile__stand {
  background: rgba(33, 150, 243, 0.85);
}
.marr-tile--active-output .marr-tile__base {
  background: #2196F3;
}
/* Badges "Saída"/"Retorno" sobre um tile do arranjo -- marca ali, no PRÓPRIO
   tile (que agora também serve pra selecionar a saída, ver lock() no
   script), quais papéis esse monitor tem agora; mesma ideia do selo
   "Principal" já mostrado em cima, só pra saída/retorno. Os dois podem
   aparecer juntos (mesmo monitor sendo saída E retorno ao mesmo tempo, comum
   em setup de monitor único) -- por isso um wrapper em linha, não um badge
   só absoluto como antes. */
.marr-tile__out-row {
  position: absolute;
  bottom: -3px;
  left: 0;
  right: 0;
  display: flex;
  justify-content: center;
  gap: 4px;
}
.marr-tile__out {
  font-size: 10px;
  font-weight: 600;
  letter-spacing: 0.3px;
  text-transform: uppercase;
  border-radius: 3px;
  padding: 2px 6px;
  line-height: 1.4;
  color: #fff;
  white-space: nowrap;
}
.marr-tile__out--output {
  background: rgba(33, 150, 243, 0.85);
}
.marr-tile__out--return {
  background: rgba(33, 150, 243, 0.85);
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
/* Nome real do monitor (fabricante/modelo, via Display.label do Electron) —
   só aparece quando o driver/EDID expõe algo; truncado com "..." se não
   couber, texto completo disponível via title (tooltip nativo). */
.marr-tile__device {
  margin-top: 4px;
  max-width: 90%;
  font-size: 10px;
  opacity: 0.65;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

/* Cartão em forma de monitor (tela + pé + base) pros cards de saída/retorno
   abaixo do arranjo -- mesmo visual que já existia em MonitorSelector.vue
   (ver comentário no template sobre a junção num diálogo só). */
.monitor-tile {
  display: flex;
  flex-direction: column;
  align-items: center;
  cursor: pointer;
  user-select: none;
  gap: 0;
}
.monitor-tile__screen {
  position: relative;
  width: 112px;
  height: 72px;
  box-sizing: border-box;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 2px;
  padding: 6px;
  border-radius: 10px;
  border: 2px solid rgba(128, 128, 128, 0.3);
  background: rgba(128, 128, 128, 0.12);
  transition: border-color 0.15s ease, background 0.15s ease, box-shadow 0.15s ease;
}
.monitor-tile:hover .monitor-tile__screen {
  filter: brightness(1.12);
}
.monitor-tile--active-return .monitor-tile__screen {
  border-color: #2196F3;
  box-shadow: 0 0 0 1px rgba(33, 150, 243, 0.4);
}
.monitor-tile--primary .monitor-tile__screen {
  border-color: rgba(var(--v-theme-primary), 0.6);
  background: linear-gradient(135deg, rgb(var(--v-theme-primary)) 0%, #00497d 100%);
  color: #fff;
}
.monitor-tile__stand {
  width: 14px;
  height: 7px;
  background: rgba(128, 128, 128, 0.3);
}
.monitor-tile--primary .monitor-tile__stand {
  background: rgba(var(--v-theme-primary), 0.8);
}
.monitor-tile--active-return .monitor-tile__stand {
  background: rgba(33, 150, 243, 0.85);
}
.monitor-tile__base {
  width: 40px;
  height: 4px;
  border-radius: 999px;
  background: rgba(128, 128, 128, 0.3);
}
.monitor-tile--primary .monitor-tile__base {
  background: rgb(var(--v-theme-primary));
}
.monitor-tile--active-return .monitor-tile__base {
  background: #2196F3;
}
.monitor-tile__star {
  position: absolute;
  top: 4px;
  right: 4px;
  color: #fde047;
}
.monitor-tile__num {
  font-size: 22px;
  font-weight: 700;
  line-height: 1;
  letter-spacing: -1px;
}
.monitor-tile__res {
  font-size: 9px;
  opacity: 0.6;
  letter-spacing: 0.3px;
}
.monitor-tile__badge {
  margin-top: 1px;
  font-size: 8px;
  font-weight: 600;
  letter-spacing: 0.06em;
  text-transform: uppercase;
  opacity: 0.6;
}
.monitor-tile__badge--primary {
  opacity: 1;
}
.monitor-tile__out {
  position: absolute;
  bottom: -3px;
  font-size: 10px;
  font-weight: 600;
  letter-spacing: 0.3px;
  text-transform: uppercase;
  background: rgba(33, 150, 243, 0.85);
  border-radius: 3px;
  padding: 2px 6px;
  line-height: 1.4;
  color: #fff;
}
.monitor-tile__device {
  margin-top: 4px;
  max-width: 112px;
  font-size: 9px;
  opacity: 0.6;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
  text-align: center;
}
</style>
