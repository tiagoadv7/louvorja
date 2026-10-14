<template>
  <v-menu
    v-if="is_desktop"
    v-model="menu"
    location="bottom"
    :close-on-content-click="false"
    @update:model-value="onToggle"
  >
    <template v-slot:activator="{ props }">
      <v-tooltip location="bottom">
        <template v-slot:activator="{ props: tip }">
          <v-btn v-bind="{ ...props, ...tip }" icon="mdi-monitor-multiple" />
        </template>
        {{ tooltipText }}
      </v-tooltip>
    </template>

    <v-list density="compact" min-width="280">

      <!-- ── Monitor de saída ─────────────────────────────────── -->
      <v-list-subheader>Monitor de saída</v-list-subheader>

      <v-progress-linear v-if="loading" indeterminate height="2" class="mb-1" />

      <div v-if="!loading && screens.length" class="d-flex flex-wrap justify-center ga-3 px-2 pt-1 pb-2">
        <div
          v-for="s in screens"
          :key="s.id"
          class="monitor-tile"
          :class="{ 'monitor-tile--primary': s.primary, 'monitor-tile--active-output': selectedId === s.id }"
          :title="s.deviceName || undefined"
          @click="lock(s.id)"
        >
          <div class="monitor-tile__screen">
            <v-icon v-if="s.primary" size="12" class="monitor-tile__star">mdi-star</v-icon>
            <span class="monitor-tile__num">{{ monitorNum(s) }}</span>
            <span class="monitor-tile__res">{{ s.bounds.width }}×{{ s.bounds.height }}</span>
            <span class="monitor-tile__badge" :class="{ 'monitor-tile__badge--primary': s.primary }">
              {{ s.primary ? 'Principal' : 'Estendido' }}
            </span>
            <span v-if="s.id === returnSelectedId" class="monitor-tile__out monitor-tile__out--return">Retorno</span>
          </div>
          <div class="monitor-tile__stand" />
          <div class="monitor-tile__base" />
          <div v-if="s.deviceName" class="monitor-tile__device" :title="s.deviceName">{{ s.deviceName }}</div>
        </div>
      </div>

      <v-list-item
        v-if="!loading && screens.length === 0"
        prepend-icon="mdi-monitor-off"
        title="Nenhum monitor encontrado"
        disabled
      />

      <v-list-item
        v-if="outputNotFoundWarning"
        prepend-icon="mdi-alert"
        title="Monitor de saída salvo não encontrado"
        subtitle="Selecione o monitor novamente"
        density="compact"
      />

      <v-divider class="my-1" />

      <v-list-item prepend-icon="mdi-monitor-dashboard" rounded="lg" @click="openArrangement">
        <v-list-item-title>Arranjo de monitores</v-list-item-title>
      </v-list-item>

      <v-list-item prepend-icon="mdi-monitor-multiple" rounded="lg" @click="identify">
        <v-list-item-title>Identificar monitores</v-list-item-title>
      </v-list-item>

      <!-- ── Monitor de retorno (palco) ──────────────────────── -->
      <v-divider class="my-1" />

      <v-list-subheader>Monitor de retorno</v-list-subheader>

      <v-list-item
        v-if="returnNotFoundWarning"
        prepend-icon="mdi-alert"
        title="Monitor de retorno salvo não encontrado"
        subtitle="Selecione o monitor novamente"
        density="compact"
      />

      <v-list-item
        :prepend-icon="returnOpen ? 'mdi-monitor-eye' : 'mdi-monitor-off'"
        :active="returnOpen"
        :color="returnOpen ? 'success' : undefined"
        rounded="lg"
        @click="toggleReturn"
      >
        <v-list-item-title>{{ returnOpen ? 'Retorno ativo' : 'Ativar retorno' }}</v-list-item-title>
      </v-list-item>

      <!-- Lista sempre visível — sem v-if="returnOpen" -->
      <div v-if="!loading && screens.length" class="d-flex flex-wrap justify-center ga-3 px-2 pt-1 pb-2">
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
            <span class="monitor-tile__num">{{ monitorNum(s) }}</span>
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

    </v-list>
  </v-menu>

  <MonitorArrangementDialog v-if="is_desktop" v-model="arrangementOpen" />
</template>

<script>
import MonitorArrangementDialog from "@/components/MonitorArrangementDialog.vue";

export default {
  name: 'MonitorSelectorComponent',
  components: { MonitorArrangementDialog },
  data: () => ({
    arrangementOpen: false,
    menu: false,
    loading: false,
    screens: [],
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
    _displaysChangedHandler: null,
    _displayNotFoundHandler: null,
  }),
  computed: {
    is_desktop() {
      return this.$appdata.get('is_desktop');
    },
    tooltipText() {
      if (!this.selectedId || !this.screens.length) return 'Monitor de saída';
      const s = this.screens.find(s => s.id === this.selectedId);
      if (!s) return 'Monitor de saída';
      return `Saída: ${s.label}`;
    },
  },
  async mounted() {
    if (!this.$electron.isElectron()) return;

    const saved = await this.$electron.storeGet('output_display_id');
    if (saved) this.selectedId = saved;
    this.outputOpen = await this.$electron.isOutputOpen();

    this.returnOpen = await this.$electron.isReturnScreenOpen();
    const savedReturn = await this.$electron.storeGet('return_display_id');
    if (savedReturn) this.returnSelectedId = savedReturn;

    // Espelha o mesmo evento que SystemBar.vue já escuta — necessário aqui
    // pra saber se um clique num monitor de saída deve abrir a projeção do
    // zero ou fechar+reabrir no monitor novo (ver lock()).
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
    // Monitor plugado/desplugado ou resolução alterada (ver electron/main.js,
    // reconcileDisplays()) — a janela de saída/retorno já se reajusta sozinha
    // do lado do processo main; aqui só precisamos atualizar a lista de cards
    // exibida, que antes só era recarregada ao reabrir o menu (onToggle).
    this._displaysChangedHandler = this.$electron.on('displays-changed', () => {
      this.refreshScreens();
    });
    // Emitido pelo processo main (electron/main.js, resolveOutputDisplay/
    // resolveReturnDisplay) quando o monitor salvo não é mais encontrado entre
    // os conectados (ex.: projetor com id instável entre reconexões) e a
    // janela caiu no monitor de fallback em vez do escolhido — sem isso o
    // operador só descobriria olhando a projeção real, sem saber o motivo.
    this._displayNotFoundHandler = this.$electron.on('output-display-not-found', ({ kind }) => {
      if (kind === 'return') this.returnNotFoundWarning = true;
      else this.outputNotFoundWarning = true;
    });
  },
  beforeUnmount() {
    if (this._outputOpenedHandler)
      this.$electron.off('output-window-opened', this._outputOpenedHandler);
    if (this._outputClosedHandler)
      this.$electron.off('output-window-closed', this._outputClosedHandler);
    if (this._returnOpenedHandler)
      this.$electron.off('return-window-opened', this._returnOpenedHandler);
    if (this._returnClosedHandler)
      this.$electron.off('return-window-closed', this._returnClosedHandler);
    if (this._displaysChangedHandler)
      this.$electron.off('displays-changed', this._displaysChangedHandler);
    if (this._displayNotFoundHandler)
      this.$electron.off('output-display-not-found', this._displayNotFoundHandler);
  },
  methods: {
    async onToggle(open) {
      if (!open) return;
      await this.refreshScreens();
    },

    // Recarrega a lista de monitores (cards do menu). Usado tanto ao abrir o
    // menu (onToggle) quanto reativamente quando o Electron avisa que a
    // configuração de monitores mudou (plugou/desplugou/mudou resolução) —
    // ver o listener 'displays-changed' registrado em mounted().
    async refreshScreens() {
      this.loading = true;
      try {
        this.screens = (await this.$electron.getScreens()) || [];
        if (!this.selectedId && this.screens.length) {
          const ext = this.screens.find(s => !s.primary);
          this.selectedId = (ext ?? this.screens[0]).id;
        }
        if (!this.returnSelectedId && this.screens.length) {
          const ext = this.screens.find(s => !s.primary);
          this.returnSelectedId = (ext ?? this.screens[0]).id;
        }
      } finally {
        this.loading = false;
      }
    },

    // Clicar num card de monitor não só memoriza a escolha — já ativa a
    // projeção nele na hora (o operador não deveria precisar de um segundo
    // clique em outro lugar pra ver o resultado). Se já estiver projetando
    // em OUTRO monitor, fecha e reabre no novo (createOutputWindow ignora um
    // displayId novo enquanto já está aberta — ver electron/main.js).
    async lock(id) {
      const movedScreen = this.selectedId !== id;
      this.selectedId = id;
      this.outputNotFoundWarning = false;
      await this.$electron.storeSet('output_display_id', id);

      if (this.outputOpen && !movedScreen) return;
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

    async identify() {
      this.menu = false;
      await this.$electron.identifyScreens();
    },

    openArrangement() {
      this.menu = false;
      this.arrangementOpen = true;
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
    // vez que o usuário apertar "Ativar retorno" manualmente.
    async lockReturn(id) {
      const movedScreen = this.returnSelectedId !== id;
      this.returnSelectedId = id;
      this.returnNotFoundWarning = false;
      await this.$electron.storeSet('return_display_id', id);

      if (this.returnOpen && !movedScreen) return;
      if (this.returnOpen) await this.$electron.closeReturnScreen();
      await this.$electron.openReturnScreen(id);
      this.returnOpen = true;
    },

    monitorNum(s) {
      if (s.primary) return 0;
      const m = s.label.match(/\d+/);
      return m ? parseInt(m[0]) : '';
    },
  },
};
</script>

<style scoped>
/* Cartão em forma de monitor (tela + pé + base), inspirado no arranjo de
   monitores do pianolouvorja/app — substitui o antigo retângulo liso.
   Primário ganha gradiente + estrela; os demais ficam neutros. */
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
  border: 2px solid rgba(255, 255, 255, 0.22);
  background: rgba(12, 12, 15, 0.9);
  color: #fff;
  transition: border-color 0.15s ease, background 0.15s ease, box-shadow 0.15s ease;
}
/* Só brilho no hover (filter, não background/border-color) — sem isso,
   passar o mouse sobre o card "Principal" (ou qualquer um já selecionado)
   apagava o gradiente/cor de destaque, deixando só um contorno neutro. */
.monitor-tile:hover .monitor-tile__screen {
  filter: brightness(1.18);
}
.monitor-tile--active-output .monitor-tile__screen {
  border-color: #2196F3;
  box-shadow: 0 0 0 1px rgba(33, 150, 243, 0.4);
}
.monitor-tile--active-return .monitor-tile__screen {
  border-color: #4CAF50;
  box-shadow: 0 0 0 1px rgba(76, 175, 80, 0.4);
}
.monitor-tile--primary .monitor-tile__screen {
  border-color: rgba(var(--v-theme-primary), 0.6);
  background: linear-gradient(135deg, rgb(var(--v-theme-primary)) 0%, #00497d 100%);
}
.monitor-tile__stand {
  width: 14px;
  height: 7px;
  background: rgba(255, 255, 255, 0.22);
}
.monitor-tile--primary .monitor-tile__stand {
  background: rgba(var(--v-theme-primary), 0.8);
}
/* Selecionado (saída/retorno) — pé/base acompanham a mesma cor do contorno
   da tela (ver .monitor-tile--active-output/--active-return acima), em vez
   de ficarem cinza mesmo com o monitor selecionado. */
.monitor-tile--active-output .monitor-tile__stand {
  background: rgba(33, 150, 243, 0.85);
}
.monitor-tile--active-return .monitor-tile__stand {
  background: rgba(76, 175, 80, 0.85);
}
.monitor-tile__base {
  width: 40px;
  height: 4px;
  border-radius: 999px;
  background: rgba(255, 255, 255, 0.22);
}
.monitor-tile--primary .monitor-tile__base {
  background: rgb(var(--v-theme-primary));
}
.monitor-tile--active-output .monitor-tile__base {
  background: #2196F3;
}
.monitor-tile--active-return .monitor-tile__base {
  background: #4CAF50;
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
  font-size: 8px;
  font-weight: 600;
  letter-spacing: 0.4px;
  text-transform: uppercase;
  background: rgba(33, 150, 243, 0.85);
  border-radius: 3px;
  padding: 1px 5px;
  line-height: 1.4;
  color: #fff;
}
/* Badge "Retorno" no card de Monitor de saída — mesma ideia do badge
   "Saída" acima (marca ali qual monitor o OUTRO papel está usando), só que
   na cor verde já usada em todo o resto pro retorno. */
.monitor-tile__out--return {
  background: rgba(76, 175, 80, 0.85);
}
/* Nome/modelo real do monitor (Display.label do Electron, ver
   screen:get-all/deviceName em electron/ipc.js) — só aparece quando o
   driver/EDID do monitor expõe algo (ex. "LG TV SSCR2"); truncado com "…"
   se não couber, nome completo disponível via title (tooltip nativo).
   Mesmo padrão do .marr-tile__device em MonitorArrangementDialog.vue. */
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
