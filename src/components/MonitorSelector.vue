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

      <div v-if="!loading && screens.length" class="d-flex flex-wrap justify-center gap-2 px-2 pt-1 pb-2">
        <div
          v-for="s in screens"
          :key="s.id"
          class="monitor-card monitor-card--output"
          :class="{ 'monitor-card--active-output': selectedId === s.id }"
          @click="lock(s.id)"
        >
          <span class="monitor-card__num">{{ monitorNum(s) }}</span>
          <span class="monitor-card__label">{{ s.label }}</span>
          <span class="monitor-card__res">{{ s.bounds.width }}×{{ s.bounds.height }}</span>
        </div>
      </div>

      <v-list-item
        v-if="!loading && screens.length === 0"
        prepend-icon="mdi-monitor-off"
        title="Nenhum monitor encontrado"
        disabled
      />

      <v-divider class="my-1" />

      <v-list-item prepend-icon="mdi-monitor-multiple" rounded="lg" @click="identify">
        <v-list-item-title>Identificar monitores</v-list-item-title>
      </v-list-item>

      <!-- ── Monitor de retorno (palco) ──────────────────────── -->
      <v-divider class="my-1" />

      <v-list-subheader>Monitor de retorno</v-list-subheader>

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
      <div v-if="!loading && screens.length" class="d-flex flex-wrap justify-center gap-2 px-2 pt-1 pb-2">
        <div
          v-for="s in screens"
          :key="'ret-' + s.id"
          class="monitor-card"
          :class="{ 'monitor-card--active-return': returnSelectedId === s.id }"
          @click="lockReturn(s.id)"
        >
          <span class="monitor-card__num">{{ monitorNum(s) }}</span>
          <span class="monitor-card__label">{{ s.label }}</span>
          <span class="monitor-card__res">{{ s.bounds.width }}×{{ s.bounds.height }}</span>
          <span v-if="s.id === selectedId" class="monitor-card__out">Saída</span>
        </div>
      </div>

    </v-list>
  </v-menu>
</template>

<script>
export default {
  name: 'MonitorSelectorComponent',
  data: () => ({
    menu: false,
    loading: false,
    screens: [],
    selectedId: null,
    returnOpen: false,
    returnSelectedId: null,
    _returnOpenedHandler: null,
    _returnClosedHandler: null,
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

    this.returnOpen = await this.$electron.isReturnScreenOpen();
    const savedReturn = await this.$electron.storeGet('return_display_id');
    if (savedReturn) this.returnSelectedId = savedReturn;

    this._returnOpenedHandler = this.$electron.on('return-window-opened', () => {
      this.returnOpen = true;
    });
    this._returnClosedHandler = this.$electron.on('return-window-closed', () => {
      this.returnOpen = false;
    });
  },
  beforeUnmount() {
    if (this._returnOpenedHandler)
      this.$electron.off('return-window-opened', this._returnOpenedHandler);
    if (this._returnClosedHandler)
      this.$electron.off('return-window-closed', this._returnClosedHandler);
  },
  methods: {
    async onToggle(open) {
      if (!open) return;
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

    async lock(id) {
      if (this.selectedId === id) return;
      this.selectedId = id;
      await this.$electron.storeSet('output_display_id', id);
      this.$userdata.set('modules.theme.output_display_id', id);
    },

    async identify() {
      this.menu = false;
      await this.$electron.identifyScreens();
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

    async lockReturn(id) {
      if (this.returnSelectedId === id) return;
      this.returnSelectedId = id;
      await this.$electron.storeSet('return_display_id', id);
      if (this.returnOpen) {
        await this.$electron.closeReturnScreen();
        await this.$electron.openReturnScreen(id);
      }
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
.monitor-card {
  min-width: 108px;
  height: 74px;
  background: rgba(12, 12, 15, 0.9);
  border: 2px solid rgba(255, 255, 255, 0.22);
  border-radius: 8px;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  color: #fff;
  cursor: pointer;
  transition: border-color 0.15s ease, background 0.15s ease;
  user-select: none;
  padding: 6px 14px;
  gap: 2px;
}
.monitor-card:hover {
  border-color: rgba(255, 255, 255, 0.5);
  background: rgba(30, 30, 38, 0.95);
}
.monitor-card--active-output {
  border-color: #2196F3;
  background: rgba(33, 150, 243, 0.12);
}
.monitor-card--active-return {
  border-color: #4CAF50;
  background: rgba(76, 175, 80, 0.12);
}
.monitor-card__num {
  font-size: 26px;
  font-weight: 700;
  line-height: 1;
  letter-spacing: -1px;
}
.monitor-card__label {
  font-size: 11px;
  opacity: 0.85;
  font-weight: 500;
}
.monitor-card__res {
  font-size: 10px;
  opacity: 0.45;
  letter-spacing: 0.3px;
}
.monitor-card__out {
  margin-top: 4px;
  font-size: 9px;
  font-weight: 600;
  letter-spacing: 0.5px;
  text-transform: uppercase;
  background: rgba(33, 150, 243, 0.85);
  border-radius: 3px;
  padding: 1px 5px;
  line-height: 1.4;
}
</style>
